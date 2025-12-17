<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RunTask extends Model
{
  use HasFactory;

  /**
   * The attributes that are mass assignable.
   *
   * @var array<int, string>
   */
  protected $fillable = [
    'run_id',
    'tool',
    'status',
    'progress',
    'logs_path',
    'report_path',
    'meta_json',
  ];

  /**
   * The attributes that should be cast.
   *
   * @return array<string, string>
   */
  protected function casts(): array
  {
    return [
      'progress' => 'integer',
      'meta_json' => 'array',
    ];
  }

  /**
   * Task statuses.
   */
  public const STATUS_PENDING = 'pending';
  public const STATUS_RUNNING = 'running';
  public const STATUS_COMPLETED = 'completed';
  public const STATUS_FAILED = 'failed';

  /**
   * Tool types.
   */
  public const TOOL_ZAP = 'zap';
  public const TOOL_MODSECURITY = 'modsecurity';
  public const TOOL_SONARQUBE = 'sonarqube';
  public const TOOL_WAZUH = 'wazuh';
  public const TOOL_MISP = 'misp';
  public const TOOL_N8N = 'n8n';

  /**
   * Get the run that owns the task.
   */
  public function run(): BelongsTo
  {
    return $this->belongsTo(Run::class);
  }

  /**
   * Mark task as started.
   */
  public function markAsStarted(): void
  {
    $this->update([
      'status' => self::STATUS_RUNNING,
      'progress' => 0,
    ]);
  }

  /**
   * Mark task as completed.
   */
  public function markAsCompleted(?string $reportPath = null): void
  {
    $this->update([
      'status' => self::STATUS_COMPLETED,
      'progress' => 100,
      'report_path' => $reportPath,
    ]);
  }

  /**
   * Mark task as failed.
   */
  public function markAsFailed(?string $error = null): void
  {
    $this->update([
      'status' => self::STATUS_FAILED,
      'meta_json' => array_merge($this->meta_json ?? [], ['error' => $error]),
    ]);
  }

  /**
   * Update progress.
   */
  public function updateProgress(int $progress): void
  {
    $this->update(['progress' => min(100, max(0, $progress))]);
  }

  /**
   * Get the full report storage path.
   */
  public function getReportStoragePath(): string
  {
    return storage_path("app/reports/{$this->run_id}/{$this->tool}");
  }
}
