/**
 * Protects routes that require authentication.
 * Redirects to /login?returnUrl=<current path> when no token; otherwise renders children (Outlet).
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";

export function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const path = location.pathname + location.search;

  if (!token) {
    const returnUrl = encodeURIComponent(path || "/send-file");
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  return <Outlet />;
}
