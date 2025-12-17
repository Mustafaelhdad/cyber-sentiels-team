import { createBrowserRouter } from "react-router-dom";

import RootLayout from "@/layouts/RootLayout";
import AuthLayout from "@/layouts/AuthLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import WebSecurity from "@/pages/WebSecurity";
import Monitoring from "@/pages/Monitoring";
import IAM from "@/pages/IAM";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import NotFound from "@/pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "projects",
        element: (
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        ),
      },
      {
        path: "projects/:projectId",
        element: (
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "web-security",
        element: (
          <ProtectedRoute>
            <WebSecurity />
          </ProtectedRoute>
        ),
      },
      {
        path: "monitoring",
        element: (
          <ProtectedRoute>
            <Monitoring />
          </ProtectedRoute>
        ),
      },
      {
        path: "iam",
        element: (
          <ProtectedRoute>
            <IAM />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
    ],
  },
  {
    path: "*",
    element: <RootLayout />,
    children: [{ path: "*", element: <NotFound /> }],
  },
]);
