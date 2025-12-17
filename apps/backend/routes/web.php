<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

// SPA Auth: The sanctum/csrf-cookie route is automatically registered by Sanctum.
// This file exists to enable web middleware for session-based SPA authentication.

Route::get('/', function () {
  return response()->json([
    'name' => config('app.name'),
    'version' => '1.0.0',
  ]);
});

