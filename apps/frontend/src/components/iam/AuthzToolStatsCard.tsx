interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "purple" | "red" | "cyan" | "indigo";
  loading?: boolean;
}

const colorClasses = {
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  red: "bg-red-500/10 text-red-500 border-red-500/20",
  cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  indigo: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
};

export function AuthzToolStatsCard({
  title,
  value,
  subtitle,
  icon,
  color,
  loading,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl border ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
