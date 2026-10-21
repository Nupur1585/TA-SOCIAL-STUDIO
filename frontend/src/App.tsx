import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./context/AuthContext";
import { BrandsProvider } from "./context/BrandsContext";
import Brands from "./pages/Brands";
import Content from "./pages/Content";
import ContentForm from "./pages/ContentForm";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import MediaLibrary from "./pages/MediaLibrary";
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
              <Route path="content" element={<Content />} />
              <Route path="content/new" element={<ContentForm />} />
              <Route path="content/:id/edit" element={<ContentForm />} />
              <Route path="media" element={<MediaLibrary />} />
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
