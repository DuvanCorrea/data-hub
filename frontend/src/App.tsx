import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/modules/auth/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ImportJobsPage } from "@/modules/import-jobs/ImportJobsPage";
import { UploadPage } from "@/modules/import-jobs/UploadPage";
import { StagingViewerPage } from "@/modules/staging/StagingViewerPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/import-jobs" replace />} />
            <Route path="import-jobs" element={<ImportJobsPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="staging" element={<StagingViewerPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
