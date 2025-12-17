import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cyber_sentinels_current_project";

export interface CurrentProject {
  id: number;
  name: string;
}

/**
 * Hook to manage the currently selected project.
 * Persists selection to localStorage so it survives page refreshes.
 */
export function useCurrentProject() {
  const [currentProject, setCurrentProjectState] =
    useState<CurrentProject | null>(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    });

  // Keep localStorage in sync
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProject));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentProject]);

  const setCurrentProject = useCallback((project: CurrentProject | null) => {
    setCurrentProjectState(project);
  }, []);

  const clearCurrentProject = useCallback(() => {
    setCurrentProjectState(null);
  }, []);

  return {
    currentProject,
    setCurrentProject,
    clearCurrentProject,
    hasProject: currentProject !== null,
  };
}
