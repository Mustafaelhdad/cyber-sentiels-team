<?php

namespace App\Http\Controllers;

use App\Models\RaspIncident;
use App\Rasp\RaspEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * RASP Incident Controller.
 *
 * API endpoints for querying RASP security incidents.
 */
class RaspIncidentController extends Controller
{
    /**
     * List RASP incidents with filtering and pagination.
     *
     * GET /api/rasp/incidents
     */
    public function index(Request $request): JsonResponse
    {
        $query = RaspIncident::query()
            ->orderBy('occurred_at', 'desc');

        // Filter by severity
        if ($request->has('severity')) {
            $query->where('severity', $request->input('severity'));
        }

        // Filter by sink type
        if ($request->has('sink')) {
            $query->where('sink', $request->input('sink'));
        }

        // Filter by detection type
        if ($request->has('detection_type')) {
            $query->where('detection_type', $request->input('detection_type'));
        }

        // Filter by action
        if ($request->has('action')) {
            $query->where('action', $request->input('action'));
        }

        // Filter by IP
        if ($request->has('ip')) {
            $query->where('request_ip', $request->input('ip'));
        }

        // Filter by user ID
        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Filter by trace ID
        if ($request->has('trace_id')) {
            $query->where('trace_id', $request->input('trace_id'));
        }

        // Filter by time range
        if ($request->has('from')) {
            $query->where('occurred_at', '>=', $request->input('from'));
        }
        if ($request->has('to')) {
            $query->where('occurred_at', '<=', $request->input('to'));
        }

        // High severity only
        if ($request->boolean('high_severity')) {
            $query->highSeverity();
        }

        // Blocked only
        if ($request->boolean('blocked')) {
            $query->blocked();
        }

        $perPage = min($request->input('per_page', 25), 100);
        $incidents = $query->paginate($perPage);

        return response()->json($incidents);
    }

    /**
     * Get a single incident by ID.
     *
     * GET /api/rasp/incidents/{id}
     */
    public function show(int $id): JsonResponse
    {
        $incident = RaspIncident::findOrFail($id);

        return response()->json([
            'data' => $incident,
        ]);
    }

    /**
     * Get incidents by trace ID (all events in a request).
     *
     * GET /api/rasp/traces/{traceId}
     */
    public function trace(string $traceId): JsonResponse
    {
        $incidents = RaspIncident::forTrace($traceId)
            ->orderBy('occurred_at', 'asc')
            ->get();

        return response()->json([
            'data' => $incidents,
            'trace_id' => $traceId,
            'count' => $incidents->count(),
        ]);
    }

    /**
     * Get RASP statistics summary.
     *
     * GET /api/rasp/stats
     */
    public function stats(Request $request): JsonResponse
    {
        $hours = $request->input('hours', 24);
        $since = now()->subHours($hours);

        // Total counts by severity
        $bySeverity = RaspIncident::where('occurred_at', '>=', $since)
            ->selectRaw('severity, COUNT(*) as count')
            ->groupBy('severity')
            ->pluck('count', 'severity')
            ->toArray();

        // Total counts by sink
        $bySink = RaspIncident::where('occurred_at', '>=', $since)
            ->selectRaw('sink, COUNT(*) as count')
            ->groupBy('sink')
            ->pluck('count', 'sink')
            ->toArray();

        // Total counts by detection type
        $byDetection = RaspIncident::where('occurred_at', '>=', $since)
            ->whereNotNull('detection_type')
            ->selectRaw('detection_type, COUNT(*) as count')
            ->groupBy('detection_type')
            ->pluck('count', 'detection_type')
            ->toArray();

        // Total counts by action
        $byAction = RaspIncident::where('occurred_at', '>=', $since)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->pluck('count', 'action')
            ->toArray();

        // Top offending IPs
        $topIps = RaspIncident::where('occurred_at', '>=', $since)
            ->whereNotNull('request_ip')
            ->selectRaw('request_ip, COUNT(*) as count')
            ->groupBy('request_ip')
            ->orderByDesc('count')
            ->limit(10)
            ->pluck('count', 'request_ip')
            ->toArray();

        // Hourly trend
        $hourlyTrend = RaspIncident::where('occurred_at', '>=', $since)
            ->selectRaw('DATE_FORMAT(occurred_at, "%Y-%m-%d %H:00:00") as hour, COUNT(*) as count')
            ->groupBy('hour')
            ->orderBy('hour')
            ->pluck('count', 'hour')
            ->toArray();

        return response()->json([
            'period_hours' => $hours,
            'since' => $since->toIso8601String(),
            'totals' => [
                'total' => array_sum($bySeverity),
                'blocked' => $byAction[RaspEvent::ACTION_BLOCK] ?? 0,
                'monitored' => $byAction[RaspEvent::ACTION_MONITOR] ?? 0,
                'high_severity' => ($bySeverity[RaspEvent::SEVERITY_ERROR] ?? 0)
                    + ($bySeverity[RaspEvent::SEVERITY_CRITICAL] ?? 0),
            ],
            'by_severity' => $bySeverity,
            'by_sink' => $bySink,
            'by_detection' => $byDetection,
            'by_action' => $byAction,
            'top_ips' => $topIps,
            'hourly_trend' => $hourlyTrend,
        ]);
    }

    /**
     * Get detection types summary.
     *
     * GET /api/rasp/detections
     */
    public function detections(Request $request): JsonResponse
    {
        $hours = $request->input('hours', 24);
        $since = now()->subHours($hours);

        $detections = RaspIncident::where('occurred_at', '>=', $since)
            ->whereNotNull('detection_type')
            ->selectRaw('detection_type, action, COUNT(*) as count')
            ->groupBy('detection_type', 'action')
            ->get()
            ->groupBy('detection_type')
            ->map(function ($items) {
                return [
                    'total' => $items->sum('count'),
                    'blocked' => $items->where('action', RaspEvent::ACTION_BLOCK)->sum('count'),
                    'monitored' => $items->where('action', RaspEvent::ACTION_MONITOR)->sum('count'),
                ];
            });

        return response()->json([
            'period_hours' => $hours,
            'detections' => $detections,
        ]);
    }

    /**
     * Get recent high-severity incidents.
     *
     * GET /api/rasp/alerts
     */
    public function alerts(Request $request): JsonResponse
    {
        $limit = min($request->input('limit', 20), 100);

        $alerts = RaspIncident::highSeverity()
            ->orWhere('action', RaspEvent::ACTION_BLOCK)
            ->orderBy('occurred_at', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $alerts,
            'count' => $alerts->count(),
        ]);
    }
}

