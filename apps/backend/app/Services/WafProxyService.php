<?php

namespace App\Services;

use App\Models\Project;
use App\Models\WafProxy;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class WafProxyService
{
  /**
   * Path to the WAF token map file.
   */
  protected string $mapFilePath;

  public function __construct()
  {
    $this->mapFilePath = config('waf.map_file_path', storage_path('app/waf/token_map.conf'));
  }

  /**
   * Get all WAF proxies for a project.
   */
  public function getProjectProxies(Project $project): Collection
  {
    return $project->wafProxies()
      ->orderBy('created_at', 'desc')
      ->get();
  }

  /**
   * Create a new WAF proxy for a project.
   */
  public function create(Project $project, array $data): WafProxy
  {
    $proxy = $project->wafProxies()->create([
      'name' => $data['name'] ?? null,
      'origin_url' => $this->normalizeOriginUrl($data['origin_url']),
      'status' => WafProxy::STATUS_ACTIVE,
    ]);

    $this->regenerateMapFile();

    return $proxy;
  }

  /**
   * Update a WAF proxy.
   */
  public function update(WafProxy $proxy, array $data): WafProxy
  {
    $updateData = [];

    if (isset($data['name'])) {
      $updateData['name'] = $data['name'];
    }

    if (isset($data['origin_url'])) {
      $updateData['origin_url'] = $this->normalizeOriginUrl($data['origin_url']);
    }

    if (isset($data['status'])) {
      $updateData['status'] = $data['status'];
    }

    $proxy->update($updateData);
    $this->regenerateMapFile();

    return $proxy->fresh();
  }

  /**
   * Delete a WAF proxy.
   */
  public function delete(WafProxy $proxy): bool
  {
    $result = $proxy->delete();
    $this->regenerateMapFile();

    return $result;
  }

  /**
   * Rotate (regenerate) a proxy's token.
   */
  public function rotateToken(WafProxy $proxy): WafProxy
  {
    $proxy->regenerateToken();
    $this->regenerateMapFile();

    return $proxy;
  }

  /**
   * Find a proxy by its token.
   */
  public function findByToken(string $token): ?WafProxy
  {
    return WafProxy::where('token', $token)
      ->where('status', WafProxy::STATUS_ACTIVE)
      ->first();
  }

  /**
   * Normalize origin URL (ensure proper format).
   */
  protected function normalizeOriginUrl(string $url): string
  {
    // Ensure URL has a scheme
    if (!preg_match('/^http?:\/\//', $url)) {
      $url = 'http://' . $url;
    }

    // Remove trailing slash
    return rtrim($url, '/');
  }

  /**
   * Regenerate the JSON map file for token -> origin routing.
   * Format: { "token1": "http://origin1.com", "token2": "http://origin2.com" }
   */
  public function regenerateMapFile(): void
  {
    try {
      $proxies = WafProxy::where('status', WafProxy::STATUS_ACTIVE)->get();

      // Build token -> origin map as JSON
      $tokenMap = [];
      foreach ($proxies as $proxy) {
        $tokenMap[$proxy->token] = $proxy->origin_url;
      }

      // Ensure directory exists
      $directory = dirname($this->mapFilePath);
      if (!File::isDirectory($directory)) {
        File::makeDirectory($directory, 0755, true);
      }

      // Write JSON file (pretty-printed for debugging)
      File::put($this->mapFilePath, json_encode($tokenMap, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

      Log::info('WAF token map file regenerated (JSON)', [
        'path' => $this->mapFilePath,
        'proxies_count' => $proxies->count(),
      ]);
    } catch (\Exception $e) {
      Log::error('Failed to regenerate WAF token map file', [
        'error' => $e->getMessage(),
        'path' => $this->mapFilePath,
      ]);
    }
  }

  /**
   * Update counters for a proxy based on log data.
   */
  public function updateCounters(WafProxy $proxy, int $allowed, int $blocked): void
  {
    $proxy->update([
      'requests_allowed' => $proxy->requests_allowed + $allowed,
      'requests_blocked' => $proxy->requests_blocked + $blocked,
      'requests_total' => $proxy->requests_total + $allowed + $blocked,
      'last_request_at' => now(),
    ]);
  }

  /**
   * Get summary statistics for a project's WAF proxies.
   */
  public function getProjectStats(Project $project): array
  {
    $proxies = $project->wafProxies;

    return [
      'total_proxies' => $proxies->count(),
      'active_proxies' => $proxies->where('status', WafProxy::STATUS_ACTIVE)->count(),
      'total_requests' => $proxies->sum('requests_total'),
      'total_allowed' => $proxies->sum('requests_allowed'),
      'total_blocked' => $proxies->sum('requests_blocked'),
      'block_rate' => $proxies->sum('requests_total') > 0
        ? round(($proxies->sum('requests_blocked') / $proxies->sum('requests_total')) * 100, 2)
        : 0,
    ];
  }
}
