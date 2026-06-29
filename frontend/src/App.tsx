import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/modules/auth/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ImportJobsPage } from "@/modules/import-jobs/ImportJobsPage";
import { UploadPage } from "@/modules/import-jobs/UploadPage";
import { StagingViewerPage } from "@/modules/staging/StagingViewerPage";
import { DashboardPage } from "@/modules/dropi/DashboardPage";
import { OrdenesPage } from "@/modules/dropi/OrdenesPage";
import { OrdenDetallePage } from "@/modules/dropi/OrdenDetallePage";
import { ClientesPage } from "@/modules/dropi/ClientesPage";
import { ProductosPage } from "@/modules/dropi/ProductosPage";
import { SettingsPage } from "@/modules/settings/SettingsPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dropi" replace />} />

            {/* General */}
            <Route path="import-jobs" element={<ImportJobsPage />} />
            <Route path="upload"      element={<UploadPage />} />
            <Route path="staging"     element={<StagingViewerPage />} />

            {/* Dropi */}
            <Route path="dropi"                element={<DashboardPage />} />
            <Route path="dropi/ordenes"        element={<OrdenesPage />} />
            <Route path="dropi/ordenes/:id"    element={<OrdenDetallePage />} />
            <Route path="dropi/clientes"       element={<ClientesPage />} />
            <Route path="dropi/productos"      element={<ProductosPage />} />
            <Route path="settings"             element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
