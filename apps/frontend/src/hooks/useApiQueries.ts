import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch, authToolFetch } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// WAF Proxy types
export interface WafProxyCounters {
  allowed: number;
  blocked: number;
  total: number;
  block_rate: number;
}

export interface WafProxy {
  id: number;
  project_id: number;
  name: string | null;
  origin_url: string;
  token: string;
  waf_url: string;
  status: "active" | "paused" | "disabled";
  counters: WafProxyCounters;
  last_request_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WafLog {
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  size: number;
  response_time: number;
  token: string | null;
  blocked: boolean;
  rule_id?: string;
  rule_msg?: string;
  user_agent?: string;
  referer?: string;
}

export interface WafStats {
  total_proxies: number;
  active_proxies: number;
  total_requests: number;
  total_allowed: number;
  total_blocked: number;
  block_rate: number;
}

export interface WafLogSummary {
  total: number;
  allowed: number;
  blocked: number;
  block_rate: number;
  by_status: Record<string, number>;
  by_method: Record<string, number>;
  top_blocked_paths: Record<string, number>;
  timeline: Record<string, { total: number; blocked: number; allowed: number }>;
}

export interface RunTask {
  id: number;
  run_id: number;
  tool: string;
  status: string;
  progress: number;
  has_report: boolean;
  logs_path: string | null;
  report_path: string | null;
  meta_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: number;
  user_id: number;
  project_id: number;
  module: string;
  target_type: string;
  target_value: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  tasks: RunTask[];
  created_at: string;
  updated_at: string;
}

// API response shapes
interface ProjectsResponse {
  data: Project[];
}

interface ProjectResponse {
  project: Project;
}

interface RunsResponse {
  data: Run[];
}

interface RunResponse {
  run: Run;
}

interface TasksResponse {
  tasks: RunTask[];
}

interface CreateRunPayload {
  module: "web_security" | "monitoring_ir" | "iam";
  target_type: "url" | "repo" | "config";
  target_value: string;
  meta?: Record<string, unknown>;
}

interface CreateRunResponse {
  message: string;
  run: Run;
}

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string | number) => ["project", String(id)] as const,
  runs: (projectId: string | number) => ["runs", String(projectId)] as const,
  run: (projectId: string | number, runId: string | number) =>
    ["run", String(projectId), String(runId)] as const,
  tasks: (projectId: string | number, runId: string | number) =>
    ["tasks", String(projectId), String(runId)] as const,
  // WAF keys
  wafProxies: (projectId: string | number) =>
    ["waf-proxies", String(projectId)] as const,
  wafProxy: (projectId: string | number, proxyId: string | number) =>
    ["waf-proxy", String(projectId), String(proxyId)] as const,
  wafStats: (projectId: string | number) =>
    ["waf-stats", String(projectId)] as const,
  wafLogs: (projectId: string | number, proxyId?: string | number) =>
    ["waf-logs", String(projectId), proxyId ? String(proxyId) : "all"] as const,
  wafLogSummary: (projectId: string | number, proxyId?: string | number) =>
    [
      "waf-log-summary",
      String(projectId),
      proxyId ? String(proxyId) : "all",
    ] as const,
  // SAST keys
  sastHealth: (projectId: string | number) =>
    ["sast-health", String(projectId)] as const,
  sastRules: (projectId: string | number) =>
    ["sast-rules", String(projectId)] as const,
  sastRuns: (projectId: string | number) =>
    ["sast-runs", String(projectId)] as const,
  sastRun: (projectId: string | number, runId: string | number) =>
    ["sast-run", String(projectId), String(runId)] as const,
  sastFindings: (projectId: string | number, runId: string | number) =>
    ["sast-findings", String(projectId), String(runId)] as const,
};

// ============================================================================
// Projects Queries
// ============================================================================

/**
 * Fetch all projects for the current user.
 */
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<ProjectsResponse>("/projects"),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch a single project by ID.
 */
export function useProject(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ""),
    queryFn: () => apiFetch<ProjectResponse>(`/projects/${projectId}`),
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================================================
// Runs Queries
// ============================================================================

/**
 * Fetch all runs for a project with optional polling.
 * Polls every 5s if any run is pending/running.
 */
export function useProjectRuns(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.runs(projectId ?? ""),
    queryFn: () => apiFetch<RunsResponse>(`/projects/${projectId}/runs`),
    enabled: !!projectId,
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: (query) => {
      const runs = query.state.data?.data;
      // Poll if any run is active
      const hasActiveRun = runs?.some(
        (r) => r.status === "pending" || r.status === "running"
      );
      return hasActiveRun ? 5000 : false;
    },
  });
}

/**
 * Fetch a single run by ID with polling while active.
 */
export function useRun(
  projectId: string | number | undefined,
  runId: string | number | undefined
) {
  return useQuery({
    queryKey: queryKeys.run(projectId ?? "", runId ?? ""),
    queryFn: () =>
      apiFetch<RunResponse>(`/projects/${projectId}/runs/${runId}`),
    enabled: !!projectId && !!runId,
    staleTime: 1000 * 5, // 5 seconds
    refetchInterval: (query) => {
      const run = query.state.data?.run;
      // Poll while run is active
      if (run && (run.status === "pending" || run.status === "running")) {
        return 3000;
      }
      return false;
    },
  });
}

// ============================================================================
// Tasks Queries
// ============================================================================

/**
 * Fetch tasks for a run from dedicated endpoint for freshness.
 * Polls every 3s while any task is active.
 */
export function useRunTasks(
  projectId: string | number | undefined,
  runId: string | number | undefined
) {
  return useQuery({
    queryKey: queryKeys.tasks(projectId ?? "", runId ?? ""),
    queryFn: () =>
      apiFetch<TasksResponse>(`/projects/${projectId}/runs/${runId}/tasks`),
    enabled: !!projectId && !!runId,
    staleTime: 1000 * 3, // 3 seconds
    refetchInterval: (query) => {
      const tasks = query.state.data?.tasks;
      // Poll while any task is active
      const hasActiveTask = tasks?.some(
        (t) => t.status === "pending" || t.status === "running"
      );
      return hasActiveTask ? 3000 : false;
    },
  });
}

// ============================================================================
// Mutations
// ============================================================================

interface CreateProjectPayload {
  name: string;
  description?: string;
}

/**
 * Create a new project.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      apiFetch<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/**
 * Delete a project.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: number) =>
      apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/**
 * Create a new run for a project.
 * On success: invalidates runs cache, seeds run detail cache, navigates to run detail.
 */
export function useCreateRun(projectId: string | number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: CreateRunPayload) =>
      apiFetch<CreateRunResponse>(`/projects/${projectId}/runs`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      const newRun = data.run;
      // Invalidate runs list
      queryClient.invalidateQueries({ queryKey: queryKeys.runs(projectId) });
      // Seed the new run into cache for instant detail view
      queryClient.setQueryData(queryKeys.run(projectId, newRun.id), {
        run: newRun,
      });
      // Seed tasks cache
      queryClient.setQueryData(queryKeys.tasks(projectId, newRun.id), {
        tasks: newRun.tasks,
      });
      // Navigate to run detail
      navigate(`/projects/${projectId}/runs/${newRun.id}`);
    },
  });
}

/**
 * Cancel a run.
 */
