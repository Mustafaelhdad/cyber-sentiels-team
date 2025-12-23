<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class RaspTestRun extends Model
{
  use HasFactory;

  /**
   * The attributes that are mass assignable.
   *
   * @var array<int, string>
   */
  protected $fillable = [
    'user_id',
    'project_id',
    'name',
    'status',
    'test_types',
    'results',
    'summary',
    'total_tests',
    'total_detected',
    'detection_rate',
    'report_path',
    'started_at',
    'finished_at',
  ];

  /**
   * The attributes that should be cast.
   *
   * @return array<string, string>
   */
  protected function casts(): array
  {
    return [
      'test_types' => 'array',
      'results' => 'array',
      'summary' => 'array',
      'total_tests' => 'integer',
      'total_detected' => 'integer',
      'detection_rate' => 'decimal:2',
      'started_at' => 'datetime',
      'finished_at' => 'datetime',
    ];
  }

  /**
   * Run statuses.
   */
  public const STATUS_PENDING = 'pending';
  public const STATUS_RUNNING = 'running';
  public const STATUS_COMPLETED = 'completed';
  public const STATUS_FAILED = 'failed';

  /**
   * Attack types.
   */
  public const ATTACK_XSS = 'xss';
  public const ATTACK_SQLI = 'sqli';
  public const ATTACK_PATH_TRAVERSAL = 'path_traversal';
  public const ATTACK_SSRF = 'ssrf';
  public const ATTACK_COMMAND_INJECTION = 'command_injection';

  /**
   * Get all available attack types.
   */
  public static function getAttackTypes(): array
  {
    return [
      self::ATTACK_XSS,
      self::ATTACK_SQLI,
      self::ATTACK_PATH_TRAVERSAL,
      self::ATTACK_SSRF,
      self::ATTACK_COMMAND_INJECTION,
    ];
  }

  /**
   * Get attack type metadata.
   */
  public static function getAttackTypeInfo(string $type): array
  {
    $info = [
      self::ATTACK_XSS => [
        'name' => 'Cross-Site Scripting (XSS)',
        'description' => 'Tests detection of script injection attacks',
        'severity' => 'high',
        'payloads' => [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert(1)>',
          'javascript:alert(document.cookie)',
          '<svg onload=alert(1)>',
        ],
      ],
      self::ATTACK_SQLI => [
        'name' => 'SQL Injection',
        'description' => 'Tests detection of database injection attacks',
        'severity' => 'critical',
        'payloads' => [
          "' OR '1'='1",
          "1; DROP TABLE users--",
          "' UNION SELECT * FROM users--",
          "admin'--",
        ],
      ],
      self::ATTACK_PATH_TRAVERSAL => [
        'name' => 'Path Traversal',
        'description' => 'Tests detection of directory traversal attempts',
        'severity' => 'high',
        'payloads' => [
          '../../etc/passwd',
          '..\\..\\windows\\system32\\config\\sam',
          '/etc/shadow',
          '....//....//etc/passwd',
        ],
      ],
      self::ATTACK_SSRF => [
        'name' => 'Server-Side Request Forgery (SSRF)',
        'description' => 'Tests detection of internal network access attempts',
        'severity' => 'critical',
        'payloads' => [
          'http://127.0.0.1:8080/admin',
          'http://localhost/internal',
          'http://169.254.169.254/latest/meta-data/',
          'http://192.168.1.1/admin',
        ],
      ],
      self::ATTACK_COMMAND_INJECTION => [
        'name' => 'Command Injection',
        'description' => 'Tests detection of OS command injection',
        'severity' => 'critical',
        'payloads' => [
          '; ls -la',
          '| cat /etc/passwd',
          '`whoami`',
          '$(rm -rf /)',
        ],
      ],
    ];

    return $info[$type] ?? [];
  }

  /**
   * Get the user that owns the run.
   */
  public function user(): BelongsTo
  {
    return $this->belongsTo(User::class);
  }

  /**
   * Get the project that owns the run.
   */
  public function project(): BelongsTo
  {
    return $this->belongsTo(Project::class);
  }

  /**
   * Check if run is in progress.
   */
  public function isRunning(): bool
  {
    return $this->status === self::STATUS_RUNNING;
  }

  /**
   * Check if run is complete.
   */
  public function isComplete(): bool
  {
    return in_array($this->status, [
      self::STATUS_COMPLETED,
      self::STATUS_FAILED,
    ]);
  }

  /**
   * Mark run as started.
   */
  public function markAsStarted(): void
  {
    $this->update([
      'status' => self::STATUS_RUNNING,
      'started_at' => now(),
    ]);
  }

  /**
   * Mark run as completed.
   */
  public function markAsCompleted(array $results, array $summary): void
  {
    $totalTests = $summary['total_tests'] ?? 0;
    $totalDetected = $summary['total_detected'] ?? 0;
    $detectionRate = $totalTests > 0 ? round(($totalDetected / $totalTests) * 100, 2) : 0;

    $this->update([
      'status' => self::STATUS_COMPLETED,
      'results' => $results,
      'summary' => $summary,
      'total_tests' => $totalTests,
      'total_detected' => $totalDetected,
      'detection_rate' => $detectionRate,
      'finished_at' => now(),
    ]);
  }

  /**
   * Mark run as failed.
   */
  public function markAsFailed(?string $error = null): void
  {
    $this->update([
      'status' => self::STATUS_FAILED,
      'summary' => ['error' => $error],
      'finished_at' => now(),
    ]);
  }

  /**
   * Get the report storage directory.
   */
  public function getReportDirectory(): string
  {
    return "reports/rasp/{$this->id}";
  }

  /**
   * Get the absolute report path.
   */
  public function getAbsoluteReportPath(): ?string
  {
    if (empty($this->report_path)) {
      return null;
    }

    return Storage::disk('local')->path($this->report_path);
  }

  /**
   * Check if report exists.
   */
  public function hasReport(): bool
  {
    if (empty($this->report_path)) {
      return false;
    }

    return Storage::disk('local')->exists($this->report_path);
  }

  /**
   * Get duration in seconds.
   */
  public function getDurationSeconds(): ?int
  {
    if (!$this->started_at || !$this->finished_at) {
      return null;
    }

    return $this->finished_at->diffInSeconds($this->started_at);
  }

  /**
   * Get formatted duration.
   */
  public function getFormattedDuration(): ?string
  {
    $seconds = $this->getDurationSeconds();
    if ($seconds === null) {
      return null;
    }

    if ($seconds < 60) {
      return "{$seconds}s";
    }

    $minutes = floor($seconds / 60);
    $remainingSeconds = $seconds % 60;

    return "{$minutes}m {$remainingSeconds}s";
  }
}
