import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./context/AuthContext";
import { BrandsProvider } from "./context/BrandsContext";
import Brands from "./pages/Brands";
import AIContent from "./pages/AIContent";
import AIPlanner from "./pages/AIPlanner";
import ActivityLogs from "./pages/ActivityLogs";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import Content from "./pages/Content";
import ContentForm from "./pages/ContentForm";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import MediaLibrary from "./pages/MediaLibrary";
import Placeholder from "./pages/Placeholder";
import Reports from "./pages/Reports";

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
              <Route path="content/ai" element={<AIContent />} />
              <Route path="content/planner" element={<AIPlanner />} />
              <Route path="content/:id/edit" element={<ContentForm />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="reports" element={<Reports />} />
              <Route path="activity-logs" element={<ActivityLogs />} />
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
