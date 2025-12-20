<?php

namespace App\Services;

use App\Jobs\RunCreatedJob;
use App\Models\Project;
use App\Models\Run;
use App\Models\RunTask;
use Illuminate\Database\Eloquent\Collection;

class RunService
{
  protected ?SastService $sastService = null;
  protected ?ArtifactStorageService $artifactStorage = null;

  /**
   * Get SastService instance (lazy loaded).
   */
  protected function getSastService(): SastService
  {
    if ($this->sastService === null) {
      $this->sastService = app(SastService::class);
    }
    return $this->sastService;
  }

  /**
   * Get ArtifactStorageService instance (lazy loaded).
   */
  protected function getArtifactStorage(): ArtifactStorageService
  {
    if ($this->artifactStorage === null) {
      $this->artifactStorage = app(ArtifactStorageService::class);
    }
    return $this->artifactStorage;
  }
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
      'user_id' => $project->user_id,
      'module' => $data['module'],
      'target_type' => $data['target_type'],
      'target_value' => $data['target_value'],
      'status' => Run::STATUS_PENDING,
    ]);

    // Create tasks based on module
    $this->createTasksForModule($run, $data['module']);

    // Dispatch RunCreatedJob to handle task execution
    RunCreatedJob::dispatch($run);

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
   * Cancel a run.
   */
  public function cancel(Run $run): void
  {
    if ($run->isComplete()) {
      return;
    }

    $run->update(['status' => Run::STATUS_CANCELLED, 'finished_at' => now()]);

    // Mark pending tasks as cancelled
    $run->tasks()
      ->whereIn('status', [RunTask::STATUS_PENDING, RunTask::STATUS_RUNNING])
      ->update(['status' => RunTask::STATUS_FAILED]);
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

  /**
   * Poll external services for task status updates.
   * This is called when fetching run details to ensure status is up-to-date.
   */
  public function pollExternalTaskStatus(Run $run): void
  {
    $tasks = $run->tasks()->whereIn('status', [
      RunTask::STATUS_PENDING,
      RunTask::STATUS_RUNNING,
    ])->get();

    foreach ($tasks as $task) {
      $this->pollTaskStatus($task, $run);
    }
  }

  /**
   * Poll status for a specific task based on its tool type.
   */
  protected function pollTaskStatus(RunTask $task, Run $run): void
  {
    switch ($task->tool) {
      case RunTask::TOOL_SAST:
        $this->pollSastTaskStatus($task, $run);
        break;
        // Add other tool polling here as needed
        // case RunTask::TOOL_ZAP:
        //   $this->pollZapTaskStatus($task, $run);
        //   break;
    }
  }

  /**
   * Poll SAST service for task status updates.
   */
  protected function pollSastTaskStatus(RunTask $task, Run $run): void
  {
    $sastScanId = $task->meta_json['sast_scan_id'] ?? null;

    if (!$sastScanId) {
      return;
    }

    $sastService = $this->getSastService();
    $scanStatus = $sastService->getScanStatus($sastScanId);

    if (!$scanStatus) {
      return;
    }

    $newTaskStatus = $sastService->mapStatusToTaskStatus($scanStatus['status']);

    // Update task if status changed
    if ($newTaskStatus !== $task->status) {
      if ($newTaskStatus === RunTask::STATUS_COMPLETED) {
        // Download and store the report
        $reportPath = $sastService->downloadAndStoreReport($task, $sastScanId);

        // Also fetch and store findings
        $findings = $sastService->getScanFindings($sastScanId);
        if ($findings) {
          $sastService->storeFindings($task, $findings);
        }

        $sastService->log($task, 'INFO', 'SAST scan completed successfully');
        $task->markAsCompleted($reportPath);

        // Check if all tasks are done
        $this->updateRunStatus($run);
      } elseif ($newTaskStatus === RunTask::STATUS_FAILED) {
        $error = $scanStatus['error'] ?? 'Unknown error';
        $sastService->log($task, 'ERROR', "SAST scan failed: {$error}");
        $task->markAsFailed($error);

        // Check if all tasks are done
        $this->updateRunStatus($run);
      } else {
        $task->update(['status' => $newTaskStatus]);
      }
    }

    // Update progress/findings info in metadata
    if (isset($scanStatus['total_findings'])) {
      $task->update([
        'meta_json' => array_merge($task->meta_json ?? [], [
          'total_findings' => $scanStatus['total_findings'],
          'severity_counts' => $scanStatus['severity_counts'] ?? [],
        ]),
      ]);
    }
  }
}
