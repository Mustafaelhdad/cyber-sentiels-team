<?php

namespace App\Services;

use App\Models\Project;
use App\Models\WafProxy;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class WafLogService
{
  /**
   * Path to the Flask WAF suspicious activity log file.
   * Format: JSON lines with attack detection records.
   */
  protected string $flaskWafLogFile;

  public function __construct()
  {
    $this->flaskWafLogFile = config('waf.flask_log_file', '/var/log/waf/suspicious.log');
  }

  /**
   * Get recent logs for a project's WAF proxies.
   */
  public function getProjectLogs(Project $project, int $limit = 100): Collection
  {
    $tokens = $project->wafProxies->pluck('token')->toArray();

    if (empty($tokens)) {
      return collect([]);
    }

    $logs = $this->parseAccessLogs($limit * 2);

    return $logs->filter(function ($log) use ($tokens) {
      return in_array($log['token'] ?? null, $tokens);
    })->take($limit)->values();
  }

  /**
   * Get recent logs for a specific WAF proxy.
   */
  public function getProxyLogs(WafProxy $proxy, int $limit = 100): Collection
  {
    $logs = $this->parseAccessLogs($limit * 2);

    return $logs->filter(function ($log) use ($proxy) {
      return ($log['token'] ?? null) === $proxy->token;
    })->take($limit)->values();
  }

  /**
   * Get log summary for a project.
   */
  public function getProjectSummary(Project $project): array
  {
    $logs = $this->getProjectLogs($project, 1000);

    return $this->calculateSummary($logs);
  }

  /**
   * Get log summary for a proxy.
   */
  public function getProxySummary(WafProxy $proxy): array
  {
    $logs = $this->getProxyLogs($proxy, 1000);

    return $this->calculateSummary($logs);
  }

  /**
   * Calculate summary statistics from logs.
   */
  protected function calculateSummary(Collection $logs): array
  {
    $total = $logs->count();
    $blocked = $logs->where('blocked', true)->count();
    $allowed = $total - $blocked;

    $byStatus = $logs->groupBy('status')->map->count();
    $byMethod = $logs->groupBy('method')->map->count();

    // Group by attack type (Flask WAF specific)
    $byAttackType = $logs->where('blocked', true)
      ->groupBy('attack_type')
      ->map->count()
      ->sortDesc()
      ->toArray();

    $topBlocked = $logs->where('blocked', true)
      ->groupBy('path')
      ->map->count()
      ->sortDesc()
      ->take(10)
      ->toArray();

    // Top attacking IPs
    $topIps = $logs->where('blocked', true)
      ->groupBy('ip')
      ->map->count()
      ->sortDesc()
      ->take(10)
      ->toArray();

    $timeline = $logs->groupBy(function ($log) {
      return substr($log['timestamp'] ?? '', 0, 13) . ':00:00';
    })->map(function ($group) {
      return [
        'total' => $group->count(),
        'blocked' => $group->where('blocked', true)->count(),
        'allowed' => $group->where('blocked', false)->count(),
      ];
    })->sortKeys();

    return [
      'total' => $total,
      'allowed' => $allowed,
      'blocked' => $blocked,
      'block_rate' => $total > 0 ? round(($blocked / $total) * 100, 2) : 0,
      'by_status' => $byStatus->toArray(),
      'by_method' => $byMethod->toArray(),
      'by_attack_type' => $byAttackType,
      'top_blocked_paths' => $topBlocked,
      'top_attacking_ips' => $topIps,
      'timeline' => $timeline->toArray(),
    ];
  }

  /**
   * Parse Flask WAF suspicious.log file.
   * Each line is a JSON object representing a blocked/detected request.
   */
  public function parseAccessLogs(int $limit = 500): Collection
  {
    $logs = collect([]);

    if (!File::exists($this->flaskWafLogFile)) {
      Log::debug('Flask WAF log file not found', ['path' => $this->flaskWafLogFile]);
      return $logs;
    }

    try {
      $lines = $this->tailFile($this->flaskWafLogFile, $limit);

      foreach ($lines as $line) {
        $parsed = $this->parseFlaskWafLogLine($line);
        if ($parsed) {
          $logs->push($parsed);
        }
      }

      // Flask writes one log line per matched pattern, which inflates counts.
      // Deduplicate to a single event per request (per IP/method/path/payload hash/second).
      $logs = $this->dedupeLogs($logs);
    } catch (\Exception $e) {
      Log::error('Failed to parse Flask WAF log', [
        'error' => $e->getMessage(),
        'path' => $this->flaskWafLogFile,
      ]);
    }

    return $logs->sortByDesc('timestamp')->values();
  }

  /**
   * Parse a single Flask WAF log line (JSON format).
   * 
   * Expected format:
   * {
   *   "time": "2024-01-15T10:30:00Z",
   *   "ip": "192.168.1.1",
   *   "attack": "SQL Injection",
   *   "pattern": "\\bunion\\b.*\\bselect\\b",
   *   "method": "GET",
   *   "path": "/waf/token123/page",
   *   "ua": "Mozilla/5.0...",
   *   "referer": "",
   *   "snippet": "id=1' union select...",
   *   "payload_hash": "abc123..."
   * }
   */
  protected function parseFlaskWafLogLine(string $line): ?array
  {
    $data = json_decode($line, true);

    if (!$data || !isset($data['time'])) {
      return null;
    }

    $token = $this->extractTokenFromUri($data['path'] ?? '');
    $blocked = (bool)($data['blocked'] ?? true);
    $status = $data['status'] ?? ($blocked ? 403 : 200);

    return [
      'timestamp' => $data['time'] ?? now()->toIso8601String(),
      'ip' => $data['ip'] ?? 'unknown',
      'method' => $data['method'] ?? 'GET',
      'path' => $data['path'] ?? '/',
      'status' => $status,
      'size' => 0,
      'response_time' => 0,
      'token' => $token,
      'blocked' => $blocked,
      'attack_type' => $data['attack'] ?? null,
      'pattern' => $data['pattern'] ?? null,
      'snippet' => $data['snippet'] ?? null,
      'payload_hash' => $data['payload_hash'] ?? null,
      'user_agent' => $data['ua'] ?? null,
      'referer' => $data['referer'] ?? null,
    ];
  }

  /**
   * Extract token from URI path like /waf/{token}/...
   */
  protected function extractTokenFromUri(string $uri): ?string
  {
    if (preg_match('/^\/waf\/([a-zA-Z0-9]+)/', $uri, $matches)) {
      return $matches[1];
    }
    return null;
  }

  /**
   * Deduplicate multiple log lines for the same request.
   * Flask logs once per matched pattern; group by IP/method/path/payload_hash and second.
   */
  protected function dedupeLogs(Collection $logs): Collection
  {
    $seen = [];

    foreach ($logs as $log) {
      $bucketTs = substr($log['timestamp'] ?? '', 0, 19); // second precision
      $payloadHash = $log['payload_hash'] ?? '';
      $key = implode('|', [
        $log['ip'] ?? 'unknown',
        $log['method'] ?? 'GET',
        $log['path'] ?? '/',
        $payloadHash,
        $bucketTs,
      ]);

      if (!isset($seen[$key])) {
        // Track all attack types for visibility
        $log['attack_types'] = $log['attack_type'] ? [$log['attack_type']] : [];
        $seen[$key] = $log;
        continue;
      }

      $existing = $seen[$key];
      $types = $existing['attack_types'] ?? [];
      if (!empty($log['attack_type'])) {
        $types[] = $log['attack_type'];
      }
      $types = array_values(array_unique(array_filter($types)));

      $existing['attack_types'] = $types;
      $existing['attack_type'] = !empty($types)
        ? implode(', ', $types)
        : ($existing['attack_type'] ?? null);

      $seen[$key] = $existing;
    }

    return collect(array_values($seen));
  }

  /**
   * Read the last N lines from a file.
   */
  protected function tailFile(string $filepath, int $lines = 100): array
  {
    if (!File::exists($filepath)) {
      return [];
    }

    try {
      $file = new \SplFileObject($filepath, 'r');
      $file->seek(PHP_INT_MAX);
      $totalLines = $file->key();

      $start = max(0, $totalLines - $lines);
      $result = [];

      $file->seek($start);
      while (!$file->eof()) {
        $line = trim($file->fgets());
        if (!empty($line)) {
          $result[] = $line;
        }
      }

      return array_slice($result, -$lines);
    } catch (\Exception $e) {
      Log::error('Failed to tail file', [
        'file' => $filepath,
        'error' => $e->getMessage(),
      ]);
      return [];
    }
  }

  /**
   * Update counters for all active proxies from log data.
   */
  public function updateAllCountersFromLogs(): void
  {
    $logs = $this->parseAccessLogs(10000);

    $proxies = WafProxy::where('status', WafProxy::STATUS_ACTIVE)->get();

    foreach ($proxies as $proxy) {
      $proxyLogs = $logs->filter(fn($log) => ($log['token'] ?? null) === $proxy->token);

      $allowed = $proxyLogs->where('blocked', false)->count();
      $blocked = $proxyLogs->where('blocked', true)->count();

      if ($allowed > 0 || $blocked > 0) {
        $proxy->update([
          'requests_allowed' => $allowed,
          'requests_blocked' => $blocked,
          'requests_total' => $allowed + $blocked,
          'last_request_at' => now(),
        ]);
      }
    }
  }
}
