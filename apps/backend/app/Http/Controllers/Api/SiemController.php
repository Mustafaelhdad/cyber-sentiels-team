<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\SiemAlert;
use App\Services\SiemService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/**
 * SIEM Controller
 * 
 * Handles SIEM-related API endpoints for log analysis, alert management,
 * and integration with the SIEM Docker container.
 */
class SiemController extends Controller
{
  protected SiemService $siemService;

  public function __construct(SiemService $siemService)
  {
    $this->siemService = $siemService;
  }

  /**
   * Check SIEM service health.
   * 
   * GET /api/siem/health
   */
  public function health(): JsonResponse
  {
    $available = $this->siemService->isAvailable();
    $stats = $available ? $this->siemService->getStats() : null;

    return response()->json([
      'available' => $available,
      'service' => 'siem',
      'url' => config('services.siem.url', 'http://siem:5000'),
      'stats' => $stats,
    ], $available ? 200 : 503);
  }

  /**
   * Get SIEM statistics and dashboard data.
   * 
   * GET /api/siem/stats
   */
  public function stats(): JsonResponse
  {
    $stats = $this->siemService->getStats();

    if (!$stats) {
      return response()->json([
        'error' => 'Unable to fetch SIEM statistics',
        'message' => 'The SIEM service may be unavailable',
      ], 503);
    }

    // Enrich with local database statistics
    $localStats = [
      'local_alerts_total' => SiemAlert::count(),
      'local_alerts_unacknowledged' => SiemAlert::where('acknowledged', false)->count(),
      'local_alerts_critical' => SiemAlert::where('severity', 'CRITICAL')->count(),
      'local_alerts_high' => SiemAlert::where('severity', 'HIGH')->count(),
      'local_alerts_medium' => SiemAlert::where('severity', 'MEDIUM')->count(),
      'local_alerts_low' => SiemAlert::where('severity', 'LOW')->count(),
      'alerts_last_24h' => SiemAlert::where('created_at', '>=', now()->subDay())->count(),
      'alerts_last_7d' => SiemAlert::where('created_at', '>=', now()->subWeek())->count(),
    ];

    return response()->json(array_merge($stats, ['local' => $localStats]));
  }

  /**
   * Get all detection rules.
   * 
   * GET /api/siem/rules
   */
  public function rules(): JsonResponse
  {
    $rules = $this->siemService->getRules();
    return response()->json([
      'total' => count($rules),
      'rules' => $rules,
    ]);
  }

  /**
   * Get alerts from SIEM service.
   * 
   * GET /api/siem/alerts
   */
  public function alerts(Request $request): JsonResponse
  {
    $limit = $request->input('limit', 100);

    // Get alerts from SIEM container
    $siemAlerts = $this->siemService->getAlerts($limit);

    return response()->json([
      'total' => count($siemAlerts),
      'alerts' => $siemAlerts,
    ]);
  }

  /**
   * Get alerts from local database with filtering and pagination.
   * 
   * GET /api/siem/alerts/local
   */
  public function localAlerts(Request $request): JsonResponse
  {
    $query = SiemAlert::query();

    // Filter by severity
    if ($request->has('severity')) {
      $query->where('severity', strtoupper($request->input('severity')));
    }

    // Filter by acknowledged status
    if ($request->has('acknowledged')) {
      $query->where('acknowledged', $request->boolean('acknowledged'));
    }

    // Filter by source
    if ($request->has('source')) {
      $query->where('source', $request->input('source'));
    }

    // Filter by rule_id
    if ($request->has('rule_id')) {
      $query->where('rule_id', $request->input('rule_id'));
    }

    // Filter by date range
    if ($request->has('from')) {
      $query->where('alert_timestamp', '>=', $request->input('from'));
    }
    if ($request->has('to')) {
      $query->where('alert_timestamp', '<=', $request->input('to'));
    }

    // Search in log entry or description
    if ($request->has('search')) {
      $search = $request->input('search');
      $query->where(function ($q) use ($search) {
        $q->where('log_entry', 'like', "%{$search}%")
          ->orWhere('description', 'like', "%{$search}%")
          ->orWhere('rule_name', 'like', "%{$search}%");
      });
    }

    // Order and paginate
    $orderBy = $request->input('order_by', 'alert_timestamp');
    $orderDir = $request->input('order_dir', 'desc');
    $query->orderBy($orderBy, $orderDir);

    $perPage = min($request->input('per_page', 50), 200);
    $alerts = $query->paginate($perPage);

    return response()->json($alerts);
  }

