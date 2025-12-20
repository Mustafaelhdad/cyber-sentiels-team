<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WafProxy\StoreWafProxyRequest;
use App\Http\Requests\WafProxy\UpdateWafProxyRequest;
use App\Http\Resources\WafProxyResource;
use App\Models\Project;
use App\Models\WafProxy;
use App\Services\WafProxyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WafProxyController extends Controller
{
  public function __construct(
    protected WafProxyService $wafProxyService
  ) {}

  /**
   * Display a listing of WAF proxies for a project.
   */
  public function index(Project $project): AnonymousResourceCollection
  {
    $this->authorize('view', $project);

    $proxies = $this->wafProxyService->getProjectProxies($project);

    return WafProxyResource::collection($proxies);
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

    return response()->json([
      'proxy' => new WafProxyResource($proxy),
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
   */
  public function stats(Project $project): JsonResponse
  {
    $this->authorize('view', $project);

    $stats = $this->wafProxyService->getProjectStats($project);

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
}
