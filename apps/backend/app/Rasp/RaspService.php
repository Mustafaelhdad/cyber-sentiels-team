<?php

namespace App\Rasp;

use App\Jobs\AnalyzeRaspEventJob;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * RASP Service.
 *
 * Central service for emitting RASP events, performing detection,
 * and coordinating with the async analyzer pipeline.
 */
class RaspService
{
  private array $patterns;
  private string $mode;
  private bool $queueSync;

  public function __construct()
  {
    $this->patterns = config('rasp.patterns', []);
    $this->mode = config('rasp.mode', 'monitor');
    $this->queueSync = config('rasp.queue.sync', false);
  }

  /**
   * Emit a RASP event.
   *
   * Logs the event and enqueues for async analysis.
   */
  public function emit(RaspEvent $event): void
  {
    // Log to RASP channel
    $this->log($event);

    // Enqueue for async analysis (unless sync mode)
    if ($this->queueSync) {
      // Process synchronously (for debugging)
      dispatch_sync(new AnalyzeRaspEventJob($event->toArray()));
    } else {
      // Queue for async processing
      dispatch(new AnalyzeRaspEventJob($event->toArray()))
        ->onConnection(config('rasp.queue.connection', 'redis'))
        ->onQueue(config('rasp.queue.name', 'rasp'));
    }
  }

  /**
   * Log a RASP event to the dedicated channel.
   */
  public function log(RaspEvent $event): void
  {
    $channel = config('rasp.logging.channel', 'rasp');
    $logger = Log::channel($channel);

    $context = $event->toArray();

    match ($event->severity) {
      RaspEvent::SEVERITY_DEBUG => $logger->debug($event->message, $context),
      RaspEvent::SEVERITY_INFO => $logger->info($event->message, $context),
      RaspEvent::SEVERITY_WARNING => $logger->warning($event->message, $context),
      RaspEvent::SEVERITY_ERROR => $logger->error($event->message, $context),
      RaspEvent::SEVERITY_CRITICAL => $logger->critical($event->message, $context),
      default => $logger->info($event->message, $context),
    };
  }

  /**
   * Check if blocking mode is enabled.
   */
  public function isBlockingEnabled(): bool
  {
    return $this->mode === 'block';
  }

  /**
   * Detect path traversal attempts.
   */
  public function detectPathTraversal(string $path): ?string
  {
    $patterns = $this->patterns['path_traversal'] ?? [];
    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $path)) {
        return 'path_traversal';
      }
    }
    return null;
  }

  /**
   * Detect SSRF attempts in outbound URLs.
   */
  public function detectSsrf(string $url): ?string
  {
    $patterns = $this->patterns['ssrf'] ?? [];
    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $url)) {
        return 'ssrf';
      }
    }
    return null;
  }

  /**
   * Detect SQL injection patterns in queries.
   */
  public function detectSqlInjection(string $query): ?string
  {
    $patterns = $this->patterns['sql_injection'] ?? [];
    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $query)) {
        return 'sql_injection';
      }
    }
    return null;
  }

  /**
   * Detect command injection patterns.
   */
  public function detectCommandInjection(string $input): ?string
  {
    $patterns = $this->patterns['command_injection'] ?? [];
    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $input)) {
        return 'command_injection';
      }
    }
    return null;
  }

  /**
   * Check rate limits for an IP/session/user.
   *
   * Uses Redis for distributed rate limiting.
   */
  public function checkRateLimit(string $key, int $limit, int $windowSeconds = 60): array
  {
    $redisKey = "rasp:rate:{$key}";

    try {
      $current = (int) Redis::get($redisKey);

      if ($current >= $limit) {
        return [
          'exceeded' => true,
          'current' => $current,
          'limit' => $limit,
        ];
      }

      // Increment with TTL
      $pipe = Redis::pipeline();
      $pipe->incr($redisKey);
      $pipe->expire($redisKey, $windowSeconds);
      $pipe->execute();

      return [
        'exceeded' => false,
        'current' => $current + 1,
        'limit' => $limit,
      ];
    } catch (\Exception $e) {
      // Fail open if Redis is unavailable
      Log::channel('rasp')->warning('Rate limit check failed', [
        'key' => $key,
        'error' => $e->getMessage(),
      ]);
      return [
        'exceeded' => false,
        'current' => 0,
        'limit' => $limit,
        'error' => $e->getMessage(),
      ];
    }
  }

  /**
   * Track behavior metrics for anomaly detection.
   */
  public function trackBehavior(string $identifier, string $metric, int $increment = 1): int
  {
    $key = "rasp:behavior:{$identifier}:{$metric}";

    try {
      $value = Redis::incrby($key, $increment);
      Redis::expire($key, 300); // 5-minute window
      return (int) $value;
    } catch (\Exception $e) {
      Log::channel('rasp')->warning('Behavior tracking failed', [
        'identifier' => $identifier,
        'metric' => $metric,
        'error' => $e->getMessage(),
      ]);
      return 0;
    }
  }

  /**
   * Get behavior metrics for an identifier.
   */
  public function getBehaviorMetrics(string $identifier): array
  {
    $pattern = "rasp:behavior:{$identifier}:*";

    try {
      $keys = Redis::keys($pattern);
      $metrics = [];

      foreach ($keys as $key) {
        $metric = str_replace("rasp:behavior:{$identifier}:", '', $key);
        $metrics[$metric] = (int) Redis::get($key);
      }

      return $metrics;
    } catch (\Exception $e) {
      return [];
    }
  }

  /**
   * Determine action based on detection and mode.
   */
  public function determineAction(?string $detectionType): string
  {
    if ($detectionType === null) {
      return RaspEvent::ACTION_ALLOW;
    }

    if ($this->isBlockingEnabled()) {
      // High-confidence detections get blocked
      $highConfidence = ['path_traversal', 'ssrf', 'command_injection'];
      if (in_array($detectionType, $highConfidence, true)) {
        return RaspEvent::ACTION_BLOCK;
      }
    }

    return RaspEvent::ACTION_MONITOR;
  }
}
