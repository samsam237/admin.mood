import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RangeContext = createContext(null);

function readStoredDays() {
  const raw = localStorage.getItem('rangeDays');
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 7 && n <= 365) return n;
  return 30;
}

export function RangeProvider({ children }) {
  const [days, setDays] = useState(() => readStoredDays());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    localStorage.setItem('rangeDays', String(days));
  }, [days]);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo(
    () => ({ days, setDays, autoRefresh, setAutoRefresh, refreshKey, triggerRefresh }),
    [days, autoRefresh, refreshKey, triggerRefresh]
  );

  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}

export function useRange() {
  const ctx = useContext(RangeContext);
  if (!ctx) throw new Error('useRange doit être utilisé dans un RangeProvider');
  return ctx;
}
