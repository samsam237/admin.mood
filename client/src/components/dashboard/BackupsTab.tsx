import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getAdminBackups, createBackup } from '../../lib/api';
import Pagination from '../ui/Pagination';

function fmtBytes(b: number): string {
  if (!b) return '—';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
}

export default function BackupsTab() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: backups } = useQuery({
    queryKey: ['admin-backups', page],
    queryFn: () => getAdminBackups(page, 50),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-backups'] }),
  });

  const list = (backups as { data?: Record<string, unknown>[] })?.data ?? [];
  const total = (backups as { total?: number })?.total ?? 0;

  return (
    <div className="space-y-6">

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">💾 Sauvegardes utilisateurs</h3>
            <p className="text-xs text-slate-400 mt-0.5">Backups des données mobiles envoyés par l'application MOOD.</p>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {mutation.isPending ? 'En cours…' : '+ Créer un backup'}
          </button>
        </div>

        {list.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">Aucune sauvegarde utilisateur enregistrée.</p>
            <p className="text-xs mt-1">Les backups apparaissent quand l'application mobile synchronise ses données.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-700">
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Backup ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Taille</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {list.map((b) => (
                <tr key={String(b.backupId)} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{String(b.userId ?? '').slice(0, 16)}…</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{String(b.backupId ?? '').slice(0, 16)}…</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(String(b.createdAt)).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtBytes(Number(b.sizeBytes ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {backups && <Pagination page={page} total={total} limit={50} onChange={setPage} />}
    </div>
  );
}
