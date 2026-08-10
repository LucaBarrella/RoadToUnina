import { GameStatus } from '@prisma/client';
import { prisma } from '../config/db';

/**
 * Public representation of a game user.
 */
export interface PublicUserView {
  /**
   * Unique user identifier.
   */
  id: string;

  /**
   * Public display username.
   */
  username: string;
}

/**
 * Public representation of an individual game navigation step.
 */
export interface CompletedGameStepView {
  /**
   * 1-based sequential step order index.
   */
  stepOrder: number;

  /**
   * Wikipedia page title visited at this step.
   */
  pageTitle: string;
}

/**
 * Public completed game view with steps and user info for feed exploration.
 */
export interface CompletedGameView {
  /**
   * Unique identifier of the game.
   */
  id: string;

  /**
   * Public user details of the player.
   */
  user: PublicUserView;

  /**
   * Starting Wikipedia article title.
   */
  startPageTitle: string;

  /**
   * Current / final Wikipedia article title reached.
   */
  currentPageTitle: string;

  /**
   * Total number of navigation clicks performed.
   */
  clickCount: number;

  /**
   * Game start timestamp.
   */
  startTime: Date;

  /**
   * Game completion timestamp.
   */
  endTime: Date | null;

  /**
   * Total elapsed time in rounded seconds.
   */
  durationSeconds: number | null;

  /**
   * Ordered sequence of steps taken from start to target.
   */
  steps: CompletedGameStepView[];
}

/**
 * Public leaderboard entry ranking best player statistics.
 */
export interface LeaderboardEntry {
  /**
   * Leaderboard rank position (1-indexed).
   */
  rank: number;

  /**
   * Unique user identifier.
   */
  userId: string;

  /**
   * Player's username.
   */
  username: string;

  /**
   * Nested public user view.
   */
  user: PublicUserView;

  /**
   * Total number of completed games.
   */
  completedGamesCount: number;

  /**
   * Lowest click count achieved among all completed games.
   */
  bestClickCount: number;

  /**
   * Shortest completion duration in seconds achieved.
   */
  bestDurationSeconds: number;
}

/**
 * Computes elapsed duration in whole seconds between start and end timestamps.
 *
 * @param {Date} startTime - The game start timestamp.
 * @param {Date | null} endTime - The game completion timestamp, or null if ongoing.
 * @returns {number | null} Duration in rounded seconds, or null if endTime is null.
 */
export function calculateDurationInSeconds(startTime: Date, endTime: Date | null): number | null {
  if (!endTime) return null;
  return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
}

/**
 * Service managing public endpoints for completed games and global leaderboards.
 */
export class PublicService {
  /**
   * Retrieves recent completed games with their full navigation step sequence for public exploration.
   *
   * @param {number} [limit=20] - Maximum number of completed games to fetch. Defaults to 20.
   * @returns {Promise<CompletedGameView[]>} List of completed games with step trails.
   *
   * @example
   * const games = await publicService.getCompletedGames(10);
   */
  public async getCompletedGames(limit: number = 20): Promise<CompletedGameView[]> {
    const games = await prisma.game.findMany({
      where: { status: GameStatus.COMPLETED },
      orderBy: { endTime: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true } },
        steps: { orderBy: { stepOrder: 'asc' }, select: { stepOrder: true, pageTitle: true } },
      },
    });

    return games.map((game): CompletedGameView => ({
      id: game.id,
      user: game.user,
      startPageTitle: game.startPageTitle,
      currentPageTitle: game.currentPageTitle,
      clickCount: game.clickCount,
      startTime: game.startTime,
      endTime: game.endTime,
      durationSeconds: calculateDurationInSeconds(game.startTime, game.endTime),
      steps: game.steps,
    }));
  }

  /**
   * Retrieves the global player leaderboard.
   * Ranking criteria:
   * 1. Lowest click count (`bestClickCount ASC`)
   * 2. Shortest duration (`bestDurationSeconds ASC`)
   * 3. Total completed games (`completedGamesCount DESC`)
   *
   * @param {number} [limit=50] - Maximum number of leaderboard rows to return. Defaults to 50.
   * @returns {Promise<LeaderboardEntry[]>} Sorted leaderboard entries.
   *
   * @example
   * const leaderboard = await publicService.getLeaderboard(50);
   */
  public async getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    const completedGames = await prisma.game.findMany({
      where: {
        status: GameStatus.COMPLETED,
        endTime: { not: null },
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    interface RawUserStats {
      userId: string;
      username: string;
      completedGamesCount: number;
      bestClickCount: number;
      bestDurationSeconds: number;
    }

    const userStatsMap = new Map<string, RawUserStats>();

    for (const game of completedGames) {
      if (!game.endTime) continue;

      const durationSeconds = calculateDurationInSeconds(game.startTime, game.endTime) ?? 0;
      const existing = userStatsMap.get(game.userId);

      if (!existing) {
        userStatsMap.set(game.userId, {
          userId: game.userId,
          username: game.user.username,
          completedGamesCount: 1,
          bestClickCount: game.clickCount,
          bestDurationSeconds: durationSeconds,
        });
        continue;
      }

      existing.completedGamesCount += 1;

      const isFewerClicks = game.clickCount < existing.bestClickCount;
      const isSameClicksFaster = game.clickCount === existing.bestClickCount && durationSeconds < existing.bestDurationSeconds;

      if (isFewerClicks || isSameClicksFaster) {
        existing.bestClickCount = game.clickCount;
        existing.bestDurationSeconds = durationSeconds;
      }
    }

    const sortedStats = Array.from(userStatsMap.values()).sort((a, b) => {
      if (a.bestClickCount !== b.bestClickCount) {
        return a.bestClickCount - b.bestClickCount;
      }
      if (a.bestDurationSeconds !== b.bestDurationSeconds) {
        return a.bestDurationSeconds - b.bestDurationSeconds;
      }
      return b.completedGamesCount - a.completedGamesCount;
    });

    return sortedStats.slice(0, limit).map((entry, index): LeaderboardEntry => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username,
      user: {
        id: entry.userId,
        username: entry.username,
      },
      completedGamesCount: entry.completedGamesCount,
      bestClickCount: entry.bestClickCount,
      bestDurationSeconds: entry.bestDurationSeconds,
    }));
  }
}

export const publicService: PublicService = new PublicService();
