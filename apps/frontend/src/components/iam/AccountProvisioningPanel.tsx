import {
  useProvisionToolHealth,
  useProvisionToolStats,
  useProvisionToolReport,
} from "@/hooks/useApiQueries";
import { ProvisionStatsCard } from "./ProvisionStatsCard";
import { ProvisionUsersList } from "./ProvisionUsersList";
import { ProvisionAuditLog } from "./ProvisionAuditLog";

export function AccountProvisioningPanel() {
  const { data: healthData, isLoading: healthLoading } =
    useProvisionToolHealth();
  const { data: statsData, isLoading: statsLoading } = useProvisionToolStats();
  const { data: reportData } = useProvisionToolReport();

  const isServiceOnline = healthData?.available ?? false;

  return (
    <div className="space-y-6">
      {/* Service Status Banner */}
      <div
        className={`p-4 rounded-xl border ${
          isServiceOnline
            ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isServiceOnline ? "bg-cyan-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                isServiceOnline
                  ? "text-cyan-800 dark:text-cyan-300"
                  : "text-red-800 dark:text-red-300"
              }`}
            >
              {healthLoading
                ? "Checking service status..."
                : isServiceOnline
                ? "Account Provisioning Service Online"
                : "Account Provisioning Service Offline"}
            </p>
            {healthData?.url && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Connected to: {healthData.url}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ProvisionStatsCard
          title="Total Users"
          value={statsData?.total_users ?? 0}
          subtitle="Provisioned accounts"
          color="cyan"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />

        <ProvisionStatsCard
          title="Active Users"
          value={statsData?.users_by_status?.active ?? 0}
          subtitle="Currently enabled"
          color="green"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <ProvisionStatsCard
          title="Disabled Users"
          value={statsData?.users_by_status?.disabled ?? 0}
          subtitle="Deprovisioned"
          color="red"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          }
        />

        <ProvisionStatsCard
          title="Recent Activity"
          value={statsData?.recent_activity_24h ?? 0}
          subtitle="Last 24 hours"
          color="blue"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Role Distribution & Activity Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Users by Role
          </h3>
          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(statsData?.users_by_role || {}).map(
                ([role, count]) => {
                  const total = statsData?.total_users || 1;
                  const percentage = Math.round((count / total) * 100);
                  return (
                    <div key={role}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {role}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-cyan-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
              {Object.keys(statsData?.users_by_role || {}).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No users provisioned yet
                </p>
              )}
            </div>
          )}
        </div>

        {/* Activity Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Activity Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {reportData?.activities.accounts_created ?? 0}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Accounts Created
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {reportData?.activities.accounts_modified ?? 0}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Accounts Modified
              </p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {reportData?.activities.accounts_disabled ?? 0}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Accounts Disabled
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {reportData?.activities.accounts_enabled ?? 0}
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Accounts Enabled
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Management */}
      <ProvisionUsersList />

      {/* Audit Log */}
      <ProvisionAuditLog />

      {/* Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About Account Provisioning Tool
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-cyan-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                User Account Creation & Management
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-cyan-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Role-Based Assignment
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-cyan-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Account Enable/Disable Operations
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-cyan-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Bulk User Provisioning
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-cyan-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Comprehensive Audit Logging
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              API Endpoints
            </h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/provision-tool/users
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/provision-tool/users
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs">
                  PUT
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/provision-tool/users/:id
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/provision-tool/audit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/provision-tool/stats
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
