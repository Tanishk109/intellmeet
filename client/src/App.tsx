import { lazy, Suspense, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/Card";

// Route-level code splitting: each page becomes its own chunk so the initial
// load stays small. Heavy deps (recharts on Analytics/Dashboard, socket.io +
// WebRTC on MeetingRoom) are only fetched when that route is visited.
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const OAuthCallback = lazy(() => import("@/pages/OAuthCallback"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Meetings = lazy(() => import("@/pages/Meetings"));
const MeetingRoom = lazy(() => import("@/pages/MeetingRoom"));
const Intelligence = lazy(() => import("@/pages/Intelligence"));
const Board = lazy(() => import("@/pages/Board"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Notifications = lazy(() => import("@/pages/Notifications"));

function PageFallback() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <Spinner className="size-6 text-signal-400" />
    </div>
  );
}

// Wrap a lazy element in Suspense so navigation shows a spinner while the
// chunk downloads.
const page = (el: React.ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app" replace /> },
  { path: "/login", element: page(<Login />) },
  { path: "/signup", element: page(<Signup />) },
  { path: "/forgot-password", element: page(<ForgotPassword />) },
  { path: "/oauth/callback", element: page(<OAuthCallback />) },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(<Dashboard />) },
      { path: "meetings", element: page(<Meetings />) },
      { path: "schedule", element: page(<Schedule />) },
      { path: "room/:code", element: page(<MeetingRoom />) },
      { path: "intelligence", element: page(<Intelligence />) },
      { path: "board", element: page(<Board />) },
      { path: "analytics", element: page(<Analytics />) },
      { path: "notifications", element: page(<Notifications />) },
    ],
  },
  { path: "*", element: <Navigate to="/app" replace /> },
]);

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <RouterProvider router={router} />;
}
