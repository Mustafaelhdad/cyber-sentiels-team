import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError, clearAuthToken, getAuthToken } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

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
 * - Auth errors (401/419) are handled by ProtectedRoute, not global redirect
 */
export function useAuth() {
  const qc = useQueryClient();

  // Check if we have cached data (e.g., just logged in)
  const cachedData = queryClient.getQueryData<AuthResponse>(["auth", "user"]);
  // Check if we have a token stored
  const hasToken = !!getAuthToken();

  const {
    data: userData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: () => apiFetch<AuthResponse>("/auth/user"),
    // Only fetch if we have a token (prevents unnecessary 401 errors)
    enabled: hasToken || !!cachedData,
    retry: (failureCount, err) => {
      // Don't retry auth errors
      if (err instanceof ApiError && err.isAuthError) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    // If we have cached data (from login), don't refetch immediately
    refetchOnMount: cachedData ? false : true,
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      apiFetch("/auth/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      // Clear the auth token
      clearAuthToken();
      // Clear auth cache and all user-related data
      qc.setQueryData(["auth", "user"], null);
      qc.removeQueries({ queryKey: ["auth"] });
      // Clear project/run data as well since user is logged out
      qc.removeQueries({ queryKey: ["projects"] });
      qc.removeQueries({ queryKey: ["project"] });
      qc.removeQueries({ queryKey: ["runs"] });
      qc.removeQueries({ queryKey: ["run"] });
      qc.removeQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      // Even if logout fails, clear local auth state
      clearAuthToken();
      qc.setQueryData(["auth", "user"], null);
      qc.removeQueries({ queryKey: ["auth"] });
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
