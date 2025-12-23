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
    Schema::create('rasp_test_runs', function (Blueprint $table) {
      $table->id();
      $table->foreignId('user_id')->constrained()->onDelete('cascade');
      $table->foreignId('project_id')->constrained()->onDelete('cascade');
      $table->string('name')->nullable(); // Optional name for the test run
      $table->string('status')->default('pending'); // pending, running, completed, failed
      $table->json('test_types'); // Array of attack types tested: ['xss', 'sqli', etc.]
      $table->json('results')->nullable(); // Full test results JSON
      $table->json('summary')->nullable(); // Summary stats
      $table->integer('total_tests')->default(0);
      $table->integer('total_detected')->default(0);
      $table->decimal('detection_rate', 5, 2)->default(0);
      $table->string('report_path')->nullable(); // Path to HTML report
      $table->timestamp('started_at')->nullable();
      $table->timestamp('finished_at')->nullable();
      $table->timestamps();

      $table->index(['user_id', 'created_at']);
      $table->index(['project_id', 'created_at']);
      $table->index(['project_id', 'status']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('rasp_test_runs');
  }
};
