import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** Renders child routes only for an authenticated administrator. */
export function ProtectedRoute() {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
