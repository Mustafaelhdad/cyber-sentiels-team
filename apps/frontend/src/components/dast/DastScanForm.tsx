import { useState } from "react";
import { useCreateRun } from "@/hooks/useApiQueries";

interface Props {
  projectId: number;
  onScanStarted?: (runId: number) => void;
}

export function DastScanForm({ projectId, onScanStarted }: Props) {
  const [targetUrl, setTargetUrl] = useState("");
  const createRun = useCreateRun(projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = targetUrl.trim();
    if (!url) return;

    createRun.mutate(
      {
        module: "web_security",
        target_type: "url",
        target_value: url,
      },
      {
        onSuccess: (data) => {
          onScanStarted?.(data.run.id);
        },
      }
    );
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label
          htmlFor="dast-target"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Target URL
        </label>
        <input
          id="dast-target"
          name="dast-target"
          type="url"
          placeholder="https://example.com"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          We’ll trigger a web security run with a ZAP DAST task against this
          URL.
        </p>
      </div>

      {createRun.isError && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
          {(createRun.error as Error)?.message || "Failed to start scan"}
        </div>
      )}

      <button
        type="submit"
        disabled={createRun.isPending || !targetUrl.trim()}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {createRun.isPending ? (
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
          "Start DAST Scan"
        )}
      </button>
    </form>
  );
}
