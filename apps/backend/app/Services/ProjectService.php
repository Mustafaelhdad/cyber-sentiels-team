<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class ProjectService
{
  /**
   * Get all projects for a user.
   */
  public function getUserProjects(User $user): Collection
  {
    return $user->projects()
      ->withCount('runs')
      ->orderBy('updated_at', 'desc')
      ->get();
  }

  /**
   * Create a new project.
   */
  public function create(User $user, array $data): Project
  {
    return $user->projects()->create([
      'name' => $data['name'],
      'description' => $data['description'] ?? null,
    ]);
  }

  /**
   * Update a project.
   */
  public function update(Project $project, array $data): Project
  {
    $project->update([
      'name' => $data['name'] ?? $project->name,
      'description' => $data['description'] ?? $project->description,
    ]);

    return $project->fresh();
  }

  /**
   * Delete a project and all related runs.
   */
  public function delete(Project $project): bool
  {
    // Runs and tasks will be cascade deleted via DB constraints
    return $project->delete();
  }
}

