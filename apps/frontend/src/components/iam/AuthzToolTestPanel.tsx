import { useState } from "react";
import {
  useAuthzToolAuthorize,
  useAuthzToolPrivileges,
  useAuthzToolTestFlow,
  useAuthzToolRoles,
  useAuthzToolResources,
} from "@/hooks/useApiQueries";

type TestMode = "authorize" | "privileges" | "auto";

export function AuthzToolTestPanel() {
  const [mode, setMode] = useState<TestMode>("authorize");

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState("read");
  const [resource, setResource] = useState("");
  const [policy, setPolicy] = useState<"RBAC" | "ABAC">("RBAC");
  const [role, setRole] = useState("user");
  const [group, setGroup] = useState("general");

  // Queries
  const { data: rolesData } = useAuthzToolRoles();
  const { data: resourcesData } = useAuthzToolResources();

  // Mutations
  const authorizeMutation = useAuthzToolAuthorize();
  const privilegesMutation = useAuthzToolPrivileges();
  const testFlowMutation = useAuthzToolTestFlow();

  const availableRoles = rolesData?.roles?.map((r) => r.role) || [
    "admin",
    "manager",
    "user",
    "member",
    "viewer",
    "guest",
  ];

  const availableResources = resourcesData?.resources?.map(
    (r) => r.resource
  ) || ["dashboard", "reports", "users", "settings", "logs", "security"];

  const handleAuthorize = async () => {
    if (!email) return;
    await authorizeMutation.mutateAsync({
      email,
      action,
      resource: resource || undefined,
      policy,
    });
  };

  const handleGetPrivileges = async () => {
    if (!email) return;
    await privilegesMutation.mutateAsync({
      email,
      policy,
    });
  };

  const handleAutoTest = async () => {
    if (!email || !password) return;
    await testFlowMutation.mutateAsync({
      email,
      password,
      role,
      group,
    });
  };

  const isLoading =
    authorizeMutation.isPending ||
    privilegesMutation.isPending ||
    testFlowMutation.isPending;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Authorization Test Panel
          </h3>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode("authorize")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "authorize"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Authorize
            </button>
            <button
              onClick={() => setMode("privileges")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "privileges"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Privileges
            </button>
            <button
              onClick={() => setMode("auto")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "auto"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Auto Test
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {mode === "authorize" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Test if a user is authorized to perform an action on a resource.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Action
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                  <option value="delete">Delete</option>
                  <option value="manage">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Resource (Optional)
                </label>
                <select
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">General (No specific resource)</option>
                  {availableResources.map((res) => (
                    <option key={res} value={res}>
                      {res.charAt(0).toUpperCase() + res.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Policy
                </label>
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as "RBAC" | "ABAC")}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="RBAC">RBAC (Role-Based)</option>
                  <option value="ABAC">ABAC (Attribute-Based)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAuthorize}
              disabled={isLoading || !email}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {authorizeMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Check Authorization
                </>
              )}
            </button>

            {/* Authorization Result */}
            {authorizeMutation.data && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  authorizeMutation.data.authorized
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      authorizeMutation.data.authorized
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {authorizeMutation.data.authorized ? (
                      <svg
                        className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-red-600 dark:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p
                      className={`font-semibold ${
                        authorizeMutation.data.authorized
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {authorizeMutation.data.decision}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {authorizeMutation.data.email} →{" "}
                      {authorizeMutation.data.action} on{" "}
                      {authorizeMutation.data.resource}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Role</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {authorizeMutation.data.role}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Group</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {authorizeMutation.data.group}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Policy</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {authorizeMutation.data.policy}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">
                      Privileges
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {authorizeMutation.data.privileges.join(", ") || "none"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {authorizeMutation.isError && (
              <div className="mt-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
                Error: {authorizeMutation.error?.message}
              </div>
            )}
          </div>
        )}

        {mode === "privileges" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get all privileges for a user based on their role and group.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Policy
                </label>
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as "RBAC" | "ABAC")}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="RBAC">RBAC (Role-Based)</option>
                  <option value="ABAC">ABAC (Attribute-Based)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGetPrivileges}
              disabled={isLoading || !email}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {privilegesMutation.isPending ? "Loading..." : "Get Privileges"}
            </button>

            {/* Privileges Result */}
            {privilegesMutation.data && (
              <div className="mt-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-3">
                  User Privileges
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {privilegesMutation.data.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Role</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {privilegesMutation.data.role}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Group</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {privilegesMutation.data.group}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Policy</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {privilegesMutation.data.policy}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    Privileges
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {privilegesMutation.data.privileges.length > 0 ? (
                      privilegesMutation.data.privileges.map((priv) => (
                        <span
                          key={priv}
                          className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-medium"
                        >
                          {priv}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        No privileges
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {privilegesMutation.isError && (
              <div className="mt-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
                Error: {privilegesMutation.error?.message}
              </div>
            )}
          </div>
        )}

        {mode === "auto" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Run an automated test of the complete authorization flow (create
              user → verify → check privileges → authorize actions).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group
                </label>
                <input
                  type="text"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="general"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleAutoTest}
              disabled={isLoading || !email || !password}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {testFlowMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running Test...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Run Full Test
                </>
              )}
            </button>

            {/* Test Results */}
            {testFlowMutation.data && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  Test Results
                  {testFlowMutation.data.overall_success ? (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                      PASSED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                      FAILED
                    </span>
                  )}
                </h4>

                <div className="space-y-2 text-sm">
                  {Object.entries(testFlowMutation.data.test_results).map(
                    ([key, value]) => {
                      if (key === "overall_success") return null;
                      const result = value as {
                        success?: boolean;
                        data?: { authorized?: boolean };
                      } | null;
                      const isAuthResult = key.startsWith("authorize_");
                      const passed = isAuthResult
                        ? result?.data?.authorized
                        : result?.success;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-gray-600 dark:text-gray-400 capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                          {passed ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ✓ Pass
                            </span>
                          ) : result === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">
                              ✗ Fail
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {testFlowMutation.isError && (
              <div className="mt-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
                Error: {testFlowMutation.error?.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
