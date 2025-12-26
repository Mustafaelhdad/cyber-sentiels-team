<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Account Provisioning Tool Service
 * 
 * Handles communication between Laravel backend and the Account Provisioning Docker container.
 * Provides methods for user provisioning, lifecycle management, and audit logging.
 */
class ProvisionToolService
{
  protected string $baseUrl;
  protected int $timeout;

  public function __construct()
  {
    $this->baseUrl = config('services.provision_tool.url', 'http://provision:5002');
    $this->timeout = config('services.provision_tool.timeout', 30);
  }

  /**
   * Check if the Provisioning service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/health");
      return $response->successful();
    } catch (\Exception $e) {
      Log::warning('Provision Tool service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get Provisioning service health status.
   */
  public function getHealth(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/health");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool health request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool health exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get Provisioning service statistics.
   */
  public function getStats(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/provision/stats");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool stats request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool stats exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get security/provisioning report.
   */
  public function getReport(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/provision/report");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool report request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool report exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * List all users with optional filtering.
   */
  public function listUsers(array $filters = []): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/provision/users", $filters);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool list users failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool list users exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get a single user by ID.
   */
  public function getUser(int $userId): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/provision/users/{$userId}");

      if ($response->successful()) {
        return $response->json();
      }

      if ($response->status() === 404) {
        return null;
      }

      Log::error('Provision Tool get user failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool get user exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Create/provision a new user.
   */
  public function createUser(array $data): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->post("{$this->baseUrl}/api/provision/users", $data);

      if ($response->successful()) {
        return ['success' => true, 'data' => $response->json()];
      }

      $error = $response->json()['error'] ?? 'Failed to create user';
      return ['success' => false, 'error' => $error, 'status' => $response->status()];
    } catch (\Exception $e) {
      Log::error('Provision Tool create user exception', ['error' => $e->getMessage()]);
      return ['success' => false, 'error' => 'Service unavailable'];
    }
  }

  /**
   * Update an existing user.
   */
  public function updateUser(int $userId, array $data): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->put("{$this->baseUrl}/api/provision/users/{$userId}", $data);

      if ($response->successful()) {
        return ['success' => true, 'data' => $response->json()];
      }

      $error = $response->json()['error'] ?? 'Failed to update user';
      return ['success' => false, 'error' => $error, 'status' => $response->status()];
    } catch (\Exception $e) {
      Log::error('Provision Tool update user exception', ['error' => $e->getMessage()]);
      return ['success' => false, 'error' => 'Service unavailable'];
    }
  }

  /**
   * Delete a user.
   */
  public function deleteUser(int $userId): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->delete("{$this->baseUrl}/api/provision/users/{$userId}");

      if ($response->successful()) {
        return ['success' => true, 'data' => $response->json()];
      }

      $error = $response->json()['error'] ?? 'Failed to delete user';
      return ['success' => false, 'error' => $error, 'status' => $response->status()];
    } catch (\Exception $e) {
      Log::error('Provision Tool delete user exception', ['error' => $e->getMessage()]);
      return ['success' => false, 'error' => 'Service unavailable'];
    }
  }

  /**
   * Disable a user account.
   */
  public function disableUser(int $userId, ?string $performedBy = 'api'): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->post("{$this->baseUrl}/api/provision/users/{$userId}/disable", [
          'performed_by' => $performedBy,
        ]);

      if ($response->successful()) {
        return ['success' => true, 'data' => $response->json()];
      }

      $error = $response->json()['error'] ?? 'Failed to disable user';
      return ['success' => false, 'error' => $error, 'status' => $response->status()];
    } catch (\Exception $e) {
      Log::error('Provision Tool disable user exception', ['error' => $e->getMessage()]);
      return ['success' => false, 'error' => 'Service unavailable'];
    }
  }

  /**
   * Enable a user account.
   */
  public function enableUser(int $userId, ?string $performedBy = 'api'): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->post("{$this->baseUrl}/api/provision/users/{$userId}/enable", [
          'performed_by' => $performedBy,
        ]);

      if ($response->successful()) {
        return ['success' => true, 'data' => $response->json()];
      }

      $error = $response->json()['error'] ?? 'Failed to enable user';
      return ['success' => false, 'error' => $error, 'status' => $response->status()];
    } catch (\Exception $e) {
      Log::error('Provision Tool enable user exception', ['error' => $e->getMessage()]);
      return ['success' => false, 'error' => 'Service unavailable'];
    }
  }

  /**
   * Bulk provision multiple users.
   */
  public function bulkCreate(array $users, ?string $performedBy = 'api'): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->post("{$this->baseUrl}/api/provision/users/bulk", [
          'users' => $users,
          'performed_by' => $performedBy,
        ]);

      if ($response->successful()) {
        return ['success' => true, 'data' => $response->json()];
      }

      $error = $response->json()['error'] ?? 'Failed to bulk provision users';
      return ['success' => false, 'error' => $error, 'status' => $response->status()];
    } catch (\Exception $e) {
      Log::error('Provision Tool bulk create exception', ['error' => $e->getMessage()]);
      return ['success' => false, 'error' => 'Service unavailable'];
    }
  }

  /**
   * Get audit log entries.
   */
  public function getAuditLog(array $filters = []): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->get("{$this->baseUrl}/api/provision/audit", $filters);

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool audit log failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool audit log exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get available roles.
   */
  public function getRoles(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/provision/roles");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool roles failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool roles exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get available statuses.
   */
  public function getStatuses(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/provision/statuses");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Provision Tool statuses failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Provision Tool statuses exception', ['error' => $e->getMessage()]);
      return null;
    }
  }
}
