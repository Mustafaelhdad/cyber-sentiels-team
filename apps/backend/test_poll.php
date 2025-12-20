<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Run;
use App\Models\RunTask;
use App\Services\RunService;
use App\Services\SastService;

$run = Run::find(82);
$task = $run->tasks()->first();
echo "Before polling:\n";
echo "Run status: " . $run->status . "\n";
echo "Task status: " . $task->status . "\n";
echo "Task tool: " . $task->tool . "\n";
echo "SAST scan ID: " . ($task->meta_json['sast_scan_id'] ?? 'N/A') . "\n";

// Test SAST service directly
$sastService = app(SastService::class);
$sastScanId = $task->meta_json['sast_scan_id'] ?? null;

if ($sastScanId) {
  echo "\nTesting SAST service directly:\n";
  $scanStatus = $sastService->getScanStatus($sastScanId);
  echo "SAST scan status response: " . json_encode($scanStatus) . "\n";

  if ($scanStatus) {
    $mappedStatus = $sastService->mapStatusToTaskStatus($scanStatus['status']);
    echo "Mapped task status: " . $mappedStatus . "\n";
  }
}

// Now run the polling
echo "\nRunning pollExternalTaskStatus...\n";
$runService = app(RunService::class);
$runService->pollExternalTaskStatus($run);

$run->refresh();
$task->refresh();
echo "\nAfter polling:\n";
echo "Run status: " . $run->status . "\n";
echo "Task status: " . $task->status . "\n";
