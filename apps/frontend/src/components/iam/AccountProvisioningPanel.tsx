export function AccountProvisioningPanel() {
  return (
    <div className="space-y-6">
      {/* Coming Soon Banner */}
      <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
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
          </div>
          <div>
            <p className="font-medium text-cyan-800 dark:text-cyan-300">
              Account Provisioning Tool
            </p>
            <p className="text-sm text-cyan-600 dark:text-cyan-400">
              Automated User Lifecycle Management
            </p>
          </div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Bulk User Creation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create multiple user accounts at once with CSV import and templates.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Lifecycle Automation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Automate onboarding, role changes, and offboarding workflows.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Directory Sync
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sync users with external directories like LDAP, Active Directory, or
            SCIM.
          </p>
        </div>
      </div>

      {/* Workflow Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Provisioning Workflow Preview
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between opacity-60">
            {[
              { step: 1, label: "Request", icon: "📝" },
              { step: 2, label: "Approval", icon: "✅" },
              { step: 3, label: "Provision", icon: "⚙️" },
              { step: 4, label: "Notify", icon: "📧" },
              { step: 5, label: "Complete", icon: "🎉" },
            ].map((item, i, arr) => (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-xl">
                    {item.icon}
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {item.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-16 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 italic">
            Preview - automated provisioning workflows will be configurable when
            the tool is active
          </p>
        </div>
      </div>

      {/* Stats Preview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Requests", value: "—", color: "yellow" },
          { label: "Provisioned Today", value: "—", color: "green" },
          { label: "Deprovisioned", value: "—", color: "red" },
          { label: "Active Users", value: "—", color: "blue" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center opacity-60"
          >
            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Coming Soon Message */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-cyan-600 dark:text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          The Account Provisioning Tool is currently under development. It will
          provide automated user lifecycle management, bulk operations, and
          directory synchronization.
        </p>
      </div>
    </div>
  );
}
