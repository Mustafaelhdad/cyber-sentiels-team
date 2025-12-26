import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  disableUser,
  enableUser,
} from "../api";
import "./UserManagement.css";

const statusColors = {
  active: "success",
  inactive: "muted",
  pending: "warning",
  disabled: "danger",
  suspended: "orange",
};

const roleOptions = [
  "user",
  "admin",
  "IT",
  "HR",
  "Finance",
  "Manager",
  "Developer",
];
const statusOptions = [
  "active",
  "inactive",
  "pending",
  "disabled",
  "suspended",
];

export default function UserManagement({ onUserChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "user",
    status: "active",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Action menu
  const [activeMenu, setActiveMenu] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (roleFilter) filters.role = roleFilter;

      const data = await getUsers(filters);
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, roleFilter]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setActiveMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      await createUser({
        ...formData,
        performed_by: "frontend",
      });
      setShowCreateModal(false);
      setFormData({ username: "", email: "", role: "user", status: "active" });
      await fetchUsers();
      if (onUserChange) onUserChange();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      await updateUser(selectedUser.username, {
        email: formData.email,
        role: formData.role,
        status: formData.status,
        performed_by: "frontend",
      });
      setShowEditModal(false);
      await fetchUsers();
      if (onUserChange) onUserChange();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    setSubmitting(true);
    try {
      await deleteUser(selectedUser.username);
      setShowDeleteModal(false);
      await fetchUsers();
      if (onUserChange) onUserChange();
    } catch (error) {
      console.error("Failed to delete user:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      if (user.status === "disabled") {
        await enableUser(user.username);
      } else {
        await disableUser(user.username);
      }
      await fetchUsers();
      if (onUserChange) onUserChange();
    } catch (error) {
      console.error("Failed to toggle user status:", error);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setFormError("");
    setShowEditModal(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  return (
    <div className="user-management">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <Users className="title-icon" />
            User Management
          </h1>
          <p className="page-subtitle">
            Manage user accounts, roles, and access permissions
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormData({
              username: "",
              email: "",
              role: "user",
              status: "active",
            });
            setFormError("");
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} />
          Create User
        </button>
      </div>

      {/* Search & Filters */}
      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery("")}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-controls">
          <button
            className={`btn btn-filter ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
            {(statusFilter || roleFilter) && (
              <span className="filter-badge">
                {[statusFilter, roleFilter].filter(Boolean).length}
              </span>
            )}
          </button>

          <button className="btn btn-icon" onClick={fetchUsers} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="filter-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="filter-group">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {(statusFilter || roleFilter) && (
              <button
                className="btn btn-text"
                onClick={() => {
                  setStatusFilter("");
                  setRoleFilter("");
                }}
              >
                Clear Filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <div className="users-table-container">
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner" />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="table-empty">
            <Users size={48} />
            <h3>No users found</h3>
            <p>
              {searchQuery || statusFilter || roleFilter
                ? "Try adjusting your search or filters"
                : "Create your first user to get started"}
            </p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {user.username?.charAt(0).toUpperCase()}
                      </div>
                      <span className="username">{user.username}</span>
                    </div>
                  </td>
                  <td className="email-cell">{user.email}</td>
                  <td>
                    <span className="role-badge">{user.role}</span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        statusColors[user.status] || "muted"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="date-cell">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-icon-sm"
                        onClick={() => openEditModal(user)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className={`btn btn-icon-sm ${
                          user.status === "disabled" ? "success" : "warning"
                        }`}
                        onClick={() => handleToggleStatus(user)}
                        title={
                          user.status === "disabled" ? "Enable" : "Disable"
                        }
                      >
                        {user.status === "disabled" ? (
                          <UserCheck size={14} />
                        ) : (
                          <UserX size={14} />
                        )}
                      </button>
                      <button
                        className="btn btn-icon-sm danger"
                        onClick={() => openDeleteModal(user)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Results Count */}
      {!loading && filteredUsers.length > 0 && (
        <div className="results-count">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      )}

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal
            title="Create New User"
            onClose={() => setShowCreateModal(false)}
          >
            <form onSubmit={handleCreateUser} className="user-form">
              {formError && (
                <div className="form-error">
                  <AlertCircle size={16} />
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {showEditModal && selectedUser && (
          <Modal
            title={`Edit User: ${selectedUser.username}`}
            onClose={() => setShowEditModal(false)}
          >
            <form onSubmit={handleUpdateUser} className="user-form">
              {formError && (
                <div className="form-error">
                  <AlertCircle size={16} />
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-role">Role</label>
                  <select
                    id="edit-role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-status">Status</label>
                  <select
                    id="edit-status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedUser && (
          <Modal
            title="Delete User"
            onClose={() => setShowDeleteModal(false)}
            danger
          >
            <div className="delete-confirmation">
              <div className="delete-icon">
                <Trash2 size={32} />
              </div>
              <p>
                Are you sure you want to delete{" "}
                <strong>{selectedUser.username}</strong>?
              </p>
              <p className="delete-warning">This action cannot be undone.</p>
              <div className="form-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteUser}
                  disabled={submitting}
                >
                  {submitting ? "Deleting..." : "Delete User"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Modal Component
function Modal({ title, children, onClose, danger }) {
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`modal ${danger ? "danger" : ""}`}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </motion.div>
    </motion.div>
  );
}
