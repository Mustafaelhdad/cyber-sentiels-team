import type { WafLog } from "@/hooks/useApiQueries";

interface WafLogsListProps {
  logs: WafLog[];
  isLoading?: boolean;
}

export default function WafLogsList({ logs, isLoading }: WafLogsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          Loading logs...
        </span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
        No logs yet. Send traffic to your WAF URL to see activity.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Time
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              IP
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Method
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Path
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {logs.map((log, idx) => (
            <tr
              key={`${log.timestamp}-${idx}`}
              className={`${
                log.blocked
                  ? "bg-red-50 dark:bg-red-900/10"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                {new Date(log.timestamp).toLocaleTimeString()}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-800 dark:text-gray-200">
                {log.ip}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    log.method === "GET"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : log.method === "POST"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : log.method === "PUT" || log.method === "PATCH"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      : log.method === "DELETE"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  {log.method}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                {log.path}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">
                <span
                  className={`${
                    log.status >= 500
                      ? "text-red-600 dark:text-red-400"
                      : log.status >= 400
                      ? "text-yellow-600 dark:text-yellow-400"
                      : log.status >= 300
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {log.status}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs">
                {log.blocked ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    <svg
                      className="mr-1 h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <svg
                      className="mr-1 h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Allowed
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
