import { useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useProject, useProjectRuns, queryKeys } from "@/hooks/useApiQueries";
import { queryClient } from "@/lib/queryClient";

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

export default function ProjectRuns() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useCurrentProject();

  // Use shared hooks
  const {
    data: projectData,
    isLoading: projectLoading,
    isError: projectError,
  } = useProject(projectId);

  const project = projectData?.project;

  // Set as current project when loaded
  useEffect(() => {
    if (project) {
      setCurrentProject({ id: project.id, name: project.name });
    }
  }, [project, setCurrentProject]);

  // Fetch runs using shared hook (includes smart polling)
  const {
    data: runsData,
    isLoading: runsLoading,
    isError: runsError,
    error: runsErrorObj,
  } = useProjectRuns(projectId);

  const runs = runsData?.data ?? [];

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (runId: number) =>
      apiFetch<void>(`/projects/${projectId}/runs/${runId}/cancel`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs(projectId!) });
    },
  });

  const handleCancel = (runId: number) => {
    if (window.confirm("Are you sure you want to cancel this run?")) {
      cancelMutation.mutate(runId);
    }
  };

  const handleDownloadReport = async (runId: number, tool?: string) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("auth_token");

      // Build headers with auth token
      const headers: HeadersInit = {
        Accept: "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // If we have a specific tool, use the run report endpoint with tool param
      // Otherwise, navigate to run detail to view reports
      if (tool) {
        const url = `${apiBase}/projects/${projectId}/runs/${runId}/report?tool=${tool}`;
        const res = await fetch(url, { credentials: "include", headers });
        if (!res.ok) throw new Error("Report not available");
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `run-${runId}-${tool}-report.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        // Navigate to run detail page to view all task reports
        navigate(`/projects/${projectId}/runs/${runId}`);
      }
    } catch {
      alert("Report not available for this run.");
    }
  };

  if (projectLoading || runsLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading runs...</p>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">Failed to load project</p>
        <button
          onClick={() => navigate("/projects")}
          className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to projects
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">Project not found</p>
        <Link
          to="/projects"
          className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

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
          <li className="text-gray-900 dark:text-white font-medium">
            Runs History
          </li>
        </ol>
      </nav>

      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Runs History
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View all security scan runs for{" "}
            <span className="font-medium">{project.name}</span>.
          </p>
        </div>
        <Link
          to={`/projects/${projectId}`}
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
          Back to Project
        </Link>
      </div>

      {/* Error State */}
      {runsError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center mb-6">
          <p className="text-red-600 dark:text-red-400">
            {(runsErrorObj as Error)?.message || "Failed to load runs"}
          </p>
          <button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.runs(projectId!),
              })
            }
            className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!runsError && runs.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No runs yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Start a security scan from a module to see results here.
          </p>
          <Link
            to={`/projects/${projectId}`}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Go to Project
          </Link>
        </div>
      )}

      {/* Runs Table */}
      {!runsError && runs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Module
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {runs.map((run) => {
                  const canCancel =
                    run.status === "pending" || run.status === "running";
                  const hasReport = run.status === "completed";
                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {MODULE_LABELS[run.module] || run.module}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {run.target_type}
                          </span>
                          <span
                            className="truncate max-w-xs"
                            title={run.target_value}
                          >
                            {run.target_value}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[run.status] || STATUS_COLORS.pending
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDateTime(run.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDuration(run.started_at, run.finished_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Detail */}
                          <Link
                            to={`/projects/${projectId}/runs/${run.id}`}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                            title="View details"
                          >
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </Link>

                          {/* Download Report */}
                          <button
                            onClick={() =>
                              handleDownloadReport(run.id, run.tasks?.[0]?.tool)
                            }
                            disabled={!hasReport}
                            className={`${
                              hasReport
                                ? "text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 cursor-pointer"
                                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                            }`}
                            title={
                              hasReport ? "View report" : "No report available"
                            }
                          >
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
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </button>

                          {/* Cancel Run */}
                          <button
                            onClick={() => handleCancel(run.id)}
                            disabled={!canCancel || cancelMutation.isPending}
                            className={`${
                              canCancel
                                ? "text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 cursor-pointer"
                                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                            }`}
                            title={canCancel ? "Cancel run" : "Cannot cancel"}
                          >
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
