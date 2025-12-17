export default function Monitoring() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Monitoring & IR
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Configure log sources, threat intelligence feeds, and automated
          response workflows.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Coming Soon
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          The Monitoring &amp; Incident Response module is under development.
          This will include:
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center">
            <svg
              className="h-5 w-5 text-amber-500 mr-2"
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
            SIEM integration for log ingestion and analysis
          </li>
          <li className="flex items-center">
            <svg
              className="h-5 w-5 text-amber-500 mr-2"
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
            Threat Intelligence Platform (TIP) for enrichment
          </li>
          <li className="flex items-center">
            <svg
              className="h-5 w-5 text-amber-500 mr-2"
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
            SOAR for automated incident response
          </li>
        </ul>
      </div>
    </div>
  );
}
