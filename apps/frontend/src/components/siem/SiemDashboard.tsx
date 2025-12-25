import { useState } from "react";
import {
  useSiemHealth,
  useSiemStats,
  useSiemRules,
  useSiemLocalAlerts,
  useSiemTimeline,
} from "@/hooks/useApiQueries";
import { SiemStatsCard } from "./SiemStatsCard";
import { SiemAlertsList } from "./SiemAlertsList";
import { SiemLogAnalyzer } from "./SiemLogAnalyzer";
import { SiemRulesList } from "./SiemRulesList";
import { SiemTimeline } from "./SiemTimeline";

type TabType = "overview" | "alerts" | "analyze" | "rules";
type SeverityFilter = "" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function SiemDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("");
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>("");

  // Queries
  const { data: healthData, isLoading: healthLoading } = useSiemHealth();
  const { data: statsData, isLoading: statsLoading } = useSiemStats();
  const { data: rulesData, isLoading: rulesLoading } = useSiemRules();
  const { data: alertsData, isLoading: alertsLoading } = useSiemLocalAlerts({
    severity: severityFilter || undefined,
    acknowledged:
      acknowledgedFilter === ""
        ? undefined
        : acknowledgedFilter === "acknowledged",
    per_page: 50,
  });
  const { data: timelineData, isLoading: timelineLoading } =
    useSiemTimeline("24h");

  const isServiceOnline = healthData?.available ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Security Information & Event Management
              </h2>
              {/* TIP Badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500/10 to-indigo-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <svg
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                TIP Enhanced
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time log analysis, threat detection, and security alerting
              with Threat Intelligence Platform integration
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Service Status */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                healthLoading
                  ? "bg-gray-100 dark:bg-gray-700"
                  : isServiceOnline
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  healthLoading
                    ? "bg-gray-400 animate-pulse"
                    : isServiceOnline
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  healthLoading
                    ? "text-gray-600 dark:text-gray-400"
                    : isServiceOnline
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {healthLoading
                  ? "Checking..."
                  : isServiceOnline
                  ? "Online"
                  : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Offline Warning */}
      {!healthLoading && !isServiceOnline && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                SIEM Service Unavailable
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                The SIEM container is not responding. Some features may be
                limited. You can still view cached alerts and historical data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            {
              id: "overview",
              label: "Overview",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              ),
            },
            {
              id: "alerts",
              label: "Alerts",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              ),
              count: alertsData?.total,
            },
            {
              id: "analyze",
              label: "Analyze Logs",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              ),
            },
            {
              id: "rules",
              label: "Detection Rules",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              ),
              count: rulesData?.total,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {tab.icon}
                </svg>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats */}
          <SiemStatsCard stats={statsData} isLoading={statsLoading} />

          {/* Timeline */}
          <SiemTimeline
            data={timelineData?.data ?? []}
            isLoading={timelineLoading}
          />

          {/* Recent Alerts Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Alerts
              </h3>
              <button
                onClick={() => setActiveTab("alerts")}
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                View all →
              </button>
            </div>
            <SiemAlertsList
              alerts={alertsData?.data?.slice(0, 5) ?? []}
              isLoading={alertsLoading}
            />
          </div>

          {/* TIP Integration Info */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-800/30">
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                  Threat Intelligence Platform Integration
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                  Our SIEM is enhanced with TIP (Threat Intelligence Platform)
                  capabilities, providing advanced threat classification and
                  enrichment for detected security events. Alerts are
                  automatically analyzed against known threat patterns.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <svg
                      className="h-4 w-4 text-purple-600 dark:text-purple-400"
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
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      ML-Powered Classification
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <svg
                      className="h-4 w-4 text-purple-600 dark:text-purple-400"
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
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      Real-time Enrichment
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <svg
                      className="h-4 w-4 text-purple-600 dark:text-purple-400"
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
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      IOC Detection
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Severity
                </label>
                <select
                  value={severityFilter}
                  onChange={(e) =>
                    setSeverityFilter(e.target.value as SeverityFilter)
                  }
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Status
                </label>
                <select
                  value={acknowledgedFilter}
                  onChange={(e) => setAcknowledgedFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Status</option>
                  <option value="unacknowledged">Unacknowledged</option>
                  <option value="acknowledged">Acknowledged</option>
                </select>
              </div>
              <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {alertsData?.total ?? 0} alerts found
              </div>
            </div>
          </div>

          {/* Alerts List */}
          <SiemAlertsList
            alerts={alertsData?.data ?? []}
            isLoading={alertsLoading}
          />
        </div>
      )}

      {activeTab === "analyze" && <SiemLogAnalyzer />}

      {activeTab === "rules" && (
        <SiemRulesList
          rules={rulesData?.rules ?? []}
          isLoading={rulesLoading}
        />
      )}
    </div>
  );
}
