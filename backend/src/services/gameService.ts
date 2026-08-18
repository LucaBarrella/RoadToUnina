import { Game, GameStep, GameStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { wikiService, WikiArticleContent } from './wikiService';
import { AppError } from '../middlewares/errorMiddleware';

/** Composite Game entity type with ordered steps. */
export type GameWithSteps = Game & { steps: GameStep[] };

/** Response structure containing active game session and Wikipedia page HTML. */
export interface ActiveGameResponse {
  game: GameWithSteps;
  currentArticle: WikiArticleContent;
}

/** Target page title for game completion. */
export const TARGET_PAGE_TITLE = 'Università degli Studi di Napoli Federico II';
/** Game inactivity timeout threshold in hours. */
export const EXPIRATION_HOURS = 24;

/**
 * Normalizes Wikipedia article title for strict comparison.
 * @param title Raw title string.
 * @returns Normalized lowercase title.
 */
export function normalizeWikiTitle(title: string): string {
  try {
    return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase();
  } catch {
    return title.replace(/_/g, ' ').trim().toLowerCase();
  }
}

/**
 * Checks if a game session has expired (>24 hours of inactivity).
 * @param lastActivity Date of last activity (updatedAt).
 * @returns True if expired.
 */
export function isGameExpired(lastActivity: Date): boolean {
  return (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60) > EXPIRATION_HOURS;
}

/** Service managing game session lifecycle, anti-cheat validation, and step progression. */
export class GameService {
  /**
   * Starts a new game session for the user.
   * @param userId Authenticated user ID.
   * @param overrideStartPage Optional start page for testing.
   * @returns Active game session and starting article content.
   * @throws AppError 400 if user has an active non-expired game.
   */
  public async startGame(userId: string, overrideStartPage?: string): Promise<ActiveGameResponse> {
    let rawStartTitle = overrideStartPage?.trim() || await wikiService.getRandomWikiArticle();
    
    // Edge case guard: Ensure start article is not identical to target goal
    if (normalizeWikiTitle(rawStartTitle) === normalizeWikiTitle(TARGET_PAGE_TITLE)) {
      rawStartTitle = await wikiService.getRandomWikiArticle();
    }

    const currentArticle = await wikiService.getWikiArticleContent(rawStartTitle);
    const startTitle = currentArticle.title || rawStartTitle;

    const createdGame = await prisma.$transaction(
      async (tx) => {
        // Acquire row lock on user record to serialize concurrent startGame requests in READ COMMITTED
        if (tx.user?.update) {
          try {
            await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
          } catch {}
        }

        const existingGame = await tx.game.findFirst({
          where: { userId, status: GameStatus.IN_PROGRESS },
        });

        if (existingGame) {
          if (!isGameExpired(existingGame.updatedAt || existingGame.startTime)) {
            throw new AppError('User already has an active game in progress', 400, 'ACTIVE_GAME_EXISTS');
          }
          await tx.game.update({
            where: { id: existingGame.id },
            data: { status: GameStatus.ABANDONED },
          });
        }

        const game = await tx.game.create({
          data: {
            userId,
            startPageTitle: startTitle,
            currentPageTitle: startTitle,
            targetPageTitle: TARGET_PAGE_TITLE,
            status: GameStatus.IN_PROGRESS,
            clickCount: 0,
          },
        });

        await tx.gameStep.create({
          data: { gameId: game.id, pageTitle: startTitle, stepOrder: 1 },
        });

        return tx.game.findUniqueOrThrow({
          where: { id: game.id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
      },
      { timeout: 10000 }
    );

    return { game: createdGame, currentArticle };
  }

  /**
   * Fetches active game for user with rendered article content.
   * @param userId Authenticated user ID.
   * @returns Active game response or null if none active.
   */
  public async getActiveGame(userId: string): Promise<ActiveGameResponse | null> {
    const game = await prisma.game.findFirst({
      where: { userId, status: GameStatus.IN_PROGRESS },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!game) return null;

    if (isGameExpired(game.updatedAt || game.startTime)) {
      await prisma.game.update({ where: { id: game.id }, data: { status: GameStatus.ABANDONED } });
      return null;
    }

    try {
      const currentArticle = await wikiService.getWikiArticleContent(game.currentPageTitle);
      return { game, currentArticle };
    } catch {
      await prisma.game.update({ where: { id: game.id }, data: { status: GameStatus.ABANDONED } });
      return null;
    }
  }

  /**
   * Performs a step navigation in the current game.
   * @param userId Authenticated user ID.
   * @param gameId Game ID.
   * @param targetTitle Target article title clicked.
   * @returns Updated game session and target article HTML.
   * @throws AppError 404 if game not found, 400 if link invalid (anti-cheat), 409 on race condition.
   */
  public async makeStep(userId: string, gameId: string, targetTitle: string): Promise<ActiveGameResponse> {
    const normalizedTarget = normalizeWikiTitle(targetTitle);

    const game = await prisma.game.findFirst({
      where: { id: gameId, userId, status: GameStatus.IN_PROGRESS },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!game) throw new AppError('Active game not found or unauthorized', 404, 'GAME_NOT_FOUND');

    const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);
    const isLinkValid = currentContent.validLinks.some(link => normalizeWikiTitle(link) === normalizedTarget);

    if (!isLinkValid) {
      throw new AppError(`Invalid step: link "${targetTitle}" is not present in "${game.currentPageTitle}"`, 400, 'INVALID_STEP');
    }

    const targetArticleContent = await wikiService.getWikiArticleContent(targetTitle);
    const resolvedTitle = targetArticleContent.title;
    const normalizedResolved = normalizeWikiTitle(resolvedTitle);
    const normalizedTargetGoal = normalizeWikiTitle(TARGET_PAGE_TITLE);

    const isVictory = normalizedResolved === normalizedTargetGoal || normalizedTarget === normalizedTargetGoal;

    const updatedGame = await prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.game.updateMany({
          where: {
            id: gameId,
            userId,
            status: GameStatus.IN_PROGRESS,
            currentPageTitle: game.currentPageTitle,
          },
          data: {
            currentPageTitle: resolvedTitle,
            clickCount: { increment: 1 },
            ...(isVictory ? { status: GameStatus.COMPLETED, endTime: new Date() } : {}),
          },
        });

        if (updateResult.count === 0) {
          throw new AppError('Concurrent step conflict: game state has already advanced', 409, 'CONCURRENT_CONFLICT');
        }

        const stepCount = await tx.gameStep.count({ where: { gameId } });

        await tx.gameStep.create({
          data: { gameId, pageTitle: resolvedTitle, stepOrder: stepCount + 1 },
        });

        return tx.game.findUniqueOrThrow({
          where: { id: gameId },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
      },
      { timeout: 10000 }
    );

    return { game: updatedGame, currentArticle: targetArticleContent };
  }

  /**
   * Forfeits/abandons an active game.
   * @param userId Authenticated user ID.
   * @param gameId Game ID to abandon.
   * @returns Updated Game object with ABANDONED status.
   * @throws AppError 404 if active game not found.
   */
  public async abandonGame(userId: string, gameId: string): Promise<Game> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId, status: GameStatus.IN_PROGRESS },
    });

    if (!game) throw new AppError('Active game not found or unauthorized', 404, 'GAME_NOT_FOUND');

    return prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.ABANDONED },
    });
  }
}

export const gameService = new GameService();


