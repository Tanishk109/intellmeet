import { useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import Dashboard from "@/pages/Dashboard";
import { Placeholder } from "@/pages/Placeholder";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "meetings", element: <Placeholder title="Meetings" /> },
      { path: "schedule", element: <Placeholder title="Schedule a Meeting" /> },
      { path: "room/:code", element: <Placeholder title="Meeting Room" /> },
      { path: "intelligence", element: <Placeholder title="AI Intelligence" /> },
      { path: "board", element: <Placeholder title="Project Board" /> },
      { path: "analytics", element: <Placeholder title="Analytics" /> },
      { path: "notifications", element: <Placeholder title="Notifications" /> },
    ],
  },
  { path: "*", element: <Navigate to="/app" replace /> },
]);

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  // On boot, try to restore a session from the refresh cookie.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <RouterProvider router={router} />;
}
