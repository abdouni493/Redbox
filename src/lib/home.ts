import type { PermissionModule, User, WorkerPermissions } from '@/types';

// Route → permission module (first match on prefix)
export const ROUTE_MODULES: { path: string; module: PermissionModule }[] = [
  { path: '/dashboard', module: 'dashboard' },
  { path: '/stock', module: 'stock' },
  { path: '/purchase', module: 'purchase' },
  { path: '/production', module: 'production' },
  { path: '/comptoir', module: 'comptoir' },
  { path: '/pos', module: 'pos' },
  { path: '/commands', module: 'commands' },
  { path: '/sales', module: 'sales' },
  { path: '/clients', module: 'clients' },
  { path: '/suppliers', module: 'suppliers' },
  { path: '/workers', module: 'workers' },
  { path: '/expenses', module: 'expenses' },
  { path: '/caisse', module: 'caisse' },
  { path: '/reports', module: 'reports' },
  { path: '/settings', module: 'settings' },
];

export function canViewModule(user: User | null, module: PermissionModule): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions === 'all') return true;
  return !!(user.permissions as WorkerPermissions)[module]?.view;
}

/** Default landing interface of a profile, based on its post. */
export function homePathFor(user: User | null): string {
  if (!user) return '/login';
  if (user.role === 'admin' || user.permissions === 'all') return '/dashboard';
  const preferred: Record<string, string[]> = {
    cashier: ['/pos', '/commands', '/dashboard'],
    kitchen: ['/commands'],
    deliverer: ['/commands'],
  };
  const candidates = [...(preferred[user.post || ''] || []), ...ROUTE_MODULES.map((r) => r.path)];
  for (const path of candidates) {
    const mod = ROUTE_MODULES.find((r) => r.path === path)?.module;
    if (mod && canViewModule(user, mod)) return path;
  }
  return '/dashboard';
}
