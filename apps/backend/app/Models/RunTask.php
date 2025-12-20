<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

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
  public const TOOL_SAST = 'sast';
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
   *
   * @param string|null $reportPath Relative path to the report (e.g., "reports/{run_id}/{tool}/report.json")
   * @param string|null $logsPath Relative path to the logs (e.g., "reports/{run_id}/{tool}/execution.log")
   */
  public function markAsCompleted(?string $reportPath = null, ?string $logsPath = null): void
  {
    $data = [
      'status' => self::STATUS_COMPLETED,
      'progress' => 100,
    ];

    if ($reportPath !== null) {
      $data['report_path'] = $reportPath;
    }

    if ($logsPath !== null) {
      $data['logs_path'] = $logsPath;
    }

    $this->update($data);
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
   * Get the relative artifact directory path for this task.
   *
   * @return string e.g. "reports/{run_id}/{tool}"
   */
  public function getArtifactDirectory(): string
  {
    return "reports/{$this->run_id}/{$this->tool}";
  }

  /**
   * Get the absolute disk path for the artifact directory.
   *
   * @return string Full filesystem path
   */
  public function getAbsoluteArtifactDirectory(): string
  {
    return Storage::disk('local')->path($this->getArtifactDirectory());
  }

  /**
   * Get the absolute disk path for the report file.
   *
   * @return string|null Full filesystem path or null if no report
   */
  public function getAbsoluteReportPath(): ?string
  {
    if (empty($this->report_path)) {
      return null;
    }

    return Storage::disk('local')->path($this->report_path);
  }

  /**
   * Get the absolute disk path for the logs file.
   *
   * @return string|null Full filesystem path or null if no logs
   */
  public function getAbsoluteLogsPath(): ?string
  {
    if (empty($this->logs_path)) {
      return null;
    }

    return Storage::disk('local')->path($this->logs_path);
  }

  /**
   * Check if the report file exists.
   */
  public function hasReport(): bool
  {
    if (empty($this->report_path)) {
      return false;
    }

    return Storage::disk('local')->exists($this->report_path);
  }

  /**
   * Check if the logs file exists.
   */
  public function hasLogs(): bool
  {
    if (empty($this->logs_path)) {
      return false;
    }

    return Storage::disk('local')->exists($this->logs_path);
  }

  /**
   * Get the full report storage path.
   *
   * @deprecated Use getAbsoluteArtifactDirectory() instead
   */
  public function getReportStoragePath(): string
  {
    return $this->getAbsoluteArtifactDirectory();
  }
}
