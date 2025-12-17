<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
  public function __construct(
    protected AuthService $authService
  ) {}

  /**
   * Register a new user.
   */
  public function register(RegisterRequest $request): JsonResponse
  {
    $result = $this->authService->register($request->validated());

    return response()->json([
      'message' => 'User registered successfully',
      'user' => new UserResource($result['user']),
      'token' => $result['token'],
    ], 201);
  }

  /**
   * Login user and create token.
   */
  public function login(LoginRequest $request): JsonResponse
  {
    $result = $this->authService->login($request->validated());

    if (!$result) {
      return response()->json([
        'message' => 'Invalid credentials',
      ], 401);
    }

    return response()->json([
      'message' => 'Login successful',
      'user' => new UserResource($result['user']),
      'token' => $result['token'],
    ]);
  }

  /**
   * Logout user (revoke token).
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
}

