<?php

namespace App\Providers;

use App\Rasp\RaspService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
  /**
   * Register any application services.
   */
  public function register(): void
  {
    // Bind Services
    $this->app->singleton(\App\Services\ZapService::class);

    // Register RASP Service as singleton
    $this->app->singleton(RaspService::class);
  }

  /**
   * Bootstrap any application services.
   */
  public function boot(): void
  {
    //
  }
}
