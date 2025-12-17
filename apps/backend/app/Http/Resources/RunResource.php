<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RunResource extends JsonResource
{
  /**
   * Transform the resource into an array.
   *
   * @return array<string, mixed>
   */
  public function toArray(Request $request): array
  {
    return [
      'id' => $this->id,
      'user_id' => $this->user_id,
      'project_id' => $this->project_id,
      'module' => $this->module,
      'target_type' => $this->target_type,
      'target_value' => $this->target_value,
      'status' => $this->status,
      'started_at' => $this->started_at?->toIso8601String(),
      'finished_at' => $this->finished_at?->toIso8601String(),
      'tasks' => RunTaskResource::collection($this->whenLoaded('tasks')),
      'created_at' => $this->created_at->toIso8601String(),
      'updated_at' => $this->updated_at->toIso8601String(),
    ];
  }
}
