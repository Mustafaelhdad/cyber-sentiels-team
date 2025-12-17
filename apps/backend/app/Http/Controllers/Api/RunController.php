<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Run\StoreRunRequest;
use App\Http\Resources\RunResource;
use App\Models\Project;
use App\Models\Run;
use App\Services\RunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RunController extends Controller
{
  public function __construct(
    protected RunService $runService
  ) {}

  /**
   * Display a listing of runs for a project.
   */
  public function index(Request $request, Project $project): AnonymousResourceCollection
  {
    $this->authorize('view', $project);

    $runs = $this->runService->getProjectRuns($project);

    return RunResource::collection($runs);
  }

  /**
   * Store a newly created run (Apply action).
   */
  public function store(StoreRunRequest $request, Project $project): JsonResponse
  {
    $this->authorize('update', $project);

    $run = $this->runService->create($project, $request->validated());

    return response()->json([
      'message' => 'Run created and queued successfully',
      'run' => new RunResource($run->load('tasks')),
    ], 201);
  }

  /**
   * Display the specified run.
   */
  public function show(Project $project, Run $run): JsonResponse
  {
    $this->authorize('view', $project);

    return response()->json([
      'run' => new RunResource($run->load('tasks')),
    ]);
  }

  /**
   * Cancel a running run.
   */
  public function cancel(Project $project, Run $run): JsonResponse
  {
    $this->authorize('update', $project);

    $this->runService->cancel($run);

    return response()->json([
      'message' => 'Run cancelled successfully',
      'run' => new RunResource($run->fresh()->load('tasks')),
    ]);
  }
}

