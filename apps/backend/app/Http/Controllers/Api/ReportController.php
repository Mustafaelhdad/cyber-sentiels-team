<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Run;
use App\Models\RunTask;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
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
}

