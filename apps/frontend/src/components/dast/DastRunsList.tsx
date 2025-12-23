import { Link } from "react-router-dom";
import { type Run } from "@/hooks/useApiQueries";

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

interface Props {
  runs: Run[];
  projectId: number;
  isLoading?: boolean;
}

export function DastRunsList({ runs, projectId, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        No DAST scans yet. Start one above to see it here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const zapTask = run.tasks?.find((t) => t.tool === "zap");
        const status = zapTask?.status || run.status;
        const progress = zapTask?.progress ?? null;

        return (
          <Link
            key={run.id}
            to={`/projects/${projectId}/runs/${run.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {run.target_value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(run.created_at).toLocaleString()}
                {progress !== null && (
                  <span className="ml-2 text-gray-500 dark:text-gray-400">
                    • {progress}%
                  </span>
                )}
              </p>
            </div>
            <span
              className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[status] || STATUS_COLORS.pending
              }`}
            >
              {status}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
