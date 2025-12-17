import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useCurrentProject } from "@/hooks/useCurrentProject";

interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectsResponse {
  data: Project[];
}

interface CreateProjectPayload {
  name: string;
  description?: string;
}

export default function Projects() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, clearCurrentProject } =
    useCurrentProject();

  // Modal & form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const {
    data: projectsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<ProjectsResponse>("/projects"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      apiFetch<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setName("");
      setDescription("");
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: number) =>
      apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // If the deleted project was the current one, clear it
      if (currentProject?.id === deletedId) {
        clearCurrentProject();
      }
      setDeleteTarget(null);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject({ id: project.id, name: project.name });
    navigate(`/projects/${project.id}`);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const projects = projectsData?.data ?? [];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Projects
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your security projects. Select a project to configure scans
            and view results.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
        >
          <svg
            className="h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Project
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading projects...
          </p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">
            {(error as Error)?.message || "Failed to load projects"}
          </p>
          <button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["projects"] })
            }
            className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && projects.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No projects yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Get started by creating your first project.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
          >
            New Project
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !isError && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const isCurrent = currentProject?.id === project.id;
            return (
              <div
                key={project.id}
                className={`relative p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-shadow hover:shadow-md ${
                  isCurrent
                    ? "border-indigo-500 ring-2 ring-indigo-500/30"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* Current badge */}
                {isCurrent && (
                  <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    Current
                  </span>
                )}

                {/* Icon + date */}
                <div className="flex items-end justify-between">
                  <div className="inline-flex p-3 rounded-lg bg-indigo-500 text-white">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>

                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Name & description */}
                <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleSelectProject(project)}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
                  >
                    Open
                    <svg
                      className="ml-1 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(project)}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors cursor-pointer"
                    aria-label={`Delete ${project.name}`}
                  >
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Create New Project
            </h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="project-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="My Web App"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="project-description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                </label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional description for this project..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {createMutation.error?.message || "Failed to create project"}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="shrink-0 p-2 bg-red-100 dark:bg-red-900 rounded-full">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
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
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Project
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {deleteTarget.name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
            {deleteMutation.isError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {deleteMutation.error?.message || "Failed to delete project"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
