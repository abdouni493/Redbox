import { useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastViewport } from '@/components/ui/Toast';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CashierDashboard from '@/pages/CashierDashboard';
import Stock from '@/pages/Stock';
import Purchase from '@/pages/Purchase';
import Production from '@/pages/Production';
import Comptoir from '@/pages/Comptoir';
import POS from '@/pages/POS';
import Sales from '@/pages/Sales';
import Clients from '@/pages/Clients';
import Commands from '@/pages/Commands';
import { homePathFor } from '@/lib/home';
import Suppliers from '@/pages/Suppliers';
import Workers from '@/pages/Workers';
import Expenses from '@/pages/Expenses';
import Caisse from '@/pages/Caisse';
import CaisseReports from '@/pages/Caisse/CaisseReports';
import ComptoirStats from '@/pages/Caisse/ComptoirStats';
import Reports from '@/pages/Reports';
import SettingsPage from '@/pages/Settings';

function DashboardRoute() {
  const user = useAuthStore((s) => s.user);
  return user?.role !== 'admin' && user?.post === 'cashier' ? <CashierDashboard /> : <Dashboard />;
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />;
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function BootScreen() {
  return (
    <div className="min-h-screen w-full bg-gradient-hero flex flex-col items-center justify-center gap-4 text-amber-100">
      <div className="h-12 w-12 rounded-full border-4 border-amber-200/30 border-t-amber-200 animate-spin" />
      <p className="text-sm font-medium">Connexion à la base de données…</p>
    </div>
  );
}

export default function App() {
  const language = useAuthStore((s) => s.language);
  const ready = useAuthStore((s) => s.ready);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  // Restore the Supabase session (if any) and load all data once.
  useEffect(() => { init(); }, [init]);

  if (!ready) return <BootScreen />;

  return (
    <>
      <ToastViewport />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/production" element={<Production />} />
          <Route path="/comptoir" element={<Comptoir />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/commands" element={<Navigate to="/commands" replace />} />
          <Route path="/commands" element={<Commands />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/workers" element={<Workers />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/caisse" element={<Caisse />} />
          <Route path="/caisse/reports" element={<CaisseReports />} />
          <Route path="/caisse/statistics" element={<ComptoirStats />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </>
  );
}
