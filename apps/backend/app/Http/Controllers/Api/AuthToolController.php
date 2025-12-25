<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthToolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Auth Tool Controller
 * 
 * Handles API endpoints for the Authentication Tool Docker container.
 * Provides user management, JWT token operations, and OTP verification.
 */
class AuthToolController extends Controller
{
  protected AuthToolService $authToolService;

  public function __construct(AuthToolService $authToolService)
  {
    $this->authToolService = $authToolService;
  }

  /**
   * Check Auth Tool service health.
   * 
   * GET /api/auth-tool/health
   */
  public function health(): JsonResponse
  {
    $available = $this->authToolService->isAvailable();
    $health = $available ? $this->authToolService->getHealth() : null;

    return response()->json([
      'available' => $available,
      'service' => 'auth-tool',
      'url' => config('services.auth_tool.url', 'http://auth:5000'),
      'health' => $health,
    ], $available ? 200 : 503);
  }

  /**
   * Get Auth Tool statistics.
   * 
   * GET /api/auth-tool/stats
   */
  public function stats(): JsonResponse
  {
    $stats = $this->authToolService->getStats();

    if (!$stats) {
      return response()->json([
        'error' => 'Unable to fetch Auth Tool statistics',
        'message' => 'The Auth Tool service may be unavailable',
      ], 503);
    }

    return response()->json($stats);
  }

  /**
   * Register a new user in the Auth Tool.
   * 
   * POST /api/auth-tool/signup
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function signup(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'username' => 'required|string|min:3|max:50',
      'password' => 'required|string|min:6|max:100',
    ]);

    $result = $this->authToolService->signup(
      $validated['username'],
      $validated['password']
    );

    if ($result['success']) {
      return response()->json($result['data'], 201);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Sign in a user (Step 1: Credential verification).
   * 
   * POST /api/auth-tool/signin
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function signin(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'username' => 'required|string',
      'password' => 'required|string',
    ]);

    $result = $this->authToolService->signin(
      $validated['username'],
      $validated['password']
    );

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 401);
  }

  /**
   * Verify OTP code (Step 2: Complete authentication).
   * 
   * POST /api/auth-tool/verify-otp
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function verifyOtp(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'session_id' => 'required|string',
      'otp' => 'required|string',
    ]);

    $result = $this->authToolService->verifyOtp(
      $validated['session_id'],
      $validated['otp']
    );

    if ($result['success']) {
      return response()->json($result['data']);
    }

    $response = ['error' => $result['error']];
    if (isset($result['attempts_remaining'])) {
      $response['attempts_remaining'] = $result['attempts_remaining'];
    }

    return response()->json($response, $result['status'] ?? 401);
  }

  /**
   * Verify a JWT token.
   * 
   * POST /api/auth-tool/verify-token
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function verifyToken(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'token' => 'required|string',
    ]);

    $result = $this->authToolService->verifyToken($validated['token']);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'valid' => false,
      'error' => $result['error'],
    ], 401);
  }

  /**
   * Get current user info using Authorization header.
   * 
   * GET /api/auth-tool/me
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function me(Request $request): JsonResponse
  {
    $token = $this->extractBearerToken($request);

    if (!$token) {
      return response()->json([
        'error' => 'Authorization token required',
      ], 401);
    }

    $user = $this->authToolService->getCurrentUser($token);

    if (!$user) {
      return response()->json([
        'error' => 'Invalid or expired token',
      ], 401);
    }

    return response()->json($user);
  }

  /**
   * List all registered users.
   * 
   * GET /api/auth-tool/users
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function users(Request $request): JsonResponse
  {
    $token = $this->extractBearerToken($request);

    if (!$token) {
      return response()->json([
        'error' => 'Authorization token required',
      ], 401);
    }

    $users = $this->authToolService->listUsers($token);

    if ($users === null) {
      return response()->json([
        'error' => 'Failed to fetch users or unauthorized',
      ], 401);
    }

    return response()->json($users);
  }

  /**
   * Test the complete authentication flow.
   * 
   * POST /api/auth-tool/test-flow
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function testFlow(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'username' => 'required|string|min:3',
      'password' => 'required|string|min:6',
      'otp' => 'nullable|string',
    ]);

    $result = $this->authToolService->testAuthFlow(
      $validated['username'],
      $validated['password'],
      $validated['otp'] ?? '5555'
    );

    return response()->json([
      'test_results' => $result,
      'overall_success' => $result['overall_success'],
    ]);
  }

  /**
   * Extract Bearer token from Authorization header.
   *
   * @param Request $request
   * @return string|null
   */
  private function extractBearerToken(Request $request): ?string
  {
    $header = $request->header('Authorization', '');

    if (str_starts_with($header, 'Bearer ')) {
      return substr($header, 7);
    }

    // Also check for X-Auth-Token header as fallback
    return $request->header('X-Auth-Token');
  }
}