export function useCancelRun(
  projectId: string | number,
  runId: string | number
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/projects/${projectId}/runs/${runId}/cancel`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.run(projectId, runId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.runs(projectId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(projectId, runId),
      });
    },
  });
}

// ============================================================================
// WAF Proxy Queries
// ============================================================================

interface WafProxiesResponse {
  data: WafProxy[];
}

interface WafProxyResponse {
  proxy: WafProxy;
}

interface WafStatsResponse {
  stats: WafStats;
}

interface WafLogsResponse {
  logs: WafLog[];
  count: number;
}

interface WafLogSummaryResponse {
  summary: WafLogSummary;
}

/**
 * Fetch all WAF proxies for a project.
 */
export function useWafProxies(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.wafProxies(projectId ?? ""),
    queryFn: () =>
      apiFetch<WafProxiesResponse>(`/projects/${projectId}/waf/proxies`),
    enabled: !!projectId,
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s for real-time counter updates
  });
}

/**
 * Fetch a single WAF proxy.
 */
export function useWafProxy(
  projectId: string | number | undefined,
  proxyId: string | number | undefined
) {
  return useQuery({
    queryKey: queryKeys.wafProxy(projectId ?? "", proxyId ?? ""),
    queryFn: () =>
      apiFetch<WafProxyResponse>(
        `/projects/${projectId}/waf/proxies/${proxyId}`
      ),
    enabled: !!projectId && !!proxyId,
    staleTime: 1000 * 10, // 10 seconds
  });
}

/**
 * Fetch WAF stats for a project.
 */
export function useWafStats(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.wafStats(projectId ?? ""),
    queryFn: () =>
      apiFetch<WafStatsResponse>(`/projects/${projectId}/waf/stats`),
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 30000, // Poll every 30s
  });
}

/**
 * Fetch WAF logs for a project (optionally filtered by proxy).
 */
export function useWafLogs(
  projectId: string | number | undefined,
  proxyId?: string | number,
  limit = 100
) {
  return useQuery({
    queryKey: queryKeys.wafLogs(projectId ?? "", proxyId),
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (proxyId) params.append("proxy_id", String(proxyId));
      return apiFetch<WafLogsResponse>(
        `/projects/${projectId}/waf/logs?${params}`
      );
    },
    enabled: !!projectId,
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch WAF log summary for a project.
 */
export function useWafLogSummary(
  projectId: string | number | undefined,
  proxyId?: string | number
) {
  return useQuery({
    queryKey: queryKeys.wafLogSummary(projectId ?? "", proxyId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (proxyId) params.append("proxy_id", String(proxyId));
      const queryString = params.toString();
      return apiFetch<WafLogSummaryResponse>(
        `/projects/${projectId}/waf/logs/summary${
          queryString ? `?${queryString}` : ""
        }`
      );
    },
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 30000, // Poll every 30s
  });
}

// ============================================================================
// WAF Proxy Mutations
// ============================================================================

interface CreateWafProxyPayload {
  name?: string;
  origin_url: string;
}

interface UpdateWafProxyPayload {
  name?: string;
  origin_url?: string;
  status?: "active" | "paused" | "disabled";
}

/**
 * Create a new WAF proxy for a project.
 */
export function useCreateWafProxy(projectId: string | number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWafProxyPayload) =>
      apiFetch<{ message: string; proxy: WafProxy }>(
        `/projects/${projectId}/waf/proxies`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafStats(projectId),
      });
    },
  });
}

/**
 * Update a WAF proxy.
 */
export function useUpdateWafProxy(
  projectId: string | number,
  proxyId: string | number
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWafProxyPayload) =>
      apiFetch<{ message: string; proxy: WafProxy }>(
        `/projects/${projectId}/waf/proxies/${proxyId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxy(projectId, proxyId),
      });
    },
  });
}

/**
 * Delete a WAF proxy.
 */
