<?php

namespace App\Jobs;

use App\Models\RunTask;
use App\Services\RunService;
use App\Services\ZapService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ExecuteToolJob implements ShouldQueue
{
  use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

  /**
   * The number of times the job may be attempted.
   */
  public int $tries = 1;

  /**
   * The maximum number of seconds the job can run.
   */
  public int $timeout = 3600; // 1 hour

  /**
   * Create a new job instance.
   */
  public function __construct(
    public RunTask $task
  ) {}

  /**
   * Execute the job.
   */
  public function handle(ZapService $zapService, RunService $runService): void
  {
    // Generic: mark task as running with 0% progress
    $this->task->markAsStarted();
    $this->task->updateProgress(0);

    try {
      match ($this->task->tool) {
        RunTask::TOOL_ZAP => $this->executeZap($zapService),
        default => throw new \Exception("Unknown tool: {$this->task->tool}"),
      };
    } catch (\Exception $e) {
      Log::error("Tool execution failed", [
        'task_id' => $this->task->id,
        'tool' => $this->task->tool,
        'error' => $e->getMessage(),
      ]);

      // Log failure to execution log for SSE streaming
      if ($this->task->tool === RunTask::TOOL_ZAP) {
        $zapService->log($this->task, 'ERROR', "Task failed: {$e->getMessage()}");
      }

      $this->task->markAsFailed($e->getMessage());
    }

    // Update parent run status
    $runService->updateRunStatus($this->task->run);
  }

  /**
   * Execute ZAP DAST scan.
   */
  protected function executeZap(ZapService $zapService): void
  {
    $targetUrl = $this->task->run->target_value;

    // Generic: 10% - starting tool
    $this->task->updateProgress(10);
    $zapService->log($this->task, 'INFO', "Starting ZAP DAST scan for target: {$targetUrl}");

    // Check ZAP availability
    if (!$zapService->isAvailable()) {
      $zapService->log($this->task, 'ERROR', 'ZAP service is not available');
      throw new \Exception('ZAP service is not available');
    }
    $zapService->log($this->task, 'INFO', 'ZAP service is available');

    // Start fresh session
    $zapService->newSession();
    $this->task->updateProgress(20);
    $zapService->log($this->task, 'INFO', 'New ZAP session initialized');

    // Run spider
    $zapService->log($this->task, 'INFO', 'Starting spider scan...');
    $spiderId = $zapService->startSpider($targetUrl);
    if ($spiderId === null) {
      $zapService->log($this->task, 'ERROR', 'Failed to start spider scan');
      throw new \Exception('Failed to start spider scan');
    }

    // Generic: 30% - spider started
    $this->task->updateProgress(30);
    $zapService->log($this->task, 'INFO', "Spider scan started (ID: {$spiderId})");

    // Wait for spider to complete
    $this->waitForSpider($zapService, $spiderId);
    $this->task->updateProgress(50);
    $zapService->log($this->task, 'INFO', 'Spider scan completed');

    // Run active scan
    $zapService->log($this->task, 'INFO', 'Starting active scan...');
    $scanId = $zapService->startActiveScan($targetUrl);
    if ($scanId === null) {
      $zapService->log($this->task, 'ERROR', 'Failed to start active scan');
      throw new \Exception('Failed to start active scan');
    }

    // Generic: 60% - active scan started
    $this->task->updateProgress(60);
    $zapService->log($this->task, 'INFO', "Active scan started (ID: {$scanId})");

    // Wait for active scan to complete
    $this->waitForActiveScan($zapService, $scanId);
    $this->task->updateProgress(80);
    $zapService->log($this->task, 'INFO', 'Active scan completed');

    // Generate reports
    $zapService->log($this->task, 'INFO', 'Generating reports...');
    $jsonReportPath = $zapService->generateJsonReport($this->task);
    $htmlReportPath = $zapService->generateHtmlReport($this->task);
    $zapService->log($this->task, 'INFO', "JSON report generated: {$jsonReportPath}");
    $zapService->log($this->task, 'INFO', "HTML report generated: {$htmlReportPath}");

    // Final completion log
    $zapService->log($this->task, 'INFO', "ZAP scan completed successfully for target: {$targetUrl}");

    // Get the logs path (the log file already exists from previous log calls)
    $logsPath = $this->task->getArtifactDirectory() . '/execution.log';

    // Generic: 100% via markAsCompleted
    $this->task->markAsCompleted($jsonReportPath, $logsPath);
  }

  /**
   * Wait for spider scan to complete.
   */
  protected function waitForSpider(ZapService $zapService, int $spiderId): void
  {
    $maxWait = 300; // 5 minutes
    $waited = 0;
    $interval = 5;
    $lastLoggedProgress = 0;

    while ($waited < $maxWait) {
      $status = $zapService->getSpiderStatus($spiderId);

      if ($status >= 100) {
        return;
      }

      // Generic progress: 30-50% range for spider
      $progress = 30 + (int) ($status * 0.20);
      $this->task->updateProgress($progress);

      // Log progress every 20%
      if ($status - $lastLoggedProgress >= 20) {
        $zapService->log($this->task, 'DEBUG', "Spider scan progress: {$status}%");
        $lastLoggedProgress = $status;
      }

      sleep($interval);
      $waited += $interval;
    }

    $zapService->log($this->task, 'WARN', 'Spider scan timeout reached');
    Log::warning("Spider scan timeout", ['task_id' => $this->task->id]);
  }

  /**
   * Wait for active scan to complete.
   */
  protected function waitForActiveScan(ZapService $zapService, int $scanId): void
  {
    $maxWait = 1800; // 30 minutes
    $waited = 0;
    $interval = 10;
    $lastLoggedProgress = 0;

    while ($waited < $maxWait) {
      $status = $zapService->getActiveScanStatus($scanId);

      if ($status >= 100) {
        return;
      }

      // Generic progress: 60-80% range for active scan
      $progress = 60 + (int) ($status * 0.20);
      $this->task->updateProgress($progress);

      // Log progress every 20%
      if ($status - $lastLoggedProgress >= 20) {
        $zapService->log($this->task, 'DEBUG', "Active scan progress: {$status}%");
        $lastLoggedProgress = $status;
      }

      sleep($interval);
      $waited += $interval;
    }

    $zapService->log($this->task, 'WARN', 'Active scan timeout reached');
    Log::warning("Active scan timeout", ['task_id' => $this->task->id]);
  }

  /**
   * Handle job failure.
   */
  public function failed(\Throwable $exception): void
  {
    Log::error("ExecuteToolJob failed", [
      'task_id' => $this->task->id,
      'tool' => $this->task->tool,
      'error' => $exception->getMessage(),
    ]);

    $this->task->markAsFailed($exception->getMessage());
  }
}
