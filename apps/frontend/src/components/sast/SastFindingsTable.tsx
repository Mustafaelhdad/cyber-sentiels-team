import { useState } from "react";
import type { SastFinding } from "@/hooks/useApiQueries";

interface SastFindingsTableProps {
  findings: SastFinding[];
  isLoading?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  Medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  Low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  Info: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"];

export function SastFindingsTable({
  findings,
  isLoading,
}: SastFindingsTableProps) {
  const [sortBy, setSortBy] = useState<"severity" | "file" | "line">(
    "severity"
  );
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading findings...
        </span>
      </div>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-green-500"
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
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          No Vulnerabilities Found
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          The scan completed without finding any security issues.
        </p>
      </div>
    );
  }

  // Sort and filter findings
  let displayFindings = [...findings];

  if (filterSeverity) {
    displayFindings = displayFindings.filter(
      (f) => f.severity === filterSeverity
    );
  }

  displayFindings.sort((a, b) => {
    if (sortBy === "severity") {
      return (
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      );
    }
    if (sortBy === "file") {
      return a.file_path.localeCompare(b.file_path);
    }
    if (sortBy === "line") {
      return a.line_number - b.line_number;
    }
    return 0;
  });

  // Calculate severity counts
  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Filters and Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Filter:
          </span>
          <button
            onClick={() => setFilterSeverity(null)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filterSeverity === null
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            All ({findings.length})
          </button>
          {SEVERITY_ORDER.map(
            (sev) =>
              severityCounts[sev] > 0 && (
                <button
                  key={sev}
                  onClick={() =>
                    setFilterSeverity(filterSeverity === sev ? null : sev)
                  }
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    filterSeverity === sev
                      ? "bg-indigo-600 text-white"
                      : SEVERITY_COLORS[sev]
                  }`}
                >
                  {sev} ({severityCounts[sev]})
                </button>
              )
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "severity" | "file" | "line")
            }
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1"
          >
            <option value="severity">Severity</option>
            <option value="file">File Path</option>
            <option value="line">Line Number</option>
          </select>
        </div>
      </div>

      {/* Findings Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rule
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Line
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                CWE
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {displayFindings.map((finding, index) => (
              <>
                <tr
                  key={index}
                  onClick={() =>
                    setExpandedRow(expandedRow === index ? null : index)
                  }
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        SEVERITY_COLORS[finding.severity] ||
                        SEVERITY_COLORS.Info
                      }`}
                    >
                      {finding.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {finding.rule_id}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                      {finding.rule_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 dark:text-white font-mono truncate max-w-md">
                      {finding.file_path}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      {finding.line_number}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {finding.cwe ? (
                      <a
                        href={`https://cwe.mitre.org/data/definitions/${finding.cwe.replace(
                          "CWE-",
                          ""
                        )}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {finding.cwe}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
                {expandedRow === index && (
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {finding.description}
                          </p>
                        </div>
                        {finding.code_snippet && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Code Snippet
                            </h4>
                            <pre className="mt-1 p-3 bg-gray-900 dark:bg-gray-950 rounded-md text-sm text-green-400 font-mono overflow-x-auto">
                              <code>{finding.code_snippet}</code>
                            </pre>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          {finding.language && (
                            <span>Language: {finding.language}</span>
                          )}
                          <span>
                            Location: {finding.file_path}:{finding.line_number}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Showing {displayFindings.length} of {findings.length} findings
      </p>
    </div>
  );
}
