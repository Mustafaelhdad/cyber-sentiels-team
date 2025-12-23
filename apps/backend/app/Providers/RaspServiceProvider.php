<?php

namespace App\Providers;

use App\Rasp\RaspContext;
use App\Rasp\RaspEvent;
use App\Rasp\RaspService;
use Illuminate\Http\Client\Events\RequestSending;
use Illuminate\Http\Client\Events\ResponseReceived;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\ServiceProvider;

/**
 * RASP Service Provider.
 *
 * Registers sink instrumentation hooks for database queries,
 * outbound HTTP requests, and filesystem operations.
 */
class RaspServiceProvider extends ServiceProvider
{
  /**
   * Register services.
   */
  public function register(): void
  {
    //
  }

  /**
   * Bootstrap services.
   */
  public function boot(): void
  {
    if (!config('rasp.enabled', true)) {
      return;
    }

    $this->registerDatabaseHooks();
    $this->registerHttpHooks();
    $this->registerFilesystemMacros();
  }

  /**
   * Register database query listener.
   */
  private function registerDatabaseHooks(): void
  {
    if (!config('rasp.sinks.database', true)) {
      return;
    }

    DB::listen(function ($query) {
      $context = RaspContext::getInstance();
      $raspService = app(RaspService::class);

      // Skip if no trace ID (request not initialized)
      $traceId = $context->getTraceId();
      if (!$traceId) {
        return;
      }

      // Detect SQL injection patterns
      $detectionType = $raspService->detectSqlInjection($query->sql);
      $action = $raspService->determineAction($detectionType);

      // Determine severity based on detection
      $severity = $detectionType
        ? RaspEvent::SEVERITY_WARNING
        : RaspEvent::SEVERITY_DEBUG;

      // Create and emit event
      $event = RaspEvent::database(
        traceId: $traceId,
        query: $this->truncateQuery($query->sql),
        bindings: $this->sanitizeBindings($query->bindings),
        timeMs: $query->time,
        severity: $severity,
        action: $action,
        detectionType: $detectionType,
      );

      $raspService->emit($event);

      // Block if in blocking mode and detection triggered
      if ($event->shouldBlock() && $raspService->isBlockingEnabled()) {
        throw new \App\Rasp\Exceptions\RaspBlockedException(
          "RASP blocked suspicious database query: {$detectionType}",
          $event
        );
      }
    });
  }

  /**
   * Register HTTP client hooks.
   */
  private function registerHttpHooks(): void
  {
    if (!config('rasp.sinks.http', true)) {
      return;
    }

    // Track request start times
    $requestTimes = [];

    // Before request is sent
    Event::listen(RequestSending::class, function (RequestSending $event) use (&$requestTimes) {
      $context = RaspContext::getInstance();
      $raspService = app(RaspService::class);

      $traceId = $context->getTraceId();
      if (!$traceId) {
        return;
      }

      $url = (string) $event->request->url();
      $method = $event->request->method();

      // Store start time
      $requestId = spl_object_id($event->request);
      $requestTimes[$requestId] = microtime(true);

      // Detect SSRF patterns
      $detectionType = $raspService->detectSsrf($url);
      $action = $raspService->determineAction($detectionType);

      if ($detectionType) {
        $severity = RaspEvent::SEVERITY_WARNING;

        $raspEvent = RaspEvent::http(
          traceId: $traceId,
          method: $method,
          url: $this->redactUrl($url),
          severity: $severity,
          action: $action,
          detectionType: $detectionType,
        );

        $raspService->emit($raspEvent);

        // Block if in blocking mode
        if ($raspEvent->shouldBlock() && $raspService->isBlockingEnabled()) {
          throw new \App\Rasp\Exceptions\RaspBlockedException(
            "RASP blocked suspicious outbound request: {$detectionType}",
            $raspEvent
          );
        }
      }
    });

    // After response received
    Event::listen(ResponseReceived::class, function (ResponseReceived $event) use (&$requestTimes) {
      $context = RaspContext::getInstance();
      $raspService = app(RaspService::class);

      $traceId = $context->getTraceId();
      if (!$traceId) {
        return;
      }

      $requestId = spl_object_id($event->request);
      $startTime = $requestTimes[$requestId] ?? null;
      unset($requestTimes[$requestId]);

      $timeMs = $startTime ? (microtime(true) - $startTime) * 1000 : null;

      $url = (string) $event->request->url();
      $method = $event->request->method();
      $statusCode = $event->response->status();

      // Log completed request (debug level)
      $raspEvent = RaspEvent::http(
        traceId: $traceId,
        method: $method,
        url: $this->redactUrl($url),
        statusCode: $statusCode,
        timeMs: $timeMs,
        severity: RaspEvent::SEVERITY_DEBUG,
      );

      $raspService->emit($raspEvent);
    });
  }

