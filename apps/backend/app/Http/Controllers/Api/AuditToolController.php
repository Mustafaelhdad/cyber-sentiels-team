<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditToolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Audit & Compliance Tool Controller
 *
 * Handles API endpoints for the Audit Compliance Docker container.
 * Provides audit event logging, compliance reports, and alerts.
 */
class AuditToolController extends Controller
{
  protected AuditToolService $auditToolService;

  public function __construct(AuditToolService $auditToolService)
  {
    $this->auditToolService = $auditToolService;
  }

  /**
   * Check Audit Tool service health.
   *
   * GET /api/audit-tool/health
   */
  public function health(): JsonResponse
  {
    $available = $this->auditToolService->isAvailable();
    $health = $available ? $this->auditToolService->getHealth() : null;

    return response()->json([
      'available' => $available,
      'service' => 'audit-tool',
      'url' => config('services.audit_tool.url', 'http://audit:5060'),
      'health' => $health,
    ], $available ? 200 : 503);
  }

  /**
   * Get Audit Tool statistics.
   *
   * GET /api/audit-tool/stats
   */
  public function stats(): JsonResponse
  {
    $stats = $this->auditToolService->getStats();

    if (!$stats) {
      return response()->json([
        'error' => 'Unable to fetch audit statistics',
        'message' => 'The Audit Tool service may be unavailable',
      ], 503);
    }

    return response()->json($stats);
  }

  /**
   * Fetch audit events.
   *
   * GET /api/audit-tool/events
   */
  public function events(Request $request): JsonResponse
  {
    $filters = $request->only(['user', 'action', 'min_risk', 'limit', 'offset']);
    $events = $this->auditToolService->getEvents($filters);

    if ($events === null) {
      return response()->json([
        'error' => 'Failed to fetch audit events',
        'message' => 'The Audit Tool service may be unavailable',
      ], 503);
    }

    return response()->json($events);
  }

  /**
   * Fetch audit alerts.
   *
   * GET /api/audit-tool/alerts
   */
  public function alerts(Request $request): JsonResponse
  {
    $limit = (int) $request->query('limit', 100);
    $alerts = $this->auditToolService->getAlerts($limit);

    if ($alerts === null) {
      return response()->json([
        'error' => 'Failed to fetch alerts',
        'message' => 'The Audit Tool service may be unavailable',
      ], 503);
    }

    return response()->json($alerts);
  }

  /**
   * Fetch compliance report summary.
   *
   * GET /api/audit-tool/report
   */
  public function report(Request $request): JsonResponse
  {
    $params = $request->only(['include_events', 'include_high_risk', 'limit']);
    $report = $this->auditToolService->getReport($params);

    if ($report === null) {
      return response()->json([
        'error' => 'Failed to fetch compliance report',
        'message' => 'The Audit Tool service may be unavailable',
      ], 503);
    }

    return response()->json($report);
  }

  /**
   * Generate compliance report.
   *
   * POST /api/audit-tool/report
   */
  public function generateReport(): JsonResponse
  {
    $result = $this->auditToolService->generateReport();

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Download compliance report file.
   *
   * GET /api/audit-tool/report/file
   */
  public function reportFile(Request $request): Response|JsonResponse
  {
    $refresh = $request->boolean('refresh', false);
    $result = $this->auditToolService->getReportFile($refresh);

    if (!$result['success']) {
      return response()->json([
        'error' => $result['error'],
      ], $result['status'] ?? 503);
    }

    $contentType = $result['content_type'] ?? 'text/plain';
    return response($result['body'], 200)
      ->header('Content-Type', $contentType)
      ->header('Content-Disposition', 'attachment; filename="compliance_report.txt"');
  }

  /**
   * Log a new audit event.
   *
   * POST /api/audit-tool/log
   */
  public function log(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'user' => 'required|string|max:100',
      'action' => 'required|string|max:255',
    ]);

    $result = $this->auditToolService->logEvent(
      $validated['user'],
      $validated['action']
    );

    if ($result['success']) {
      return response()->json($result['data'], 201);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Generate demo events.
   *
   * POST /api/audit-tool/demo
   */
  public function demo(): JsonResponse
  {
    $result = $this->auditToolService->generateDemoEvents();

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }
}
