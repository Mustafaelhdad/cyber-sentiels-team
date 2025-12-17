import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "cyber_sentinels_current_project";
const QUERY_KEY = ["currentProject"] as const;

export interface CurrentProject {
  id: number;
  name: string;
}

/**
 * Load current project from localStorage (runs once on app init).
 */
function loadFromStorage(): CurrentProject | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save current project to localStorage.
 */
function saveToStorage(project: CurrentProject | null): void {
  if (project) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Hook to manage the currently selected project.
 * Uses React Query for cross-component reactivity.
 * Persists selection to localStorage so it survives page refreshes.
 */
export function useCurrentProject() {
  const queryClient = useQueryClient();

  // Use React Query to store the current project - this makes it reactive
  // across all components that use this hook
  const { data: currentProject } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadFromStorage,
    staleTime: Infinity, // Never refetch - we manage this manually
    gcTime: Infinity, // Keep in cache forever
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const setCurrentProject = useCallback(
    (project: CurrentProject | null) => {
      // Update React Query cache (triggers re-render in all consumers)
      queryClient.setQueryData(QUERY_KEY, project);
      // Persist to localStorage
      saveToStorage(project);
    },
    [queryClient]
  );

  const clearCurrentProject = useCallback(() => {
    queryClient.setQueryData(QUERY_KEY, null);
    saveToStorage(null);
  }, [queryClient]);

  return {
    currentProject: currentProject ?? null,
    setCurrentProject,
    clearCurrentProject,
    hasProject: currentProject != null,
  };
}
