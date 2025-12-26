<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ProvisionToolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Account Provisioning Tool Controller
 * 
 * Handles API endpoints for the Account Provisioning Tool Docker container.
 * Provides user lifecycle management, provisioning, and audit logging.
 */
class ProvisionToolController extends Controller
{
  protected ProvisionToolService $provisionToolService;

  public function __construct(ProvisionToolService $provisionToolService)
  {
    $this->provisionToolService = $provisionToolService;
  }

  /**
   * Check Account Provisioning Tool service health.
   * 
   * GET /api/provision-tool/health
   */
  public function health(): JsonResponse
  {
    $available = $this->provisionToolService->isAvailable();
    $health = $available ? $this->provisionToolService->getHealth() : null;

    return response()->json([
      'available' => $available,
      'service' => 'provision-tool',
      'url' => config('services.provision_tool.url', 'http://provision:5002'),
      'health' => $health,
    ], $available ? 200 : 503);
  }

  /**
   * Get Account Provisioning Tool statistics.
   * 
   * GET /api/provision-tool/stats
   */
  public function stats(): JsonResponse
  {
    $stats = $this->provisionToolService->getStats();

    if (!$stats) {
      return response()->json([
        'error' => 'Unable to fetch Account Provisioning Tool statistics',
        'message' => 'The Account Provisioning Tool service may be unavailable',
      ], 503);
    }

    return response()->json($stats);
  }

  /**
   * Get Account Provisioning report.
   * 
   * GET /api/provision-tool/report
   */
  public function report(): JsonResponse
  {
    $report = $this->provisionToolService->getReport();

    if (!$report) {
      return response()->json([
        'error' => 'Unable to fetch report',
        'message' => 'The Account Provisioning Tool service may be unavailable',
      ], 503);
    }

    return response()->json($report);
  }

  /**
   * List all provisioned users.
   * 
   * GET /api/provision-tool/users
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function listUsers(Request $request): JsonResponse
  {
    $filters = $request->only(['status', 'role', 'search', 'page', 'per_page']);
    $users = $this->provisionToolService->listUsers($filters);

    if ($users === null) {
      return response()->json([
        'error' => 'Failed to fetch users',
        'message' => 'The Account Provisioning Tool service may be unavailable',
      ], 503);
    }

    return response()->json($users);
  }

  /**
   * Get a specific user by ID.
   * 
   * GET /api/provision-tool/users/{id}
   * 
   * @param int $id
   * @return JsonResponse
   */
  public function getUser(int $id): JsonResponse
  {
    $user = $this->provisionToolService->getUser($id);

    if ($user === null) {
      return response()->json([
        'error' => 'User not found',
      ], 404);
    }

    return response()->json($user);
  }

  /**
   * Create/provision a new user.
   * 
   * POST /api/provision-tool/users
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function createUser(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'username' => 'required|string|min:3|max:50|regex:/^[a-zA-Z0-9_-]+$/',
      'email' => 'required|string|email|max:100',
      'role' => 'nullable|string|max:50',
      'status' => 'nullable|string|in:active,disabled,pending,suspended',
      'performed_by' => 'nullable|string|max:50',
    ]);

    $result = $this->provisionToolService->createUser($validated);

    if ($result['success']) {
      return response()->json($result['data'], 201);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Update an existing user.
   * 
   * PUT /api/provision-tool/users/{id}
   * 
   * @param Request $request
   * @param int $id
   * @return JsonResponse
   */
  public function updateUser(Request $request, int $id): JsonResponse
  {
    $validated = $request->validate([
      'username' => 'nullable|string|min:3|max:50|regex:/^[a-zA-Z0-9_-]+$/',
      'email' => 'nullable|string|email|max:100',
      'role' => 'nullable|string|max:50',
      'status' => 'nullable|string|in:active,disabled,pending,suspended',
      'performed_by' => 'nullable|string|max:50',
    ]);

    // Filter out null values
    $data = array_filter($validated, fn($value) => $value !== null);

    if (empty($data)) {
      return response()->json([
        'error' => 'No update data provided',
      ], 400);
    }

    $result = $this->provisionToolService->updateUser($id, $data);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Delete a user.
   * 
   * DELETE /api/provision-tool/users/{id}
   * 
   * @param int $id
   * @return JsonResponse
   */
  public function deleteUser(int $id): JsonResponse
  {
    $result = $this->provisionToolService->deleteUser($id);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 404);
  }

  /**
   * Disable a user account.
   * 
   * POST /api/provision-tool/users/{id}/disable
   * 
   * @param Request $request
   * @param int $id
   * @return JsonResponse
   */
  public function disableUser(Request $request, int $id): JsonResponse
  {
    $performedBy = $request->input('performed_by', 'api');
    $result = $this->provisionToolService->disableUser($id, $performedBy);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Enable a user account.
   * 
   * POST /api/provision-tool/users/{id}/enable
   * 
   * @param Request $request
   * @param int $id
   * @return JsonResponse
   */
  public function enableUser(Request $request, int $id): JsonResponse
  {
    $performedBy = $request->input('performed_by', 'api');
    $result = $this->provisionToolService->enableUser($id, $performedBy);

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Bulk provision multiple users.
   * 
   * POST /api/provision-tool/users/bulk
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function bulkCreate(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'users' => 'required|array|min:1|max:100',
      'users.*.username' => 'required|string|min:3|max:50',
      'users.*.email' => 'required|string|email|max:100',
      'users.*.role' => 'nullable|string|max:50',
      'users.*.status' => 'nullable|string|in:active,disabled,pending,suspended',
      'performed_by' => 'nullable|string|max:50',
    ]);

    $result = $this->provisionToolService->bulkCreate(
      $validated['users'],
      $validated['performed_by'] ?? 'api'
    );

    if ($result['success']) {
      return response()->json($result['data']);
    }

    return response()->json([
      'error' => $result['error'],
    ], $result['status'] ?? 400);
  }

  /**
   * Get audit log entries.
   * 
   * GET /api/provision-tool/audit
   * 
   * @param Request $request
   * @return JsonResponse
   */
  public function audit(Request $request): JsonResponse
  {
    $filters = $request->only(['action', 'username', 'page', 'per_page', 'limit']);
    $logs = $this->provisionToolService->getAuditLog($filters);

    if ($logs === null) {
      return response()->json([
        'error' => 'Failed to fetch audit logs',
        'message' => 'The Account Provisioning Tool service may be unavailable',
      ], 503);
    }

    return response()->json($logs);
  }

  /**
   * Get available roles.
   * 
   * GET /api/provision-tool/roles
   * 
   * @return JsonResponse
   */
  public function roles(): JsonResponse
  {
    $roles = $this->provisionToolService->getRoles();

    if ($roles === null) {
      return response()->json([
        'error' => 'Failed to fetch roles',
        'message' => 'The Account Provisioning Tool service may be unavailable',
      ], 503);
    }

    return response()->json($roles);
  }

  /**
   * Get available statuses.
   * 
   * GET /api/provision-tool/statuses
   * 
   * @return JsonResponse
   */
  public function statuses(): JsonResponse
  {
    $statuses = $this->provisionToolService->getStatuses();

    if ($statuses === null) {
      return response()->json([
        'error' => 'Failed to fetch statuses',
        'message' => 'The Account Provisioning Tool service may be unavailable',
      ], 503);
    }

    return response()->json($statuses);
  }
}
