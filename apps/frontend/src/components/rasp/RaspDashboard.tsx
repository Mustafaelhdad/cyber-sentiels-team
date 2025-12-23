import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRaspStats,
  useRaspIncidents,
  useRaspAlerts,
  raspQueryKeys,
} from "@/hooks/useApiQueries";
import { RaspStatsCard } from "./RaspStatsCard";
import { RaspIncidentsList } from "./RaspIncidentsList";
import { RaspAlertsBanner } from "./RaspAlertsBanner";
import { RaspModeIndicator } from "./RaspModeIndicator";
import { RaspDemoPanel } from "./RaspDemoPanel";
import {
  buildDemoIncidents,
  buildDemoStats,
  loadRaspDemoRuns,
} from "./raspDemoStorage";

interface Props {
  projectName: string;
  projectId: number;
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

type TabType = "dashboard" | "demo";

export function RaspDashboard({ projectName, projectId }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("demo");
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("");
  const [filterAction, setFilterAction] = useState<FilterAction>("");
  const [filterSink, setFilterSink] = useState<FilterSink>("");
  const [, setSelectedTraceId] = useState<string | null>(null);

  // Fetch data
  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useRaspStats(24);
  const {
    data: alertsData,
    isLoading: alertsLoading,
    isError: alertsError,
    refetch: refetchAlerts,
  } = useRaspAlerts(10);
  const {
    data: incidentsData,
    isLoading: incidentsLoading,
    isError: incidentsError,
    refetch: refetchIncidents,
  } = useRaspIncidents({
    severity: filterSeverity || undefined,
    action: filterAction || undefined,
    sink: filterSink || undefined,
    per_page: 50,
  });

  const demoRuns = useMemo(
    () => loadRaspDemoRuns(projectId),
    [activeTab, projectId]
  );
  const demoIncidents = useMemo(
    () => buildDemoIncidents(demoRuns),
    [demoRuns]
  );
  const demoStats = useMemo(() => buildDemoStats(demoRuns, 24), [demoRuns]);
  const filteredDemoIncidents = useMemo(() => {
    return demoIncidents.filter((incident) => {
      if (filterSeverity && incident.severity !== filterSeverity) return false;
      if (filterAction && incident.action !== filterAction) return false;
      if (filterSink && incident.sink !== filterSink) return false;
      return true;
    });
  }, [demoIncidents, filterSeverity, filterAction, filterSink]);

  const hasApiError = statsError || alertsError || incidentsError;
  const backendEmpty =
    !statsLoading &&
    !incidentsLoading &&
    statsData?.totals?.total === 0 &&
    (incidentsData?.data?.length ?? 0) === 0;
  const useDemoFallback = demoRuns.length > 0 && (hasApiError || backendEmpty);

  const incidents = useDemoFallback
    ? filteredDemoIncidents
    : incidentsData?.data ?? [];
  const alerts = useDemoFallback ? demoIncidents : alertsData?.data ?? [];
  const stats = useDemoFallback ? demoStats : statsData;

  const handleDemoTestComplete = () => {
    // Refetch stats and incidents when demo tests complete
    // Invalidate all RASP queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: raspQueryKeys.stats() });
    queryClient.invalidateQueries({ queryKey: raspQueryKeys.alerts() });
    queryClient.invalidateQueries({ queryKey: raspQueryKeys.incidents() });

    // Also trigger immediate refetch
    refetchStats();
    refetchAlerts();
    refetchIncidents();
  };

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
        <RaspAlertsBanner
          alerts={alerts}
          isLoading={useDemoFallback ? false : alertsLoading}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("demo")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "demo"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <span className="flex items-center gap-2">
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Live Demo
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("dashboard");
              // Refetch dashboard data when switching to dashboard tab
              refetchStats();
              refetchAlerts();
              refetchIncidents();
            }}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "dashboard"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <span className="flex items-center gap-2">
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Dashboard
            </span>
          </button>
        </nav>
      </div>

      {/* Demo Tab Content */}
      {activeTab === "demo" && (
        <RaspDemoPanel
          projectId={projectId}
          onTestComplete={handleDemoTestComplete}
        />
      )}

      {/* Dashboard Tab Content */}
      {activeTab === "dashboard" && (
        <>
          {/* Stats */}
          <RaspStatsCard
            stats={stats}
            isLoading={useDemoFallback ? false : statsLoading}
          />

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
                  onChange={(e) =>
                    setFilterAction(e.target.value as FilterAction)
                  }
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

            {/* Show message when no incidents and not loading - likely backend is offline */}
            {useDemoFallback && (
              <div className="mb-4 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-sky-800 dark:text-sky-200">
                      Showing Demo Results
                    </h4>
                    <p className="text-sm text-sky-700 dark:text-sky-300 mt-1">
                      These metrics come from your local demo test runs. Start
                      the backend services to see live incident data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!useDemoFallback &&
              !incidentsLoading &&
              incidents.length === 0 &&
              !statsData &&
              hasApiError && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Backend Service Unavailable
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      The RASP backend service is not running. To see real
                      incidents data, please start the backend server.
                      Alternatively, use the{" "}
                      <button
                        onClick={() => setActiveTab("demo")}
                        className="font-semibold underline hover:no-underline"
                      >
                        Live Demo
                      </button>{" "}
                      tab to test RASP detection capabilities with simulated
                      attacks.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <RaspIncidentsList
              incidents={incidents}
              isLoading={useDemoFallback ? false : incidentsLoading}
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
                <strong>Current Mode:</strong> Monitor — RASP logs all
                suspicious activity but does not block requests. Switch to{" "}
                <code className="bg-indigo-100 dark:bg-indigo-800/50 px-1 rounded">
                  RASP_MODE=block
                </code>{" "}
                in your environment to enable enforcement.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
