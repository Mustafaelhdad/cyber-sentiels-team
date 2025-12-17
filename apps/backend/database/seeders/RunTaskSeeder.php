<?php

namespace Database\Seeders;

use App\Models\Run;
use App\Models\RunTask;
use Illuminate\Database\Seeder;

class RunTaskSeeder extends Seeder
{
  /**
   * Seed the run_tasks table with realistic security scan tasks and findings.
   */
  public function run(): void
  {
    $runs = Run::all();

    if ($runs->isEmpty()) {
      $this->command->warn('No runs found. Please run RunSeeder first.');
      return;
    }

    // Tool configurations by module
    $toolsByModule = [
      Run::MODULE_WEB_SECURITY => [RunTask::TOOL_ZAP, RunTask::TOOL_SONARQUBE, RunTask::TOOL_MODSECURITY],
      Run::MODULE_MONITORING_IR => [RunTask::TOOL_WAZUH, RunTask::TOOL_MISP, RunTask::TOOL_N8N],
      Run::MODULE_IAM => [RunTask::TOOL_WAZUH, RunTask::TOOL_N8N],
    ];

    // Realistic findings by tool
    $findingsByTool = [
      RunTask::TOOL_ZAP => [
        [
          'severity' => 'high',
          'name' => 'SQL Injection',
          'description' => 'SQL injection vulnerability found in login form parameter',
          'location' => '/api/auth/login',
          'cwe' => 'CWE-89',
        ],
        [
          'severity' => 'high',
          'name' => 'Cross-Site Scripting (XSS)',
          'description' => 'Reflected XSS vulnerability in search parameter',
          'location' => '/search?q=',
          'cwe' => 'CWE-79',
        ],
        [
          'severity' => 'medium',
          'name' => 'Missing Security Headers',
          'description' => 'X-Frame-Options header not set',
          'location' => 'All pages',
          'cwe' => 'CWE-1021',
        ],
        [
          'severity' => 'medium',
          'name' => 'CSRF Token Missing',
          'description' => 'Anti-CSRF token not found in form submission',
          'location' => '/api/users/update',
          'cwe' => 'CWE-352',
        ],
        [
          'severity' => 'low',
          'name' => 'Cookie Without Secure Flag',
          'description' => 'Session cookie transmitted over insecure connection',
          'location' => 'Session management',
          'cwe' => 'CWE-614',
        ],
        [
          'severity' => 'info',
          'name' => 'Server Information Disclosure',
          'description' => 'Server version exposed in HTTP headers',
          'location' => 'HTTP Response Headers',
          'cwe' => 'CWE-200',
        ],
      ],
      RunTask::TOOL_SONARQUBE => [
        [
          'severity' => 'high',
          'name' => 'Hardcoded Credentials',
          'description' => 'Password hardcoded in configuration file',
          'location' => 'config/database.php:45',
          'cwe' => 'CWE-798',
        ],
        [
          'severity' => 'medium',
          'name' => 'Insecure Random Number Generator',
          'description' => 'Using Math.random() for security-sensitive operation',
          'location' => 'src/utils/token.js:12',
          'cwe' => 'CWE-330',
        ],
        [
          'severity' => 'medium',
          'name' => 'Unvalidated Redirect',
          'description' => 'URL redirect without validation',
          'location' => 'src/controllers/auth.js:78',
          'cwe' => 'CWE-601',
        ],
        [
          'severity' => 'low',
          'name' => 'Debug Code Present',
          'description' => 'Console.log statements found in production code',
          'location' => 'Multiple files',
          'cwe' => 'CWE-489',
        ],
      ],
      RunTask::TOOL_MODSECURITY => [
        [
          'severity' => 'high',
          'name' => 'WAF Rule Bypass Detected',
          'description' => 'Potential WAF bypass using encoded payloads',
          'location' => 'Rule ID: 942100',
          'cwe' => 'CWE-693',
        ],
        [
          'severity' => 'medium',
          'name' => 'Anomaly Score Threshold Exceeded',
          'description' => 'Multiple suspicious requests from single IP',
          'location' => 'IP: 192.168.1.50',
          'cwe' => 'CWE-799',
        ],
      ],
      RunTask::TOOL_WAZUH => [
        [
          'severity' => 'critical',
          'name' => 'Brute Force Attack Detected',
          'description' => 'Multiple failed login attempts from external IP',
          'location' => 'SSH service on 10.0.0.5',
          'cwe' => 'CWE-307',
        ],
        [
          'severity' => 'high',
          'name' => 'Rootkit Detection',
          'description' => 'Suspicious hidden files detected in system directory',
          'location' => '/usr/lib/.hidden',
          'cwe' => 'CWE-506',
        ],
        [
          'severity' => 'medium',
          'name' => 'File Integrity Violation',
          'description' => 'Critical system file modified unexpectedly',
          'location' => '/etc/passwd',
          'cwe' => 'CWE-494',
        ],
        [
          'severity' => 'low',
          'name' => 'Outdated Package Detected',
          'description' => 'Vulnerable version of OpenSSL installed',
          'location' => 'openssl-1.0.2k',
          'cwe' => 'CWE-1104',
        ],
      ],
      RunTask::TOOL_MISP => [
        [
          'severity' => 'critical',
          'name' => 'Known Malware C2 Communication',
          'description' => 'Outbound connection to known command and control server',
          'location' => 'Destination: 185.234.xx.xx',
          'cwe' => 'CWE-506',
        ],
        [
          'severity' => 'high',
          'name' => 'Phishing Domain Access',
          'description' => 'User accessed known phishing domain',
          'location' => 'secure-login-update.com',
          'cwe' => 'CWE-451',
        ],
        [
          'severity' => 'medium',
          'name' => 'Threat Intelligence Match',
          'description' => 'File hash matches known malware signature',
          'location' => 'SHA256: a1b2c3d4...',
          'cwe' => 'CWE-506',
        ],
      ],
      RunTask::TOOL_N8N => [
        [
          'severity' => 'info',
          'name' => 'Workflow Execution Completed',
          'description' => 'Automated incident response workflow triggered',
          'location' => 'Workflow: Auto-Block-IP',
          'cwe' => null,
        ],
        [
          'severity' => 'info',
          'name' => 'Alert Notification Sent',
          'description' => 'Security alert forwarded to SIEM and Slack',
          'location' => 'Workflow: Alert-Distribution',
          'cwe' => null,
        ],
      ],
    ];

    $taskCount = 0;

    foreach ($runs as $run) {
      $tools = $toolsByModule[$run->module] ?? [RunTask::TOOL_ZAP];

      // Create 1-3 tasks per run
      $numberOfTasks = rand(1, min(3, count($tools)));
      $selectedTools = array_rand(array_flip($tools), $numberOfTasks);
      if (!is_array($selectedTools)) {
        $selectedTools = [$selectedTools];
      }

      foreach ($selectedTools as $tool) {
        // Determine task status based on run status
        $taskStatus = $this->getTaskStatus($run->status);

        // Generate progress based on status
        $progress = match ($taskStatus) {
          RunTask::STATUS_COMPLETED => 100,
          RunTask::STATUS_FAILED => rand(10, 80),
          RunTask::STATUS_RUNNING => rand(20, 90),
          default => 0,
        };

        // Generate findings for completed/running tasks
        $metaJson = $this->generateMetaJson($tool, $taskStatus, $findingsByTool);

        // Generate log and report paths for completed tasks
        $logsPath = null;
        $reportPath = null;

        if (in_array($taskStatus, [RunTask::STATUS_COMPLETED, RunTask::STATUS_FAILED])) {
          $logsPath = "logs/{$run->id}/{$tool}_" . date('Y-m-d_His') . '.log';
        }

        if ($taskStatus === RunTask::STATUS_COMPLETED) {
          $reportPath = "reports/{$run->id}/{$tool}_report_" . date('Y-m-d') . '.json';
        }

        RunTask::create([
          'run_id' => $run->id,
          'tool' => $tool,
          'status' => $taskStatus,
          'progress' => $progress,
          'logs_path' => $logsPath,
          'report_path' => $reportPath,
          'meta_json' => $metaJson,
        ]);

        $taskCount++;
      }
    }

    $this->command->info("Created {$taskCount} tasks across {$runs->count()} runs.");
  }

