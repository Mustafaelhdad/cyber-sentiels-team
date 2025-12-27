import { useState } from "react";
import { type SoarBlockedIp, useSoarUnblockIp } from "@/hooks/useApiQueries";

interface SoarBlockedIpsListProps {
  blockedIps: SoarBlockedIp[];
  isLoading: boolean;
}

export function SoarBlockedIpsList({
  blockedIps,
  isLoading,
}: SoarBlockedIpsListProps) {
  const [confirmUnblock, setConfirmUnblock] = useState<string | null>(null);
  const unblockIp = useSoarUnblockIp();

  const handleUnblock = (ip: string) => {
    unblockIp.mutate(ip, {
      onSuccess: () => {
        setConfirmUnblock(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (blockedIps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg
          className="h-12 w-12 mx-auto mb-3 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <p>No blocked IPs</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blockedIps.map((ip) => (
        <div
          key={ip.ip_address}
          className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-medium text-red-700 dark:text-red-400">
                {ip.ip_address}
              </span>
              {ip.incident_id && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({ip.incident_id})
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
              {ip.reason || "Automated block"}
            </p>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Blocked: {new Date(ip.blocked_at).toLocaleDateString()}
              </span>
              {ip.expires_at && (
                <span>
                  Expires: {new Date(ip.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-4">
            {confirmUnblock === ip.ip_address ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUnblock(ip.ip_address)}
                  disabled={unblockIp.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                >
                  {unblockIp.isPending ? "..." : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmUnblock(null)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmUnblock(ip.ip_address)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                Unblock
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
