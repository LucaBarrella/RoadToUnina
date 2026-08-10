import { Request, Response, NextFunction } from 'express';
import { publicService, CompletedGameView, LeaderboardEntry } from '../services/publicService';

/**
 * Controller handling public endpoints accessible without authentication (leaderboard and completed game trails).
 */
export class PublicController {
  /**
   * Returns a list of recently completed games including player info and step sequences.
   *
   * @param {Request} req - Express request object with optional `limit` query param.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async getCompletedGames(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawLimit = req.query.limit;
      const limit: number = typeof rawLimit === 'string' ? Math.max(1, parseInt(rawLimit, 10) || 20) : 20;
      const games: CompletedGameView[] = await publicService.getCompletedGames(limit);
      res.status(200).json(games);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns global leaderboard rankings ordered by lowest clicks and fastest time.
   *
   * @param {Request} req - Express request object with optional `limit` query param.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawLimit = req.query.limit;
      const limit: number = typeof rawLimit === 'string' ? Math.max(1, parseInt(rawLimit, 10) || 50) : 50;
      const leaderboard: LeaderboardEntry[] = await publicService.getLeaderboard(limit);
      res.status(200).json(leaderboard);
    } catch (error) {
      next(error);
    }
  }
}

export const publicController: PublicController = new PublicController();
