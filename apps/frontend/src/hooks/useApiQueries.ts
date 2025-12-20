import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

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
    staleTime: 1000 * 30, // 30 seconds
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
