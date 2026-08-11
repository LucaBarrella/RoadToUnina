import { apiClient } from './client';
import { CompletedGame, LeaderboardEntry } from '../types';

/**
 * API client module for public rankings and game history endpoints.
 */
export const publicApi = {
  /**
   * Retrieves recent completed games with full path step history.
   *
   * @param limit - Optional maximum number of completed game records to return.
   * @returns Array of CompletedGame records.
   */
  async getCompletedGames(limit?: number): Promise<CompletedGame[]> {
    const response = await apiClient.get<CompletedGame[]>('/public/completed-games', {
      params: limit ? { limit } : undefined,
    });
    return response.data;
  },

  /**
   * Retrieves the global leaderboard ranking top players by click count and duration.
   *
   * @param limit - Optional maximum number of leaderboard entries to return.
   * @returns Array of LeaderboardEntry records.
   */
  async getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
    const response = await apiClient.get<LeaderboardEntry[]>('/public/leaderboard', {
      params: limit ? { limit } : undefined,
    });
    return response.data;
  },
};

export default publicApi;

