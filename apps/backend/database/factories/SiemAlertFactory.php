<?php

namespace Database\Factories;

use App\Models\SiemAlert;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\SiemAlert>
 */
class SiemAlertFactory extends Factory
{
  /**
   * The name of the factory's corresponding model.
   *
   * @var string
   */
  protected $model = SiemAlert::class;

  /**
   * Define the model's default state.
   *
   * @return array<string, mixed>
   */
  public function definition(): array
  {
    $severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    $sources = ['firewall', 'web_server', 'database', 'api', 'manual', 'realtime'];
    $ruleIds = ['RULE001', 'RULE002', 'RULE003', 'RULE004', 'RULE005', 'RULE006'];
    $ruleNames = [
      'Multiple Failed Logins',
      'Brute Force Attempt',
      'SQL Injection Attempt',
      'XSS Attempt',
      'Port Scan Detection',
      'Admin Access',
    ];

    $ruleIndex = array_rand($ruleIds);

    return [
      'siem_alert_id' => 'ALERT-' . str_pad($this->faker->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT),
      'rule_id' => $ruleIds[$ruleIndex],
      'rule_name' => $ruleNames[$ruleIndex],
      'severity' => $this->faker->randomElement($severities),
      'description' => $this->faker->sentence(),
      'log_entry' => $this->generateLogEntry(),
      'source' => $this->faker->randomElement($sources),
      'tip_label' => $this->faker->optional(0.3)->randomElement(['BENIGN', 'DoS', 'PortScan', 'BruteForce']),
      'tip_confidence' => $this->faker->optional(0.3)->randomFloat(2, 0.5, 1.0),
      'tip_is_malicious' => $this->faker->optional(0.3)->boolean(),
      'acknowledged' => $this->faker->boolean(20),
      'alert_timestamp' => $this->faker->dateTimeBetween('-7 days', 'now'),
    ];
  }

  /**
   * Generate a realistic log entry.
   */
  protected function generateLogEntry(): string
  {
    $logTemplates = [
      "Failed login attempt for user '%s' from IP %s",
      "SQL injection attempt detected: %s",
      "XSS attempt blocked: <script>%s</script>",
      "Port scan detected from IP %s targeting ports %s",
      "Brute force attack detected from %s - %d attempts in %d seconds",
      "Suspicious file upload attempt: %s",
      "Directory traversal attempt: %s",
      "Command injection attempt: %s",
      "Unauthorized access attempt to %s",
      "Rate limit exceeded from IP %s - %d requests/minute",
    ];

    $template = $this->faker->randomElement($logTemplates);

    return sprintf(
      $template,
      $this->faker->userName(),
      $this->faker->ipv4(),
      $this->faker->numberBetween(1, 100),
      $this->faker->numberBetween(60, 300)
    );
  }

  /**
   * Indicate that the alert is critical.
   */
  public function critical(): static
  {
    return $this->state(fn(array $attributes) => [
      'severity' => 'CRITICAL',
    ]);
  }

  /**
   * Indicate that the alert is high severity.
   */
  public function high(): static
  {
    return $this->state(fn(array $attributes) => [
      'severity' => 'HIGH',
    ]);
  }

  /**
   * Indicate that the alert is medium severity.
   */
  public function medium(): static
  {
    return $this->state(fn(array $attributes) => [
      'severity' => 'MEDIUM',
    ]);
  }

  /**
   * Indicate that the alert is low severity.
   */
  public function low(): static
  {
    return $this->state(fn(array $attributes) => [
      'severity' => 'LOW',
    ]);
  }

  /**
   * Indicate that the alert is acknowledged.
   */
  public function acknowledged(): static
  {
    return $this->state(fn(array $attributes) => [
      'acknowledged' => true,
    ]);
  }

  /**
   * Indicate that the alert is unacknowledged.
   */
  public function unacknowledged(): static
  {
    return $this->state(fn(array $attributes) => [
      'acknowledged' => false,
    ]);
  }

  /**
   * Indicate that the alert has TIP analysis.
   */
  public function withTipAnalysis(): static
  {
    return $this->state(fn(array $attributes) => [
      'tip_label' => $this->faker->randomElement(['DoS', 'PortScan', 'BruteForce', 'SQLi', 'XSS']),
      'tip_confidence' => $this->faker->randomFloat(2, 0.7, 0.99),
      'tip_is_malicious' => true,
    ]);
  }

  /**
   * Indicate that the alert is from a specific source.
   */
  public function fromSource(string $source): static
  {
    return $this->state(fn(array $attributes) => [
      'source' => $source,
    ]);
  }

  /**
   * Indicate that the alert is recent (within last 24 hours).
   */
  public function recent(): static
  {
    return $this->state(fn(array $attributes) => [
      'alert_timestamp' => $this->faker->dateTimeBetween('-24 hours', 'now'),
    ]);
  }
}
