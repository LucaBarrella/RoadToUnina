import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Validates and exports mandatory environment variables.
 * Fails fast during application boot if critical secrets are missing or insecure.
 */
/** Current runtime execution environment (development, production, or test). */
export const NODE_ENV: string = process.env.NODE_ENV || 'development';

/** Flag indicating whether the application is running in production mode. */
export const IS_PRODUCTION: boolean = NODE_ENV === 'production';

/** Flag indicating whether the application is running in automated test mode (Vitest). */
export const IS_TEST: boolean = NODE_ENV === 'test';

/** HTTP port number the backend Express server binds to. */
export const PORT: number = parseInt(process.env.PORT || '3001', 10);

/**
 * Secret key used to sign and verify JSON Web Tokens (minimum 32 characters).
 * @throws {Error} If missing or shorter than 32 characters in non-test mode.
 */
export const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (IS_TEST) {
      return 'test_super_secret_jwt_key_at_least_32_characters_long_for_vitest';
    }
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  if (secret.length < 32) {
    if (IS_TEST) {
      return 'test_super_secret_jwt_key_at_least_32_characters_long_for_vitest';
    }
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long.');
  }
  return secret;
})();

/** PostgreSQL connection string URL for Prisma client. */
export const DATABASE_URL: string =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/roadtounina?schema=public';

/** Whitelist of permitted CORS client origins. */
export const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:80'];
