import { useState, useRef } from "react";
import { useStartSastScan } from "@/hooks/useApiQueries";

interface SastScanFormProps {
  projectId: number;
  onScanStarted?: (runId: number) => void;
}

export function SastScanForm({ projectId, onScanStarted }: SastScanFormProps) {
  const [sourceType, setSourceType] = useState<"zip" | "path">("zip");
  const [sourcePath, setSourcePath] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<"json" | "html">("json");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startScanMutation = useStartSastScan(projectId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sourceType === "zip" && !selectedFile) {
      return;
    }
    if (sourceType === "path" && !sourcePath.trim()) {
      return;
    }

    try {
      const result = await startScanMutation.mutateAsync({
        source_type: sourceType,
        source_file: sourceType === "zip" ? selectedFile! : undefined,
        source_path: sourceType === "path" ? sourcePath : undefined,
        output_format: outputFormat,
      });

      // Reset form
      setSelectedFile(null);
      setSourcePath("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onScanStarted?.(result.run_id);
    } catch (error) {
      console.error("Failed to start SAST scan:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Start SAST Scan
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Analyze source code for security vulnerabilities. Upload a ZIP file or
        specify a path to scan.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source Type Toggle */}
        {/* <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Source Type
          </label>
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 w-fit">
            <button
              type="button"
              onClick={() => setSourceType("zip")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                sourceType === "zip"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              Upload ZIP
            </button>
            <button
              type="button"
              onClick={() => setSourceType("path")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                sourceType === "path"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              Server Path
            </button>
          </div>
        </div> */}

        {/* ZIP File Upload */}
        {sourceType === "zip" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Code (ZIP)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <label className="relative cursor-pointer rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none">
                    <span>Upload a file</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  ZIP files up to 100MB
                </p>
                {selectedFile && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Server Path Input */}
        {sourceType === "path" && (
          <div>
            <label
              htmlFor="source-path"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Source Path
            </label>
            <input
              id="source-path"
              type="text"
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="/app/source or /var/www/html"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Path must be accessible from within the SAST container
            </p>
          </div>
        )}

        {/* Output Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Report Format
          </label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="json"
                checked={outputFormat === "json"}
                onChange={() => setOutputFormat("json")}
                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                JSON
              </span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="html"
                checked={outputFormat === "html"}
                onChange={() => setOutputFormat("html")}
                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                HTML
              </span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {startScanMutation.isError && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
            {startScanMutation.error?.message || "Failed to start scan"}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            startScanMutation.isPending ||
            (sourceType === "zip" && !selectedFile) ||
            (sourceType === "path" && !sourcePath.trim())
          }
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {startScanMutation.isPending ? (
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
            <>
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              Start SAST Scan
            </>
          )}
        </button>
      </form>
    </div>
  );
}
