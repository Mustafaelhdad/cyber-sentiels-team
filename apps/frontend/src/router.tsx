import { createBrowserRouter } from "react-router-dom";

import RootLayout from "@/layouts/RootLayout";
import AuthLayout from "@/layouts/AuthLayout";

import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import WebSecurity from "@/pages/WebSecurity";
import Monitoring from "@/pages/Monitoring";
import IAM from "@/pages/IAM";
import NotFound from "@/pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "web-security", element: <WebSecurity /> },
      { path: "monitoring", element: <Monitoring /> },
      { path: "iam", element: <IAM /> },
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
