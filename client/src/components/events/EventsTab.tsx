import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { getEvents, exportCsv } from '../../lib/api';
import { truncateId } from '../../lib/utils';
import { useRange } from '../../hooks/useRange';
import type { Event } from '../../types';
import Pagination from '../ui/Pagination';

export default function EventsTab() {
  const { days } = useRange();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');

  const { data } = useQuery({
    queryKey: ['events', page, type, days],
    queryFn: () => getEvents({ page, limit: 50, type: type || undefined, days }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          placeholder="Filtrer par type…"
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={() => exportCsv('events', { days: String(days), type })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 dark:border-slate-700">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {(data?.data ?? []).map((e: Event) => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-mono">
                    {e.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{truncateId(e.userId)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(e.timestamp).toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && <Pagination page={page} total={data.total} limit={50} onChange={setPage} />}
    </div>
  );
}
