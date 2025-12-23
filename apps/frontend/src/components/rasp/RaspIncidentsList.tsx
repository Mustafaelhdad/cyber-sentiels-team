import { useState } from "react";
import type { RaspIncident } from "@/hooks/useApiQueries";

interface Props {
  incidents: RaspIncident[];
  isLoading?: boolean;
  onViewTrace?: (traceId: string) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  debug: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  warning:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  critical: "bg-red-200 text-red-900 dark:bg-red-800/50 dark:text-red-200",
};

const ACTION_COLORS: Record<string, string> = {
  allow: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  monitor:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  block: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const SINK_ICONS: Record<string, React.ReactNode> = {
  request: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  ),
  database: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  ),
  http: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  ),
  filesystem: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  ),
  behavior: (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
};

export function RaspIncidentsList({
  incidents,
  isLoading,
  onViewTrace,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg h-16"
          />
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          No Incidents
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          RASP is actively monitoring. No incidents detected yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {incidents.map((incident) => (
        <div
          key={incident.id}
          className="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Header row */}
          <button
            onClick={() =>
              setExpandedId(expandedId === incident.id ? null : incident.id)
            }
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Sink icon */}
              <div className="text-gray-500 dark:text-gray-400">
                {SINK_ICONS[incident.sink] ?? SINK_ICONS.request}
              </div>

              {/* Severity badge */}
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.info
                }`}
              >
                {incident.severity}
              </span>

              {/* Action badge */}
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  ACTION_COLORS[incident.action] ?? ACTION_COLORS.monitor
                }`}
              >
                {incident.action}
              </span>

              {/* Detection type */}
              {incident.detection_type && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {incident.detection_type.replace(/_/g, " ")}
                </span>
              )}

              {/* Message (truncated) */}
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {incident.message}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              {/* IP */}
              {incident.request_ip && (
                <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  {incident.request_ip}
                </code>
              )}

              {/* Time */}
              <span className="text-xs">
                {new Date(incident.occurred_at).toLocaleTimeString()}
              </span>

              {/* Expand icon */}
              <svg
                className={`h-4 w-4 transition-transform ${
                  expandedId === incident.id ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>

          {/* Expanded details */}
          {expandedId === incident.id && (
            <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
              {/* Request info */}
              {(incident.request_method || incident.request_path) && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Request
                  </h4>
                  <code className="text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block">
                    {incident.request_method} {incident.request_path}
                  </code>
                </div>
              )}

              {/* Sink data */}
              {incident.sink_data &&
                Object.keys(incident.sink_data).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Sink Data
                    </h4>
                    <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {JSON.stringify(incident.sink_data, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Identity */}
              {incident.user_id && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Identity
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    User ID: {incident.user_id}
                    {incident.user_email && ` (${incident.user_email})`}
                  </p>
                </div>
              )}

              {/* Trace link */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => onViewTrace?.(incident.trace_id)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View full trace ({incident.trace_id.slice(0, 8)}...)
                </button>
                <span className="text-xs text-gray-400">
                  Event ID: {incident.event_id.slice(0, 8)}...
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
