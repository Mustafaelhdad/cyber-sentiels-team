import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError } from "./api";

/**
 * Handles auth errors (401/419) globally by clearing auth cache and
 * redirecting to login. This ensures any unauthenticated request across
 * the app triggers a consistent logout flow.
 */
function handleAuthError(error: unknown): void {
  if (error instanceof ApiError && error.isAuthError) {
    // Clear auth cache immediately
    queryClient.setQueryData(["auth", "user"], null);
    queryClient.removeQueries({ queryKey: ["auth"] });

    // Redirect to login (use assign to allow back-navigation after re-auth)
    window.location.assign("/login");
  }
}

/**
 * Shared QueryClient instance with minimal global defaults.
 * Per-resource tuning (staleTime, refetchInterval, retry) is applied
 * in individual hooks.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleAuthError(error);
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
