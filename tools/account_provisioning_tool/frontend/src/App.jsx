import React, { useState, useEffect, useCallback } from "react";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import UserManagement from "./components/UserManagement";
import AuditLog from "./components/AuditLog";
import { checkHealth } from "./api";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [refreshKey, setRefreshKey] = useState(0);

  const checkConnection = useCallback(async () => {
    try {
      await checkHealth();
      setConnectionStatus("connected");
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("error");
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard key={refreshKey} onRefresh={handleRefresh} />;
      case "users":
        return <UserManagement key={refreshKey} onUserChange={handleRefresh} />;
      case "audit":
        return <AuditLog key={refreshKey} />;
      default:
        return <Dashboard key={refreshKey} onRefresh={handleRefresh} />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connectionStatus={connectionStatus}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
