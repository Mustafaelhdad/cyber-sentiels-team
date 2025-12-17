<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RunController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group.
|
*/

// Health check
Route::get('/health', function () {
  return response()->json([
    'status' => 'ok',
    'timestamp' => now()->toIso8601String(),
  ]);
});

// Auth routes (public)
Route::prefix('auth')->group(function () {
  Route::post('/register', [AuthController::class, 'register']);
  Route::post('/login', [AuthController::class, 'login']);
  Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
  Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
  // Current user shorthand
  Route::get('/me', [AuthController::class, 'user']);

  // Auth
  Route::prefix('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
  });

  // Projects
  Route::apiResource('projects', ProjectController::class);

  // Runs (nested under projects)
  Route::prefix('projects/{project}')->group(function () {
    Route::get('/runs', [RunController::class, 'index']);
    Route::post('/runs', [RunController::class, 'store']);
    Route::get('/runs/{run}', [RunController::class, 'show']);
    Route::get('/runs/{run}/tasks', [RunController::class, 'tasks']);
    Route::post('/runs/{run}/cancel', [RunController::class, 'cancel']);

    // Reports
    Route::get('/runs/{run}/summary', [ReportController::class, 'summary']);
    Route::get('/runs/{run}/findings', [ReportController::class, 'findings']);
    Route::get('/runs/{run}/report', [ReportController::class, 'runReport']);
    Route::get('/runs/{run}/tasks/{task}/report', [ReportController::class, 'taskReport']);
    Route::get('/runs/{run}/tasks/{task}/download', [ReportController::class, 'download']);
  });
});
