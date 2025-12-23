export interface DastFinding {
  alert: string;
  risk: string;
  url: string;
  param?: string;
  evidence?: string;
  pluginid?: string;
}

interface Props {
  findings: DastFinding[];
  isLoading?: boolean;
}

const RISK_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  info: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

export function DastFindingsTable({ findings, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
        <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm">
          Loading findings...
        </span>
      </div>
    );
  }

  if (!findings || findings.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No findings available for this scan yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
              Alert
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
              URL
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
              Param
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
              Risk
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
              Evidence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {findings.map((finding, idx) => {
            const riskKey = (finding.risk || "info").toLowerCase();
            return (
              <tr key={`${finding.url}-${idx}`} className="bg-white dark:bg-gray-800">
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                  {finding.alert}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 break-all">
                  {finding.url}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                  {finding.param || "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      RISK_COLORS[riskKey] || RISK_COLORS.info
                    }`}
                  >
                    {finding.risk || "info"}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                  {finding.evidence ? finding.evidence : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