export function useDeleteWafProxy(projectId: string | number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proxyId: number) =>
      apiFetch<void>(`/projects/${projectId}/waf/proxies/${proxyId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafStats(projectId),
      });
    },
  });
}

/**
 * Rotate a WAF proxy token.
 */
export function useRotateWafProxyToken(
  projectId: string | number,
  proxyId: string | number
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; proxy: WafProxy }>(
        `/projects/${projectId}/waf/proxies/${proxyId}/rotate-token`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxy(projectId, proxyId),
      });
    },
  });
}

/**
 * Pause a WAF proxy.
 */
export function usePauseWafProxy(
  projectId: string | number,
  proxyId: string | number
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; proxy: WafProxy }>(
        `/projects/${projectId}/waf/proxies/${proxyId}/pause`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxy(projectId, proxyId),
      });
    },
  });
}

/**
 * Activate a WAF proxy.
 */
export function useActivateWafProxy(
  projectId: string | number,
  proxyId: string | number
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; proxy: WafProxy }>(
        `/projects/${projectId}/waf/proxies/${proxyId}/activate`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxy(projectId, proxyId),
      });
    },
  });
}

/**
 * Reset counters for a WAF proxy.
 */
export function useResetWafProxyCounters(
  projectId: string | number,
  proxyId: string | number
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; proxy: WafProxy }>(
        `/projects/${projectId}/waf/proxies/${proxyId}/reset-counters`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxies(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wafProxy(projectId, proxyId),
      });
    },
  });
}

// ============================================================================
// SAST Types
// ============================================================================

export interface SastRule {
  id: string;
  name: string;
  severity: string;
  language: string;
  cwe: string;
  description: string;
}

export interface SastFinding {
  rule_id: string;
  rule_name: string;
  description: string;
  file_path: string;
  line_number: number;
  severity: string;
  cwe: string;
  code_snippet: string;
  language?: string;
}

export interface SastScanInfo {
  timestamp: string;
  target_path: string;
  total_findings: number;
  severity_counts: Record<string, number>;
  scan_duration_seconds: number;
}

export interface SastRunTask {
  id: number;
  status: string;
  progress: number;
  total_findings: number;
  severity_counts: Record<string, number>;
  has_report: boolean;
}

export interface SastRun {
  id: number;
  status: string;
  target_value: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  task: SastRunTask | null;
}

// SAST API Responses
interface SastHealthResponse {
  available: boolean;
  service: string;
  url: string;
}

interface SastRulesResponse {
  total: number;
  rules: SastRule[];
}

interface SastRunsResponse {
  runs: SastRun[];
}

interface SastRunStatusResponse {
  run: {
    id: number;
    status: string;
    started_at: string | null;
    finished_at: string | null;
  };
  task: {
    id: number;
    tool: string;
    status: string;
    progress: number;
    meta: {
      sast_scan_id?: string;
      total_findings?: number;
      severity_counts?: Record<string, number>;
    };
    has_report: boolean;
    has_logs: boolean;
  };
}

interface SastFindingsResponse {
  scan_info: SastScanInfo;
  findings: SastFinding[];
  message?: string;
}

interface StartSastScanResponse {
  message: string;
  run_id: number;
  task_id: number;
  sast_scan_id: string;
  status: string;
}

// ============================================================================
// SAST Queries
// ============================================================================

/**
 * Check if SAST service is available.
 */
export function useSastHealth(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.sastHealth(projectId ?? ""),
    queryFn: () =>
      apiFetch<SastHealthResponse>(`/projects/${projectId}/sast/health`),
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
    retry: false,
  });
}

/**
 * Fetch available SAST rules.
 */
export function useSastRules(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.sastRules(projectId ?? ""),
    queryFn: () =>
      apiFetch<SastRulesResponse>(`/projects/${projectId}/sast/rules`),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch all SAST runs for a project.
 */
export function useSastRuns(projectId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.sastRuns(projectId ?? ""),
    queryFn: () =>
      apiFetch<SastRunsResponse>(`/projects/${projectId}/sast/runs`),
    enabled: !!projectId,
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: (query) => {
      const runs = query.state.data?.runs;
      const hasActiveRun = runs?.some(
        (r) => r.status === "pending" || r.status === "running"
      );
      return hasActiveRun ? 3000 : false;
    },
  });
}

/**
 * Fetch a single SAST run status.
 */
export function useSastRunStatus(
  projectId: string | number | undefined,
  runId: string | number | undefined
) {
  return useQuery({
    queryKey: queryKeys.sastRun(projectId ?? "", runId ?? ""),
    queryFn: () =>
      apiFetch<SastRunStatusResponse>(
        `/projects/${projectId}/sast/runs/${runId}`
      ),
    enabled: !!projectId && !!runId,
    staleTime: 1000 * 3, // 3 seconds
    refetchInterval: (query) => {
      const status = query.state.data?.task?.status;
      if (status === "pending" || status === "running") {
        return 2000; // Poll every 2s while running
      }
      return false;
    },
  });
}

/**
 * Fetch SAST findings for a run.
 */
export function useSastFindings(
  projectId: string | number | undefined,
  runId: string | number | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.sastFindings(projectId ?? "", runId ?? ""),
    queryFn: () =>
      apiFetch<SastFindingsResponse>(
        `/projects/${projectId}/sast/runs/${runId}/findings`
      ),
    enabled: !!projectId && !!runId && enabled,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================================================
// SAST Mutations
// ============================================================================

/**
 * Start a new SAST scan.
 */
export function useStartSastScan(projectId: string | number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      source_type: "zip" | "path";
      source_file?: File;
      source_path?: string;
      output_format?: "json" | "html";
    }) => {
      const formData = new FormData();
      formData.append("source_type", payload.source_type);

      if (payload.source_type === "zip" && payload.source_file) {
        formData.append("source_file", payload.source_file);
      } else if (payload.source_type === "path" && payload.source_path) {
        formData.append("source_path", payload.source_path);
      }

      if (payload.output_format) {
        formData.append("output_format", payload.output_format);
      }

      // Use fetch directly for multipart form
      const API_BASE = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("auth_token");

      // Get CSRF cookie first
      await fetch(`${API_BASE.replace("/api", "")}/sanctum/csrf-cookie`, {
        credentials: "include",
      });

      const xsrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
      const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

      const headers: HeadersInit = {
        Accept: "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (xsrfToken) {
        headers["X-XSRF-TOKEN"] = xsrfToken;
      }

      const res = await fetch(`${API_BASE}/projects/${projectId}/sast/runs`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        let message = `Request failed: ${res.status}`;

        // Handle specific HTTP status codes
        if (res.status === 404) {
          message = "Resource not found";
        } else {
          try {
            const json = JSON.parse(text);
            message = json.message || json.error || message;
          } catch {
            // ignore
          }
        }
        throw new Error(message);
      }

      return res.json() as Promise<StartSastScanResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sastRuns(projectId),
      });
    },
  });
}

// ============================================================================
// RASP Types
// ============================================================================

export interface RaspIncident {
  id: number;
  event_id: string;
  trace_id: string;
  sink: "request" | "database" | "http" | "filesystem" | "behavior";
  severity: "debug" | "info" | "warning" | "error" | "critical";
  detection_type: string | null;
  action: "allow" | "monitor" | "block";
  message: string;
  request_method: string | null;
  request_path: string | null;
  request_ip: string | null;
  user_agent: string | null;
  session_id: string | null;
  user_id: number | null;
  user_email: string | null;
  request_context: Record<string, unknown> | null;
  identity_context: Record<string, unknown> | null;
  sink_data: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface RaspStats {
  period_hours: number;
  since: string;
  totals: {
    total: number;
    blocked: number;
    monitored: number;
    high_severity: number;
  };
  by_severity: Record<string, number>;
  by_sink: Record<string, number>;
  by_detection: Record<string, number>;
  by_action: Record<string, number>;
  top_ips: Record<string, number>;
  hourly_trend: Record<string, number>;
}

export interface RaspDetections {
  period_hours: number;
  detections: Record<
    string,
    { total: number; blocked: number; monitored: number }
  >;
}

// RASP API Responses
interface RaspIncidentsResponse {
  data: RaspIncident[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

type RaspStatsResponse = RaspStats;

type RaspDetectionsResponse = RaspDetections;

interface RaspAlertsResponse {
  data: RaspIncident[];
  count: number;
}

interface RaspTraceResponse {
  data: RaspIncident[];
  trace_id: string;
  count: number;
}

// ============================================================================
// RASP Query Keys
// ============================================================================

// Add to queryKeys object - we'll define them here for RASP
export const raspQueryKeys = {
  incidents: (filters?: Record<string, string | number | boolean>) =>
    ["rasp-incidents", filters ?? {}] as const,
  incident: (id: number) => ["rasp-incident", id] as const,
  stats: (hours?: number) => ["rasp-stats", hours ?? 24] as const,
  detections: (hours?: number) => ["rasp-detections", hours ?? 24] as const,
  alerts: (limit?: number) => ["rasp-alerts", limit ?? 20] as const,
  trace: (traceId: string) => ["rasp-trace", traceId] as const,
};

// ============================================================================
// RASP Queries
// ============================================================================

/**
 * Fetch RASP incidents with optional filtering.
 */
export function useRaspIncidents(filters?: {
  severity?: string;
  sink?: string;
  detection_type?: string;
  action?: string;
  ip?: string;
  user_id?: number;
  from?: string;
  to?: string;
  high_severity?: boolean;
  blocked?: boolean;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: raspQueryKeys.incidents(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }
      const queryString = params.toString();
      return apiFetch<RaspIncidentsResponse>(
        `/rasp/incidents${queryString ? `?${queryString}` : ""}`
      );
    },
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 15000, // Poll every 15s
  });
}

/**
 * Fetch a single RASP incident.
 */
export function useRaspIncident(id: number | undefined) {
  return useQuery({
    queryKey: raspQueryKeys.incident(id ?? 0),
    queryFn: () => apiFetch<{ data: RaspIncident }>(`/rasp/incidents/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch RASP statistics.
 */
export function useRaspStats(hours = 24) {
  return useQuery({
    queryKey: raspQueryKeys.stats(hours),
    queryFn: () => apiFetch<RaspStatsResponse>(`/rasp/stats?hours=${hours}`),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 30000, // Poll every 30s
  });
}

/**
 * Fetch RASP detection type breakdown.
 */
export function useRaspDetections(hours = 24) {
  return useQuery({
    queryKey: raspQueryKeys.detections(hours),
    queryFn: () =>
      apiFetch<RaspDetectionsResponse>(`/rasp/detections?hours=${hours}`),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 30000, // Poll every 30s
  });
}

/**
 * Fetch recent high-severity/blocked incidents (alerts).
 */
export function useRaspAlerts(limit = 20) {
  return useQuery({
    queryKey: raspQueryKeys.alerts(limit),
    queryFn: () => apiFetch<RaspAlertsResponse>(`/rasp/alerts?limit=${limit}`),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch all incidents for a specific trace (request).
 */
export function useRaspTrace(traceId: string | undefined) {
  return useQuery({
    queryKey: raspQueryKeys.trace(traceId ?? ""),
    queryFn: () => apiFetch<RaspTraceResponse>(`/rasp/traces/${traceId}`),
    enabled: !!traceId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================================================
// RASP Demo Types
// ============================================================================

export interface RaspDemoHealthResponse {
  status: "online" | "degraded" | "offline";
  service: string;
  details?: Record<string, unknown>;
  error?: string;
  in_app_rasp: {
    enabled: boolean;
    mode: string;
  };
}

export interface RaspDemoTestPayloadResult {
  payload: string;
  detected: boolean;
  incident_id: number;
  trace_id: string;
  external_reported: boolean;
}

export interface RaspDemoTestResult {
  test_type: string;
  name: string;
  description: string;
  severity: string;
  total_payloads: number;
  detected: number;
  detection_rate: number;
  payloads: RaspDemoTestPayloadResult[];
}

export interface RaspDemoRunTestsResponse {
  status: string;
  message: string;
  summary: {
    total_tests: number;
    total_detected: number;
    detection_rate: number;
    rasp_mode: string;
  };
  results: RaspDemoTestResult[];
  timestamp: string;
}

export interface RaspDemoSimulateResponse {
  status: string;
  message: string;
  incident: {
    id: number;
    event_id: string;
    trace_id: string;
    attack_type: string;
    attack_name: string;
    severity: string;
    payload: string;
    action: string;
    occurred_at: string;
  };
  external_service_reported: boolean;
  rasp_mode: string;
}

export interface RaspDemoResultsResponse {
  period_hours: number;
  since: string;
  total_incidents: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  recent_incidents: Array<{
    id: number;
    event_id: string;
    detection_type: string;
    severity: string;
    action: string;
    message: string;
    occurred_at: string;
  }>;
}

// ============================================================================
// RASP Demo Query Keys
// ============================================================================

export const raspDemoQueryKeys = {
  health: ["rasp-demo-health"] as const,
  results: (hours?: number) => ["rasp-demo-results", hours ?? 1] as const,
};

// ============================================================================
// RASP Demo Queries
// ============================================================================

/**
 * Check RASP demo service health.
 */
export function useRaspDemoHealth() {
  return useQuery({
    queryKey: raspDemoQueryKeys.health,
    queryFn: () => apiFetch<RaspDemoHealthResponse>("/rasp/demo/health"),
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });
}

/**
 * Fetch RASP demo test results.
 */
export function useRaspDemoResults(hours = 1) {
  return useQuery({
    queryKey: raspDemoQueryKeys.results(hours),
    queryFn: () =>
      apiFetch<RaspDemoResultsResponse>(`/rasp/demo/results?hours=${hours}`),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

// ============================================================================
// RASP Demo Mutations
// ============================================================================

/**
 * Run RASP demo tests.
 */
export function useRaspDemoRunTests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tests?: string[]) =>
      apiFetch<RaspDemoRunTestsResponse>("/rasp/demo/run-tests", {
        method: "POST",
        body: JSON.stringify({ tests }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: raspDemoQueryKeys.results() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.incidents() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.alerts() });
    },
  });
}

/**
 * Simulate a single attack.
 */
export function useRaspDemoSimulate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { attack_type: string; payload?: string }) =>
      apiFetch<RaspDemoSimulateResponse>("/rasp/demo/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: raspDemoQueryKeys.results() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.incidents() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.alerts() });
    },
  });
}

/**
 * Clear RASP demo data.
 */
export function useRaspDemoClear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; message: string; deleted_count: number }>(
        "/rasp/demo/clear",
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: raspDemoQueryKeys.results() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.incidents() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.alerts() });
    },
  });
}

