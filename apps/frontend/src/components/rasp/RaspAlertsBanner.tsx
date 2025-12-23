import type { RaspIncident } from "@/hooks/useApiQueries";

interface Props {
  alerts: RaspIncident[];
  isLoading?: boolean;
}

export function RaspAlertsBanner({ alerts, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg h-12" />
    );
  }

  const blockedCount = alerts.filter((a) => a.action === "block").length;
  const criticalCount = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "error"
  ).length;

  if (blockedCount === 0 && criticalCount === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
        <svg
          className="h-5 w-5 text-green-600 dark:text-green-400"
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
        <span className="text-sm text-green-800 dark:text-green-200">
          No active alerts. RASP is monitoring your application.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0"
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
        <div className="flex-1">
          <span className="text-sm font-medium text-red-800 dark:text-red-200">
            Active Alerts:
          </span>
          <span className="ml-2 text-sm text-red-700 dark:text-red-300">
            {blockedCount > 0 && (
              <span className="mr-3">
                <strong>{blockedCount}</strong> blocked
              </span>
            )}
            {criticalCount > 0 && (
              <span>
                <strong>{criticalCount}</strong> high severity
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Recent alerts preview */}
      {alerts.length > 0 && (
        <div className="mt-3 space-y-1">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
            >
              <span className="font-mono bg-red-100 dark:bg-red-800/30 px-1 rounded">
                {alert.detection_type ?? alert.sink}
              </span>
              <span className="truncate">{alert.message}</span>
              <span className="text-red-500 dark:text-red-400 flex-shrink-0">
                {new Date(alert.occurred_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
