interface Props {
  mode?: "monitor" | "block";
  enabled?: boolean;
}

export function RaspModeIndicator({ mode = "monitor", enabled = true }: Props) {
  if (!enabled) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        <span className="text-sm font-medium">RASP Disabled</span>
      </div>
    );
  }

  const isBlockMode = mode === "block";

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
        isBlockMode
          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full animate-pulse ${
          isBlockMode ? "bg-red-500" : "bg-yellow-500"
        }`}
      />
      <span className="text-sm font-medium">
        {isBlockMode ? "Block Mode" : "Monitor Mode"}
      </span>
    </div>
  );
}
