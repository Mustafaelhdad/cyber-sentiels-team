import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  X,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  UserCheck,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAuditLog } from "../api";
import "./AuditLog.css";

const actionIcons = {
  create: UserPlus,
  modify: Edit,
  disable: UserMinus,
  enable: UserCheck,
  delete: Trash2,
};

const actionColors = {
  create: "success",
  modify: "info",
  disable: "warning",
  enable: "success",
  delete: "danger",
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [limit, setLimit] = useState(50);
  const [expandedLog, setExpandedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const filters = { limit };
      if (actionFilter) filters.action = actionFilter;
      if (searchQuery) filters.username = searchQuery;

      const data = await getAuditLog(filters);
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, limit]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.username?.toLowerCase().includes(query) ||
      log.action?.toLowerCase().includes(query) ||
      log.details?.toLowerCase().includes(query) ||
      log.performed_by?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const parseDetails = (details) => {
    if (!details) return [];
    return details
      .split(";")
      .map((item) => {
        const [key, value] = item.split("=");
        return { key, value };
      })
      .filter((item) => item.key && item.value);
  };

  return (
    <div className="audit-log">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">
            <FileText className="title-icon" />
            Audit Log
          </h1>
          <p className="page-subtitle">
            Track all account provisioning activities for security and
            compliance
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="controls-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search"
              onClick={() => {
                setSearchQuery("");
                fetchLogs();
              }}
            >
              <X size={16} />
            </button>
          )}
        </form>

        <div className="filter-controls">
          <div className="filter-select">
            <Filter size={16} />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="modify">Modify</option>
              <option value="disable">Disable</option>
              <option value="enable">Enable</option>
              <option value="delete">Delete</option>
            </select>
          </div>

          <div className="filter-select">
            <Clock size={16} />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={25}>Last 25</option>
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={500}>Last 500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Timeline */}
      <div className="logs-container">
        {loading ? (
          <div className="logs-loading">
            <div className="loading-spinner" />
            <span>Loading audit logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="logs-empty">
            <FileText size={48} />
            <h3>No audit logs found</h3>
            <p>
              {searchQuery || actionFilter
                ? "Try adjusting your search or filters"
                : "Activity logs will appear here as actions are performed"}
            </p>
          </div>
        ) : (
          <div className="logs-timeline">
            {filteredLogs.map((log, index) => {
              const ActionIcon = actionIcons[log.action] || FileText;
              const colorClass = actionColors[log.action] || "muted";
              const isExpanded = expandedLog === log.id;
              const details = parseDetails(log.details);

              return (
                <motion.div
                  key={log.id}
                  className={`log-entry ${colorClass}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div className="log-timeline">
                    <div className={`log-icon ${colorClass}`}>
                      <ActionIcon size={16} />
                    </div>
                    {index < filteredLogs.length - 1 && (
                      <div className="log-line" />
                    )}
                  </div>

                  <div className="log-content">
                    <div
                      className="log-header"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="log-main">
                        <span className={`log-action ${colorClass}`}>
                          {log.action}
                        </span>
                        <span className="log-user">
                          <strong>{log.username}</strong>
                        </span>
                        <span className="log-performer">
                          by {log.performed_by}
                        </span>
                      </div>
                      <div className="log-meta">
                        <span className="log-time">
                          {formatDate(log.created_at)}
                        </span>
                        {details.length > 0 && (
                          <button className="log-expand">
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && details.length > 0 && (
                      <motion.div
                        className="log-details"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {details.map((detail, i) => (
                          <div key={i} className="detail-item">
                            <span className="detail-key">{detail.key}</span>
                            <span className="detail-value">{detail.value}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Count */}
      {!loading && filteredLogs.length > 0 && (
        <div className="results-count">
          Showing {filteredLogs.length} log entries
        </div>
      )}
    </div>
  );
}
