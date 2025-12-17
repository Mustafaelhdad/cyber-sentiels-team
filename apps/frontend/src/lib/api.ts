const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * Ensures the CSRF cookie is set before making state-changing requests.
 */
async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE.replace("/api", "")}/sanctum/csrf-cookie`, {
    credentials: "include",
  });
}

/**
 * Thin wrapper around fetch that:
 * - Prefixes path with API_BASE
 * - Includes credentials (cookies)
 * - Sets JSON content-type for bodies
 * - Fetches CSRF cookie before mutations
 * - Parses JSON responses
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  // For mutations, ensure CSRF cookie is present
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    await ensureCsrf();
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  // If body is present and not FormData, set JSON content type
  if (options.body && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed: ${res.status}`;
    try {
      const json = JSON.parse(text);
      message = json.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
