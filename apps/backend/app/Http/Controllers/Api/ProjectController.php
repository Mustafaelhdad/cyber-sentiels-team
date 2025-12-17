<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Project\StoreProjectRequest;
use App\Http\Requests\Project\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectController extends Controller
{
  public function __construct(
    protected ProjectService $projectService
  ) {}

  /**
   * Display a listing of the user's projects.
   */
  public function index(Request $request): AnonymousResourceCollection
  {
    $projects = $this->projectService->getUserProjects($request->user());

    return ProjectResource::collection($projects);
  }

  /**
   * Store a newly created project.
   */
  public function store(StoreProjectRequest $request): JsonResponse
  {
    $project = $this->projectService->create(
      $request->user(),
      $request->validated()
    );

    return response()->json([
      'message' => 'Project created successfully',
      'project' => new ProjectResource($project),
    ], 201);
  }

  /**
   * Display the specified project.
   */
  public function show(Project $project): JsonResponse
  {
    $this->authorize('view', $project);

    return response()->json([
      'project' => new ProjectResource($project->load('runs')),
    ]);
  }

  /**
   * Update the specified project.
   */
  public function update(UpdateProjectRequest $request, Project $project): JsonResponse
  {
    $this->authorize('update', $project);

    $project = $this->projectService->update($project, $request->validated());

    return response()->json([
      'message' => 'Project updated successfully',
      'project' => new ProjectResource($project),
    ]);
  }

  /**
   * Remove the specified project.
   */
  public function destroy(Project $project): JsonResponse
  {
    $this->authorize('delete', $project);

    $this->projectService->delete($project);

    return response()->json([
      'message' => 'Project deleted successfully',
    ]);
  }
}

