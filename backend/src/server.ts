import express, { Express } from 'express';
import cors from 'cors';
import { Server } from 'http';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import authRoutes from './routes/authRoutes';
import gameRoutes from './routes/gameRoutes';
import publicRoutes from './routes/publicRoutes';
import { errorMiddleware, AppError } from './middlewares/errorMiddleware';
import { prisma } from './config/db';
import { IS_PRODUCTION, IS_TEST, PORT, ALLOWED_ORIGINS } from './config/env';

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 50 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

export const gameLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 120 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many game actions, please slow down.' },
});

export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many public requests, please try again later.' },
});

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server) with no origin header
    if (!origin) {
      return callback(null, true);
    }

    // Check exact whitelist
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // In local development/test, allow localhost and 127.0.0.1 variants
    if (!IS_PRODUCTION) {
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
    }

    callback(new AppError(`CORS Policy: Origin ${origin} is not permitted`, 403, 'CORS_NOT_ALLOWED'));
  },
  credentials: true,
};

export const createApp = (): Express => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors(corsOptions));
  app.use(express.json());

  // Health check endpoint (lightweight, zero DB overhead for cloud orchestrators / Render)
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/games', gameLimiter, gameRoutes);
  app.use('/api/public', publicLimiter, publicRoutes);

  // 404 JSON fallback for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
    });
  });

  app.use(errorMiddleware);
  return app;
};

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

export const startServer = (): Server => {
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`🚀 RoadToUnina Backend Server running on port ${PORT}`);
  });

  process.on('SIGINT', () => gracefulShutdown(server));
  process.on('SIGTERM', () => gracefulShutdown(server));

  return server;
};

if (require.main === module) {
  startServer();
}


