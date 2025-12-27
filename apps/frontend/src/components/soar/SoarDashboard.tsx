import { useState } from "react";
import {
  useSoarHealth,
  useSoarStats,
  useSoarIncidents,
  useSoarBlockedIps,
  useSoarPlaybooks,
} from "@/hooks/useApiQueries";
import { SoarStatsCard } from "./SoarStatsCard";
import { SoarIncidentsList } from "./SoarIncidentsList";
import { SoarBlockedIpsList } from "./SoarBlockedIpsList";
import { SoarPlaybooksList } from "./SoarPlaybooksList";
import { SoarTestPanel } from "./SoarTestPanel";

type TabType = "overview" | "incidents" | "playbooks" | "test";

export function SoarDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Queries
  const { data: healthData, isLoading: healthLoading } = useSoarHealth();
  const { data: statsData, isLoading: statsLoading } = useSoarStats();
  const { data: incidentsData, isLoading: incidentsLoading } =
    useSoarIncidents(50);
  const { data: blockedIpsData, isLoading: blockedIpsLoading } =
    useSoarBlockedIps();
  const { data: playbooksData, isLoading: playbooksLoading } =
    useSoarPlaybooks();

  const isServiceOnline = healthData?.available ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Security Orchestration, Automation & Response
              </h2>
              {/* SIEM Integration Badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                <svg
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
                SIEM Integrated
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Automated incident response, playbook execution, and threat
              intelligence integration
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
                SOAR Service Unavailable
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                The SOAR container is not responding. Automated response
                capabilities are temporarily unavailable.
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
              id: "incidents",
              label: "Incidents",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              ),
              count: incidentsData?.total,
            },
            {
              id: "playbooks",
              label: "Playbooks",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              ),
              count: playbooksData?.total,
            },
            {
              id: "test",
              label: "Test Panel",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              ),
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
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
          <SoarStatsCard stats={statsData} isLoading={statsLoading} />

          {/* Recent Incidents & Blocked IPs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Incidents */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Incidents
                </h3>
                <button
                  onClick={() => setActiveTab("incidents")}
                  className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
                >
                  View all →
                </button>
              </div>
              <SoarIncidentsList
                incidents={incidentsData?.incidents ?? []}
                isLoading={incidentsLoading}
                compact
              />
            </div>

            {/* Blocked IPs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Blocked IPs
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {blockedIpsData?.total ?? 0} active
                </span>
              </div>
              <SoarBlockedIpsList
                blockedIps={blockedIpsData?.blocked_ips ?? []}
                isLoading={blockedIpsLoading}
              />
            </div>
          </div>

          {/* SIEM Integration Info */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-800/30">
                <svg
                  className="h-6 w-6 text-orange-600 dark:text-orange-400"
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
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                  Automated Incident Response
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  SOAR automatically processes alerts from SIEM, executes
                  playbooks based on threat intelligence, and takes automated
                  response actions like IP blocking and ticket creation.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <svg
                      className="h-4 w-4 text-orange-600 dark:text-orange-400"
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
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Threat Intelligence
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <svg
                      className="h-4 w-4 text-orange-600 dark:text-orange-400"
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
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Playbook Automation
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <svg
                      className="h-4 w-4 text-orange-600 dark:text-orange-400"
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
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Auto IP Blocking
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Incidents
          </h3>
          <SoarIncidentsList
            incidents={incidentsData?.incidents ?? []}
            isLoading={incidentsLoading}
          />
        </div>
      )}

      {activeTab === "playbooks" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Response Playbooks
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automated response workflows for different threat types
            </p>
          </div>
          <SoarPlaybooksList
            playbooks={playbooksData?.playbooks ?? []}
            isLoading={playbooksLoading}
          />
        </div>
      )}

      {activeTab === "test" && <SoarTestPanel />}
    </div>
  );
}
