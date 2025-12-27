import { useState } from "react";
import { SiemDashboard } from "../siem";
import { SoarDashboard } from "../soar";

type TabType = "siem" | "soar";

interface Tab {
  id: TabType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  status: "active" | "coming-soon";
}

const tabs: Tab[] = [
  {
    id: "siem",
    label: "SIEM",
    shortLabel: "SIEM",
    icon: (
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
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    color: "emerald",
    description:
      "Log ingestion, threat detection, and security alerting with TIP integration",
    status: "active",
  },
  {
    id: "soar",
    label: "SOAR",
    shortLabel: "SOAR",
    icon: (
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
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    color: "orange",
    description:
      "Automated incident response, playbooks, and threat intelligence",
    status: "active",
  },
];

const colorClasses: Record<
  string,
  { bg: string; text: string; border: string; active: string }
> = {
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500",
    active: "bg-emerald-500 text-white",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500",
    active: "bg-orange-500 text-white",
  },
};

export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("siem");

  const activeTabData = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Desktop */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => {
            const colors = colorClasses[tab.color];
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-3 p-4 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? `${colors.active} shadow-lg`
                    : `text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white`
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isActive ? "bg-white/20" : colors.bg
                  }`}
                >
                  <span className={isActive ? "text-white" : colors.text}>
                    {tab.icon}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{tab.label}</p>
                  <p
                    className={`text-xs ${
                      isActive
                        ? "text-white/80"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {tab.status === "coming-soon" ? "Coming Soon" : "Active"}
                  </p>
                </div>
                {tab.status === "coming-soon" && !isActive && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Navigation - Mobile */}
      <div className="md:hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
        <div className="grid grid-cols-2 gap-1">
          {tabs.map((tab) => {
            const colors = colorClasses[tab.color];
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${
                  isActive
                    ? `${colors.active}`
                    : `text-gray-500 dark:text-gray-400`
                }`}
              >
                <span className={isActive ? "text-white" : colors.text}>
                  {tab.icon}
                </span>
                <span className="text-[10px] font-medium">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Description */}
      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
        <span
          className={`p-1.5 rounded-lg ${colorClasses[activeTabData.color].bg}`}
        >
          <span className={colorClasses[activeTabData.color].text}>
            {activeTabData.icon}
          </span>
        </span>
        <span>{activeTabData.description}</span>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "siem" && <SiemDashboard />}
        {activeTab === "soar" && <SoarDashboard />}
      </div>
    </div>
  );
}
