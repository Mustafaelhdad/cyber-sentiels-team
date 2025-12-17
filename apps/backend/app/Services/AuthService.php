<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthService
{
  /**
   * Register a new user.
   *
   * @param array $data
   * @return array{user: User, token: string}
   */
  public function register(array $data): array
  {
    $user = User::create([
      'name' => $data['name'],
      'email' => $data['email'],
      'password' => Hash::make($data['password']),
      'role' => $data['role'] ?? 'user',
    ]);

    $token = $user->createToken('auth_token')->plainTextToken;

    return [
      'user' => $user,
      'token' => $token,
    ];
  }

  /**
   * Login user and generate token.
   *
   * @param array $credentials
   * @return array{user: User, token: string}|null
   */
  public function login(array $credentials): ?array
  {
    $user = User::where('email', $credentials['email'])->first();

    if (!$user || !Hash::check($credentials['password'], $user->password)) {
      return null;
    }

    // Revoke previous tokens
    $user->tokens()->delete();

    $token = $user->createToken('auth_token')->plainTextToken;

    return [
      'user' => $user,
      'token' => $token,
    ];
  }

  /**
   * Logout user (revoke all tokens).
   */
  public function logout(User $user): void
  {
    $user->tokens()->delete();
  }
}

