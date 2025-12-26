<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Audit & Compliance Tool Service
 *
 * Handles communication between Laravel backend and the Audit Compliance Docker container.
 * Provides methods for logging events, fetching reports, and alerts.
 */
class AuditToolService
{
  protected string $baseUrl;
  protected int $timeout;

  public function __construct()
  {
    $this->baseUrl = config('services.audit_tool.url', 'http://audit:5060');
    $this->timeout = config('services.audit_tool.timeout', 30);
  }

  /**
   * Check if the Audit service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/health");
      return $response->successful();
    } catch (\Exception $e) {
      Log::warning('Audit Tool service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get Audit service health status.
   */
  public function getHealth(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/health");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Audit Tool health request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Audit Tool health exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get Audit service statistics.
   */
  public function getStats(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/audit/stats");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Audit Tool stats request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Audit Tool stats exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Fetch audit events with optional filters.
   */
  public function getEvents(array $filters = []): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/audit/events", $filters);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Audit Tool events request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Audit Tool events exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Fetch audit alerts.
   */
  public function getAlerts(int $limit = 100): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/audit/alerts", ['limit' => $limit]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Audit Tool alerts request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Audit Tool alerts exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Fetch compliance report summary.
   */
  public function getReport(array $params = []): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/audit/report", $params);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Audit Tool report request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Audit Tool report exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Log a new audit event.
   */
  public function logEvent(string $user, string $action): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/audit/log", [
          'user' => $user,
          'action' => $action,
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Audit Tool log event failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to log audit event',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Audit Tool log event exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Generate demo events.
   */
  public function generateDemoEvents(): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/audit/demo");

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Audit Tool demo events failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to generate demo events',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Audit Tool demo events exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Generate a compliance report file.
   */
  public function generateReport(): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/audit/report");

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Audit Tool generate report failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to generate report',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Audit Tool generate report exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Download the compliance report file.
   */
  public function getReportFile(bool $refresh = false): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/audit/report/file", [
          'refresh' => $refresh ? 'true' : 'false',
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'body' => $response->body(),
          'content_type' => $response->header('Content-Type'),
        ];
      }

      Log::warning('Audit Tool report file request failed', ['response' => $response->body()]);
      return [
        'success' => false,
        'error' => 'Report file not available',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Audit Tool report file exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }
}
