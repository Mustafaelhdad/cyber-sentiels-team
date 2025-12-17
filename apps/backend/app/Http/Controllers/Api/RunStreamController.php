<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Run;
use App\Services\RunLogStreamService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RunStreamController extends Controller
{
  public function __construct(
    protected RunLogStreamService $streamService
  ) {}

  /**
   * Stream logs for a run via Server-Sent Events (SSE).
   *
   * Emits:
   * - event: snapshot (initial run + task statuses)
   * - event: log (historical then live log lines)
   * - event: status (run/task status changes)
   * - event: heartbeat (keep-alive every 15s)
   * - event: done (when run completes)
   */
  public function stream(Request $request, Project $project, Run $run): StreamedResponse
  {
    $this->authorize('view', $project);

    // Ensure the run belongs to the project
    if ($run->project_id !== $project->id) {
      abort(404, 'Run not found for this project');
    }

    return new StreamedResponse(function () use ($run) {
      // Disable time limit for long-running streams
      set_time_limit(0);

      // Disable output buffering
      if (ob_get_level()) {
        ob_end_clean();
      }

      $this->streamService->stream($run, function (string $event, array $data) {
        $this->sendEvent($event, $data);
      });
    }, 200, [
      'Content-Type' => 'text/event-stream',
      'Cache-Control' => 'no-cache',
      'Connection' => 'keep-alive',
      'X-Accel-Buffering' => 'no', // Disable nginx buffering
    ]);
  }

  /**
   * Send an SSE event.
   */
  protected function sendEvent(string $event, array $data): void
  {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data) . "\n\n";

    if (ob_get_level()) {
      ob_flush();
    }
    flush();
  }
}
