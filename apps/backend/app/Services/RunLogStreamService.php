<?php

namespace App\Services;

use App\Models\Run;
use App\Models\RunTask;
use Illuminate\Support\Facades\Storage;

/**
 * Service for streaming run logs via SSE.
 *
 * Event types emitted:
 * - snapshot: Initial run + task statuses and progress
 * - log: Individual log line (historical or live)
 * - status: Run or task status change
 * - heartbeat: Keep-alive ping
 * - done: Stream complete (run finished)
 *
 * Log event payload:
 * {
 *   "type": "log",
 *   "run_id": 1,
 *   "task_id": 2,
 *   "tool": "zap",
 *   "timestamp": "2025-12-17T10:30:00Z",
 *   "level": "info",
 *   "message": "Spider scan started"
 * }
 */
class RunLogStreamService
{
  /**
   * Heartbeat interval in seconds.
   */
  protected int $heartbeatInterval = 15;

  /**
   * Poll interval in seconds for checking new logs.
   */
  protected int $pollInterval = 2;

  /**
   * Maximum stream duration in seconds (30 minutes).
   */
  protected int $maxDuration = 1800;

  public function __construct(
    protected ArtifactStorageService $artifactStorage
  ) {}

  /**
   * Stream logs for a run.
   *
   * @param Run $run The run to stream
   * @param callable $emit Callback to emit events: fn(string $event, array $data)
   */
  public function stream(Run $run, callable $emit): void
  {
    $startTime = time();
    $lastHeartbeat = time();

    // Track file offsets for tailing
    $fileOffsets = [];

    // 1. Emit initial snapshot
    $this->emitSnapshot($run, $emit);

    // 2. Replay historical logs
    $run->load('tasks');
    foreach ($run->tasks as $task) {
      $this->replayHistoricalLogs($task, $emit, $fileOffsets);
    }

    // 3. Live tail loop
    while (true) {
      // Check for client disconnect
      if (connection_aborted()) {
        break;
      }

      // Check max duration
      if ((time() - $startTime) > $this->maxDuration) {
        $emit('done', ['reason' => 'max_duration_reached']);
        break;
      }

      // Refresh run status
      $run->refresh();
      $run->load('tasks');

      // Check for new logs from each task
      foreach ($run->tasks as $task) {
        $this->tailTaskLogs($task, $emit, $fileOffsets);
      }

      // Emit status updates if changed
      $this->emitStatusIfChanged($run, $emit);

      // Check if run is complete
      if ($run->isComplete()) {
        $emit('done', [
          'reason' => 'run_completed',
          'status' => $run->status,
          'finished_at' => $run->finished_at?->toIso8601String(),
        ]);
        break;
      }

      // Send heartbeat if needed
      if ((time() - $lastHeartbeat) >= $this->heartbeatInterval) {
        $emit('heartbeat', ['time' => now()->toIso8601String()]);
        $lastHeartbeat = time();
      }

      // Sleep before next poll
      sleep($this->pollInterval);
    }
  }

  /**
   * Emit initial snapshot with run and task statuses.
   */
  protected function emitSnapshot(Run $run, callable $emit): void
  {
    $run->load('tasks');

    $emit('snapshot', [
      'run' => [
        'id' => $run->id,
        'module' => $run->module,
        'status' => $run->status,
        'target_value' => $run->target_value,
        'started_at' => $run->started_at?->toIso8601String(),
        'finished_at' => $run->finished_at?->toIso8601String(),
      ],
      'tasks' => $run->tasks->map(fn(RunTask $task) => [
        'id' => $task->id,
        'tool' => $task->tool,
        'status' => $task->status,
        'progress' => $task->progress,
      ])->toArray(),
    ]);
  }

  /**
   * Replay historical logs from a task's log file.
   */
  protected function replayHistoricalLogs(RunTask $task, callable $emit, array &$fileOffsets): void
  {
    if (empty($task->logs_path)) {
      $fileOffsets[$task->id] = 0;
      return;
    }

    $content = $this->artifactStorage->read($task->logs_path);

    if ($content === null) {
      $fileOffsets[$task->id] = 0;
      return;
    }

    // Parse and emit each line
    $lines = explode("\n", $content);
    foreach ($lines as $line) {
      $line = trim($line);
      if (empty($line)) {
        continue;
      }

      $logEntry = $this->parseLogLine($line, $task);
      $emit('log', $logEntry);
    }

    // Track offset for tailing
    $fileOffsets[$task->id] = strlen($content);
  }

