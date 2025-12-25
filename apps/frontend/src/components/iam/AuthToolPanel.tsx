import { useAuthToolHealth, useAuthToolStats } from "@/hooks/useApiQueries";
import { AuthToolStatsCard } from "./AuthToolStatsCard";
import { AuthToolTestPanel } from "./AuthToolTestPanel";

export function AuthToolPanel() {
  const { data: healthData, isLoading: healthLoading } = useAuthToolHealth();
  const { data: statsData, isLoading: statsLoading } = useAuthToolStats();

  const isServiceOnline = healthData?.available ?? false;

  return (
    <div className="space-y-6">
      {/* Service Status Banner */}
      <div
        className={`p-4 rounded-xl border ${
          isServiceOnline
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isServiceOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                isServiceOnline
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-red-800 dark:text-red-300"
              }`}
            >
              {healthLoading
                ? "Checking service status..."
                : isServiceOnline
                ? "Authentication Service Online"
                : "Authentication Service Offline"}
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
        <AuthToolStatsCard
          title="Registered Users"
          value={statsData?.users_registered ?? 0}
          subtitle="Total accounts"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />

        <AuthToolStatsCard
          title="Active Sessions"
          value={statsData?.pending_sessions ?? 0}
          subtitle="Awaiting OTP"
          color="yellow"
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

        <AuthToolStatsCard
          title="Token TTL"
          value={`${Math.floor((statsData?.jwt_ttl_seconds ?? 3600) / 60)}m`}
          subtitle="JWT expiration"
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
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          }
        />

        <AuthToolStatsCard
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          }
        />
      </div>

      {/* Test Panel */}
      <AuthToolTestPanel />

      {/* Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About Authentication Tool
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-500"
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
                User Registration & Login
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-500"
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
                Two-Factor Authentication (OTP)
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-500"
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
                JWT Token Generation
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-500"
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
                Token Verification
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              API Endpoints
            </h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/auth-tool/signup
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/auth-tool/signin
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/auth-tool/verify-otp
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/auth-tool/health
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
