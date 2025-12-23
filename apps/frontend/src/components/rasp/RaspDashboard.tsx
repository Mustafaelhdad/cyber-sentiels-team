import { useState } from "react";
import {
  useRaspStats,
  useRaspIncidents,
  useRaspAlerts,
} from "@/hooks/useApiQueries";
import { RaspStatsCard } from "./RaspStatsCard";
import { RaspIncidentsList } from "./RaspIncidentsList";
import { RaspAlertsBanner } from "./RaspAlertsBanner";
import { RaspModeIndicator } from "./RaspModeIndicator";

interface Props {
  projectName: string;
}

type FilterSeverity = "" | "debug" | "info" | "warning" | "error" | "critical";
type FilterAction = "" | "allow" | "monitor" | "block";
type FilterSink =
  | ""
  | "request"
  | "database"
  | "http"
  | "filesystem"
  | "behavior";

export function RaspDashboard({ projectName }: Props) {
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("");
  const [filterAction, setFilterAction] = useState<FilterAction>("");
  const [filterSink, setFilterSink] = useState<FilterSink>("");
  const [, setSelectedTraceId] = useState<string | null>(null);

  // Fetch data
  const { data: statsData, isLoading: statsLoading } = useRaspStats(24);
  const { data: alertsData, isLoading: alertsLoading } = useRaspAlerts(10);
  const { data: incidentsData, isLoading: incidentsLoading } = useRaspIncidents(
    {
      severity: filterSeverity || undefined,
      action: filterAction || undefined,
      sink: filterSink || undefined,
      per_page: 50,
    }
  );

  const incidents = incidentsData?.data ?? [];
  const alerts = alertsData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Runtime Application Self-Protection (RASP)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              In-app protection monitoring database queries, HTTP requests, and
              file operations.
            </p>
          </div>
          <RaspModeIndicator mode="monitor" enabled={true} />
        </div>

        {/* Alerts banner */}
        <RaspAlertsBanner alerts={alerts} isLoading={alertsLoading} />
      </div>

      {/* Stats */}
      <RaspStatsCard stats={statsData} isLoading={statsLoading} />

      {/* Incidents list with filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Incidents
          </h3>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filterSeverity}
              onChange={(e) =>
                setFilterSeverity(e.target.value as FilterSeverity)
              }
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as FilterAction)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5"
            >
              <option value="">All Actions</option>
              <option value="block">Blocked</option>
              <option value="monitor">Monitored</option>
              <option value="allow">Allowed</option>
            </select>

            <select
              value={filterSink}
              onChange={(e) => setFilterSink(e.target.value as FilterSink)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5"
            >
              <option value="">All Sinks</option>
              <option value="request">Request</option>
              <option value="database">Database</option>
              <option value="http">HTTP</option>
              <option value="filesystem">Filesystem</option>
              <option value="behavior">Behavior</option>
            </select>
          </div>
        </div>

        <RaspIncidentsList
          incidents={incidents}
          isLoading={incidentsLoading}
          onViewTrace={setSelectedTraceId}
        />

        {/* Pagination info */}
        {incidentsData && incidentsData.total > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            Showing {incidents.length} of {incidentsData.total} incidents
          </div>
        )}
      </div>

      {/* How it works info */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-3">
          How RASP Protects {projectName}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-800/30">
              <svg
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                Database Monitoring
              </h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                Detects SQL injection patterns in queries before execution.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-800/30">
              <svg
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                SSRF Prevention
              </h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                Blocks outbound requests to internal networks and localhost.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-800/30">
              <svg
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
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
            </div>
            <div>
              <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                Path Traversal
              </h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                Detects and blocks directory traversal attempts in file
                operations.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-700">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            <strong>Current Mode:</strong> Monitor — RASP logs all suspicious
            activity but does not block requests. Switch to{" "}
            <code className="bg-indigo-100 dark:bg-indigo-800/50 px-1 rounded">
              RASP_MODE=block
            </code>{" "}
            in your environment to enable enforcement.
          </p>
        </div>
      </div>
    </div>
  );
}
