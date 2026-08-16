import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';

/** User profile representation excluding sensitive password hash. */
export type UserProfile = Omit<User, 'password'>;

/** Payload DTO for user registration. */
export interface RegisterDTO {
  email: string;
  username: string;
  password: string;
}

/** Payload DTO for user authentication. */
export interface LoginDTO {
  login: string;
  password: string;
}

/** Auth response bundling signed JWT token and user profile. */
export interface AuthResponse {
  token: string;
  user: UserProfile;
}

/**
 * Strips password hash from User record.
 * @param user Full user entity.
 * @returns User profile without password.
 */
export function sanitizeUser(user: User): UserProfile {
  const { password: _, ...profile } = user;
  return profile;
}

/** Service managing user authentication, registration, and profile lookup. */
export class AuthService {
  /**
   * Registers a new user account and returns an access token.
   * @param dto Registration payload.
   * @returns AuthResponse with JWT and profile.
   * @throws AppError 400 if email or username is already taken.
   */
  public async register(dto: RegisterDTO): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === normalizedEmail) {
        throw new AppError('Email is already registered', 400, 'EMAIL_ALREADY_REGISTERED');
      }
      throw new AppError('Username is already taken', 400, 'USERNAME_ALREADY_TAKEN');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
      },
    });

    return {
      token: this.generateToken(user.id, user.username),
      user: sanitizeUser(user),
    };
  }

  /**
   * Authenticates user credentials and issues a JWT token.
   * @param dto Login credentials payload.
   * @returns AuthResponse with JWT and profile.
   * @throws AppError 401 if credentials are invalid.
   */
  public async login(dto: LoginDTO): Promise<AuthResponse> {
    const loginIdentifier = dto.login.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginIdentifier }, { username: dto.login.trim() }],
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    return {
      token: this.generateToken(user.id, user.username),
      user: sanitizeUser(user),
    };
  }

  /**
   * Fetches user profile by user ID.
   * @param userId User ID.
   * @returns User profile.
   * @throws AppError 404 if user not found.
   */
  public async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    return sanitizeUser(user);
  }

  /** Generates signed JWT access token. */
  private generateToken(id: string, username: string): string {
    const secret = process.env.JWT_SECRET || 'default_secret';
    return jwt.sign({ id, username }, secret, { expiresIn: '7d' });
  }
}

export const authService = new AuthService();


