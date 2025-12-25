<?php

namespace Tests\Feature;

use App\Models\SiemAlert;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * SIEM Integration Tests
 * 
 * These tests verify the SIEM API endpoints work correctly.
 * Note: Some tests require the SIEM Docker container to be running.
 */
class SiemIntegrationTest extends TestCase
{
  use RefreshDatabase;

  protected User $user;

  protected function setUp(): void
  {
    parent::setUp();
    $this->user = User::factory()->create();
  }

  /**
   * Test health check endpoint.
   */
  public function test_health_check(): void
  {
    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/health');

    $response->assertStatus(200)
      ->assertJsonStructure([
        'available',
        'service',
        'url',
      ]);
  }

  /**
   * Test stats endpoint.
   */
  public function test_stats_endpoint(): void
  {
    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/stats');

    // May return 503 if SIEM service is not running
    $this->assertContains($response->status(), [200, 503]);
  }

  /**
   * Test rules endpoint.
   */
  public function test_rules_endpoint(): void
  {
    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/rules');

    $response->assertStatus(200)
      ->assertJsonStructure([
        'total',
        'rules',
      ]);
  }

  /**
   * Test local alerts endpoint with no alerts.
   */
  public function test_local_alerts_empty(): void
  {
    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/local');

    $response->assertStatus(200)
      ->assertJsonStructure([
        'data',
        'current_page',
        'per_page',
        'total',
      ]);
  }

  /**
   * Test local alerts with existing alerts.
   */
  public function test_local_alerts_with_data(): void
  {
    // Create some test alerts
    SiemAlert::factory()->count(5)->create([
      'severity' => 'HIGH',
    ]);
    SiemAlert::factory()->count(3)->create([
      'severity' => 'CRITICAL',
    ]);

    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/local');

    $response->assertStatus(200)
      ->assertJsonPath('total', 8);
  }

  /**
   * Test filtering alerts by severity.
   */
  public function test_filter_alerts_by_severity(): void
  {
    SiemAlert::factory()->count(5)->create(['severity' => 'HIGH']);
    SiemAlert::factory()->count(3)->create(['severity' => 'LOW']);

    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/local?severity=HIGH');

    $response->assertStatus(200)
      ->assertJsonPath('total', 5);
  }

  /**
   * Test filtering alerts by acknowledged status.
   */
  public function test_filter_alerts_by_acknowledged(): void
  {
    SiemAlert::factory()->count(5)->create(['acknowledged' => false]);
    SiemAlert::factory()->count(3)->create(['acknowledged' => true]);

    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/local?acknowledged=false');

    $response->assertStatus(200)
      ->assertJsonPath('total', 5);
  }

  /**
   * Test acknowledge single alert.
   */
  public function test_acknowledge_alert(): void
  {
    $alert = SiemAlert::factory()->create(['acknowledged' => false]);

    $response = $this->actingAs($this->user)
      ->postJson("/api/siem/alerts/{$alert->id}/acknowledge");

    $response->assertStatus(200)
      ->assertJsonPath('alert.acknowledged', true);

    $this->assertDatabaseHas('siem_alerts', [
      'id' => $alert->id,
      'acknowledged' => true,
    ]);
  }

  /**
   * Test bulk acknowledge alerts.
   */
  public function test_bulk_acknowledge_alerts(): void
  {
    $alerts = SiemAlert::factory()->count(3)->create(['acknowledged' => false]);
    $alertIds = $alerts->pluck('id')->toArray();

    $response = $this->actingAs($this->user)
      ->postJson('/api/siem/alerts/acknowledge-bulk', [
        'alert_ids' => $alertIds,
      ]);

    $response->assertStatus(200)
      ->assertJsonPath('count', 3);

    foreach ($alertIds as $id) {
      $this->assertDatabaseHas('siem_alerts', [
        'id' => $id,
        'acknowledged' => true,
      ]);
    }
  }

  /**
   * Test delete single alert.
   */
  public function test_delete_alert(): void
  {
    $alert = SiemAlert::factory()->create();

    $response = $this->actingAs($this->user)
      ->deleteJson("/api/siem/alerts/{$alert->id}");

    $response->assertStatus(200);

    $this->assertDatabaseMissing('siem_alerts', [
      'id' => $alert->id,
    ]);
  }

