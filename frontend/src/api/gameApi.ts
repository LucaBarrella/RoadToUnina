import { apiClient } from './client';
import { ActiveGameResponse, Game } from '../types';

/**
 * API client module for active Wikipedia speedrun game endpoints.
 */
export const gameApi = {
  /**
   * Starts a new Wikipedia speedrun game session.
   *
   * @param overrideStartPage - Optional custom starting Wikipedia article title.
   * @returns Newly initialized Game session entity.
   */
  async startGame(overrideStartPage?: string): Promise<Game> {
    const payload = overrideStartPage ? { overrideStartPage } : {};
    const response = await apiClient.post<Game>('/games/start', payload);
    return response.data;
  },

  /**
   * Retrieves the current active game session and current Wikipedia page HTML content.
   *
   * @returns ActiveGameResponse payload or null if no session is currently active.
   */
  async getActiveGame(): Promise<ActiveGameResponse | null> {
    const response = await apiClient.get<ActiveGameResponse | null>('/games/active');
    return response.data;
  },

  /**
   * Navigates to a new target Wikipedia article within an active game session.
   *
   * @param gameId - Unique identifier of the active game session.
   * @param targetTitle - Title of the Wikipedia article link clicked by the user.
   * @returns Updated Game session entity.
   */
  async makeStep(gameId: string, targetTitle: string): Promise<Game> {
    const response = await apiClient.post<Game>(`/games/${gameId}/step`, { targetTitle });
    return response.data;
  },

  /**
   * Abandons and forfeits the specified game session.
   *
   * @param gameId - Unique identifier of the game session to abandon.
   * @returns Abandoned Game session entity.
   */
  async abandonGame(gameId: string): Promise<Game> {
    const response = await apiClient.post<Game>(`/games/${gameId}/abandon`);
    return response.data;
  },
};

export default gameApi;

