import { Game, GameStep, GameStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { wikiService, WikiArticleContent } from './wikiService';
import { AppError } from '../middlewares/errorMiddleware';

/**
 * Composite Game type including the ordered sequence of navigation steps.
 */
export type GameWithSteps = Game & { steps: GameStep[] };

/**
 * Active game response bundle containing the game session and the rendered Wikipedia HTML of current page.
 */
export interface ActiveGameResponse {
  /**
   * The Game model entity with steps.
   */
  game: GameWithSteps;

  /**
   * Parsed and sanitized HTML content of the current Wikipedia page.
   */
  currentArticle: WikiArticleContent;
}

/**
 * Target goal page title for the game.
 */
export const TARGET_PAGE_TITLE: string = 'Università degli Studi di Napoli Federico II';

/**
 * Game session inactivity timeout before auto-abandonment (24 hours).
 */
export const EXPIRATION_HOURS: number = 24;

/**
 * Normalizes a Wikipedia page title string for robust comparisons.
 * Replaces underscores with spaces, decodes URI components, trims whitespace, and converts to lowercase.
 *
 * @param {string} title - Raw title or link target.
 * @returns {string} Normalized lower-case title string.
 */
export function normalizeWikiTitle(title: string): string {
  try {
    const decoded = decodeURIComponent(title);
    return decoded.replace(/_/g, ' ').trim().toLowerCase();
  } catch {
    return title.replace(/_/g, ' ').trim().toLowerCase();
  }
}

/**
 * Checks whether a game session has exceeded the 24-hour expiration threshold.
 *
 * @param {Date} startTime - The creation timestamp of the game.
 * @returns {boolean} True if elapsed time exceeds EXPIRATION_HOURS.
 */
export function isGameExpired(startTime: Date): boolean {
  const elapsedMs = Date.now() - new Date(startTime).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  return elapsedHours > EXPIRATION_HOURS;
}

/**
 * Service managing game lifecycle, step execution, anti-cheat link verification, and victory detection.
 */
export class GameService {
  /**
   * Starts a new game session for the user.
   * If an existing IN_PROGRESS game is expired (>24h), marks it as ABANDONED.
   * If an existing active game is under 24h, rejects with 400 Bad Request.
   *
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string} [overrideStartPage] - Optional starting page override used in test environments.
   * @returns {Promise<GameWithSteps>} The created Game entity with initial step.
   * @throws {AppError} 400 if user already has an active valid game in progress.
   *
   * @example
   * const game = await gameService.startGame('user-uuid-123');
   */
  public async startGame(
    userId: string,
    overrideStartPage?: string
  ): Promise<ActiveGameResponse> {
    const rawStartTitle: string =
      overrideStartPage && overrideStartPage.trim().length > 0
        ? overrideStartPage.trim()
        : await wikiService.getRandomWikiArticle();

    // Fetch initial article content BEFORE creating game to validate article existence and resolve canonical title
    const currentArticle: WikiArticleContent = await wikiService.getWikiArticleContent(rawStartTitle);
    const startTitle: string = currentArticle.title || rawStartTitle;

    const createdGame = await prisma.$transaction(
      async (tx) => {
        // Acquire exclusive row-level lock on User record to serialize concurrent startGame operations in PostgreSQL
        if (tx.user?.update) {
          try {
            await tx.user.update({
              where: { id: userId },
              data: { updatedAt: new Date() },
            });
          } catch {
            // Ignore in mocked unit tests where user record might not exist
          }
        }

        const existingGame = await tx.game.findFirst({
          where: {
            userId,
            status: GameStatus.IN_PROGRESS,
          },
        });

        if (existingGame) {
          if (!isGameExpired(existingGame.startTime)) {
            throw new AppError('User already has an active game in progress', 400);
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
          data: {
            gameId: game.id,
            pageTitle: startTitle,
            stepOrder: 1,
          },
        });

        return tx.game.findUniqueOrThrow({
          where: { id: game.id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
      },
      { timeout: 10000 }
    );

    return {
      game: createdGame,
      currentArticle,
    };
  }

  /**
   * Retrieves the current IN_PROGRESS game for the user along with its step path and article HTML.
   *
   * @param {string} userId - Unique identifier of the authenticated user.
   * @returns {Promise<ActiveGameResponse | null>} Active game with current Wikipedia article HTML, or null.
   *
   * @example
   * const activeGame = await gameService.getActiveGame('user-uuid-123');
   */
  public async getActiveGame(userId: string): Promise<ActiveGameResponse | null> {
    const game = await prisma.game.findFirst({
      where: {
        userId,
        status: GameStatus.IN_PROGRESS,
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!game) {
      return null;
    }

    if (isGameExpired(game.startTime)) {
      await prisma.game.update({
        where: { id: game.id },
        data: { status: GameStatus.ABANDONED },
      });
      return null;
    }

    try {
      const currentArticle = await wikiService.getWikiArticleContent(game.currentPageTitle);
      return {
        game,
        currentArticle,
      };
    } catch {
      // If fetching the Wikipedia article fails (e.g. corrupt title or 404),
      // mark it abandoned and return null so the user is never trapped in a broken state
      await prisma.game.update({
        where: { id: game.id },
        data: { status: GameStatus.ABANDONED },
      });
      return null;
    }
  }

  /**
   * Executes a step navigation in an active game.
   * Pre-fetches Wikipedia article content before entering the database transaction to prevent connection pool exhaustion.
   *
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string} gameId - Unique identifier of the game.
   * @param {string} targetTitle - Title of the link selected by the user.
   * @returns {Promise<ActiveGameResponse>} Updated Game entity with new step and target article HTML.
   * @throws {AppError} 404 if game not found, 400 if target link is invalid, 409 on concurrent step conflict.
   *
   * @example
   * const activeGame = await gameService.makeStep('user-123', 'game-456', 'Napoli');
   */
  public async makeStep(
    userId: string,
    gameId: string,
    targetTitle: string
  ): Promise<ActiveGameResponse> {
    const normalizedTarget: string = normalizeWikiTitle(targetTitle);

    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        userId,
        status: GameStatus.IN_PROGRESS,
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!game) {
      throw new AppError('Active game not found or unauthorized', 404);
    }

    const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);

    const isLinkValid = currentContent.validLinks.some(
      (link) => normalizeWikiTitle(link) === normalizedTarget
    );

    if (!isLinkValid) {
      throw new AppError(
        `Invalid step: link "${targetTitle}" is not present in "${game.currentPageTitle}"`,
        400
      );
    }

    const targetArticleContent = await wikiService.getWikiArticleContent(targetTitle);
    const resolvedTitle: string = targetArticleContent.title;
    const normalizedResolved: string = normalizeWikiTitle(resolvedTitle);
    const normalizedTargetGoal: string = normalizeWikiTitle(TARGET_PAGE_TITLE);

    const isVictory: boolean =
      normalizedResolved === normalizedTargetGoal ||
      normalizedTarget === normalizedTargetGoal;

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
            ...(isVictory
              ? { status: GameStatus.COMPLETED, endTime: new Date() }
              : {}),
          },
        });

        if (updateResult.count === 0) {
          throw new AppError('Concurrent step conflict: game state has already advanced', 409);
        }

        const stepCount = await tx.gameStep.count({ where: { gameId } });

        await tx.gameStep.create({
          data: {
            gameId,
            pageTitle: resolvedTitle,
            stepOrder: stepCount + 1,
          },
        });

        return tx.game.findUniqueOrThrow({
          where: { id: gameId },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
      },
      { timeout: 10000 }
    );

    return {
      game: updatedGame,
      currentArticle: targetArticleContent,
    };
  }

  /**
   * Forfeits/abandons an active game session.
   *
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string} gameId - Unique identifier of the game to abandon.
   * @returns {Promise<Game>} The updated Game entity with ABANDONED status.
   * @throws {AppError} 404 if active game is not found.
   *
   * @example
   * const abandonedGame = await gameService.abandonGame('user-123', 'game-456');
   */
  public async abandonGame(userId: string, gameId: string): Promise<Game> {
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        userId,
        status: GameStatus.IN_PROGRESS,
      },
    });

    if (!game) {
      throw new AppError('Active game not found or unauthorized', 404);
    }

    return prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.ABANDONED },
    });
  }
}

export const gameService: GameService = new GameService();
