import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';
import { JWT_SECRET } from '../config/env';

/**
 * User profile representation excluding sensitive password hash.
 */
export type UserProfile = Omit<User, 'password'>;

/**
 * Payload Data Transfer Object for user registration.
 */
export interface RegisterDTO {
  /** User email address (case-insensitive unique identifier). */
  email: string;
  /** Public display username (case-insensitive unique identifier). */
  username: string;
  /** Plaintext password to be hashed with bcrypt. */
  password: string;
}

/**
 * Payload Data Transfer Object for user authentication.
 */
export interface LoginDTO {
  /** Login identifier (email address or username). */
  login: string;
  /** Plaintext password to verify against stored hash. */
  password: string;
}

/**
 * Authentication response bundling signed JWT token and sanitized user profile.
 */
export interface AuthResponse {
  /** Signed JSON Web Token for Bearer authentication. */
  token: string;
  /** Sanitized user profile without password hash. */
  user: UserProfile;
}

/**
 * Strips password hash from User record.
 *
 * @param {User} user - Full user database record including hashed password.
 * @returns {UserProfile} User profile without password.
 */
export function sanitizeUser(user: User): UserProfile {
  const { password: _, ...profile } = user;
  return profile;
}

/**
 * Service managing user authentication, registration, and profile lookup.
 */
export class AuthService {
  /**
   * Registers a new user account and returns an access token.
   *
   * @param {RegisterDTO} dto - Registration payload with email, username, and password.
   * @returns {Promise<AuthResponse>} AuthResponse containing signed JWT and user profile.
   * @throws {AppError} 400 EMAIL_ALREADY_REGISTERED if email is already taken.
   * @throws {AppError} 400 USERNAME_ALREADY_TAKEN if username is already taken.
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
        throw new AppError('Email is already registered', 400, ErrorCode.EMAIL_ALREADY_REGISTERED);
      }
      throw new AppError('Username is already taken', 400, ErrorCode.USERNAME_ALREADY_TAKEN);
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
   * Authenticates user credentials and issues a signed JWT access token.
   *
   * @param {LoginDTO} dto - Login credentials payload containing username/email and password.
   * @returns {Promise<AuthResponse>} AuthResponse containing signed JWT and user profile.
   * @throws {AppError} 401 INVALID_CREDENTIALS if user is not found or password does not match.
   */
  public async login(dto: LoginDTO): Promise<AuthResponse> {
    const loginIdentifier = dto.login.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginIdentifier }, { username: dto.login.trim() }],
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new AppError('Invalid credentials', 401, ErrorCode.INVALID_CREDENTIALS);
    }

    return {
      token: this.generateToken(user.id, user.username),
      user: sanitizeUser(user),
    };
  }

  /**
   * Fetches user profile by user ID.
   *
   * @param {string} userId - Unique identifier (UUID) of the user.
   * @returns {Promise<UserProfile>} Sanitized user profile object.
   * @throws {AppError} 404 USER_NOT_FOUND if user does not exist.
   */
  public async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCode.USER_NOT_FOUND);
    return sanitizeUser(user);
  }

  /**
   * Generates signed JWT access token.
   *
   * @param {string} id - User ID payload.
   * @param {string} username - Username payload.
   * @returns {string} Signed JWT token string.
   */
  private generateToken(id: string, username: string): string {
    return jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
  }
}

/** Singleton instance of AuthService exported for route controllers. */
export const authService: AuthService = new AuthService();



