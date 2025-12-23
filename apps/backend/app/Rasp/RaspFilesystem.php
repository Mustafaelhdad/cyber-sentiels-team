<?php

namespace App\Rasp;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * RASP Filesystem Wrapper.
 *
 * Wraps filesystem operations to emit RASP events and detect
 * path traversal attempts.
 */
class RaspFilesystem
{
  private Filesystem $filesystem;
  private RaspService $raspService;
  private string $disk;

  public function __construct(?string $disk = null)
  {
    $this->disk = $disk ?? config('filesystems.default');
    $this->filesystem = Storage::disk($this->disk);
    $this->raspService = app(RaspService::class);
  }

  /**
   * Create a new instance for a specific disk.
   */
  public static function disk(?string $disk = null): self
  {
    return new self($disk);
  }

  /**
   * Read a file with RASP monitoring.
   */
  public function get(string $path): ?string
  {
    $this->checkAndEmit('read', $path);
    return $this->filesystem->get($path);
  }

  /**
   * Write to a file with RASP monitoring.
   */
  public function put(string $path, $contents, $options = []): bool
  {
    $this->checkAndEmit('write', $path);
    return $this->filesystem->put($path, $contents, $options);
  }

  /**
   * Append to a file with RASP monitoring.
   */
  public function append(string $path, string $data): bool
  {
    $this->checkAndEmit('append', $path);
    return $this->filesystem->append($path, $data);
  }

  /**
   * Delete a file with RASP monitoring.
   */
  public function delete($paths): bool
  {
    $paths = is_array($paths) ? $paths : [$paths];
    foreach ($paths as $path) {
      $this->checkAndEmit('delete', $path);
    }
    return $this->filesystem->delete($paths);
  }

  /**
   * Copy a file with RASP monitoring.
   */
  public function copy(string $from, string $to): bool
  {
    $this->checkAndEmit('copy', $from);
    $this->checkAndEmit('copy_to', $to);
    return $this->filesystem->copy($from, $to);
  }

  /**
   * Move a file with RASP monitoring.
   */
  public function move(string $from, string $to): bool
  {
    $this->checkAndEmit('move', $from);
    $this->checkAndEmit('move_to', $to);
    return $this->filesystem->move($from, $to);
  }

  /**
   * Check if a file exists with RASP monitoring.
   */
  public function exists(string $path): bool
  {
    $this->checkAndEmit('exists', $path);
    return $this->filesystem->exists($path);
  }

  /**
   * Get file size with RASP monitoring.
   */
  public function size(string $path): int
  {
    $this->checkAndEmit('size', $path);
    return $this->filesystem->size($path);
  }

  /**
   * Get last modified time with RASP monitoring.
   */
  public function lastModified(string $path): int
  {
    $this->checkAndEmit('lastModified', $path);
    return $this->filesystem->lastModified($path);
  }

  /**
   * List files in a directory with RASP monitoring.
   */
  public function files(?string $directory = null, bool $recursive = false): array
  {
    $this->checkAndEmit('list', $directory ?? '/');
    return $this->filesystem->files($directory, $recursive);
  }

  /**
   * List all files (recursive) with RASP monitoring.
   */
  public function allFiles(?string $directory = null): array
  {
    $this->checkAndEmit('list_all', $directory ?? '/');
    return $this->filesystem->allFiles($directory);
  }

  /**
   * List directories with RASP monitoring.
   */
  public function directories(?string $directory = null, bool $recursive = false): array
  {
    $this->checkAndEmit('list_dirs', $directory ?? '/');
    return $this->filesystem->directories($directory, $recursive);
  }

  /**
   * Create a directory with RASP monitoring.
   */
  public function makeDirectory(string $path): bool
  {
    $this->checkAndEmit('mkdir', $path);
    return $this->filesystem->makeDirectory($path);
  }

  /**
   * Delete a directory with RASP monitoring.
   */
  public function deleteDirectory(string $directory): bool
  {
    $this->checkAndEmit('rmdir', $directory);
    return $this->filesystem->deleteDirectory($directory);
  }

  /**
   * Get the underlying filesystem instance.
   */
  public function getFilesystem(): Filesystem
  {
    return $this->filesystem;
  }

  /**
   * Check path for traversal and emit RASP event.
   */
  private function checkAndEmit(string $operation, string $path): void
  {
    if (!config('rasp.enabled', true) || !config('rasp.sinks.filesystem', true)) {
      return;
    }

    $context = RaspContext::getInstance();
    $traceId = $context->getTraceId();

    // Detect path traversal
    $detectionType = $this->raspService->detectPathTraversal($path);
    $action = $this->raspService->determineAction($detectionType);

    $severity = $detectionType
      ? RaspEvent::SEVERITY_WARNING
      : RaspEvent::SEVERITY_DEBUG;

    $event = RaspEvent::filesystem(
      traceId: $traceId,
      operation: $operation,
      path: $this->sanitizePath($path),
      severity: $severity,
      action: $action,
      detectionType: $detectionType,
    );

    $this->raspService->emit($event);

    // Block if in blocking mode and traversal detected
    if ($event->shouldBlock() && $this->raspService->isBlockingEnabled()) {
      throw new Exceptions\RaspBlockedException(
        "RASP blocked suspicious file operation: {$detectionType}",
        $event
      );
    }
  }

  /**
   * Sanitize path for logging (remove sensitive parts).
   */
  private function sanitizePath(string $path): string
  {
    // Remove absolute path prefix for logging
    $basePath = base_path();
    if (str_starts_with($path, $basePath)) {
      $path = substr($path, strlen($basePath));
    }

    return $path;
  }
}
