import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';
import { KitchenAutoPrint } from './KitchenAutoPrint';
import { CaisseGate } from '@/components/caisse/CaisseGate';
import { useAuthStore } from '@/store/authStore';
import { ROUTE_MODULES, canViewModule, homePathFor } from '@/lib/home';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // Keep each profile inside the interfaces it is allowed to use.
  useEffect(() => {
    if (!user) return;
    const route = ROUTE_MODULES.find((r) => location.pathname === r.path || location.pathname.startsWith(r.path + '/'));
    if (route && !canViewModule(user, route.module)) {
      const home = homePathFor(user);
      if (home !== location.pathname) navigate(home, { replace: true });
    }
  }, [location.pathname, user, navigate]);

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {/*
            Keying the wrapper by pathname remounts it on every navigation, so the
            entrance animation replays per page WITHOUT relying on AnimatePresence's
            "wait" mode — which could deadlock at opacity:0 if an exit was interrupted
            and leave pages blank until a refresh.
          */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>
      <CaisseGate />
      <KitchenAutoPrint />
    </div>
  );
}
