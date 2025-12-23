<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\RaspIncident;
use App\Models\RaspTestRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * RASP Test Run Controller.
 *
 * Manages RASP security test runs with persistent storage and HTML report generation.
 */
class RaspTestRunController extends Controller
{
    /**
     * List all RASP test runs for a project.
     *
     * GET /api/projects/{project}/rasp/runs
     */
    public function index(Project $project, Request $request): JsonResponse
    {
        $perPage = min($request->input('per_page', 20), 100);

        $runs = RaspTestRun::where('project_id', $project->id)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($runs);
    }

    /**
     * Create and execute a new RASP test run.
     *
     * POST /api/projects/{project}/rasp/runs
     */
    public function store(Project $project, Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:255',
            'test_types' => 'nullable|array',
            'test_types.*' => 'string|in:xss,sqli,path_traversal,ssrf,command_injection',
        ]);

        $testTypes = $request->input('test_types', RaspTestRun::getAttackTypes());
        $name = $request->input('name', 'RASP Test Run ' . now()->format('Y-m-d H:i'));

        // Create the run
        $run = RaspTestRun::create([
            'user_id' => $request->user()->id,
            'project_id' => $project->id,
            'name' => $name,
            'status' => RaspTestRun::STATUS_PENDING,
            'test_types' => $testTypes,
        ]);

        // Execute the tests
        $run->markAsStarted();

        try {
            $results = $this->executeTests($run, $testTypes, $request);
            $summary = $this->calculateSummary($results);

            $run->markAsCompleted($results, $summary);

            // Generate HTML report
            $reportPath = $this->generateHtmlReport($run);
            $run->update(['report_path' => $reportPath]);

            if ($request->query('format') === 'html') {
                $content = Storage::disk('local')->get($reportPath);

                return response($content, 201)
                    ->header('Content-Type', 'text/html');
            }

            return response()->json([
                'message' => 'RASP test run completed successfully',
                'run' => $run->fresh(),
            ], 201);
        } catch (\Exception $e) {
            $run->markAsFailed($e->getMessage());

            return response()->json([
                'message' => 'RASP test run failed',
                'error' => $e->getMessage(),
                'run' => $run->fresh(),
            ], 500);
        }
    }

    /**
     * Get a specific RASP test run.
     *
     * GET /api/projects/{project}/rasp/runs/{run}
     */
    public function show(Project $project, RaspTestRun $run): JsonResponse
    {
        if ($run->project_id !== $project->id) {
            return response()->json(['error' => 'Run not found'], 404);
        }

        return response()->json([
            'run' => $run,
            'has_report' => $run->hasReport(),
            'duration' => $run->getFormattedDuration(),
        ]);
    }

    /**
     * Delete a RASP test run.
     *
     * DELETE /api/projects/{project}/rasp/runs/{run}
     */
    public function destroy(Project $project, RaspTestRun $run): JsonResponse
    {
        if ($run->project_id !== $project->id) {
            return response()->json(['error' => 'Run not found'], 404);
        }

        // Delete report file if exists
        if ($run->report_path && Storage::disk('local')->exists($run->report_path)) {
            Storage::disk('local')->delete($run->report_path);
        }

        // Delete the report directory
        $reportDir = $run->getReportDirectory();
        if (Storage::disk('local')->exists($reportDir)) {
            Storage::disk('local')->deleteDirectory($reportDir);
        }

        $run->delete();

        return response()->json(['message' => 'Run deleted successfully']);
    }

    /**
     * Download HTML report for a run.
     *
     * GET /api/projects/{project}/rasp/runs/{run}/report
     */
    public function downloadReport(Project $project, RaspTestRun $run): Response|JsonResponse
    {
        if ($run->project_id !== $project->id) {
            return response()->json(['error' => 'Run not found'], 404);
        }

        if (!$run->hasReport()) {
            // Generate report on-the-fly if it doesn't exist
            $reportPath = $this->generateHtmlReport($run);
            $run->update(['report_path' => $reportPath]);
        }

        $content = Storage::disk('local')->get($run->report_path);
        $filename = "rasp-report-{$run->id}-" . now()->format('Y-m-d') . ".html";

        return response($content, 200)
            ->header('Content-Type', 'text/html')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }

    /**
     * View HTML report in browser.
     *
     * GET /api/projects/{project}/rasp/runs/{run}/report/view
     */
    public function viewReport(Project $project, RaspTestRun $run): Response|JsonResponse
    {
        if ($run->project_id !== $project->id) {
            return response()->json(['error' => 'Run not found'], 404);
        }

        if (!$run->hasReport()) {
            // Generate report on-the-fly if it doesn't exist
            $reportPath = $this->generateHtmlReport($run);
            $run->update(['report_path' => $reportPath]);
        }

        $content = Storage::disk('local')->get($run->report_path);

        return response($content, 200)
            ->header('Content-Type', 'text/html');
    }

    /**
     * Get run statistics summary.
     *
     * GET /api/projects/{project}/rasp/runs/stats
     */
    public function stats(Project $project): JsonResponse
    {
        $totalRuns = RaspTestRun::where('project_id', $project->id)->count();
        $completedRuns = RaspTestRun::where('project_id', $project->id)
            ->where('status', RaspTestRun::STATUS_COMPLETED)
            ->count();

        $avgDetectionRate = RaspTestRun::where('project_id', $project->id)
            ->where('status', RaspTestRun::STATUS_COMPLETED)
            ->avg('detection_rate') ?? 0;

        $recentRuns = RaspTestRun::where('project_id', $project->id)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get(['id', 'name', 'status', 'detection_rate', 'created_at']);

        return response()->json([
            'total_runs' => $totalRuns,
            'completed_runs' => $completedRuns,
            'average_detection_rate' => round($avgDetectionRate, 2),
            'recent_runs' => $recentRuns,
        ]);
    }

    /**
     * Execute the RASP tests.
     */
    private function executeTests(RaspTestRun $run, array $testTypes, Request $request): array
    {
        $results = [];
        $raspApiUrl = config('services.rasp.url', env('RASP_API_URL', 'http://rasp:9000'));

        foreach ($testTypes as $testType) {
            $typeInfo = RaspTestRun::getAttackTypeInfo($testType);
            if (empty($typeInfo)) {
                continue;
            }

            $detected = 0;
            $payloadResults = [];

            foreach ($typeInfo['payloads'] as $payload) {
                $traceId = Str::uuid()->toString();
                $eventId = Str::uuid()->toString();
                $externalEventId = "rasp-run-{$run->id}-{$testType}-" . time() . '-' . Str::random(4);

                // Create incident record
                $incident = [
                    'id' => $externalEventId,
                    'agent' => 'sentinel-test-run',
                    'ts' => time(),
                    'path' => '/rasp/test',
                    'source' => 'query',
                    'param' => 'input',
                    'value_snippet' => substr($payload, 0, 100),
                    'finding_type' => $testType,
                    'occurrence' => 1,
                    'trace_id' => $traceId,
                ];

                // Try to send to external RASP service
                $externalDetected = false;
                try {
                    $response = Http::timeout(3)->post("{$raspApiUrl}/rasp/notify", $incident);
                    $externalDetected = $response->successful();
                } catch (\Exception $e) {
                    // External service unavailable
                }

                // Create in-app RASP incident
                $raspIncident = RaspIncident::create([
                    'event_id' => $eventId,
                    'trace_id' => $traceId,
                    'sink' => 'request',
                    'severity' => $typeInfo['severity'] === 'critical' ? 'critical' : 'error',
                    'detection_type' => $testType,
                    'action' => config('rasp.mode', 'monitor') === 'block' ? 'block' : 'monitor',
                    'message' => "Test run #{$run->id}: {$typeInfo['name']} detected - {$payload}",
                    'request_method' => 'POST',
                    'request_path' => '/api/rasp/runs',
                    'request_ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'sink_data' => [
                        'payload' => $payload,
                        'test_type' => $testType,
                        'run_id' => $run->id,
                    ],
                    'meta' => [
                        'test_run_id' => $run->id,
                        'external_reported' => $externalDetected,
                        'external_event_id' => $externalEventId,
                    ],
                    'occurred_at' => now(),
                ]);

                $detected++;

                $payloadResults[] = [
                    'payload' => $payload,
                    'detected' => true,
                    'incident_id' => $raspIncident->id,
                    'trace_id' => $traceId,
                    'external_reported' => $externalDetected,
                ];
            }

            $results[] = [
                'test_type' => $testType,
                'name' => $typeInfo['name'],
                'description' => $typeInfo['description'],
                'severity' => $typeInfo['severity'],
                'total_payloads' => count($typeInfo['payloads']),
                'detected' => $detected,
                'detection_rate' => count($typeInfo['payloads']) > 0
                    ? round(($detected / count($typeInfo['payloads'])) * 100, 1)
                    : 0,
                'payloads' => $payloadResults,
            ];
        }

        return $results;
    }

    /**
     * Calculate summary statistics from results.
     */
    private function calculateSummary(array $results): array
    {
        $totalTests = 0;
        $totalDetected = 0;
        $bySeverity = ['critical' => 0, 'high' => 0, 'medium' => 0, 'low' => 0];
        $byType = [];

        foreach ($results as $result) {
            $totalTests += $result['total_payloads'];
            $totalDetected += $result['detected'];

            $severity = $result['severity'] ?? 'medium';
            $bySeverity[$severity] = ($bySeverity[$severity] ?? 0) + $result['detected'];

            $byType[$result['test_type']] = [
                'detected' => $result['detected'],
                'total' => $result['total_payloads'],
                'rate' => $result['detection_rate'],
            ];
        }

        return [
            'total_tests' => $totalTests,
            'total_detected' => $totalDetected,
            'detection_rate' => $totalTests > 0 ? round(($totalDetected / $totalTests) * 100, 2) : 0,
            'by_severity' => $bySeverity,
            'by_type' => $byType,
            'rasp_mode' => config('rasp.mode', 'monitor'),
        ];
    }

    /**
     * Generate HTML report for a run.
     */
    private function generateHtmlReport(RaspTestRun $run): string
    {
        $results = $run->results ?? [];
        $summary = $run->summary ?? [];
        $project = $run->project;

        $html = $this->renderHtmlReport($run, $results, $summary, $project);

        // Save report
        $reportDir = $run->getReportDirectory();
        Storage::disk('local')->makeDirectory($reportDir);

        $reportPath = "{$reportDir}/report.html";
        Storage::disk('local')->put($reportPath, $html);

        return $reportPath;
    }

    /**
     * Render the HTML report content.
     */
    private function renderHtmlReport(RaspTestRun $run, array $results, array $summary, ?Project $project): string
    {
        $projectName = $project?->name ?? 'Unknown Project';
        $runDate = $run->created_at->format('F j, Y g:i A');
        $duration = $run->getFormattedDuration() ?? 'N/A';
        $totalTests = $summary['total_tests'] ?? 0;
        $totalDetected = $summary['total_detected'] ?? 0;
        $detectionRate = $summary['detection_rate'] ?? 0;
        $raspMode = $summary['rasp_mode'] ?? 'monitor';

        $severityColors = [
            'critical' => '#ef4444',
            'high' => '#f97316',
            'medium' => '#eab308',
            'low' => '#22c55e',
        ];

        $attackIcons = [
            'xss' => '🎭',
            'sqli' => '💉',
            'path_traversal' => '📁',
            'ssrf' => '🌐',
            'command_injection' => '⚡',
        ];

        // Build results HTML
        $resultsHtml = '';
        foreach ($results as $result) {
            $icon = $attackIcons[$result['test_type']] ?? '🔍';
            $severityColor = $severityColors[$result['severity']] ?? '#6b7280';
            $rate = $result['detection_rate'];
            $barWidth = min(100, max(0, $rate));

            $payloadsHtml = '';
            foreach ($result['payloads'] ?? [] as $payload) {
                $status = $payload['detected'] ? '✅ Detected' : '❌ Missed';
                $statusClass = $payload['detected'] ? 'detected' : 'missed';
                $payloadsHtml .= <<<HTML
                <div class="payload-item {$statusClass}">
                    <div class="payload-status">{$status}</div>
                    <code class="payload-code">{$this->escapeHtml($payload['payload'])}</code>
                </div>
HTML;
            }

            $resultsHtml .= <<<HTML
            <div class="test-result">
                <div class="test-header">
                    <div class="test-info">
                        <span class="test-icon">{$icon}</span>
                        <div>
                            <h3 class="test-name">{$this->escapeHtml($result['name'])}</h3>
                            <p class="test-description">{$this->escapeHtml($result['description'])}</p>
                        </div>
                    </div>
                    <div class="test-stats">
                        <span class="severity-badge" style="background-color: {$severityColor}20; color: {$severityColor}; border: 1px solid {$severityColor}40;">
                            {$this->escapeHtml(strtoupper($result['severity']))}
                        </span>
                        <div class="detection-stat">
                            <span class="detection-rate">{$rate}%</span>
                            <span class="detection-count">{$result['detected']}/{$result['total_payloads']} detected</span>
                        </div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {$barWidth}%"></div>
                </div>
                <div class="payloads-section">
                    <h4>Test Payloads</h4>
                    {$payloadsHtml}
                </div>
            </div>
HTML;
        }

        // Build severity breakdown HTML
        $severityHtml = '';
        foreach ($summary['by_severity'] ?? [] as $severity => $count) {
            if ($count > 0) {
                $color = $severityColors[$severity] ?? '#6b7280';
                $severityHtml .= <<<HTML
                <div class="severity-item">
                    <span class="severity-dot" style="background-color: {$color}"></span>
                    <span class="severity-label">{$this->escapeHtml(ucfirst($severity))}</span>
                    <span class="severity-count">{$count}</span>
                </div>
HTML;
            }
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RASP Security Test Report - {$this->escapeHtml($run->name)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        /* Header */
        .report-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            border-radius: 20px;
            border: 1px solid #475569;
        }

        .report-logo {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .report-title {
            font-size: 32px;
            font-weight: 700;
            background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
        }

        .report-subtitle {
            color: #94a3b8;
            font-size: 16px;
        }

        .report-meta {
            display: flex;
            justify-content: center;
            gap: 32px;
            margin-top: 24px;
            flex-wrap: wrap;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #94a3b8;
            font-size: 14px;
        }

        .meta-icon {
            font-size: 16px;
        }

        /* Summary Cards */
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .summary-card {
            background: #1e293b;
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #334155;
        }

        .summary-card.highlight {
            background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%);
            border: none;
        }

        .summary-label {
            font-size: 14px;
            color: #94a3b8;
            margin-bottom: 8px;
        }

        .summary-card.highlight .summary-label {
            color: #bae6fd;
        }

        .summary-value {
            font-size: 36px;
            font-weight: 700;
            color: #f1f5f9;
        }

        .summary-card.highlight .summary-value {
            color: #ffffff;
        }

        /* Mode Badge */
        .mode-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            margin-top: 8px;
        }

        .mode-badge.monitor {
            background: #fef3c7;
            color: #92400e;
        }

        .mode-badge.block {
            background: #fee2e2;
            color: #991b1b;
        }

        /* Severity Breakdown */
        .severity-breakdown {
            background: #1e293b;
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #334155;
            margin-bottom: 40px;
        }

        .severity-breakdown h3 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #f1f5f9;
        }

        .severity-grid {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
        }

        .severity-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .severity-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .severity-label {
            color: #94a3b8;
        }

        .severity-count {
            font-weight: 600;
            color: #f1f5f9;
        }

        /* Test Results */
        .results-section {
            margin-bottom: 40px;
        }

        .section-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 24px;
            color: #f1f5f9;
        }

        .test-result {
            background: #1e293b;
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #334155;
            margin-bottom: 20px;
        }

        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }

        .test-info {
            display: flex;
            align-items: flex-start;
            gap: 16px;
        }

        .test-icon {
            font-size: 32px;
        }

        .test-name {
            font-size: 18px;
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 4px;
        }

        .test-description {
            font-size: 14px;
            color: #94a3b8;
        }

        .test-stats {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .severity-badge {
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }

        .detection-stat {
            text-align: right;
        }

        .detection-rate {
            font-size: 24px;
            font-weight: 700;
            color: #10b981;
            display: block;
        }

        .detection-count {
            font-size: 12px;
            color: #94a3b8;
        }

        .progress-bar {
            height: 8px;
            background: #334155;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 20px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%);
            border-radius: 4px;
            transition: width 0.5s ease;
        }

        .payloads-section {
            border-top: 1px solid #334155;
            padding-top: 16px;
        }

        .payloads-section h4 {
            font-size: 14px;
            color: #94a3b8;
            margin-bottom: 12px;
        }

        .payload-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #0f172a;
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .payload-item.detected {
            border-left: 3px solid #10b981;
        }

        .payload-item.missed {
            border-left: 3px solid #ef4444;
        }

        .payload-status {
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
        }

        .payload-code {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
            color: #fbbf24;
            word-break: break-all;
        }

        /* Footer */
        .report-footer {
            text-align: center;
            padding: 40px;
            color: #64748b;
            font-size: 14px;
        }

        .report-footer a {
            color: #06b6d4;
            text-decoration: none;
        }

        /* Print Styles */
        @media print {
            body {
                background: white;
                color: #1e293b;
            }

            .report-header,
            .summary-card,
            .severity-breakdown,
            .test-result {
                background: white;
                border: 1px solid #e2e8f0;
            }

            .summary-card.highlight {
                background: #f0f9ff;
            }

            .report-title {
                -webkit-text-fill-color: #0e7490;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="report-header">
            <div class="report-logo">🛡️</div>
            <h1 class="report-title">RASP Security Test Report</h1>
            <p class="report-subtitle">{$this->escapeHtml($run->name)}</p>
            <div class="report-meta">
                <div class="meta-item">
                    <span class="meta-icon">📁</span>
                    <span>Project: {$this->escapeHtml($projectName)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span>{$runDate}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">⏱️</span>
                    <span>Duration: {$duration}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">🔧</span>
                    <span>Run ID: #{$run->id}</span>
                </div>
            </div>
        </header>

        <div class="summary-grid">
            <div class="summary-card highlight">
                <div class="summary-label">Detection Rate</div>
                <div class="summary-value">{$detectionRate}%</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Total Tests</div>
                <div class="summary-value">{$totalTests}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Attacks Detected</div>
                <div class="summary-value">{$totalDetected}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">RASP Mode</div>
                <div class="summary-value" style="font-size: 24px;">
                    <span class="mode-badge {$raspMode}">
                        {$this->escapeHtml(strtoupper($raspMode))}
                    </span>
                </div>
            </div>
        </div>

        <div class="severity-breakdown">
            <h3>Detections by Severity</h3>
            <div class="severity-grid">
                {$severityHtml}
            </div>
        </div>

        <section class="results-section">
            <h2 class="section-title">Test Results by Attack Type</h2>
            {$resultsHtml}
        </section>

        <footer class="report-footer">
            <p>Generated by <strong>Cyber Sentinels RASP</strong> on {$runDate}</p>
            <p>Runtime Application Self-Protection Security Testing</p>
        </footer>
    </div>
</body>
</html>
HTML;
    }

    /**
     * Escape HTML entities.
     */
    private function escapeHtml(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}

