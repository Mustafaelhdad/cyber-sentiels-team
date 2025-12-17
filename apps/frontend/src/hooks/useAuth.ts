import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

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
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: userData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: () => apiFetch<AuthResponse>("/auth/user"),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      apiFetch("/auth/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "user"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  return {
    user: userData?.user ?? null,
    isLoading,
    isAuthenticated: !isError && !!userData?.user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
