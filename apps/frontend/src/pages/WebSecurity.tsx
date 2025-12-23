import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import {
  useProjectRuns,
  useProject,
  useWafProxies,
  useWafStats,
  useWafLogs,
  useSastRuns,
  useSastFindings,
  useSastHealth,
} from "@/hooks/useApiQueries";
import {
  WafProxyCard,
  WafProxyForm,
  WafLogsList,
  WafStatsCard,
} from "@/components/waf";
import {
  SastScanForm,
  SastFindingsTable,
  SastRunsList,
} from "@/components/sast";
import { DastScanForm, DastRunsList } from "@/components/dast";
import { RaspDashboard } from "@/components/rasp";

type TabType = "dast" | "waf" | "sast" | "rasp";

export default function WebSecurity() {
  const { currentProject, clearCurrentProject } = useCurrentProject();
  const [activeTab, setActiveTab] = useState<TabType>("waf");
  const [selectedSastRun, setSelectedSastRun] = useState<number | null>(null);

  // Validate that the stored project actually exists on the server
  const { isError: projectError } = useProject(currentProject?.id);

  // Clear invalid project from storage if it doesn't exist on server
  useEffect(() => {
    if (projectError && currentProject) {
      // Project doesn't exist or user doesn't have access - clear it
      clearCurrentProject();
    }
  }, [projectError, currentProject, clearCurrentProject]);

  // Only enable hooks when project is selected
  const { data: runsData, isLoading: runsLoading } = useProjectRuns(
    currentProject?.id
  );

  // WAF hooks
  const { data: proxiesData, isLoading: proxiesLoading } = useWafProxies(
    currentProject?.id
  );
  const { data: statsData, isLoading: statsLoading } = useWafStats(
    currentProject?.id
  );
  const { data: logsData, isLoading: logsLoading } = useWafLogs(
    currentProject?.id,
    undefined,
    50
  );

  // SAST hooks
  const { data: sastHealthData } = useSastHealth(currentProject?.id);
  const { data: sastRunsData, isLoading: sastRunsLoading } = useSastRuns(
    currentProject?.id
  );
  const { data: sastFindingsData, isLoading: sastFindingsLoading } =
    useSastFindings(
      currentProject?.id,
      selectedSastRun ?? undefined,
      !!selectedSastRun
    );

  // Filter runs for web_security module only
  const recentRuns =
    runsData?.data?.filter((r) => r.module === "web_security").slice(0, 5) ??
    [];

  const proxies = proxiesData?.data ?? [];
  const sastRuns = sastRunsData?.runs ?? [];

  const handleSastScanStarted = (runId: number) => {
    setSelectedSastRun(runId);
  };

  const handleViewFindings = (runId: number) => {
    setSelectedSastRun(runId);
  };

  // Show project selection prompt if no project selected or project is invalid
  if (!currentProject || projectError) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Web Security
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure and run DAST scans with OWASP ZAP against your web
            applications.
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-yellow-500"
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
          <h3 className="mt-4 text-lg font-medium text-yellow-800 dark:text-yellow-200">
            {projectError ? "Project Not Found" : "No Project Selected"}
          </h3>
          <p className="mt-2 text-yellow-700 dark:text-yellow-300">
            {projectError
              ? "The selected project no longer exists or you don't have access to it."
              : "Please select a project before starting a security scan."}
          </p>
          <Link
            to="/projects"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Web Security
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Configure WAF protection, run DAST scans, and analyze source code with
          SAST.
        </p>
        <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400">
          Project: {currentProject.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("waf")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "waf"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              WAF Proxy
            </span>
          </button>
          <button
            onClick={() => setActiveTab("dast")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "dast"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              DAST Scanner
            </span>
          </button>
          <button
            onClick={() => setActiveTab("sast")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "sast"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              SAST Scanner
              {sastHealthData?.available === false && (
                <span
                  className="ml-1 h-2 w-2 rounded-full bg-red-500"
                  title="Service unavailable"
                />
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("rasp")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "rasp"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
                  d="M12 6v6l4 2"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4a8 8 0 100 16 8 8 0 000-16z"
                />
              </svg>
              RASP
            </span>
          </button>
        </nav>
      </div>

      {/* WAF Tab Content */}
      {activeTab === "waf" && (
        <div className="space-y-6">
          {/* WAF Stats */}
          <WafStatsCard stats={statsData?.stats} isLoading={statsLoading} />

          {/* WAF Proxies */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              WAF Proxies
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create WAF proxies to protect your web applications. Traffic sent
              to the WAF URL will be inspected by ModSecurity before being
              forwarded to your origin.
            </p>

            <div className="space-y-4">
              <WafProxyForm projectId={currentProject.id} />

              {proxiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    Loading proxies...
                  </span>
                </div>
              ) : proxies.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-6 text-center">
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
                    No WAF Proxies
                  </h3>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    Click "Add WAF Proxy" above to create your first
                    WAF-protected endpoint.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                  {proxies.map((proxy) => (
                    <WafProxyCard
                      key={proxy.id}
                      proxy={proxy}
                      projectId={currentProject.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* WAF Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent WAF Activity
            </h2>
            <WafLogsList logs={logsData?.logs ?? []} isLoading={logsLoading} />
          </div>
        </div>
      )}

      {/* DAST Tab Content */}
      {activeTab === "dast" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Start a DAST Scan
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Run OWASP ZAP against your app URL. We’ll create a web
                  security run and track the ZAP task status.
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                ZAP
              </span>
            </div>
            <DastScanForm projectId={currentProject.id} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent DAST Scans
              </h2>
              <Link
                to={`/projects/${currentProject.id}/runs`}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </Link>
            </div>
            <DastRunsList
              runs={recentRuns}
              projectId={currentProject.id}
              isLoading={runsLoading}
            />
          </div>
        </div>
      )}

      {/* SAST Tab Content */}
      {activeTab === "sast" && (
        <div className="space-y-6">
          {/* SAST Service Status */}
          {sastHealthData?.available === false && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-red-500 mr-2"
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
                <span className="text-sm text-red-800 dark:text-red-200">
                  SAST service is currently unavailable. Please ensure the
                  container is running.
                </span>
              </div>
            </div>
          )}

          {/* SAST Scan Form */}
          <SastScanForm
            projectId={currentProject.id}
            onScanStarted={handleSastScanStarted}
          />

          {/* SAST Findings (if a run is selected) */}
          {selectedSastRun && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Scan Findings
                </h2>
                <button
                  onClick={() => setSelectedSastRun(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Close
                </button>
              </div>
              <SastFindingsTable
                findings={sastFindingsData?.findings ?? []}
                isLoading={sastFindingsLoading}
              />
            </div>
          )}

          {/* SAST Runs History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent SAST Scans
            </h2>
            <SastRunsList
              runs={sastRuns}
              projectId={currentProject.id}
              isLoading={sastRunsLoading}
              onViewFindings={handleViewFindings}
            />
          </div>
        </div>
      )}

      {/* RASP Tab Content */}
      {activeTab === "rasp" && (
        <div className="space-y-6">
          <RaspDashboard
            projectId={currentProject.id}
            projectName={currentProject.name}
          />
        </div>
      )}
    </div>
  );
}
