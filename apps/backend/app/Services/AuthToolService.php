<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Auth Tool Service
 * 
 * Handles communication between Laravel backend and the Authentication Docker container.
 * Provides methods for user management, JWT token operations, and OTP verification.
 */
class AuthToolService
{
  protected string $baseUrl;
  protected int $timeout;

  public function __construct()
  {
    $this->baseUrl = config('services.auth_tool.url', 'http://auth:5000');
    $this->timeout = config('services.auth_tool.timeout', 30);
  }

  /**
   * Check if the Auth service is available.
   */
  public function isAvailable(): bool
  {
    try {
      $response = Http::timeout(5)->get("{$this->baseUrl}/health");
      return $response->successful();
    } catch (\Exception $e) {
      Log::warning('Auth Tool service unavailable', ['error' => $e->getMessage()]);
      return false;
    }
  }

  /**
   * Get Auth service health status.
   */
  public function getHealth(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/health");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Auth Tool health request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Auth Tool health exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Get Auth service statistics.
   */
  public function getStats(): ?array
  {
    try {
      $response = Http::timeout(10)->get("{$this->baseUrl}/api/auth/stats");

      if ($response->successful()) {
        return $response->json();
      }

      Log::error('Auth Tool stats request failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Auth Tool stats exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Register a new user in the Auth Tool.
   *
   * @param string $username The username to register
   * @param string $password The password for the user
   * @return array Response containing success status and message
   */
  public function signup(string $username, string $password): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/auth/signup", [
          'username' => $username,
          'password' => $password,
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Auth Tool signup failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Signup failed',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Auth Tool signup exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Sign in a user (Step 1: Credential verification).
   *
   * @param string $username The username
   * @param string $password The password
   * @return array Response containing session_id for OTP verification
   */
  public function signin(string $username, string $password): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/auth/signin", [
          'username' => $username,
          'password' => $password,
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Auth Tool signin failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Invalid credentials',
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Auth Tool signin exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Verify OTP code (Step 2: Complete authentication).
   *
   * @param string $sessionId The session ID from signin
   * @param string $otp The OTP code to verify
   * @return array Response containing JWT token on success
   */
  public function verifyOtp(string $sessionId, string $otp): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/auth/verify-otp", [
          'session_id' => $sessionId,
          'otp' => $otp,
        ]);

      if ($response->successful()) {
        return [
          'success' => true,
          'data' => $response->json(),
        ];
      }

      $error = $response->json();
      Log::warning('Auth Tool OTP verification failed', ['response' => $error]);
      return [
        'success' => false,
        'error' => $error['error'] ?? 'Invalid OTP',
        'attempts_remaining' => $error['attempts_remaining'] ?? null,
        'status' => $response->status(),
      ];
    } catch (\Exception $e) {
      Log::error('Auth Tool OTP verification exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Verify a JWT token.
   *
   * @param string $token The JWT token to verify
   * @return array Token validation result
   */
  public function verifyToken(string $token): array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->asJson()
        ->post("{$this->baseUrl}/api/auth/verify-token", [
          'token' => $token,
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
        'error' => $error['error'] ?? 'Invalid token',
        'valid' => false,
      ];
    } catch (\Exception $e) {
      Log::error('Auth Tool token verification exception', ['error' => $e->getMessage()]);
      return [
        'success' => false,
        'error' => 'Service unavailable',
      ];
    }
  }

  /**
   * Get current user info using a JWT token.
   *
   * @param string $token The JWT token
   * @return array|null User info or null on failure
   */
  public function getCurrentUser(string $token): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->withHeaders([
          'Authorization' => "Bearer {$token}",
        ])
        ->get("{$this->baseUrl}/api/auth/me");

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Auth Tool get current user failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Auth Tool get current user exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * List all registered users (requires authentication).
   *
   * @param string $token The JWT token for authentication
   * @return array|null List of users or null on failure
   */
  public function listUsers(string $token): ?array
  {
    try {
      $response = Http::timeout($this->timeout)
        ->withHeaders([
          'Authorization' => "Bearer {$token}",
        ])
        ->get("{$this->baseUrl}/api/auth/users");

      if ($response->successful()) {
        return $response->json();
      }

      Log::warning('Auth Tool list users failed', ['response' => $response->body()]);
      return null;
    } catch (\Exception $e) {
      Log::error('Auth Tool list users exception', ['error' => $e->getMessage()]);
      return null;
    }
  }

  /**
   * Test the complete authentication flow.
   * Useful for integration testing and demos.
   *
   * @param string $username Test username
   * @param string $password Test password
   * @param string $otp OTP code (default: 5555)
   * @return array Test results including each step's outcome
   */
  public function testAuthFlow(string $username, string $password, string $otp = '5555'): array
  {
    $results = [
      'signup' => null,
      'signin' => null,
      'verify_otp' => null,
      'verify_token' => null,
      'get_user' => null,
      'overall_success' => false,
    ];

    // Step 1: Signup (may fail if user exists, that's ok)
    $signupResult = $this->signup($username, $password);
    $results['signup'] = $signupResult;

    // Step 2: Signin
    $signinResult = $this->signin($username, $password);
    $results['signin'] = $signinResult;

    if (!$signinResult['success']) {
      return $results;
    }

    $sessionId = $signinResult['data']['session_id'] ?? null;
    if (!$sessionId) {
      $results['signin']['error'] = 'No session_id returned';
      return $results;
    }

    // Step 3: Verify OTP
    $otpResult = $this->verifyOtp($sessionId, $otp);
    $results['verify_otp'] = $otpResult;

    if (!$otpResult['success']) {
      return $results;
    }

    $token = $otpResult['data']['token'] ?? null;
    if (!$token) {
      $results['verify_otp']['error'] = 'No token returned';
      return $results;
    }

    // Step 4: Verify Token
    $tokenResult = $this->verifyToken($token);
    $results['verify_token'] = $tokenResult;

    // Step 5: Get Current User
    $userResult = $this->getCurrentUser($token);
    $results['get_user'] = $userResult !== null
      ? ['success' => true, 'data' => $userResult]
      : ['success' => false, 'error' => 'Failed to get user info'];

    $results['overall_success'] = true;
    $results['token'] = $token;

    return $results;
  }
}
