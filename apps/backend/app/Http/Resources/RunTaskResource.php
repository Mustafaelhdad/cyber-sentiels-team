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
      'logs_path' => $this->logs_path,
      'report_path' => $this->report_path,
      'has_report' => $this->hasReport(),
      'meta_json' => $this->meta_json,
      'created_at' => $this->created_at->toIso8601String(),
      'updated_at' => $this->updated_at->toIso8601String(),
    ];
  }
}
