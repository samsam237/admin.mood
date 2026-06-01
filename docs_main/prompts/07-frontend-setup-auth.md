# Prompt 07 — Frontend : setup, auth, layout

## Contexte
Frontend React 18 + TypeScript + Tailwind + shadcn/ui pour `mood-admin`. Ce prompt crée le client API Axios, le hook d'auth, la page de login et le layout principal avec sidebar.

## Prérequis
- Prompt 01 complété (client Vite créé, Tailwind configuré)
- shadcn/ui initialisé (`npx shadcn@latest init`)
- Backend opérationnel sur port 3001

## Instructions

### 1. Types partagés — `client/src/types/index.ts`

```typescript
export interface KpiMetric {
  value: number;
  trend: number;
}

export interface KpiData {
  dau: KpiMetric;
  wau: KpiMetric;
  mau: KpiMetric;
  stickiness: KpiMetric;
  goalsRate: KpiMetric;
}

export interface OverviewData {
  totalUsers: number;
  totalEvents: number;
  activeToday: number;
  newUsersToday: number;
  topEventTypes: { type: string; count: number }[];
}

export interface AppUser {
  userId: string;
  email: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  eventCount: number;
  segment?: 'active' | 'dormant' | 'churned';
}

export interface Event {
  id: number;
  userId: string;
  type: string;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

export interface DailyStat {
  userId: string;
  date: string;
  water: number;
  movements: number;
  goalsReached: boolean;
}

export interface Alert {
  id: number;
  type: string;
  message: string;
  threshold: number | null;
  triggeredAt: string;
  isRead: boolean;
}

export interface RetentionData {
  d1: number;
  d7: number;
  d30: number;
  cohortSize: number;
}

export interface SegmentData {
  active: number;
  dormant: number;
  churned: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

### 2. Client API — `client/src/lib/api.ts`

```typescript
import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Injecter le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Rediriger vers login sur 401
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (username: string, password: string) =>
  api.post<{ token: string; username: string }>('/auth/login', { username, password });

// ─── Analytics ───────────────────────────────────────────────────────────────
export const getOverview = () => api.get('/overview').then((r) => r.data);
export const getKpis = (days: number) => api.get(`/kpis?days=${days}`).then((r) => r.data);
export const getAnalytics = (days: number) => api.get(`/analytics?days=${days}`).then((r) => r.data);
export const getRetention = () => api.get('/retention').then((r) => r.data);
export const getSegments = () => api.get('/users/segments').then((r) => r.data);
export const getEventTrends = (days: number) => api.get(`/events/trends?days=${days}`).then((r) => r.data);

// ─── Users ────────────────────────────────────────────────────────────────────
export const getUsers = (params: Record<string, unknown>) =>
  api.get('/users', { params }).then((r) => r.data);
export const getUserDetail = (userId: string, days: number) =>
  api.get(`/admin/users/${userId}?days=${days}`).then((r) => r.data);

// ─── Events & Stats ───────────────────────────────────────────────────────────
export const getEvents = (params: Record<string, unknown>) =>
  api.get('/events', { params }).then((r) => r.data);
export const getStats = (params: Record<string, unknown>) =>
  api.get('/stats', { params }).then((r) => r.data);

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const getAlerts = () => api.get<Alert[]>('/alerts').then((r) => r.data);
export const markAlertRead = (id: number) => api.patch(`/alerts/${id}/read`);

// ─── Export ───────────────────────────────────────────────────────────────────
export const exportCsv = (type: string, params?: Record<string, unknown>) => {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  window.location.href = `/api/export/${type}${qs}`;
};
export const exportReport = () => { window.location.href = '/api/export/report'; };

// ─── Health ───────────────────────────────────────────────────────────────────
export const getHealth = () => api.get('/health').then((r) => r.data);

export default api;
```

### 3. Hook auth — `client/src/hooks/useAuth.ts`

```typescript
import { create } from 'zustand'; // npm install zustand

interface AuthState {
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (token, username) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    set({ token, username, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    set({ token: null, username: null, isAuthenticated: false });
  },
}));
```

Installer Zustand : `cd client && npm install zustand`

### 4. Hook range — `client/src/hooks/useRange.ts`

```typescript
import { create } from 'zustand';

interface RangeState {
  days: number;
  setDays: (days: number) => void;
}

export const useRange = create<RangeState>((set) => ({
  days: parseInt(localStorage.getItem('rangeDays') ?? '30', 10),
  setDays: (days) => {
    localStorage.setItem('rangeDays', String(days));
    set({ days });
  },
}));
```

### 5. Utilitaires — `client/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatTrend(trend: number): string {
  if (trend > 0) return `+${trend.toFixed(1)}%`;
  if (trend < 0) return `${trend.toFixed(1)}%`;
  return '—';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
```

### 6. Page Login — `client/src/pages/LoginPage.tsx`

```tsx
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(username, password);
      setAuth(data.token, data.username);
      navigate('/');
    } catch {
      setError('Identifiants invalides.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">mood admin</h1>
          <p className="text-sm text-slate-500 mt-1">Tableau de bord analytics</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Identifiant
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 7. Router + Guard — `client/src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import UserDetailPage from '@/pages/UserDetailPage';
import AppLayout from '@/components/layout/AppLayout';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 8. Layout — `client/src/components/layout/AppLayout.tsx`

```tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 9. Sidebar — `client/src/components/layout/Sidebar.tsx`

```tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Vue d\'ensemble', icon: LayoutDashboard, end: true },
  { to: '/?tab=users', label: 'Utilisateurs', icon: Users, end: false },
  { to: '/?tab=events', label: 'Événements', icon: Activity, end: false },
  { to: '/?tab=stats', label: 'Statistiques', icon: BarChart2, end: false },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
        <span className="font-bold text-lg text-slate-900 dark:text-white">mood</span>
        <span className="ml-1 text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">admin</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

### 10. Header — `client/src/components/layout/Header.tsx`

```tsx
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Moon, Sun, RefreshCw } from 'lucide-react';
import { getAlerts, markAlertRead } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRange } from '@/hooks/useRange';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { logout, username } = useAuth();
  const { days, setDays } = useRange();
  const navigate = useNavigate();
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));

  const { data: alerts = [], refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    refetchInterval: 30_000,
  });

  const unread = alerts.filter((a) => !a.isRead).length;

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(!dark);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-4">
      {/* Range selector */}
      <div className="flex gap-1 ml-auto">
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              days === d
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {d}j
          </button>
        ))}
      </div>

      {/* Alerts bell */}
      <div className="relative">
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* Dark mode */}
      <button onClick={toggleDark} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* User + logout */}
      <span className="text-sm text-slate-600 dark:text-slate-400">{username}</span>
      <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
        <LogOut size={18} />
      </button>
    </header>
  );
}
```

## Validation
- [ ] `http://localhost:5173/login` affiche le formulaire
- [ ] Login avec les bons identifiants redirige vers `/`
- [ ] Login avec mauvais identifiants affiche "Identifiants invalides."
- [ ] Sidebar visible avec les liens de navigation
- [ ] Header affiche le sélecteur de plage et le bouton de déconnexion
- [ ] Logout efface le token et redirige vers `/login`
- [ ] Dark mode toggle fonctionne

## Pièges à éviter
- `zustand` doit être installé : `cd client && npm install zustand`
- Le proxy Vite `/api → localhost:3001` doit être actif (cf. `vite.config.ts` du prompt 01)
- L'intercepteur Axios redirige vers `/login` sur 401 — ne pas appeler `navigate()` depuis Axios (pas de hook React disponible) — utiliser `window.location.href`
