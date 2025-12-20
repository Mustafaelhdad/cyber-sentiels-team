<?php

namespace App\Console\Commands;

use App\Services\WafLogService;
use Illuminate\Console\Command;

class UpdateWafCountersCommand extends Command
{
  /**
   * The name and signature of the console command.
   *
   * @var string
   */
  protected $signature = 'waf:update-counters';

  /**
   * The console command description.
   *
   * @var string
   */
  protected $description = 'Update WAF proxy counters from log files';

  /**
   * Execute the console command.
   */
  public function handle(WafLogService $wafLogService): int
  {
    $this->info('Updating WAF counters from log files...');

    try {
      $wafLogService->updateAllCountersFromLogs();
      $this->info('WAF counters updated successfully.');
      return Command::SUCCESS;
    } catch (\Exception $e) {
      $this->error('Failed to update WAF counters: ' . $e->getMessage());
      return Command::FAILURE;
    }
  }
}
