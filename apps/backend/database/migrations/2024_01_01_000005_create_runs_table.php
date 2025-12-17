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
    Schema::create('runs', function (Blueprint $table) {
      $table->id();
      $table->foreignId('project_id')->constrained()->onDelete('cascade');
      $table->string('module'); // web_security, monitoring_ir, iam
      $table->string('target_type'); // url, repo, config
      $table->string('target_value', 2048);
      $table->string('status')->default('pending'); // pending, running, completed, failed, cancelled
      $table->timestamp('started_at')->nullable();
      $table->timestamp('completed_at')->nullable();
      $table->json('meta')->nullable();
      $table->timestamps();

      $table->index(['project_id', 'status']);
      $table->index(['project_id', 'created_at']);
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('runs');
  }
};

