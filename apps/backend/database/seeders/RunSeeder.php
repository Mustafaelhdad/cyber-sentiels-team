<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\Run;
use Illuminate\Database\Seeder;

class RunSeeder extends Seeder
{
  /**
   * Seed the runs table with realistic security scan data.
   */
  public function run(): void
  {
    $projects = Project::with('user')->get();

    if ($projects->isEmpty()) {
      $this->command->warn('No projects found. Please run ProjectSeeder first.');
      return;
    }

    $modules = [
      Run::MODULE_WEB_SECURITY,
      Run::MODULE_MONITORING_IR,
      Run::MODULE_IAM,
    ];

    $statuses = [
      Run::STATUS_COMPLETED,
      Run::STATUS_COMPLETED,
      Run::STATUS_COMPLETED,
      Run::STATUS_RUNNING,
      Run::STATUS_PENDING,
      Run::STATUS_FAILED,
    ];

    $targetTypes = ['domain', 'ip', 'url', 'cidr'];

    $targets = [
      'domain' => [
        'example.com',
        'api.example.com',
        'staging.example.com',
        'portal.example.com',
        'admin.example.com',
        'secure.example.com',
      ],
      'ip' => [
        '192.168.1.100',
        '10.0.0.50',
        '172.16.0.25',
        '192.168.10.1',
        '10.10.10.10',
      ],
      'url' => [
        'https://example.com/api/v1',
        'https://portal.example.com/login',
        'https://api.example.com/graphql',
        'https://admin.example.com/dashboard',
      ],
      'cidr' => [
        '192.168.1.0/24',
        '10.0.0.0/16',
        '172.16.0.0/12',
      ],
    ];

    $runCount = 0;

    foreach ($projects as $project) {
      // Create 2-5 runs per project
      $numberOfRuns = rand(2, 5);

      for ($i = 0; $i < $numberOfRuns; $i++) {
        $module = $modules[array_rand($modules)];
        $status = $statuses[array_rand($statuses)];
        $targetType = $targetTypes[array_rand($targetTypes)];
        $targetValue = $targets[$targetType][array_rand($targets[$targetType])];

        // Generate realistic timestamps
        $createdAt = now()->subDays(rand(1, 90))->subHours(rand(0, 23));
        $startedAt = null;
        $finishedAt = null;

        if (in_array($status, [Run::STATUS_RUNNING, Run::STATUS_COMPLETED, Run::STATUS_FAILED])) {
          $startedAt = $createdAt->copy()->addMinutes(rand(1, 30));
        }

        if (in_array($status, [Run::STATUS_COMPLETED, Run::STATUS_FAILED])) {
          $finishedAt = $startedAt->copy()->addMinutes(rand(5, 180));
        }

        Run::create([
          'user_id' => $project->user_id,
          'project_id' => $project->id,
          'module' => $module,
          'target_type' => $targetType,
          'target_value' => $targetValue,
          'status' => $status,
          'started_at' => $startedAt,
          'finished_at' => $finishedAt,
          'created_at' => $createdAt,
          'updated_at' => $finishedAt ?? $startedAt ?? $createdAt,
        ]);

        $runCount++;
      }
    }

    $this->command->info("Created {$runCount} runs across {$projects->count()} projects.");
  }
}
