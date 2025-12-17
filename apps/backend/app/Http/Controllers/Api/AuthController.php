<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
  public function __construct(
    protected AuthService $authService
  ) {}

  /**
   * Register a new user (SPA cookie-based auth).
   */
  public function register(RegisterRequest $request): JsonResponse
  {
    $user = $this->authService->register($request->validated());

    // Login the user via session (SPA auth)
    Auth::guard('web')->login($user);

    return response()->json([
      'message' => 'User registered successfully',
      'user' => new UserResource($user),
    ], 201);
  }

  /**
   * Login user (token-based auth for API clients).
   */
  public function login(LoginRequest $request): JsonResponse
  {
    $result = $this->authService->loginWithToken($request->validated());

    if (!$result) {
      return response()->json([
        'message' => 'Invalid credentials',
      ], 401);
    }

    return response()->json([
      'message' => 'Login successful',
      'user' => new UserResource($result['user']),
      'token' => $result['token'],
      'token_type' => 'Bearer',
    ]);
  }

  /**
   * Logout user (SPA cookie-based auth).
   */
  public function logout(Request $request): JsonResponse
  {
    $this->authService->logout($request->user());

    return response()->json([
      'message' => 'Logged out successfully',
    ]);
  }

  /**
   * Get authenticated user.
   */
  public function user(Request $request): JsonResponse
  {
    return response()->json([
      'user' => new UserResource($request->user()),
    ]);
  }

  /**
   * Send password reset link.
   */
  public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
  {
    $status = $this->authService->sendPasswordResetLink($request->validated('email'));

    if ($status) {
      return response()->json([
        'message' => 'Password reset link sent to your email',
      ]);
    }

    return response()->json([
      'message' => 'Unable to send password reset link',
    ], 400);
  }

  /**
   * Reset password with token.
   */
  public function resetPassword(ResetPasswordRequest $request): JsonResponse
  {
    $status = $this->authService->resetPassword($request->validated());

    if ($status) {
      return response()->json([
        'message' => 'Password has been reset successfully',
      ]);
    }

    return response()->json([
      'message' => 'Invalid or expired reset token',
    ], 400);
  }
}
