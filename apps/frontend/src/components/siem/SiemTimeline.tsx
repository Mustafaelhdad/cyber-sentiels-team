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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Alert Timeline
      </h3>
      <div className="space-y-2">
        {data.slice(-10).map((point, index) => {
          const barWidth = (point.total / maxValue) * 100;
          return (
            <div key={index} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">
                {formatTime(point.timestamp)}
              </span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
                {point.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
