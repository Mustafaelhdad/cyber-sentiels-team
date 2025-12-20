import { Link } from "react-router-dom";
import type { SastRun } from "@/hooks/useApiQueries";
import { apiFetchText, apiFetchBlob } from "@/lib/api";

interface SastRunsListProps {
  runs: SastRun[];
  projectId: number;
  isLoading?: boolean;
  onViewFindings?: (runId: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

// Helper function to download a file with authentication
async function downloadFile(
  projectId: number,
  runId: number,
  format: "json" | "html"
) {
  const htmlEndpoint = `/projects/${projectId}/sast/runs/${runId}/download-html`;
  const jsonEndpoint = `/projects/${projectId}/sast/runs/${runId}/download`;

  try {
    let blob: Blob;
    let ext: "html" | "json" | "pdf" = "json";

    if (format === "html") {
      try {
        blob = await apiFetchBlob(htmlEndpoint);
      } catch {
        // fallback to generic download (JSON) if HTML not available
        const content = await apiFetchText(jsonEndpoint);
        blob = new Blob([content], { type: "application/json" });
      }
    } else {
      blob = await apiFetchBlob(jsonEndpoint);
    }

    const type = blob.type || "";
    if (type.includes("html")) ext = "html";
    else if (type.includes("pdf")) ext = "pdf";
    else if (format === "html") ext = "html";

    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `sast-report-${runId}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error(`Failed to download ${format} report:`, error);
    alert(
      `Failed to download ${format.toUpperCase()} report. Please try again.`
    );
  }
}

export function SastRunsList({
  runs,
  projectId,
  isLoading,
  onViewFindings,
}: SastRunsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          Loading scans...
        </span>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          No SAST Scans Yet
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Start a new scan above to analyze your source code for
          vulnerabilities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Link
          key={run.id}
          to={`/projects/${projectId}/runs/${run.id}`}
          className="block"
        >
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_COLORS[run.status] || STATUS_COLORS.pending
                  }`}
                >
                  {run.status === "running" && (
                    <svg
                      className="animate-spin -ml-0.5 mr-1.5 h-3 w-3"
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
                  )}
                  {run.status}
                </span>

                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {run.target_value}
                </p>
              </div>

              <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{new Date(run.created_at).toLocaleString()}</span>

                {run.task && run.task.total_findings > 0 && (
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5 text-orange-500"
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
                    {run.task.total_findings} findings
                  </span>
                )}

                {run.task?.severity_counts &&
                  Object.keys(run.task.severity_counts).length > 0 && (
                    <span className="flex items-center gap-1">
                      {run.task.severity_counts["Critical"] > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {run.task.severity_counts["Critical"]}C
                        </span>
                      )}
                      {run.task.severity_counts["High"] > 0 && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {run.task.severity_counts["High"]}H
                        </span>
                      )}
                      {run.task.severity_counts["Medium"] > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {run.task.severity_counts["Medium"]}M
                        </span>
                      )}
                    </span>
                  )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {run.status === "completed" && run.task?.has_report && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewFindings?.(run.id);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                  >
                    <svg
                      className="h-3.5 w-3.5 mr-1"
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
                    View
                  </button>

                  {/* Download buttons with format selection */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        downloadFile(projectId, run.id, "json");
                      }}
                      className="inline-flex items-center px-2 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      title="Download JSON Report"
                    >
                      <svg
                        className="h-3.5 w-3.5 mr-1"
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
                      JSON
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        downloadFile(projectId, run.id, "html");
                      }}
                      className="inline-flex items-center px-2 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      title="Download HTML Report"
                    >
                      <svg
                        className="h-3.5 w-3.5 mr-1"
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
                  </div>
                </>
              )}

              <span className="text-gray-400">
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
