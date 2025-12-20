<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Run;
use App\Models\RunTask;
use App\Services\SastService;
use App\Services\ArtifactStorageService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SastController extends Controller
{
  protected SastService $sastService;
  protected ArtifactStorageService $artifactStorage;

  public function __construct(SastService $sastService, ArtifactStorageService $artifactStorage)
  {
    $this->sastService = $sastService;
    $this->artifactStorage = $artifactStorage;
  }

  /**
   * Check SAST service health.
   */
  public function health(): JsonResponse
  {
    $available = $this->sastService->isAvailable();

    return response()->json([
      'available' => $available,
      'service' => 'sast',
      'url' => config('services.sast.url', 'http://sast:8080'),
    ], $available ? 200 : 503);
  }

  /**
   * Get available SAST rules.
   */
  public function rules(): JsonResponse
  {
    $rules = $this->sastService->getRules();
    return response()->json($rules);
  }

  /**
   * Start a new SAST scan.
   *
   * POST /api/projects/{project}/sast/runs
   *
   * Body (multipart/form-data):
   *   - source_type: 'zip' or 'path'
   *   - source_file: ZIP file (if source_type is 'zip')
   *   - source_path: Path string (if source_type is 'path')
   *   - output_format: 'json' or 'html' (default: 'json')
   */
  public function startScan(Request $request, Project $project): JsonResponse
  {
    // Authorization check
    if ($project->user_id !== Auth::id()) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    // Validate request
    $request->validate([
      'source_type' => 'required|in:zip,path',
      'source_file' => 'required_if:source_type,zip|file|mimes:zip|max:102400', // 100MB max
      'source_path' => 'required_if:source_type,path|string',
      'output_format' => 'nullable|in:json,html',
    ]);

    $sourceType = $request->input('source_type');
    $outputFormat = $request->input('output_format', 'json');

    // Check SAST service availability
    if (!$this->sastService->isAvailable()) {
      return response()->json([
        'error' => 'SAST service is unavailable',
        'message' => 'The SAST scanner service is not responding. Please try again later.',
      ], 503);
    }

    // Create a Run record
    $run = Run::create([
      'user_id' => Auth::id(),
      'project_id' => $project->id,
      'module' => Run::MODULE_WEB_SECURITY,
      'target_type' => 'source_code',
      'target_value' => $sourceType === 'zip'
        ? $request->file('source_file')->getClientOriginalName()
        : $request->input('source_path'),
      'status' => Run::STATUS_PENDING,
    ]);

    // Create a RunTask for SAST
    $task = RunTask::create([
      'run_id' => $run->id,
      'tool' => RunTask::TOOL_SAST,
      'status' => RunTask::STATUS_PENDING,
      'progress' => 0,
      'meta_json' => [
        'source_type' => $sourceType,
        'output_format' => $outputFormat,
      ],
    ]);

    // Start the scan based on source type
    $scanResult = null;

    if ($sourceType === 'zip') {
      $this->sastService->log($task, 'INFO', 'Starting SAST scan from uploaded ZIP file');
      $scanResult = $this->sastService->startScanFromZip(
        $request->file('source_file'),
        $outputFormat
      );
    } else {
      $this->sastService->log($task, 'INFO', "Starting SAST scan from path: {$request->input('source_path')}");
      $scanResult = $this->sastService->startScanFromPath(
        $request->input('source_path'),
        $outputFormat
      );
    }

    if (!$scanResult || !isset($scanResult['scan_id'])) {
      $task->markAsFailed('Failed to start SAST scan');
      $run->markAsFailed();

      return response()->json([
        'error' => 'Failed to start SAST scan',
        'message' => 'The SAST service could not initiate the scan.',
      ], 500);
    }

    // Store the SAST scan_id in task metadata
    $task->update([
      'status' => RunTask::STATUS_RUNNING,
      'meta_json' => array_merge($task->meta_json ?? [], [
        'sast_scan_id' => $scanResult['scan_id'],
      ]),
    ]);

    $run->markAsStarted();

    $this->sastService->log($task, 'INFO', "SAST scan started with ID: {$scanResult['scan_id']}");

    return response()->json([
      'message' => 'SAST scan started successfully',
      'run_id' => $run->id,
      'task_id' => $task->id,
      'sast_scan_id' => $scanResult['scan_id'],
      'status' => $scanResult['status'] ?? 'pending',
    ], 202);
  }

  /**
   * Get the status of a SAST scan run.
   *
   * GET /api/projects/{project}/sast/runs/{run}
   */
  public function getRunStatus(Project $project, Run $run): JsonResponse
  {
    // Authorization check
    if ($project->user_id !== Auth::id() || $run->project_id !== $project->id) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    // Find the SAST task
    $task = $run->tasks()->where('tool', RunTask::TOOL_SAST)->first();

    if (!$task) {
      return response()->json(['error' => 'SAST task not found'], 404);
    }

    $sastScanId = $task->meta_json['sast_scan_id'] ?? null;

    // If we have a SAST scan ID and task is still running, poll the SAST service
    if ($sastScanId && $task->status === RunTask::STATUS_RUNNING) {
      $scanStatus = $this->sastService->getScanStatus($sastScanId);

      if ($scanStatus) {
        $newTaskStatus = $this->sastService->mapStatusToTaskStatus($scanStatus['status']);

        // Update task if status changed
        if ($newTaskStatus !== $task->status) {
          if ($newTaskStatus === RunTask::STATUS_COMPLETED) {
            // Download and store the report
            $reportPath = $this->sastService->downloadAndStoreReport($task, $sastScanId);

            // Also fetch and store findings
            $findings = $this->sastService->getScanFindings($sastScanId);
            if ($findings) {
              $this->sastService->storeFindings($task, $findings);
            }

            $this->sastService->log($task, 'INFO', 'SAST scan completed successfully');
            $task->markAsCompleted($reportPath);
            $run->markAsCompleted();
          } elseif ($newTaskStatus === RunTask::STATUS_FAILED) {
            $error = $scanStatus['error'] ?? 'Unknown error';
            $this->sastService->log($task, 'ERROR', "SAST scan failed: {$error}");
            $task->markAsFailed($error);
            $run->markAsFailed();
          } else {
            $task->update(['status' => $newTaskStatus]);
          }
        }

        // Update progress if available
        if (isset($scanStatus['total_findings'])) {
          $task->update([
            'meta_json' => array_merge($task->meta_json ?? [], [
              'total_findings' => $scanStatus['total_findings'],
              'severity_counts' => $scanStatus['severity_counts'] ?? [],
            ]),
          ]);
        }
      }

      // Reload task after potential updates
      $task->refresh();
    }

    return response()->json([
      'run' => [
        'id' => $run->id,
        'status' => $run->status,
        'started_at' => $run->started_at?->toIso8601String(),
        'finished_at' => $run->finished_at?->toIso8601String(),
      ],
      'task' => [
        'id' => $task->id,
        'tool' => $task->tool,
        'status' => $task->status,
        'progress' => $task->progress,
        'meta' => $task->meta_json,
        'has_report' => $task->hasReport(),
        'has_logs' => $task->hasLogs(),
      ],
    ]);
  }

  /**
   * Get SAST findings for a run.
   *
   * GET /api/projects/{project}/sast/runs/{run}/findings
   */
  public function getFindings(Project $project, Run $run): JsonResponse
  {
    // Authorization check
    if ($project->user_id !== Auth::id() || $run->project_id !== $project->id) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    // Find the SAST task
    $task = $run->tasks()->where('tool', RunTask::TOOL_SAST)->first();

    if (!$task) {
      return response()->json(['error' => 'SAST task not found'], 404);
    }

    // Check for stored findings
    $findingsPath = $this->artifactStorage->getArtifactPath($task, 'findings.json');

    if ($this->artifactStorage->exists($findingsPath)) {
      $contents = $this->artifactStorage->read($findingsPath);
      return response()->json(json_decode($contents, true));
    }

    // If not stored but scan is completed, try to fetch from SAST service
    $sastScanId = $task->meta_json['sast_scan_id'] ?? null;
    if ($sastScanId && $task->status === RunTask::STATUS_COMPLETED) {
      $findings = $this->sastService->getScanFindings($sastScanId);
      if ($findings) {
        // Store for future requests
        $this->sastService->storeFindings($task, $findings);
        return response()->json($findings);
      }
    }

    return response()->json([
      'scan_info' => [
        'total_findings' => $task->meta_json['total_findings'] ?? 0,
        'severity_counts' => $task->meta_json['severity_counts'] ?? [],
      ],
      'findings' => [],
      'message' => $task->status === RunTask::STATUS_COMPLETED
        ? 'No findings available'
        : 'Scan not yet completed',
    ]);
  }

  /**
   * Download SAST report for a run (JSON format).
   *
   * GET /api/projects/{project}/sast/runs/{run}/download
   */
  public function downloadReport(Project $project, Run $run): BinaryFileResponse|JsonResponse
  {
    // Authorization check
    if ($project->user_id !== Auth::id() || $run->project_id !== $project->id) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    // Find the SAST task
    $task = $run->tasks()->where('tool', RunTask::TOOL_SAST)->first();

    if (!$task) {
      return response()->json(['error' => 'SAST task not found'], 404);
    }

    // First check if we have a stored JSON report
    $jsonReportPath = $this->artifactStorage->getArtifactPath($task, 'report.json');

    if ($this->artifactStorage->exists($jsonReportPath)) {
      $absolutePath = $this->artifactStorage->getAbsolutePath($jsonReportPath);
      return response()->download($absolutePath, "sast_report_{$run->id}.json", [
        'Content-Type' => 'application/json',
      ]);
    }

    // Check for findings.json which can be used as a JSON report
    $findingsPath = $this->artifactStorage->getArtifactPath($task, 'findings.json');

    if ($this->artifactStorage->exists($findingsPath)) {
      $absolutePath = $this->artifactStorage->getAbsolutePath($findingsPath);
      return response()->download($absolutePath, "sast_findings_{$run->id}.json", [
        'Content-Type' => 'application/json',
      ]);
    }

    // Fallback: if task has a report (might be HTML), return it
    if ($task->hasReport()) {
      $absolutePath = $task->getAbsoluteReportPath();
      $filename = basename($task->report_path);
      $contentType = str_ends_with($filename, '.html') ? 'text/html' : 'application/json';

      return response()->download($absolutePath, "sast_report_{$run->id}.{$this->getExtension($filename)}", [
        'Content-Type' => $contentType,
      ]);
    }

    return response()->json(['error' => 'JSON report not found'], 404);
  }

  /**
   * Download SAST report for a run (HTML format).
   *
   * GET /api/projects/{project}/sast/runs/{run}/download-html
   */
  public function downloadHtmlReport(Project $project, Run $run): BinaryFileResponse|JsonResponse|Response
  {
    // Authorization check
    if ($project->user_id !== Auth::id() || $run->project_id !== $project->id) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    // Find the SAST task
    $task = $run->tasks()->where('tool', RunTask::TOOL_SAST)->first();

    if (!$task) {
      return response()->json(['error' => 'SAST task not found'], 404);
    }

    // Check if we have a stored HTML report
    $htmlReportPath = $this->artifactStorage->getArtifactPath($task, 'report.html');

    if ($this->artifactStorage->exists($htmlReportPath)) {
      $absolutePath = $this->artifactStorage->getAbsolutePath($htmlReportPath);
      return response()->download($absolutePath, "sast_report_{$run->id}.html", [
        'Content-Type' => 'text/html',
      ]);
    }

    // Try to get findings from stored file or fetch from SAST service
    $findings = $this->getFindingsForTask($task);

    if ($findings && !empty($findings['findings'])) {
      $htmlContent = $this->generateHtmlReportFromFindings($findings, $run);

      // Store the generated HTML report for future requests
      $this->artifactStorage->storeReport($task, 'report.html', $htmlContent);

      // Return as inline response with proper headers
      return response($htmlContent, 200, [
        'Content-Type' => 'text/html',
        'Content-Disposition' => 'attachment; filename="sast_report_' . $run->id . '.html"',
      ]);
    }

    // Fallback: if task has a report that is HTML, return it
    if ($task->hasReport() && str_ends_with($task->report_path, '.html')) {
      $absolutePath = $task->getAbsoluteReportPath();
      return response()->download($absolutePath, "sast_report_{$run->id}.html", [
        'Content-Type' => 'text/html',
      ]);
    }

    return response()->json(['error' => 'HTML report not available. No findings data to generate report from.'], 404);
  }

  /**
   * Download SAST report for a run (PDF format).
   *
   * GET /api/projects/{project}/sast/runs/{run}/download-pdf
   */
  public function downloadPdfReport(Project $project, Run $run): Response|JsonResponse
  {
    // Authorization check
    if ($project->user_id !== Auth::id() || $run->project_id !== $project->id) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    // Find the SAST task
    $task = $run->tasks()->where('tool', RunTask::TOOL_SAST)->first();

    if (!$task) {
      return response()->json(['error' => 'SAST task not found'], 404);
    }

    // Check if we have a stored PDF report
    $pdfReportPath = $this->artifactStorage->getArtifactPath($task, 'report.pdf');

    if ($this->artifactStorage->exists($pdfReportPath)) {
      $absolutePath = $this->artifactStorage->getAbsolutePath($pdfReportPath);
      return response()->download($absolutePath, "sast_report_{$run->id}.pdf", [
        'Content-Type' => 'application/pdf',
      ]);
    }

    // Try to get findings from stored file or fetch from SAST service
    $findings = $this->getFindingsForTask($task);

    if ($findings && !empty($findings['findings'])) {
      $htmlContent = $this->generateHtmlReportFromFindings($findings, $run, true);

      // Generate PDF from HTML
      $pdf = Pdf::loadHTML($htmlContent);
      $pdf->setPaper('a4', 'portrait');

      $pdfContent = $pdf->output();

      // Store the generated PDF report for future requests
      $this->artifactStorage->storeReport($task, 'report.pdf', $pdfContent);

      return response($pdfContent, 200, [
        'Content-Type' => 'application/pdf',
        'Content-Disposition' => 'attachment; filename="sast_report_' . $run->id . '.pdf"',
      ]);
    }

    return response()->json(['error' => 'PDF report not available. No findings data to generate report from.'], 404);
  }

  /**
   * Get findings for a task from storage or SAST service.
   */
  private function getFindingsForTask(RunTask $task): ?array
  {
    // First check stored findings
    $findingsPath = $this->artifactStorage->getArtifactPath($task, 'findings.json');

    if ($this->artifactStorage->exists($findingsPath)) {
      $findingsContent = $this->artifactStorage->read($findingsPath);
      $findings = json_decode($findingsContent, true);
      if ($findings) {
        return $findings;
      }
    }

    // Try to fetch from SAST service if we have a scan ID
    $sastScanId = $task->meta_json['sast_scan_id'] ?? null;
    if ($sastScanId) {
      $findings = $this->sastService->getScanFindings($sastScanId);
      if ($findings) {
        // Store for future requests
        $this->sastService->storeFindings($task, $findings);
        return $findings;
      }
    }

    return null;
  }

  /**
   * Generate an HTML report from findings data.
   * 
   * @param array $findings The findings data
   * @param Run $run The run object
   * @param bool $forPdf Whether to generate PDF-friendly HTML (simpler layout)
   */
  private function generateHtmlReportFromFindings(array $findings, Run $run, bool $forPdf = false): string
  {
    $scanInfo = $findings['scan_info'] ?? [];
    $findingsList = $findings['findings'] ?? [];
    $totalFindings = $scanInfo['total_findings'] ?? count($findingsList);
    $severityCounts = $scanInfo['severity_counts'] ?? [];
    $targetValue = htmlspecialchars($run->target_value ?? 'Unknown');
    $createdAt = $run->created_at?->format('Y-m-d H:i:s') ?? 'Unknown';

    $severityColors = [
      'Critical' => '#dc2626',
      'High' => '#ea580c',
      'Medium' => '#ca8a04',
      'Low' => '#16a34a',
      'Info' => '#2563eb',
    ];

    $findingsHtml = '';
    foreach ($findingsList as $index => $finding) {
      $severity = htmlspecialchars($finding['severity'] ?? 'Unknown');
      $severityColor = $severityColors[$severity] ?? '#6b7280';
      $message = htmlspecialchars($finding['message'] ?? 'No message');
      $file = htmlspecialchars($finding['file'] ?? 'Unknown file');
      $line = htmlspecialchars((string)($finding['line_number'] ?? 'N/A'));
      $ruleId = htmlspecialchars($finding['rule_id'] ?? 'Unknown');
      $cwe = htmlspecialchars($finding['cwe'] ?? '');
      $codeSnippet = htmlspecialchars($finding['code_snippet'] ?? '');

      // For PDF, use simpler layout without flexbox
      if ($forPdf) {
        $findingsHtml .= '<div style="border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 12px; background: #fff; page-break-inside: avoid;">';
        $findingsHtml .= '<table style="width: 100%; margin-bottom: 8px;"><tr>';
        $findingsHtml .= '<td style="background: ' . $severityColor . '; color: white; padding: 4px 10px; font-size: 11px; font-weight: bold; width: auto;">' . $severity . '</td>';
        $findingsHtml .= '<td style="color: #6b7280; font-size: 11px; padding-left: 10px;">#' . ($index + 1) . ' | ' . $ruleId . '</td>';
        $findingsHtml .= '</tr></table>';
        $findingsHtml .= '<p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #111827;">' . $message . '</p>';
        $findingsHtml .= '<p style="margin: 0; font-size: 10px; color: #6b7280;"><strong>File:</strong> ' . $file . ' | <strong>Line:</strong> ' . $line . ' | <strong>CWE:</strong> ' . ($cwe ?: '-') . '</p>';
        if ($codeSnippet) {
          $findingsHtml .= '<pre style="margin-top: 8px; padding: 8px; background: #f3f4f6; font-size: 9px; line-height: 1.4; overflow: hidden; word-wrap: break-word; white-space: pre-wrap;"><code>' . $codeSnippet . '</code></pre>';
        }
        $findingsHtml .= '</div>';
      } else {
        $cweLink = $cwe ? '<a href="https://cwe.mitre.org/data/definitions/' . str_replace('CWE-', '', $cwe) . '.html" target="_blank" style="color: #3b82f6;">' . $cwe . '</a>' : '-';

        $findingsHtml .= '<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fff;">';
        $findingsHtml .= '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">';
        $findingsHtml .= '<span style="background: ' . $severityColor . '; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">' . $severity . '</span>';
        $findingsHtml .= '<span style="color: #6b7280; font-size: 14px;">#' . ($index + 1) . '</span>';
        $findingsHtml .= '<span style="color: #6b7280; font-size: 14px;">' . $ruleId . '</span>';
        $findingsHtml .= '</div>';
        $findingsHtml .= '<p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 500; color: #111827;">' . $message . '</p>';
        $findingsHtml .= '<div style="display: flex; gap: 24px; font-size: 14px; color: #6b7280;">';
        $findingsHtml .= '<span><strong>File:</strong> ' . $file . '</span>';
        $findingsHtml .= '<span><strong>Line:</strong> ' . $line . '</span>';
        $findingsHtml .= '<span><strong>CWE:</strong> ' . $cweLink . '</span>';
        $findingsHtml .= '</div>';

        if ($codeSnippet) {
          $findingsHtml .= '<pre style="margin-top: 12px; padding: 12px; background: #f3f4f6; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5;"><code>' . $codeSnippet . '</code></pre>';
        }

        $findingsHtml .= '</div>';
      }
    }

    $severitySummaryHtml = '';
    foreach ($severityCounts as $sev => $count) {
      $color = $severityColors[$sev] ?? '#6b7280';
      if ($forPdf) {
        $severitySummaryHtml .= '<span style="background: ' . $color . '; color: white; padding: 4px 10px; font-size: 11px; font-weight: bold; margin-right: 8px; display: inline-block;">' . $sev . ': ' . $count . '</span>';
      } else {
        $severitySummaryHtml .= '<span style="background: ' . $color . '; color: white; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">' . $sev . ': ' . $count . '</span> ';
      }
    }

    $html = '<!DOCTYPE html>';
    $html .= '<html lang="en">';
    $html .= '<head>';
    $html .= '<meta charset="UTF-8">';
    $html .= '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    $html .= '<title>SAST Report - ' . $targetValue . '</title>';
    $html .= '<style>';
    $html .= '* { box-sizing: border-box; }';
    if ($forPdf) {
      $html .= 'body { font-family: DejaVu Sans, sans-serif; margin: 0; padding: 20px; background: #fff; color: #111827; line-height: 1.4; font-size: 11px; }';
      $html .= '.container { max-width: 100%; }';
      $html .= 'h1 { margin: 0 0 5px 0; font-size: 20px; color: #1e3a5f; }';
      $html .= '.meta { color: #6b7280; margin-bottom: 15px; font-size: 10px; }';
      $html .= '.summary { margin-bottom: 15px; padding: 10px; background: #f9fafb; border: 1px solid #e5e7eb; }';
      $html .= '.findings { margin-top: 15px; }';
      $html .= 'h2 { font-size: 14px; margin-bottom: 10px; color: #1e3a5f; }';
    } else {
      $html .= 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 24px; background: #f9fafb; color: #111827; line-height: 1.5; }';
      $html .= '.container { max-width: 1200px; margin: 0 auto; }';
      $html .= 'h1 { margin: 0 0 8px 0; font-size: 28px; }';
      $html .= '.meta { color: #6b7280; margin-bottom: 24px; }';
      $html .= '.summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; }';
      $html .= '.findings { margin-top: 24px; }';
    }
    $html .= 'a { text-decoration: none; }';
    $html .= 'a:hover { text-decoration: underline; }';
    $html .= '</style>';
    $html .= '</head>';
    $html .= '<body>';
    $html .= '<div class="container">';
    $html .= '<h1>SAST Security Report</h1>';
    $html .= '<p class="meta">Target: ' . $targetValue . ' | Generated: ' . $createdAt . ' | Total Findings: ' . $totalFindings . '</p>';
    $html .= '<div class="summary">' . $severitySummaryHtml . '</div>';
    $html .= '<div class="findings">';
    $html .= '<h2 style="margin-bottom: 16px;">Findings</h2>';
    $html .= $findingsHtml;
    $html .= '</div>';
    $html .= '</div>';
    $html .= '</body>';
    $html .= '</html>';

    return $html;
  }

  /**
   * List SAST runs for a project.
   *
   * GET /api/projects/{project}/sast/runs
   */
  public function listRuns(Project $project): JsonResponse
  {
    // Authorization check
    if ($project->user_id !== Auth::id()) {
      return response()->json(['error' => 'Unauthorized'], 403);
    }

    $runs = Run::where('project_id', $project->id)
      ->whereHas('tasks', function ($query) {
        $query->where('tool', RunTask::TOOL_SAST);
      })
      ->with(['tasks' => function ($query) {
        $query->where('tool', RunTask::TOOL_SAST);
      }])
      ->orderBy('created_at', 'desc')
      ->get();

    return response()->json([
      'runs' => $runs->map(function ($run) {
        $task = $run->tasks->first();
        return [
          'id' => $run->id,
          'status' => $run->status,
          'target_value' => $run->target_value,
          'started_at' => $run->started_at?->toIso8601String(),
          'finished_at' => $run->finished_at?->toIso8601String(),
          'created_at' => $run->created_at->toIso8601String(),
          'task' => $task ? [
            'id' => $task->id,
            'status' => $task->status,
            'progress' => $task->progress,
            'total_findings' => $task->meta_json['total_findings'] ?? 0,
            'severity_counts' => $task->meta_json['severity_counts'] ?? [],
            'has_report' => $task->hasReport(),
          ] : null,
        ];
      }),
    ]);
  }

  /**
   * Get file extension from filename.
   */
  private function getExtension(string $filename): string
  {
    $parts = explode('.', $filename);
    return count($parts) > 1 ? end($parts) : 'json';
  }
}
