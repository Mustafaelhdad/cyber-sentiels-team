<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthzToolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Authorization Tool Controller
 * 
 * Handles API endpoints for the Authorization Tool Docker container.
 * Provides RBAC/ABAC authorization, user management, and access control.
 */
class AuthzToolController extends Controller
{
  protected AuthzToolService $authzToolService;

  public function __construct(AuthzToolService $authzToolService)
  {
    $this->authzToolService = $authzToolService;
  }

  /**
   * Check Authorization Tool service health.
   * 
   * GET /api/authz-tool/health
   */
  public function health(): JsonResponse
  {
    $available = $this->authzToolService->isAvailable();
    $health = $available ? $this->authzToolService->getHealth() : null;

    return response()->json([
      'available' => $available,
      'service' => 'authz-tool',
      'url' => config('services.authz_tool.url', 'http://authz:5001'),
      'health' => $health,
    ], $available ? 200 : 503);
  }

  /**
   * Get Authorization Tool statistics.
   * 
   * GET /api/authz-tool/stats
   */
  public function stats(): JsonResponse
  {
    $stats = $this->authzToolService->getStats();

    if (!$stats) {
      return response()->json([
        'error' => 'Unable to fetch Authorization Tool statistics',
        'message' => 'The Authorization Tool service may be unavailable',
      ], 503);
    }

    return response()->json($stats);
  }

  /**
   * Authorize an action for a user.
   * 
   * POST /api/authz-tool/authorize
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function checkAuthorization(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'email' => 'required|string|email',
      'action' => 'nullable|string|in:read,write,delete,manage',
      'resource' => 'nullable|string|max:100',
      'policy' => 'nullable|string|in:RBAC,ABAC',
      'context' => 'nullable|array',
    ]);

    $result = $this->authzToolService->authorize(
      $validated['email'],
      $validated['action'] ?? 'read',
      $validated['resource'] ?? null,
      $validated['policy'] ?? 'RBAC',
      $validated['context'] ?? []
    );

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'authorized' => false,
      'error' => $result['error'],
    ], $result['status'] ?? 403);
  }

  /**
   * Get all privileges for a user.
   * 
   * POST /api/authz-tool/privileges
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function privileges(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'email' => 'required|string|email',
      'policy' => 'nullable|string|in:RBAC,ABAC',
      'context' => 'nullable|array',
    ]);

    $result = $this->authzToolService->getPrivileges(
      $validated['email'],
      $validated['policy'] ?? 'RBAC',
      $validated['context'] ?? []
    );

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 404);
  }

  /**
   * List all users.
   * 
   * GET /api/authz-tool/users
   * 
   * @return JsonResponse
   */
  public function listUsers(): JsonResponse
  {
    $users = $this->authzToolService->listUsers();

    if ($users === null) {
      return response()->json([
        'error' => 'Failed to fetch users',
        'message' => 'The Authorization Tool service may be unavailable',
      ], 503);
    }

    return response()->json($users);
  }

  /**
   * Create a new user.
   * 
   * POST /api/authz-tool/users
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function createUser(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'email' => 'required|string|email|max:100',
      'password' => 'required|string|min:8|max:100',
      'role' => 'nullable|string|in:admin,manager,user,member,viewer,guest',
      'group' => 'nullable|string|max:50',
    ]);

    $result = $this->authzToolService->createUser(
      $validated['email'],
      $validated['password'],
      $validated['role'] ?? 'user',
      $validated['group'] ?? 'general'
    );

    if ($result['success']) {
      return response()->json($result['data'], 201);
    }

    $response = ['error' => $result['error']];
    if (isset($result['issues'])) {
      $response['issues'] = $result['issues'];
    }

    return response()->json($response, $result['status'] ?? 400);
  }

  /**
   * Update a user.
   * 
   * PUT /api/authz-tool/users/{email}
   * 
   * @param Request $request
   * @param string $email
   * @return JsonResponse
   */
  public function updateUser(Request $request, string $email): JsonResponse
  {
    $validated = $request->validate([
      'role' => 'nullable|string|in:admin,manager,user,member,viewer,guest',
      'group' => 'nullable|string|max:50',
      'password' => 'nullable|string|min:8|max:100',
    ]);

    // Filter out null values
    $data = array_filter($validated, fn($value) => $value !== null);

    if (empty($data)) {
      return response()->json([
        'error' => 'No update data provided',
      ], 400);
    }

    $result = $this->authzToolService->updateUser($email, $data);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    $response = ['error' => $result['error']];
    if (isset($result['issues'])) {
      $response['issues'] = $result['issues'];
    }

    return response()->json($response, $result['status'] ?? 400);
  }

