import { Router } from 'express';
import { publicController } from '../controllers/publicController';

const router: Router = Router();

/**
 * @route GET /api/public/completed-games
 * @description Retrieves recent completed games with full step history for public exploration.
 * @access Public / Guest
 */
router.get(
  '/completed-games',
  (req, res, next) => publicController.getCompletedGames(req, res, next)
);

/**
 * @route GET /api/public/leaderboard
 * @description Retrieves global top player rankings based on lowest click count and completion time.
 * @access Public / Guest
 */
router.get(
  '/leaderboard',
  (req, res, next) => publicController.getLeaderboard(req, res, next)
);

export default router;
