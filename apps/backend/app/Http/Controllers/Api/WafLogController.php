<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\WafProxy;
use App\Services\WafLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WafLogController extends Controller
{
  public function __construct(
    protected WafLogService $wafLogService
  ) {}

  /**
   * Get recent logs for a project's WAF proxies.
   */
  public function index(Request $request, Project $project): JsonResponse
  {
    $this->authorize('view', $project);

    $limit = min((int) $request->input('limit', 100), 500);
    $proxyId = $request->input('proxy_id');

    if ($proxyId) {
      $proxy = WafProxy::findOrFail($proxyId);
      if ($proxy->project_id !== $project->id) {
        abort(404, 'WAF proxy not found for this project');
      }
      $logs = $this->wafLogService->getProxyLogs($proxy, $limit);
    } else {
      $logs = $this->wafLogService->getProjectLogs($project, $limit);
    }

    return response()->json([
      'logs' => $logs,
      'count' => $logs->count(),
    ]);
  }

  /**
   * Get log summary/statistics for a project's WAF proxies.
   */
  public function summary(Request $request, Project $project): JsonResponse
  {
    $this->authorize('view', $project);

    $proxyId = $request->input('proxy_id');

    if ($proxyId) {
      $proxy = WafProxy::findOrFail($proxyId);
      if ($proxy->project_id !== $project->id) {
        abort(404, 'WAF proxy not found for this project');
      }
      $summary = $this->wafLogService->getProxySummary($proxy);
    } else {
      $summary = $this->wafLogService->getProjectSummary($project);
    }

    return response()->json([
      'summary' => $summary,
    ]);
  }
}
