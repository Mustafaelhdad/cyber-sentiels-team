import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  UserX,
  Activity,
  TrendingUp,
  Shield,
  Clock,
  AlertTriangle,
  Play,
  RefreshCw,
} from "lucide-react";
import { getStats, getReport, runDemo } from "../api";
import "./Dashboard.css";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Dashboard({ onRefresh }) {
  const [stats, setStats] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoResult, setDemoResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, reportData] = await Promise.all([
        getStats(),
        getReport(),
      ]);
      setStats(statsData);
      setReport(reportData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunDemo = async () => {
    setDemoRunning(true);
    setDemoResult(null);
    try {
      const result = await runDemo("dashboard");
      setDemoResult(result);
      await fetchData();
      if (onRefresh) onRefresh();
    } catch (error) {
      setDemoResult({ error: error.message });
    } finally {
      setDemoRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Users",
      value: stats?.total_users || 0,
      icon: Users,
      color: "primary",
      description: "Provisioned accounts",
    },
    {
      label: "Active Users",
      value: stats?.active_users || 0,
      icon: UserCheck,
      color: "success",
      description: "Currently active",
    },
    {
      label: "Disabled Users",
      value: report?.summary?.users_by_status?.disabled || 0,
      icon: UserX,
      color: "danger",
      description: "Deactivated accounts",
    },
    {
      label: "Audit Entries",
      value: stats?.total_audit_entries || 0,
      icon: Activity,
      color: "info",
      description: "Total logged actions",
    },
  ];

  const activityItems = [
    {
      label: "Accounts Created",
      value: report?.activity?.accounts_created || 0,
      icon: TrendingUp,
    },
    {
      label: "Accounts Modified",
      value: report?.activity?.accounts_modified || 0,
      icon: RefreshCw,
    },
    {
      label: "Accounts Disabled",
      value: report?.activity?.accounts_disabled || 0,
      icon: AlertTriangle,
    },
    {
      label: "Accounts Enabled",
      value: report?.activity?.accounts_enabled || 0,
      icon: Shield,
    },
  ];

  return (
    <motion.div
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div className="dashboard-header" variants={itemVariants}>
        <div className="header-content">
          <h1 className="page-title">
            <Shield className="title-icon" />
            IAM Dashboard
          </h1>
          <p className="page-subtitle">Identity & Access Management Overview</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            className={`btn btn-primary ${demoRunning ? "loading" : ""}`}
            onClick={handleRunDemo}
            disabled={demoRunning}
          >
            <Play size={16} />
            {demoRunning ? "Running Demo..." : "Run Demo"}
          </button>
        </div>
      </motion.div>

      {/* Demo Result */}
      {demoResult && (
        <motion.div
          className={`demo-result ${demoResult.error ? "error" : "success"}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          {demoResult.error ? (
            <span>❌ Demo failed: {demoResult.error}</span>
          ) : (
            <span>✅ {demoResult.message}</span>
          )}
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div className="stats-grid" variants={itemVariants}>
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              className={`stat-card ${stat.color}`}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="stat-icon">
                <Icon size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
                <span className="stat-description">{stat.description}</span>
              </div>
              <div className="stat-glow" />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Activity & Roles Section */}
      <div className="dashboard-grid">
        {/* Activity Summary */}
        <motion.div className="dashboard-card" variants={itemVariants}>
          <div className="card-header">
            <h2 className="card-title">
              <Activity size={18} />
              Activity Summary
            </h2>
          </div>
          <div className="activity-list">
            {activityItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="activity-item">
                  <div className="activity-icon">
                    <Icon size={16} />
                  </div>
                  <span className="activity-label">{item.label}</span>
                  <span className="activity-value">{item.value}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Roles Distribution */}
        <motion.div className="dashboard-card" variants={itemVariants}>
          <div className="card-header">
            <h2 className="card-title">
              <Users size={18} />
              Roles Distribution
            </h2>
          </div>
          <div className="roles-list">
            {report?.summary?.users_by_role &&
              Object.entries(report.summary.users_by_role).map(
                ([role, count]) => (
                  <div key={role} className="role-item">
                    <div className="role-info">
                      <span className="role-name">{role}</span>
                      <span className="role-count">{count} users</span>
                    </div>
                    <div className="role-bar">
                      <motion.div
                        className="role-bar-fill"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(count / stats?.total_users) * 100}%`,
                        }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                  </div>
                )
              )}
            {(!report?.summary?.users_by_role ||
              Object.keys(report.summary.users_by_role).length === 0) && (
              <div className="empty-state">
                <span>No roles assigned yet</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Status Overview */}
        <motion.div className="dashboard-card" variants={itemVariants}>
          <div className="card-header">
            <h2 className="card-title">
              <Shield size={18} />
              Status Overview
            </h2>
          </div>
          <div className="status-grid">
            {report?.summary?.users_by_status &&
              Object.entries(report.summary.users_by_status).map(
                ([status, count]) => (
                  <div key={status} className={`status-item ${status}`}>
                    <span className="status-count">{count}</span>
                    <span className="status-name">{status}</span>
                  </div>
                )
              )}
          </div>
        </motion.div>

        {/* System Info */}
        <motion.div className="dashboard-card" variants={itemVariants}>
          <div className="card-header">
            <h2 className="card-title">
              <Clock size={18} />
              System Info
            </h2>
          </div>
          <div className="system-info">
            <div className="info-row">
              <span className="info-label">Service</span>
              <span className="info-value font-mono">
                {stats?.service || "account-provisioning"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <span className="info-value status-badge active">
                {stats?.status || "running"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Database</span>
              <span className="info-value font-mono truncate">
                {stats?.database || "/data/users.db"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Report Generated</span>
              <span className="info-value font-mono">
                {report?.generated_at
                  ? new Date(report.generated_at).toLocaleString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
