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
    Schema::create('rasp_incidents', function (Blueprint $table) {
      $table->id();
      $table->uuid('event_id')->unique();
      $table->uuid('trace_id')->index();
      $table->string('sink', 50)->index(); // request, database, http, filesystem, behavior
      $table->string('severity', 20)->index(); // debug, info, warning, error, critical
      $table->string('detection_type', 100)->nullable()->index(); // sqli, ssrf, path_traversal, etc.
      $table->string('action', 20)->index(); // allow, monitor, block
      $table->text('message');

      // Request context (stored as JSON)
      $table->string('request_method', 10)->nullable();
      $table->string('request_path', 500)->nullable();
      $table->string('request_ip', 45)->nullable()->index();
      $table->string('user_agent', 500)->nullable();

      // Identity context
      $table->string('session_id', 100)->nullable()->index();
      $table->unsignedBigInteger('user_id')->nullable()->index();
      $table->string('user_email', 255)->nullable();

      // Full context as JSON (for detailed analysis)
      $table->json('request_context')->nullable();
      $table->json('identity_context')->nullable();
      $table->json('sink_data')->nullable();
      $table->json('meta')->nullable();

      $table->timestamp('occurred_at')->index();
      $table->timestamps();

      // Composite indexes for common queries
      $table->index(['sink', 'severity', 'occurred_at']);
      $table->index(['detection_type', 'occurred_at']);
      $table->index(['request_ip', 'occurred_at']);
      $table->index(['user_id', 'occurred_at']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('rasp_incidents');
  }
};
