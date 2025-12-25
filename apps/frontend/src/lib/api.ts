const API_BASE = import.meta.env.VITE_API_URL || "/api";
const AUTH_TOKEN_KEY = "auth_token";

/**
 * Custom error class that includes HTTP status code.
 * Allows callers (e.g. QueryClient) to detect auth failures (401/419).
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /** Returns true for 401 Unauthorized or 419 CSRF token mismatch */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 419;
  }
}

/**
 * Store the auth token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Get the auth token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Remove the auth token from localStorage
 */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Ensures the CSRF cookie is set before making state-changing requests.
 */
async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE.replace("/api", "")}/sanctum/csrf-cookie`, {
    credentials: "include",
  });
}

/**
 * Get the XSRF token from cookies to send as a header.
 * Laravel Sanctum sets 'XSRF-TOKEN' cookie and expects 'X-XSRF-TOKEN' header.
 */
function getXsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  if (match) {
    // The cookie value is URL-encoded, so we need to decode it
    return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Thin wrapper around fetch that:
 * - Prefixes path with API_BASE
 * - Includes credentials (cookies)
 * - Sets JSON content-type for bodies
 * - Fetches CSRF cookie before mutations
 * - Parses JSON responses
 * - Throws ApiError with status on failures
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

  // Add Authorization header if token exists
  const token = getAuthToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  // Add XSRF token header for CSRF protection (required by Laravel Sanctum)
  const xsrfToken = getXsrfToken();
  if (xsrfToken) {
    (headers as Record<string, string>)["X-XSRF-TOKEN"] = xsrfToken;
  }

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
      // Check if response is HTML (server error)
      if (
        text.includes("<") &&
        (text.includes("<br") || text.includes("<!") || text.includes("<html"))
      ) {
        message =
          "Server error: The server returned an HTML response instead of JSON. Please check the backend logs.";
      }
    }
    throw new ApiError(message, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  // Try to parse JSON, with better error handling for HTML responses
  const text = await res.text();

  // Check if response is HTML instead of JSON
  if (
    text.includes("<") &&
    (text.includes("<br") || text.includes("<!") || text.includes("<html"))
  ) {
    throw new ApiError(
      "Server error: The server returned an HTML response instead of JSON. Please check the backend logs.",
      500
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      `Invalid JSON response from server: ${text.substring(0, 100)}...`,
      500
    );
  }
}

/**
 * Build headers with auth token
 */
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const token = getAuthToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Isolated fetch for Auth Tool testing.
 *
 * This fetch does NOT throw ApiError (which triggers global auth error handling).
 * Auth Tool is a separate service being tested - its auth errors should NOT
 * affect the main website's authentication state.
 *
 * Returns { success: true, data } on success, { success: false, error, status } on failure.
 */
export async function authToolFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<
  { success: true; data: T } | { success: false; error: string; status: number }
> {
  const method = (options.method ?? "GET").toUpperCase();

  // For mutations, ensure CSRF cookie is present
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    await ensureCsrf();
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  // Add Authorization header if token exists (for main website auth)
  const token = getAuthToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  // Add XSRF token header for CSRF protection
  const xsrfToken = getXsrfToken();
  if (xsrfToken) {
    (headers as Record<string, string>)["X-XSRF-TOKEN"] = xsrfToken;
  }

  // If body is present and not FormData, set JSON content type
  if (options.body && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    const text = await res.text();

    if (!res.ok) {
      let errorMessage = `Request failed: ${res.status}`;
      try {
        const json = JSON.parse(text);
        errorMessage = json.message || json.error || errorMessage;
      } catch {
        // ignore parse errors
      }

      // Return error result instead of throwing - prevents global auth error handling
      return { success: false, error: errorMessage, status: res.status };
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return { success: true, data: undefined as T };
    }

    // Parse JSON response
    try {
      const data = JSON.parse(text) as T;
      return { success: true, data };
    } catch {
      return { success: false, error: "Invalid JSON response", status: 500 };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message, status: 0 };
  }
}

/**
 * Fetch a resource as a Blob (for binary files like PDF, images).
 * Includes credentials and handles errors.
 */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: getAuthHeaders(),
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

  return res.blob();
}

/**
 * Fetch a resource as text (for HTML reports, logs, etc.).
 * Includes credentials and handles errors.
 */
export async function apiFetchText(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: getAuthHeaders(),
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

  return res.text();
}
