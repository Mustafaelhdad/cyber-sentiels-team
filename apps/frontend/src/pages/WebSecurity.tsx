export default function WebSecurity() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Web Security
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Configure and run DAST scans with OWASP ZAP against your web
          applications.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Start a New Scan
        </h2>

        <form className="space-y-4">
          <div>
            <label
              htmlFor="target-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Target URL
            </label>
            <input
              id="target-url"
              name="target-url"
              type="url"
              placeholder="https://example.com"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter the URL of the web application you want to scan.
            </p>
          </div>

          <div>
            <label
              htmlFor="scan-type"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Scan Type
            </label>
            <select
              id="scan-type"
              name="scan-type"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="baseline">Baseline Scan (Quick)</option>
              <option value="full">Full Scan (Comprehensive)</option>
              <option value="api">API Scan</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Apply &amp; Start Scan
          </button>
        </form>
      </div>

      {/* Placeholder for scan history/results */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Recent Scans
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No scans have been run yet. Start a new scan above.
        </p>
      </div>
    </div>
  );
}
