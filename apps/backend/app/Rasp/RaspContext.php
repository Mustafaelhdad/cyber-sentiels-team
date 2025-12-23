<?php

namespace App\Rasp;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * RASP Context Container.
 *
 * Holds the current request context and identity information
 * for use by sink instrumentation throughout the request lifecycle.
 */
class RaspContext
{
  private static ?self $instance = null;

  private string $traceId;
  private ?array $requestContext = null;
  private ?array $identityContext = null;
  private array $counters = [];

  private function __construct()
  {
    $this->traceId = (string) Str::uuid();
  }

  /**
   * Get or create the singleton instance.
   */
  public static function getInstance(): self
  {
    if (self::$instance === null) {
      self::$instance = new self();
    }
    return self::$instance;
  }

  /**
   * Reset the context (for testing or new requests).
   */
  public static function reset(): void
  {
    self::$instance = null;
  }

  /**
   * Get the current trace ID.
   */
  public function getTraceId(): string
  {
    return $this->traceId;
  }

  /**
   * Set trace ID from an existing header if present.
   */
  public function setTraceId(string $traceId): void
  {
    $this->traceId = $traceId;
  }

  /**
   * Initialize request context from an HTTP request.
   */
  public function initFromRequest(Request $request): void
  {
    // Check for existing trace ID in headers
    $existingTraceId = $request->header('X-Trace-Id') ?? $request->header('X-Request-Id');
    if ($existingTraceId) {
      $this->traceId = $existingTraceId;
    }

    $this->requestContext = $this->buildRequestContext($request);
    $this->identityContext = $this->buildIdentityContext($request);
  }

  /**
   * Build request context array.
   */
  private function buildRequestContext(Request $request): array
  {
    $config = config('rasp.redaction', []);
    $redactedHeaders = $config['headers'] ?? [];
    $redactedParams = $config['params'] ?? [];
    $maxBodySize = $config['max_body_size'] ?? 4096;

    // Collect headers with redaction
    $headers = [];
    foreach ($request->headers->all() as $key => $values) {
      $key = strtolower($key);
      if (in_array($key, $redactedHeaders, true)) {
        $headers[$key] = '[REDACTED]';
      } else {
        $headers[$key] = is_array($values) ? implode(', ', $values) : $values;
      }
    }

    // Collect query params with redaction
    $query = $this->redactParams($request->query(), $redactedParams);

    // Body hash for large bodies, redacted params for small
    $body = $request->all();
    $bodySize = strlen(json_encode($body) ?: '');
    if ($bodySize > $maxBodySize) {
      $bodyData = [
        '_truncated' => true,
        '_size' => $bodySize,
        '_hash' => hash('sha256', json_encode($body) ?: ''),
      ];
    } else {
      $bodyData = $this->redactParams($body, $redactedParams);
    }

    return [
      'method' => $request->method(),
      'url' => $request->fullUrl(),
      'path' => $request->path(),
      'route' => $request->route()?->getName() ?? $request->route()?->uri() ?? 'unknown',
      'ip' => $request->ip(),
      'forwarded_for' => $request->header('X-Forwarded-For'),
      'user_agent' => $request->userAgent(),
      'content_type' => $request->header('Content-Type'),
      'headers' => $headers,
      'query' => $query,
      'body' => $bodyData,
    ];
  }

  /**
   * Build identity context array.
   */
  private function buildIdentityContext(Request $request): array
  {
    // Safely get user - may trigger session access which might not be available yet
    $user = null;
    try {
      $user = $request->user();
    } catch (\RuntimeException $e) {
      // Session store not set - this is expected when RASP middleware runs before session middleware
    }

    // Safely get session ID - session may not be available on API routes
    $sessionId = null;
    try {
      if ($request->hasSession() && $request->session()) {
        $sessionId = $request->session()->getId();
      }
    } catch (\RuntimeException $e) {
      // Session store not set - this is expected for stateless API routes
    }

    return [
      'session_id' => $sessionId,
      'user_id' => $user?->id,
      'user_email' => $user?->email,
      'user_roles' => $user && method_exists($user, 'getRoleNames') ? $user->getRoleNames()->toArray() : null,
      'is_authenticated' => $user !== null,
    ];
  }

  /**
   * Redact sensitive parameters.
   */
  private function redactParams(array $params, array $sensitiveKeys): array
  {
    $result = [];
    foreach ($params as $key => $value) {
      $lowerKey = strtolower($key);
      if (in_array($lowerKey, $sensitiveKeys, true)) {
        $result[$key] = '[REDACTED]';
      } elseif (is_array($value)) {
        $result[$key] = $this->redactParams($value, $sensitiveKeys);
      } else {
        $result[$key] = $value;
      }
    }
    return $result;
  }

  /**
   * Get request context.
   */
  public function getRequestContext(): ?array
  {
    return $this->requestContext;
  }

  /**
   * Get identity context.
   */
  public function getIdentityContext(): ?array
  {
    return $this->identityContext;
  }

  /**
   * Increment a counter (for rate limiting/behavior tracking).
   */
  public function incrementCounter(string $key, int $amount = 1): int
  {
    if (!isset($this->counters[$key])) {
      $this->counters[$key] = 0;
    }
    $this->counters[$key] += $amount;
    return $this->counters[$key];
  }

  /**
   * Get a counter value.
   */
  public function getCounter(string $key): int
  {
    return $this->counters[$key] ?? 0;
  }

  /**
   * Get all counters.
   */
  public function getCounters(): array
  {
    return $this->counters;
  }

  /**
   * Update identity context (e.g., after login).
   */
  public function updateIdentity(?object $user): void
  {
    if ($this->identityContext === null) {
      $this->identityContext = [];
    }

    $this->identityContext['user_id'] = $user?->id;
    $this->identityContext['user_email'] = $user?->email;
    $this->identityContext['user_roles'] = method_exists($user, 'getRoleNames') ? $user->getRoleNames()->toArray() : null;
    $this->identityContext['is_authenticated'] = $user !== null;
  }
}
