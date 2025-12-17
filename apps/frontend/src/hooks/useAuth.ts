import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthResponse {
  user: User;
}

/**
 * Hook for managing authentication state.
 * - Fetches current user from /api/auth/user (Sanctum SPA endpoint)
 * - Provides login/logout mutations
 * - Can be used for route protection
 * - Auth errors (401/419) are handled globally by queryClient
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: userData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: () => apiFetch<AuthResponse>("/auth/user"),
    retry: (failureCount, err) => {
      // Don't retry auth errors
      if (err instanceof ApiError && err.isAuthError) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      apiFetch("/auth/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      // Clear auth cache and all user-related data
      queryClient.setQueryData(["auth", "user"], null);
      queryClient.removeQueries({ queryKey: ["auth"] });
      // Clear project/run data as well since user is logged out
      queryClient.removeQueries({ queryKey: ["projects"] });
      queryClient.removeQueries({ queryKey: ["project"] });
      queryClient.removeQueries({ queryKey: ["runs"] });
      queryClient.removeQueries({ queryKey: ["run"] });
      queryClient.removeQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      // Even if logout fails, clear local auth state
      queryClient.setQueryData(["auth", "user"], null);
      queryClient.removeQueries({ queryKey: ["auth"] });
    },
  });

  // Determine if error is an auth error (user not authenticated)
  const isAuthError = error instanceof ApiError && error.isAuthError;

  return {
    user: userData?.user ?? null,
    isLoading,
    isAuthenticated: !isError && !!userData?.user,
    isAuthError,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
