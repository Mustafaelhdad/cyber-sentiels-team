<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SOAR Service
 * 
 * Handles communication between Laravel backend and the SOAR Docker container.
 * Provides methods for incident management, playbook execution, threat intelligence,
 * and automated response actions.
 */
class SoarService
{
  protected string $baseUrl;
  protected int $timeout;

  public function __construct()
  {
    $this->baseUrl = config('services.soar.url', 'http://soar:5000');
    $this->timeout = config('services.soar.timeout', 120);
  }

  /**
   * Check if the SOAR service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/api/health");
      return $response->successful();
    } catch (\Exception $e) {
      Log::warning('SOAR service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get SOAR service health status.
   */
  public function getHealth(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/health");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR health request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR health exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get SOAR service statistics.
   */
  public function getStats(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/stats");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR stats request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR stats exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Process an alert through the SOAR engine.
   *
   * @param array $alertData Alert data including source_ip, attack_type, severity, etc.
   * @return array|null Processing result with incident_id, decision, and actions taken
   */
  public function processAlert(array $alertData): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/process", $alertData);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR process alert failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR process alert exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get all incidents from SOAR.
   *
   * @param int|null $limit Maximum number of incidents to retrieve
   * @return array List of incidents
   */
  public function getIncidents(?int $limit = 50): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/api/incidents", [
        'limit' => $limit,
      ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR get incidents failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SOAR get incidents exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Get a specific incident with its actions.
   *
   * @param string $incidentId The incident ID
   * @return array|null Incident details with actions
   */
  public function getIncident(string $incidentId): ?array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/api/incidents/{$incidentId}");

      if ($response->successful()) {
        return $response->json();
      }

      if ($response->status() === 404) {
        return null;
      }

      Log::error('SOAR get incident failed', ['incident_id' => $incidentId, 'response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR get incident exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Update incident status.
   *
   * @param string $incidentId The incident ID
   * @param string $status New status (open, processing, mitigated, resolved, closed)
   * @return bool Success status
   */
  public function updateIncidentStatus(string $incidentId, string $status): bool
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/incidents/{$incidentId}/status", [
          'status' => $status,
        ]);

      return $response->successful();
    } catch (\Exception $e) {
      Log::error('SOAR update incident status exception', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get all blocked IPs.
   *
   * @return array List of blocked IPs
   */
  public function getBlockedIps(): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/api/blocked-ips");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR get blocked IPs failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SOAR get blocked IPs exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Block an IP address.
   *
   * @param string $ipAddress IP address to block
   * @param string|null $reason Reason for blocking
   * @param int $durationHours Duration in hours (default 24)
   * @return array|null Result with success status and message
   */
  public function blockIp(string $ipAddress, ?string $reason = null, int $durationHours = 24): ?array
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/block", [
          'ip_address' => $ipAddress,
          'reason' => $reason ?? 'Manual block via API',
          'duration_hours' => $durationHours,
        ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR block IP failed', ['ip' => $ipAddress, 'response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR block IP exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Unblock an IP address.
   *
   * @param string $ipAddress IP address to unblock
   * @return array|null Result with success status and message
   */
  public function unblockIp(string $ipAddress): ?array
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/unblock", [
          'ip_address' => $ipAddress,
        ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR unblock IP failed', ['ip' => $ipAddress, 'response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR unblock IP exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get all playbooks.
   *
   * @return array List of playbooks
   */
  public function getPlaybooks(): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/api/playbooks");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR get playbooks failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SOAR get playbooks exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Create a new playbook.
   *
   * @param array $playbookData Playbook data including name, description, trigger_conditions, actions
   * @return array|null Created playbook data
   */
  public function createPlaybook(array $playbookData): ?array
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/playbooks", $playbookData);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR create playbook failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR create playbook exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Update a playbook.
   *
   * @param int $playbookId Playbook ID
   * @param array $playbookData Updated playbook data
   * @return array|null Updated playbook data
   */
  public function updatePlaybook(int $playbookId, array $playbookData): ?array
  {
    try {
      $response = Http::timeout(30)
        ->asJson()
        ->put("{$this->baseUrl}/api/playbooks/{$playbookId}", $playbookData);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR update playbook failed', ['playbook_id' => $playbookId, 'response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR update playbook exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Delete a playbook.
   *
   * @param int $playbookId Playbook ID
   * @return bool Success status
   */
  public function deletePlaybook(int $playbookId): bool
  {
    try {
      $response = Http::timeout(30)->delete("{$this->baseUrl}/api/playbooks/{$playbookId}");
      return $response->successful();
    } catch (\Exception $e) {
      Log::error('SOAR delete playbook exception', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Check threat intelligence for an IP or payload.
   *
   * @param string|null $ip IP address to check
   * @param string|null $payload Payload to analyze
   * @return array|null Threat intelligence results
   */
  public function checkThreatIntel(?string $ip = null, ?string $payload = null): ?array
  {
    try {
      $data = [];
      if ($ip) {
        $data['ip'] = $ip;
      }
      if ($payload) {
        $data['payload'] = $payload;
      }

      if (empty($data)) {
        return null;
      }

      $response = Http::timeout(30)
        ->asJson()
        ->post("{$this->baseUrl}/api/threat-intel/check", $data);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR threat intel check failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SOAR threat intel check exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get execution logs.
   *
   * @param int|null $limit Maximum number of logs to retrieve
   * @return array List of execution logs
   */
  public function getExecutionLogs(?int $limit = 100): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/api/logs", [
        'limit' => $limit,
      ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SOAR get execution logs failed', ['response' => $response->body()]);
      return [];
    } catch (\Exception $e) {
      Log::error('SOAR get execution logs exception', ['error' => $e->getMessage()]);
      return [];
    }
  }

  /**
   * Forward a SIEM alert to SOAR for automated response.
   *
   * @param array $siemAlert SIEM alert data
   * @return array|null Processing result
   */
  public function handleSiemAlert(array $siemAlert): ?array
  {
    // Transform SIEM alert format to SOAR alert format
    $soarAlert = [
      'alert_id' => $siemAlert['id'] ?? $siemAlert['siem_alert_id'] ?? 'SIEM-' . time(),
      'source_ip' => $this->extractIpFromLog($siemAlert['log_entry'] ?? ''),
      'type' => $siemAlert['rule_name'] ?? 'Unknown',
      'attack_type' => $this->mapRuleToAttackType($siemAlert['rule_name'] ?? ''),
      'severity' => $siemAlert['severity'] ?? 'MEDIUM',
      'payload' => $siemAlert['log_entry'] ?? '',
      'source' => 'siem',
      'metadata' => [
        'siem_alert_id' => $siemAlert['id'] ?? null,
        'rule_id' => $siemAlert['rule_id'] ?? null,
        'tip_label' => $siemAlert['tip_label'] ?? null,
        'tip_confidence' => $siemAlert['tip_confidence'] ?? null,
      ],
    ];

    return $this->processAlert($soarAlert);
  }

  /**
   * Extract IP address from a log entry.
   */
  protected function extractIpFromLog(string $logEntry): ?string
  {
    // Common IP patterns in logs
    $patterns = [
      '/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/',
      '/client[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/',
      '/from[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/',
      '/source[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/',
    ];

    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $logEntry, $matches)) {
        return $matches[1];
      }
    }

    return null;
  }

  /**
   * Map SIEM rule name to attack type.
   */
  protected function mapRuleToAttackType(string $ruleName): string
  {
    $ruleLower = strtolower($ruleName);

    if (str_contains($ruleLower, 'sql') || str_contains($ruleLower, 'injection')) {
      return 'SQL Injection';
    }
    if (str_contains($ruleLower, 'xss') || str_contains($ruleLower, 'script')) {
      return 'XSS';
    }
    if (str_contains($ruleLower, 'brute') || str_contains($ruleLower, 'force') || str_contains($ruleLower, 'login')) {
      return 'Brute Force';
    }
    if (str_contains($ruleLower, 'ddos') || str_contains($ruleLower, 'flood')) {
      return 'DDoS';
    }
    if (str_contains($ruleLower, 'malware') || str_contains($ruleLower, 'virus')) {
      return 'Malware';
    }
    if (str_contains($ruleLower, 'phish')) {
      return 'Phishing';
    }
    if (str_contains($ruleLower, 'traversal') || str_contains($ruleLower, 'path')) {
      return 'Path Traversal';
    }
    if (str_contains($ruleLower, 'command') || str_contains($ruleLower, 'exec')) {
      return 'Command Injection';
    }

    return 'Unknown';
  }
}

