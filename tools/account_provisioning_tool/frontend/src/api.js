// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

// Helper function for API calls
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// Health Check
export async function checkHealth() {
  return apiRequest("/health");
}

// Users API
export async function getUsers(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.append("status", filters.status);
  if (filters.role) params.append("role", filters.role);

  const query = params.toString();
  return apiRequest(`/api/provision/users${query ? `?${query}` : ""}`);
}

export async function getUser(username) {
  return apiRequest(`/api/provision/users/${encodeURIComponent(username)}`);
}

export async function createUser(userData) {
  return apiRequest("/api/provision/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function updateUser(username, userData) {
  return apiRequest(`/api/provision/users/${encodeURIComponent(username)}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
}

export async function deleteUser(username, performedBy = "frontend") {
  return apiRequest(`/api/provision/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
    body: JSON.stringify({ performed_by: performedBy }),
  });
}

export async function disableUser(username, performedBy = "frontend") {
  return apiRequest(
    `/api/provision/users/${encodeURIComponent(username)}/disable`,
    {
      method: "POST",
      body: JSON.stringify({ performed_by: performedBy }),
    }
  );
}

export async function enableUser(username, performedBy = "frontend") {
  return apiRequest(
    `/api/provision/users/${encodeURIComponent(username)}/enable`,
    {
      method: "POST",
      body: JSON.stringify({ performed_by: performedBy }),
    }
  );
}

// Bulk Operations
export async function bulkProvision(users, performedBy = "frontend") {
  return apiRequest("/api/provision/bulk", {
    method: "POST",
    body: JSON.stringify({ users, performed_by: performedBy }),
  });
}

// Audit Log
export async function getAuditLog(filters = {}) {
  const params = new URLSearchParams();
  if (filters.limit) params.append("limit", filters.limit);
  if (filters.action) params.append("action", filters.action);
  if (filters.username) params.append("username", filters.username);

  const query = params.toString();
  return apiRequest(`/api/provision/audit${query ? `?${query}` : ""}`);
}

// Reports & Stats
export async function getReport() {
  return apiRequest("/api/provision/report");
}

export async function getStats() {
  return apiRequest("/api/provision/stats");
}

// Demo
export async function runDemo(performedBy = "frontend") {
  return apiRequest("/api/provision/demo", {
    method: "POST",
    body: JSON.stringify({ performed_by: performedBy }),
  });
}
