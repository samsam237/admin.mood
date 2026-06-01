import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: Props) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-slate-600 dark:text-slate-400">
      <span>{total.toLocaleString()} résultats</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <ChevronLeft size={16} />
        </button>
        <span>Page {page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