  /**
   * Register filesystem operation macros.
   */
  private function registerFilesystemMacros(): void
  {
    if (!config('rasp.sinks.filesystem', true)) {
      return;
    }

    // We'll use a helper class instead of macros for cleaner implementation
    // The RaspFilesystem wrapper will be used explicitly in code
  }

  /**
   * Truncate long queries for logging.
   */
  private function truncateQuery(string $sql, int $maxLength = 1000): string
  {
    if (strlen($sql) <= $maxLength) {
      return $sql;
    }
    return substr($sql, 0, $maxLength) . '... [TRUNCATED]';
  }

  /**
   * Sanitize query bindings (redact sensitive values).
   */
  private function sanitizeBindings(array $bindings): array
  {
    $sensitivePatterns = [
      '/password/i',
      '/secret/i',
      '/token/i',
      '/api_key/i',
    ];

    return array_map(function ($value) use ($sensitivePatterns) {
      if (!is_string($value)) {
        return $value;
      }

      // Check if value looks like a password or secret
      if (strlen($value) > 20 && preg_match('/^[a-zA-Z0-9+\/=]+$/', $value)) {
        return '[POSSIBLE_SECRET]';
      }

      return $value;
    }, $bindings);
  }

  /**
   * Redact sensitive parts of URLs (query params, auth).
   */
  private function redactUrl(string $url): string
  {
    $parsed = parse_url($url);
    if (!$parsed) {
      return $url;
    }

    // Redact userinfo
    if (isset($parsed['user']) || isset($parsed['pass'])) {
      $parsed['user'] = '[REDACTED]';
      $parsed['pass'] = '[REDACTED]';
    }

    // Redact sensitive query params
    if (isset($parsed['query'])) {
      parse_str($parsed['query'], $queryParams);
      $sensitiveKeys = config('rasp.redaction.params', []);

      foreach ($queryParams as $key => $value) {
        if (in_array(strtolower($key), $sensitiveKeys, true)) {
          $queryParams[$key] = '[REDACTED]';
        }
      }

      $parsed['query'] = http_build_query($queryParams);
    }

    return $this->buildUrl($parsed);
  }

  /**
   * Rebuild URL from parsed components.
   */
  private function buildUrl(array $parts): string
  {
    $url = '';

    if (isset($parts['scheme'])) {
      $url .= $parts['scheme'] . '://';
    }

    if (isset($parts['user'])) {
      $url .= $parts['user'];
      if (isset($parts['pass'])) {
        $url .= ':' . $parts['pass'];
      }
      $url .= '@';
    }

    if (isset($parts['host'])) {
      $url .= $parts['host'];
    }

    if (isset($parts['port'])) {
      $url .= ':' . $parts['port'];
    }

    if (isset($parts['path'])) {
      $url .= $parts['path'];
    }

    if (isset($parts['query'])) {
      $url .= '?' . $parts['query'];
    }

    if (isset($parts['fragment'])) {
      $url .= '#' . $parts['fragment'];
    }

    return $url;
  }
}
