import type { SiemRule } from "@/hooks/useApiQueries";

interface Props {
  rules: SiemRule[];
  isLoading: boolean;
}

const severityConfig: Record<string, { bg: string; text: string }> = {
  CRITICAL: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
  },
  HIGH: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-700 dark:text-orange-300",
  },
  MEDIUM: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  LOW: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
  },
};

export function SiemRulesList({ rules, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Detection Rules
          </h3>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detection Rules
        </h3>
        <div className="text-center py-8">
          <svg
            className="h-12 w-12 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            No detection rules available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detection Rules
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {rules.length} active rules for threat detection
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => {
            const config = severityConfig[rule.severity] ?? severityConfig.LOW;
            return (
              <div
                key={rule.id}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${config.bg} ${config.text}`}
                      >
                        {rule.severity}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {rule.id}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {rule.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {rule.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">
                        Pattern:
                      </span>
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono text-gray-700 dark:text-gray-300">
                        {rule.pattern}
                      </code>
                    </div>
                    {rule.threshold && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 dark:text-gray-400">
                          Threshold:
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {rule.threshold}
                        </span>
                      </div>
                    )}
                    {rule.time_window && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 dark:text-gray-400">
                          Window:
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {rule.time_window}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
