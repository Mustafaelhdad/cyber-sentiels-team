import type { SiemTimelineDataPoint } from "@/hooks/useApiQueries";

interface Props {
  data: SiemTimelineDataPoint[];
  isLoading: boolean;
}

export function SiemTimeline({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Alert Timeline
        </h3>
        <div className="text-center py-8">
          <svg
            className="h-12 w-12 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            No timeline data available
          </p>
        </div>
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...data.map((d) => d.total), 1);

  // Format time labels
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Alert Timeline
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-gray-600 dark:text-gray-400">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span className="text-gray-600 dark:text-gray-400">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-gray-600 dark:text-gray-400">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">Low</span>
          </div>
        </div>
      </div>

      {/* Simple bar chart */}
      <div className="h-48 flex items-end gap-1">
        {data.map((point, index) => {
          const height = (point.total / maxValue) * 100;
          const criticalHeight = (point.critical / point.total) * height || 0;
          const highHeight = (point.high / point.total) * height || 0;
          const mediumHeight = (point.medium / point.total) * height || 0;
          const lowHeight = (point.low / point.total) * height || 0;

          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center group"
            >
              {/* Tooltip */}
              <div className="hidden group-hover:block absolute -translate-y-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                <div className="font-medium">{formatTime(point.timestamp)}</div>
                <div>Total: {point.total}</div>
                {point.critical > 0 && <div>Critical: {point.critical}</div>}
                {point.high > 0 && <div>High: {point.high}</div>}
                {point.medium > 0 && <div>Medium: {point.medium}</div>}
                {point.low > 0 && <div>Low: {point.low}</div>}
              </div>

              {/* Stacked bar */}
              <div
                className="w-full flex flex-col justify-end rounded-t transition-all hover:opacity-80"
                style={{
                  height: `${height}%`,
                  minHeight: point.total > 0 ? "4px" : "0",
                }}
              >
                {point.critical > 0 && (
                  <div
                    className="w-full bg-red-500 rounded-t-sm"
                    style={{ height: `${criticalHeight}%` }}
                  />
                )}
                {point.high > 0 && (
                  <div
                    className="w-full bg-orange-500"
                    style={{ height: `${highHeight}%` }}
                  />
                )}
                {point.medium > 0 && (
                  <div
                    className="w-full bg-amber-500"
                    style={{ height: `${mediumHeight}%` }}
                  />
                )}
                {point.low > 0 && (
                  <div
                    className="w-full bg-blue-500"
                    style={{ height: `${lowHeight}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        {data.length > 0 && (
          <>
            <span>{formatTime(data[0].timestamp)}</span>
            {data.length > 2 && (
              <span>
                {formatTime(data[Math.floor(data.length / 2)].timestamp)}
              </span>
            )}
            <span>{formatTime(data[data.length - 1].timestamp)}</span>
          </>
        )}
      </div>
    </div>
  );
}
