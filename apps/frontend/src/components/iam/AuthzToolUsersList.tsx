import { useState } from "react";
import {
  useAuthzToolUsers,
  useAuthzToolRoles,
  useAuthzToolCreateUser,
  useAuthzToolUpdateUser,
  useAuthzToolDeleteUser,
  type AuthzToolUser,
} from "@/hooks/useApiQueries";

const roleColors: Record<string, string> = {
  admin: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  manager:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  user: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  member:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  viewer: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400",
  guest: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-500",
};

export function AuthzToolUsersList() {
  const { data: usersData, isLoading } = useAuthzToolUsers();
  const { data: rolesData } = useAuthzToolRoles();
  const createUserMutation = useAuthzToolCreateUser();
  const updateUserMutation = useAuthzToolUpdateUser();
  const deleteUserMutation = useAuthzToolDeleteUser();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthzToolUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newGroup, setNewGroup] = useState("general");

  // Edit form state
  const [editRole, setEditRole] = useState("");
  const [editGroup, setEditGroup] = useState("");

  const availableRoles = rolesData?.roles?.map((r) => r.role) || [
    "admin",
    "manager",
    "user",
    "member",
    "viewer",
    "guest",
  ];

  const filteredUsers = usersData?.users?.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) return;
    try {
      await createUserMutation.mutateAsync({
        email: newEmail,
        password: newPassword,
        role: newRole,
        group: newGroup,
      });
      setShowCreateForm(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      setNewGroup("general");
    } catch {
      // Error handled by mutation
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await updateUserMutation.mutateAsync({
        email: editingUser.email,
        role: editRole || undefined,
        group: editGroup || undefined,
      });
      setEditingUser(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      await deleteUserMutation.mutateAsync(email);
    } catch {
      // Error handled by mutation
    }
  };

  const startEditing = (user: AuthzToolUser) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditGroup(user.group);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            User Management
          </h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="px-6 py-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
          <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-4">
            Create New User
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="Group"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreateUser}
              disabled={
                createUserMutation.isPending || !newEmail || !newPassword
              }
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
          {createUserMutation.isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {createUserMutation.error?.message}
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by email, role, or group..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Users List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredUsers?.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No users found
          </div>
        ) : (
          filteredUsers?.map((user) => (
            <div
              key={user.email}
              className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {editingUser?.email === user.email ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Email
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {user.email}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Role
                      </label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Group
                      </label>
                      <input
                        type="text"
                        value={editGroup}
                        onChange={(e) => setEditGroup(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateUser}
                      disabled={updateUserMutation.isPending}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {updateUserMutation.isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingUser(null)}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-400 font-medium text-sm">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            roleColors[user.role] || roleColors.guest
                          }`}
                        >
                          {user.role}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Group: {user.group}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(user)}
                      className="p-2 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      title="Edit user"
                    >
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.email)}
                      disabled={deleteUserMutation.isPending}
                      className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete user"
                    >
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Total: {usersData?.total || 0} users
        </p>
      </div>
    </div>
  );
}
