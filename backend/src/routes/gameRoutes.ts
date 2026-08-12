import { Router } from 'express';
import { z } from 'zod';
import { gameService, ActiveGameResponse } from '../services/gameService';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validateMiddleware } from '../middlewares/validateMiddleware';
import { AppError } from '../middlewares/errorMiddleware';

/** Zod schema for game start payload. */
export const startGameSchema = z.object({
  overrideStartPage: z.string().trim().max(300, 'Article title cannot exceed 300 characters').optional(),
});

/** Zod schema for game UUID path parameter. */
export const gameIdParamSchema = z.object({
  id: z.string().uuid('Invalid game ID format'),
});

/** Zod schema for game step navigation payload. */
export const makeStepSchema = z.object({
  targetTitle: z
    .string()
    .trim()
    .min(1, 'Target Wikipedia page title is required')
    .max(300, 'Target Wikipedia page title cannot exceed 300 characters'),
});

const router: Router = Router();
router.use(authMiddleware);

/**
 * @route POST /api/games/start
 * @description Starts a new speedrun game session.
 * @access Protected (201 Created / 400 Bad Request / 401 Unauthorized)
 */
router.post('/start', validateMiddleware(startGameSchema, 'body'), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized: User session missing', 401);
    const { overrideStartPage } = (req.body || {}) as { overrideStartPage?: string };
    const activeGame: ActiveGameResponse = await gameService.startGame(userId, overrideStartPage);
    res.status(201).json(activeGame);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/games/active
 * @description Retrieves current IN_PROGRESS game session and HTML.
 * @access Protected (200 OK / 401 Unauthorized)
 */
router.get('/active', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized: User session missing', 401);
    const activeGame = await gameService.getActiveGame(userId);
    res.status(200).json(activeGame);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/games/:id/step
 * @description Navigates to a target Wikipedia article link.
 * @access Protected (200 OK / 400 Bad Request / 404 Not Found / 409 Conflict)
 */
router.post(
  '/:id/step',
  validateMiddleware(gameIdParamSchema, 'params'),
  validateMiddleware(makeStepSchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized: User session missing', 401);
      const gameId = String(req.params.id);
      const { targetTitle } = req.body as { targetTitle: string };
      const activeGame = await gameService.makeStep(userId, gameId, targetTitle);
      res.status(200).json(activeGame);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/games/:id/abandon
 * @description Forfeits/abandons an active game.
 * @access Protected (200 OK / 404 Not Found)
 */
router.post(
  '/:id/abandon',
  validateMiddleware(gameIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized: User session missing', 401);
      const gameId = String(req.params.id);
      const game = await gameService.abandonGame(userId, gameId);
      res.status(200).json(game);
    } catch (error) {
      next(error);
    }
  }
);

export default router;


