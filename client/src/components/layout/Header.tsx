import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Moon, Sun } from 'lucide-react';
import { getAlerts, markAlertRead } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useRange } from '../../hooks/useRange';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../types';

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

  const unread = (alerts as Alert[]).filter((a) => !a.isRead).length;

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(!dark);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-4">
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

      <div className="relative">
        <button
          onClick={() => {
            refetch();
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
