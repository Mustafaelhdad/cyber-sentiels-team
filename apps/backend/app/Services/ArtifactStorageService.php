<?php

namespace App\Services;

use App\Models\RunTask;
use Illuminate\Support\Facades\Storage;

class ArtifactStorageService
{
  /**
   * The disk to use for artifact storage.
   */
  protected string $disk = 'local';

  /**
   * Base directory for all reports/artifacts.
   */
  protected string $baseDir = 'reports';

  /**
   * Get the relative directory path for a task's artifacts.
   *
   * @return string e.g. "reports/{run_id}/{tool}"
   */
  public function getTaskDirectory(RunTask $task): string
  {
    return "{$this->baseDir}/{$task->run_id}/{$task->tool}";
  }

  /**
   * Get the relative path for a specific artifact file.
   *
   * @return string e.g. "reports/{run_id}/{tool}/report.json"
   */
  public function getArtifactPath(RunTask $task, string $filename): string
  {
    return $this->getTaskDirectory($task) . '/' . $filename;
  }

  /**
   * Get the absolute disk path for a task's artifact directory.
   */
  public function getAbsoluteDirectory(RunTask $task): string
  {
    return Storage::disk($this->disk)->path($this->getTaskDirectory($task));
  }

  /**
   * Get the absolute disk path for a specific artifact file.
   */
  public function getAbsolutePath(string $relativePath): string
  {
    return Storage::disk($this->disk)->path($relativePath);
  }

  /**
   * Ensure the task artifact directory exists.
   */
  public function ensureDirectoryExists(RunTask $task): void
  {
    $directory = $this->getTaskDirectory($task);

    if (!Storage::disk($this->disk)->exists($directory)) {
      Storage::disk($this->disk)->makeDirectory($directory);
    }
  }

  /**
   * Store a report file and return its relative path.
   *
   * @param RunTask $task The task the artifact belongs to
   * @param string $filename The filename to save as (e.g., "report.json")
   * @param string $contents The file contents
   * @return string The relative path (e.g., "reports/{run_id}/{tool}/report.json")
   */
  public function storeReport(RunTask $task, string $filename, string $contents): string
  {
    $this->ensureDirectoryExists($task);

    $relativePath = $this->getArtifactPath($task, $filename);

    Storage::disk($this->disk)->put($relativePath, $contents);

    return $relativePath;
  }

  /**
   * Store a log file and return its relative path.
   *
   * @param RunTask $task The task the log belongs to
   * @param string $filename The filename to save as (e.g., "execution.log")
   * @param string $contents The log contents
   * @return string The relative path (e.g., "reports/{run_id}/{tool}/execution.log")
   */
  public function storeLog(RunTask $task, string $filename, string $contents): string
  {
    return $this->storeReport($task, $filename, $contents);
  }

  /**
   * Append to a log file.
   *
   * @param RunTask $task The task the log belongs to
   * @param string $filename The log filename
   * @param string $contents The content to append
   * @return string The relative path
   */
  public function appendLog(RunTask $task, string $filename, string $contents): string
  {
    $this->ensureDirectoryExists($task);

    $relativePath = $this->getArtifactPath($task, $filename);

    Storage::disk($this->disk)->append($relativePath, $contents);

    return $relativePath;
  }

  /**
   * Read an artifact file's contents.
   *
   * @param string $relativePath The relative path to the artifact
   * @return string|null The file contents or null if not found
   */
  public function read(string $relativePath): ?string
  {
    if (!Storage::disk($this->disk)->exists($relativePath)) {
      return null;
    }

    return Storage::disk($this->disk)->get($relativePath);
  }

  /**
   * Check if an artifact exists.
   *
   * @param string $relativePath The relative path to check
   * @return bool
   */
  public function exists(string $relativePath): bool
  {
    return Storage::disk($this->disk)->exists($relativePath);
  }

  /**
   * Delete an artifact file.
   *
   * @param string $relativePath The relative path to the artifact
   * @return bool
   */
  public function delete(string $relativePath): bool
  {
    return Storage::disk($this->disk)->delete($relativePath);
  }

  /**
   * Delete all artifacts for a task.
   *
   * @param RunTask $task The task whose artifacts to delete
   * @return bool
   */
  public function deleteTaskArtifacts(RunTask $task): bool
  {
    $directory = $this->getTaskDirectory($task);

    return Storage::disk($this->disk)->deleteDirectory($directory);
  }

  /**
   * List all artifact files for a task.
   *
   * @param RunTask $task The task
   * @return array<string> Array of relative file paths
   */
  public function listTaskArtifacts(RunTask $task): array
  {
    $directory = $this->getTaskDirectory($task);

    return Storage::disk($this->disk)->files($directory);
  }
}
