<?php

namespace App\Services;

use App\Models\RunTask;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ZapService
{
  protected string $baseUrl;
  protected ?string $apiKey;

  public function __construct()
  {
    $this->baseUrl = config('services.zap.host', 'http://zap:8080');
    $this->apiKey = config('services.zap.api_key');
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
   * Get alerts/findings.
   */
  public function getAlerts(string $baseUrl = null): array
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
   */
  public function generateHtmlReport(RunTask $task): ?string
  {
    try {
      $response = Http::get("{$this->baseUrl}/OTHER/core/other/htmlreport/", [
        'apikey' => $this->apiKey,
      ]);

      if ($response->successful()) {
        $reportPath = $task->getReportStoragePath();
        $filename = 'report.html';
        $fullPath = "{$reportPath}/{$filename}";

        // Ensure directory exists
        if (!is_dir($reportPath)) {
          mkdir($reportPath, 0755, true);
        }

        file_put_contents($fullPath, $response->body());

        return $filename;
      }

      return null;
    } catch (\Exception $e) {
      Log::error('ZAP HTML report error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Generate and save JSON report.
   */
  public function generateJsonReport(RunTask $task): ?string
  {
    try {
      $response = Http::get("{$this->baseUrl}/JSON/core/view/alerts/", [
        'apikey' => $this->apiKey,
      ]);

      if ($response->successful()) {
        $reportPath = $task->getReportStoragePath();
        $filename = 'report.json';
        $fullPath = "{$reportPath}/{$filename}";

        // Ensure directory exists
        if (!is_dir($reportPath)) {
          mkdir($reportPath, 0755, true);
        }

        file_put_contents($fullPath, json_encode($response->json(), JSON_PRETTY_PRINT));

        return $filename;
      }

      return null;
    } catch (\Exception $e) {
      Log::error('ZAP JSON report error', ['error' => $e->getMessage()]);
      return null;
    }
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
}

