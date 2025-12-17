<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;

class AuthService
{
  /**
   * Register a new user (returns User for SPA session auth).
   *
   * @param array $data
   * @return User
   */
  public function register(array $data): User
  {
    return User::create([
      'name' => $data['name'],
      'email' => $data['email'],
      'password' => Hash::make($data['password']),
      'role' => $data['role'] ?? 'user',
    ]);
  }

  /**
   * Attempt login with credentials (SPA session-based).
   *
   * @param array $credentials
   * @return User|null
   */
  public function attemptLogin(array $credentials): ?User
  {
    // Use session-based web guard for SPA cookie auth
    if (!Auth::guard('web')->attempt($credentials)) {
      return null;
    }

    return Auth::guard('web')->user();
  }

  /**
   * Legacy token-based login (for mobile/API clients).
   *
   * @param array $credentials
   * @return array{user: User, token: string}|null
   */
  public function loginWithToken(array $credentials): ?array
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
   * Logout user (revoke all tokens and clear session).
   */
  public function logout(?User $user): void
  {
    if ($user) {
      // Revoke all API tokens
      $user->tokens()->delete();
    }

    // Logout from session
    Auth::guard('web')->logout();
  }

  /**
   * Send password reset link to user.
   *
   * @param string $email
   * @return bool
   */
  public function sendPasswordResetLink(string $email): bool
  {
    $status = Password::sendResetLink(['email' => $email]);

    return $status === Password::RESET_LINK_SENT;
  }

  /**
   * Reset user password with token.
   *
   * @param array $data
   * @return bool
   */
  public function resetPassword(array $data): bool
  {
    $status = Password::reset(
      [
        'email' => $data['email'],
        'password' => $data['password'],
        'password_confirmation' => $data['password_confirmation'],
        'token' => $data['token'],
      ],
      function (User $user, string $password) {
        $user->forceFill([
          'password' => Hash::make($password),
          'remember_token' => Str::random(60),
        ])->save();

        event(new PasswordReset($user));
      }
    );

    return $status === Password::PASSWORD_RESET;
  }
}
