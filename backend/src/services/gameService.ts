import { Game, GameStep, GameStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { wikiService, WikiArticleContent } from './wikiService';
import { AppError } from '../middlewares/errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';

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
 * Normalizes a Wikipedia article title for strict comparison by decoding URI components,
 * replacing underscores with spaces, trimming whitespace, and converting to lowercase.
 *
 * @param title - Raw article title string.
 * @returns Normalized lowercase title string.
 */
export function normalizeWikiTitle(title: string): string {
  try {
    return decodeURIComponent(title).replace(/_/g, ' ').trim().toLowerCase();
  } catch (_decodeErr) {
    // Malformed URI percent encoding fallback to raw title
    return title.replace(/_/g, ' ').trim().toLowerCase();
  }
}

/**
 * Checks if a game session has expired due to exceeding the inactivity timeout threshold.
 *
 * @param lastActivity - Timestamp of last activity (updatedAt or startTime).
 * @returns `true` if the duration since last activity exceeds {@link EXPIRATION_HOURS}, otherwise `false`.
 */
export function isGameExpired(lastActivity: Date): boolean {
  return (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60) > EXPIRATION_HOURS;
}

/**
 * Service managing game session lifecycle, anti-cheat step validation, and player progression.
 */
export class GameService {
  /**
   * Starts a new game session for the specified user.
   * Checks for active games and marks expired games as abandoned.
   *
   * @param userId - Unique identifier of the authenticated user.
   * @param overrideStartPage - Optional explicit starting article title (used for deterministic testing).
   * @returns A Promise resolving to {@link ActiveGameResponse} containing the created game session and initial article.
   * @throws {AppError} 400 Bad Request if the user already has an active, non-expired game session.
   */
  public async startGame(userId: string, overrideStartPage?: string): Promise<ActiveGameResponse> {
    let rawStartTitle = overrideStartPage?.trim() || await wikiService.getRandomWikiArticle();
    
    // Edge case guard: Ensure start article is not identical to target goal
    if (normalizeWikiTitle(rawStartTitle) === normalizeWikiTitle(TARGET_PAGE_TITLE)) {
      rawStartTitle = await wikiService.getRandomWikiArticle();
    }

    const currentArticle = await wikiService.getWikiArticleContent(rawStartTitle);
    const startTitle = currentArticle.title || rawStartTitle;

    try {
      const createdGame = await prisma.$transaction(
        async (tx) => {
          // Row lock on User record to serialize concurrent requests for the same user
          await tx.user.update({
            where: { id: userId },
            data: { updatedAt: new Date() },
          });

          const existingGame = await tx.game.findFirst({
            where: { userId, status: GameStatus.IN_PROGRESS },
          });

          if (existingGame) {
            if (!isGameExpired(existingGame.updatedAt || existingGame.startTime)) {
              throw new AppError('User already has an active game in progress', 400, ErrorCode.ACTIVE_GAME_EXISTS);
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('User already has an active game in progress', 400, ErrorCode.ACTIVE_GAME_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Fetches the currently active game session for a user along with rendered article content.
   * Automatically marks expired games or games with inaccessible pages as abandoned.
   *
   * @param userId - Unique identifier of the authenticated user.
   * @returns A Promise resolving to {@link ActiveGameResponse} if active, or `null` if no active session exists.
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
    } catch (_fetchErr) {
      // If the Wikipedia page is permanently inaccessible or corrupt, mark session abandoned
      await prisma.game.update({ where: { id: game.id }, data: { status: GameStatus.ABANDONED } });
      return null;
    }
  }

  /**
   * Performs a navigation step from the current article to a target article within an active game session.
   * Validates that the target link exists on the current page to prevent cheating.
   *
   * @param userId - Unique identifier of the authenticated user.
   * @param gameId - Unique identifier of the active game session.
   * @param targetTitle - Title of the Wikipedia article clicked by the player.
   * @returns A Promise resolving to {@link ActiveGameResponse} with updated game state and target article HTML.
   * @throws {AppError} 404 Not Found if the game does not exist or does not belong to the user.
   * @throws {AppError} 400 Bad Request if the requested link is invalid or not reachable from the current page.
   * @throws {AppError} 409 Conflict if a concurrent step request advanced the game state.
   */
  public async makeStep(userId: string, gameId: string, targetTitle: string): Promise<ActiveGameResponse> {
    const normalizedTarget = normalizeWikiTitle(targetTitle);

    const game = await prisma.game.findFirst({
      where: { id: gameId, userId, status: GameStatus.IN_PROGRESS },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!game) throw new AppError('Active game not found or unauthorized', 404, ErrorCode.GAME_NOT_FOUND);

    const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);
    const isLinkValid = currentContent.validLinks.some(link => normalizeWikiTitle(link) === normalizedTarget);

    if (!isLinkValid) {
      throw new AppError(`Invalid step: link "${targetTitle}" is not present in "${game.currentPageTitle}"`, 400, ErrorCode.INVALID_STEP);
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
          throw new AppError('Concurrent step conflict: game state has already advanced', 409, ErrorCode.CONCURRENT_CONFLICT);
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
   * Forfeits and abandons an active game session for the specified user.
   *
   * @param userId - Unique identifier of the authenticated user.
   * @param gameId - Unique identifier of the game session to abandon.
   * @returns A Promise resolving to the updated {@link Game} record with ABANDONED status.
   * @throws {AppError} 404 Not Found if active game is not found or does not belong to user.
   */
  public async abandonGame(userId: string, gameId: string): Promise<Game> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId, status: GameStatus.IN_PROGRESS },
    });

    if (!game) throw new AppError('Active game not found or unauthorized', 404, ErrorCode.GAME_NOT_FOUND);

    return prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.ABANDONED },
    });
  }
}

/**
 * Singleton instance of the {@link GameService}.
 */
export const gameService = new GameService();


