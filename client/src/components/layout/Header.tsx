import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Moon, Sun, RefreshCw } from 'lucide-react';
import { getAlerts, getHealth, markAlertRead } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useRange } from '../../hooks/useRange';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../types';

export default function Header() {
  const { logout, username } = useAuth();
  const { days, setDays } = useRange();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    refetchInterval: 30_000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const isHealthy = (health as { status?: string })?.status === 'ok';

  useQuery({
    queryKey: ['auto-refresh-tick'],
    queryFn: async () => {
      queryClient.invalidateQueries();
      return null;
    },
    refetchInterval: autoRefresh ? 30_000 : false,
    enabled: autoRefresh,
  });

  const unread = (alerts as Alert[]).filter((a) => !a.isRead).length;

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(!dark);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleManualRefresh = () => queryClient.invalidateQueries();

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-3">

      <div className="flex gap-1">
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

      <div className="flex-1" />

      <div className="flex items-center gap-1.5" title={isHealthy ? 'Serveur OK' : 'Serveur inaccessible'}>
        <span className="relative flex h-2.5 w-2.5">
          {isHealthy && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline">
          {isHealthy ? 'API' : 'Hors ligne'}
        </span>
      </div>

      <button
        onClick={handleManualRefresh}
        title="Rafraîchir"
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
      >
        <RefreshCw size={16} />
      </button>

      <button
        onClick={() => setAutoRefresh(!autoRefresh)}
        title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
          autoRefresh
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
            : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        {autoRefresh ? '30s ●' : '30s ○'}
      </button>

      <div className="relative">
        <button
          onClick={() => {
            refetchAlerts();
            if (unread > 0) {
              (alerts as Alert[]).filter((a) => !a.isRead).forEach((a) => markAlertRead(a.id));
            }
          }}
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

      <button onClick={toggleDark} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <span className="text-sm text-slate-600 dark:text-slate-400">{username}</span>

      <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
        <LogOut size={18} />
      </button>
    </header>
  );
}
