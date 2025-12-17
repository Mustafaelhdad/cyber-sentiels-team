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
    $this->task->markAsStarted();

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

    // Check ZAP availability
    if (!$zapService->isAvailable()) {
      throw new \Exception('ZAP service is not available');
    }

    // Start fresh session
    $zapService->newSession();
    $this->task->updateProgress(5);

    // Run spider
    $spiderId = $zapService->startSpider($targetUrl);
    if ($spiderId === null) {
      throw new \Exception('Failed to start spider scan');
    }

    // Wait for spider to complete
    $this->waitForSpider($zapService, $spiderId);
    $this->task->updateProgress(40);

    // Run active scan
    $scanId = $zapService->startActiveScan($targetUrl);
    if ($scanId === null) {
      throw new \Exception('Failed to start active scan');
    }

    // Wait for active scan to complete
    $this->waitForActiveScan($zapService, $scanId);
    $this->task->updateProgress(90);

    // Generate reports
    $reportFile = $zapService->generateJsonReport($this->task);
    $zapService->generateHtmlReport($this->task);

    $this->task->markAsCompleted($reportFile);
  }

  /**
   * Wait for spider scan to complete.
   */
  protected function waitForSpider(ZapService $zapService, int $spiderId): void
  {
    $maxWait = 300; // 5 minutes
    $waited = 0;
    $interval = 5;

    while ($waited < $maxWait) {
      $status = $zapService->getSpiderStatus($spiderId);

      if ($status >= 100) {
        return;
      }

      // Update progress (5-40% range for spider)
      $progress = 5 + (int) ($status * 0.35);
      $this->task->updateProgress($progress);

      sleep($interval);
      $waited += $interval;
    }

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

    while ($waited < $maxWait) {
      $status = $zapService->getActiveScanStatus($scanId);

      if ($status >= 100) {
        return;
      }

      // Update progress (40-90% range for active scan)
      $progress = 40 + (int) ($status * 0.50);
      $this->task->updateProgress($progress);

      sleep($interval);
      $waited += $interval;
    }

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

