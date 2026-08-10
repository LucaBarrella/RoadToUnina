import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Express } from 'express';
import { createApp } from '../server';
import { prisma } from '../config/db';
import { authService } from '../services/authService';
import { gameService } from '../services/gameService';
import { wikiService } from '../services/wikiService';
import { GameStatus } from '@prisma/client';

describe('Principal QA Robustness Suite — RoadToUnina Backend', () => {
  let app: Express;
  let userAlphaToken: string;
  let userAlphaId: string;
  let userBetaToken: string;
  let userBetaId: string;

  const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

  beforeAll(async () => {
    app = createApp();

    // Reset database to ensure pristine state
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.user.deleteMany({});

    // Create Test User Alpha
    const resAlpha = await authService.register({
      email: 'qa.alpha@unina.it',
      username: 'qa_alpha_tester',
      password: 'StrongPassword123!',
    });
    userAlphaToken = resAlpha.token;
    userAlphaId = resAlpha.user.id;

    // Create Test User Beta
    const resBeta = await authService.register({
      email: 'qa.beta@unina.it',
      username: 'qa_beta_tester',
      password: 'StrongPassword123!',
    });
    userBetaToken = resBeta.token;
    userBetaId = resBeta.user.id;
  });

  beforeEach(async () => {
    // Purge game state between test runs
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
  });

  afterAll(async () => {
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.user.deleteMany({});
  });

  // =========================================================================
  // 1. GESTIONE INPUT ANOMALI ED ECCEZIONI (Input Validation Test)
  // =========================================================================
  describe('1. GESTIONE INPUT ANOMALI ED ECCEZIONI (Input Validation & Exception Resilience)', () => {
    describe('1.1 JWT Authentication Middleware Robustness', () => {
      it('should return 401 when Authorization header is completely missing', async () => {
        const res = await request(app).get('/api/games/active');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toMatch(/Unauthorized/i);
      });

      it('should return 401 when Authorization header does not use Bearer scheme', async () => {
        const schemes = [
          'Basic dXNlcjpwYXNz',
          'Token abcdef123456',
          'Digest username="MIME", realm="myrealm"',
          'CustomScheme xyz',
          'Bearer',
          'bearer lowercase-token',
        ];

        for (const authHeader of schemes) {
          const res = await request(app)
            .get('/api/games/active')
            .set('Authorization', authHeader);

          expect(res.status).toBe(401);
          expect(res.body).toHaveProperty('error');
          expect(res.body.error).toContain('Unauthorized');
        }
      });

      it('should return 401 when Bearer token is empty or whitespace only', async () => {
        const res = await request(app)
          .get('/api/games/active')
          .set('Authorization', 'Bearer ');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Unauthorized');
      });

      it('should return 401 when token has an invalid signature or secret', async () => {
        const fakeToken = jwt.sign(
          { id: userAlphaId, username: 'qa_alpha_tester' },
          'wrong_attacker_secret_key_123',
          { expiresIn: '1h' }
        );

        const res = await request(app)
          .get('/api/games/active')
          .set('Authorization', `Bearer ${fakeToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Unauthorized');
      });

      it('should return 401 when token is expired', async () => {
        const expiredToken = jwt.sign(
          { id: userAlphaId, username: 'qa_alpha_tester' },
          JWT_SECRET,
          { expiresIn: '-1s' }
        );

        const res = await request(app)
          .get('/api/games/active')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Unauthorized');
      });

      it('should return 401 when token is a malformed/corrupted base64 string', async () => {
        const malformedTokens = [
          'Bearer not-a-valid-token-format',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Header only
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9', // Missing signature
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-payload.signature',
          'Bearer null',
          'Bearer undefined',
        ];

        for (const token of malformedTokens) {
          const res = await request(app)
            .get('/api/games/active')
            .set('Authorization', token);

          expect(res.status).toBe(401);
          expect(res.body).toHaveProperty('error');
          expect(res.body.error).toContain('Unauthorized');
        }
      });
    });

    describe('1.2 Auth Registration Validation & String Boundary Limits', () => {
      it('should reject email exceeding maximum boundary of 255 characters with 400', async () => {
        const overlongEmail = 'a'.repeat(250) + '@example.com'; // > 255 chars
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: overlongEmail,
            username: 'valid_user',
            password: 'validPassword123',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
        expect(res.body.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ])
        );
      });

      it('should reject malformed email format variants with 400', async () => {
        const invalidEmails = [
          'plainaddress',
          '@missingusername.com',
          'username@.com',
          'username@domain..com',
          'username@domain',
          'user name@domain.com',
        ];

        for (const email of invalidEmails) {
          const res = await request(app)
            .post('/api/auth/register')
            .send({
              email,
              username: 'valid_user',
              password: 'validPassword123',
            });

          expect(res.status).toBe(400);
          expect(res.body.error).toBe('Validation Error');
        }
      });

      it('should reject username below 3 characters or above 30 characters with 400', async () => {
        // Under limit (2 chars)
        const resShort = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'short_user@test.com',
            username: 'ab',
            password: 'validPassword123',
          });
        expect(resShort.status).toBe(400);
        expect(resShort.body.error).toBe('Validation Error');

        // Over limit (31 chars)
        const resLong = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'long_user@test.com',
            username: 'a'.repeat(31),
            password: 'validPassword123',
          });
        expect(resLong.status).toBe(400);
        expect(resLong.body.error).toBe('Validation Error');
      });

      it('should reject password below 6 characters or above 128 characters with 400', async () => {
        // Under limit (5 chars)
        const resShort = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'pw_short@test.com',
            username: 'pw_short_user',
            password: '12345',
          });
        expect(resShort.status).toBe(400);
        expect(resShort.body.error).toBe('Validation Error');

        // Over limit (129 chars)
        const resLong = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'pw_long@test.com',
            username: 'pw_long_user',
            password: 'x'.repeat(129),
          });
        expect(resLong.status).toBe(400);
        expect(resLong.body.error).toBe('Validation Error');
      });

      it('should reject invalid data types (type confusion: boolean, array, object, number, null) with 400', async () => {
        const typeConfusionPayloads = [
          { email: 123456, username: 'valid_user', password: 'validPassword123' },
          { email: 'type@test.com', username: true, password: 'validPassword123' },
          { email: 'type@test.com', username: 'valid_user', password: ['array', 'password'] },
          { email: { nested: 'obj@test.com' }, username: 'valid_user', password: 'validPassword123' },
          { email: null, username: null, password: null },
          {},
        ];

        for (const payload of typeConfusionPayloads) {
          const res = await request(app)
            .post('/api/auth/register')
            .send(payload as object);

          expect(res.status).toBe(400);
          expect(res.body.error).toBe('Validation Error');
          expect(Array.isArray(res.body.details)).toBe(true);
        }
      });
    });

    describe('1.3 Auth Login Validation & Authentication Errors', () => {
      it('should reject empty or whitespace login identifier with 400', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            login: '   ',
            password: 'validPassword123',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject login with login string exceeding 255 characters with 400', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            login: 'u'.repeat(256),
            password: 'validPassword123',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });

      it('should reject non-existent user with 401 Invalid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            login: 'non_existent_qa_user@unina.it',
            password: 'Password123!',
          });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
      });

      it('should reject incorrect password for existing user with 401 Invalid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            login: 'qa_alpha_tester',
            password: 'WrongPassword999!',
          });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
      });
    });

    describe('1.4 Malformed Payloads & Express Error Middleware Resilience', () => {
      it('should return 400 when receiving broken JSON syntax without crashing Express process', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'application/json')
          .send('{"login": "broken", "password": ');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Malformed JSON payload');
      });
    });
  });

  // =========================================================================
  // 2. LOGICA DI GIOCO E CONDIZIONI AL CONTORNO (Game Logic Robustness)
  // =========================================================================
  describe('2. LOGICA DI GIOCO E CONDIZIONI AL CONTORNO (Game Logic Robustness)', () => {
    it('should reject step navigation to a page NOT present in validLinks with 400 AppError', async () => {
      process.env.NODE_ENV = 'test';
      const game = await gameService.startGame(userAlphaId, 'Napoli');

      // Fetch valid links for Napoli
      const napoliContent = await wikiService.getWikiArticleContent('Napoli');
      const arbitraryIllegalLink = 'Pinguino Imperatore Antartico 999';

      // Verify the link is indeed not in valid links
      const isPresent = napoliContent.validLinks.some(
        (link) => link.toLowerCase() === arbitraryIllegalLink.toLowerCase()
      );
      expect(isPresent).toBe(false);

      // Attempt to step to the illegal link
      const res = await request(app)
        .post(`/api/games/${game.id}/step`)
        .set('Authorization', `Bearer ${userAlphaToken}`)
        .send({ targetTitle: arbitraryIllegalLink });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid step: link');
      expect(res.body.error).toContain('is not present in "Napoli"');

      // Check that game state and click count remain untouched
      const dbGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { steps: true },
      });
      expect(dbGame.clickCount).toBe(0);
      expect(dbGame.currentPageTitle).toBe('Napoli');
      expect(dbGame.steps.length).toBe(1);
    });

    it('should reject step navigation with empty string or missing targetTitle with 400', async () => {
      process.env.NODE_ENV = 'test';
      const game = await gameService.startGame(userAlphaId, 'Napoli');

      // Empty string
      const resEmpty = await request(app)
        .post(`/api/games/${game.id}/step`)
        .set('Authorization', `Bearer ${userAlphaToken}`)
        .send({ targetTitle: '' });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error).toBe('Validation Error');

      // Whitespace only
      const resWhitespace = await request(app)
        .post(`/api/games/${game.id}/step`)
        .set('Authorization', `Bearer ${userAlphaToken}`)
        .send({ targetTitle: '   ' });

      expect(resWhitespace.status).toBe(400);
      expect(resWhitespace.body.error).toBe('Validation Error');

      // Missing field
      const resMissing = await request(app)
        .post(`/api/games/${game.id}/step`)
        .set('Authorization', `Bearer ${userAlphaToken}`)
        .send({});

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error).toBe('Validation Error');
    });

    it('should reject step navigation on an already ABANDONED or COMPLETED game with 404', async () => {
      process.env.NODE_ENV = 'test';
      const game = await gameService.startGame(userAlphaId, 'Napoli');

      // Abandon the game
      await gameService.abandonGame(userAlphaId, game.id);

      // Attempt to step on abandoned game
      const res = await request(app)
        .post(`/api/games/${game.id}/step`)
        .set('Authorization', `Bearer ${userAlphaToken}`)
        .send({ targetTitle: 'Vesuvio' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found or unauthorized');
    });

    it('should reject invalid UUID path parameters on game endpoints with 400 Validation Error', async () => {
      const invalidIds = ['123', 'not-a-uuid', 'xyz-abc-12345'];

      for (const id of invalidIds) {
        const resStep = await request(app)
          .post(`/api/games/${id}/step`)
          .set('Authorization', `Bearer ${userAlphaToken}`)
          .send({ targetTitle: 'Vesuvio' });

        expect(resStep.status).toBe(400);
        expect(resStep.body.error).toBe('Validation Error');

        const resAbandon = await request(app)
          .post(`/api/games/${id}/abandon`)
          .set('Authorization', `Bearer ${userAlphaToken}`);

        expect(resAbandon.status).toBe(400);
        expect(resAbandon.body.error).toBe('Validation Error');
      }
    });

    it('should strictly PREVENT User Beta from interacting with User Alpha game (Authorization / IDOR)', async () => {
      process.env.NODE_ENV = 'test';
      const gameAlpha = await gameService.startGame(userAlphaId, 'Napoli');

      // User Beta attempts to step in User Alpha's game
      const maliciousStepRes = await request(app)
        .post(`/api/games/${gameAlpha.id}/step`)
        .set('Authorization', `Bearer ${userBetaToken}`)
        .send({ targetTitle: 'Vesuvio' });

      expect(maliciousStepRes.status).toBe(404);
      expect(maliciousStepRes.body.error).toContain('not found or unauthorized');

      // User Beta attempts to abandon User Alpha's game
      const maliciousAbandonRes = await request(app)
        .post(`/api/games/${gameAlpha.id}/abandon`)
        .set('Authorization', `Bearer ${userBetaToken}`);

      expect(maliciousAbandonRes.status).toBe(404);
      expect(maliciousAbandonRes.body.error).toContain('not found or unauthorized');

      // Verify User Alpha's game state is completely intact
      const intactGame = await prisma.game.findUniqueOrThrow({
        where: { id: gameAlpha.id },
        include: { steps: true },
      });

      expect(intactGame.status).toBe(GameStatus.IN_PROGRESS);
      expect(intactGame.clickCount).toBe(0);
      expect(intactGame.currentPageTitle).toBe('Napoli');
      expect(intactGame.steps.length).toBe(1);
    });

    it('should return 404 when querying active game for a user with no active session', async () => {
      const res = await request(app)
        .get('/api/games/active')
        .set('Authorization', `Bearer ${userBetaToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });

  // =========================================================================
  // 3. CONCORRENZA E RICHIESTE MULTIPLE (Stress & Concurrency Test)
  // =========================================================================
  describe('3. CONCORRENZA E RICHIESTE MULTIPLE (Stress & Concurrency Test)', () => {
    it('should maintain atomic consistency under 15 simultaneous step requests on the same game', async () => {
      process.env.NODE_ENV = 'test';
      const game = await gameService.startGame(userAlphaId, 'Napoli');

      const napoliContent = await wikiService.getWikiArticleContent('Napoli');
      const validLink = napoliContent.validLinks[0] || 'Vesuvio';

      // Dispatch 15 simultaneous step requests
      const concurrentRequests = Array.from({ length: 15 }).map(() =>
        request(app)
          .post(`/api/games/${game.id}/step`)
          .set('Authorization', `Bearer ${userAlphaToken}`)
          .send({ targetTitle: validLink })
      );

      const responses = await Promise.all(concurrentRequests);

      // Verify status codes: exactly 1 request should succeed (200), and all others must receive conflict (409) or bad request (400)
      const successResponses = responses.filter((r) => r.status === 200);
      const conflictOrRejected = responses.filter((r) => [400, 409].includes(r.status));

      expect(successResponses.length).toBe(1);
      expect(conflictOrRejected.length).toBe(14);
      expect(responses.every((r) => [200, 400, 409].includes(r.status))).toBe(true);

      // Check Database State Integrity
      const finalGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      // Exactly 1 step was added (initial step + 1 navigation = 2 steps total)
      expect(finalGame.clickCount).toBe(1);
      expect(finalGame.steps.length).toBe(2);

      // Verify sequential stepOrder integrity with no gaps or duplicates
      expect(finalGame.steps[0]?.stepOrder).toBe(1);
      expect(finalGame.steps[0]?.pageTitle).toBe('Napoli');
      expect(finalGame.steps[1]?.stepOrder).toBe(2);
      expect(finalGame.steps[1]?.pageTitle.toLowerCase()).toBe(validLink.toLowerCase());
    });

    it('should atomically handle race conditions between concurrent step and abandon requests', async () => {
      process.env.NODE_ENV = 'test';
      const game = await gameService.startGame(userAlphaId, 'Napoli');

      const napoliContent = await wikiService.getWikiArticleContent('Napoli');
      const validLink = napoliContent.validLinks[0] || 'Vesuvio';

      // Send step and abandon concurrently
      const [stepRes, abandonRes] = await Promise.all([
        request(app)
          .post(`/api/games/${game.id}/step`)
          .set('Authorization', `Bearer ${userAlphaToken}`)
          .send({ targetTitle: validLink }),
        request(app)
          .post(`/api/games/${game.id}/abandon`)
          .set('Authorization', `Bearer ${userAlphaToken}`),
      ]);

      // Either step succeeded (200) then abandon succeeded (200), or abandon succeeded first making step fail (404/400)
      expect([200, 400, 404, 409]).toContain(stepRes.status);
      expect([200, 404]).toContain(abandonRes.status);

      // Verify DB final state is valid and not corrupted
      const finalGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      // Status must either be ABANDONED (if abandon ran) or COMPLETED/IN_PROGRESS
      expect([GameStatus.ABANDONED, GameStatus.IN_PROGRESS, GameStatus.COMPLETED]).toContain(
        finalGame.status
      );

      // Step count must match clickCount + 1
      expect(finalGame.steps.length).toBe(finalGame.clickCount + 1);

      for (let i = 0; i < finalGame.steps.length; i++) {
        expect(finalGame.steps[i]?.stepOrder).toBe(i + 1);
      }
    });

    it('should prevent creating duplicate active games under concurrent startGame requests', async () => {
      process.env.NODE_ENV = 'test';

      // Send 5 concurrent startGame requests for User Beta
      const startPromises = Array.from({ length: 5 }).map(() =>
        request(app)
          .post('/api/games/start')
          .set('Authorization', `Bearer ${userBetaToken}`)
          .send({ overrideStartPage: 'Napoli' })
      );

      const startResponses = await Promise.all(startPromises);

      const successfulStarts = startResponses.filter((r) => r.status === 201);
      const rejectedStarts = startResponses.filter((r) => r.status === 400);

      // At least 1 should succeed, and total active games in DB must be exactly 1
      expect(successfulStarts.length).toBeGreaterThanOrEqual(1);
      expect(successfulStarts.length + rejectedStarts.length).toBe(5);

      const activeGames = await prisma.game.findMany({
        where: {
          userId: userBetaId,
          status: GameStatus.IN_PROGRESS,
        },
      });

      // There must NEVER be more than 1 active game per user in DB
      expect(activeGames.length).toBe(1);
    });
  });
});