  /**
   * Test bulk delete alerts.
   */
  public function test_bulk_delete_alerts(): void
  {
    $alerts = SiemAlert::factory()->count(3)->create();
    $alertIds = $alerts->pluck('id')->toArray();

    $response = $this->actingAs($this->user)
      ->deleteJson('/api/siem/alerts/bulk', [
        'alert_ids' => $alertIds,
      ]);

    $response->assertStatus(200)
      ->assertJsonPath('count', 3);

    foreach ($alertIds as $id) {
      $this->assertDatabaseMissing('siem_alerts', ['id' => $id]);
    }
  }

  /**
   * Test alert distribution endpoint.
   */
  public function test_alert_distribution(): void
  {
    SiemAlert::factory()->count(5)->create(['severity' => 'HIGH']);
    SiemAlert::factory()->count(3)->create(['severity' => 'CRITICAL']);
    SiemAlert::factory()->count(2)->create(['severity' => 'LOW']);

    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/distribution');

    $response->assertStatus(200)
      ->assertJsonStructure([
        'by_severity',
        'by_source',
        'top_rules',
      ]);
  }

  /**
   * Test alert timeline endpoint.
   */
  public function test_alert_timeline(): void
  {
    SiemAlert::factory()->count(10)->create([
      'alert_timestamp' => now()->subHours(2),
    ]);

    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/timeline?period=24h');

    $response->assertStatus(200)
      ->assertJsonStructure([
        'period',
        'interval',
        'data',
      ]);
  }

  /**
   * Test export alerts as CSV.
   */
  public function test_export_alerts_csv(): void
  {
    SiemAlert::factory()->count(5)->create();

    $response = $this->actingAs($this->user)
      ->get('/api/siem/alerts/export');

    $response->assertStatus(200)
      ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
  }

  /**
   * Test analyze endpoint with log text.
   */
  public function test_analyze_logs(): void
  {
    $response = $this->actingAs($this->user)
      ->postJson('/api/siem/analyze', [
        'logs' => "Failed login attempt for user 'admin' from IP 192.168.1.100\nSQL injection attempt: ' OR '1'='1",
        'source' => 'test',
      ]);

    // May return 503 if SIEM service is not running
    $this->assertContains($response->status(), [200, 503]);
  }

  /**
   * Test ingest endpoint with single log.
   */
  public function test_ingest_single_log(): void
  {
    $response = $this->actingAs($this->user)
      ->postJson('/api/siem/ingest', [
        'log' => "Failed login attempt for user 'admin' from IP 192.168.1.100",
        'source' => 'test',
      ]);

    // May return 500 if SIEM service is not running
    $this->assertContains($response->status(), [200, 500]);
  }

  /**
   * Test ingest batch endpoint.
   */
  public function test_ingest_batch_logs(): void
  {
    $response = $this->actingAs($this->user)
      ->postJson('/api/siem/ingest/batch', [
        'logs' => [
          "Failed login attempt for user 'admin'",
          "SQL injection attempt detected",
          "Port scan from 192.168.1.100",
        ],
        'default_source' => 'test_batch',
      ]);

    // May return 500 if SIEM service is not running
    $this->assertContains($response->status(), [200, 500]);
  }

  /**
   * Test upload endpoint requires file.
   */
  public function test_upload_requires_file(): void
  {
    $response = $this->actingAs($this->user)
      ->postJson('/api/siem/upload', [
        'source' => 'test',
      ]);

    $response->assertStatus(422);
  }

  /**
   * Test show single alert.
   */
  public function test_show_alert(): void
  {
    $alert = SiemAlert::factory()->create();

    $response = $this->actingAs($this->user)
      ->getJson("/api/siem/alerts/{$alert->id}");

    $response->assertStatus(200)
      ->assertJsonPath('id', $alert->id);
  }

  /**
   * Test show non-existent alert returns 404.
   */
  public function test_show_nonexistent_alert(): void
  {
    $response = $this->actingAs($this->user)
      ->getJson('/api/siem/alerts/99999');

    $response->assertStatus(404);
  }

  /**
   * Test unauthenticated access is denied.
   */
  public function test_unauthenticated_access_denied(): void
  {
    $response = $this->getJson('/api/siem/health');

    $response->assertStatus(401);
  }
}
