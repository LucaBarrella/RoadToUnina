import express, { Express } from 'express';
import cors from 'cors';
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

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 50 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

export const gameLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 120 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many game actions, please slow down.' },
});

export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many public requests, please try again later.' },
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      origin.endsWith('.vercel.app') ||
      origin === 'https://road-to-unina.vercel.app' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS Policy: Origin ${origin} not allowed`));
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

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/games', gameLimiter, gameRoutes);
  app.use('/api/public', publicLimiter, publicRoutes);

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
  const PORT = parseInt(process.env.PORT || '3001', 10);
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