  /**
   * Tail a task's log file for new content.
   */
  protected function tailTaskLogs(RunTask $task, callable $emit, array &$fileOffsets): void
  {
    if (empty($task->logs_path)) {
      return;
    }

    $currentOffset = $fileOffsets[$task->id] ?? 0;

    // Check if file exists and get its size
    if (!$this->artifactStorage->exists($task->logs_path)) {
      return;
    }

    $absolutePath = $this->artifactStorage->getAbsolutePath($task->logs_path);
    $fileSize = filesize($absolutePath);

    // No new content
    if ($fileSize <= $currentOffset) {
      return;
    }

    // Read new content
    $handle = fopen($absolutePath, 'r');
    if (!$handle) {
      return;
    }

    fseek($handle, $currentOffset);
    $newContent = fread($handle, $fileSize - $currentOffset);
    fclose($handle);

    if (empty($newContent)) {
      return;
    }

    // Parse and emit new lines
    $lines = explode("\n", $newContent);
    foreach ($lines as $line) {
      $line = trim($line);
      if (empty($line)) {
        continue;
      }

      $logEntry = $this->parseLogLine($line, $task);
      $emit('log', $logEntry);
    }

    // Update offset
    $fileOffsets[$task->id] = $fileSize;
  }

  /**
   * Parse a log line into structured format.
   *
   * Expected format: [ISO_TIMESTAMP] LEVEL: message
   * Example: [2025-12-17T10:30:00Z] INFO: Spider scan started
   *
   * Falls back to treating entire line as message if format doesn't match.
   */
  protected function parseLogLine(string $line, RunTask $task): array
  {
    $timestamp = now()->toIso8601String();
    $level = 'info';
    $message = $line;

    // Try to parse structured format: [timestamp] LEVEL: message
    if (preg_match('/^\[([^\]]+)\]\s+(\w+):\s*(.*)$/', $line, $matches)) {
      $timestamp = $matches[1];
      $level = strtolower($matches[2]);
      $message = $matches[3];
    }
    // Try alternate format: [timestamp] message
    elseif (preg_match('/^\[([^\]]+)\]\s*(.*)$/', $line, $matches)) {
      $timestamp = $matches[1];
      $message = $matches[2];
    }

    return [
      'type' => 'log',
      'run_id' => $task->run_id,
      'task_id' => $task->id,
      'tool' => $task->tool,
      'timestamp' => $timestamp,
      'level' => $level,
      'message' => $message,
    ];
  }

  /**
   * Track and emit status changes.
   */
  protected array $lastStatuses = [];

  protected function emitStatusIfChanged(Run $run, callable $emit): void
  {
    $runKey = "run_{$run->id}";
    $currentRunStatus = $run->status;

    // Check run status change
    if (!isset($this->lastStatuses[$runKey]) || $this->lastStatuses[$runKey] !== $currentRunStatus) {
      $this->lastStatuses[$runKey] = $currentRunStatus;
      $emit('status', [
        'entity' => 'run',
        'id' => $run->id,
        'status' => $currentRunStatus,
        'started_at' => $run->started_at?->toIso8601String(),
        'finished_at' => $run->finished_at?->toIso8601String(),
      ]);
    }

    // Check task status/progress changes
    foreach ($run->tasks as $task) {
      $taskKey = "task_{$task->id}";
      $currentState = "{$task->status}_{$task->progress}";

      if (!isset($this->lastStatuses[$taskKey]) || $this->lastStatuses[$taskKey] !== $currentState) {
        $this->lastStatuses[$taskKey] = $currentState;
        $emit('status', [
          'entity' => 'task',
          'id' => $task->id,
          'tool' => $task->tool,
          'status' => $task->status,
          'progress' => $task->progress,
        ]);
      }
    }
  }
}
