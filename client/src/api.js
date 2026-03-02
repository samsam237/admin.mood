const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function headers(useAuth = true) {
  const h = { 'Content-Type': 'application/json' };
  if (useAuth && getToken()) h['Authorization'] = 'Bearer ' + getToken();
  return h;
}

export async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Connexion échouée');
  return data;
}

export async function getOverview() {
  const res = await fetch(`${API}/overview`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getAnalytics(days = 30) {
  const res = await fetch(`${API}/analytics?days=${days}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getKpis(days = 30) {
  const res = await fetch(`${API}/kpis?days=${days}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getRetention() {
  const res = await fetch(`${API}/retention`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getUserSegments() {
  const res = await fetch(`${API}/users/segments`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getUsers(page = 1, limit = 50, segment = '', q = '') {
  const params = new URLSearchParams({ page, limit });
  if (segment) params.set('segment', segment);
  if (q) params.set('q', q);
  const res = await fetch(`${API}/users?${params}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getEventTrends(days = 30) {
  const res = await fetch(`${API}/events/trends?days=${days}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getAlerts() {
  const res = await fetch(`${API}/alerts`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function markAlertRead(id) {
  const res = await fetch(`${API}/alerts/${id}/read`, {
    method: 'PATCH',
    headers: headers(),
  });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur mise à jour');
  return res.json();
}

export async function exportReport() {
  const res = await fetch(`${API}/export/report`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function getBackupList() {
  const res = await fetch(`${API}/backup`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getAdminUserBackups(limit = 50, offset = 0) {
  const res = await fetch(`${API}/admin/user-backups?limit=${limit}&offset=${offset}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function runBackup() {
  const res = await fetch(`${API}/backup`, { method: 'POST', headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur backup');
  return res.json();
}

export async function getEvents(page = 1, limit = 50, filters = {}) {
  const params = new URLSearchParams({ page, limit });
  if (filters.type) params.set('type', filters.type);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.days) params.set('days', filters.days);
  const res = await fetch(`${API}/events?${params}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getStats(page = 1, limit = 50, opts = {}) {
  const params = new URLSearchParams({ page, limit });
  if (opts.days) params.set('days', opts.days);
  if (opts.userId) params.set('userId', opts.userId);
  const res = await fetch(`${API}/stats?${params}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function exportCsv(type, paramsObj = null) {
  const qs = paramsObj ? `?${new URLSearchParams(paramsObj)}` : '';
  const res = await fetch(`${API}/export/${type}${qs}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getUserDetail(userId, days = 90) {
  const res = await fetch(`${API}/admin/users/${encodeURIComponent(userId)}?days=${days}`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (res.status === 404) throw new Error('Utilisateur introuvable');
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

export async function getHealth() {
  const res = await fetch(`${API}/health`, { headers: headers() });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('Erreur health');
  return res.json();
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/';
}

