import { useState } from "react";
import {
  type SoarIncident,
  useSoarUpdateIncidentStatus,
} from "@/hooks/useApiQueries";

interface SoarIncidentsListProps {
  incidents: SoarIncident[];
  isLoading: boolean;
  compact?: boolean;
}

export function SoarIncidentsList({
  incidents,
  isLoading,
  compact = false,
}: SoarIncidentsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateStatus = useSoarUpdateIncidentStatus();

  const getSeverityColor = (severity: string) => {
    const upper = severity?.toUpperCase();
    switch (upper) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "HIGH":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "LOW":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case "MALICIOUS":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
      case "CLEAN":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "mitigated":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "resolved":
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const handleStatusChange = (incidentId: string, newStatus: string) => {
    updateStatus.mutate({ incidentId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(compact ? 3 : 5)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg
          className="h-12 w-12 mx-auto mb-3 opacity-50"
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
        <p>No incidents recorded yet</p>
      </div>
    );
  }

  const displayedIncidents = compact ? incidents.slice(0, 5) : incidents;

  return (
    <div className="space-y-3">
      {displayedIncidents.map((incident) => (
        <div
          key={incident.incident_id}
          className={`bg-white dark:bg-gray-800 rounded-lg border ${
            incident.decision === "MALICIOUS"
              ? "border-red-200 dark:border-red-800/50"
              : "border-gray-200 dark:border-gray-700"
          } overflow-hidden transition-all`}
        >
          {/* Header */}
          <div
            className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() =>
              setExpandedId(
                expandedId === incident.incident_id
                  ? null
                  : incident.incident_id
              )
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                  {incident.incident_id}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(
                    incident.severity
                  )}`}
                >
                  {incident.severity}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getDecisionColor(
                    incident.decision
                  )}`}
                >
                  {incident.decision}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                    incident.status
                  )}`}
                >
                  {incident.status}
                </span>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${
                    expandedId === incident.incident_id ? "rotate-180" : ""
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
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              {incident.source_ip && (
                <span className="flex items-center gap-1">
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
                  {incident.source_ip}
                </span>
              )}
              {incident.attack_type && (
                <span className="flex items-center gap-1">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {incident.attack_type}
                </span>
              )}
              <span className="flex items-center gap-1">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {new Date(incident.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedId === incident.incident_id && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Alert ID
                  </h4>
                  <p className="text-sm text-gray-900 dark:text-white font-mono">
                    {incident.alert_id || "N/A"}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Created At
                  </h4>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(incident.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {incident.actions && incident.actions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Actions Taken
                  </h4>
                  <div className="space-y-1">
                    {incident.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            action.status === "completed"
                              ? "bg-green-500"
                              : action.status === "failed"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {action.action_type}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          - {action.result || action.action_detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Update Status:
                </span>
                {["open", "processing", "mitigated", "resolved", "closed"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() =>
                        handleStatusChange(incident.incident_id, status)
                      }
                      disabled={
                        incident.status === status || updateStatus.isPending
                      }
                      className={`px-2 py-1 text-xs rounded ${
                        incident.status === status
                          ? "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-not-allowed"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {status}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
