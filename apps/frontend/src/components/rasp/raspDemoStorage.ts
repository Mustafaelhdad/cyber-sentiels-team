import type {
  RaspIncident,
  RaspStats,
  RaspTestRunResult,
} from "@/hooks/useApiQueries";

export interface RaspDemoRun {
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

const STORAGE_PREFIX = "rasp-demo-runs";

function getStorageKey(projectId?: number): string {
  const suffix = projectId && projectId > 0 ? String(projectId) : "demo";
  return `${STORAGE_PREFIX}:${suffix}`;
}

export function loadRaspDemoRuns(projectId?: number): RaspDemoRun[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RaspDemoRun[]) : [];
  } catch {
    return [];
  }
}

export function saveRaspDemoRuns(
  projectId: number | undefined,
  runs: RaspDemoRun[]
): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(runs));
  } catch {
    // Ignore storage write failures (quota, privacy mode, etc.).
  }
}

function mapSeverity(severity: string): RaspIncident["severity"] {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "warning";
  }
}

export function buildDemoIncidents(runs: RaspDemoRun[]): RaspIncident[] {
  const sortedRuns = [...runs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const incidents: RaspIncident[] = [];

  sortedRuns.forEach((run) => {
    const results = run.results ?? [];
    results.forEach((result) => {
      const severity = mapSeverity(result.severity);
      const action = run.summary?.rasp_mode === "block" ? "block" : "monitor";

      result.payloads.forEach((payload, index) => {
        incidents.push({
          id: payload.incident_id,
          event_id: `demo-${run.id}-${result.test_type}-${index}`,
          trace_id: payload.trace_id,
          sink: "request",
          severity,
          detection_type: result.test_type,
          action,
          message: `${result.name} detected - ${payload.payload}`,
          request_method: "POST",
          request_path: "/rasp/demo/mock",
          request_ip: null,
          user_agent: null,
          session_id: null,
          user_id: null,
          user_email: null,
          request_context: null,
          identity_context: null,
          sink_data: {
            payload: payload.payload,
            test_type: result.test_type,
            run_id: run.id,
          },
          meta: {
            demo_test: true,
            external_reported: payload.external_reported,
          },
          occurred_at: run.created_at,
          created_at: run.created_at,
          updated_at: run.created_at,
        });
      });
    });
  });

  return incidents.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
}

export function buildDemoStats(runs: RaspDemoRun[], hours = 24): RaspStats {
  const incidents = buildDemoIncidents(runs);
  const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  const since = sinceDate.toISOString();

  const filtered = incidents.filter(
    (incident) =>
      new Date(incident.occurred_at).getTime() >= sinceDate.getTime()
  );

  const by_severity: Record<string, number> = {};
  const by_sink: Record<string, number> = {};
  const by_detection: Record<string, number> = {};
  const by_action: Record<string, number> = {};
  const top_ips: Record<string, number> = {};
  const hourly_trend: Record<string, number> = {};

  let blocked = 0;
  let monitored = 0;
  let highSeverity = 0;

  filtered.forEach((incident) => {
    by_severity[incident.severity] =
      (by_severity[incident.severity] ?? 0) + 1;
    by_sink[incident.sink] = (by_sink[incident.sink] ?? 0) + 1;
    if (incident.detection_type) {
      by_detection[incident.detection_type] =
        (by_detection[incident.detection_type] ?? 0) + 1;
    }
    by_action[incident.action] = (by_action[incident.action] ?? 0) + 1;

    if (incident.action === "block") {
      blocked += 1;
    } else if (incident.action === "monitor") {
      monitored += 1;
    }

    if (
      incident.severity === "error" ||
      incident.severity === "critical"
    ) {
      highSeverity += 1;
    }

    if (incident.request_ip) {
      top_ips[incident.request_ip] =
        (top_ips[incident.request_ip] ?? 0) + 1;
    }

    const hourKey =
      new Date(incident.occurred_at).toISOString().slice(0, 13) + ":00";
    hourly_trend[hourKey] = (hourly_trend[hourKey] ?? 0) + 1;
  });

  return {
    period_hours: hours,
    since,
    totals: {
      total: filtered.length,
      blocked,
      monitored,
      high_severity: highSeverity,
    },
    by_severity,
    by_sink,
    by_detection,
    by_action,
    top_ips,
    hourly_trend,
  };
}