  /**
   * Get a specific alert by ID.
   * 
   * GET /api/siem/alerts/{id}
   */
  public function showAlert(int $id): JsonResponse
  {
    $alert = SiemAlert::find($id);

    if (!$alert) {
      return response()->json(['error' => 'Alert not found'], 404);
    }

    return response()->json($alert);
  }

  /**
   * Acknowledge an alert.
   * 
   * POST /api/siem/alerts/{id}/acknowledge
   */
  public function acknowledgeAlert(int $id): JsonResponse
  {
    $alert = SiemAlert::find($id);

    if (!$alert) {
      return response()->json(['error' => 'Alert not found'], 404);
    }

    // Acknowledge in SIEM container if we have the SIEM alert ID
    if ($alert->siem_alert_id) {
      $this->siemService->acknowledgeAlert($alert->siem_alert_id);
    }

    $alert->update(['acknowledged' => true]);

    return response()->json([
      'message' => 'Alert acknowledged successfully',
      'alert' => $alert->fresh(),
    ]);
  }

  /**
   * Bulk acknowledge alerts.
   * 
   * POST /api/siem/alerts/acknowledge-bulk
   */
  public function acknowledgeAlertsBulk(Request $request): JsonResponse
  {
    $request->validate([
      'alert_ids' => 'required|array',
      'alert_ids.*' => 'integer|exists:siem_alerts,id',
    ]);

    $alertIds = $request->input('alert_ids');
    $count = SiemAlert::whereIn('id', $alertIds)->update(['acknowledged' => true]);

    return response()->json([
      'message' => "{$count} alerts acknowledged successfully",
      'count' => $count,
    ]);
  }

  /**
   * Get recent logs from SIEM.
   * 
   * GET /api/siem/logs
   */
  public function logs(Request $request): JsonResponse
  {
    $limit = $request->input('limit', 100);
    $logs = $this->siemService->getLogs($limit);

    return response()->json([
      'total' => count($logs),
      'logs' => $logs,
    ]);
  }

