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

    // Create additional test users
    User::firstOrCreate(
      ['email' => 'analyst@sentinel.local'],
      [
        'name' => 'Security Analyst',
        'password' => Hash::make('password'),
        'role' => 'user',
        'email_verified_at' => now(),
      ]
    );

    User::firstOrCreate(
      ['email' => 'manager@sentinel.local'],
      [
        'name' => 'Project Manager',
        'password' => Hash::make('password'),
        'role' => 'user',
        'email_verified_at' => now(),
      ]
    );

    // Seed projects, runs, and tasks
    $this->call([
      ProjectSeeder::class,
      RunSeeder::class,
      RunTaskSeeder::class,
    ]);
  }
}
