<?php

namespace App\Services;

use App\Jobs\ExecuteToolJob;
use App\Models\Project;
use App\Models\Run;
use App\Models\RunTask;
use Illuminate\Database\Eloquent\Collection;

class RunService
{
  /**
   * Get all runs for a project.
   */
  public function getProjectRuns(Project $project): Collection
  {
    return $project->runs()
      ->with('tasks')
      ->orderBy('created_at', 'desc')
      ->get();
  }

  /**
   * Create a new run and dispatch jobs.
   */
  public function create(Project $project, array $data): Run
  {
    $run = $project->runs()->create([
      'module' => $data['module'],
      'target_type' => $data['target_type'],
      'target_value' => $data['target_value'],
      'status' => Run::STATUS_PENDING,
      'meta' => $data['meta'] ?? [],
    ]);

    // Create tasks based on module
    $this->createTasksForModule($run, $data['module']);

    // Dispatch jobs for each task
    $this->dispatchJobs($run);

    return $run;
  }

  /**
   * Create tasks based on module type.
   */
  protected function createTasksForModule(Run $run, string $module): void
  {
    $tools = $this->getToolsForModule($module);

    foreach ($tools as $tool) {
      $run->tasks()->create([
        'tool' => $tool,
        'status' => RunTask::STATUS_PENDING,
        'progress' => 0,
      ]);
    }
  }

  /**
   * Get tools for a module.
   */
  protected function getToolsForModule(string $module): array
  {
    return match ($module) {
      Run::MODULE_WEB_SECURITY => [RunTask::TOOL_ZAP],
      Run::MODULE_MONITORING_IR => [], // Future: wazuh, misp, n8n
      Run::MODULE_IAM => [], // Future: keycloak integration
      default => [],
    };
  }

  /**
   * Dispatch jobs for run tasks.
   */
  protected function dispatchJobs(Run $run): void
  {
    foreach ($run->tasks as $task) {
      ExecuteToolJob::dispatch($task);
    }

    // Mark run as started if it has tasks
    if ($run->tasks->count() > 0) {
      $run->markAsStarted();
    } else {
      $run->markAsCompleted();
    }
  }

  /**
   * Cancel a run.
   */
  public function cancel(Run $run): void
  {
    if ($run->isComplete()) {
      return;
    }

    $run->update(['status' => Run::STATUS_CANCELLED, 'completed_at' => now()]);

    // Mark pending tasks as cancelled
    $run->tasks()
      ->whereIn('status', [RunTask::STATUS_PENDING, RunTask::STATUS_RUNNING])
      ->update(['status' => RunTask::STATUS_FAILED, 'error_message' => 'Cancelled by user']);
  }

  /**
   * Check and update run status based on tasks.
   */
  public function updateRunStatus(Run $run): void
  {
    $run->refresh();
    $tasks = $run->tasks;

    if ($tasks->isEmpty()) {
      $run->markAsCompleted();
      return;
    }

    $allComplete = $tasks->every(fn($task) => in_array($task->status, [
      RunTask::STATUS_COMPLETED,
      RunTask::STATUS_FAILED,
    ]));

    if ($allComplete) {
      $anyFailed = $tasks->contains('status', RunTask::STATUS_FAILED);

      if ($anyFailed) {
        $run->markAsFailed();
      } else {
        $run->markAsCompleted();
      }
    }
  }
}

