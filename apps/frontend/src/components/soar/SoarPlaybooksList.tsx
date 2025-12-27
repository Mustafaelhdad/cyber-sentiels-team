import { useState } from "react";
import {
  type SoarPlaybook,
  useSoarUpdatePlaybook,
  useSoarDeletePlaybook,
} from "@/hooks/useApiQueries";

interface SoarPlaybooksListProps {
  playbooks: SoarPlaybook[];
  isLoading: boolean;
}

export function SoarPlaybooksList({
  playbooks,
  isLoading,
}: SoarPlaybooksListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const updatePlaybook = useSoarUpdatePlaybook();
  const deletePlaybook = useSoarDeletePlaybook();

  const getActionIcon = (action: string) => {
    switch (action) {
      case "block_ip":
        return (
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
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        );
      case "create_ticket":
        return (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        );
      case "notify":
        return (
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
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        );
      case "log_incident":
        return (
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
        );
      case "isolate_host":
        return (
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        );
      default:
        return (
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        );
    }
  };

  const handleToggleEnabled = (playbook: SoarPlaybook) => {
    updatePlaybook.mutate({
      playbookId: playbook.id,
      enabled: !playbook.enabled,
    });
  };

  const handleDelete = (playbookId: number) => {
    if (confirm("Are you sure you want to delete this playbook?")) {
      deletePlaybook.mutate(playbookId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (playbooks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg
          className="h-12 w-12 mx-auto mb-3 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p>No playbooks configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {playbooks.map((playbook) => (
        <div
          key={playbook.id}
          className={`bg-white dark:bg-gray-800 rounded-lg border ${
            playbook.enabled
              ? "border-emerald-200 dark:border-emerald-800/50"
              : "border-gray-200 dark:border-gray-700"
          } overflow-hidden`}
        >
          {/* Header */}
          <div
            className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() =>
              setExpandedId(expandedId === playbook.id ? null : playbook.id)
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    playbook.enabled
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  <svg
                    className={`h-5 w-5 ${
                      playbook.enabled
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-400"
                    }`}
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
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {playbook.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {playbook.actions.length} action
                    {playbook.actions.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEnabled(playbook);
                  }}
                  disabled={updatePlaybook.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    playbook.enabled
                      ? "bg-emerald-500"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      playbook.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${
                    expandedId === playbook.id ? "rotate-180" : ""
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
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedId === playbook.id && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              {playbook.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {playbook.description}
                </p>
              )}

              {/* Trigger Conditions */}
              {Object.keys(playbook.trigger_conditions).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Trigger Conditions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(playbook.trigger_conditions).map(
                      ([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {key}: {value}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {playbook.actions.map((action, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
                    >
                      {getActionIcon(action)}
                      {action.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              {/* Delete Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => handleDelete(playbook.id)}
                  disabled={deletePlaybook.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
                >
                  Delete Playbook
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
