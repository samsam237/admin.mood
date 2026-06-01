export interface AdminJwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface KpiMetric {
  value: number;
  trend: number;
}
