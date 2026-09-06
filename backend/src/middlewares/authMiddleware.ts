import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';
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
 * Runtime type guard asserting that an arbitrary decoded value satisfies {@link JwtPayload}.
 *
 * @param val - Unknown decoded payload to inspect.
 * @returns `true` if `val` contains valid string `id` and `username` properties.
 */
export function isJwtPayload(val: unknown): val is JwtPayload {
  if (typeof val !== 'object' || val === null) return false;
  const candidate = val as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.username === 'string';
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
    return next(new AppError('Unauthorized: Token missing or invalid format', 401, ErrorCode.UNAUTHORIZED));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new AppError('Unauthorized: Token missing or invalid format', 401, ErrorCode.UNAUTHORIZED));
  }

  try {
    const decoded: unknown = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!isJwtPayload(decoded)) {
      return next(new AppError('Unauthorized: Malformed token payload', 401, ErrorCode.UNAUTHORIZED));
    }
    req.user = decoded;
    next();
  } catch (_jwtErr) {
    // Treat any signature verification failure, expired token, or crypto error as 401 Unauthorized
    return next(new AppError('Unauthorized: Invalid or expired token', 401, ErrorCode.UNAUTHORIZED));
  }
};

