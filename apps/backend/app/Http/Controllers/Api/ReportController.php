<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Run;
use App\Models\RunTask;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
  public function __construct(
    protected ReportService $reportService
  ) {}

  /**
   * Get report summary for a run.
   */
  public function summary(Project $project, Run $run): JsonResponse
  {
    $this->authorize('view', $project);

    $summary = $this->reportService->getRunSummary($run);

    return response()->json([
      'summary' => $summary,
    ]);
  }

  /**
   * Get detailed report for a specific task.
   */
  public function taskReport(Project $project, Run $run, RunTask $task): JsonResponse
  {
    $this->authorize('view', $project);

    $report = $this->reportService->getTaskReport($task);

    if (!$report) {
      return response()->json([
        'message' => 'Report not available',
      ], 404);
    }

    return response()->json([
      'report' => $report,
    ]);
  }

  /**
   * Download report file for a task.
   */
  public function download(Project $project, Run $run, RunTask $task): BinaryFileResponse|JsonResponse
  {
    $this->authorize('view', $project);

    $filePath = $this->reportService->getReportFilePath($task);

    if (!$filePath || !file_exists($filePath)) {
      return response()->json([
        'message' => 'Report file not found',
      ], 404);
    }

    return response()->download($filePath);
  }

  /**
   * Get vulnerabilities/findings from a run.
   */
  public function findings(Project $project, Run $run): JsonResponse
  {
    $this->authorize('view', $project);

    $findings = $this->reportService->getFindings($run);

    return response()->json([
      'findings' => $findings,
    ]);
  }

  /**
   * Get report for a run by tool.
   */
  public function runReport(Request $request, Project $project, Run $run): BinaryFileResponse|JsonResponse
  {
    $this->authorize('view', $project);

    // Validate required tool query param
    $tool = $request->query('tool');

    if (empty($tool)) {
      return response()->json([
        'message' => 'The tool query parameter is required',
      ], 400);
    }

    // Find task by tool
    $task = $run->tasks()->where('tool', $tool)->first();

    if (!$task) {
      return response()->json([
        'message' => 'No task found for the specified tool',
      ], 404);
    }

    // Check if report exists
    $filePath = $this->reportService->getReportFilePath($task);

    if (!$filePath) {
      return response()->json([
        'message' => 'Report not available for this tool',
      ], 404);
    }

    // Determine format and return accordingly
    $extension = pathinfo($filePath, PATHINFO_EXTENSION);

    if ($extension === 'json') {
      // Return parsed JSON
      $report = $this->reportService->getTaskReport($task);

      return response()->json([
        'report' => $report,
      ]);
    }

    // For non-JSON formats (HTML, XML, etc.), force download
    return response()->download($filePath);
  }
}
