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
    Schema::create('run_tasks', function (Blueprint $table) {
      $table->id();
      $table->foreignId('run_id')->constrained()->onDelete('cascade');
      $table->string('tool'); // zap, modsecurity, sonarqube, wazuh, misp, n8n
      $table->string('status')->default('pending'); // pending, running, completed, failed
      $table->unsignedTinyInteger('progress')->default(0); // 0-100
      $table->string('logs_path')->nullable();
      $table->string('report_path')->nullable();
      $table->json('meta_json')->nullable();
      $table->timestamps();

      $table->index(['run_id', 'status']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('run_tasks');
  }
};