// ============================================================================
// RASP Test Run Types (Project-scoped with history and reports)
// ============================================================================

export interface RaspTestRunPayload {
  payload: string;
  detected: boolean;
  incident_id: number;
  trace_id: string;
  external_reported: boolean;
}

export interface RaspTestRunResult {
  test_type: string;
  name: string;
  description: string;
  severity: string;
  total_payloads: number;
  detected: number;
  detection_rate: number;
  payloads: RaspTestRunPayload[];
}

export interface RaspTestRunSummary {
  total_tests: number;
  total_detected: number;
  detection_rate: number;
  by_severity: Record<string, number>;
  by_type: Record<string, { detected: number; total: number; rate: number }>;
  rasp_mode: string;
}

export interface RaspTestRun {
  id: number;
  user_id: number;
  project_id: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  test_types: string[];
  results: RaspTestRunResult[] | null;
  summary: RaspTestRunSummary | null;
  total_tests: number;
  total_detected: number;
  detection_rate: number;
  report_path: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RaspTestRunsResponse {
  data: RaspTestRun[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface RaspTestRunStatsResponse {
  total_runs: number;
  completed_runs: number;
  average_detection_rate: number;
  recent_runs: Array<{
    id: number;
    name: string;
    status: string;
    detection_rate: number;
    created_at: string;
  }>;
}

// ============================================================================
// RASP Test Run Query Keys
// ============================================================================

export const raspTestRunQueryKeys = {
  all: (projectId: number) => ["rasp-test-runs", projectId] as const,
  list: (projectId: number, page?: number) =>
    ["rasp-test-runs", projectId, "list", page ?? 1] as const,
  detail: (projectId: number, runId: number) =>
    ["rasp-test-runs", projectId, "detail", runId] as const,
  stats: (projectId: number) => ["rasp-test-runs", projectId, "stats"] as const,
};

// ============================================================================
// RASP Test Run Queries
// ============================================================================

/**
 * Fetch list of RASP test runs for a project.
 */
export function useRaspTestRuns(projectId: number, page = 1, perPage = 20) {
  return useQuery({
    queryKey: raspTestRunQueryKeys.list(projectId, page),
    queryFn: () =>
      apiFetch<RaspTestRunsResponse>(
        `/projects/${projectId}/rasp/runs?page=${page}&per_page=${perPage}`
      ),
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Fetch a single RASP test run.
 */
export function useRaspTestRun(projectId: number, runId: number) {
  return useQuery({
    queryKey: raspTestRunQueryKeys.detail(projectId, runId),
    queryFn: () =>
      apiFetch<{
        run: RaspTestRun;
        has_report: boolean;
        duration: string | null;
      }>(`/projects/${projectId}/rasp/runs/${runId}`),
    enabled: !!projectId && !!runId,
    staleTime: 1000 * 30,
  });
}

/**
 * Fetch RASP test run statistics for a project.
 */
export function useRaspTestRunStats(projectId: number) {
  return useQuery({
    queryKey: raspTestRunQueryKeys.stats(projectId),
    queryFn: () =>
      apiFetch<RaspTestRunStatsResponse>(
        `/projects/${projectId}/rasp/runs/stats`
      ),
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================================================
// RASP Test Run Mutations
// ============================================================================

/**
 * Create and execute a new RASP test run.
 */
export function useCreateRaspTestRun(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name?: string; test_types?: string[] }) =>
      apiFetch<{ message: string; run: RaspTestRun }>(
        `/projects/${projectId}/rasp/runs`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: raspTestRunQueryKeys.all(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: raspTestRunQueryKeys.stats(projectId),
      });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.incidents() });
      queryClient.invalidateQueries({ queryKey: raspQueryKeys.stats() });
    },
  });
}

/**
 * Delete a RASP test run.
 */
export function useDeleteRaspTestRun(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: number) =>
      apiFetch<{ message: string }>(
        `/projects/${projectId}/rasp/runs/${runId}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: raspTestRunQueryKeys.all(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: raspTestRunQueryKeys.stats(projectId),
      });
    },
  });
}

/**
 * Get report download URL for a RASP test run.
 */
export function getRaspTestRunReportUrl(
  projectId: number,
  runId: number
): string {
  return `/api/projects/${projectId}/rasp/runs/${runId}/report`;
}

/**
 * Get report view URL for a RASP test run.
 */
export function getRaspTestRunReportViewUrl(
  projectId: number,
  runId: number
): string {
  return `/api/projects/${projectId}/rasp/runs/${runId}/report/view`;
}

// ============================================================================
// SIEM Types
// ============================================================================

export interface SiemAlert {
  id: number;
  siem_alert_id: string | null;
  rule_id: string | null;
  rule_name: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string | null;
  log_entry: string;
  source: string;
  tip_label: string | null;
  tip_confidence: number | null;
  tip_is_malicious: boolean | null;
  acknowledged: boolean;
  alert_timestamp: string | null;
  created_at: string;
  updated_at: string;
  severity_label: { label: string; color: string };
  truncated_log: string;
  has_tip_analysis: boolean;
}

export interface SiemStats {
  total_logs_processed: number;
  total_alerts: number;
  high_severity_alerts: number;
  critical_alerts: number;
  system_status: string;
  local?: {
    local_alerts_total: number;
    local_alerts_unacknowledged: number;
    local_alerts_critical: number;
    local_alerts_high: number;
    local_alerts_medium: number;
    local_alerts_low: number;
    alerts_last_24h: number;
    alerts_last_7d: number;
  };
}

export interface SiemRule {
  id: string;
  name: string;
  pattern: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  threshold?: number;
  time_window?: number;
}

export interface SiemAlertDistribution {
  by_severity: Record<string, number>;
  by_source: Record<string, number>;
  top_rules: Record<string, number>;
}

export interface SiemTimelineDataPoint {
  timestamp: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SiemTimeline {
  period: string;
  interval: string;
  data: SiemTimelineDataPoint[];
}

// SIEM API Responses
interface SiemHealthResponse {
  available: boolean;
  service: string;
  url: string;
  stats: SiemStats | null;
}

interface SiemStatsResponse extends SiemStats {}

interface SiemRulesResponse {
  total: number;
  rules: SiemRule[];
}

interface SiemAlertsResponse {
  total: number;
  alerts: SiemAlert[];
}

interface SiemLocalAlertsResponse {
  data: SiemAlert[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface SiemLogsResponse {
  total: number;
  logs: string[];
}

interface SiemAnalyzeResponse {
  success: boolean;
  message: string;
  logs_processed: number;
  alerts_generated: number;
  alerts: SiemAlert[];
  report_url: string | null;
  stats: SiemStats | null;
}

interface SiemIngestResponse {
  success: boolean;
  alerts: SiemAlert[];
  processed: boolean;
}

interface SiemDistributionResponse extends SiemAlertDistribution {}

interface SiemTimelineResponse extends SiemTimeline {}

// ============================================================================
// SIEM Query Keys
// ============================================================================

export const siemQueryKeys = {
  health: ["siem-health"] as const,
  stats: ["siem-stats"] as const,
  rules: ["siem-rules"] as const,
  alerts: (filters?: Record<string, string | number | boolean>) =>
    ["siem-alerts", filters ?? {}] as const,
  localAlerts: (filters?: Record<string, string | number | boolean>) =>
    ["siem-local-alerts", filters ?? {}] as const,
  alert: (id: number) => ["siem-alert", id] as const,
  logs: (limit?: number) => ["siem-logs", limit ?? 100] as const,
  distribution: ["siem-distribution"] as const,
  timeline: (period?: string) => ["siem-timeline", period ?? "24h"] as const,
};

// ============================================================================
// SIEM Queries
// ============================================================================

/**
 * Check SIEM service health.
 */
export function useSiemHealth() {
  return useQuery({
    queryKey: siemQueryKeys.health,
    queryFn: () => apiFetch<SiemHealthResponse>("/siem/health"),
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });
}

/**
 * Fetch SIEM statistics.
 */
export function useSiemStats() {
  return useQuery({
    queryKey: siemQueryKeys.stats,
    queryFn: () => apiFetch<SiemStatsResponse>("/siem/stats"),
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 15000, // Poll every 15s
  });
}

/**
 * Fetch SIEM detection rules.
 */
export function useSiemRules() {
  return useQuery({
    queryKey: siemQueryKeys.rules,
    queryFn: () => apiFetch<SiemRulesResponse>("/siem/rules"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch alerts from SIEM container.
 */
export function useSiemAlerts(limit = 100) {
  return useQuery({
    queryKey: siemQueryKeys.alerts({ limit }),
    queryFn: () => apiFetch<SiemAlertsResponse>(`/siem/alerts?limit=${limit}`),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch local alerts with filtering and pagination.
 */
export function useSiemLocalAlerts(filters?: {
  severity?: string;
  acknowledged?: boolean;
  source?: string;
  rule_id?: string;
  from?: string;
  to?: string;
  search?: string;
  order_by?: string;
  order_dir?: "asc" | "desc";
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: siemQueryKeys.localAlerts(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }
      const queryString = params.toString();
      return apiFetch<SiemLocalAlertsResponse>(
        `/siem/alerts/local${queryString ? `?${queryString}` : ""}`
      );
    },
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 15000, // Poll every 15s
  });
}

/**
 * Fetch a single SIEM alert.
 */
export function useSiemAlert(id: number | undefined) {
  return useQuery({
    queryKey: siemQueryKeys.alert(id ?? 0),
    queryFn: () => apiFetch<SiemAlert>(`/siem/alerts/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch recent logs from SIEM.
 */
export function useSiemLogs(limit = 100) {
  return useQuery({
    queryKey: siemQueryKeys.logs(limit),
    queryFn: () => apiFetch<SiemLogsResponse>(`/siem/logs?limit=${limit}`),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch alert distribution.
 */
export function useSiemDistribution() {
  return useQuery({
    queryKey: siemQueryKeys.distribution,
    queryFn: () =>
      apiFetch<SiemDistributionResponse>("/siem/alerts/distribution"),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 30000, // Poll every 30s
  });
}

/**
 * Fetch alert timeline.
 */
export function useSiemTimeline(period = "24h") {
  return useQuery({
    queryKey: siemQueryKeys.timeline(period),
    queryFn: () =>
      apiFetch<SiemTimelineResponse>(`/siem/alerts/timeline?period=${period}`),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 30000, // Poll every 30s
  });
}

// ============================================================================
// SIEM Mutations
// ============================================================================

/**
 * Analyze log text.
 */
export function useSiemAnalyze() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { logs: string; source?: string }) =>
      apiFetch<SiemAnalyzeResponse>("/siem/analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.alerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.distribution });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.timeline() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.logs() });
    },
  });
}

/**
 * Ingest a single log entry.
 */
export function useSiemIngest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      log: string;
      source?: string;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<SiemIngestResponse>("/siem/ingest", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.alerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.logs() });
    },
  });
}

