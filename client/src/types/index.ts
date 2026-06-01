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
