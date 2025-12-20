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
    Schema::create('waf_proxies', function (Blueprint $table) {
      $table->id();
      $table->foreignId('project_id')->constrained()->onDelete('cascade');
      $table->string('name')->nullable();
      $table->string('origin_url');
      $table->string('token', 64)->unique();
      $table->enum('status', ['active', 'paused', 'disabled'])->default('active');
      $table->unsignedBigInteger('requests_allowed')->default(0);
      $table->unsignedBigInteger('requests_blocked')->default(0);
      $table->unsignedBigInteger('requests_total')->default(0);
      $table->timestamp('last_request_at')->nullable();
      $table->timestamps();

      $table->index(['project_id', 'status']);
      $table->index('token');
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::dropIfExists('waf_proxies');
  }
};
