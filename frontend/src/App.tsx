import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./context/AuthContext";
import { BrandsProvider } from "./context/BrandsContext";
import Brands from "./pages/Brands";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Placeholder from "./pages/Placeholder";

function App() {
  return (
    <AuthProvider>
      <BrandsProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="brands" element={<Brands />} />
              <Route path="brands/:brandId" element={<Placeholder />} />
              <Route path="brands/:brandId/assets" element={<Placeholder />} />
              <Route
                path="brands/:brandId/guidelines"
                element={<Placeholder />}
              />
              <Route path="content" element={<Placeholder />} />
              <Route path="content/new" element={<Placeholder />} />
              <Route path="media" element={<Placeholder />} />
              <Route path="calendar" element={<Placeholder />} />
              <Route path="analytics" element={<Placeholder />} />
              <Route path="reports" element={<Placeholder />} />
              <Route path="activity-logs" element={<Placeholder />} />
              <Route path="settings" element={<Placeholder />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrandsProvider>
    </AuthProvider>
  );
}

export default App;
