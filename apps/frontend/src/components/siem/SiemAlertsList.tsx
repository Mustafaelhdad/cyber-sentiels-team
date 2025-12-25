import { useState } from "react";
import { type SiemAlert, useSiemAcknowledgeAlert } from "@/hooks/useApiQueries";

interface Props {
  alerts: SiemAlert[];
  isLoading: boolean;
  onViewDetails?: (alert: SiemAlert) => void;
}

const severityConfig: Record<
  string,
  { bg: string; text: string; badge: string; border: string }
> = {
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    border: "border-l-red-500",
  },
  HIGH: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-300",
    badge:
      "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
    border: "border-l-orange-500",
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    badge:
      "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    border: "border-l-amber-500",
  },
  LOW: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    border: "border-l-blue-500",
  },
};

function AlertRow({
  alert,
  onViewDetails,
  onAcknowledge,
  isAcknowledging,
}: {
  alert: SiemAlert;
  onViewDetails?: (alert: SiemAlert) => void;
  onAcknowledge: (id: number) => void;
  isAcknowledging: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[alert.severity] ?? severityConfig.LOW;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`border-l-4 ${config.border} bg-white dark:bg-gray-800 rounded-r-lg shadow-sm overflow-hidden transition-all`}
    >
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded ${config.badge}`}
              >
                {alert.severity}
              </span>
              {alert.acknowledged && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                  Acknowledged
                </span>
              )}
              {alert.has_tip_analysis && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  TIP Enhanced
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(alert.alert_timestamp || alert.created_at)}
              </span>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {alert.rule_name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
              {alert.description || alert.truncated_log}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {alert.source}
            </span>
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${
                expanded ? "rotate-180" : ""
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
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="pt-4 space-y-3">
            <div>
              <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Log Entry
              </h5>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto font-mono">
                {alert.log_entry}
              </pre>
            </div>

            {alert.description && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Description
                </h5>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {alert.description}
                </p>
              </div>
            )}

            {alert.has_tip_analysis && (
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="h-4 w-4 text-purple-600 dark:text-purple-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Threat Intelligence Analysis
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Label:
                    </span>{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {alert.tip_label || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Confidence:
                    </span>{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {alert.tip_confidence
                        ? `${(alert.tip_confidence * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Malicious:
                    </span>{" "}
                    <span
                      className={`font-medium ${
                        alert.tip_is_malicious
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {alert.tip_is_malicious ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              {!alert.acknowledged && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge(alert.id);
                  }}
                  disabled={isAcknowledging}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
                >
                  {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
                </button>
              )}
              {onViewDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(alert);
                  }}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiemAlertsList({ alerts, isLoading, onViewDetails }: Props) {
  const acknowledgeMutation = useSiemAcknowledgeAlert();
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  const handleAcknowledge = async (id: number) => {
    setAcknowledgingId(id);
    try {
      await acknowledgeMutation.mutateAsync(id);
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
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
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          No Alerts
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          All clear! No security alerts have been detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          onViewDetails={onViewDetails}
          onAcknowledge={handleAcknowledge}
          isAcknowledging={acknowledgingId === alert.id}
        />
      ))}
    </div>
  );
}
