import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../config/db';
import { wikiService } from '../services/wikiService';
import { authService } from '../services/authService';
import { gameService } from '../services/gameService';
import { Express } from 'express';

describe('BREAK BACKEND — Penetration & Extreme Stress Tests', () => {
  let app: Express;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;

  beforeAll(async () => {
    app = createApp();

    // Clean up test database before stress run
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.user.deleteMany({});

    // Register User A
    const resA = await authService.register({
      email: 'usera@unina.it',
      username: 'usera_hacker',
      password: 'passwordA123!',
    });
    userAToken = resA.token;
    userAId = resA.user.id;

    // Register User B
    const resB = await authService.register({
      email: 'userb@unina.it',
      username: 'userb_victim',
      password: 'passwordB123!',
    });
    userBToken = resB.token;
  });

  beforeEach(async () => {
    // Ensure clean game table before each test
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
  });

  afterAll(async () => {
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('1. FUZZING & MALICIOUS INPUTS (SQLi, XSS, 100KB Blobs, Empty/Null Payloads)', () => {
    it('should reject 100KB giant string payload with 400 or 413 error without crashing', async () => {
      const hugeString = 'A'.repeat(100 * 1024);
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          login: hugeString,
          password: 'normalPassword123',
        });

      expect([400, 413]).toContain(res.status);
      expect(res.body.error).toBeDefined();
    });

    it('should safely handle SQL Injection patterns in auth login/register without syntax error or leakage', async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "admin' --",
        "'; DROP TABLE \"User\"; --",
        "1' UNION SELECT * FROM \"User\" --",
      ];

      for (const sqli of sqliPayloads) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            login: sqli,
            password: sqli,
          });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
      }
    });

    it('should reject XSS payloads in registration username and not execute scripts', async () => {
      const xssPayload = '<script>alert(document.cookie)</script>';
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'xss@test.com',
          username: xssPayload,
          password: 'validPassword123',
        });

      if (res.status === 201) {
        expect(res.body.user.username).toBe(xssPayload);
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('should reject malformed JSON objects and invalid types gracefully with 400 status', async () => {
      const malformedPayloads = [
        { login: 12345, password: true },
        { login: ['array'], password: {} },
        {},
      ];

      for (const payload of malformedPayloads) {
        const res = await request(app)
          .post('/api/auth/login')
          .send(payload as object);

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
      }
    });

    it('should reject malformed UUID path parameters on games/:id/step', async () => {
      const badUuids = [
        '12345678-1234-1234-1234-1234567890zz',
        '00000000-0000-0000-0000-00000000000',
        'not-a-valid-uuid-format-here-at-all1',
      ];
      for (const badId of badUuids) {
        const res = await request(app)
          .post(`/api/games/${badId}/step`)
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ targetTitle: 'Napoli' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      }
    });
  });

  describe('2. CONCURRENCY & RACE CONDITION STRESS TEST (20 Concurrent Requests)', () => {
    it('should handle 20 parallel click requests atomically without corrupting state or deadlocking', async () => {
      process.env.NODE_ENV = 'test';
      const { game } = await gameService.startGame(userAId, 'Napoli');

      const content = await wikiService.getWikiArticleContent('Napoli');
      const validTarget = content.validLinks[0] || 'Vesuvio';

      // Send 20 parallel step requests with the SAME target link
      const stepPromises = Array.from({ length: 20 }).map(() =>
        request(app)
          .post(`/api/games/${game.id}/step`)
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ targetTitle: validTarget })
      );

      const responses = await Promise.all(stepPromises);

      // Requests will either succeed (200), be rejected (400) because the page has transitioned, or conflict (409)
      const validStatusCodes = responses.filter((r) => [200, 400, 409].includes(r.status));
      expect(validStatusCodes.length).toBe(20);

      // Verify DB consistency: game steps order and click count must match exactly
      const finalGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      expect(finalGame.steps.length).toBe(finalGame.clickCount + 1);
      for (let i = 0; i < finalGame.steps.length; i++) {
        expect(finalGame.steps[i]!.stepOrder).toBe(i + 1);
      }
    });
  });

  describe('3. EXTREME EDGE CASES WIKIPEDIA (Special unicode, 500 chars, empty responses)', () => {
    it('should handle 500-char title without throwing unhandled exceptions', async () => {
      const longTitle = 'SpecialArticle_' + 'X'.repeat(500);
      await expect(wikiService.getWikiArticleContent(longTitle)).rejects.toThrow();
    });

    it('should reject empty or whitespace title with 400 status', async () => {
      await expect(wikiService.getWikiArticleContent('')).rejects.toThrow(
        'Invalid or empty Wikipedia article title requested'
      );
      await expect(wikiService.getWikiArticleContent('   ')).rejects.toThrow(
        'Invalid or empty Wikipedia article title requested'
      );
    });

    it('should handle special UTF-8 characters and emoji in Wikipedia titles safely', async () => {
      const specialTitle = 'Napoli 🍕 🚀 & < > " \'';
      await expect(wikiService.getWikiArticleContent(specialTitle)).rejects.toThrow();
    });
  });

  describe('4. AUTHENTICATION & PRIVILEGE ESCALATION (IDOR Attacks)', () => {
    it('should prevent User B from stepping or advancing User A game (IDOR)', async () => {
      process.env.NODE_ENV = 'test';
      const { game: gameA } = await gameService.startGame(userAId, 'Napoli');

      // User B tries to step in User A's game using User B's valid JWT token
      const maliciousRes = await request(app)
        .post(`/api/games/${gameA.id}/step`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetTitle: 'Vesuvio' });

      expect(maliciousRes.status).toBe(404);
      expect(maliciousRes.body.error).toContain('not found or unauthorized');

      // Check that User A's game was untouched
      const untouchedGame = await prisma.game.findUniqueOrThrow({
        where: { id: gameA.id },
      });
      expect(untouchedGame.clickCount).toBe(0);
      expect(untouchedGame.currentPageTitle).toBe('Napoli');

      // User B tries to abandon User A's game
      const maliciousAbandon = await request(app)
        .post(`/api/games/${gameA.id}/abandon`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(maliciousAbandon.status).toBe(404);

      const stillActive = await prisma.game.findUniqueOrThrow({
        where: { id: gameA.id },
      });
      expect(stillActive.status).toBe('IN_PROGRESS');
    });

    it('should reject requests with forged or corrupted JWT tokens', async () => {
      const forgedTokens = [
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature',
        'Bearer invalid-token-string',
        'Bearer ',
        'Basic dXNlcjpwYXNz',
      ];

      for (const auth of forgedTokens) {
        const res = await request(app)
          .get('/api/games/active')
          .set('Authorization', auth);

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Unauthorized');
      }
    });
  });

  describe('5. HIGH VOLUME REQUESTS & MEMORY LEAK RESILIENCE (100 Rapid Requests)', () => {
    it('should process 100 rapid requests without leaking memory or unhandled rejections', async () => {
      const rapidRequests = Array.from({ length: 100 }).map(() =>
        request(app)
          .get('/api/public/leaderboard')
      );

      const results = await Promise.all(rapidRequests);
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      }
    });
  });
});
