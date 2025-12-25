<?php

namespace App\Services;

use App\Models\RunTask;
use App\Models\SiemAlert;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SIEM Service
 * 
 * Handles communication between Laravel backend and the SIEM Docker container.
 * Provides methods for log analysis, alert management, and real-time monitoring.
 */
class SiemService
{
  protected string $baseUrl;
  protected ArtifactStorageService $artifactStorage;
  protected int $timeout;

  public function __construct(ArtifactStorageService $artifactStorage)
  {
    $this->baseUrl = config('services.siem.url', 'http://siem:5000');
    $this->timeout = config('services.siem.timeout', 120);
    $this->artifactStorage = $artifactStorage;
  }

  /**
   * Check if the SIEM service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/stats");
      return $response->successful();
    } catch (\Exception $e) {
      Log::warning('SIEM service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get SIEM service health status and statistics.
   */
  public function getStats(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/stats");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM stats request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM stats exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get all detection rules from the SIEM service.
   */
  public function getRules(): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/rules");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM get rules failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SIEM get rules exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Get all alerts from the SIEM service.
   */
  public function getAlerts(?int $limit = 100): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/alerts", [
        'limit' => $limit,
      ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM get alerts failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SIEM get alerts exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Get recent logs from the SIEM service.
   */
  public function getLogs(?int $limit = 100): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/logs", [
        'limit' => $limit,
      ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM get logs failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SIEM get logs exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Upload and analyze a log file.
   *
   * @param UploadedFile $file The log file to analyze
   * @param string $source The source identifier for the logs
   * @return array|null Analysis results including alerts generated
   */
  public function uploadLogFile(UploadedFile $file, string $source = 'uploaded_file'): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asMultipart()
        ->attach('file', $file->get(), $file->getClientOriginalName())
        ->post("{$this->baseUrl}/upload", [
          ['name' => 'source', 'contents' => $source],
        ]);

      if ($response->successful()) {
        $result = $response->json();

        // Store any alerts generated in our database
        if (!empty($result['alerts'])) {
          $this->storeAlerts($result['alerts']);
        }

        return $result;
      }

      Log::error('SIEM upload failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM upload exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Analyze log text directly (without file upload).
   *
   * @param string $logs The log content to analyze
   * @param string $source The source identifier
   * @return array|null Analysis results
   */
  public function analyzeLogs(string $logs, string $source = 'manual'): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/analyze", [
          'logs' => $logs,
          'source' => $source,
        ]);

      if ($response->successful()) {
        $result = $response->json();

        // Store any alerts generated in our database
        if (!empty($result['alerts'])) {
          $this->storeAlerts($result['alerts']);
        }

        return $result;
      }

