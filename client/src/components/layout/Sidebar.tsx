import { NavLink, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV = [
  { tab: '', label: "Vue d'ensemble", icon: LayoutDashboard },
  { tab: 'users', label: 'Utilisateurs', icon: Users },
  { tab: 'events', label: 'Événements', icon: Activity },
  { tab: 'stats', label: 'Statistiques', icon: BarChart2 },
];

export default function Sidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? '';

  return (
    <aside className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
        <span className="font-bold text-lg text-slate-900 dark:text-white">mood</span>
        <span className="ml-1 text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">admin</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => setSearchParams(tab ? { tab } : {})}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition w-full text-left',
              activeTab === tab
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
