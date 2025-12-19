const API_BASE = import.meta.env.VITE_API_URL || "/api";
const AUTH_TOKEN_KEY = "auth_token";

/**
 * Custom error class that includes HTTP status code.
 * Allows callers (e.g. QueryClient) to detect auth failures (401/419).
 */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
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
      // ignore
    }
    throw new ApiError(message, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
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