      Log::error('SIEM analyze failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM analyze exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Ingest a single log entry for real-time analysis.
   *
   * @param string $logEntry The log entry to analyze
   * @param string $source The source identifier
   * @param array|null $metadata Additional metadata
   * @return array|null Analysis result
   */
  public function ingestLog(string $logEntry, string $source = 'api', ?array $metadata = null): ?array
  {
    try {
      $payload = [
        'log' => $logEntry,
        'source' => $source,
      ];

      if ($metadata) {
        $payload['metadata'] = $metadata;
      }

      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/ingest", $payload);

      if ($response->successful()) {
        $result = $response->json();

        // Store any alerts generated
        if (!empty($result['alerts'])) {
          $this->storeAlerts($result['alerts']);
        }

        return $result;
      }

      Log::error('SIEM ingest failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM ingest exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Ingest multiple log entries in batch.
   *
   * @param array $logs Array of log entries (strings or objects with 'log' and 'source')
   * @param string $defaultSource Default source if not specified per entry
   * @return array|null Batch analysis results
   */
  public function ingestBatch(array $logs, string $defaultSource = 'api_batch'): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/ingest/batch", [
          'logs' => $logs,
          'default_source' => $defaultSource,
        ]);

      if ($response->successful()) {
        $result = $response->json();

        // Store any alerts generated
        if (!empty($result['alerts'])) {
          $this->storeAlerts($result['alerts']);
        }

        return $result;
      }

      Log::error('SIEM batch ingest failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM batch ingest exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get a specific report by filename.
   */
  public function getReport(string $reportName): ?string
  {
    try {
      $response = Http::timeout(60)->get("{$this->baseUrl}/report/{$reportName}");

      if ($response->successful()) {
        return $response->body();
      }

      Log::error('SIEM report fetch failed', ['report' => $reportName, 'response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM report fetch exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get the latest report.
   */
  public function getLatestReport(): ?string
  {
    try {
      $response = Http::timeout(60)->get("{$this->baseUrl}/report/latest");

      if ($response->successful()) {
        return $response->body();
      }

      Log::error('SIEM latest report fetch failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM latest report fetch exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Acknowledge an alert.
   */
  public function acknowledgeAlert(string $alertId): bool
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/alerts/{$alertId}/acknowledge");

      if ($response->successful()) {
        // Update local database
        SiemAlert::where('siem_alert_id', $alertId)->update(['acknowledged' => true]);
        return true;
      }

      Log::error('SIEM acknowledge alert failed', ['alert_id' => $alertId, 'response' => $response->body()]);
      return false;
    } catch (\Exception $e) {
      Log::error('SIEM acknowledge alert exception', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Store alerts from SIEM in local database.
   *
   * @param array $alerts Array of alert data from SIEM
   */
  protected function storeAlerts(array $alerts): void
  {
    foreach ($alerts as $alertData) {
      try {
        SiemAlert::updateOrCreate(
          ['siem_alert_id' => $alertData['id'] ?? null],
          [
            'rule_id' => $alertData['rule_id'] ?? null,
            'rule_name' => $alertData['rule_name'] ?? 'Unknown',
            'severity' => $alertData['severity'] ?? 'MEDIUM',
            'description' => $alertData['description'] ?? '',
            'log_entry' => $alertData['log_entry'] ?? '',
            'source' => $alertData['source'] ?? 'unknown',
            'tip_label' => $alertData['tip']['label'] ?? null,
            'tip_confidence' => $alertData['tip']['confidence'] ?? null,
            'tip_is_malicious' => $alertData['tip']['is_malicious'] ?? null,
            'acknowledged' => $alertData['acknowledged'] ?? false,
            'alert_timestamp' => isset($alertData['timestamp'])
              ? \Carbon\Carbon::parse($alertData['timestamp'])
              : now(),
          ]
        );
      } catch (\Exception $e) {
        Log::error('Failed to store SIEM alert', [
          'alert_id' => $alertData['id'] ?? 'unknown',
          'error' => $e->getMessage(),
        ]);
      }
    }
  }

  /**
   * Log a message for a SIEM-related task.
   */
  public function log(RunTask $task, string $level, string $message): ?string
  {
    $timestamp = now()->toIso8601String();
    $formattedLine = "[{$timestamp}] {$level}: {$message}\n";

    try {
      return $this->artifactStorage->appendLog($task, 'siem_execution.log', $formattedLine);
    } catch (\Exception $e) {
      Log::error('SIEM log append error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get alert statistics grouped by severity.
   */
  public function getAlertStatistics(): array
  {
    $stats = $this->getStats();

    if (!$stats) {
      return [
        'total_logs_processed' => 0,
        'total_alerts' => 0,
        'high_severity_alerts' => 0,
        'critical_alerts' => 0,
        'system_status' => 'offline',
      ];
    }

    return $stats;
  }

  /**
   * Search logs with filters.
   */
  public function searchLogs(array $filters = []): ?array
  {
    try {
      $response = Http::timeout(60)
        ->asJson()
        ->post("{$this->baseUrl}/api/logs/search", $filters);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM log search failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM log search exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get alert trends over time.
   */
  public function getAlertTrends(string $period = '24h'): ?array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/api/alerts/trends", [
        'period' => $period,
      ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM alert trends failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM alert trends exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Create or update a detection rule.
   */
  public function saveRule(array $ruleData): ?array
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/rules", $ruleData);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SIEM save rule failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SIEM save rule exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Delete a detection rule.
   */
  public function deleteRule(string $ruleId): bool
  {
    try {
      $response = Http::timeout(30)->delete("{$this->baseUrl}/api/rules/{$ruleId}");
      return $response->successful();
    } catch (\Exception $e) {
      Log::error('SIEM delete rule exception', ['error' => $e->getMessage()]);
      return false;
    }
  }
}
