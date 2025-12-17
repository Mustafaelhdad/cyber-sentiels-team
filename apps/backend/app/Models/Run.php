<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Run extends Model
{
  use HasFactory;

  /**
   * The attributes that are mass assignable.
   *
   * @var array<int, string>
   */
  protected $fillable = [
    'project_id',
    'module',
    'target_type',
    'target_value',
    'status',
    'started_at',
    'completed_at',
    'meta',
  ];

  /**
   * The attributes that should be cast.
   *
   * @return array<string, string>
   */
  protected function casts(): array
  {
    return [
      'started_at' => 'datetime',
      'completed_at' => 'datetime',
      'meta' => 'array',
    ];
  }

  /**
   * Run statuses.
   */
  public const STATUS_PENDING = 'pending';
  public const STATUS_RUNNING = 'running';
  public const STATUS_COMPLETED = 'completed';
  public const STATUS_FAILED = 'failed';
  public const STATUS_CANCELLED = 'cancelled';

  /**
   * Module types.
   */
  public const MODULE_WEB_SECURITY = 'web_security';
  public const MODULE_MONITORING_IR = 'monitoring_ir';
  public const MODULE_IAM = 'iam';

  /**
   * Get the project that owns the run.
   */
  public function project(): BelongsTo
  {
    return $this->belongsTo(Project::class);
  }

  /**
   * Get the tasks for the run.
   */
  public function tasks(): HasMany
  {
    return $this->hasMany(RunTask::class);
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
      self::STATUS_CANCELLED,
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
  public function markAsCompleted(): void
  {
    $this->update([
      'status' => self::STATUS_COMPLETED,
      'completed_at' => now(),
    ]);
  }

  /**
   * Mark run as failed.
   */
  public function markAsFailed(): void
  {
    $this->update([
      'status' => self::STATUS_FAILED,
      'completed_at' => now(),
    ]);
  }
}

