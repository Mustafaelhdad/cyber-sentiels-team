import { type SoarStats } from "@/hooks/useApiQueries";

interface SoarStatsCardProps {
  stats: SoarStats | undefined;
  isLoading: boolean;
}

export function SoarStatsCard({ stats, isLoading }: SoarStatsCardProps) {
  const statItems = [
    {
      label: "Incidents Processed",
      value: stats?.incidents_processed ?? 0,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
      color: "emerald",
    },
    {
      label: "Threats Detected",
      value: stats?.threats_detected ?? 0,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      color: "red",
    },
    {
      label: "Actions Executed",
      value: stats?.actions_executed ?? 0,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      color: "amber",
    },
    {
      label: "IPs Blocked",
      value: stats?.ips_blocked ?? 0,
      icon: (
        <svg
          className="h-5 w-5"
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
      ),
      color: "purple",
    },
  ];

  const colorClasses: Record<
    string,
    { bg: string; text: string; iconBg: string }
  > = {
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-100 dark:bg-emerald-800/30",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-900/20",
      text: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-100 dark:bg-red-800/30",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-800/30",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      text: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-100 dark:bg-purple-800/30",
    },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item) => {
        const colors = colorClasses[item.color];
        return (
          <div
            key={item.label}
            className={`${colors.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${colors.iconBg}`}>
                <span className={colors.text}>{item.icon}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {item.label}
                </p>
                <p className={`text-2xl font-bold ${colors.text}`}>
                  {item.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
