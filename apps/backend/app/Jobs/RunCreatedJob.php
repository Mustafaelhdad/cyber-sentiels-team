<?php

namespace App\Jobs;

use App\Models\Run;
use App\Models\RunTask;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunCreatedJob implements ShouldQueue
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
    public Run $run
  ) {}

  /**
   * Execute the job.
   */
  public function handle(): void
  {
    $this->run->load('tasks');

    // No tasks to process - mark run completed immediately
    if ($this->run->tasks->isEmpty()) {
      $this->run->markAsCompleted();
      Log::info("RunCreatedJob: No tasks for run, marked completed", [
        'run_id' => $this->run->id,
      ]);
      return;
    }

    // Mark run as started
    $this->run->markAsStarted();

    // Dispatch ExecuteToolJob for each pending task
    foreach ($this->run->tasks as $task) {
      if ($task->status === RunTask::STATUS_PENDING) {
        ExecuteToolJob::dispatch($task);
        Log::info("RunCreatedJob: Dispatched tool job", [
          'run_id' => $this->run->id,
          'task_id' => $task->id,
          'tool' => $task->tool,
        ]);
      }
    }
  }

  /**
   * Handle job failure.
   */
  public function failed(\Throwable $exception): void
  {
    Log::error("RunCreatedJob failed", [
      'run_id' => $this->run->id,
      'error' => $exception->getMessage(),
    ]);

    $this->run->markAsFailed();
  }
}
