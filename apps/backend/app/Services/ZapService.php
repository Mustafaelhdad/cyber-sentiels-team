<?php

namespace App\Services;

use App\Models\RunTask;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZapService
{
  protected string $baseUrl;
  protected ?string $apiKey;
  protected ArtifactStorageService $artifactStorage;
  protected int $spiderMaxDepth;
  protected int $spiderMaxChildren;
  protected int $spiderThreadCount;
  protected int $spiderTimeoutSeconds;
  protected int $activeScanTimeoutSeconds;
  protected int $ascanThreadPerHost;
  protected int $ascanDelayMs;
  protected int $ascanMaxDurationMinutes;

  public function __construct(ArtifactStorageService $artifactStorage)
  {
    $this->baseUrl = config('services.zap.host', 'http://zap:8080');
    $this->apiKey = config('services.zap.api_key');
    $this->artifactStorage = $artifactStorage;

    $config = config('services.zap');
    $this->spiderMaxDepth = (int) data_get($config, 'spider_max_depth', 3);
    $this->spiderMaxChildren = (int) data_get($config, 'spider_max_children', 150);
    $this->spiderThreadCount = (int) data_get($config, 'spider_thread_count', 2);
    $this->spiderTimeoutSeconds = (int) data_get($config, 'spider_timeout_seconds', 300);
    $this->activeScanTimeoutSeconds = (int) data_get($config, 'active_scan_timeout_seconds', 1500);
    $this->ascanThreadPerHost = (int) data_get($config, 'ascan_thread_per_host', 2);
    $this->ascanDelayMs = (int) data_get($config, 'ascan_delay_ms', 200);
    $this->ascanMaxDurationMinutes = (int) data_get($config, 'ascan_max_duration_minutes', 25);
  }

  /**
   * Start a spider scan.
   */
  public function startSpider(string $targetUrl): ?int
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/spider/action/scan/", [
        'url' => $targetUrl,
        'apikey' => $this->apiKey,
      ]);

      if ($response->successful()) {
        return $response->json('scan');
      }

      Log::error('ZAP Spider start failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('ZAP Spider exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Apply conservative defaults to keep scans lightweight.
   */
  public function applySafetyLimits(): void
  {
    $this->callAction('spider/action/setOptionMaxDepth/', ['Integer' => $this->spiderMaxDepth]);
    $this->callAction('spider/action/setOptionMaxChildren/', ['Integer' => $this->spiderMaxChildren]);
    $this->callAction('spider/action/setOptionThreadCount/', ['Integer' => $this->spiderThreadCount]);
    $this->callAction('ascan/action/setOptionThreadPerHost/', ['Integer' => $this->ascanThreadPerHost]);
    $this->callAction('ascan/action/setOptionDelayInMs/', ['Integer' => $this->ascanDelayMs]);
    $this->callAction('ascan/action/setOptionMaxScanDurationInMins/', ['Integer' => $this->ascanMaxDurationMinutes]);
  }

  /**
   * Get spider scan status (0-100).
   */
  public function getSpiderStatus(int $scanId): int
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/spider/view/status/", [
        'scanId' => $scanId,
        'apikey' => $this->apiKey,
      ]);

      return (int) $response->json('status', 0);
    } catch (\Exception $e) {
      Log::error('ZAP Spider status error', ['error' => $e->getMessage()]);
      return 0;
    }
  }

  public function spiderTimeoutSeconds(): int
  {
    return $this->spiderTimeoutSeconds;
  }

  public function activeScanTimeoutSeconds(): int
  {
    return $this->activeScanTimeoutSeconds;
  }

  /**
   * Start an active scan.
   */
  public function startActiveScan(string $targetUrl): ?int
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/ascan/action/scan/", [
        'url' => $targetUrl,
        'apikey' => $this->apiKey,
      ]);

      if ($response->successful()) {
        return $response->json('scan');
      }

      Log::error('ZAP Active scan start failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('ZAP Active scan exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get active scan status (0-100).
   */
  public function getActiveScanStatus(int $scanId): int
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/ascan/view/status/", [
        'scanId' => $scanId,
        'apikey' => $this->apiKey,
      ]);

      return (int) $response->json('status', 0);
    } catch (\Exception $e) {
      Log::error('ZAP Active scan status error', ['error' => $e->getMessage()]);
      return 0;
    }
  }

  /**
   * Stop a spider by ID.
   */
  public function stopSpider(int $scanId): bool
  {
    return $this->callAction('spider/action/stop/', ['scanId' => $scanId]);
  }

  /**
   * Stop an active scan by ID.
   */
  public function stopActiveScan(int $scanId): bool
  {
    return $this->callAction('ascan/action/stop/', ['scanId' => $scanId]);
  }

  /**
   * Get alerts/findings.
   */
  public function getAlerts(?string $baseUrl = null): array
  {
    try {
      $params = ['apikey' => $this->apiKey];
      if ($baseUrl) {
        $params['baseurl'] = $baseUrl;
      }

      $response = Http::get("{$this->baseUrl}/JSON/core/view/alerts/", $params);

      return $response->json('alerts', []);
    } catch (\Exception $e) {
      Log::error('ZAP get alerts error', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Generate and save HTML report.
   *
   * @param RunTask $task The task to store the report for
   * @return string|null The relative path to the report or null on failure
   */
  public function generateHtmlReport(RunTask $task): ?string
  {
    try {
      $response = Http::get("{$this->baseUrl}/OTHER/core/other/htmlreport/", [
        'apikey' => $this->apiKey,
      ]);

      if ($response->successful()) {
        $relativePath = $this->artifactStorage->storeReport($task, 'report.html', $response->body());

        return $relativePath;
      }

      return null;
    } catch (\Exception $e) {
      Log::error('ZAP HTML report error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Generate and save JSON report.
   *
   * @param RunTask $task The task to store the report for
   * @return string|null The relative path to the report or null on failure
   */
  public function generateJsonReport(RunTask $task): ?string
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/core/view/alerts/", [
        'apikey' => $this->apiKey,
      ]);

      if ($response->successful()) {
        $contents = json_encode($response->json(), JSON_PRETTY_PRINT);
        $relativePath = $this->artifactStorage->storeReport($task, 'report.json', $contents);

        return $relativePath;
      }

      return null;
    } catch (\Exception $e) {
      Log::error('ZAP JSON report error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Store execution log for a task.
   *
   * @param RunTask $task The task to store the log for
   * @param string $logContent The log content to store
   * @return string|null The relative path to the log or null on failure
   */
  public function storeExecutionLog(RunTask $task, string $logContent): ?string
  {
    try {
      return $this->artifactStorage->storeLog($task, 'execution.log', $logContent);
    } catch (\Exception $e) {
      Log::error('ZAP log storage error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Append to execution log for a task.
   *
   * @param RunTask $task The task to append the log for
   * @param string $logContent The log content to append
   * @return string|null The relative path to the log or null on failure
   */
  public function appendExecutionLog(RunTask $task, string $logContent): ?string
  {
    try {
      return $this->artifactStorage->appendLog($task, 'execution.log', $logContent);
    } catch (\Exception $e) {
      Log::error('ZAP log append error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Format and append a structured log line.
   *
   * Format: [ISO_TIMESTAMP] LEVEL: message
   *
   * @param RunTask $task The task to append the log for
   * @param string $level Log level (INFO, DEBUG, WARN, ERROR)
   * @param string $message The log message
   * @return string|null The relative path to the log or null on failure
   */
  public function log(RunTask $task, string $level, string $message): ?string
  {
    $timestamp = now()->toIso8601String();
    $formattedLine = "[{$timestamp}] {$level}: {$message}\n";

    return $this->appendExecutionLog($task, $formattedLine);
  }

  /**
   * Clear session (for fresh scans).
   */
  public function newSession(): bool
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/core/action/newSession/", [
        'apikey' => $this->apiKey,
      ]);

      return $response->successful();
    } catch (\Exception $e) {
      Log::error('ZAP new session error', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Health check for ZAP service.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/JSON/core/view/version/", [
        'apikey' => $this->apiKey,
      ]);

      return $response->successful();
    } catch (\Exception $e) {
      return false;
    }
  }

  /**
   * Generic helper for ZAP actions that don't return data.
   */
  protected function callAction(string $path, array $params = []): bool
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/{$path}", array_merge(['apikey' => $this->apiKey], $params));

      if ($response->successful()) {
        return true;
      }

      Log::warning('ZAP action failed', [
        'path' => $path,
        'body' => $response->body(),
      ]);
      return false;
    } catch (\Exception $e) {
      Log::error('ZAP action error', [
        'path' => $path,
        'error' => $e->getMessage(),
      ]);
      return false;
    }
  }
}
