import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError, clearAuthToken } from "./api";

/**
 * Handles auth errors (401/419) globally by clearing auth cache and token.
 * Only redirects for non-auth queries (i.e., when a protected API call fails).
 * The auth query itself is handled by ProtectedRoute which will redirect
 * based on isAuthenticated state.
 */
function handleAuthError(error: unknown, queryKey?: readonly unknown[]): void {
  if (error instanceof ApiError && error.isAuthError) {
    // Clear auth token and cache
    clearAuthToken();
    queryClient.setQueryData(["auth", "user"], null);

    // Only redirect if this is NOT the auth/user query itself
    // The auth query error is handled by ProtectedRoute to avoid race conditions
    const isAuthQuery = queryKey?.[0] === "auth" && queryKey?.[1] === "user";
    if (!isAuthQuery) {
      // Redirect to login for other protected API calls that fail auth
      window.location.assign("/login");
    }
  }
}

/**
 * Shared QueryClient instance with minimal global defaults.
 * Per-resource tuning (staleTime, refetchInterval, retry) is applied
 * in individual hooks.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      handleAuthError(error, query.queryKey);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      handleAuthError(error);
    },
  }),
  defaultOptions: {
    queries: {
      // Minimal defaults – hooks override per resource
      staleTime: 1000 * 30, // 30 seconds
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (error instanceof ApiError && error.isAuthError) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
