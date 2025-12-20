import type { WafStats } from "@/hooks/useApiQueries";

interface WafStatsCardProps {
  stats: WafStats | undefined;
  isLoading?: boolean;
}

export default function WafStatsCard({ stats, isLoading }: WafStatsCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        WAF Overview
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total_proxies}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total Proxies
          </p>
        </div>

        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.active_proxies}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">Active</p>
        </div>

        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.total_requests.toLocaleString()}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Total Requests
          </p>
        </div>

        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.total_allowed.toLocaleString()}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">Allowed</p>
        </div>

        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.total_blocked.toLocaleString()}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">Blocked</p>
        </div>

        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.block_rate}%
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Block Rate
          </p>
        </div>
      </div>
    </div>
  );
}
