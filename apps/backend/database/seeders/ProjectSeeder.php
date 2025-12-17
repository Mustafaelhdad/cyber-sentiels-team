<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
  /**
   * Seed the projects table with realistic cybersecurity projects.
   */
  public function run(): void
  {
    $users = User::all();

    if ($users->isEmpty()) {
      $this->command->warn('No users found. Please run UserSeeder first.');
      return;
    }

    $projects = [
      [
        'name' => 'E-Commerce Platform Security Audit',
        'description' => 'Comprehensive security assessment for the main e-commerce platform including payment gateway integration, user authentication, and data protection compliance.',
      ],
      [
        'name' => 'Healthcare Portal Penetration Test',
        'description' => 'HIPAA compliance-focused penetration testing for patient portal, medical records system, and appointment scheduling modules.',
      ],
      [
        'name' => 'Banking API Security Review',
        'description' => 'Security evaluation of REST APIs handling financial transactions, account management, and third-party integrations.',
      ],
      [
        'name' => 'Corporate Network Infrastructure',
        'description' => 'Enterprise network security assessment including firewall configurations, VPN endpoints, and internal network segmentation.',
      ],
      [
        'name' => 'Mobile Banking App Assessment',
        'description' => 'Security testing for iOS and Android mobile banking applications, focusing on authentication, data storage, and API communications.',
      ],
      [
        'name' => 'Cloud Migration Security',
        'description' => 'Security review for AWS/Azure cloud migration project, including IAM policies, storage encryption, and network security groups.',
      ],
      [
        'name' => 'SaaS Platform Vulnerability Assessment',
        'description' => 'Multi-tenant SaaS application security testing covering data isolation, API security, and access control mechanisms.',
      ],
      [
        'name' => 'Government Portal Security Audit',
        'description' => 'Security compliance audit for citizen services portal, including identity verification and document management systems.',
      ],
      [
        'name' => 'IoT Device Security Testing',
        'description' => 'Security assessment for industrial IoT devices and their communication protocols, firmware analysis, and backend systems.',
      ],
      [
        'name' => 'Educational Platform Security',
        'description' => 'Security review for online learning management system, student data protection, and exam proctoring services.',
      ],
      [
        'name' => 'Retail POS System Security',
        'description' => 'Point-of-sale system security assessment including payment card handling, inventory management, and store network security.',
      ],
      [
        'name' => 'Insurance Claims Portal',
        'description' => 'Security testing for insurance claims processing system, document upload functionality, and customer data handling.',
      ],
    ];

    foreach ($projects as $index => $projectData) {
      // Distribute projects across users
      $user = $users[$index % $users->count()];

      Project::firstOrCreate(
        ['name' => $projectData['name']],
        [
          'user_id' => $user->id,
          'description' => $projectData['description'],
        ]
      );
    }

    $this->command->info('Created ' . count($projects) . ' projects successfully.');
  }
}
