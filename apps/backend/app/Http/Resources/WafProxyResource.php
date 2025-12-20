<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WafProxyResource extends JsonResource
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
      'project_id' => $this->project_id,
      'name' => $this->name,
      'origin_url' => $this->origin_url,
      'token' => $this->token,
      'waf_url' => $this->getWafUrl(),
      'status' => $this->status,
      'counters' => [
        'allowed' => $this->requests_allowed,
        'blocked' => $this->requests_blocked,
        'total' => $this->requests_total,
        'block_rate' => $this->requests_total > 0
          ? round(($this->requests_blocked / $this->requests_total) * 100, 2)
          : 0,
      ],
      'last_request_at' => $this->last_request_at?->toIso8601String(),
      'created_at' => $this->created_at->toIso8601String(),
      'updated_at' => $this->updated_at->toIso8601String(),
    ];
  }
}
