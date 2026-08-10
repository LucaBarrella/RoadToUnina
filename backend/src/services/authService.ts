import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';

/**
 * Public profile data of a User without sensitive password hash.
 */
export type UserProfile = Omit<User, 'password'>;

/**
 * Payload interface for user registration.
 */
export interface RegisterDTO {
  /**
   * User's unique email address.
   */
  email: string;

  /**
   * User's unique public username.
   */
  username: string;

  /**
   * User's raw plaintext password.
   */
  password: string;
}

/**
 * Payload interface for user login.
 */
export interface LoginDTO {
  /**
   * User's email or username identifier.
   */
  login: string;

  /**
   * User's raw plaintext password.
   */
  password: string;
}

/**
 * Interface for auth response containing token and sanitized user details.
 */
export interface AuthResponse {
  /**
   * Signed JWT access token.
   */
  token: string;

  /**
   * User profile data excluding the password hash.
   */
  user: UserProfile;
}

/**
 * Strips the password hash from a Prisma User record.
 *
 * @param {User} user - Complete Prisma user entity.
 * @returns {UserProfile} Sanitized user profile.
 */
export function sanitizeUser(user: User): UserProfile {
  const { password: _, ...profile } = user;
  return profile;
}

/**
 * Service managing user authentication, registration, password hashing, and token generation.
 */
export class AuthService {
  /**
   * Registers a new user with a bcrypt-hashed password and generates a signed JWT token.
   *
   * @param {RegisterDTO} dto - User registration credentials.
   * @returns {Promise<AuthResponse>} Auth response containing token and user profile.
   * @throws {AppError} 400 Bad Request if email or username is already taken.
   *
   * @example
   * const auth = await authService.register({ email: 'a@b.com', username: 'user', password: 'secretpassword' });
   */
  public async register(dto: RegisterDTO): Promise<AuthResponse> {
    const normalizedEmail: string = dto.email.toLowerCase().trim();
    const normalizedUsername: string = dto.username.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === normalizedEmail) {
        throw new AppError('Email is already registered', 400);
      }
      throw new AppError('Username is already taken', 400);
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

    const token = this.generateToken(user.id, user.username);

    return {
      token,
      user: sanitizeUser(user),
    };
  }

  /**
   * Authenticates a user with email/username and password.
   *
   * @param {LoginDTO} dto - User login credentials.
   * @returns {Promise<AuthResponse>} Auth response containing token and user profile.
   * @throws {AppError} 401 Unauthorized if credentials do not match any user.
   *
   * @example
   * const auth = await authService.login({ login: 'user@example.com', password: 'secretpassword' });
   */
  public async login(dto: LoginDTO): Promise<AuthResponse> {
    const loginIdentifier: string = dto.login.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { username: dto.login.trim() },
        ],
      },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = this.generateToken(user.id, user.username);

    return {
      token,
      user: sanitizeUser(user),
    };
  }

  /**
   * Retrieves profile details for a given user ID without password hash.
   *
   * @param {string} userId - User unique identifier.
   * @returns {Promise<UserProfile>} User profile record.
   * @throws {AppError} 404 Not Found if user does not exist.
   *
   * @example
   * const profile = await authService.getProfile('uuid-123');
   */
  public async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return sanitizeUser(user);
  }

  /**
   * Generates a signed JWT access token.
   *
   * @param {string} id - User ID.
   * @param {string} username - User username.
   * @returns {string} Signed JWT token.
   * @private
   */
  private generateToken(id: string, username: string): string {
    const secret: string = process.env.JWT_SECRET || 'default_secret';
    return jwt.sign({ id, username }, secret, { expiresIn: '7d' });
  }
}

export const authService: AuthService = new AuthService();