  /**
   * Upload and analyze a log file.
   * 
   * POST /api/siem/upload
   */
  public function upload(Request $request): JsonResponse
  {
    $request->validate([
      'file' => 'required|file|max:102400', // 100MB max
      'source' => 'nullable|string|max:255',
    ]);

    if (!$this->siemService->isAvailable()) {
      return response()->json([
        'error' => 'SIEM service is unavailable',
        'message' => 'The SIEM service is not responding. Please try again later.',
      ], 503);
    }

    $file = $request->file('file');
    $source = $request->input('source', 'uploaded_file');

    $result = $this->siemService->uploadLogFile($file, $source);

    if (!$result) {
      return response()->json([
        'error' => 'Failed to analyze log file',
        'message' => 'The SIEM service could not process the uploaded file.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Log file analyzed successfully',
      'logs_processed' => $result['logs_processed'] ?? 0,
      'alerts_generated' => $result['alerts_generated'] ?? 0,
      'alerts' => $result['alerts'] ?? [],
      'report_url' => $result['report_url'] ?? null,
      'stats' => $result['stats'] ?? null,
    ], 201);
  }

  /**
   * Analyze log text directly.
   * 
   * POST /api/siem/analyze
   */
  public function analyze(Request $request): JsonResponse
  {
    $request->validate([
      'logs' => 'required|string',
      'source' => 'nullable|string|max:255',
    ]);

    if (!$this->siemService->isAvailable()) {
      return response()->json([
        'error' => 'SIEM service is unavailable',
        'message' => 'The SIEM service is not responding. Please try again later.',
      ], 503);
    }

    $logs = $request->input('logs');
    $source = $request->input('source', 'manual');

    $result = $this->siemService->analyzeLogs($logs, $source);

    if (!$result) {
      return response()->json([
        'error' => 'Failed to analyze logs',
        'message' => 'The SIEM service could not process the provided logs.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Logs analyzed successfully',
      'logs_processed' => $result['logs_processed'] ?? 0,
      'alerts_generated' => $result['alerts_generated'] ?? 0,
      'alerts' => $result['alerts'] ?? [],
      'report_url' => $result['report_url'] ?? null,
      'stats' => $result['stats'] ?? null,
    ]);
  }

  /**
   * Ingest a single log entry for real-time analysis.
   * 
   * POST /api/siem/ingest
   */
  public function ingest(Request $request): JsonResponse
  {
    $request->validate([
      'log' => 'required|string',
      'source' => 'nullable|string|max:255',
      'metadata' => 'nullable|array',
    ]);

    $log = $request->input('log');
    $source = $request->input('source', 'api');
    $metadata = $request->input('metadata');

    $result = $this->siemService->ingestLog($log, $source, $metadata);

    if (!$result) {
      return response()->json([
        'error' => 'Failed to ingest log',
        'message' => 'The SIEM service could not process the log entry.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'alerts' => $result['alerts'] ?? [],
      'processed' => true,
    ]);
  }

  /**
   * Ingest multiple log entries in batch.
   * 
   * POST /api/siem/ingest/batch
   */
  public function ingestBatch(Request $request): JsonResponse
  {
    $request->validate([
      'logs' => 'required|array|min:1|max:1000',
      'logs.*' => 'required',
      'default_source' => 'nullable|string|max:255',
    ]);

    $logs = $request->input('logs');
    $defaultSource = $request->input('default_source', 'api_batch');

    $result = $this->siemService->ingestBatch($logs, $defaultSource);

    if (!$result) {
      return response()->json([
        'error' => 'Failed to ingest logs batch',
        'message' => 'The SIEM service could not process the log entries.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'logs_processed' => $result['logs_processed'] ?? count($logs),
      'alerts_generated' => $result['alerts_generated'] ?? 0,
      'alerts' => $result['alerts'] ?? [],
    ]);
  }

  /**
   * Get a specific report.
   * 
   * GET /api/siem/reports/{reportName}
   */
  public function getReport(string $reportName): Response|JsonResponse
  {
    $report = $this->siemService->getReport($reportName);

    if (!$report) {
      return response()->json(['error' => 'Report not found'], 404);
    }

    return response($report, 200, [
      'Content-Type' => 'text/html',
      'Content-Disposition' => "inline; filename=\"{$reportName}\"",
    ]);
  }

  /**
   * Get the latest report.
   * 
   * GET /api/siem/reports/latest
   */
  public function getLatestReport(): Response|JsonResponse
  {
    $report = $this->siemService->getLatestReport();

    if (!$report) {
      return response()->json(['error' => 'No reports available'], 404);
    }

    return response($report, 200, [
      'Content-Type' => 'text/html',
    ]);
  }

  /**
   * Get alert severity distribution.
   * 
   * GET /api/siem/alerts/distribution
   */
  public function alertDistribution(): JsonResponse
  {
    $distribution = SiemAlert::selectRaw('severity, COUNT(*) as count')
      ->groupBy('severity')
      ->pluck('count', 'severity')
      ->toArray();

    $bySource = SiemAlert::selectRaw('source, COUNT(*) as count')
      ->groupBy('source')
      ->pluck('count', 'source')
      ->toArray();

    $byRule = SiemAlert::selectRaw('rule_name, COUNT(*) as count')
      ->groupBy('rule_name')
      ->orderByDesc('count')
      ->limit(10)
      ->pluck('count', 'rule_name')
      ->toArray();

    return response()->json([
      'by_severity' => $distribution,
      'by_source' => $bySource,
      'top_rules' => $byRule,
    ]);
  }

  /**
   * Get alert timeline data.
   * 
   * GET /api/siem/alerts/timeline
   */
  public function alertTimeline(Request $request): JsonResponse
  {
    $period = $request->input('period', '24h');

    $startDate = match ($period) {
      '1h' => now()->subHour(),
      '6h' => now()->subHours(6),
      '24h' => now()->subDay(),
      '7d' => now()->subWeek(),
      '30d' => now()->subMonth(),
      default => now()->subDay(),
    };

    $interval = match ($period) {
      '1h' => 'minute',
      '6h' => 'hour',
      '24h' => 'hour',
      '7d' => 'day',
      '30d' => 'day',
      default => 'hour',
    };

    // Get alerts grouped by time interval
    $alerts = SiemAlert::where('alert_timestamp', '>=', $startDate)
      ->selectRaw("DATE_FORMAT(alert_timestamp, '%Y-%m-%d %H:00:00') as time_bucket, severity, COUNT(*) as count")
      ->groupBy('time_bucket', 'severity')
      ->orderBy('time_bucket')
      ->get();

    // Transform into timeline format
    $timeline = [];
    foreach ($alerts as $alert) {
      $bucket = $alert->time_bucket;
      if (!isset($timeline[$bucket])) {
        $timeline[$bucket] = [
          'timestamp' => $bucket,
          'total' => 0,
          'critical' => 0,
          'high' => 0,
          'medium' => 0,
          'low' => 0,
        ];
      }
      $severity = strtolower($alert->severity);
      $timeline[$bucket][$severity] = $alert->count;
      $timeline[$bucket]['total'] += $alert->count;
    }

    return response()->json([
      'period' => $period,
      'interval' => $interval,
      'data' => array_values($timeline),
    ]);
  }

  /**
   * Create or update a detection rule.
   * 
   * POST /api/siem/rules
   */
  public function saveRule(Request $request): JsonResponse
  {
    $request->validate([
      'id' => 'required|string|max:50',
      'name' => 'required|string|max:255',
      'pattern' => 'required|string',
      'severity' => 'required|in:LOW,MEDIUM,HIGH,CRITICAL',
      'description' => 'required|string',
      'threshold' => 'nullable|integer|min:1',
      'time_window' => 'nullable|integer|min:1',
    ]);

    $result = $this->siemService->saveRule($request->all());

    if (!$result) {
      return response()->json([
        'error' => 'Failed to save rule',
        'message' => 'The SIEM service could not save the detection rule.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Rule saved successfully',
      'rule' => $result,
    ]);
  }

  /**
   * Delete a detection rule.
   * 
   * DELETE /api/siem/rules/{ruleId}
   */
  public function deleteRule(string $ruleId): JsonResponse
  {
    $success = $this->siemService->deleteRule($ruleId);

    if (!$success) {
      return response()->json([
        'error' => 'Failed to delete rule',
        'message' => 'The SIEM service could not delete the detection rule.',
      ], 500);
    }

    return response()->json([
      'success' => true,
      'message' => 'Rule deleted successfully',
    ]);
  }

  /**
   * Delete an alert.
   * 
   * DELETE /api/siem/alerts/{id}
   */
  public function deleteAlert(int $id): JsonResponse
  {
    $alert = SiemAlert::find($id);

    if (!$alert) {
      return response()->json(['error' => 'Alert not found'], 404);
    }

    $alert->delete();

    return response()->json([
      'success' => true,
      'message' => 'Alert deleted successfully',
    ]);
  }

  /**
   * Bulk delete alerts.
   * 
   * DELETE /api/siem/alerts/bulk
   */
  public function deleteAlertsBulk(Request $request): JsonResponse
  {
    $request->validate([
      'alert_ids' => 'required|array',
      'alert_ids.*' => 'integer|exists:siem_alerts,id',
    ]);

    $alertIds = $request->input('alert_ids');
    $count = SiemAlert::whereIn('id', $alertIds)->delete();

    return response()->json([
      'success' => true,
      'message' => "{$count} alerts deleted successfully",
      'count' => $count,
    ]);
  }

  /**
   * Export alerts as CSV.
   * 
   * GET /api/siem/alerts/export
   */
  public function exportAlerts(Request $request): Response
  {
    $query = SiemAlert::query();

    // Apply same filters as localAlerts
    if ($request->has('severity')) {
      $query->where('severity', strtoupper($request->input('severity')));
    }
    if ($request->has('acknowledged')) {
      $query->where('acknowledged', $request->boolean('acknowledged'));
    }
    if ($request->has('from')) {
      $query->where('alert_timestamp', '>=', $request->input('from'));
    }
    if ($request->has('to')) {
      $query->where('alert_timestamp', '<=', $request->input('to'));
    }

    $alerts = $query->orderBy('alert_timestamp', 'desc')->get();

    $csv = "ID,SIEM Alert ID,Rule ID,Rule Name,Severity,Description,Source,Log Entry,TIP Label,TIP Confidence,Acknowledged,Alert Timestamp,Created At\n";

    foreach ($alerts as $alert) {
      $csv .= sprintf(
        "%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
        $alert->id,
        $this->escapeCsv($alert->siem_alert_id),
        $this->escapeCsv($alert->rule_id),
        $this->escapeCsv($alert->rule_name),
        $alert->severity,
        $this->escapeCsv($alert->description),
        $this->escapeCsv($alert->source),
        $this->escapeCsv(substr($alert->log_entry, 0, 500)),
        $this->escapeCsv($alert->tip_label),
        $alert->tip_confidence,
        $alert->acknowledged ? 'Yes' : 'No',
        $alert->alert_timestamp,
        $alert->created_at
      );
    }

    return response($csv, 200, [
      'Content-Type' => 'text/csv',
      'Content-Disposition' => 'attachment; filename="siem_alerts_' . now()->format('Y-m-d_H-i-s') . '.csv"',
    ]);
  }

  /**
   * Escape a value for CSV output.
   */
  private function escapeCsv(?string $value): string
  {
    if ($value === null) {
      return '';
    }
    // Escape quotes and wrap in quotes if contains special chars
    if (str_contains($value, ',') || str_contains($value, '"') || str_contains($value, "\n")) {
      return '"' . str_replace('"', '""', $value) . '"';
    }
    return $value;
  }
}