/**
 * Ingest multiple log entries.
 */
export function useSiemIngestBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      logs: (string | { log: string; source?: string })[];
      default_source?: string;
    }) =>
      apiFetch<{
        success: boolean;
        logs_processed: number;
        alerts_generated: number;
        alerts: SiemAlert[];
      }>("/siem/ingest/batch", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.alerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.logs() });
    },
  });
}

/**
 * Acknowledge a SIEM alert.
 */
export function useSiemAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: number) =>
      apiFetch<{ message: string; alert: SiemAlert }>(
        `/siem/alerts/${alertId}/acknowledge`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
    },
  });
}

/**
 * Bulk acknowledge SIEM alerts.
 */
export function useSiemAcknowledgeBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertIds: number[]) =>
      apiFetch<{ message: string; count: number }>(
        "/siem/alerts/acknowledge-bulk",
        {
          method: "POST",
          body: JSON.stringify({ alert_ids: alertIds }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
    },
  });
}

/**
 * Delete a SIEM alert.
 */
export function useSiemDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: number) =>
      apiFetch<{ success: boolean; message: string }>(
        `/siem/alerts/${alertId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.distribution });
    },
  });
}

/**
 * Bulk delete SIEM alerts.
 */
export function useSiemDeleteBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertIds: number[]) =>
      apiFetch<{ success: boolean; message: string; count: number }>(
        "/siem/alerts/bulk",
        {
          method: "DELETE",
          body: JSON.stringify({ alert_ids: alertIds }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.distribution });
    },
  });
}

/**
 * Upload and analyze a log file.
 */
export function useSiemUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { file: File; source?: string }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      if (payload.source) {
        formData.append("source", payload.source);
      }

      const API_BASE = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("auth_token");

      // Get CSRF cookie first
      await fetch(`${API_BASE.replace("/api", "")}/sanctum/csrf-cookie`, {
        credentials: "include",
      });

      const xsrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
      const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : null;

      const headers: HeadersInit = {
        Accept: "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (xsrfToken) {
        headers["X-XSRF-TOKEN"] = xsrfToken;
      }

      const res = await fetch(`${API_BASE}/siem/upload`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        let message = `Request failed: ${res.status}`;
        try {
          const json = JSON.parse(text);
          message = json.message || json.error || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      return res.json() as Promise<SiemAnalyzeResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.alerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.localAlerts() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.distribution });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.timeline() });
      queryClient.invalidateQueries({ queryKey: siemQueryKeys.logs() });
    },
  });
}

// ============================================================================
// Auth Tool Types
// ============================================================================

/** Auth Tool health response */
export interface AuthToolHealthResponse {
  available: boolean;
  service: string;
  url: string;
  health: {
    service: string;
    status: string;
    timestamp: number;
  } | null;
}

export interface AuthToolStatsResponse {
  service: string;
  status: string;
  users_registered: number;
  pending_sessions: number;
  jwt_ttl_seconds: number;
  timestamp: number;
}

export interface AuthToolSignupResponse {
  success: boolean;
  message: string;
}

export interface AuthToolSigninResponse {
  success: boolean;
  message: string;
  session_id: string;
  requires_otp: boolean;
}

export interface AuthToolVerifyOtpResponse {
  success: boolean;
  message: string;
  token: string;
  user: string;
  expires_in: number;
}

export interface AuthToolVerifyTokenResponse {
  valid: boolean;
  user?: string;
  expires_at?: number;
  issued_at?: number;
  error?: string;
}

export interface AuthToolUser {
  username: string;
}

export interface AuthToolUsersResponse {
  users: AuthToolUser[];
  total: number;
}

export interface AuthToolTestFlowResult {
  signup: { success: boolean; data?: unknown; error?: string } | null;
  signin: { success: boolean; data?: unknown; error?: string } | null;
  verify_otp: { success: boolean; data?: unknown; error?: string } | null;
  verify_token: { success: boolean; data?: unknown } | null;
  get_user: unknown | null;
  overall_success: boolean;
  token?: string;
}

export interface AuthToolTestFlowResponse {
  test_results: AuthToolTestFlowResult;
  overall_success: boolean;
}

// ============================================================================
// Auth Tool Query Keys
// ============================================================================

export const authToolQueryKeys = {
  all: ["auth-tool"] as const,
  health: ["auth-tool", "health"] as const,
  stats: ["auth-tool", "stats"] as const,
  users: ["auth-tool", "users"] as const,
};

// ============================================================================
// Auth Tool Queries
// ============================================================================

/**
 * Check Auth Tool service health.
 */
export function useAuthToolHealth() {
  return useQuery({
    queryKey: authToolQueryKeys.health,
    queryFn: () => apiFetch<AuthToolHealthResponse>("/auth-tool/health"),
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });
}

/**
 * Fetch Auth Tool statistics.
 */
export function useAuthToolStats() {
  return useQuery({
    queryKey: authToolQueryKeys.stats,
    queryFn: () => apiFetch<AuthToolStatsResponse>("/auth-tool/stats"),
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 15000, // Poll every 15s
  });
}

/**
 * Fetch Auth Tool users list.
 */
export function useAuthToolUsers(token?: string) {
  return useQuery({
    queryKey: authToolQueryKeys.users,
    queryFn: () =>
      apiFetch<AuthToolUsersResponse>("/auth-tool/users", {
        headers: token ? { "X-Auth-Token": token } : undefined,
      }),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!token,
  });
}

// ============================================================================
// Auth Tool Mutations
// ============================================================================

/**
 * Sign up a new user in Auth Tool.
 * Uses isolated fetch to prevent auth errors from affecting main website session.
 */
export function useAuthToolSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const result = await authToolFetch<AuthToolSignupResponse>(
        "/auth-tool/signup",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: authToolQueryKeys.users });
    },
  });
}

/**
 * Sign in to Auth Tool (Step 1: credential verification).
 * Uses isolated fetch to prevent auth errors from affecting main website session.
 */
export function useAuthToolSignin() {
  return useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const result = await authToolFetch<AuthToolSigninResponse>(
        "/auth-tool/signin",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Verify OTP in Auth Tool (Step 2: complete authentication).
 * Uses isolated fetch to prevent auth errors from affecting main website session.
 */
export function useAuthToolVerifyOtp() {
  return useMutation({
    mutationFn: async (payload: { session_id: string; otp: string }) => {
      const result = await authToolFetch<AuthToolVerifyOtpResponse>(
        "/auth-tool/verify-otp",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Verify a JWT token.
 * Uses isolated fetch to prevent auth errors from affecting main website session.
 */
export function useAuthToolVerifyToken() {
  return useMutation({
    mutationFn: async (payload: { token: string }) => {
      const result = await authToolFetch<AuthToolVerifyTokenResponse>(
        "/auth-tool/verify-token",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Test the complete authentication flow.
 * Uses isolated fetch to prevent auth errors from affecting main website session.
 */
export function useAuthToolTestFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      username: string;
      password: string;
      otp?: string;
    }) => {
      const result = await authToolFetch<AuthToolTestFlowResponse>(
        "/auth-tool/test-flow",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: authToolQueryKeys.users });
    },
  });
}

// ============================================================================
// Authorization Tool Types
// ============================================================================

export interface AuthzToolHealthResponse {
  available: boolean;
  service: string;
  url: string;
  health: {
    status: string;
    service: string;
    timestamp: number;
  } | null;
}

export interface AuthzToolStatsResponse {
  service: string;
  status: string;
  total_users: number;
  users_by_role: Record<string, number>;
  users_by_group: Record<string, number>;
  available_roles: string[];
  available_policies: string[];
  timestamp: number;
}

export interface AuthzToolUser {
  email: string;
  role: string;
  group: string;
}

export interface AuthzToolUsersResponse {
  users: AuthzToolUser[];
  total: number;
}

export interface AuthzToolRole {
  role: string;
  privileges: string[];
}

export interface AuthzToolRolesResponse {
  roles: AuthzToolRole[];
  policies: string[];
}

export interface AuthzToolResource {
  resource: string;
  permissions: Record<string, string[]>;
}

export interface AuthzToolResourcesResponse {
  resources: AuthzToolResource[];
}

export interface AuthzToolAuthorizeResponse {
  authorized: boolean;
  email: string;
  role: string;
  group: string;
  action: string;
  resource: string;
  policy: string;
  privileges: string[];
  decision: string;
}

export interface AuthzToolPrivilegesResponse {
  email: string;
  role: string;
  group: string;
  policy: string;
  privileges: string[];
}

export interface AuthzToolLogEntry {
  timestamp: string;
  email: string;
  action: string;
  resource: string;
  decision: string;
  policy: string;
}

export interface AuthzToolLogsResponse {
  logs: AuthzToolLogEntry[];
  total: number;
}

export interface AuthzToolPasswordStrengthResponse {
  strength: "weak" | "medium" | "strong";
  score: number;
  issues: string[];
}

export interface AuthzToolCreateUserResponse {
  success: boolean;
  message: string;
  email: string;
  role: string;
  group: string;
}

export interface AuthzToolVerifyResponse {
  valid: boolean;
  email: string;
  role: string;
  group: string;
}

export interface AuthzToolTestFlowResult {
  create_user: { success: boolean; data?: unknown; error?: string } | null;
  verify_credentials: {
    success: boolean;
    data?: unknown;
    error?: string;
  } | null;
  get_privileges_rbac: { success: boolean; data?: unknown } | null;
  get_privileges_abac: { success: boolean; data?: unknown } | null;
  authorize_read: { success: boolean; data?: unknown } | null;
  authorize_write: { success: boolean; data?: unknown } | null;
  authorize_delete: { success: boolean; data?: unknown } | null;
  overall_success: boolean;
}

export interface AuthzToolTestFlowResponse {
  test_results: AuthzToolTestFlowResult;
  overall_success: boolean;
}

// ============================================================================
// Authorization Tool Query Keys
// ============================================================================

export const authzToolQueryKeys = {
  all: ["authz-tool"] as const,
  health: ["authz-tool", "health"] as const,
  stats: ["authz-tool", "stats"] as const,
  users: ["authz-tool", "users"] as const,
  roles: ["authz-tool", "roles"] as const,
  resources: ["authz-tool", "resources"] as const,
  logs: ["authz-tool", "logs"] as const,
};

// ============================================================================
// Authorization Tool Queries
// ============================================================================

/**
 * Check Authorization Tool service health.
 */
export function useAuthzToolHealth() {
  return useQuery({
    queryKey: authzToolQueryKeys.health,
    queryFn: () => apiFetch<AuthzToolHealthResponse>("/authz-tool/health"),
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });
}

/**
 * Fetch Authorization Tool statistics.
 */
export function useAuthzToolStats() {
  return useQuery({
    queryKey: authzToolQueryKeys.stats,
    queryFn: () => apiFetch<AuthzToolStatsResponse>("/authz-tool/stats"),
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 15000, // Poll every 15s
  });
}

/**
 * Fetch Authorization Tool users list.
 */
export function useAuthzToolUsers() {
  return useQuery({
    queryKey: authzToolQueryKeys.users,
    queryFn: () => apiFetch<AuthzToolUsersResponse>("/authz-tool/users"),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch Authorization Tool roles.
 */
export function useAuthzToolRoles() {
  return useQuery({
    queryKey: authzToolQueryKeys.roles,
    queryFn: () => apiFetch<AuthzToolRolesResponse>("/authz-tool/roles"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch Authorization Tool resources.
 */
export function useAuthzToolResources() {
  return useQuery({
    queryKey: authzToolQueryKeys.resources,
    queryFn: () =>
      apiFetch<AuthzToolResourcesResponse>("/authz-tool/resources"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch Authorization Tool logs.
 */
export function useAuthzToolLogs(limit: number = 100) {
  return useQuery({
    queryKey: [...authzToolQueryKeys.logs, limit],
    queryFn: () =>
      apiFetch<AuthzToolLogsResponse>(`/authz-tool/logs?limit=${limit}`),
    staleTime: 1000 * 30, // 30 seconds
  });
}

// ============================================================================
// Authorization Tool Mutations
// ============================================================================

/**
 * Authorize an action for a user.
 */
export function useAuthzToolAuthorize() {
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      action?: string;
      resource?: string;
      policy?: string;
      context?: Record<string, unknown>;
    }) => {
      const result = await authToolFetch<AuthzToolAuthorizeResponse>(
        "/authz-tool/authorize",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Get privileges for a user.
 */
export function useAuthzToolPrivileges() {
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      policy?: string;
      context?: Record<string, unknown>;
    }) => {
      const result = await authToolFetch<AuthzToolPrivilegesResponse>(
        "/authz-tool/privileges",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Create a new user in Authorization Tool.
 */
export function useAuthzToolCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      role?: string;
      group?: string;
    }) => {
      const result = await authToolFetch<AuthzToolCreateUserResponse>(
        "/authz-tool/users",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.users });
    },
  });
}

/**
 * Update a user in Authorization Tool.
 */
export function useAuthzToolUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      email: string;
      role?: string;
      group?: string;
      password?: string;
    }) => {
      const { email, ...data } = payload;
      const result = await authToolFetch<{ success: boolean; message: string }>(
        `/authz-tool/users/${encodeURIComponent(email)}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.users });
    },
  });
}

