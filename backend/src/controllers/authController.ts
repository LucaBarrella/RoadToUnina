import { Request, Response, NextFunction } from 'express';
import { authService, AuthResponse, UserProfile } from '../services/authService';
import { AppError } from '../middlewares/errorMiddleware';

/**
 * Controller handling user authentication, login, registration, and profile retrieval.
 */
export class AuthController {
  /**
   * Handles user registration request and returns a JWT token alongside public user profile.
   *
   * @param {Request} req - Express request object containing registration body.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 201 response is sent.
   */
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result: AuthResponse = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles user authentication and issues a JWT token.
   *
   * @param {Request} req - Express request object containing login credentials.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result: AuthResponse = await authService.login(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves profile details for the currently authenticated user session.
   *
   * @param {Request} req - Express request object with populated `req.user`.
   * @param {Response} res - Express response object.
   * @param {NextFunction} next - Express next function to handle errors.
   * @returns {Promise<void>} Resolves when HTTP 200 response is sent.
   */
  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized: User session missing', 401);
      }

      const user: UserProfile = await authService.getProfile(userId);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
}

export const authController: AuthController = new AuthController();
