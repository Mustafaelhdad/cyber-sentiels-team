<?php

return [
  /*
    |--------------------------------------------------------------------------
    | RASP Enabled
    |--------------------------------------------------------------------------
    |
    | Master switch to enable/disable RASP protection. When disabled, no
    | instrumentation or monitoring will occur.
    |
    */
  'enabled' => env('RASP_ENABLED', true),

  /*
    |--------------------------------------------------------------------------
    | RASP Mode
    |--------------------------------------------------------------------------
    |
    | The operational mode for RASP:
    | - 'monitor': Log events only, do not block (recommended for initial rollout)
    | - 'block': Log and block high-confidence attacks
    |
    */
  'mode' => env('RASP_MODE', 'monitor'),

  /*
    |--------------------------------------------------------------------------
    | Sinks Configuration
    |--------------------------------------------------------------------------
    |
    | Enable/disable specific sink instrumentation. Each sink can be
    | individually toggled for monitoring.
    |
    */
  'sinks' => [
    'database' => env('RASP_SINK_DATABASE', true),
    'http' => env('RASP_SINK_HTTP', true),
    'filesystem' => env('RASP_SINK_FILESYSTEM', true),
  ],

  /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Rate limit settings per IP/session/user to detect abnormal behavior.
    |
    */
  'rate_limits' => [
    // Requests per minute per IP before triggering alert
    'requests_per_minute' => env('RASP_RATE_LIMIT_RPM', 120),
    // Failed auth attempts per minute before triggering alert
    'auth_failures_per_minute' => env('RASP_RATE_LIMIT_AUTH_FAILURES', 5),
    // 4xx errors per minute before triggering alert
    'errors_per_minute' => env('RASP_RATE_LIMIT_ERRORS', 30),
  ],

  /*
    |--------------------------------------------------------------------------
    | Detection Patterns
    |--------------------------------------------------------------------------
    |
    | Patterns for detecting various attack types. These are used for
    | high-confidence blocking when mode is 'block'.
    |
    */
  'patterns' => [
    // Path traversal patterns
    'path_traversal' => [
      '/\.\.\//',
      '/\.\.\\\\/',
      '/%2e%2e%2f/i',
      '/%2e%2e%5c/i',
    ],
    // SSRF patterns - block requests to internal networks
    'ssrf' => [
      '/^https?:\/\/localhost/i',
      '/^https?:\/\/127\.\d+\.\d+\.\d+/i',
      '/^https?:\/\/10\.\d+\.\d+\.\d+/i',
      '/^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i',
      '/^https?:\/\/192\.168\.\d+\.\d+/i',
      '/^https?:\/\/0\.0\.0\.0/i',
      '/^https?:\/\/\[::1\]/i',
    ],
    // Dangerous SQL patterns (beyond normal parameterized queries)
    'sql_injection' => [
      '/;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT)\s+/i',
      '/UNION\s+(ALL\s+)?SELECT/i',
      '/INTO\s+OUTFILE/i',
      '/LOAD_FILE\s*\(/i',
    ],
    // Command injection patterns
    'command_injection' => [
      '/[;&|`$]/',
      '/\$\(/',
      '/`[^`]+`/',
    ],
  ],

  /*
    |--------------------------------------------------------------------------
    | Redaction Settings
    |--------------------------------------------------------------------------
    |
    | Settings for redacting sensitive data from logs and events.
    |
    */
  'redaction' => [
    // Headers to redact (values replaced with [REDACTED])
    'headers' => [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ],
    // Query/body parameter names to redact
    'params' => [
      'password',
      'password_confirmation',
      'current_password',
      'secret',
      'token',
      'api_key',
      'credit_card',
      'cvv',
      'ssn',
    ],
    // Maximum body size to log (bytes) - larger bodies are truncated
    'max_body_size' => env('RASP_MAX_BODY_SIZE', 4096),
  ],

  /*
    |--------------------------------------------------------------------------
    | Queue Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for async event processing.
    |
    */
  'queue' => [
    // Queue connection to use for RASP events
    'connection' => env('RASP_QUEUE_CONNECTION', 'redis'),
    // Queue name for RASP events
    'name' => env('RASP_QUEUE_NAME', 'rasp'),
    // Whether to process events synchronously (for debugging)
    'sync' => env('RASP_QUEUE_SYNC', false),
  ],

  /*
    |--------------------------------------------------------------------------
    | Logging Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for RASP event logging.
    |
    */
  'logging' => [
    // Log channel for RASP events
    'channel' => env('RASP_LOG_CHANNEL', 'rasp'),
    // Minimum severity to log: debug, info, warning, error, critical
    'level' => env('RASP_LOG_LEVEL', 'info'),
  ],

  /*
    |--------------------------------------------------------------------------
    | Incident Retention
    |--------------------------------------------------------------------------
    |
    | How long to retain RASP incidents in the database.
    |
    */
  'retention' => [
    // Days to retain incidents
    'days' => env('RASP_RETENTION_DAYS', 30),
  ],

  /*
    |--------------------------------------------------------------------------
    | Excluded Paths
    |--------------------------------------------------------------------------
    |
    | Paths to exclude from RASP monitoring (e.g., health checks, static assets).
    |
    */
  'excluded_paths' => [
    '/up',
    '/health',
    '/sanctum/csrf-cookie',
  ],
];
