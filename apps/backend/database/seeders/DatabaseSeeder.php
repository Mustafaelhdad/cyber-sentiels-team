<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
  /**
   * Seed the application's database.
   */
  public function run(): void
  {
    // Create admin user
    User::firstOrCreate(
      ['email' => 'admin@sentinel.local'],
      [
        'name' => 'Admin',
        'password' => Hash::make('password'),
        'role' => 'admin',
        'email_verified_at' => now(),
      ]
    );

    // Create demo user
    User::firstOrCreate(
      ['email' => 'demo@sentinel.local'],
      [
        'name' => 'Demo User',
        'password' => Hash::make('password'),
        'role' => 'user',
        'email_verified_at' => now(),
      ]
    );
  }
}

