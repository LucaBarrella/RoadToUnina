import { Router } from 'express';
import { z, ZodType } from 'zod';
import { authService, RegisterDTO, LoginDTO, AuthResponse, UserProfile } from '../services/authService';
import { validateMiddleware } from '../middlewares/validateMiddleware';
import { authMiddleware } from '../middlewares/authMiddleware';
import { AppError } from '../middlewares/errorMiddleware';

/** Zod validation schema for registration payload. */
export const registerSchema: ZodType<RegisterDTO> = z.object({
  email: z.string().trim().max(255, 'Email cannot exceed 255 characters').email('Invalid email address format'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters long').max(30, 'Username cannot exceed 30 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters long').max(128, 'Password cannot exceed 128 characters'),
});

/** Zod validation schema for login payload. */
export const loginSchema: ZodType<LoginDTO> = z.object({
  login: z.string().trim().min(1, 'Email or username is required').max(255, 'Login cannot exceed 255 characters'),
  password: z.string().min(1, 'Password is required').max(128, 'Password cannot exceed 128 characters'),
});

const router: Router = Router();

/**
 * @route POST /api/auth/register
 * @description Registers a new user account.
 * @access Public (201 Created / 400 Bad Request)
 */
router.post('/register', validateMiddleware(registerSchema, 'body'), async (req, res, next) => {
  try {
    const result: AuthResponse = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/login
 * @description Authenticates user and returns JWT token.
 * @access Public (200 OK / 401 Unauthorized)
 */
router.post('/login', validateMiddleware(loginSchema, 'body'), async (req, res, next) => {
  try {
    const result: AuthResponse = await authService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/auth/me
 * @description Retrieves current authenticated user profile.
 * @access Protected (200 OK / 401 Unauthorized / 404 Not Found)
 */
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized: User session missing', 401);
    const user: UserProfile = await authService.getProfile(userId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;


