import { Router } from 'express';
import { publicService, CompletedGameView, LeaderboardEntry } from '../services/publicService';

const router: Router = Router();

/**
 * @route GET /api/public/completed-games
 * @description Retrieves recent completed games with full step history.
 * @access Public / Guest (200 OK)
 */
router.get('/completed-games', async (req, res, next) => {
  try {
    const rawLimit = req.query.limit;
    const limit: number =
      typeof rawLimit === 'string'
        ? Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20))
        : 20;
    const games: CompletedGameView[] = await publicService.getCompletedGames(limit);
    res.status(200).json(games);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/public/leaderboard
 * @description Retrieves global player leaderboard rankings.
 * @access Public / Guest (200 OK)
 */
router.get('/leaderboard', async (req, res, next) => {
  try {
    const rawLimit = req.query.limit;
    const limit: number =
      typeof rawLimit === 'string'
        ? Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 50))
        : 50;
    const leaderboard: LeaderboardEntry[] = await publicService.getLeaderboard(limit);
    res.status(200).json(leaderboard);
  } catch (error) {
    next(error);
  }
});

export default router;


