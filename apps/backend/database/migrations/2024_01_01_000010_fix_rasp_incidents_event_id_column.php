<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  /**
   * Run the migrations.
   * 
   * Fix: The event_id column was defined as uuid() which is 36 chars,
   * but custom event IDs like "rasp-run-3-path_traversal-1766521334-vi0y"
   * can be longer. Change to string(100) to accommodate various formats.
   */
  public function up(): void
  {
    Schema::table('rasp_incidents', function (Blueprint $table) {
      // Drop the unique constraint first
      $table->dropUnique(['event_id']);
    });

    Schema::table('rasp_incidents', function (Blueprint $table) {
      // Change column type from uuid (36 chars) to string (100 chars)
      $table->string('event_id', 100)->change();
    });

    Schema::table('rasp_incidents', function (Blueprint $table) {
      // Re-add the unique constraint
      $table->unique('event_id');
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void
  {
    Schema::table('rasp_incidents', function (Blueprint $table) {
      $table->dropUnique(['event_id']);
    });

    Schema::table('rasp_incidents', function (Blueprint $table) {
      $table->uuid('event_id')->change();
    });

    Schema::table('rasp_incidents', function (Blueprint $table) {
      $table->unique('event_id');
    });
  }
};
