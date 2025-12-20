<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WafProxy\StoreWafProxyRequest;
use App\Http\Requests\WafProxy\UpdateWafProxyRequest;
use App\Http\Resources\WafProxyResource;
use App\Models\Project;
use App\Models\WafProxy;
use App\Services\WafProxyService;
use App\Services\WafLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WafProxyController extends Controller
{
  public function __construct(
    protected WafProxyService $wafProxyService,
    protected WafLogService $wafLogService
  ) {}

  /**
   * Display a listing of WAF proxies for a project.
   * Includes real-time log-based counters for accuracy.
   */
  public function index(Project $project): JsonResponse
  {
    $this->authorize('view', $project);

    $proxies = $this->wafProxyService->getProjectProxies($project);

    // Get all logs for the project to calculate real-time counters
    $allLogs = $this->wafLogService->getProjectLogs($project, 10000);

    // Build response with real-time counters
    $data = $proxies->map(function ($proxy) use ($allLogs) {
      $proxyLogs = $allLogs->filter(fn($log) => ($log['token'] ?? null) === $proxy->token);
      return $this->buildProxyPayload($proxy, $proxyLogs);
    });

    return response()->json(['data' => $data]);
  }

  /**
   * Store a newly created WAF proxy.
   */
  public function store(StoreWafProxyRequest $request, Project $project): JsonResponse
  {
    $this->authorize('update', $project);

    $proxy = $this->wafProxyService->create($project, $request->validated());

    return response()->json([
      'message' => 'WAF proxy created successfully',
      'proxy' => new WafProxyResource($proxy),
    ], 201);
  }

  /**
   * Display the specified WAF proxy.
   */
  public function show(Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('view', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    // Real-time counters for this proxy from logs
    $proxyLogs = $this->wafLogService->getProxyLogs($proxy, 2000);

    return response()->json([
      'proxy' => $this->buildProxyPayload($proxy, $proxyLogs),
    ]);
  }

  /**
   * Update the specified WAF proxy.
   */
  public function update(UpdateWafProxyRequest $request, Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('update', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    $proxy = $this->wafProxyService->update($proxy, $request->validated());

    return response()->json([
      'message' => 'WAF proxy updated successfully',
      'proxy' => new WafProxyResource($proxy),
    ]);
  }

  /**
   * Remove the specified WAF proxy.
   */
  public function destroy(Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('delete', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    $this->wafProxyService->delete($proxy);

    return response()->json([
      'message' => 'WAF proxy deleted successfully',
    ]);
  }

  /**
   * Rotate the token for a WAF proxy.
   */
  public function rotateToken(Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('update', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    $proxy = $this->wafProxyService->rotateToken($proxy);

    return response()->json([
      'message' => 'Token rotated successfully',
      'proxy' => new WafProxyResource($proxy),
    ]);
  }

  /**
   * Get statistics for the project's WAF proxies.
   * Uses real-time log data for accurate counts.
   */
  public function stats(Project $project): JsonResponse
  {
    $this->authorize('view', $project);

    $proxies = $project->wafProxies;

    // Get real-time log summary for accurate blocked counts
    $logSummary = $this->wafLogService->getProjectSummary($project);

    $stats = [
      'total_proxies' => $proxies->count(),
      'active_proxies' => $proxies->where('status', WafProxy::STATUS_ACTIVE)->count(),
      // Use log-based counts for real-time accuracy
      'total_requests' => $logSummary['total'],
      'total_allowed' => $logSummary['allowed'],
      'total_blocked' => $logSummary['blocked'],
      'block_rate' => $logSummary['block_rate'],
    ];

    return response()->json([
      'stats' => $stats,
    ]);
  }

  /**
   * Pause a WAF proxy.
   */
  public function pause(Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('update', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    $proxy->pause();
    $this->wafProxyService->regenerateMapFile();

    return response()->json([
      'message' => 'WAF proxy paused',
      'proxy' => new WafProxyResource($proxy->fresh()),
    ]);
  }

  /**
   * Activate a WAF proxy.
   */
  public function activate(Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('update', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    $proxy->activate();
    $this->wafProxyService->regenerateMapFile();

    return response()->json([
      'message' => 'WAF proxy activated',
      'proxy' => new WafProxyResource($proxy->fresh()),
    ]);
  }

  /**
   * Reset counters for a WAF proxy.
   */
  public function resetCounters(Project $project, WafProxy $proxy): JsonResponse
  {
    $this->authorize('update', $project);
    $this->ensureProxyBelongsToProject($proxy, $project);

    $proxy->resetCounters();

    return response()->json([
      'message' => 'Counters reset successfully',
      'proxy' => new WafProxyResource($proxy->fresh()),
    ]);
  }

  /**
   * Ensure the proxy belongs to the project.
   */
  protected function ensureProxyBelongsToProject(WafProxy $proxy, Project $project): void
  {
    if ($proxy->project_id !== $project->id) {
      abort(404, 'WAF proxy not found for this project');
    }
  }

  /**
   * Build a proxy payload with real-time counters from logs (allowed + blocked).
   */
  protected function buildProxyPayload($proxy, $proxyLogs)
  {
    $blocked = $proxyLogs->where('blocked', true)->count();
    $allowed = $proxyLogs->where('blocked', false)->count();
    $total = $blocked + $allowed;

    return [
      'id' => $proxy->id,
      'project_id' => $proxy->project_id,
      'name' => $proxy->name,
      'origin_url' => $proxy->origin_url,
      'token' => $proxy->token,
      'waf_url' => $proxy->getWafUrl(),
      'status' => $proxy->status,
      'counters' => [
        'allowed' => $allowed,
        'blocked' => $blocked,
        'total' => $total,
        'block_rate' => $total > 0 ? round(($blocked / $total) * 100, 2) : 0,
      ],
      'last_request_at' => $proxyLogs->isNotEmpty()
        ? $proxyLogs->sortByDesc('timestamp')->first()['timestamp']
        : $proxy->last_request_at?->toIso8601String(),
      'created_at' => $proxy->created_at->toIso8601String(),
      'updated_at' => $proxy->updated_at->toIso8601String(),
    ];
  }
}
