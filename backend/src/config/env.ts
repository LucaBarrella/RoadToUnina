import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Validates and exports mandatory environment variables.
 * Fails fast during application boot if critical secrets are missing or insecure.
 */
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';

export const PORT = parseInt(process.env.PORT || '3001', 10);

export const JWT_SECRET = (() => {
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

export const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/roadtounina?schema=public';

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:80'];
