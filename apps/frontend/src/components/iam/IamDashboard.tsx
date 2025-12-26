import { useState } from "react";
import { AuthToolPanel } from "./AuthToolPanel";
import { AuthorizationPanel } from "./AuthorizationPanel";
import { AuditCompliancePanel } from "./AuditCompliancePanel";
import { AccountProvisioningPanel } from "./AccountProvisioningPanel";

type TabType = "authentication" | "authorization" | "audit" | "provisioning";

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
    id: "authentication",
    label: "Authentication",
    shortLabel: "Auth",
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
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
      </svg>
    ),
    color: "emerald",
    description: "User authentication with 2FA and JWT tokens",
    status: "active",
  },
  {
    id: "authorization",
    label: "Authorization",
    shortLabel: "Authz",
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
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    color: "purple",
    description: "RBAC & ABAC access control and permissions",
    status: "active",
  },
  {
    id: "audit",
    label: "Audit & Compliance",
    shortLabel: "Audit",
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    color: "amber",
    description: "Security audit trails and compliance monitoring",
    status: "coming-soon",
  },
  {
    id: "provisioning",
    label: "Account Provisioning",
    shortLabel: "Provision",
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
          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
        />
      </svg>
    ),
    color: "cyan",
    description: "Automated user lifecycle management",
    status: "coming-soon",
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
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500",
    active: "bg-purple-500 text-white",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500",
    active: "bg-amber-500 text-white",
  },
  cyan: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500",
    active: "bg-cyan-500 text-white",
  },
};

export function IamDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("authentication");

  const activeTabData = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Desktop */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
        <div className="grid grid-cols-4 gap-2">
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
                    : `hover:${colors.bg} text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white`
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
        <div className="grid grid-cols-4 gap-1">
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
        {activeTab === "authentication" && <AuthToolPanel />}
        {activeTab === "authorization" && <AuthorizationPanel />}
        {activeTab === "audit" && <AuditCompliancePanel />}
        {activeTab === "provisioning" && <AccountProvisioningPanel />}
      </div>
    </div>
  );
}
