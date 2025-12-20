<?php

namespace App\Services;

use App\Models\RunTask;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SastService
{
  protected string $baseUrl;
  protected ArtifactStorageService $artifactStorage;
  protected int $timeout;

  public function __construct(ArtifactStorageService $artifactStorage)
  {
    $this->baseUrl = config('services.sast.url', 'http://sast:8080');
    $this->timeout = config('services.sast.timeout', 300);
    $this->artifactStorage = $artifactStorage;
  }

  /**
   * Check if the SAST service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/health");
      return $response->successful() && $response->json('status') === 'healthy';
    } catch (\Exception $e) {
      Log::warning('SAST service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get available SAST rules.
   */
  public function getRules(): array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/rules");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SAST get rules failed', ['response' => $response->body()]);
      return ['total' => 0, 'rules' => []];
    } catch (\Exception $e) {
      Log::error('SAST get rules exception', ['error' => $e->getMessage()]);
      return ['total' => 0, 'rules' => []];
    }
  }

  /**
   * Start a SAST scan by uploading a ZIP file.
   *
   * @param UploadedFile $file The ZIP file to scan
   * @param string $outputFormat 'json' or 'html'
   * @param string|null $callbackUrl Optional callback URL for results
   * @return array|null Scan info including scan_id, or null on failure
   */
  public function startScanFromZip(
    UploadedFile $file,
    string $outputFormat = 'json',
    ?string $callbackUrl = null
  ): ?array {
    try {
      $request = Http::timeout($this->timeout)
        ->attach('source', $file->get(), $file->getClientOriginalName());

      $data = ['output_format' => $outputFormat];
      if ($callbackUrl) {
        $data['callback_url'] = $callbackUrl;
      }

      foreach ($data as $key => $value) {
        $request = $request->attach($key, $value);
      }

      $response = Http::timeout($this->timeout)
        ->asMultipart()
        ->attach('source', $file->get(), $file->getClientOriginalName())
        ->post("{$this->baseUrl}/scan", [
          ['name' => 'output_format', 'contents' => $outputFormat],
          ['name' => 'callback_url', 'contents' => $callbackUrl ?? ''],
        ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SAST scan start failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SAST scan start exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Start a SAST scan from a path (must be accessible to the container).
   *
   * @param string $sourcePath Path to the source code (inside the container)
   * @param string $outputFormat 'json' or 'html'
   * @param string|null $callbackUrl Optional callback URL for results
   * @return array|null Scan info including scan_id, or null on failure
   */
  public function startScanFromPath(
    string $sourcePath,
    string $outputFormat = 'json',
    ?string $callbackUrl = null
  ): ?array {
    try {
      $payload = [
        'source_path' => $sourcePath,
        'output_format' => $outputFormat,
      ];

      if ($callbackUrl) {
        $payload['callback_url'] = $callbackUrl;
      }

      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/scan", $payload);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SAST scan start from path failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SAST scan start from path exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get the status of a SAST scan.
   *
   * @param string $scanId The SAST container's scan ID
   * @return array|null Scan status info or null on failure
   */
  public function getScanStatus(string $scanId): ?array
  {
    try {
      $response = Http::timeout(30)->get("{$this->baseUrl}/scan/{$scanId}");

      if ($response->successful()) {
        return $response->json();
      }

      if ($response->status() === 404) {
        return ['status' => 'not_found', 'error' => 'Scan not found'];
      }

      Log::error('SAST scan status failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SAST scan status exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get the findings from a completed SAST scan.
   *
   * @param string $scanId The SAST container's scan ID
   * @return array|null Findings data or null on failure
   */
  public function getScanFindings(string $scanId): ?array
  {
    try {
      $response = Http::timeout(60)->get("{$this->baseUrl}/scan/{$scanId}/findings");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('SAST scan findings failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('SAST scan findings exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Download and store the SAST report for a task.
   *
   * @param RunTask $task The task to store the report for
   * @param string $scanId The SAST container's scan ID
   * @return string|null The relative path to the stored report or null on failure
   */
  public function downloadAndStoreReport(RunTask $task, string $scanId): ?string
  {
    try {
      Log::info('SAST downloading report', ['scan_id' => $scanId, 'task_id' => $task->id]);

      $response = Http::timeout(60)->get("{$this->baseUrl}/scan/{$scanId}/report");

      if ($response->successful()) {
        // Determine filename based on the originally requested output_format from task metadata
        // This is more reliable than checking Content-Type header
        $outputFormat = $task->meta_json['output_format'] ?? 'json';
        $contentType = $response->header('Content-Type');

        // Use the requested output format to determine extension
        // Fall back to content-type check if output_format is not set
        if ($outputFormat === 'html') {
          $filename = 'report.html';
        } elseif ($outputFormat === 'json') {
          $filename = 'report.json';
        } else {
          // Fallback: check content type
          $filename = str_contains($contentType ?? '', 'html') ? 'report.html' : 'report.json';
        }

        $body = $response->body();
        Log::info('SAST report downloaded', [
          'scan_id' => $scanId,
          'output_format' => $outputFormat,
          'content_type' => $contentType,
          'filename' => $filename,
          'body_length' => strlen($body),
        ]);

        $relativePath = $this->artifactStorage->storeReport($task, $filename, $body);

        Log::info('SAST report stored', [
          'scan_id' => $scanId,
          'relative_path' => $relativePath,
        ]);

        return $relativePath;
      }

      Log::error('SAST report download failed', [
        'scan_id' => $scanId,
        'status' => $response->status(),
        'response' => $response->body(),
      ]);
      return null;
    } catch (\Exception $e) {
      Log::error('SAST report download exception', [
        'scan_id' => $scanId,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
      ]);
      return null;
    }
  }

  /**
   * Store SAST findings as a JSON file.
   *
   * @param RunTask $task The task to store findings for
   * @param array $findings The findings data
   * @return string|null The relative path to the stored findings or null on failure
   */
  public function storeFindings(RunTask $task, array $findings): ?string
  {
    try {
      $contents = json_encode($findings, JSON_PRETTY_PRINT);
      return $this->artifactStorage->storeReport($task, 'findings.json', $contents);
    } catch (\Exception $e) {
      Log::error('SAST findings storage exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Log a message for a SAST task.
   *
   * @param RunTask $task The task to log for
   * @param string $level Log level (INFO, DEBUG, WARN, ERROR)
   * @param string $message The log message
   * @return string|null The relative path to the log or null on failure
   */
  public function log(RunTask $task, string $level, string $message): ?string
  {
    $timestamp = now()->toIso8601String();
    $formattedLine = "[{$timestamp}] {$level}: {$message}\n";

    try {
      return $this->artifactStorage->appendLog($task, 'execution.log', $formattedLine);
    } catch (\Exception $e) {
      Log::error('SAST log append error', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Delete a scan from the SAST container.
   *
   * @param string $scanId The scan ID to delete
   * @return bool True if deleted successfully
   */
  public function deleteScan(string $scanId): bool
  {
    try {
      $response = Http::timeout(30)->delete("{$this->baseUrl}/scan/{$scanId}");
      return $response->successful();
    } catch (\Exception $e) {
      Log::error('SAST scan delete exception', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Map SAST container status to RunTask status.
   */
  public function mapStatusToTaskStatus(string $sastStatus): string
  {
    return match ($sastStatus) {
      'pending' => RunTask::STATUS_PENDING,
      'running' => RunTask::STATUS_RUNNING,
      'completed' => RunTask::STATUS_COMPLETED,
      'failed' => RunTask::STATUS_FAILED,
      default => RunTask::STATUS_PENDING,
    };
  }
}
