import { useState } from "react";
import { useProvisionToolAudit } from "@/hooks/useApiQueries";

const actionColors: Record<string, { bg: string; text: string; icon: string }> =
  {
    create: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400",
      icon: "M12 4v16m8-8H4",
    },
    modify: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
      icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    },
    disable: {
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400",
      icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    },
    enable: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    delete: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
      icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    },
  };

export function ProvisionAuditLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: auditData, isLoading } = useProvisionToolAudit({
    page,
    per_page: 20,
    action: actionFilter || undefined,
    username: usernameFilter || undefined,
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const parseDetails = (details: string) => {
    if (!details) return {};
    const pairs = details.split(";");
    const result: Record<string, string> = {};
    pairs.forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        result[key] = value;
      }
    });
    return result;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Audit Log
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track all account provisioning activities
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Filter by username..."
              value={usernameFilter}
              onChange={(e) => {
                setUsernameFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="modify">Modify</option>
            <option value="disable">Disable</option>
            <option value="enable">Enable</option>
            <option value="delete">Delete</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : auditData?.logs.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">
              No audit entries found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditData?.logs.map((entry, index) => {
              const actionStyle =
                actionColors[entry.action] || actionColors.modify;
              const details = parseDetails(entry.details);
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`relative ${
                    index < (auditData?.logs.length || 0) - 1
                      ? "pb-4 border-l-2 border-gray-200 dark:border-gray-700 ml-5"
                      : ""
                  }`}
                >
                  <div className="flex gap-4 items-start -ml-5">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${actionStyle.bg}`}
                    >
                      <svg
                        className={`w-5 h-5 ${actionStyle.text}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={actionStyle.icon}
                        />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${actionStyle.bg} ${actionStyle.text}`}
                        >
                          {entry.action.toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {entry.username}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          by {entry.performed_by}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(entry.created_at)}
                      </p>

                      {entry.details && (
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : entry.id)
                          }
                          className="mt-2 text-sm text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? "Hide details" : "Show details"}
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
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
                        </button>
                      )}

                      {isExpanded && entry.details && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(details).map(([key, value]) => (
                              <div key={key}>
                                <dt className="text-gray-500 dark:text-gray-400 capitalize">
                                  {key.replace(/_/g, " ")}
                                </dt>
                                <dd className="font-medium text-gray-900 dark:text-white">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {auditData && auditData.pages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {auditData.pages} ({auditData.total} entries)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= auditData.pages}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
