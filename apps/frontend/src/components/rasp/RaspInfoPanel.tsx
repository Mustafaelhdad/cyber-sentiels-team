interface Props {
  projectName: string;
}

export function RaspInfoPanel({ projectName }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Runtime Application Self-Protection (RASP)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Inspect requests inside the app, log incidents, and forward to the RASP API.
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
          Runtime
        </span>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Agent Integration
          </h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
            <li>Install the RASP agent inside your app process.</li>
            <li>Set <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">RASP_API_ENDPOINT</code> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">http://rasp:9000/rasp/notify</code>.</li>
            <li>Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">agent_name</code> to tag incidents (e.g. your service name).</li>
          </ul>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Incident Logs
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            RASP API writes to its SQLite DB and exposes incidents via <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">GET /rasp/incidents</code>.
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
            You can also view the bundled dashboard at <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">http://localhost:9000</code> (when port-mapped).
          </p>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
          How it fits this project
        </h3>
        <p className="text-sm text-indigo-800 dark:text-indigo-200 mt-1">
          Runs created under “Web Security” can include a RASP task to stream incidents for <strong>{projectName}</strong>. Configure the agent in your app and keep the RASP container running.
        </p>
      </div>
    </div>
  );
}
