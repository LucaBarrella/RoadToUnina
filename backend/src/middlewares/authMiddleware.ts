import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorMiddleware';
import { JWT_SECRET } from '../config/env';

/**
 * Payload decoded from a verified JSON Web Token.
 */
export interface JwtPayload {
  /**
   * Unique identifier of the authenticated user.
   */
  id: string;

  /**
   * Username of the authenticated user.
   */
  username: string;
}

/**
 * JWT Authentication Guard Middleware.
 * Extracts the Bearer token from the `Authorization` header, verifies its cryptographic signature
 * using `JWT_SECRET`, and attaches the decoded user payload to `req.user`.
 *
 * @param {Request} req - Express Request object containing the Authorization header.
 * @param {Response} _res - Express Response object (unused in auth guard).
 * @param {NextFunction} next - Express NextFunction to delegate to next middleware or error handler.
 * @returns {void}
 * @throws {AppError} 401 Unauthorized if header is absent, malformed, or signature is invalid/expired.
 *
 * @example
 * router.get('/protected', authMiddleware, controller.handler);
 */
export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Token missing or invalid format', 401));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new AppError('Unauthorized: Token missing or invalid format', 401));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    return next(new AppError('Unauthorized: Invalid or expired token', 401));
  }
};

