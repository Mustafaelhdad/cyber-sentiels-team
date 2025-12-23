<?php

namespace App\Models;

use App\Rasp\RaspEvent;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RASP Incident Model.
 *
 * Represents a security incident detected by RASP instrumentation.
 *
 * @property int $id
 * @property string $event_id
 * @property string $trace_id
 * @property string $sink
 * @property string $severity
 * @property string|null $detection_type
 * @property string $action
 * @property string $message
 * @property string|null $request_method
 * @property string|null $request_path
 * @property string|null $request_ip
 * @property string|null $user_agent
 * @property string|null $session_id
 * @property int|null $user_id
 * @property string|null $user_email
 * @property array|null $request_context
 * @property array|null $identity_context
 * @property array|null $sink_data
 * @property array|null $meta
 * @property \Carbon\Carbon $occurred_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class RaspIncident extends Model
{
  use HasFactory;

  protected $fillable = [
    'event_id',
    'trace_id',
    'sink',
    'severity',
    'detection_type',
    'action',
    'message',
    'request_method',
    'request_path',
    'request_ip',
    'user_agent',
    'session_id',
    'user_id',
    'user_email',
    'request_context',
    'identity_context',
    'sink_data',
    'meta',
    'occurred_at',
  ];

  protected $casts = [
    'request_context' => 'array',
    'identity_context' => 'array',
    'sink_data' => 'array',
    'meta' => 'array',
    'occurred_at' => 'datetime',
  ];

  /**
   * Get the user associated with this incident.
   */
  public function user(): BelongsTo
  {
    return $this->belongsTo(User::class);
  }

  /**
   * Create an incident from a RASP event.
   */
  public static function fromEvent(RaspEvent $event): self
  {
    $requestContext = $event->requestContext;
    $identityContext = $event->identityContext;

    return new self([
      'event_id' => $event->eventId,
      'trace_id' => $event->traceId,
      'sink' => $event->sink,
      'severity' => $event->severity,
      'detection_type' => $event->detectionType,
      'action' => $event->action,
      'message' => $event->message,
      'request_method' => $requestContext['method'] ?? null,
      'request_path' => $requestContext['path'] ?? null,
      'request_ip' => $requestContext['ip'] ?? null,
      'user_agent' => $requestContext['user_agent'] ?? null,
      'session_id' => $identityContext['session_id'] ?? null,
      'user_id' => $identityContext['user_id'] ?? null,
      'user_email' => $identityContext['user_email'] ?? null,
      'request_context' => $requestContext,
      'identity_context' => $identityContext,
      'sink_data' => $event->sinkData,
      'meta' => $event->meta,
      'occurred_at' => $event->timestamp,
    ]);
  }

  /**
   * Scope for high-severity incidents.
   */
  public function scopeHighSeverity($query)
  {
    return $query->whereIn('severity', [
      RaspEvent::SEVERITY_ERROR,
      RaspEvent::SEVERITY_CRITICAL,
    ]);
  }

  /**
   * Scope for blocked incidents.
   */
  public function scopeBlocked($query)
  {
    return $query->where('action', RaspEvent::ACTION_BLOCK);
  }

  /**
   * Scope for a specific detection type.
   */
  public function scopeOfType($query, string $type)
  {
    return $query->where('detection_type', $type);
  }

  /**
   * Scope for a specific IP address.
   */
  public function scopeFromIp($query, string $ip)
  {
    return $query->where('request_ip', $ip);
  }

  /**
   * Scope for a specific user.
   */
  public function scopeForUser($query, int $userId)
  {
    return $query->where('user_id', $userId);
  }

  /**
   * Scope for a specific trace.
   */
  public function scopeForTrace($query, string $traceId)
  {
    return $query->where('trace_id', $traceId);
  }

  /**
   * Scope for incidents in a time range.
   */
  public function scopeInTimeRange($query, $from, $to = null)
  {
    $query->where('occurred_at', '>=', $from);
    if ($to) {
      $query->where('occurred_at', '<=', $to);
    }
    return $query;
  }

  /**
   * Scope for recent incidents (last N hours).
   */
  public function scopeRecent($query, int $hours = 24)
  {
    return $query->where('occurred_at', '>=', now()->subHours($hours));
  }

  /**
   * Check if this is a high-severity incident.
   */
  public function isHighSeverity(): bool
  {
    return in_array($this->severity, [
      RaspEvent::SEVERITY_ERROR,
      RaspEvent::SEVERITY_CRITICAL,
    ], true);
  }

  /**
   * Check if this incident was blocked.
   */
  public function wasBlocked(): bool
  {
    return $this->action === RaspEvent::ACTION_BLOCK;
  }
}
