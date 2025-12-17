<?php

namespace App\Services;

use App\Models\Run;
use App\Models\RunTask;
use Illuminate\Support\Facades\Storage;

class ReportService
{
  /**
   * Get summary for a run.
   */
  public function getRunSummary(Run $run): array
  {
    $run->load('tasks');

    $summary = [
      'run_id' => $run->id,
      'module' => $run->module,
      'status' => $run->status,
      'target' => $run->target_value,
      'started_at' => $run->started_at?->toIso8601String(),
      'finished_at' => $run->finished_at?->toIso8601String(),
      'duration_seconds' => $this->calculateDuration($run),
      'tasks' => $run->tasks->map(fn($task) => [
        'id' => $task->id,
        'tool' => $task->tool,
        'status' => $task->status,
        'progress' => $task->progress,
        'has_report' => !empty($task->report_path),
      ])->toArray(),
      'findings_count' => $this->countFindings($run),
    ];

    return $summary;
  }

  /**
   * Get detailed report for a task.
   */
  public function getTaskReport(RunTask $task): ?array
  {
    if (empty($task->report_path)) {
      return null;
    }

    $reportPath = $task->getReportStoragePath() . '/' . basename($task->report_path);

    if (!file_exists($reportPath)) {
      return null;
    }

    $content = file_get_contents($reportPath);
    $extension = pathinfo($reportPath, PATHINFO_EXTENSION);

    // Parse based on format
    if ($extension === 'json') {
      return json_decode($content, true);
    }

    // For XML/HTML reports, return raw content with type indicator
    return [
      'format' => $extension,
      'content' => $content,
    ];
  }

  /**
   * Get report file path for download.
   */
  public function getReportFilePath(RunTask $task): ?string
  {
    if (empty($task->report_path)) {
      return null;
    }

    $reportPath = $task->getReportStoragePath() . '/' . basename($task->report_path);

    return file_exists($reportPath) ? $reportPath : null;
  }

  /**
   * Get normalized findings from a run.
   */
  public function getFindings(Run $run): array
  {
    $findings = [];

    foreach ($run->tasks as $task) {
      if ($task->status !== RunTask::STATUS_COMPLETED) {
        continue;
      }

      $taskFindings = $this->extractFindingsFromTask($task);
      $findings = array_merge($findings, $taskFindings);
    }

    // Sort by severity
    usort($findings, function ($a, $b) {
      $severityOrder = ['critical' => 0, 'high' => 1, 'medium' => 2, 'low' => 3, 'info' => 4];
      $aSeverity = $severityOrder[$a['severity']] ?? 5;
      $bSeverity = $severityOrder[$b['severity']] ?? 5;
      return $aSeverity <=> $bSeverity;
    });

    return $findings;
  }

  /**
   * Extract findings from a task report.
   */
  protected function extractFindingsFromTask(RunTask $task): array
  {
    $report = $this->getTaskReport($task);

    if (!$report) {
      return [];
    }

    // Normalize findings based on tool type
    return match ($task->tool) {
      RunTask::TOOL_ZAP => $this->normalizeZapFindings($report, $task),
      default => [],
    };
  }

  /**
   * Normalize ZAP findings to common schema.
   */
  protected function normalizeZapFindings(array $report, RunTask $task): array
  {
    $findings = [];

    // ZAP JSON report structure
    $alerts = $report['site'][0]['alerts'] ?? $report['alerts'] ?? [];

    foreach ($alerts as $alert) {
      $findings[] = [
        'id' => uniqid('zap_'),
        'tool' => 'zap',
        'task_id' => $task->id,
        'severity' => $this->mapZapRisk($alert['riskcode'] ?? $alert['risk'] ?? 'info'),
        'title' => $alert['name'] ?? $alert['alert'] ?? 'Unknown',
        'description' => $alert['desc'] ?? $alert['description'] ?? '',
        'solution' => $alert['solution'] ?? '',
        'evidence' => $alert['evidence'] ?? '',
        'location' => $alert['uri'] ?? $alert['url'] ?? '',
        'cweid' => $alert['cweid'] ?? null,
        'wascid' => $alert['wascid'] ?? null,
        'timestamp' => $task->updated_at?->toIso8601String(),
      ];
    }

    return $findings;
  }

  /**
   * Map ZAP risk code to severity.
   */
  protected function mapZapRisk(string|int $risk): string
  {
    if (is_numeric($risk)) {
      return match ((int) $risk) {
        3 => 'critical',
        2 => 'high',
        1 => 'medium',
        0 => 'low',
        default => 'info',
      };
    }

    return match (strtolower($risk)) {
      'high' => 'critical',
      'medium' => 'high',
      'low' => 'medium',
      'informational', 'info' => 'info',
      default => 'info',
    };
  }

  /**
   * Calculate run duration in seconds.
   */
  protected function calculateDuration(Run $run): ?int
  {
    if (!$run->started_at) {
      return null;
    }

    $endTime = $run->finished_at ?? now();

    return $run->started_at->diffInSeconds($endTime);
  }

  /**
   * Count total findings in a run.
   */
  protected function countFindings(Run $run): int
  {
    // This is a simplified count - could be optimized with caching
    return count($this->getFindings($run));
  }
}
