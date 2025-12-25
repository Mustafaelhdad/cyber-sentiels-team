<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  /**
   * Run the migrations.
   */
  public function up(): void
  {
    Schema::create('siem_alerts', function (Blueprint $table) {
      $table->id();

      // Reference to SIEM container's alert ID
      $table->string('siem_alert_id')->nullable()->unique();

      // Rule information
      $table->string('rule_id')->nullable()->index();
      $table->string('rule_name');

      // Alert details
      $table->enum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])->default('MEDIUM')->index();
      $table->text('description')->nullable();
      $table->text('log_entry');
      $table->string('source')->default('unknown')->index();

      // TIP (Threat Intelligence Platform) model results
      $table->string('tip_label')->nullable();
      $table->float('tip_confidence')->nullable();
      $table->boolean('tip_is_malicious')->nullable();

      // Status
      $table->boolean('acknowledged')->default(false)->index();

      // Timestamps
      $table->timestamp('alert_timestamp')->nullable()->index();
      $table->timestamps();

      // Indexes for common queries
      $table->index(['severity', 'acknowledged']);
      $table->index(['alert_timestamp', 'severity']);
      $table->index(['source', 'alert_timestamp']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('siem_alerts');
  }
};
