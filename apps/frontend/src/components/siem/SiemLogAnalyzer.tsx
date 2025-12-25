import { useState, useRef } from "react";
import { useSiemAnalyze, useSiemUpload } from "@/hooks/useApiQueries";

export function SiemLogAnalyzer() {
  const [logText, setLogText] = useState("");
  const [source, setSource] = useState("manual_input");
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = useSiemAnalyze();
  const uploadMutation = useSiemUpload();

  const handleAnalyze = async () => {
    if (!logText.trim()) return;
    await analyzeMutation.mutateAsync({ logs: logText, source });
    setLogText("");
  };

  const handleFileUpload = async (file: File) => {
    await uploadMutation.mutateAsync({ file, source: file.name });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const isLoading = analyzeMutation.isPending || uploadMutation.isPending;
  const lastResult = analyzeMutation.data || uploadMutation.data;
  const error = analyzeMutation.error || uploadMutation.error;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Log Analyzer
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Submit logs for security analysis and threat detection
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              onClick={() => setActiveTab("text")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "text"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Text Input
            </button>
            <button
              onClick={() => setActiveTab("file")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "file"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              File Upload
            </button>
          </div>
        </div>

        {activeTab === "text" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Source Identifier
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g., firewall, web_server, auth_service"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Log Data
              </label>
              <textarea
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-900 text-green-400 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Paste your log entries here...&#10;&#10;Example:&#10;2024-01-15 10:30:45 WARNING: Failed login attempt from 192.168.1.100&#10;2024-01-15 10:30:46 ERROR: SQL injection detected in query parameter"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !logText.trim()}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
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
                  Analyzing...
                </>
              ) : (
                <>
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
                  Analyze Logs
                </>
              )}
            </button>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".log,.txt,.json,.csv"
              className="hidden"
            />
            <svg
              className="h-12 w-12 text-gray-400 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              <span className="font-medium">Drop your log file here</span> or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supports .log, .txt, .json, .csv files up to 10MB
            </p>
            {isLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                <svg
                  className="animate-spin h-5 w-5"
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
                <span className="font-medium">Uploading and analyzing...</span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Analysis Failed
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {lastResult && lastResult.success && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Analysis Complete
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Logs Processed:
                    </span>{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {lastResult.logs_processed}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Alerts Generated:
                    </span>{" "}
                    <span
                      className={`font-medium ${
                        lastResult.alerts_generated > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {lastResult.alerts_generated}
                    </span>
                  </div>
                </div>
                {lastResult.alerts_generated > 0 && (
                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                    Check the Alerts tab to review detected security issues.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
