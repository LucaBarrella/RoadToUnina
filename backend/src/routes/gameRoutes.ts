import { Router } from 'express';
import { z } from 'zod';
import { gameController } from '../controllers/gameController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validateMiddleware } from '../middlewares/validateMiddleware';

/**
 * Zod validation schema for optional start game override parameter.
 */
export const startGameSchema = z.object({
  overrideStartPage: z.string().optional(),
});

/**
 * Zod validation schema for game route UUID path parameters.
 */
export const gameIdParamSchema = z.object({
  id: z.string().uuid('Invalid game ID format'),
});

/**
 * Zod validation schema for step navigation request payload.
 */
export const makeStepSchema = z.object({
  targetTitle: z.string().trim().min(1, 'Target Wikipedia page title is required'),
});

const router: Router = Router();

// Apply JWT authentication guard to all game endpoints
router.use(authMiddleware);

/**
 * @route POST /api/games/start
 * @description Starts a new Wikipedia speedrun game session.
 * @access Protected
 */
router.post(
  '/start',
  validateMiddleware(startGameSchema, 'body'),
  (req, res, next) => gameController.startGame(req, res, next)
);

/**
 * @route GET /api/games/active
 * @description Retrieves current active game state and HTML for authenticated user.
 * @access Protected
 */
router.get(
  '/active',
  (req, res, next) => gameController.getActiveGame(req, res, next)
);

/**
 * @route POST /api/games/:id/step
 * @description Navigates to a linked Wikipedia target article.
 * @access Protected
 */
router.post(
  '/:id/step',
  validateMiddleware(gameIdParamSchema, 'params'),
  validateMiddleware(makeStepSchema, 'body'),
  (req, res, next) => gameController.makeStep(req, res, next)
);

/**
 * @route POST /api/games/:id/abandon
 * @description Abandons and forfeits an active game session.
 * @access Protected
 */
router.post(
  '/:id/abandon',
  validateMiddleware(gameIdParamSchema, 'params'),
  (req, res, next) => gameController.abandonGame(req, res, next)
);

export default router;
