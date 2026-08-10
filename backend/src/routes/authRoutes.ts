import { Router } from 'express';
import { z, ZodType } from 'zod';
import { authController } from '../controllers/authController';
import { validateMiddleware } from '../middlewares/validateMiddleware';
import { authMiddleware } from '../middlewares/authMiddleware';
import { RegisterDTO, LoginDTO } from '../services/authService';

/**
 * Zod validation schema for user registration payload.
 * Enforces string limits to prevent memory abuse or giant payload attacks.
 */
export const registerSchema: ZodType<RegisterDTO> = z.object({
  email: z
    .string()
    .trim()
    .max(255, 'Email cannot exceed 255 characters')
    .email('Invalid email address format'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username cannot exceed 30 characters'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
});

/**
 * Zod validation schema for user login payload.
 * Enforces max string length limits to prevent bcrypt CPU starvation attacks.
 */
export const loginSchema: ZodType<LoginDTO> = z.object({
  login: z
    .string()
    .trim()
    .min(1, 'Email or username is required')
    .max(255, 'Login cannot exceed 255 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password cannot exceed 128 characters'),
});

const router: Router = Router();

/**
 * @route POST /api/auth/register
 * @description Registers a new user account.
 * @access Public
 */
router.post(
  '/register',
  validateMiddleware(registerSchema, 'body'),
  (req, res, next) => authController.register(req, res, next)
);

/**
 * @route POST /api/auth/login
 * @description Authenticates user and issues a JWT token.
 * @access Public
 */
router.post(
  '/login',
  validateMiddleware(loginSchema, 'body'),
  (req, res, next) => authController.login(req, res, next)
);

/**
 * @route GET /api/auth/me
 * @description Fetches profile details of the authenticated user.
 * @access Protected
 */
router.get(
  '/me',
  authMiddleware,
  (req, res, next) => authController.me(req, res, next)
);

export default router;
