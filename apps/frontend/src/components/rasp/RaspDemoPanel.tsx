import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  useRaspDemoHealth,
  useRaspTestRuns,
  useRaspTestRunStats,
  useCreateRaspTestRun,
  useDeleteRaspTestRun,
  getRaspTestRunReportUrl,
  type RaspTestRun,
  type RaspTestRunResult,
} from "@/hooks/useApiQueries";

interface Props {
  onTestComplete?: () => void;
}

type AttackType =
  | "xss"
  | "sqli"
  | "path_traversal"
  | "ssrf"
  | "command_injection";

const attackTypeInfo: Record<
  AttackType,
  {
    name: string;
    icon: string;
    color: string;
    description: string;
    severity: string;
  }
> = {
  xss: {
    name: "XSS",
    icon: "🎭",
    color: "bg-orange-500",
    description: "Cross-Site Scripting",
    severity: "high",
  },
  sqli: {
    name: "SQLi",
    icon: "💉",
    color: "bg-red-500",
    description: "SQL Injection",
    severity: "critical",
  },
  path_traversal: {
    name: "Path Traversal",
    icon: "📁",
    color: "bg-yellow-500",
    description: "Directory Traversal",
    severity: "high",
  },
  ssrf: {
    name: "SSRF",
    icon: "🌐",
    color: "bg-purple-500",
    description: "Server-Side Request Forgery",
    severity: "critical",
  },
  command_injection: {
    name: "CMD Injection",
    icon: "⚡",
    color: "bg-pink-500",
    description: "Command Injection",
    severity: "critical",
  },
};

// Mock run type for local demo
interface MockRun {
  id: number;
  name: string;
  status: "completed";
  test_types: string[];
  results: RaspTestRunResult[];
  summary: {
    total_tests: number;
    total_detected: number;
    detection_rate: number;
    rasp_mode: string;
  };
  total_tests: number;
  total_detected: number;
  detection_rate: number;
  created_at: string;
  finished_at: string;
}