/**
 * Delete a user from Authorization Tool.
 */
export function useAuthzToolDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const result = await authToolFetch<{ success: boolean; message: string }>(
        `/authz-tool/users/${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.users });
    },
  });
}

/**
 * Verify user credentials.
 */
export function useAuthzToolVerify() {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const result = await authToolFetch<AuthzToolVerifyResponse>(
        "/authz-tool/verify",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Check password strength.
 */
export function useAuthzToolPasswordStrength() {
  return useMutation({
    mutationFn: async (password: string) => {
      const result = await authToolFetch<AuthzToolPasswordStrengthResponse>(
        "/authz-tool/password-strength",
        {
          method: "POST",
          body: JSON.stringify({ password }),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Test the complete authorization flow.
 */
export function useAuthzToolTestFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      role?: string;
      group?: string;
    }) => {
      const result = await authToolFetch<AuthzToolTestFlowResponse>(
        "/authz-tool/test-flow",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: authzToolQueryKeys.users });
    },
  });
}

// ============================================================================
// Account Provisioning Tool Types
// ============================================================================

export interface ProvisionUser {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProvisionUsersResponse {
  users: ProvisionUser[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ProvisionAuditEntry {
  id: number;
  action: string;
  username: string;
  details: string;
  performed_by: string;
  created_at: string;
}

export interface ProvisionAuditResponse {
  logs: ProvisionAuditEntry[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ProvisionStatsResponse {
  service: string;
  status: string;
  total_users: number;
  users_by_status: Record<string, number>;
  users_by_role: Record<string, number>;
  audit_actions: Record<string, number>;
  recent_activity_24h: number;
  available_roles: string[];
  available_statuses: string[];
  timestamp: number;
}

export interface ProvisionReportResponse {
  title: string;
  generated_at: string;
  summary: {
    total_users: number;
    active_users: number;
    disabled_users: number;
  };
  activities: {
    accounts_created: number;
    accounts_modified: number;
    accounts_disabled: number;
    accounts_enabled: number;
    accounts_deleted: number;
  };
}

export interface ProvisionHealthResponse {
  available: boolean;
  service: string;
  url: string;
  health: {
    status: string;
    service: string;
    timestamp: number;
  } | null;
}

export interface ProvisionCreateUserResponse {
  success: boolean;
  message: string;
  user: ProvisionUser;
}

export interface ProvisionUpdateUserResponse {
  success: boolean;
  message: string;
  user: ProvisionUser;
}

export interface ProvisionDeleteUserResponse {
  success: boolean;
  message: string;
}

export interface ProvisionBulkResponse {
  success: boolean;
  message: string;
  created: number;
  failed: number;
  results: {
    success: Array<{
      id: number;
      username: string;
      email: string;
      role: string;
      status: string;
    }>;
    failed: Array<{
      username: string;
      error: string;
    }>;
  };
}

export interface ProvisionRolesResponse {
  roles: string[];
}

export interface ProvisionStatusesResponse {
  statuses: string[];
}

// ============================================================================
// Account Provisioning Tool Query Keys
// ============================================================================

export const provisionToolQueryKeys = {
  all: ["provision-tool"] as const,
  health: ["provision-tool", "health"] as const,
  stats: ["provision-tool", "stats"] as const,
  report: ["provision-tool", "report"] as const,
  users: (filters?: Record<string, string | number>) =>
    ["provision-tool", "users", filters ?? {}] as const,
  user: (id: number) => ["provision-tool", "user", id] as const,
  audit: (filters?: Record<string, string | number>) =>
    ["provision-tool", "audit", filters ?? {}] as const,
  roles: ["provision-tool", "roles"] as const,
  statuses: ["provision-tool", "statuses"] as const,
};

// ============================================================================
// Account Provisioning Tool Queries
// ============================================================================

/**
 * Check Account Provisioning Tool service health.
 */
export function useProvisionToolHealth() {
  return useQuery({
    queryKey: provisionToolQueryKeys.health,
    queryFn: () => apiFetch<ProvisionHealthResponse>("/provision-tool/health"),
    staleTime: 1000 * 30, // 30 seconds
    retry: false,
  });
}

/**
 * Fetch Account Provisioning Tool statistics.
 */
export function useProvisionToolStats() {
  return useQuery({
    queryKey: provisionToolQueryKeys.stats,
    queryFn: () => apiFetch<ProvisionStatsResponse>("/provision-tool/stats"),
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 15000, // Poll every 15s
  });
}

/**
 * Fetch Account Provisioning Tool report.
 */
export function useProvisionToolReport() {
  return useQuery({
    queryKey: provisionToolQueryKeys.report,
    queryFn: () => apiFetch<ProvisionReportResponse>("/provision-tool/report"),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Fetch Account Provisioning Tool users list.
 */
export function useProvisionToolUsers(filters?: {
  status?: string;
  role?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) {
  return useQuery({
    queryKey: provisionToolQueryKeys.users(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }
      const queryString = params.toString();
      return apiFetch<ProvisionUsersResponse>(
        `/provision-tool/users${queryString ? `?${queryString}` : ""}`
      );
    },
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch a single user by ID.
 */
export function useProvisionToolUser(userId: number | undefined) {
  return useQuery({
    queryKey: provisionToolQueryKeys.user(userId ?? 0),
    queryFn: () => apiFetch<ProvisionUser>(`/provision-tool/users/${userId}`),
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch Account Provisioning Tool audit log.
 */
export function useProvisionToolAudit(filters?: {
  action?: string;
  username?: string;
  page?: number;
  per_page?: number;
}) {
  return useQuery({
    queryKey: provisionToolQueryKeys.audit(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }
      const queryString = params.toString();
      return apiFetch<ProvisionAuditResponse>(
        `/provision-tool/audit${queryString ? `?${queryString}` : ""}`
      );
    },
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch available roles.
 */
export function useProvisionToolRoles() {
  return useQuery({
    queryKey: provisionToolQueryKeys.roles,
    queryFn: () => apiFetch<ProvisionRolesResponse>("/provision-tool/roles"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch available statuses.
 */
export function useProvisionToolStatuses() {
  return useQuery({
    queryKey: provisionToolQueryKeys.statuses,
    queryFn: () =>
      apiFetch<ProvisionStatusesResponse>("/provision-tool/statuses"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// Account Provisioning Tool Mutations
// ============================================================================

/**
 * Create a new user in Account Provisioning Tool.
 */
export function useProvisionToolCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      username: string;
      email: string;
      role?: string;
      status?: string;
      performed_by?: string;
    }) => {
      const result = await authToolFetch<ProvisionCreateUserResponse>(
        "/provision-tool/users",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.audit() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.report });
    },
  });
}

/**
 * Update an existing user.
 */
export function useProvisionToolUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: number;
      username?: string;
      email?: string;
      role?: string;
      status?: string;
      performed_by?: string;
    }) => {
      const { id, ...data } = payload;
      const result = await authToolFetch<ProvisionUpdateUserResponse>(
        `/provision-tool/users/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.audit() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.report });
    },
  });
}

