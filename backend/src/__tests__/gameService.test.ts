import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gameService, normalizeWikiTitle } from '../services/gameService';
import { wikiService } from '../services/wikiService';
import { prisma } from '../config/db';
import { GameStatus } from '@prisma/client';
import { AppError } from '../middlewares/errorMiddleware';

vi.mock('../services/wikiService');
vi.mock('../config/db', () => {
  const mockPrisma = {
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    game: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    gameStep: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    $transaction: vi.fn((cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

const mockedPrisma = prisma as unknown as {
  user: {
    update: ReturnType<typeof vi.fn>;
  };
  game: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  gameStep: {
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockedWikiService = wikiService as unknown as {
  getRandomWikiArticle: ReturnType<typeof vi.fn>;
  getWikiArticleContent: ReturnType<typeof vi.fn>;
};

describe('Title Normalization Utility', () => {
  it('should correctly normalize spaces, underscores, URI encoding and case', () => {
    expect(normalizeWikiTitle('Universit%C3%A0_degli_Studi_di_Napoli_Federico_II')).toBe(
      'università degli studi di napoli federico ii'
    );
    expect(normalizeWikiTitle('Napoli')).toBe('napoli');
    expect(normalizeWikiTitle('   Campania_   ')).toBe('campania');
  });

  it('should safely normalize malformed percent-encoding and non-ASCII Unicode diacritics', () => {
    // 1. Trigger the catch block in normalizeWikiTitle with invalid URI byte sequences
    const malformedUriSequence = 'Invalid%E0%A4%95_Article%80';
    expect(() => normalizeWikiTitle(malformedUriSequence)).not.toThrow();
    expect(normalizeWikiTitle(malformedUriSequence)).toBe('invalid%e0%a4%95 article%80');

    // 2. Italian grave/acute accents and foreign Unicode diacritics normalize symmetrically
    expect(normalizeWikiTitle('Niccolò_Machiavelli')).toBe('niccolò machiavelli');
    expect(normalizeWikiTitle('Niccol%C3%B2_Machiavelli')).toBe('niccolò machiavelli');
    expect(normalizeWikiTitle('São_Paulo')).toBe('são paulo');
    expect(normalizeWikiTitle('S%C3%A3o_Paulo')).toBe('são paulo');
    expect(normalizeWikiTitle('Zürich')).toBe('zürich');
  });
});

describe('GameService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWikiService.getRandomWikiArticle.mockResolvedValue('Vesuvio');
    mockedWikiService.getWikiArticleContent.mockResolvedValue({
      title: 'Vesuvio',
      htmlContent: '<p>Content</p>',
      validLinks: ['Napoli', 'Università degli Studi di Napoli Federico II', 'Capri', 'Campania'],
    });
  });

  describe('startGame', () => {
    it('should create a new game when user has no active games', async () => {
      mockedPrisma.game.findFirst.mockResolvedValueOnce(null);
      mockedWikiService.getRandomWikiArticle.mockResolvedValueOnce('Vesuvio');
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Vesuvio',
        htmlContent: '<p>Vesuvio</p>',
        validLinks: [],
      });

      const fakeGame = {
        id: 'game-123',
        userId: 'user-1',
        startPageTitle: 'Vesuvio',
        currentPageTitle: 'Vesuvio',
        targetPageTitle: 'Università degli Studi di Napoli Federico II',
        status: GameStatus.IN_PROGRESS,
        clickCount: 0,
        steps: [{ id: 'step-1', gameId: 'game-123', pageTitle: 'Vesuvio', stepOrder: 1 }],
      };

      mockedPrisma.game.create.mockResolvedValueOnce(fakeGame);
      mockedPrisma.gameStep.create.mockResolvedValueOnce({});
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(fakeGame);

      const result = await gameService.startGame('user-1');

      expect(result.game.id).toBe('game-123');
      expect(result.game.startPageTitle).toBe('Vesuvio');
      expect(result.currentArticle.title).toBe('Vesuvio');
    });

    it('should throw AppError 400 if user has an active game less than 24h old', async () => {
      mockedPrisma.game.findFirst.mockResolvedValueOnce({
        id: 'active-game',
        startTime: new Date(),
        status: GameStatus.IN_PROGRESS,
      });

      await expect(gameService.startGame('user-1')).rejects.toThrow(AppError);
    });

    it('should abandon old game (>24h) and start a new one', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockedPrisma.game.findFirst.mockResolvedValueOnce({
        id: 'old-game',
        startTime: oldDate,
        status: GameStatus.IN_PROGRESS,
      });
      mockedPrisma.game.update.mockResolvedValueOnce({});
      mockedWikiService.getRandomWikiArticle.mockResolvedValueOnce('Capri');
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Capri',
        htmlContent: '<p>Capri</p>',
        validLinks: [],
      });

      const fakeGame = {
        id: 'new-game',
        userId: 'user-1',
        startPageTitle: 'Capri',
        currentPageTitle: 'Capri',
        status: GameStatus.IN_PROGRESS,
        steps: [],
      };
      mockedPrisma.game.create.mockResolvedValueOnce(fakeGame);
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(fakeGame);

      const result = await gameService.startGame('user-1');
      expect(mockedPrisma.game.update).toHaveBeenCalledWith({
        where: { id: 'old-game' },
        data: { status: GameStatus.ABANDONED },
      });
      expect(result.game.id).toBe('new-game');
      expect(result.currentArticle.title).toBe('Capri');
    });

    it('should automatically re-roll start page if random selection matches target goal', async () => {
      mockedPrisma.game.findFirst.mockResolvedValueOnce(null);

      // First call returns target page (collision), second call returns a valid alternate start page
      mockedWikiService.getRandomWikiArticle
        .mockResolvedValueOnce('Università degli Studi di Napoli Federico II')
        .mockResolvedValueOnce('Capri');

      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Capri',
        htmlContent: '<p>Capri Content</p>',
        validLinks: ['Napoli'],
      });

      const fakeGame = {
        id: 'game-reroll-123',
        userId: 'user-1',
        startPageTitle: 'Capri',
        currentPageTitle: 'Capri',
        targetPageTitle: 'Università degli Studi di Napoli Federico II',
        status: GameStatus.IN_PROGRESS,
        clickCount: 0,
        steps: [{ id: 'step-1', gameId: 'game-reroll-123', pageTitle: 'Capri', stepOrder: 1 }],
      };

      mockedPrisma.game.create.mockResolvedValueOnce(fakeGame);
      mockedPrisma.gameStep.create.mockResolvedValueOnce({});
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(fakeGame);

      const result = await gameService.startGame('user-1');

      // Confirms collision guard triggered second call to avoid 0-click victory
      expect(mockedWikiService.getRandomWikiArticle).toHaveBeenCalledTimes(2);
      expect(result.game.startPageTitle).toBe('Capri');
      expect(result.currentArticle.title).toBe('Capri');
    });
  });

  describe('makeStep', () => {
    it('should make a valid non-winning step and update clickCount', async () => {
      const activeGame = {
        id: 'game-123',
        userId: 'user-1',
        currentPageTitle: 'Napoli',
        clickCount: 0,
        status: GameStatus.IN_PROGRESS,
        steps: [{ stepOrder: 1, pageTitle: 'Napoli' }],
      };

      mockedPrisma.game.findFirst.mockResolvedValue(activeGame);
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Napoli',
        htmlContent: '<p>Content</p>',
        validLinks: ['Vesuvio', 'Campania'],
      });
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Vesuvio',
        htmlContent: '<p>Vesuvio Content</p>',
        validLinks: [],
      });

      const updatedGame = {
        ...activeGame,
        currentPageTitle: 'Vesuvio',
        clickCount: 1,
        steps: [
          { stepOrder: 1, pageTitle: 'Napoli' },
          { stepOrder: 2, pageTitle: 'Vesuvio' },
        ],
      };
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(updatedGame);

      const result = await gameService.makeStep('user-1', 'game-123', 'Vesuvio');

      expect(result.game.clickCount).toBe(1);
      expect(result.game.currentPageTitle).toBe('Vesuvio');
      expect(result.currentArticle.title).toBe('Vesuvio');
      expect(mockedPrisma.game.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'game-123',
          userId: 'user-1',
          status: GameStatus.IN_PROGRESS,
          currentPageTitle: 'Napoli',
        },
        data: { currentPageTitle: 'Vesuvio', clickCount: { increment: 1 } },
      });
    });

    it('should throw AppError 400 when anti-cheat fails (invalid link)', async () => {
      const activeGame = {
        id: 'game-123',
        userId: 'user-1',
        currentPageTitle: 'Napoli',
        status: GameStatus.IN_PROGRESS,
        steps: [],
      };

      mockedPrisma.game.findFirst.mockResolvedValueOnce(activeGame);
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Napoli',
        htmlContent: '<p>Content</p>',
        validLinks: ['Vesuvio'],
      });

      await expect(gameService.makeStep('user-1', 'game-123', 'Milano')).rejects.toThrow(AppError);
    });

    it('should detect victory when reaching target page', async () => {
      const targetPage = 'Università degli Studi di Napoli Federico II';
      const activeGame = {
        id: 'game-123',
        userId: 'user-1',
        currentPageTitle: 'Napoli',
        clickCount: 2,
        status: GameStatus.IN_PROGRESS,
        steps: [{ stepOrder: 1, pageTitle: 'Napoli' }],
      };

      mockedPrisma.game.findFirst.mockResolvedValue(activeGame);
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Napoli',
        htmlContent: '<p>Content</p>',
        validLinks: [targetPage],
      });
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: targetPage,
        htmlContent: '<p>Unina Content</p>',
        validLinks: [],
      });

      const completedGame = {
        ...activeGame,
        currentPageTitle: targetPage,
        clickCount: 3,
        status: GameStatus.COMPLETED,
      };
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(completedGame);

      const result = await gameService.makeStep('user-1', 'game-123', targetPage);

      expect(result.game.status).toBe(GameStatus.COMPLETED);
      expect(result.currentArticle.title).toBe(targetPage);
      expect(mockedPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'game-123' }),
          data: expect.objectContaining({
            status: GameStatus.COMPLETED,
            clickCount: { increment: 1 },
          }),
        })
      );
    });

    it('should handle circular link navigation (backtracking to a previously visited page) correctly', async () => {
      // Game is currently at 'Vesuvio' (stepOrder 2, clickCount 1), having started from 'Napoli' (stepOrder 1)
      const activeGame = {
        id: 'game-123',
        userId: 'user-1',
        currentPageTitle: 'Vesuvio',
        clickCount: 1,
        status: GameStatus.IN_PROGRESS,
        steps: [
          { stepOrder: 1, pageTitle: 'Napoli' },
          { stepOrder: 2, pageTitle: 'Vesuvio' },
        ],
      };

      mockedPrisma.game.findFirst.mockResolvedValue(activeGame);
      // Current page 'Vesuvio' contains a link back to 'Napoli'
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Vesuvio',
        htmlContent: '<p>Vesuvio Content</p>',
        validLinks: ['Napoli', 'Pompei'],
      });
      // Target page content for returning to 'Napoli'
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Napoli',
        htmlContent: '<p>Napoli Content</p>',
        validLinks: ['Vesuvio'],
      });

      mockedPrisma.gameStep.count.mockResolvedValueOnce(2);

      const updatedGame = {
        ...activeGame,
        currentPageTitle: 'Napoli',
        clickCount: 2,
        steps: [
          { stepOrder: 1, pageTitle: 'Napoli' },
          { stepOrder: 2, pageTitle: 'Vesuvio' },
          { stepOrder: 3, pageTitle: 'Napoli' },
        ],
      };
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(updatedGame);

      const result = await gameService.makeStep('user-1', 'game-123', 'Napoli');

      // Verify clickCount incremented, title rewound, and stepOrder 3 records 'Napoli'
      expect(result.game.clickCount).toBe(2);
      expect(result.game.currentPageTitle).toBe('Napoli');
      expect(result.game.steps).toHaveLength(3);
      expect(result.game.steps[2]?.pageTitle).toBe('Napoli');
      expect(result.game.steps[2]?.stepOrder).toBe(3);

      expect(mockedPrisma.gameStep.create).toHaveBeenCalledWith({
        data: {
          gameId: 'game-123',
          pageTitle: 'Napoli',
          stepOrder: 3,
        },
      });
      expect(mockedPrisma.game.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'game-123',
          userId: 'user-1',
          status: GameStatus.IN_PROGRESS,
          currentPageTitle: 'Vesuvio',
        },
        data: { currentPageTitle: 'Napoli', clickCount: { increment: 1 } },
      });
    });

    it('should validate and advance step when target link uses non-ASCII characters and percent-encoding', async () => {
      const activeGame = {
        id: 'game-123',
        userId: 'user-1',
        currentPageTitle: 'Firenze',
        clickCount: 0,
        status: GameStatus.IN_PROGRESS,
        steps: [{ stepOrder: 1, pageTitle: 'Firenze' }],
      };

      mockedPrisma.game.findFirst.mockResolvedValue(activeGame);
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Firenze',
        htmlContent: '<p>Content</p>',
        validLinks: ['Niccolò Machiavelli', 'Arno'],
      });
      mockedWikiService.getWikiArticleContent.mockResolvedValueOnce({
        title: 'Niccolò Machiavelli',
        htmlContent: '<p>Machiavelli content</p>',
        validLinks: [],
      });

      const updatedGame = {
        ...activeGame,
        currentPageTitle: 'Niccolò Machiavelli',
        clickCount: 1,
        steps: [
          { stepOrder: 1, pageTitle: 'Firenze' },
          { stepOrder: 2, pageTitle: 'Niccolò Machiavelli' },
        ],
      };
      mockedPrisma.game.findUniqueOrThrow.mockResolvedValueOnce(updatedGame);

      // Client passes URL-encoded title with diacritics
      const result = await gameService.makeStep('user-1', 'game-123', 'Niccol%C3%B2_Machiavelli');

      expect(result.game.currentPageTitle).toBe('Niccolò Machiavelli');
      expect(result.game.clickCount).toBe(1);
      expect(mockedPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentPageTitle: 'Niccolò Machiavelli' }),
        })
      );
    });
  });

  describe('abandonGame', () => {
    it('should set game status to ABANDONED', async () => {
      const activeGame = {
        id: 'game-123',
        userId: 'user-1',
        status: GameStatus.IN_PROGRESS,
      };
      mockedPrisma.game.findFirst.mockResolvedValueOnce(activeGame);
      mockedPrisma.game.update.mockResolvedValueOnce({
        ...activeGame,
        status: GameStatus.ABANDONED,
      });

      const result = await gameService.abandonGame('user-1', 'game-123');

      expect(result.status).toBe(GameStatus.ABANDONED);
      expect(mockedPrisma.game.update).toHaveBeenCalledWith({
        where: { id: 'game-123' },
        data: { status: GameStatus.ABANDONED },
      });
    });

    it('should throw AppError 404 when attempting to abandon an already abandoned or non-existent game', async () => {
      mockedPrisma.game.findFirst.mockResolvedValue(null);

      await expect(gameService.abandonGame('user-1', 'invalid-or-already-abandoned-id')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Active game not found or unauthorized',
      });
      expect(mockedPrisma.game.update).not.toHaveBeenCalled();
    });
  });
});