export function RaspDemoPanel({ onTestComplete }: Props) {
  const { projectId } = useParams<{ projectId: string }>();
  const numericProjectId = projectId ? parseInt(projectId, 10) : 0;

  const [selectedTests, setSelectedTests] = useState<AttackType[]>([
    "xss",
    "sqli",
    "path_traversal",
    "ssrf",
    "command_injection",
  ]);
  const [runName, setRunName] = useState("");
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

  // Local mock state for when backend is offline
  const [mockRuns, setMockRuns] = useState<MockRun[]>([]);
  const [isRunningMock, setIsRunningMock] = useState(false);

  // Queries
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
  } = useRaspDemoHealth();

  const { data: runsData, refetch: refetchRuns } = useRaspTestRuns(
    numericProjectId,
    1,
    20
  );
  const { data: statsData, refetch: refetchStats } =
    useRaspTestRunStats(numericProjectId);

  // Mutations
  const createRunMutation = useCreateRaspTestRun(numericProjectId);
  const deleteRunMutation = useDeleteRaspTestRun(numericProjectId);

  // Detect if we're in offline mode (backend not available or no real project)
  // When projectId is 0, we're in demo mode without a real project, so use mock data
  const isOfflineMode = useMemo(() => {
    if (numericProjectId === 0) return true; // No real project, use demo mode
    if (healthLoading) return false;
    if (healthError) return true;
    if (!healthData) return true;
    if (healthData.status !== "online") return true;
    return false;
  }, [numericProjectId, healthData, healthLoading, healthError]);

  // Generate mock test results
  const generateMockResults = useCallback(
    (tests: AttackType[]): RaspTestRunResult[] => {
      return tests.map((type) => {
        const info = attackTypeInfo[type];
        const payloads = 4;
        const detected = payloads;
        return {
          test_type: type,
          name: info.name,
          description: info.description,
          severity: info.severity,
          total_payloads: payloads,
          detected,
          detection_rate: 100,
          payloads: Array.from({ length: payloads }, (_, i) => ({
            payload: `Demo payload ${i + 1} for ${type}`,
            detected: true,
            incident_id: Date.now() + i,
            trace_id: `mock-trace-${Date.now()}-${i}`,
            external_reported: false,
          })),
        };
      });
    },
    []
  );

  const runMockTests = useCallback(async () => {
    setIsRunningMock(true);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const results = generateMockResults(selectedTests);
    const totalTests = results.reduce((acc, r) => acc + r.total_payloads, 0);
    const totalDetected = results.reduce((acc, r) => acc + r.detected, 0);

    const mockRun: MockRun = {
      id: Date.now(),
      name: runName || `RASP Test Run ${new Date().toLocaleString()}`,
      status: "completed",
      test_types: selectedTests,
      results,
      summary: {
        total_tests: totalTests,
        total_detected: totalDetected,
        detection_rate: Math.round((totalDetected / totalTests) * 100),
        rasp_mode: "monitor",
      },
      total_tests: totalTests,
      total_detected: totalDetected,
      detection_rate: Math.round((totalDetected / totalTests) * 100),
      created_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    };

    setMockRuns((prev) => [mockRun, ...prev]);
    setIsRunningMock(false);
    setRunName("");
    setActiveTab("history");
    setExpandedRunId(mockRun.id);
    onTestComplete?.();
  }, [selectedTests, runName, generateMockResults, onTestComplete]);

  const handleRunTests = async () => {
    if (isOfflineMode) {
      await runMockTests();
    } else {
      try {
        const result = await createRunMutation.mutateAsync({
          name: runName || undefined,
          test_types: selectedTests,
        });
        setRunName("");
        setActiveTab("history");
        setExpandedRunId(result.run.id);
        refetchRuns();
        refetchStats();
        onTestComplete?.();
      } catch (error) {
        console.error("Failed to run tests, falling back to demo mode:", error);
        await runMockTests();
      }
    }
  };

  const handleDeleteRun = async (runId: number) => {
    if (isOfflineMode) {
      setMockRuns((prev) => prev.filter((r) => r.id !== runId));
    } else {
      try {
        await deleteRunMutation.mutateAsync(runId);
        refetchRuns();
        refetchStats();
      } catch (error) {
        console.error("Failed to delete run:", error);
      }
    }
  };

  const handleDownloadReport = (run: RaspTestRun | MockRun) => {
    if (isOfflineMode || !("report_path" in run)) {
      // Generate and download mock HTML report
      const html = generateMockHtmlReport(run as MockRun);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rasp-report-${run.id}-${
        new Date().toISOString().split("T")[0]
      }.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Download from server
      window.open(getRaspTestRunReportUrl(numericProjectId, run.id), "_blank");
    }
  };

  const generateMockHtmlReport = (run: MockRun): string => {
    const results = run.results || [];
    const summary = run.summary || {
      total_tests: 0,
      total_detected: 0,
      detection_rate: 0,
      rasp_mode: "monitor",
    };

    const resultsHtml = results
      .map((result) => {
        const icon =
          attackTypeInfo[result.test_type as AttackType]?.icon || "🔍";
        const payloadsHtml = result.payloads
          .map(
            (p) => `
          <div class="payload-item ${p.detected ? "detected" : "missed"}">
            <div class="payload-status">${
              p.detected ? "✅ Detected" : "❌ Missed"
            }</div>
            <code class="payload-code">${escapeHtml(p.payload)}</code>
          </div>
        `
          )
          .join("");

        return `
        <div class="test-result">
          <div class="test-header">
            <div class="test-info">
              <span class="test-icon">${icon}</span>
              <div>
                <h3 class="test-name">${escapeHtml(result.name)}</h3>
                <p class="test-description">${escapeHtml(
                  result.description
                )}</p>
              </div>
            </div>
            <div class="test-stats">
              <span class="severity-badge severity-${
                result.severity
              }">${result.severity.toUpperCase()}</span>
              <div class="detection-stat">
                <span class="detection-rate">${result.detection_rate}%</span>
                <span class="detection-count">${result.detected}/${
          result.total_payloads
        } detected</span>
              </div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${
              result.detection_rate
            }%"></div>
          </div>
          <div class="payloads-section">
            <h4>Test Payloads</h4>
            ${payloadsHtml}
          </div>
        </div>
      `;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RASP Security Test Report - ${escapeHtml(run.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    .report-header {
      text-align: center;
      margin-bottom: 40px;
      padding: 40px;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      border-radius: 20px;
      border: 1px solid #475569;
    }
    .report-logo { font-size: 48px; margin-bottom: 16px; }
    .report-title {
      font-size: 32px;
      font-weight: 700;
      background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .report-subtitle { color: #94a3b8; font-size: 16px; }
    .report-meta { display: flex; justify-content: center; gap: 32px; margin-top: 24px; flex-wrap: wrap; }
    .meta-item { display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 14px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: #1e293b;
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #334155;
    }
    .summary-card.highlight {
      background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%);
      border: none;
    }
    .summary-label { font-size: 14px; color: #94a3b8; margin-bottom: 8px; }
    .summary-card.highlight .summary-label { color: #bae6fd; }
    .summary-value { font-size: 36px; font-weight: 700; color: #f1f5f9; }
    .summary-card.highlight .summary-value { color: #ffffff; }
    .test-result {
      background: #1e293b;
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #334155;
      margin-bottom: 20px;
    }
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .test-info { display: flex; align-items: flex-start; gap: 16px; }
    .test-icon { font-size: 32px; }
    .test-name { font-size: 18px; font-weight: 600; color: #f1f5f9; margin-bottom: 4px; }
    .test-description { font-size: 14px; color: #94a3b8; }
    .test-stats { display: flex; align-items: center; gap: 16px; }
    .severity-badge {
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .severity-critical { background: #fee2e2; color: #991b1b; }
    .severity-high { background: #ffedd5; color: #9a3412; }
    .severity-medium { background: #fef3c7; color: #92400e; }
    .detection-stat { text-align: right; }
    .detection-rate { font-size: 24px; font-weight: 700; color: #10b981; display: block; }
    .detection-count { font-size: 12px; color: #94a3b8; }
    .progress-bar {
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%);
      border-radius: 4px;
    }
    .payloads-section { border-top: 1px solid #334155; padding-top: 16px; }
    .payloads-section h4 { font-size: 14px; color: #94a3b8; margin-bottom: 12px; }
    .payload-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #0f172a;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .payload-item.detected { border-left: 3px solid #10b981; }
    .payload-item.missed { border-left: 3px solid #ef4444; }
    .payload-status { font-size: 12px; font-weight: 600; white-space: nowrap; }
    .payload-code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      color: #fbbf24;
      word-break: break-all;
    }
    .report-footer { text-align: center; padding: 40px; color: #64748b; font-size: 14px; }
    @media print {
      body { background: white; color: #1e293b; }
      .report-header, .summary-card, .test-result { background: white; border: 1px solid #e2e8f0; }
      .report-title { -webkit-text-fill-color: #0e7490; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="report-header">
      <div class="report-logo">🛡️</div>
      <h1 class="report-title">RASP Security Test Report</h1>
      <p class="report-subtitle">${escapeHtml(run.name)}</p>
      <div class="report-meta">
        <div class="meta-item">
          <span>📅</span>
          <span>${new Date(run.created_at).toLocaleString()}</span>
        </div>
        <div class="meta-item">
          <span>🔧</span>
          <span>Run ID: #${run.id}</span>
        </div>
      </div>
    </header>

    <div class="summary-grid">
      <div class="summary-card highlight">
        <div class="summary-label">Detection Rate</div>
        <div class="summary-value">${summary.detection_rate}%</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Tests</div>
        <div class="summary-value">${summary.total_tests}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Attacks Detected</div>
        <div class="summary-value">${summary.total_detected}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">RASP Mode</div>
        <div class="summary-value" style="font-size: 24px;">${summary.rasp_mode.toUpperCase()}</div>
      </div>
    </div>

    <section>
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #f1f5f9;">Test Results by Attack Type</h2>
      ${resultsHtml}
    </section>

    <footer class="report-footer">
      <p>Generated by <strong>Cyber Sentinels RASP</strong> on ${new Date().toLocaleString()}</p>
      <p>Runtime Application Self-Protection Security Testing</p>
    </footer>
  </div>
</body>
</html>`;
  };

  const toggleTest = (test: AttackType) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const isRunning = createRunMutation.isPending || isRunningMock;

  // Combine real runs with mock runs for display
  const allRuns: (RaspTestRun | MockRun)[] = isOfflineMode
    ? mockRuns
    : runsData?.data || [];

  const stats = isOfflineMode
    ? {
        total_runs: mockRuns.length,
        completed_runs: mockRuns.length,
        average_detection_rate:
          mockRuns.length > 0
            ? Math.round(
                mockRuns.reduce((acc, r) => acc + r.detection_rate, 0) /
                  mockRuns.length
              )
            : 0,
      }
    : statsData;

  return (
    <div className="space-y-6">
      {/* Service Status Header */}
      <div className="bg-linear-to-r from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                RASP Security Testing
              </h2>
              <p className="text-sm text-slate-400">
                Run tests, view history, and download reports
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {healthLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50">
                <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-xs text-slate-300">Checking...</span>
              </div>
            ) : isOfflineMode ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-400 font-medium">
                  Demo Mode
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">
                  Service Online
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-white">
                {stats.total_runs}
              </div>
              <div className="text-xs text-slate-400">Total Runs</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-emerald-400">
                {stats.completed_runs}
              </div>
              <div className="text-xs text-slate-400">Completed</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-cyan-400">
                {stats.average_detection_rate}%
              </div>
              <div className="text-xs text-slate-400">Avg Detection</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "new"
              ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          New Test Run
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Run History
          {allRuns.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs">
              {allRuns.length}
            </span>
          )}
        </button>
      </div>

      {/* New Test Run Tab */}
      {activeTab === "new" && (
        <div className="space-y-6">
          {/* Demo Mode Notice */}
          {isOfflineMode && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium">
                  Running in Demo Mode - simulated results for demonstration
                </span>
              </div>
            </div>
          )}

          {/* Run Name Input */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Test Run Name (Optional)
            </label>
            <input
              type="text"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder={`RASP Test Run ${new Date().toLocaleDateString()}`}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Attack Type Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Select Attack Types to Test
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(Object.keys(attackTypeInfo) as AttackType[]).map((type) => {
                const info = attackTypeInfo[type];
                const isSelected = selectedTests.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleTest(type)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="text-2xl mb-2">{info.icon}</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {info.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {info.description}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="h-5 w-5 text-cyan-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Run Button */}
            <div className="mt-6">
              <button
                onClick={handleRunTests}
                disabled={isRunning || selectedTests.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Running Tests...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Start Test Run
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {allRuns.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No Test Runs Yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Run your first RASP security test to see results here.
              </p>
              <button
                onClick={() => setActiveTab("new")}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors"
              >
                Create New Test Run
              </button>
            </div>
          ) : (
            allRuns.map((run) => (
              <div
                key={run.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Run Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() =>
                    setExpandedRunId(expandedRunId === run.id ? null : run.id)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          run.status === "completed"
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : run.status === "running"
                            ? "bg-blue-100 dark:bg-blue-900/30"
                            : run.status === "failed"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-slate-100 dark:bg-slate-700"
                        }`}
                      >
                        {run.status === "completed" ? (
                          <svg
                            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
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
                        ) : run.status === "running" ? (
                          <svg
                            className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
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
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {run.name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {new Date(run.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {run.detection_rate}%
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {run.total_detected}/{run.total_tests} detected
                        </div>
                      </div>
                      <svg
                        className={`h-5 w-5 text-slate-400 transition-transform ${
                          expandedRunId === run.id ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedRunId === run.id && (
                  <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50">
                    {/* Action Buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleDownloadReport(run)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white font-medium text-sm hover:bg-cyan-600 transition-colors"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Download HTML Report
                      </button>
                      <button
                        onClick={() => handleDeleteRun(run.id)}
                        disabled={deleteRunMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                    </div>

                    {/* Test Results */}
                    {run.results && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Test Results
                        </h5>
                        {run.results.map((result) => {
                          const info =
                            attackTypeInfo[result.test_type as AttackType];
                          return (
                            <div
                              key={result.test_type}
                              className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">
                                    {info?.icon ?? "🔍"}
                                  </span>
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {result.name}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      result.severity === "critical"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                    }`}
                                  >
                                    {result.severity.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    {result.detection_rate}%
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    ({result.detected}/{result.total_payloads})
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${result.detection_rate}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