  /**
   * Delete a user.
   * 
   * DELETE /api/authz-tool/users/{email}
   * 
   * @param string $email
   * @return JsonResponse
   */
  public function deleteUser(string $email): JsonResponse
  {
    $result = $this->authzToolService->deleteUser($email);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 404);
  }

  /**
   * Get all available roles and their privileges.
   * 
   * GET /api/authz-tool/roles
   * 
   * @return JsonResponse
   */
  public function roles(): JsonResponse
  {
    $roles = $this->authzToolService->getRoles();

    if ($roles === null) {
      return response()->json([
        'error' => 'Failed to fetch roles',
        'message' => 'The Authorization Tool service may be unavailable',
      ], 503);
    }

    return response()->json($roles);
  }

  /**
   * Get all resources and their permission requirements.
   * 
   * GET /api/authz-tool/resources
   * 
   * @return JsonResponse
   */
  public function resources(): JsonResponse
  {
    $resources = $this->authzToolService->getResources();

    if ($resources === null) {
      return response()->json([
        'error' => 'Failed to fetch resources',
        'message' => 'The Authorization Tool service may be unavailable',
      ], 503);
    }

    return response()->json($resources);
  }

  /**
   * Verify user credentials.
   * 
   * POST /api/authz-tool/verify
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function verify(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'email' => 'required|string|email',
      'password' => 'required|string',
    ]);

    $result = $this->authzToolService->verifyCredentials(
      $validated['email'],
      $validated['password']
    );

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'valid' => false,
      'error' => $result['error'],
    ], $result['status'] ?? 401);
  }

  /**
   * Get authorization logs.
   * 
   * GET /api/authz-tool/logs
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function logs(Request $request): JsonResponse
  {
    $limit = $request->query('limit', 100);
    $logs = $this->authzToolService->getLogs((int) $limit);

    if ($logs === null) {
      return response()->json([
        'error' => 'Failed to fetch logs',
        'message' => 'The Authorization Tool service may be unavailable',
      ], 503);
    }

    return response()->json($logs);
  }

  /**
   * Check password strength.
   * 
   * POST /api/authz-tool/password-strength
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function passwordStrength(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'password' => 'required|string',
    ]);

    $result = $this->authzToolService->checkPasswordStrength($validated['password']);

    if ($result === null) {
      return response()->json([
        'error' => 'Failed to check password strength',
        'message' => 'The Authorization Tool service may be unavailable',
      ], 503);
    }

    return response()->json($result);
  }

  /**
   * Test the complete authorization flow.
   * 
   * POST /api/authz-tool/test-flow
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function testFlow(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'email' => 'required|string|email',
      'password' => 'required|string|min:8',
      'role' => 'nullable|string|in:admin,manager,user,member,viewer,guest',
      'group' => 'nullable|string|max:50',
    ]);

    $result = $this->authzToolService->testAuthzFlow(
      $validated['email'],
      $validated['password'],
      $validated['role'] ?? 'user',
      $validated['group'] ?? 'general'
    );

    return response()->json([
      'test_results' => $result,
      'overall_success' => $result['overall_success'],
    ]);
  }
}

