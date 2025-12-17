<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RunTaskResource extends JsonResource
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
      'run_id' => $this->run_id,
      'tool' => $this->tool,
      'status' => $this->status,
      'progress' => $this->progress,
      'has_report' => !empty($this->report_path),
      'error_message' => $this->error_message,
      'started_at' => $this->started_at?->toIso8601String(),
      'completed_at' => $this->completed_at?->toIso8601String(),
      'created_at' => $this->created_at->toIso8601String(),
    ];
  }
}

