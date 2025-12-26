import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Users,
  FileText,
  BarChart3,
  Activity,
  Menu,
  X,
  Terminal,
  Zap,
} from "lucide-react";
import "./Layout.css";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "audit", label: "Audit Log", icon: FileText },
];

export default function Layout({
  children,
  activeTab,
  onTabChange,
  connectionStatus,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="layout">
      {/* Sidebar */}
      <motion.aside
        className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 72 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Logo */}
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Shield size={28} />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  className="logo-text"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="logo-title">Cyber Sentinels</span>
                  <span className="logo-subtitle">IAM Console</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => onTabChange(item.id)}
              >
                <div className="nav-icon">
                  <Icon size={20} />
                </div>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      className="nav-label"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    className="nav-indicator"
                    layoutId="nav-indicator"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Status Footer */}
        <div className="sidebar-footer">
          <div className={`status-indicator ${connectionStatus}`}>
            <Activity size={16} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {connectionStatus === "connected"
                    ? "Connected"
                    : connectionStatus === "error"
                    ? "Disconnected"
                    : "Connecting..."}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <Terminal size={18} className="terminal-icon" />
            <span className="breadcrumb">
              <span className="breadcrumb-prefix">~/iam/</span>
              <span className="breadcrumb-current">{activeTab}</span>
            </span>
          </div>
          <div className="topbar-right">
            <div className="system-time">
              <Zap size={14} />
              <span className="font-mono">
                {currentTime.toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="page-wrapper"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
