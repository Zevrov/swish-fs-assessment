import axios from 'axios';
import { Market, FilterOptions } from '../types';

const API_BASE_URL = '/api';

export const api = {
  async getMarkets(params?: any): Promise<{ data: Market[]; count: number }> {
    const response = await axios.get(`${API_BASE_URL}/markets`, { params });
    return response.data;
  },

  async getFilterOptions(): Promise<FilterOptions> {
    const response = await axios.get(`${API_BASE_URL}/markets/filterOptions`);
    return response.data.data;
  },

  async updateManualSuspension(marketId: number, suspended: boolean | null): Promise<boolean> {
    const response = await axios.put(`${API_BASE_URL}/markets/${marketId}/suspension`, {
      suspended
    });
    return response.data.success;
  }
};
