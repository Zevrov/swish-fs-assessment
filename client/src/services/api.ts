import axios, { AxiosError } from 'axios';
import { Filters, Market, FilterOptions } from '../types';

const API_BASE_URL = '/api';

// Single axios instance with a sensible default timeout. Without this an
// upstream that hangs (DB stall, mid-deploy 502 spinning, etc.) would leave
// the UI waiting indefinitely with the toggle button disabled.
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' }
});

/** A normalized error type so callers don't have to know about axios. */
export class ApiError extends Error {
  status: number | null;
  isNetwork: boolean;
  isTimeout: boolean;

  constructor(message: string, opts: { status?: number | null; isNetwork?: boolean; isTimeout?: boolean } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? null;
    this.isNetwork = !!opts.isNetwork;
    this.isTimeout = !!opts.isTimeout;
  }
}

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string }>) => {
    if (err.code === 'ECONNABORTED') {
      throw new ApiError('Request timed out', { isTimeout: true });
    }
    if (!err.response) {
      // No response from the server — true network failure.
      throw new ApiError('Network error', { isNetwork: true });
    }
    const serverMessage = err.response.data?.error ?? err.message;
    throw new ApiError(serverMessage, { status: err.response.status });
  }
);

export interface MarketsListResponse {
  data: Market[];
  count: number;
}

export const api = {
  async getMarkets(params?: Partial<Filters>): Promise<MarketsListResponse> {
    const response = await http.get<MarketsListResponse>('/markets', { params });
    return response.data;
  },

  async getFilterOptions(): Promise<FilterOptions> {
    const response = await http.get<{ success: boolean; data: FilterOptions }>('/markets/filterOptions');
    return response.data.data;
  },

  async updateManualSuspension(marketId: number, suspended: boolean | null): Promise<Market> {
    const response = await http.put<{ success: boolean; data: Market }>(
      `/markets/${marketId}/suspension`,
      { suspended }
    );
    return response.data.data;
  }
};
