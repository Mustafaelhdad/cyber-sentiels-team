import { useState } from "react";
import type { WafProxy } from "@/hooks/useApiQueries";
import {
  useDeleteWafProxy,
  useRotateWafProxyToken,
  usePauseWafProxy,
  useActivateWafProxy,
  useResetWafProxyCounters,
} from "@/hooks/useApiQueries";

interface WafProxyCardProps {
  proxy: WafProxy;
  projectId: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  disabled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function WafProxyCard({ proxy, projectId }: WafProxyCardProps) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const deleteMutation = useDeleteWafProxy(projectId);
  const rotateMutation = useRotateWafProxyToken(projectId, proxy.id);
  const pauseMutation = usePauseWafProxy(projectId, proxy.id);
  const activateMutation = useActivateWafProxy(projectId, proxy.id);
  const resetMutation = useResetWafProxyCounters(projectId, proxy.id);

  const copyToClipboard = async (text: string) => {
    try {
      // Try modern clipboard API first (requires HTTPS)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for HTTP: use textarea + execCommand
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Final fallback: prompt user to copy manually
      prompt("Copy this URL:", text);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this WAF proxy?")) {
      deleteMutation.mutate(proxy.id);
    }
  };

  const handleRotateToken = () => {
    if (
      confirm(
        "Are you sure you want to rotate the token? The old WAF URL will stop working."
      )
    ) {
      rotateMutation.mutate();
    }
  };

  const isPending =
    deleteMutation.isPending ||
    rotateMutation.isPending ||
    pauseMutation.isPending ||
    activateMutation.isPending ||
    resetMutation.isPending;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
            {proxy.name || "Unnamed Proxy"}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 break-all line-clamp-2 sm:truncate">
            Origin: {proxy.origin_url}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              STATUS_COLORS[proxy.status] || STATUS_COLORS.active
            }`}
          >
            {proxy.status}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  {proxy.status === "active" ? (
                    <button
                      onClick={() => {
                        pauseMutation.mutate();
                        setShowActions(false);
                      }}
                      disabled={isPending}
                      className="block w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Pause Proxy
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        activateMutation.mutate();
                        setShowActions(false);
                      }}
                      disabled={isPending}
                      className="block w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Activate Proxy
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleRotateToken();
                      setShowActions(false);
                    }}
                    disabled={isPending}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Rotate Token
                  </button>
                  <button
                    onClick={() => {
                      resetMutation.mutate();
                      setShowActions(false);
                    }}
                    disabled={isPending}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Reset Counters
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowActions(false);
                    }}
                    disabled={isPending}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Delete Proxy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WAF URL */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          WAF URL (send traffic here)
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-md text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-mono break-all sm:truncate">
            {proxy.waf_url}
          </code>
          <button
            onClick={() => copyToClipboard(proxy.waf_url)}
            className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
            {proxy.counters.total.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
            {proxy.counters.allowed.toLocaleString()}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">Allowed</p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">
            {proxy.counters.blocked.toLocaleString()}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">Blocked</p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
            {proxy.counters.block_rate}%
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Block Rate</p>
        </div>
      </div>

      {/* Last Activity */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {proxy.last_request_at ? (
          <>Last request: {new Date(proxy.last_request_at).toLocaleString()}</>
        ) : (
          "No requests yet"
        )}
      </div>
    </div>
  );
}