  /**
   * Get task status based on run status.
   */
  private function getTaskStatus(string $runStatus): string
  {
    return match ($runStatus) {
      Run::STATUS_COMPLETED => RunTask::STATUS_COMPLETED,
      Run::STATUS_FAILED => collect([RunTask::STATUS_FAILED, RunTask::STATUS_COMPLETED])->random(),
      Run::STATUS_RUNNING => collect([RunTask::STATUS_RUNNING, RunTask::STATUS_COMPLETED, RunTask::STATUS_PENDING])->random(),
      Run::STATUS_CANCELLED => RunTask::STATUS_FAILED,
      default => RunTask::STATUS_PENDING,
    };
  }

  /**
   * Generate meta JSON with findings and statistics.
   */
  private function generateMetaJson(string $tool, string $status, array $findingsByTool): array
  {
    $meta = [
      'started_at' => now()->subHours(rand(1, 48))->toIso8601String(),
      'tool_version' => $this->getToolVersion($tool),
    ];

    if ($status === RunTask::STATUS_FAILED) {
      $meta['error'] = $this->getRandomError();
      $meta['error_code'] = rand(1, 100);
      return $meta;
    }

    if (in_array($status, [RunTask::STATUS_COMPLETED, RunTask::STATUS_RUNNING])) {
      $meta['finished_at'] = now()->subMinutes(rand(5, 120))->toIso8601String();

      // Add findings
      $availableFindings = $findingsByTool[$tool] ?? [];
      $numberOfFindings = rand(0, count($availableFindings));

      if ($numberOfFindings > 0) {
        $selectedFindings = array_slice(
          $availableFindings,
          0,
          $numberOfFindings
        );

        $meta['findings'] = array_map(function ($finding) {
          return array_merge($finding, [
            'id' => 'FIND-' . strtoupper(substr(md5(rand()), 0, 8)),
            'detected_at' => now()->subMinutes(rand(10, 300))->toIso8601String(),
            'status' => collect(['open', 'open', 'open', 'investigating', 'resolved'])->random(),
          ]);
        }, $selectedFindings);

        // Add summary statistics
        $meta['summary'] = [
          'total_findings' => count($meta['findings']),
          'critical' => count(array_filter($meta['findings'], fn($f) => $f['severity'] === 'critical')),
          'high' => count(array_filter($meta['findings'], fn($f) => $f['severity'] === 'high')),
          'medium' => count(array_filter($meta['findings'], fn($f) => $f['severity'] === 'medium')),
          'low' => count(array_filter($meta['findings'], fn($f) => $f['severity'] === 'low')),
          'info' => count(array_filter($meta['findings'], fn($f) => $f['severity'] === 'info')),
        ];
      } else {
        $meta['findings'] = [];
        $meta['summary'] = [
          'total_findings' => 0,
          'critical' => 0,
          'high' => 0,
          'medium' => 0,
          'low' => 0,
          'info' => 0,
        ];
      }

      // Add scan statistics
      $meta['scan_stats'] = [
        'urls_scanned' => rand(50, 500),
        'requests_sent' => rand(1000, 10000),
        'duration_seconds' => rand(300, 7200),
      ];
    }

    return $meta;
  }

  /**
   * Get tool version string.
   */
  private function getToolVersion(string $tool): string
  {
    return match ($tool) {
      RunTask::TOOL_ZAP => '2.14.0',
      RunTask::TOOL_SONARQUBE => '10.3.0',
      RunTask::TOOL_MODSECURITY => '3.0.10',
      RunTask::TOOL_WAZUH => '4.7.0',
      RunTask::TOOL_MISP => '2.4.175',
      RunTask::TOOL_N8N => '1.22.0',
      default => '1.0.0',
    };
  }

  /**
   * Get random error message.
   */
  private function getRandomError(): string
  {
    $errors = [
      'Connection timeout while scanning target',
      'Authentication failed - invalid API key',
      'Target host unreachable',
      'Scan aborted due to rate limiting',
      'Insufficient permissions to access resource',
      'Memory limit exceeded during analysis',
      'Invalid target configuration',
      'SSL certificate verification failed',
    ];

    return $errors[array_rand($errors)];
  }
}
