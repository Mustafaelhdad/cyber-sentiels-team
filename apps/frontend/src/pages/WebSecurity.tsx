import { useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import {
  useCreateRun,
  useProjectRuns,
  useWafProxies,
  useWafStats,
  useWafLogs,
} from "@/hooks/useApiQueries";
import {
  WafProxyCard,
  WafProxyForm,
  WafLogsList,
  WafStatsCard,
} from "@/components/waf";

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

type TargetType = "url" | "repo";
type TabType = "dast" | "waf";

export default function WebSecurity() {
  const { currentProject } = useCurrentProject();
  const [activeTab, setActiveTab] = useState<TabType>("waf");
  const [targetType, setTargetType] = useState<TargetType>("url");
  const [targetValue, setTargetValue] = useState("");

  // Only enable hooks when project is selected
  const createRunMutation = useCreateRun(currentProject?.id ?? 0);
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

  // Filter runs for web_security module only
  const recentRuns =
    runsData?.data?.filter((r) => r.module === "web_security").slice(0, 5) ??
    [];

  const proxies = proxiesData?.data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !targetValue.trim()) return;

    createRunMutation.mutate({
      module: "web_security",
      target_type: targetType,
      target_value: targetValue.trim(),
    });
  };

  // Show project selection prompt if no project selected
  if (!currentProject) {
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
            No Project Selected
          </h3>
          <p className="mt-2 text-yellow-700 dark:text-yellow-300">
            Please select a project before starting a security scan.
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
          Configure WAF protection and run DAST scans with OWASP ZAP.
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
                <div className="grid gap-4 md:grid-cols-2">
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
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Start a New Scan
            </h2>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Target Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Type
                </label>
                <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("url");
                      setTargetValue("");
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      targetType === "url"
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    Website URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("repo");
                      setTargetValue("");
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                      targetType === "repo"
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    Git Repo
                  </button>
                </div>
              </div>

              {/* Target Input */}
              <div>
                <label
                  htmlFor="target-value"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {targetType === "url" ? "Target URL" : "Git Repository URL"}
                </label>
                <input
                  id="target-value"
                  name="target-value"
                  type="url"
                  placeholder={
                    targetType === "url"
                      ? "https://example.com"
                      : "https://github.com/owner/repo"
                  }
                  required
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {targetType === "url"
                    ? "Enter the URL of the web application you want to scan (WAF + DAST)."
                    : "Enter the Git repository URL to analyze (SAST)."}
                </p>
              </div>

              {createRunMutation.isError && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
                  {createRunMutation.error?.message || "Failed to start scan"}
                </div>
              )}

              <button
                type="submit"
                disabled={createRunMutation.isPending || !targetValue.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {createRunMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Starting Scan...
                  </>
                ) : (
                  "Apply & Start Scan"
                )}
              </button>
            </form>
          </div>

          {/* Recent Scans */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Scans
              </h2>
              <Link
                to={`/projects/${currentProject.id}/runs`}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </Link>
            </div>

            {runsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Loading...
                </span>
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No web security scans have been run yet. Start a new scan above.
              </p>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <Link
                    key={run.id}
                    to={`/projects/${currentProject.id}/runs/${run.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {run.target_value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[run.status] || STATUS_COLORS.pending
                      }`}
                    >
                      {run.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
