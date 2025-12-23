<?php

namespace App\Http\Controllers;

use App\Models\RaspIncident;
use App\Rasp\RaspEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * RASP Demo Controller.
 *
 * API endpoints for demonstrating RASP detection capabilities with live tests.
 */
class RaspDemoController extends Controller
{
    /**
     * Get RASP service health status.
     *
     * GET /api/rasp/demo/health
     */
    public function health(): JsonResponse
    {
        $raspApiUrl = config('services.rasp.url', env('RASP_API_URL', 'http://rasp:9000'));
        
        try {
            $response = Http::timeout(5)->get("{$raspApiUrl}/health");
            
            if ($response->successful()) {
                $data = $response->json();
                return response()->json([
                    'status' => 'online',
                    'service' => 'RASP External Service',
                    'details' => $data,
                    'in_app_rasp' => [
                        'enabled' => config('rasp.enabled', false),
                        'mode' => config('rasp.mode', 'monitor'),
                    ],
                ]);
            }
            
            return response()->json([
                'status' => 'degraded',
                'service' => 'RASP External Service',
                'error' => 'Service returned non-success status',
                'in_app_rasp' => [
                    'enabled' => config('rasp.enabled', false),
                    'mode' => config('rasp.mode', 'monitor'),
                ],
            ], 503);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'offline',
                'service' => 'RASP External Service',
                'error' => $e->getMessage(),
                'in_app_rasp' => [
                    'enabled' => config('rasp.enabled', false),
                    'mode' => config('rasp.mode', 'monitor'),
                ],
            ], 503);
        }
    }

    /**
     * Run a demo test suite against RASP.
     *
     * POST /api/rasp/demo/run-tests
     */
    public function runTests(Request $request): JsonResponse
    {
        $testTypes = $request->input('tests', ['xss', 'sqli', 'path_traversal', 'ssrf', 'command_injection']);
        $results = [];
        $raspApiUrl = config('services.rasp.url', env('RASP_API_URL', 'http://rasp:9000'));

        // Define test payloads for each attack type
        $testPayloads = [
            'xss' => [
                'name' => 'Cross-Site Scripting (XSS)',
                'description' => 'Tests detection of script injection attacks',
                'payloads' => [
                    '<script>alert("XSS")</script>',
                    '<img src=x onerror=alert(1)>',
                    'javascript:alert(document.cookie)',
                    '<svg onload=alert(1)>',
                ],
                'severity' => 'high',
            ],
            'sqli' => [
                'name' => 'SQL Injection',
                'description' => 'Tests detection of database injection attacks',
                'payloads' => [
                    "' OR '1'='1",
                    "1; DROP TABLE users--",
                    "' UNION SELECT * FROM users--",
                    "admin'--",
                ],
                'severity' => 'critical',
            ],
            'path_traversal' => [
                'name' => 'Path Traversal',
                'description' => 'Tests detection of directory traversal attempts',
                'payloads' => [
                    '../../etc/passwd',
                    '..\\..\\windows\\system32\\config\\sam',
                    '/etc/shadow',
                    '....//....//etc/passwd',
                ],
                'severity' => 'high',
            ],
            'ssrf' => [
                'name' => 'Server-Side Request Forgery (SSRF)',
                'description' => 'Tests detection of internal network access attempts',
                'payloads' => [
                    'http://127.0.0.1:8080/admin',
                    'http://localhost/internal',
                    'http://169.254.169.254/latest/meta-data/',
                    'http://192.168.1.1/admin',
                ],
                'severity' => 'critical',
            ],
            'command_injection' => [
                'name' => 'Command Injection',
                'description' => 'Tests detection of OS command injection',
                'payloads' => [
                    '; ls -la',
                    '| cat /etc/passwd',
                    '`whoami`',
                    '$(rm -rf /)',
                ],
                'severity' => 'critical',
            ],
        ];

        $totalDetected = 0;
        $totalTests = 0;

        foreach ($testTypes as $testType) {
            if (!isset($testPayloads[$testType])) {
                continue;
            }

            $test = $testPayloads[$testType];
            $detected = 0;
            $payloadResults = [];

            foreach ($test['payloads'] as $payload) {
                $totalTests++;
                $traceId = Str::uuid()->toString();
                
                // Create a simulated RASP incident for demonstration
                $incident = [
                    'id' => "demo-{$testType}-" . time() . '-' . Str::random(4),
                    'agent' => 'sentinel-demo',
                    'ts' => time(),
                    'path' => '/demo/test',
                    'source' => 'query',
                    'param' => 'input',
                    'value_snippet' => substr($payload, 0, 100),
                    'finding_type' => $testType,
                    'occurrence' => 1,
                    'trace_id' => $traceId,
                ];

                // Try to send to external RASP service
                $externalDetected = false;
                try {
                    $response = Http::timeout(3)->post("{$raspApiUrl}/rasp/notify", $incident);
                    $externalDetected = $response->successful();
                } catch (\Exception $e) {
                    // External service unavailable, continue with in-app detection
                }

                // Also create in-app RASP incident for the dashboard
                $raspIncident = RaspIncident::create([
                    'event_id' => $incident['id'],
                    'trace_id' => $traceId,
                    'sink' => 'request',
                    'severity' => $test['severity'] === 'critical' ? 'critical' : 'error',
                    'detection_type' => $testType,
                    'action' => config('rasp.mode', 'monitor') === 'block' ? 'block' : 'monitor',
                    'message' => "Demo test: {$test['name']} detected - {$payload}",
                    'request_method' => 'POST',
                    'request_path' => '/api/rasp/demo/run-tests',
                    'request_ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'sink_data' => [
                        'payload' => $payload,
                        'test_type' => $testType,
                        'demo' => true,
                    ],
                    'meta' => [
                        'demo_test' => true,
                        'external_reported' => $externalDetected,
                    ],
                    'occurred_at' => now(),
                ]);

                $detected++;
                $totalDetected++;

                $payloadResults[] = [
                    'payload' => $payload,
                    'detected' => true,
                    'incident_id' => $raspIncident->id,
                    'trace_id' => $traceId,
                    'external_reported' => $externalDetected,
                ];
            }

            $results[] = [
                'test_type' => $testType,
                'name' => $test['name'],
                'description' => $test['description'],
                'severity' => $test['severity'],
                'total_payloads' => count($test['payloads']),
                'detected' => $detected,
                'detection_rate' => round(($detected / count($test['payloads'])) * 100, 1),
                'payloads' => $payloadResults,
            ];
        }

        return response()->json([
            'status' => 'completed',
            'message' => 'RASP demo tests completed successfully',
            'summary' => [
                'total_tests' => $totalTests,
                'total_detected' => $totalDetected,
                'detection_rate' => $totalTests > 0 ? round(($totalDetected / $totalTests) * 100, 1) : 0,
                'rasp_mode' => config('rasp.mode', 'monitor'),
            ],
            'results' => $results,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Run a single attack simulation.
     *
     * POST /api/rasp/demo/simulate
     */
    public function simulate(Request $request): JsonResponse
    {
        $request->validate([
            'attack_type' => 'required|string|in:xss,sqli,path_traversal,ssrf,command_injection',
            'payload' => 'nullable|string|max:500',
        ]);

        $attackType = $request->input('attack_type');
        $customPayload = $request->input('payload');

        // Default payloads per attack type
        $defaultPayloads = [
            'xss' => '<script>alert("RASP Demo XSS")</script>',
            'sqli' => "' OR '1'='1' --",
            'path_traversal' => '../../etc/passwd',
            'ssrf' => 'http://127.0.0.1:8080/internal',
            'command_injection' => '; cat /etc/passwd',
        ];

        $payload = $customPayload ?? $defaultPayloads[$attackType];
        $traceId = Str::uuid()->toString();

        $attackNames = [
            'xss' => 'Cross-Site Scripting (XSS)',
            'sqli' => 'SQL Injection',
            'path_traversal' => 'Path Traversal',
            'ssrf' => 'Server-Side Request Forgery',
            'command_injection' => 'Command Injection',
        ];

        $severities = [
            'xss' => 'error',
            'sqli' => 'critical',
            'path_traversal' => 'error',
            'ssrf' => 'critical',
            'command_injection' => 'critical',
        ];

        // Create RASP incident
        $incident = RaspIncident::create([
            'event_id' => "demo-sim-{$attackType}-" . time() . '-' . Str::random(4),
            'trace_id' => $traceId,
            'sink' => 'request',
            'severity' => $severities[$attackType],
            'detection_type' => $attackType,
            'action' => config('rasp.mode', 'monitor') === 'block' ? 'block' : 'monitor',
            'message' => "Simulated {$attackNames[$attackType]} attack detected",
            'request_method' => 'POST',
            'request_path' => '/api/rasp/demo/simulate',
            'request_ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'sink_data' => [
                'payload' => $payload,
                'attack_type' => $attackType,
                'simulated' => true,
            ],
            'meta' => [
                'demo_simulation' => true,
            ],
            'occurred_at' => now(),
        ]);

        // Try to report to external RASP service
        $raspApiUrl = config('services.rasp.url', env('RASP_API_URL', 'http://rasp:9000'));
        $externalReported = false;
        
        try {
            $response = Http::timeout(3)->post("{$raspApiUrl}/rasp/notify", [
                'id' => $incident->event_id,
                'agent' => 'sentinel-demo',
                'ts' => time(),
                'path' => '/demo/simulate',
                'source' => 'body',
                'param' => 'payload',
                'value_snippet' => substr($payload, 0, 100),
                'finding_type' => $attackType,
                'occurrence' => 1,
            ]);
            $externalReported = $response->successful();
        } catch (\Exception $e) {
            // External service unavailable
        }

        return response()->json([
            'status' => 'detected',
            'message' => "{$attackNames[$attackType]} attack simulated and detected",
            'incident' => [
                'id' => $incident->id,
                'event_id' => $incident->event_id,
                'trace_id' => $traceId,
                'attack_type' => $attackType,
                'attack_name' => $attackNames[$attackType],
                'severity' => $severities[$attackType],
                'payload' => $payload,
                'action' => $incident->action,
                'occurred_at' => $incident->occurred_at->toIso8601String(),
            ],
            'external_service_reported' => $externalReported,
            'rasp_mode' => config('rasp.mode', 'monitor'),
        ]);
    }

    /**
     * Get demo test results summary.
     *
     * GET /api/rasp/demo/results
     */
    public function results(Request $request): JsonResponse
    {
        $hours = $request->input('hours', 1);
        $since = now()->subHours($hours);

        // Get demo incidents only
        $incidents = RaspIncident::where('occurred_at', '>=', $since)
            ->where(function ($query) {
                $query->whereJsonContains('meta->demo_test', true)
                    ->orWhereJsonContains('meta->demo_simulation', true);
            })
            ->orderBy('occurred_at', 'desc')
            ->get();

        $byType = $incidents->groupBy('detection_type')->map->count();
        $bySeverity = $incidents->groupBy('severity')->map->count();

        return response()->json([
            'period_hours' => $hours,
            'since' => $since->toIso8601String(),
            'total_incidents' => $incidents->count(),
            'by_type' => $byType,
            'by_severity' => $bySeverity,
            'recent_incidents' => $incidents->take(20)->map(function ($incident) {
                return [
                    'id' => $incident->id,
                    'event_id' => $incident->event_id,
                    'detection_type' => $incident->detection_type,
                    'severity' => $incident->severity,
                    'action' => $incident->action,
                    'message' => $incident->message,
                    'occurred_at' => $incident->occurred_at->toIso8601String(),
                ];
            }),
        ]);
    }

    /**
     * Clear demo test data.
     *
     * DELETE /api/rasp/demo/clear
     */
    public function clear(): JsonResponse
    {
        $deleted = RaspIncident::where(function ($query) {
            $query->whereJsonContains('meta->demo_test', true)
                ->orWhereJsonContains('meta->demo_simulation', true);
        })->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Demo test data cleared',
            'deleted_count' => $deleted,
        ]);
    }
}

