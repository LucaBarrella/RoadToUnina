import { Request, Response, NextFunction } from 'express';
import { gameService, GameWithSteps, ActiveGameResponse } from '../services/gameService';
import { Game } from '@prisma/client';
import { AppError } from '../middlewares/errorMiddleware';

/**
 * Controller handling user game sessions, active game state, step navigation, and abandonment.
 */
export class GameController {
  /**
   * Starts a new Wikipedia speedrun game for the authenticated user.
   *
   * @param {Request} req - Express request object with optional `overrideStartPage` in body.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 201 response is sent.
   */
  public async startGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized: User session missing', 401);
      }

      const { overrideStartPage } = (req.body || {}) as { overrideStartPage?: string };
      const activeGame: ActiveGameResponse = await gameService.startGame(userId, overrideStartPage);
      res.status(201).json(activeGame);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves the current active IN_PROGRESS game session for the authenticated user.
   *
   * @param {Request} req - Express request object with user session.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async getActiveGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized: User session missing', 401);
      }

      const activeGame: ActiveGameResponse | null = await gameService.getActiveGame(userId);
      res.status(200).json(activeGame);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Executes a step navigation in the active game.
   *
   * @param {Request} req - Express request object containing game id param and `targetTitle` body.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async makeStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized: User session missing', 401);
      }

      const gameId = String(req.params.id);
      const { targetTitle } = req.body as { targetTitle: string };
      const activeGame: ActiveGameResponse = await gameService.makeStep(userId, gameId, targetTitle);
      res.status(200).json(activeGame);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Abandons an active game session for the user.
   *
   * @param {Request} req - Express request object with game id parameter.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async abandonGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized: User session missing', 401);
      }

      const gameId = String(req.params.id);
      const game: Game = await gameService.abandonGame(userId, gameId);
      res.status(200).json(game);
    } catch (error) {
      next(error);
    }
  }
}

export const gameController: GameController = new GameController();
