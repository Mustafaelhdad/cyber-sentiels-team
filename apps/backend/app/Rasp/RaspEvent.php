<?php

namespace App\Rasp;

use Illuminate\Contracts\Support\Arrayable;
use JsonSerializable;

/**
 * RASP Event Data Transfer Object.
 *
 * Represents a security event captured by RASP instrumentation.
 * Used for both in-process logging and async queue processing.
 */
class RaspEvent implements Arrayable, JsonSerializable
{
  public const SEVERITY_DEBUG = 'debug';
  public const SEVERITY_INFO = 'info';
  public const SEVERITY_WARNING = 'warning';
  public const SEVERITY_ERROR = 'error';
  public const SEVERITY_CRITICAL = 'critical';

  public const SINK_REQUEST = 'request';
  public const SINK_DATABASE = 'database';
  public const SINK_HTTP = 'http';
  public const SINK_FILESYSTEM = 'filesystem';
  public const SINK_BEHAVIOR = 'behavior';

  public const ACTION_ALLOW = 'allow';
  public const ACTION_MONITOR = 'monitor';
  public const ACTION_BLOCK = 'block';

  public function __construct(
    // Unique event identifier
    public readonly string $eventId,
    // Trace ID linking to request context
    public readonly string $traceId,
    // Event timestamp (ISO 8601)
    public readonly string $timestamp,
    // Sink type: request, database, http, filesystem, behavior
    public readonly string $sink,
    // Severity level
    public readonly string $severity,
    // Human-readable event description
    public readonly string $message,
    // Action taken: allow, monitor, block
    public readonly string $action,
    // Detection type if applicable (e.g., sqli, ssrf, path_traversal)
    public readonly ?string $detectionType = null,
    // Request context
    public readonly ?array $requestContext = null,
    // Session/user context
    public readonly ?array $identityContext = null,
    // Sink-specific data (query, url, path, etc.)
    public readonly ?array $sinkData = null,
    // Additional metadata
    public readonly ?array $meta = null,
  ) {}

  /**
   * Create a new event with auto-generated ID and timestamp.
   */
  public static function create(
    string $traceId,
    string $sink,
    string $severity,
    string $message,
    string $action = self::ACTION_MONITOR,
    ?string $detectionType = null,
    ?array $requestContext = null,
    ?array $identityContext = null,
    ?array $sinkData = null,
    ?array $meta = null,
  ): self {
    return new self(
      eventId: (string) \Illuminate\Support\Str::uuid(),
      traceId: $traceId,
      timestamp: now()->toIso8601String(),
      sink: $sink,
      severity: $severity,
      message: $message,
      action: $action,
      detectionType: $detectionType,
      requestContext: $requestContext,
      identityContext: $identityContext,
      sinkData: $sinkData,
      meta: $meta,
    );
  }

  /**
   * Create a request context event.
   */
  public static function request(
    string $traceId,
    array $requestContext,
    ?array $identityContext = null,
    string $severity = self::SEVERITY_INFO,
    string $message = 'Request captured',
  ): self {
    return self::create(
      traceId: $traceId,
      sink: self::SINK_REQUEST,
      severity: $severity,
      message: $message,
      requestContext: $requestContext,
      identityContext: $identityContext,
    );
  }

  /**
   * Create a database sink event.
   */
  public static function database(
    string $traceId,
    string $query,
    ?array $bindings = null,
    float $timeMs = 0,
    string $severity = self::SEVERITY_DEBUG,
    string $action = self::ACTION_ALLOW,
    ?string $detectionType = null,
  ): self {
    return self::create(
      traceId: $traceId,
      sink: self::SINK_DATABASE,
      severity: $severity,
      message: $detectionType ? "Suspicious query detected: {$detectionType}" : 'Database query executed',
      action: $action,
      detectionType: $detectionType,
      sinkData: [
        'query' => $query,
        'bindings' => $bindings,
        'time_ms' => $timeMs,
      ],
    );
  }

  /**
   * Create an outbound HTTP sink event.
   */
  public static function http(
    string $traceId,
    string $method,
    string $url,
    ?int $statusCode = null,
    ?float $timeMs = null,
    string $severity = self::SEVERITY_DEBUG,
    string $action = self::ACTION_ALLOW,
    ?string $detectionType = null,
  ): self {
    return self::create(
      traceId: $traceId,
      sink: self::SINK_HTTP,
      severity: $severity,
      message: $detectionType ? "Suspicious outbound request: {$detectionType}" : 'Outbound HTTP request',
      action: $action,
      detectionType: $detectionType,
      sinkData: [
        'method' => $method,
        'url' => $url,
        'status_code' => $statusCode,
        'time_ms' => $timeMs,
      ],
    );
  }

  /**
   * Create a filesystem sink event.
   */
  public static function filesystem(
    string $traceId,
    string $operation,
    string $path,
    string $severity = self::SEVERITY_DEBUG,
    string $action = self::ACTION_ALLOW,
    ?string $detectionType = null,
  ): self {
    return self::create(
      traceId: $traceId,
      sink: self::SINK_FILESYSTEM,
      severity: $severity,
      message: $detectionType ? "Suspicious file operation: {$detectionType}" : "File {$operation}",
      action: $action,
      detectionType: $detectionType,
      sinkData: [
        'operation' => $operation,
        'path' => $path,
      ],
    );
  }

  /**
   * Create a behavior anomaly event.
   */
  public static function behavior(
    string $traceId,
    string $behaviorType,
    array $metrics,
    string $severity = self::SEVERITY_WARNING,
    string $action = self::ACTION_MONITOR,
    ?array $identityContext = null,
  ): self {
    return self::create(
      traceId: $traceId,
      sink: self::SINK_BEHAVIOR,
      severity: $severity,
      message: "Behavior anomaly detected: {$behaviorType}",
      action: $action,
      detectionType: $behaviorType,
      identityContext: $identityContext,
      sinkData: $metrics,
    );
  }

  /**
   * Convert to array.
   */
  public function toArray(): array
  {
    return array_filter([
      'event_id' => $this->eventId,
      'trace_id' => $this->traceId,
      'timestamp' => $this->timestamp,
      'sink' => $this->sink,
      'severity' => $this->severity,
      'message' => $this->message,
      'action' => $this->action,
      'detection_type' => $this->detectionType,
      'request_context' => $this->requestContext,
      'identity_context' => $this->identityContext,
      'sink_data' => $this->sinkData,
      'meta' => $this->meta,
    ], fn($v) => $v !== null);
  }

  /**
   * JSON serialization.
   */
  public function jsonSerialize(): array
  {
    return $this->toArray();
  }

  /**
   * Check if this event should trigger blocking.
   */
  public function shouldBlock(): bool
  {
    return $this->action === self::ACTION_BLOCK;
  }

  /**
   * Check if this is a high-severity event.
   */
  public function isHighSeverity(): bool
  {
    return in_array($this->severity, [self::SEVERITY_ERROR, self::SEVERITY_CRITICAL], true);
  }
}
