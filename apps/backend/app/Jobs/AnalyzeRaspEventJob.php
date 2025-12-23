<?php

namespace App\Jobs;

use App\Models\RaspIncident;
use App\Rasp\RaspEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Analyze RASP Event Job.
 *
 * Processes RASP events asynchronously for correlation,
 * rule evaluation, and incident persistence.
 */
class AnalyzeRaspEventJob implements ShouldQueue
{
  use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

  /**
   * The number of times the job may be attempted.
   */
  public int $tries = 3;

  /**
   * The number of seconds to wait before retrying the job.
   */
  public int $backoff = 5;

  /**
   * Create a new job instance.
   */
  public function __construct(
    public readonly array $eventData,
  ) {}

  /**
   * Execute the job.
   */
  public function handle(): void
  {
    try {
      // Reconstruct the event from array data
      $event = $this->reconstructEvent($this->eventData);

      // Determine if this event should be persisted as an incident
      if ($this->shouldPersist($event)) {
        $this->persistIncident($event);
      }

      // Run additional analysis rules
      $this->runAnalysisRules($event);
    } catch (\Exception $e) {
      Log::channel('rasp')->error('Failed to analyze RASP event', [
        'event_id' => $this->eventData['event_id'] ?? 'unknown',
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
      ]);

      throw $e;
    }
  }

  /**
   * Reconstruct RaspEvent from array data.
   */
  private function reconstructEvent(array $data): RaspEvent
  {
    return new RaspEvent(
      eventId: $data['event_id'],
      traceId: $data['trace_id'],
      timestamp: $data['timestamp'],
      sink: $data['sink'],
      severity: $data['severity'],
      message: $data['message'],
      action: $data['action'],
      detectionType: $data['detection_type'] ?? null,
      requestContext: $data['request_context'] ?? null,
      identityContext: $data['identity_context'] ?? null,
      sinkData: $data['sink_data'] ?? null,
      meta: $data['meta'] ?? null,
    );
  }

  /**
   * Determine if event should be persisted as an incident.
   */
  private function shouldPersist(RaspEvent $event): bool
  {
    // Always persist blocked events
    if ($event->action === RaspEvent::ACTION_BLOCK) {
      return true;
    }

    // Persist events with detections
    if ($event->detectionType !== null) {
      return true;
    }

    // Persist high-severity events
    if ($event->isHighSeverity()) {
      return true;
    }

    // Persist behavior anomalies
    if ($event->sink === RaspEvent::SINK_BEHAVIOR) {
      return true;
    }

    // Skip debug-level sink events (too noisy)
    if ($event->severity === RaspEvent::SEVERITY_DEBUG) {
      return false;
    }

    // Persist request context events (for audit trail)
    if ($event->sink === RaspEvent::SINK_REQUEST) {
      return true;
    }

    return false;
  }

  /**
   * Persist event as an incident.
   */
  private function persistIncident(RaspEvent $event): void
  {
    $incident = RaspIncident::fromEvent($event);
    $incident->save();

    Log::channel('rasp')->info('RASP incident persisted', [
      'incident_id' => $incident->id,
      'event_id' => $event->eventId,
      'detection_type' => $event->detectionType,
      'action' => $event->action,
    ]);
  }

  /**
   * Run additional analysis rules on the event.
   */
  private function runAnalysisRules(RaspEvent $event): void
  {
    // Check for repeated attacks from same IP
    if ($event->detectionType && $event->requestContext) {
      $ip = $event->requestContext['ip'] ?? null;
      if ($ip) {
        $this->checkRepeatedAttacks($ip, $event->detectionType);
      }
    }

    // Check for suspicious user behavior
    if ($event->identityContext) {
      $userId = $event->identityContext['user_id'] ?? null;
      if ($userId) {
        $this->checkUserBehavior($userId, $event);
      }
    }
  }

  /**
   * Check for repeated attacks from the same IP.
   */
  private function checkRepeatedAttacks(string $ip, string $detectionType): void
  {
    // Count recent incidents from this IP
    $recentCount = RaspIncident::fromIp($ip)
      ->ofType($detectionType)
      ->recent(1) // Last hour
      ->count();

    // Alert if threshold exceeded
    if ($recentCount >= 5) {
      Log::channel('rasp')->warning('Repeated attack detected from IP', [
        'ip' => $ip,
        'detection_type' => $detectionType,
        'count' => $recentCount,
        'window' => '1 hour',
      ]);

      // Could trigger additional actions here:
      // - Temporary IP ban
      // - Alert notification
      // - Rate limit escalation
    }
  }

  /**
   * Check for suspicious user behavior.
   */
  private function checkUserBehavior(int $userId, RaspEvent $event): void
  {
    // Count recent incidents for this user
    $recentCount = RaspIncident::forUser($userId)
      ->recent(24) // Last 24 hours
      ->count();

    // Alert if threshold exceeded
    if ($recentCount >= 10) {
      Log::channel('rasp')->warning('Suspicious user behavior detected', [
        'user_id' => $userId,
        'incident_count' => $recentCount,
        'window' => '24 hours',
        'latest_detection' => $event->detectionType,
      ]);

      // Could trigger additional actions here:
      // - Force logout
      // - Account lockout
      // - Admin notification
    }
  }

  /**
   * Handle a job failure.
   */
  public function failed(\Throwable $exception): void
  {
    Log::channel('rasp')->error('RASP event analysis job failed permanently', [
      'event_id' => $this->eventData['event_id'] ?? 'unknown',
      'error' => $exception->getMessage(),
    ]);
  }
}
