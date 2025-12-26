import { useState } from "react";
import {
  useAuditToolAlerts,
  useAuditToolDemoEvents,
  useAuditToolEvents,
  useAuditToolGenerateReport,
  useAuditToolHealth,
  useAuditToolLogEvent,
  useAuditToolReport,
  useAuditToolStats,
} from "@/hooks/useApiQueries";
import { AuditComplianceStatsCard } from "./AuditComplianceStatsCard";
import { apiFetchBlob } from "@/lib/api";

const PAGE_SIZE = 10;

function formatTimestamp(value?: string | null) {
  if (!value) return "No events yet";
  return value;
}

function getRiskBadge(risk: number) {
  if (risk >= 7) {
    return {
      label: "High",
      className:
        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    };
  }
  if (risk >= 5) {
    return {
      label: "Medium",
      className:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    };
  }
  return {
    label: "Low",
    className:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  };
}

function getComplianceBadge(status?: string) {
  if (!status) {
    return {
      label: "Unknown",
      className:
        "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    };
  }
  if (status.toUpperCase() === "COMPLIANT") {
    return {
      label: "COMPLIANT",
      className:
        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    };
  }
  if (status.toUpperCase() === "NON-COMPLIANT") {
    return {
      label: "NON-COMPLIANT",
      className:
        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    };
  }
  return {
    label: status,
    className:
      "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  };
}

export function AuditCompliancePanel() {
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [minRisk, setMinRisk] = useState("");
  const [page, setPage] = useState(1);

  const { data: healthData, isLoading: healthLoading } =
    useAuditToolHealth();
  const { data: statsData, isLoading: statsLoading } = useAuditToolStats();
  const { data: reportData, isLoading: reportLoading } = useAuditToolReport();

  const parsedMinRisk =
    minRisk.trim() === "" ? undefined : Number(minRisk);
  const minRiskValue = Number.isNaN(parsedMinRisk)
    ? undefined
    : parsedMinRisk;

  const { data: eventsData, isLoading: eventsLoading } = useAuditToolEvents({
    user: filterUser || undefined,
    action: filterAction || undefined,
    min_risk: minRiskValue,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const { data: alertsData, isLoading: alertsLoading } =
    useAuditToolAlerts(20);

  const logMutation = useAuditToolLogEvent();
  const demoMutation = useAuditToolDemoEvents();
  const reportMutation = useAuditToolGenerateReport();

  const isServiceOnline = healthData?.available ?? false;
  const complianceBadge = getComplianceBadge(reportData?.compliance_status);

  const totalEvents = eventsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEvents / PAGE_SIZE));

  const handleLogEvent = async () => {
    setLogMessage(null);
    try {
      const result = await logMutation.mutateAsync({
        user: user.trim(),
        action: action.trim(),
      });
      setLogMessage(
        `Logged event for ${result.event.user} with risk ${result.event.risk}.`
      );
      setUser("");
      setAction("");
    } catch (error: unknown) {
      const err = error as Error;
      setLogMessage(`Error: ${err.message}`);
    }
  };

  const handleDemoEvents = async () => {
    setLogMessage(null);
    try {
      const result = await demoMutation.mutateAsync();
      setLogMessage(`Added ${result.events_logged} demo events.`);
    } catch (error: unknown) {
      const err = error as Error;
      setLogMessage(`Error: ${err.message}`);
    }
  };

  const handleGenerateReport = async () => {
    setReportMessage(null);
    try {
      const result = await reportMutation.mutateAsync();
      setReportMessage(
        `Report generated at ${result.generated_at} with ${result.total_events} events.`
      );
    } catch (error: unknown) {
      const err = error as Error;
      setReportMessage(`Error: ${err.message}`);
    }
  };

  const handleDownloadReport = async () => {
    setReportMessage(null);
    try {
      const blob = await apiFetchBlob("/audit-tool/report/file?refresh=true");
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "compliance_report.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: unknown) {
      const err = error as Error;
      setReportMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Status Banner */}
      <div
        className={`p-4 rounded-xl border ${
          isServiceOnline
            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isServiceOnline ? "bg-amber-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                isServiceOnline
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-red-800 dark:text-red-300"
              }`}
            >
              {healthLoading
                ? "Checking service status..."
                : isServiceOnline
                ? "Audit & Compliance Service Online"
                : "Audit & Compliance Service Offline"}
            </p>
            {healthData?.url && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Connected to: {healthData.url}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AuditComplianceStatsCard
          title="Total Events"
          value={statsData?.total_events ?? 0}
          subtitle="Audit log entries"
          color="amber"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
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
          }
        />

        <AuditComplianceStatsCard
          title="High Risk Events"
          value={statsData?.high_risk_events ?? 0}
          subtitle={`Threshold ${statsData?.high_risk_threshold ?? 7}+`}
          color="red"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86l-7.4 12.84A1 1 0 003.7 18h16.6a1 1 0 00.87-1.5l-7.4-12.84a1 1 0 00-1.74 0z"
              />
            </svg>
          }
        />

        <AuditComplianceStatsCard
          title="Compliance Status"
          value={complianceBadge.label}
          subtitle={`Last check ${reportData?.generated_at ?? "N/A"}`}
          color={
            complianceBadge.label === "COMPLIANT"
              ? "green"
              : complianceBadge.label === "NON-COMPLIANT"
              ? "red"
              : "gray"
          }
          loading={reportLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          }
        />

        <AuditComplianceStatsCard
          title="Latest Event"
          value={formatTimestamp(statsData?.latest_event_time)}
          subtitle={
            statsData?.timestamp
              ? `Updated ${new Date(
                  statsData.timestamp * 1000
                ).toLocaleTimeString()}`
              : undefined
          }
          color="blue"
          loading={statsLoading}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log Event */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Log Audit Event
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Log a user action and automatically calculate risk level.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="e.g. ahmed"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action
              </label>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g. Unauthorized access to system"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={handleLogEvent}
                disabled={
                  logMutation.isPending ||
                  !user.trim() ||
                  !action.trim()
                }
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {logMutation.isPending ? "Logging..." : "Log Event"}
              </button>
              <button
                onClick={handleDemoEvents}
                disabled={demoMutation.isPending}
                className="flex-1 px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-medium rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                {demoMutation.isPending ? "Adding..." : "Add Demo Events"}
              </button>
            </div>
            {logMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  logMessage.startsWith("Error")
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {logMessage}
              </div>
            )}
          </div>
        </div>

        {/* Compliance Report */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Compliance Report
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generate and download compliance summaries.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${complianceBadge.className}`}
            >
              {complianceBadge.label}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Events
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {reportData?.total_events ?? 0}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                High Risk
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {reportData?.high_risk_count ?? 0}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Threshold
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {reportData?.high_risk_threshold ?? statsData?.high_risk_threshold ?? 7}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generated At
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {reportData?.generated_at ?? "Not generated yet"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col md:flex-row gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={reportMutation.isPending}
              className="flex-1 px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {reportMutation.isPending ? "Generating..." : "Generate Report"}
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Download Report
            </button>
          </div>
          {reportMessage && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                reportMessage.startsWith("Error")
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {reportMessage}
            </div>
          )}
        </div>
      </div>

      {/* Audit Events */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Audit Events
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Review user activity with risk classification.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Filter by user"
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Filter by action"
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <input
              type="number"
              min={0}
              max={10}
              placeholder="Min risk"
              value={minRisk}
              onChange={(e) => {
                setMinRisk(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-6">
          {eventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                />
              ))}
            </div>
          ) : eventsData?.events.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 dark:text-gray-400">
                No events found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsData?.events.map((event, index) => {
                    const badge = getRiskBadge(event.risk);
                    return (
                      <tr
                        key={`${event.timestamp}-${event.user}-${index}`}
                        className="border-b border-gray-100 dark:border-gray-700/50"
                      >
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                          {event.timestamp}
                        </td>
                        <td className="py-3 pr-4 text-gray-900 dark:text-white">
                          {event.user}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                          {event.action}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}
                          >
                            {badge.label} ({event.risk})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {eventsData && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages} ({totalEvents} events)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            High Risk Alerts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recent alerts from high risk events.
          </p>
        </div>
        <div className="p-6">
          {alertsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                />
              ))}
            </div>
          ) : alertsData?.alerts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No alerts generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              {alertsData?.alerts.map((alert, index) => (
                <div
                  key={`${alert}-${index}`}
                  className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm font-mono"
                >
                  {alert}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About Audit & Compliance Tool
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              Features
            </h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Automated risk scoring for audit events
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                High risk alerting and audit trail storage
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Compliance reports with status summary
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              API Endpoints
            </h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/audit-tool/stats
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                  POST
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/audit-tool/log
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/audit-tool/events
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  GET
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  /api/audit-tool/report
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
