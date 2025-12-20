<?php

namespace App\Console\Commands;

use App\Services\WafProxyService;
use Illuminate\Console\Command;

class RegenerateWafMapCommand extends Command
{
  /**
   * The name and signature of the console command.
   *
   * @var string
   */
  protected $signature = 'waf:regenerate-map';

  /**
   * The console command description.
   *
   * @var string
   */
  protected $description = 'Regenerate the WAF token-to-origin map file';

  /**
   * Execute the console command.
   */
  public function handle(WafProxyService $wafProxyService): int
  {
    $this->info('Regenerating WAF token map file...');

    try {
      $wafProxyService->regenerateMapFile();
      $this->info('WAF token map file regenerated successfully.');
      $this->info('Path: ' . config('waf.map_file_path'));
      return Command::SUCCESS;
    } catch (\Exception $e) {
      $this->error('Failed to regenerate WAF map: ' . $e->getMessage());
      return Command::FAILURE;
    }
  }
}
