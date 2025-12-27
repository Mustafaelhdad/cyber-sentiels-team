<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SoarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SOAR Controller
 * 
 * Handles SOAR-related API endpoints for incident management, playbook execution,
 * threat intelligence, and automated response actions.
 */
class SoarController extends Controller
{
  protected SoarService $soarService;

  public function __construct(SoarService $soarService)
  {
    $this->soarService = $soarService;
  }

  /**
   * Check SOAR service health.
   * 
   * GET /api/soar/health
   */
  public function health(): JsonResponse
  {
    $available = $this->soarService->isAvailable();
    $health = $available ? $this->soarService->getHealth() : null;

    return response()->json([
      'available' => $available,
      'service' => 'soar',
      'url' => config('services.soar.url', 'http://soar:5000'),
      'health' => $health,
    ], $available ? 200 : 503);
  }

  /**
   * Get SOAR statistics and dashboard data.
   * 
   * GET /api/soar/stats
   */
  public function stats(): JsonResponse
  {
    $stats = $this->soarService->getStats();

    if (!$stats) {
      return response()->json([
        'error' => 'Unable to fetch SOAR statistics',
        'message' => 'The SOAR service may be unavailable',
      ], 503);
    }

    return response()->json($stats);
  }

  /**
   * Process an alert through SOAR.
   * 
   * POST /api/soar/process
   */
  public function processAlert(Request $request): JsonResponse
  {
    $request->validate([
      'alert_id' => 'nullable|string|max:255',
      'source_ip' => 'required|ip',
      'type' => 'nullable|string|max:255',
      'attack_type' => 'nullable|string|max:255',
      'severity' => 'nullable|string|in:LOW,MEDIUM,HIGH,CRITICAL,Low,Medium,High,Critical',
      'payload' => 'nullable|string',
      'description' => 'nullable|string',
    ]);

    if (!$this->soarService->isAvailable()) {
      return response()->json([
        'error' => 'SOAR service is unavailable',
        'message' => 'The SOAR service is not responding. Please try again later.',
      ], 503);
    }

    $result = $this->soarService->processAlert($request->all());

    if (!$result) {
      return response()->json([
        'error' => 'Failed to process alert',
        'message' => 'The SOAR service could not process the alert.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Alert processed successfully',
      'incident_id' => $result['incident_id'] ?? null,
      'decision' => $result['decision'] ?? null,
      'is_malicious' => $result['is_malicious'] ?? false,
      'actions_taken' => $result['actions_taken'] ?? [],
      'logs' => $result['logs'] ?? [],
    ], 201);
  }

  /**
   * Get all incidents.
   * 
   * GET /api/soar/incidents
   */
  public function incidents(Request $request): JsonResponse
  {
    $limit = $request->input('limit', 50);
    $incidents = $this->soarService->getIncidents($limit);

    return response()->json([
      'total' => count($incidents),
      'incidents' => $incidents,
    ]);
  }

  /**
   * Get a specific incident.
   * 
   * GET /api/soar/incidents/{incidentId}
   */
  public function showIncident(string $incidentId): JsonResponse
  {
    $incident = $this->soarService->getIncident($incidentId);

    if (!$incident) {
      return response()->json(['error' => 'Incident not found'], 404);
    }

    return response()->json($incident);
  }

  /**
   * Update incident status.
   * 
   * POST /api/soar/incidents/{incidentId}/status
   */
  public function updateIncidentStatus(Request $request, string $incidentId): JsonResponse
  {
    $request->validate([
      'status' => 'required|string|in:open,processing,mitigated,resolved,closed',
    ]);

    $success = $this->soarService->updateIncidentStatus($incidentId, $request->input('status'));

    if (!$success) {
      return response()->json([
        'error' => 'Failed to update incident status',
        'message' => 'The SOAR service could not update the incident.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => "Incident {$incidentId} status updated to {$request->input('status')}",
    ]);
  }

  /**
   * Get blocked IPs.
   * 
   * GET /api/soar/blocked-ips
   */
  public function blockedIps(): JsonResponse
  {
    $ips = $this->soarService->getBlockedIps();

    return response()->json([
      'total' => count($ips),
      'blocked_ips' => $ips,
    ]);
  }

  /**
   * Block an IP address.
   * 
   * POST /api/soar/block
   */
  public function blockIp(Request $request): JsonResponse
  {
    $request->validate([
      'ip_address' => 'required|ip',
      'reason' => 'nullable|string|max:500',
      'duration_hours' => 'nullable|integer|min:1|max:8760', // Max 1 year
    ]);

    $result = $this->soarService->blockIp(
      $request->input('ip_address'),
      $request->input('reason'),
      $request->input('duration_hours', 24)
    );

    if (!$result) {
      return response()->json([
        'error' => 'Failed to block IP',
        'message' => 'The SOAR service could not block the IP address.',
      ], 500);
    }

    return response()->json([
      'success' => $result['success'] ?? true,
      'message' => $result['message'] ?? 'IP blocked successfully',
    ], 201);
  }

  /**
   * Unblock an IP address.
   * 
   * POST /api/soar/unblock
   */
  public function unblockIp(Request $request): JsonResponse
  {
    $request->validate([
      'ip_address' => 'required|ip',
    ]);

    $result = $this->soarService->unblockIp($request->input('ip_address'));

    if (!$result) {
      return response()->json([
        'error' => 'Failed to unblock IP',
        'message' => 'The SOAR service could not unblock the IP address.',
      ], 500);
    }

    return response()->json([
      'success' => $result['success'] ?? true,
      'message' => $result['message'] ?? 'IP unblocked successfully',
    ]);
  }

  /**
   * Get all playbooks.
   * 
   * GET /api/soar/playbooks
   */
  public function playbooks(): JsonResponse
  {
    $playbooks = $this->soarService->getPlaybooks();

    return response()->json([
      'total' => count($playbooks),
      'playbooks' => $playbooks,
    ]);
  }

  /**
   * Create a new playbook.
   * 
   * POST /api/soar/playbooks
   */
  public function createPlaybook(Request $request): JsonResponse
  {
    $request->validate([
      'name' => 'required|string|max:255',
      'description' => 'nullable|string|max:1000',
      'trigger_conditions' => 'nullable|array',
      'trigger_conditions.attack_type' => 'nullable|string',
      'trigger_conditions.severity' => 'nullable|string',
      'trigger_conditions.decision' => 'nullable|string',
      'actions' => 'required|array|min:1',
      'actions.*' => 'string|in:block_ip,create_ticket,notify,log_incident,isolate_host',
      'enabled' => 'nullable|boolean',
    ]);

    $result = $this->soarService->createPlaybook($request->all());

    if (!$result) {
      return response()->json([
        'error' => 'Failed to create playbook',
        'message' => 'The SOAR service could not create the playbook.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Playbook created successfully',
      'playbook_id' => $result['playbook_id'] ?? null,
    ], 201);
  }

  /**
   * Update a playbook.
   * 
   * PUT /api/soar/playbooks/{playbookId}
   */
  public function updatePlaybook(Request $request, int $playbookId): JsonResponse
  {
    $request->validate([
      'name' => 'nullable|string|max:255',
      'description' => 'nullable|string|max:1000',
      'trigger_conditions' => 'nullable|array',
      'actions' => 'nullable|array',
      'actions.*' => 'string|in:block_ip,create_ticket,notify,log_incident,isolate_host',
      'enabled' => 'nullable|boolean',
    ]);

    $result = $this->soarService->updatePlaybook($playbookId, $request->all());

    if (!$result) {
      return response()->json([
        'error' => 'Failed to update playbook',
        'message' => 'The SOAR service could not update the playbook.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Playbook updated successfully',
    ]);
  }

  /**
   * Delete a playbook.
   * 
   * DELETE /api/soar/playbooks/{playbookId}
   */
  public function deletePlaybook(int $playbookId): JsonResponse
  {
    $success = $this->soarService->deletePlaybook($playbookId);

    if (!$success) {
      return response()->json([
        'error' => 'Failed to delete playbook',
        'message' => 'The SOAR service could not delete the playbook.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Playbook deleted successfully',
    ]);
  }

  /**
   * Check threat intelligence for an IP or payload.
   * 
   * POST /api/soar/threat-intel/check
   */
  public function checkThreatIntel(Request $request): JsonResponse
  {
    $request->validate([
      'ip' => 'nullable|ip',
      'payload' => 'nullable|string',
    ]);

    if (!$request->has('ip') && !$request->has('payload')) {
      return response()->json([
        'error' => 'Validation failed',
        'message' => 'Either IP or payload must be provided.',
      ], 422);
    }

    $result = $this->soarService->checkThreatIntel(
      $request->input('ip'),
      $request->input('payload')
    );

    if (!$result) {
      return response()->json([
        'error' => 'Failed to check threat intelligence',
        'message' => 'The SOAR service could not perform the threat intelligence check.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'results' => $result['results'] ?? $result,
    ]);
  }

  /**
   * Get execution logs.
   * 
   * GET /api/soar/logs
   */
  public function logs(Request $request): JsonResponse
  {
    $limit = $request->input('limit', 100);
    $logs = $this->soarService->getExecutionLogs($limit);

    return response()->json([
      'total' => count($logs),
      'logs' => $logs,
    ]);
  }

  /**
   * Forward a SIEM alert to SOAR for automated response.
   * 
   * POST /api/soar/siem-alert
   */
  public function handleSiemAlert(Request $request): JsonResponse
  {
    $request->validate([
      'id' => 'nullable|string',
      'siem_alert_id' => 'nullable|string',
      'rule_id' => 'nullable|string',
      'rule_name' => 'nullable|string',
      'severity' => 'nullable|string',
      'log_entry' => 'nullable|string',
      'source' => 'nullable|string',
    ]);

    if (!$this->soarService->isAvailable()) {
      return response()->json([
        'error' => 'SOAR service is unavailable',
        'message' => 'The SOAR service is not responding. Please try again later.',
      ], 503);
    }

    $result = $this->soarService->handleSiemAlert($request->all());

    if (!$result) {
      return response()->json([
        'error' => 'Failed to process SIEM alert',
        'message' => 'The SOAR service could not process the SIEM alert.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'SIEM alert forwarded to SOAR successfully',
      'incident_id' => $result['incident_id'] ?? null,
      'decision' => $result['decision'] ?? null,
      'is_malicious' => $result['is_malicious'] ?? false,
      'actions_taken' => $result['actions_taken'] ?? [],
    ], 201);
  }

  /**
   * Run a demo/test alert through SOAR.
   * 
   * POST /api/soar/demo
   */
  public function demo(Request $request): JsonResponse
  {
    $demoAlerts = [
      'sql_injection' => [
        'alert_id' => 'DEMO-SQL-' . time(),
        'source_ip' => '185.220.101.45',
        'type' => 'SQL Injection',
        'attack_type' => 'SQL Injection',
        'severity' => 'HIGH',
        'payload' => "SELECT * FROM users WHERE id=1 UNION SELECT password FROM admin--",
      ],
      'brute_force' => [
        'alert_id' => 'DEMO-BRUTE-' . time(),
        'source_ip' => '91.214.124.143',
        'type' => 'Brute Force',
        'attack_type' => 'Brute Force',
        'severity' => 'MEDIUM',
        'payload' => 'Multiple failed login attempts detected from IP',
      ],
      'xss' => [
        'alert_id' => 'DEMO-XSS-' . time(),
        'source_ip' => '45.155.205.233',
        'type' => 'XSS',
        'attack_type' => 'XSS',
        'severity' => 'HIGH',
        'payload' => '<script>alert("XSS")</script>',
      ],
      'clean' => [
        'alert_id' => 'DEMO-CLEAN-' . time(),
        'source_ip' => '192.168.1.100',
        'type' => 'Normal Traffic',
        'attack_type' => 'Unknown',
        'severity' => 'LOW',
        'payload' => 'GET /api/users HTTP/1.1',
      ],
    ];

    $alertType = $request->input('type', 'sql_injection');
    
    if (!isset($demoAlerts[$alertType])) {
      return response()->json([
        'error' => 'Invalid demo type',
        'message' => 'Available types: sql_injection, brute_force, xss, clean',
        'available_types' => array_keys($demoAlerts),
      ], 400);
    }

    if (!$this->soarService->isAvailable()) {
      return response()->json([
        'error' => 'SOAR service is unavailable',
        'message' => 'The SOAR service is not responding. Please try again later.',
      ], 503);
    }

    $result = $this->soarService->processAlert($demoAlerts[$alertType]);

    if (!$result) {
      return response()->json([
        'error' => 'Failed to process demo alert',
        'message' => 'The SOAR service could not process the demo alert.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Demo alert processed successfully',
      'demo_type' => $alertType,
      'alert_sent' => $demoAlerts[$alertType],
      'incident_id' => $result['incident_id'] ?? null,
      'decision' => $result['decision'] ?? null,
      'is_malicious' => $result['is_malicious'] ?? false,
      'actions_taken' => $result['actions_taken'] ?? [],
      'logs' => $result['logs'] ?? [],
    ]);
  }
}

