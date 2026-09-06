import { Router } from 'express';
import { z } from 'zod';
import { publicService, CompletedGameView, LeaderboardEntry } from '../services/publicService';
import { validateMiddleware } from '../middlewares/validateMiddleware';

/**
 * Zod validation schema for completed-games query parameters.
 */
export const completedGamesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Zod validation schema for leaderboard query parameters.
 */
export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const router: Router = Router();

/**
 * @route GET /api/public/completed-games
 * @description Retrieves recent completed games with full step history.
 * @access Public / Guest (200 OK)
 */
router.get(
  '/completed-games',
  validateMiddleware(completedGamesQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const limit = typeof req.query.limit === 'number' ? req.query.limit : undefined;
      const games: CompletedGameView[] = await publicService.getCompletedGames(limit);
      res.status(200).json(games);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/public/leaderboard
 * @description Retrieves global player leaderboard rankings.
 * @access Public / Guest (200 OK)
 */
router.get(
  '/leaderboard',
  validateMiddleware(leaderboardQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const limit = typeof req.query.limit === 'number' ? req.query.limit : undefined;
      const leaderboard: LeaderboardEntry[] = await publicService.getLeaderboard(limit);
      res.status(200).json(leaderboard);
    } catch (error) {
      next(error);
    }
  }
);

export default router;


