<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Authorization Tool Service
 * 
 * Handles communication between Laravel backend and the Authorization Docker container.
 * Provides methods for RBAC/ABAC authorization, user management, and access control.
 */
class AuthzToolService
{
  protected string $baseUrl;
  protected int $timeout;

  public function __construct()
  {
    $this->baseUrl = config('services.authz_tool.url', 'http://authz:5001');
    $this->timeout = config('services.authz_tool.timeout', 30);
  }

  /**
   * Check if the Authorization service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/health");
      return $response->successful();
    } catch (\Exception $e) {
      Log::warning('Authorization Tool service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get Authorization service health status.
   */
  public function getHealth(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/health");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Authorization Tool health request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool health exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get Authorization service statistics.
   */
  public function getStats(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/authz/stats");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Authorization Tool stats request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool stats exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Authorize an action for a user.
   *
   * @param string $email User email
   * @param string $action Action to authorize (read, write, delete, manage)
   * @param string|null $resource Optional resource to check access for
   * @param string $policy Access policy (RBAC or ABAC)
   * @param array $context Optional context for ABAC evaluation
   * @return array Authorization result
   */
  public function authorize(
    string $email,
    string $action = 'read',
    ?string $resource = null,
    string $policy = 'RBAC',
    array $context = []
  ): array {
    try {
      $payload = [
        'email' => $email,
        'action' => $action,
        'policy' => $policy,
      ];

      if ($resource) {
        $payload['resource'] = $resource;
      }

      if (!empty($context)) {
        $payload['context'] = $context;
      }

      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/authz/authorize", $payload);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Authorization Tool authorize failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Authorization failed',
        'authorized' => false,
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Authorization Tool authorize exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
        'authorized' => false,
      ];
    }
  }

  /**
   * Get all privileges for a user.
   *
   * @param string $email User email
   * @param string $policy Access policy (RBAC or ABAC)
   * @param array $context Optional context for ABAC evaluation
   * @return array User privileges
   */
  public function getPrivileges(string $email, string $policy = 'RBAC', array $context = []): array
  {
    try {
      $payload = [
        'email' => $email,
        'policy' => $policy,
      ];

      if (!empty($context)) {
        $payload['context'] = $context;
      }

      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/authz/privileges", $payload);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Authorization Tool get privileges failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to get privileges',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Authorization Tool get privileges exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * List all users in the Authorization system.
   *
   * @return array|null List of users or null on failure
   */
  public function listUsers(): ?array
  {
    try {
      $response = Http::timeout($this->timeout)->get("{$this->baseUrl}/api/authz/users");

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Authorization Tool list users failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool list users exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Create a new user in the Authorization system.
   *
   * @param string $email User email
   * @param string $password User password
   * @param string $role User role (admin, manager, user, member, viewer, guest)
   * @param string $group User group
   * @return array Result of user creation
   */
  public function createUser(string $email, string $password, string $role = 'user', string $group = 'general'): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/authz/users", [
          'email' => $email,
          'password' => $password,
          'role' => $role,
          'group' => $group,
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Authorization Tool create user failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to create user',
        'issues' => $error['issues'] ?? null,
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Authorization Tool create user exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Update a user's role, group, or password.
   *
   * @param string $email User email
   * @param array $data Data to update (role, group, password)
   * @return array Result of user update
   */
  public function updateUser(string $email, array $data): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->put("{$this->baseUrl}/api/authz/users/{$email}", $data);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Authorization Tool update user failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to update user',
        'issues' => $error['issues'] ?? null,
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Authorization Tool update user exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Delete a user from the Authorization system.
   *
   * @param string $email User email
   * @return array Result of user deletion
   */
  public function deleteUser(string $email): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->delete("{$this->baseUrl}/api/authz/users/{$email}");

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Authorization Tool delete user failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Failed to delete user',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Authorization Tool delete user exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Get all available roles and their privileges.
   *
   * @return array|null List of roles or null on failure
   */
  public function getRoles(): ?array
  {
    try {
      $response = Http::timeout($this->timeout)->get("{$this->baseUrl}/api/authz/roles");

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Authorization Tool get roles failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool get roles exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get all resources and their permission requirements.
   *
   * @return array|null List of resources or null on failure
   */
  public function getResources(): ?array
  {
    try {
      $response = Http::timeout($this->timeout)->get("{$this->baseUrl}/api/authz/resources");

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Authorization Tool get resources failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool get resources exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Verify user credentials.
   *
   * @param string $email User email
   * @param string $password User password
   * @return array Verification result
   */
  public function verifyCredentials(string $email, string $password): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/authz/verify", [
          'email' => $email,
          'password' => $password,
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Invalid credentials',
        'valid' => false,
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Authorization Tool verify credentials exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
        'valid' => false,
      ];
    }
  }

  /**
   * Get authorization logs.
   *
   * @param int $limit Number of log entries to retrieve
   * @return array|null Log entries or null on failure
   */
  public function getLogs(int $limit = 100): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/authz/logs", ['limit' => $limit]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Authorization Tool get logs failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool get logs exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Check password strength.
   *
   * @param string $password Password to check
   * @return array|null Password strength result or null on failure
   */
  public function checkPasswordStrength(string $password): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/authz/password-strength", [
          'password' => $password,
        ]);

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Authorization Tool password strength check failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Authorization Tool password strength exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Test the complete authorization flow.
   * Useful for integration testing and demos.
   *
   * @param string $email Test user email
   * @param string $password Test user password
   * @param string $role Test user role
   * @param string $group Test user group
   * @return array Test results including each step's outcome
   */
  public function testAuthzFlow(
    string $email,
    string $password,
    string $role = 'user',
    string $group = 'general'
  ): array {
    $results = [
      'create_user' => null,
      'verify_credentials' => null,
      'get_privileges_rbac' => null,
      'get_privileges_abac' => null,
      'authorize_read' => null,
      'authorize_write' => null,
      'authorize_delete' => null,
      'overall_success' => false,
    ];

    // Step 1: Create user (may fail if user exists, that's ok)
    $createResult = $this->createUser($email, $password, $role, $group);
    $results['create_user'] = $createResult;

    // Step 2: Verify credentials
    $verifyResult = $this->verifyCredentials($email, $password);
    $results['verify_credentials'] = $verifyResult;

    if (!$verifyResult['success']) {
      return $results;
    }

    // Step 3: Get RBAC privileges
    $rbacResult = $this->getPrivileges($email, 'RBAC');
    $results['get_privileges_rbac'] = $rbacResult;

    // Step 4: Get ABAC privileges
    $abacResult = $this->getPrivileges($email, 'ABAC');
    $results['get_privileges_abac'] = $abacResult;

    // Step 5: Test authorization for different actions
    $results['authorize_read'] = $this->authorize($email, 'read', 'dashboard', 'RBAC');
    $results['authorize_write'] = $this->authorize($email, 'write', 'reports', 'RBAC');
    $results['authorize_delete'] = $this->authorize($email, 'delete', 'users', 'RBAC');

    $results['overall_success'] = true;

    return $results;
  }
}
