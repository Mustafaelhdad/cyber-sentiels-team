import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useEffect } from "react";

interface RunTask {
  id: number;
  run_id: number;
  tool: string;
  status: string;
  progress: number;
  logs_path: string | null;
  report_path: string | null;
  has_report: boolean;
  meta_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface Run {
  id: number;
  user_id: number;
  project_id: number;
  module: string;
  target_type: string;
  target_value: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  tasks: RunTask[];
  created_at: string;
  updated_at: string;
}

interface RunResponse {
  run: Run;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectResponse {
  project: Project;
}

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const MODULE_LABELS: Record<string, string> = {
  web_security: "Web Security",
  monitoring_ir: "Monitoring & IR",
  iam: "IAM",
};

const TOOL_LABELS: Record<string, string> = {
  zap: "OWASP ZAP",
  modsecurity: "ModSecurity",
  sonarqube: "SonarQube",
  wazuh: "Wazuh",
  misp: "MISP",
  n8n: "n8n",
};

function formatDuration(
  startedAt: string | null,
  finishedAt: string | null
): string {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const diffMs = end - start;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSec}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

export default function RunDetail() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setCurrentProject } = useCurrentProject();

  // Fetch project details
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiFetch<ProjectResponse>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const project = projectData?.project;

  // Set as current project when loaded
  useEffect(() => {
    if (project) {
      setCurrentProject({ id: project.id, name: project.name });
    }
  }, [project, setCurrentProject]);

  // Fetch run details
  const {
    data: runData,
    isLoading: runLoading,
    isError: runError,
    error: runErrorObj,
  } = useQuery({
    queryKey: ["run", projectId, runId],
    queryFn: () =>
      apiFetch<RunResponse>(`/projects/${projectId}/runs/${runId}`),
    enabled: !!projectId && !!runId,
    refetchInterval: (query) => {
      const run = query.state.data?.run;
      // Poll only if run is pending or running
      if (run && (run.status === "pending" || run.status === "running")) {
        return 3000;
      }
      return false;
    },
  });

  const run = runData?.run;

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/projects/${projectId}/runs/${runId}/cancel`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", projectId, runId] });
      queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
    },
  });

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel this run?")) {
      cancelMutation.mutate();
    }
  };

  const handleDownloadTaskReport = async (taskId: number) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api";
      const url = `${apiBase}/projects/${projectId}/runs/${runId}/tasks/${taskId}/download`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Report not available");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `task-${taskId}-report.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Report not available for this task.");
    }
  };

  const handleDownloadLogs = async (taskId: number) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api";
      const url = `${apiBase}/projects/${projectId}/runs/${runId}/tasks/${taskId}/download-logs`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Logs not available");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `task-${taskId}-logs.log`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Logs not available for this task.");
    }
  };

  if (projectLoading || runLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading run details...
        </p>
      </div>
    );
  }

  if (runError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">
          {(runErrorObj as Error)?.message || "Failed to load run"}
        </p>
        <button
          onClick={() => navigate(`/projects/${projectId}/runs`)}
          className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to runs
        </button>
      </div>
    );
  }

  if (!run || !project) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">Run not found</p>
        <Link
          to={`/projects/${projectId}/runs`}
          className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to runs
        </Link>
      </div>
    );
  }

  const canCancel = run.status === "pending" || run.status === "running";

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <li>
            <Link
              to="/projects"
              className="hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Projects
            </Link>
          </li>
          <li>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </li>
          <li>
            <Link
              to={`/projects/${projectId}`}
              className="hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              {project.name}
            </Link>
          </li>
          <li>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </li>
          <li>
            <Link
              to={`/projects/${projectId}/runs`}
              className="hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Runs
            </Link>
          </li>
          <li>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </li>
          <li className="text-gray-900 dark:text-white font-medium">
            Run #{run.id}
          </li>
        </ol>
      </nav>

      {/* Run Header */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Run #{run.id}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[run.status] || STATUS_COLORS.pending
                }`}
              >
                {run.status}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {MODULE_LABELS[run.module] || run.module} scan on{" "}
              <span className="font-medium">{run.target_value}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Run"}
              </button>
            )}
            <Link
              to={`/projects/${projectId}/runs`}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Runs
            </Link>
          </div>
        </div>

        {/* Run Info Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Module
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {MODULE_LABELS[run.module] || run.module}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Target Type
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {run.target_type}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Started
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {formatDateTime(run.started_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              Duration
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {formatDuration(run.started_at, run.finished_at)}
            </dd>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tasks
          </h2>
        </div>

        {run.tasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No tasks for this run.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {run.tasks.map((task) => (
              <div key={task.id} className="px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {task.status === "running" ? (
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent"></div>
                      ) : task.status === "completed" ? (
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : task.status === "failed" ? (
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                          <svg
                            className="h-5 w-5 text-red-600 dark:text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <svg
                            className="h-5 w-5 text-gray-400"
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
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {TOOL_LABELS[task.tool] || task.tool}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            STATUS_COLORS[task.status] || STATUS_COLORS.pending
                          }`}
                        >
                          {task.status}
                        </span>
                        {task.status === "running" && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {task.progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Download Report */}
                    <button
                      onClick={() => handleDownloadTaskReport(task.id)}
                      disabled={!task.has_report}
                      className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md ${
                        task.has_report
                          ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 cursor-pointer"
                          : "text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                      }`}
                      title={
                        task.has_report
                          ? "Download report"
                          : "No report available"
                      }
                    >
                      <svg
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Report
                    </button>

                    {/* Download Logs */}
                    <button
                      onClick={() => handleDownloadLogs(task.id)}
                      disabled={!task.logs_path}
                      className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md ${
                        task.logs_path
                          ? "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                          : "text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                      }`}
                      title={
                        task.logs_path ? "Download logs" : "No logs available"
                      }
                    >
                      <svg
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Logs
                    </button>
                  </div>
                </div>

                {/* Progress Bar for Running Tasks */}
                {task.status === "running" && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Error Message for Failed Tasks */}
                {task.status === "failed" && task.meta_json?.error && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {String(task.meta_json.error)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
