import { useState } from "react";
import {
  useSoarProcessAlert,
  useSoarBlockIp,
  useSoarCheckThreatIntel,
  useSoarDemo,
} from "@/hooks/useApiQueries";

type TestMode = "manual" | "demo" | "threat-intel" | "block-ip";

export function SoarTestPanel() {
  const [mode, setMode] = useState<TestMode>("demo");
  const [logs, setLogs] = useState<
    Array<{ type: "info" | "success" | "error" | "warning"; message: string }>
  >([]);

  // Manual alert form
  const [alertId, setAlertId] = useState("");
  const [sourceIp, setSourceIp] = useState("");
  const [attackType, setAttackType] = useState("SQL Injection");
  const [severity, setSeverity] = useState("HIGH");

  // Block IP form
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Threat intel form
  const [checkIp, setCheckIp] = useState("");
  const [checkPayload, setCheckPayload] = useState("");

  // Mutations
  const processAlert = useSoarProcessAlert();
  const blockIpMutation = useSoarBlockIp();
  const checkThreatIntel = useSoarCheckThreatIntel();
  const runDemo = useSoarDemo();

  const addLog = (
    type: "info" | "success" | "error" | "warning",
    message: string
  ) => {
    setLogs((prev) => [{ type, message }, ...prev.slice(0, 49)]);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceIp) {
      addLog("error", "Source IP is required");
      return;
    }

    addLog("info", `Processing alert for IP: ${sourceIp}`);

    try {
      const result = await processAlert.mutateAsync({
        alert_id: alertId || `MANUAL-${Date.now()}`,
        source_ip: sourceIp,
        attack_type: attackType,
        severity,
      });

      addLog(
        result.is_malicious ? "warning" : "success",
        `Decision: ${result.decision}`
      );
      result.logs.forEach((log) => addLog("info", log));
      addLog("success", `Incident created: ${result.incident_id}`);
    } catch (error) {
      addLog("error", `Error: ${(error as Error).message}`);
    }
  };

  const handleDemoRun = async (
    type: "sql_injection" | "brute_force" | "xss" | "clean"
  ) => {
    addLog("info", `Running demo: ${type}`);

    try {
      const result = await runDemo.mutateAsync(type);
      addLog(
        result.is_malicious ? "warning" : "success",
        `Decision: ${result.decision}`
      );
      result.logs.forEach((log) => addLog("info", log));
      addLog("success", `Demo completed: ${result.incident_id}`);
    } catch (error) {
      addLog("error", `Error: ${(error as Error).message}`);
    }
  };

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockIp) {
      addLog("error", "IP address is required");
      return;
    }

    addLog("info", `Blocking IP: ${blockIp}`);

    try {
      await blockIpMutation.mutateAsync({
        ip_address: blockIp,
        reason: blockReason || "Manual block",
      });
      addLog("success", `IP ${blockIp} blocked successfully`);
      setBlockIp("");
      setBlockReason("");
    } catch (error) {
      addLog("error", `Error: ${(error as Error).message}`);
    }
  };

  const handleThreatIntelCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIp && !checkPayload) {
      addLog("error", "IP or payload is required");
      return;
    }

    addLog("info", "Checking threat intelligence...");

    try {
      const result = await checkThreatIntel.mutateAsync({
        ip: checkIp || undefined,
        payload: checkPayload || undefined,
      });

      if (result.results.ip) {
        addLog(
          result.results.ip.is_malicious ? "warning" : "success",
          `IP ${result.results.ip.value}: ${result.results.ip.reason}`
        );
      }
      if (result.results.payload) {
        addLog(
          result.results.payload.is_malicious ? "warning" : "success",
          `Payload: ${result.results.payload.reason}`
        );
      }
    } catch (error) {
      addLog("error", `Error: ${(error as Error).message}`);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Test Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          SOAR Test Panel
        </h3>

        {/* Mode Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: "demo", label: "Demo Alerts" },
            { id: "manual", label: "Manual Alert" },
            { id: "block-ip", label: "Block IP" },
            { id: "threat-intel", label: "Threat Intel" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id as TestMode)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                mode === tab.id
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Demo Mode */}
        {mode === "demo" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Run pre-configured demo alerts to test SOAR playbooks and
              automation.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDemoRun("sql_injection")}
                disabled={runDemo.isPending}
                className="p-4 text-left rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="h-5 w-5 text-red-600 dark:text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                  <span className="font-medium text-red-700 dark:text-red-300">
                    SQL Injection
                  </span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Malicious IP + SQL payload
                </p>
              </button>

              <button
                onClick={() => handleDemoRun("brute_force")}
                disabled={runDemo.isPending}
                className="p-4 text-left rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="h-5 w-5 text-orange-600 dark:text-orange-400"
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
                  <span className="font-medium text-orange-700 dark:text-orange-300">
                    Brute Force
                  </span>
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  Multiple failed logins
                </p>
              </button>

              <button
                onClick={() => handleDemoRun("xss")}
                disabled={runDemo.isPending}
                className="p-4 text-left rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="h-5 w-5 text-purple-600 dark:text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    XSS Attack
                  </span>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Script injection attempt
                </p>
              </button>

              <button
                onClick={() => handleDemoRun("clean")}
                disabled={runDemo.isPending}
                className="p-4 text-left rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="h-5 w-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    Clean Traffic
                  </span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Normal, benign request
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Manual Mode */}
        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alert ID (optional)
              </label>
              <input
                type="text"
                value={alertId}
                onChange={(e) => setAlertId(e.target.value)}
                placeholder="SIEM-001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Source IP *
              </label>
              <input
                type="text"
                value={sourceIp}
                onChange={(e) => setSourceIp(e.target.value)}
                placeholder="192.168.1.100"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Attack Type
                </label>
                <select
                  value={attackType}
                  onChange={(e) => setAttackType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option>SQL Injection</option>
                  <option>Brute Force</option>
                  <option>XSS</option>
                  <option>DDoS</option>
                  <option>Malware</option>
                  <option>Phishing</option>
                  <option>Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={processAlert.isPending}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {processAlert.isPending ? "Processing..." : "Process Alert"}
            </button>
          </form>
        )}

        {/* Block IP Mode */}
        {mode === "block-ip" && (
          <form onSubmit={handleBlockIp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                IP Address *
              </label>
              <input
                type="text"
                value={blockIp}
                onChange={(e) => setBlockIp(e.target.value)}
                placeholder="192.168.1.100"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Suspicious activity"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={blockIpMutation.isPending}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {blockIpMutation.isPending ? "Blocking..." : "Block IP"}
            </button>
          </form>
        )}

        {/* Threat Intel Mode */}
        {mode === "threat-intel" && (
          <form onSubmit={handleThreatIntelCheck} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                IP Address
              </label>
              <input
                type="text"
                value={checkIp}
                onChange={(e) => setCheckIp(e.target.value)}
                placeholder="185.220.101.45"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payload
              </label>
              <textarea
                value={checkPayload}
                onChange={(e) => setCheckPayload(e.target.value)}
                placeholder="SELECT * FROM users WHERE id=1 UNION SELECT..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={checkThreatIntel.isPending}
              className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {checkThreatIntel.isPending
                ? "Checking..."
                : "Check Threat Intel"}
            </button>
          </form>
        )}
      </div>

      {/* Logs Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Execution Logs
          </h3>
          <button
            onClick={clearLogs}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Clear
          </button>
        </div>
        <div className="h-80 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500">
              No logs yet. Run a test to see output.
            </p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`py-1 ${
                  log.type === "error"
                    ? "text-red-400"
                    : log.type === "warning"
                    ? "text-yellow-400"
                    : log.type === "success"
                    ? "text-green-400"
                    : "text-gray-300"
                }`}
              >
                <span className="text-gray-500">
                  [{new Date().toLocaleTimeString()}]
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
