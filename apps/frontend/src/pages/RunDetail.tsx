import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  useProject,
  useRun,
  useRunTasks,
  useCancelRun,
  type RunTask,
  type Run,
} from "@/hooks/useApiQueries";

interface LogsResponse {
  logs: string;
}

interface ReportResponse {
  report: unknown;
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

const TOOL_ICONS: Record<string, string> = {
  zap: "🔍",
  modsecurity: "🛡️",
  sonarqube: "📊",
  wazuh: "👁️",
  misp: "🔗",
  n8n: "⚡",
};

type ViewerTab = "status" | "report" | "logs";

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

// Calculate overall run progress from tasks
function calculateRunProgress(tasks: RunTask[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(total / tasks.length);
}

// Status icon component
function StatusIcon({ status }: { status: string }) {
  if (status === "running") {
    return (
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
    );
  }
  if (status === "completed") {
    return (
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
    );
  }
  if (status === "failed") {
    return (
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
    );
  }
  if (status === "cancelled") {
    return (
      <svg
        className="h-5 w-5 text-gray-500 dark:text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
    );
  }
  // pending
  return (
    <svg
      className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
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
  );
}

// Logs Viewer Component with polling
function LogsViewer({
  projectId,
  runId,
  taskId,
  isActive,
}: {
  projectId: string;
  runId: string;
  taskId: number;
  isActive: boolean;
}) {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const {
    data: logsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["task-logs", projectId, runId, taskId],
    queryFn: () =>
      apiFetch<LogsResponse>(
        `/projects/${projectId}/runs/${runId}/tasks/${taskId}/logs`
      ),
    refetchInterval: isActive ? 3000 : false,
    retry: false,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [logsData?.logs, autoScroll]);

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        logsContainerRef.current;
      // If user scrolled away from bottom, disable auto-scroll
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const blob = await apiFetchBlob(
        `/projects/${projectId}/runs/${runId}/tasks/${taskId}/download-logs`
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `task-${taskId}-logs.log`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Logs not available for download.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          Loading logs...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
        <p className="text-gray-500 dark:text-gray-400">
          {(error as Error)?.message || "Logs not available yet."}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const logs = logsData?.logs || "";

  return (
    <div className="flex flex-col h-full">
      {/* Logs Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Task Logs
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Refresh logs"
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={handleDownloadLogs}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Download logs"
          >
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          <button
            onClick={() => {
              setAutoScroll(true);
              if (logsContainerRef.current) {
                logsContainerRef.current.scrollTop =
                  logsContainerRef.current.scrollHeight;
              }
            }}
            className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ${
              autoScroll
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
            title="Auto-scroll"
          >
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
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Logs Content */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-xs text-gray-300 min-h-[300px] max-h-[500px]"
      >
        {logs ? (
          <pre className="whitespace-pre-wrap break-words">{logs}</pre>
        ) : (
          <p className="text-gray-500 italic">No logs available yet.</p>
        )}
      </div>
    </div>
  );
}

// Report Viewer Component
function ReportViewer({
  projectId,
  runId,
  task,
}: {
  projectId: string;
  runId: string;
  task: RunTask;
}) {
  const [viewMode, setViewMode] = useState<"html" | "json">("html");
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState(false);

  // Fetch JSON report
  const {
    data: jsonReport,
    isLoading: jsonLoading,
    isError: jsonError,
  } = useQuery({
    queryKey: ["task-report-json", projectId, runId, task.id],
    queryFn: () =>
      apiFetch<ReportResponse>(
        `/projects/${projectId}/runs/${runId}/tasks/${task.id}/report`
      ),
    enabled: task.has_report,
    retry: false,
  });

  // Load HTML report blob
  useEffect(() => {
    let mounted = true;

    const loadHtmlReport = async () => {
      if (!task.has_report) return;

      try {
        const blob = await apiFetchBlob(
          `/projects/${projectId}/runs/${runId}/tasks/${task.id}/download-html`
        );
        if (mounted) {
          const url = window.URL.createObjectURL(blob);
          setHtmlUrl(url);
          setHtmlError(false);
        }
      } catch {
        if (mounted) {
          setHtmlError(true);
        }
      }
    };

    loadHtmlReport();

    return () => {
      mounted = false;
      if (htmlUrl) {
        window.URL.revokeObjectURL(htmlUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, runId, task.id, task.has_report]);

  // Check for PDF report
  useEffect(() => {
    let mounted = true;

    const loadPdfReport = async () => {
      if (!task.has_report) return;

      try {
        const blob = await apiFetchBlob(
          `/projects/${projectId}/runs/${runId}/tasks/${task.id}/download`
        );
        // Check if it's a PDF by content type or just try to use it
        if (mounted && blob.type === "application/pdf") {
          const url = window.URL.createObjectURL(blob);
          setPdfUrl(url);
        }
      } catch {
        // PDF not available, that's fine
      }
    };

    loadPdfReport();

    return () => {
      mounted = false;
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, runId, task.id, task.has_report]);

  const handleDownloadReport = async () => {
    try {
      const blob = await apiFetchBlob(
        `/projects/${projectId}/runs/${runId}/tasks/${task.id}/download`
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `task-${task.id}-report`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Report not available for download.");
    }
  };

  const handleDownloadHtml = async () => {
    try {
      const blob = await apiFetchBlob(
        `/projects/${projectId}/runs/${runId}/tasks/${task.id}/download-html`
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `task-${task.id}-report.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("HTML report not available for download.");
    }
  };

  if (!task.has_report) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            No report available yet.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Report will be available after the task completes.
          </p>
        </div>
      </div>
    );
  }

  const hasHtml = !!(htmlUrl && !htmlError);
  const hasJson = !!(jsonReport?.report && !jsonError);

  return (
    <div className="flex flex-col h-full">
      {/* Report Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          {/* View Mode Tabs */}
          <div className="flex bg-gray-200 dark:bg-gray-600 rounded-md p-0.5">
            {hasHtml && (
              <button
                onClick={() => setViewMode("html")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === "html"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                HTML
              </button>
            )}
            {hasJson && (
              <button
                onClick={() => setViewMode("json")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === "json"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                JSON
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasHtml && (
            <button
              onClick={handleDownloadHtml}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Download HTML report"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              HTML
            </button>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              download={`task-${task.id}-report.pdf`}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Download PDF report"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              PDF
            </a>
          )}
          <button
            onClick={handleDownloadReport}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Download report"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto min-h-[300px] max-h-[600px]">
        {viewMode === "html" && hasHtml && (
          <iframe
            src={htmlUrl}
            className="w-full h-full min-h-[500px] bg-white"
            title="HTML Report"
            sandbox="allow-same-origin"
          />
        )}
        {viewMode === "json" && hasJson && (
          <div className="p-4 bg-gray-900 font-mono text-xs text-gray-300 overflow-auto h-full">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(jsonReport.report, null, 2)}
            </pre>
          </div>
        )}
        {!hasHtml && !hasJson && jsonLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">
              Loading report...
            </span>
          </div>
        )}
        {!hasHtml && !hasJson && !jsonLoading && (
          <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">
              Report content could not be loaded. Try downloading instead.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Task Status Panel Component
function TaskStatusPanel({ task }: { task: RunTask }) {
  return (
    <div className="p-4">
      {/* Status Overview */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700">
          <StatusIcon status={task.status} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {TOOL_LABELS[task.tool] || task.tool}
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              STATUS_COLORS[task.status] || STATUS_COLORS.pending
            }`}
          >
            {task.status}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {task.progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              task.status === "completed"
                ? "bg-green-500"
                : task.status === "failed"
                ? "bg-red-500"
                : task.status === "cancelled"
                ? "bg-gray-400"
                : "bg-indigo-600"
            }`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* Task Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Tool
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {TOOL_LABELS[task.tool] || task.tool}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Status
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white capitalize">
            {task.status}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Created
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {formatDateTime(task.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Last Updated
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {formatDateTime(task.updated_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Report Available
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {task.has_report ? "Yes" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">
            Logs Available
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {task.logs_path ? "Yes" : "No"}
          </dd>
        </div>
      </div>

      {/* Error Message for Failed Tasks */}
      {task.status === "failed" && task.meta_json?.error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
            Error Details
          </h4>
          <p className="text-sm text-red-600 dark:text-red-400">
            {String(task.meta_json.error)}
          </p>
        </div>
      )}

      {/* Meta JSON */}
      {task.meta_json &&
      Object.keys(task.meta_json).filter((k) => k !== "error").length > 0 ? (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Info
          </h4>
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-xs overflow-auto">
            <pre className="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(task.meta_json).filter(([k]) => k !== "error")
                ),
                null,
                2
              )}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function RunDetail() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useCurrentProject();

  // State for selected tool tab and viewer tab
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [viewerTab, setViewerTab] = useState<ViewerTab>("status");

  // Use shared hooks
  const { data: projectData, isLoading: projectLoading } =
    useProject(projectId);
  const project = projectData?.project;

  // Set as current project when loaded
  useEffect(() => {
    if (project) {
      setCurrentProject({ id: project.id, name: project.name });
    }
  }, [project, setCurrentProject]);

  // Fetch run details using shared hook (includes smart polling)
  const {
    data: runData,
    isLoading: runLoading,
    isError: runError,
    error: runErrorObj,
  } = useRun(projectId, runId);

  const run = runData?.run;

  // Fetch tasks from dedicated endpoint for freshness (includes smart polling)
  const { data: tasksData } = useRunTasks(projectId, runId);
  // Use tasks from dedicated query, fallback to run's tasks
  const tasks = tasksData?.tasks ?? run?.tasks ?? [];

  // Auto-select first task when tasks load
  useEffect(() => {
    if (tasks.length > 0 && selectedTaskId === null) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  // Cancel mutation using shared hook
  const cancelMutation = useCancelRun(projectId!, runId!);

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel this run?")) {
      cancelMutation.mutate();
    }
  };

  // Get selected task from tasks data
  const selectedTask = useMemo(() => {
    if (selectedTaskId === null) return null;
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // Check if task/run is active (for live polling)
  const isTaskActive = useMemo(() => {
    if (!selectedTask) return false;
    return (
      selectedTask.status === "pending" || selectedTask.status === "running"
    );
  }, [selectedTask]);

  // Calculate overall run progress from tasks
  const runProgress = useMemo(() => {
    return calculateRunProgress(tasks);
  }, [tasks]);

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

      {/* Run Header with Status Summary */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
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
              {(run.status === "pending" || run.status === "running") && (
                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {MODULE_LABELS[run.module] || run.module} scan on{" "}
              <span className="font-medium">{run.target_value}</span>
            </p>

            {/* Overall Progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Overall Progress
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {runProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    run.status === "completed"
                      ? "bg-green-500"
                      : run.status === "failed"
                      ? "bg-red-500"
                      : run.status === "cancelled"
                      ? "bg-gray-400"
                      : "bg-indigo-600"
                  }`}
                  style={{ width: `${runProgress}%` }}
                />
              </div>
            </div>
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
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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

      {/* Tool Tabs + Viewer Panel */}
      {tasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            No tasks for this run yet.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Tool Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex overflow-x-auto">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setViewerTab("status");
                  }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    selectedTaskId === task.id
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>{TOOL_ICONS[task.tool] || "🔧"}</span>
                  <span>{TOOL_LABELS[task.tool] || task.tool}</span>
                  <StatusIcon status={task.status} />
                  {task.status === "running" && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {task.progress}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Viewer Tabs */}
          {selectedTask && (
            <>
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <button
                  onClick={() => setViewerTab("status")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewerTab === "status"
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-gray-800"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
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
                    Status
                  </span>
                </button>
                <button
                  onClick={() => setViewerTab("report")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewerTab === "report"
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-gray-800"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Report
                    {selectedTask.has_report && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-green-500" />
                    )}
                  </span>
                </button>
                <button
                  onClick={() => setViewerTab("logs")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewerTab === "logs"
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-gray-800"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
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
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Logs
                    {selectedTask.logs_path && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-green-500" />
                    )}
                  </span>
                </button>
              </div>

              {/* Viewer Content */}
              <div className="bg-white dark:bg-gray-800">
                {viewerTab === "status" && (
                  <TaskStatusPanel task={selectedTask} />
                )}
                {viewerTab === "report" && (
                  <ReportViewer
                    projectId={projectId!}
                    runId={runId!}
                    task={selectedTask}
                  />
                )}
                {viewerTab === "logs" && (
                  <LogsViewer
                    projectId={projectId!}
                    runId={runId!}
                    taskId={selectedTask.id}
                    isActive={isTaskActive}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