/**
 * Delete a user.
 */
export function useProvisionToolDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const result = await authToolFetch<ProvisionDeleteUserResponse>(
        `/provision-tool/users/${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.audit() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.report });
    },
  });
}

/**
 * Disable a user.
 */
export function useProvisionToolDisableUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { userId: number; performed_by?: string }) => {
      const result = await authToolFetch<{ success: boolean; message: string }>(
        `/provision-tool/users/${payload.userId}/disable`,
        {
          method: "POST",
          body: JSON.stringify({ performed_by: payload.performed_by }),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.audit() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.report });
    },
  });
}

/**
 * Enable a user.
 */
export function useProvisionToolEnableUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { userId: number; performed_by?: string }) => {
      const result = await authToolFetch<{ success: boolean; message: string }>(
        `/provision-tool/users/${payload.userId}/enable`,
        {
          method: "POST",
          body: JSON.stringify({ performed_by: payload.performed_by }),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.audit() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.report });
    },
  });
}

/**
 * Bulk provision multiple users.
 */
export function useProvisionToolBulkCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      users: Array<{
        username: string;
        email: string;
        role?: string;
        status?: string;
      }>;
      performed_by?: string;
    }) => {
      const result = await authToolFetch<ProvisionBulkResponse>(
        "/provision-tool/users/bulk",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.stats });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.audit() });
      queryClient.invalidateQueries({ queryKey: provisionToolQueryKeys.report });
    },
  });
}