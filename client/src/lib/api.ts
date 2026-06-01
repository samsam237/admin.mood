import axios, { AxiosError } from 'axios';
import type { Alert } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

export const login = (username: string, password: string) =>
  api.post<{ token: string; username: string }>('/auth/login', { username, password });

export const getOverview = () => api.get('/overview').then((r) => r.data);
export const getKpis = (days: number) => api.get(`/kpis?days=${days}`).then((r) => r.data);
export const getAnalytics = (days: number) => api.get(`/analytics?days=${days}`).then((r) => r.data);
export const getRetention = () => api.get('/retention').then((r) => r.data);
export const getSegments = () => api.get('/users/segments').then((r) => r.data);
export const getEventTrends = (days: number) => api.get(`/events/trends?days=${days}`).then((r) => r.data);

export const getUsers = (params: Record<string, unknown>) =>
  api.get('/users', { params }).then((r) => r.data);
export const getUserDetail = (userId: string, days: number) =>
  api.get(`/admin/users/${userId}?days=${days}`).then((r) => r.data);

export const getEvents = (params: Record<string, unknown>) =>
  api.get('/events', { params }).then((r) => r.data);
export const getStats = (params?: Record<string, unknown>) =>
  api.get('/stats', { params }).then((r) => r.data);

export const getAdminBackups = (page = 1, limit = 50) =>
  api.get('/admin/backups', { params: { page, limit } }).then((r) => r.data);

export const createBackup = () =>
  api.post('/admin/backups').then((r) => r.data);

export const getAlerts = () => api.get<Alert[]>('/alerts').then((r) => r.data);
export const markAlertRead = (id: number) => api.patch(`/alerts/${id}/read`);

export const exportCsv = (type: string, params?: Record<string, unknown>) => {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  window.location.href = `/api/export/${type}${qs}`;
};
export const exportReport = () => { window.location.href = '/api/export/report'; };

export const getHealth = () => api.get('/health').then((r) => r.data);

export default api;
