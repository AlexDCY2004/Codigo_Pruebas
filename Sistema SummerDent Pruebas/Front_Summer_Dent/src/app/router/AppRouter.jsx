import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import LoginPage from '../../pages/auth/LoginPage';
import DashboardPage from '../../pages/dashboard/DashboardPage';
import PacientesPage from '../../pages/pacientes/PacientesPage';
import CitasPage from '../../pages/citas/CitasPage';
import DoctoresPage from '../../pages/doctores/DoctoresPage';
import TratamientosPage from '../../pages/tratamientos/TratamientosPage';
import IngresosPage from '../../pages/finanzas/IngresosPage';
import EgresosPage from '../../pages/finanzas/EgresosPage';
import FinancesPage from '../../pages/finanzas/FinancesPage';
import InventarioPage from '../../pages/inventario/InventarioPage';
import { useAuthStore } from '../../store/authStore';

function PrivateRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pacientes" element={<PacientesPage />} />
          <Route path="/citas" element={<CitasPage />} />
          <Route path="/doctores" element={<DoctoresPage />} />
          <Route path="/tratamientos" element={<TratamientosPage />} />
          <Route path="/ingresos" element={<IngresosPage />} />
          <Route path="/egresos" element={<EgresosPage />} />
          <Route path="/financiero" element={<FinancesPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
