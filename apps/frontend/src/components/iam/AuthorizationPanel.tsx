import {
  useAuthzToolHealth,
  useAuthzToolStats,
  useAuthzToolRoles,
} from "@/hooks/useApiQueries";
import { AuthzToolStatsCard } from "./AuthzToolStatsCard";
import { AuthzToolTestPanel } from "./AuthzToolTestPanel";
import { AuthzToolUsersList } from "./AuthzToolUsersList";

export function AuthorizationPanel() {
  const { data: healthData, isLoading: healthLoading } = useAuthzToolHealth();
  const { data: statsData, isLoading: statsLoading } = useAuthzToolStats();
  const { data: rolesData } = useAuthzToolRoles();

  const isServiceOnline = healthData?.available ?? false;

  return (
    <div className="space-y-6">
      {/* Service Status Banner */}
      <div
        className={`p-4 rounded-xl border ${
          isServiceOnline
            ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isServiceOnline ? "bg-purple-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                isServiceOnline
                  ? "text-purple-800 dark:text-purple-300"
                  : "text-red-800 dark:text-red-300"
              }`}
            >
              {healthLoading
                ? "Checking service status..."
                : isServiceOnline
                ? "Authorization Service Online"
                : "Authorization Service Offline"}
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
        <AuthzToolStatsCard
          title="Total Users"
          value={statsData?.total_users ?? 0}
          subtitle="Managed accounts"
          color="purple"
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

        <AuthzToolStatsCard
          title="Available Roles"
          value={
            statsData?.available_roles?.length ?? rolesData?.roles?.length ?? 0
          }
          subtitle="Role definitions"
          color="indigo"
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          }
        />

        <AuthzToolStatsCard
          title="Access Policies"
          value={statsData?.available_policies?.length ?? 2}
          subtitle="RBAC & ABAC"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          }
        />

        <AuthzToolStatsCard
          title="Service Status"
          value={isServiceOnline ? "Online" : "Offline"}
          subtitle={
            statsData?.timestamp
              ? `Updated ${new Date(
                  statsData.timestamp * 1000
                ).toLocaleTimeString()}`
              : undefined
          }
          color={isServiceOnline ? "green" : "red"}
          loading={healthLoading}
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
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
          }
        />
      </div>

      {/* Roles Overview */}
      {rolesData?.roles && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Role Privileges Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Role
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Read
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Write
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Delete
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody>
                {rolesData.roles.map((role) => (
                  <tr
                    key={role.role}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 dark:text-white capitalize">
                        {role.role}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      {role.privileges.includes("read") ? (
                        <span className="text-emerald-500">✓</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {role.privileges.includes("write") ? (
                        <span className="text-emerald-500">✓</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {role.privileges.includes("delete") ? (
                        <span className="text-emerald-500">✓</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {role.privileges.includes("manage") ? (
                        <span className="text-emerald-500">✓</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Management */}
      <AuthzToolUsersList />

      {/* Test Panel */}
      <AuthzToolTestPanel />

      {/* Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About Authorization Tool
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-500"
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
                Role-Based Access Control (RBAC)
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-500"
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
                Attribute-Based Access Control (ABAC)
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-500"
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
                User & Group Management
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-500"
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
                Resource-Level Permissions
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-500"
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
                Authorization Logging
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              API Endpoints
            </h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/authz-tool/authorize
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/authz-tool/privileges
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/authz-tool/users
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/authz-tool/roles
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
