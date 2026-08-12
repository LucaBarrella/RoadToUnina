import express, { Express } from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import { Server } from 'http';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import authRoutes from './routes/authRoutes';
import gameRoutes from './routes/gameRoutes';
import publicRoutes from './routes/publicRoutes';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { prisma } from './config/db';

dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Rate limiter for authentication routes (login / register) to mitigate brute force attacks.
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many authentication attempts, please try again later.' },
});

/**
 * Rate limiter for game step and action routes to prevent automated macro spamming.
 */
export const gameLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 120 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many game actions, please slow down.' },
});

/**
 * Global rate limiter for public unauthenticated discovery routes.
 */
export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many public requests, please try again later.' },
});

/**
 * Creates the CORS middleware configuration matching configured ALLOWED_ORIGINS.
 *
 * @returns {CorsOptions} The evaluated CORS configuration object.
 */
function createCorsOptions(): CorsOptions {
  const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow if explicit match or wildcard
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
        return;
      }

      // Allow any Vercel deployment (production or preview branch)
      if (
        origin.endsWith('.vercel.app') ||
        origin === 'https://road-to-unina.vercel.app'
      ) {
        callback(null, true);
        return;
      }

      // Allow localhost
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS Policy: Origin ${origin} not allowed`));
    },
    credentials: true,
  };
}

/**
 * Initializes and configures the Express application instance.
 * Sets up Helmet security headers, CORS origin verification, Rate Limiters, JSON body parser,
 * route mounting, and the centralized error handling middleware.
 *
 * @returns {Express} Fully configured Express application instance.
 */
export const createApp = (): Express => {
  const app: Express = express();

  // Apply HTTP Gzip / Deflate payload compression
  app.use(compression());

  // Apply Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Allow Wikipedia asset rendering
    })
  );

  // Apply CORS
  app.use(cors(createCorsOptions()));

  // JSON Body Parser
  app.use(express.json());

  // Mount API routers with targeted rate limiters
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/games', gameLimiter, gameRoutes);
  app.use('/api/public', publicLimiter, publicRoutes);

  // Centralized Error Middleware
  app.use(errorMiddleware);

  return app;
};

/**
 * Gracefully terminates server process and closes Prisma SQLite database connection pool.
 *
 * @param {Server} [server] - Optional running HTTP server instance to close.
 * @returns {Promise<void>}
 */
export const gracefulShutdown = async (server?: Server): Promise<void> => {
  console.log('\n⏳ Gracefully shutting down RoadToUnina server...');
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma DB connection pool disconnected.');
  } catch (err) {
    console.error('❌ Error disconnecting Prisma:', err);
  }

  if (server) {
    server.close(() => {
      console.log('👋 HTTP server closed.');
      process.exit(0);
    });
    return;
  }

  process.exit(0);
};

/**
 * Starts the Express HTTP server listening on the configured environment port.
 *
 * @returns {Server} The running HTTP server instance.
 */
export const startServer = (): Server => {
  const app: Express = createApp();
  const PORT: number = parseInt(process.env.PORT || '3001', 10);

  const server: Server = app.listen(PORT, () => {
    console.log(`🚀 RoadToUnina Backend Server running on port ${PORT}`);
  });

  process.on('SIGINT', () => gracefulShutdown(server));
  process.on('SIGTERM', () => gracefulShutdown(server));

  return server;
};

if (require.main === module) {
  startServer();
}
