<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RunController;
use App\Http\Controllers\Api\RunStreamController;
use App\Http\Controllers\Api\SastController;
use App\Http\Controllers\Api\SiemController;
use App\Http\Controllers\Api\WafProxyController;
use App\Http\Controllers\Api\WafLogController;
use App\Http\Controllers\RaspIncidentController;
use App\Http\Controllers\RaspDemoController;
use App\Http\Controllers\RaspTestRunController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group.
|
*/

// Health check
Route::get('/health', function () {
  return response()->json([
    'status' => 'ok',
    'timestamp' => now()->toIso8601String(),
  ]);
});

// Auth routes (public)
Route::prefix('auth')->group(function () {
  Route::post('/register', [AuthController::class, 'register']);
  Route::post('/login', [AuthController::class, 'login']);
  Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
  Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
  // Current user shorthand
  Route::get('/me', [AuthController::class, 'user']);

  // Auth
  Route::prefix('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
  });

  // Projects
  Route::apiResource('projects', ProjectController::class);

  // Runs (nested under projects)
  Route::prefix('projects/{project}')->group(function () {
    Route::get('/runs', [RunController::class, 'index']);
    Route::post('/runs', [RunController::class, 'store']);
    Route::get('/runs/{run}', [RunController::class, 'show']);
    Route::get('/runs/{run}/tasks', [RunController::class, 'tasks']);
    Route::post('/runs/{run}/cancel', [RunController::class, 'cancel']);

    // Reports
    Route::get('/runs/{run}/summary', [ReportController::class, 'summary']);
    Route::get('/runs/{run}/findings', [ReportController::class, 'findings']);
    Route::get('/runs/{run}/report', [ReportController::class, 'runReport']);
    Route::get('/runs/{run}/tasks/{task}/report', [ReportController::class, 'taskReport']);
    Route::get('/runs/{run}/tasks/{task}/download', [ReportController::class, 'download']);
    Route::get('/runs/{run}/tasks/{task}/download-html', [ReportController::class, 'downloadHtml']);
    Route::get('/runs/{run}/tasks/{task}/logs', [ReportController::class, 'logs']);
    Route::get('/runs/{run}/tasks/{task}/download-logs', [ReportController::class, 'downloadLogs']);

    // SSE log streaming
    Route::get('/runs/{run}/stream', [RunStreamController::class, 'stream']);

    // WAF Proxy routes
    Route::prefix('waf')->group(function () {
      Route::get('/proxies', [WafProxyController::class, 'index']);
      Route::post('/proxies', [WafProxyController::class, 'store']);
      Route::get('/proxies/{proxy}', [WafProxyController::class, 'show']);
      Route::put('/proxies/{proxy}', [WafProxyController::class, 'update']);
      Route::delete('/proxies/{proxy}', [WafProxyController::class, 'destroy']);
      Route::post('/proxies/{proxy}/rotate-token', [WafProxyController::class, 'rotateToken']);
      Route::post('/proxies/{proxy}/pause', [WafProxyController::class, 'pause']);
      Route::post('/proxies/{proxy}/activate', [WafProxyController::class, 'activate']);
      Route::post('/proxies/{proxy}/reset-counters', [WafProxyController::class, 'resetCounters']);
      Route::get('/stats', [WafProxyController::class, 'stats']);
      Route::get('/logs', [WafLogController::class, 'index']);
      Route::get('/logs/summary', [WafLogController::class, 'summary']);
    });

    // SAST routes
    Route::prefix('sast')->group(function () {
      Route::get('/health', [SastController::class, 'health']);
      Route::get('/rules', [SastController::class, 'rules']);
      Route::get('/runs', [SastController::class, 'listRuns']);
      Route::post('/runs', [SastController::class, 'startScan']);
      Route::get('/runs/{run}', [SastController::class, 'getRunStatus']);
      Route::get('/runs/{run}/findings', [SastController::class, 'getFindings']);
      Route::get('/runs/{run}/download', [SastController::class, 'downloadReport']);
      Route::get('/runs/{run}/download-html', [SastController::class, 'downloadHtmlReport']);
      Route::get('/runs/{run}/download-pdf', [SastController::class, 'downloadPdfReport']);
    });

    // RASP Test Runs (project-scoped with history and reports)
    Route::prefix('rasp')->group(function () {
      Route::get('/runs', [RaspTestRunController::class, 'index']);
      Route::post('/runs', [RaspTestRunController::class, 'store']);
      Route::get('/runs/stats', [RaspTestRunController::class, 'stats']);
      Route::get('/runs/{run}', [RaspTestRunController::class, 'show']);
      Route::delete('/runs/{run}', [RaspTestRunController::class, 'destroy']);
      Route::get('/runs/{run}/report', [RaspTestRunController::class, 'downloadReport']);
      Route::get('/runs/{run}/report/view', [RaspTestRunController::class, 'viewReport']);
    });
  });

  // RASP routes (global, not project-scoped)
  Route::prefix('rasp')->group(function () {
    Route::get('/incidents', [RaspIncidentController::class, 'index']);
    Route::get('/incidents/{id}', [RaspIncidentController::class, 'show']);
    Route::get('/traces/{traceId}', [RaspIncidentController::class, 'trace']);
    Route::get('/stats', [RaspIncidentController::class, 'stats']);
    Route::get('/detections', [RaspIncidentController::class, 'detections']);
    Route::get('/alerts', [RaspIncidentController::class, 'alerts']);

    // RASP Demo routes for live testing
    Route::prefix('demo')->group(function () {
      Route::get('/health', [RaspDemoController::class, 'health']);
      Route::post('/run-tests', [RaspDemoController::class, 'runTests']);
      Route::post('/simulate', [RaspDemoController::class, 'simulate']);
      Route::get('/results', [RaspDemoController::class, 'results']);
      Route::delete('/clear', [RaspDemoController::class, 'clear']);
    });
  });

  // SIEM routes (global, not project-scoped)
  Route::prefix('siem')->group(function () {
    // Health and status
    Route::get('/health', [SiemController::class, 'health']);
    Route::get('/stats', [SiemController::class, 'stats']);

    // Detection rules
    Route::get('/rules', [SiemController::class, 'rules']);
    Route::post('/rules', [SiemController::class, 'saveRule']);
    Route::delete('/rules/{ruleId}', [SiemController::class, 'deleteRule']);

    // Alerts from SIEM container
    Route::get('/alerts', [SiemController::class, 'alerts']);

    // Local alerts (stored in database)
    Route::get('/alerts/local', [SiemController::class, 'localAlerts']);
    Route::get('/alerts/distribution', [SiemController::class, 'alertDistribution']);
    Route::get('/alerts/timeline', [SiemController::class, 'alertTimeline']);
    Route::get('/alerts/export', [SiemController::class, 'exportAlerts']);
    Route::get('/alerts/{id}', [SiemController::class, 'showAlert']);
    Route::post('/alerts/{id}/acknowledge', [SiemController::class, 'acknowledgeAlert']);
    Route::post('/alerts/acknowledge-bulk', [SiemController::class, 'acknowledgeAlertsBulk']);
    Route::delete('/alerts/{id}', [SiemController::class, 'deleteAlert']);
    Route::delete('/alerts/bulk', [SiemController::class, 'deleteAlertsBulk']);

    // Logs
    Route::get('/logs', [SiemController::class, 'logs']);

    // Log analysis
    Route::post('/upload', [SiemController::class, 'upload']);
    Route::post('/analyze', [SiemController::class, 'analyze']);
    Route::post('/ingest', [SiemController::class, 'ingest']);
    Route::post('/ingest/batch', [SiemController::class, 'ingestBatch']);

    // Reports
    Route::get('/reports/latest', [SiemController::class, 'getLatestReport']);
    Route::get('/reports/{reportName}', [SiemController::class, 'getReport']);
  });
});
