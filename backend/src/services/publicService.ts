import { GameStatus } from '@prisma/client';
import { prisma } from '../config/db';

/** Public view representation of user details. */
export interface PublicUserView {
  id: string;
  username: string;
}

/** Public view of an individual game step. */
export interface CompletedGameStepView {
  stepOrder: number;
  pageTitle: string;
}

/** Detailed public view of a completed game session. */
export interface CompletedGameView {
  id: string;
  user: PublicUserView;
  startPageTitle: string;
  currentPageTitle: string;
  clickCount: number;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  steps: CompletedGameStepView[];
}

/** Global leaderboard entry for a player. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  user: PublicUserView;
  completedGamesCount: number;
  bestClickCount: number;
  bestDurationSeconds: number;
}

/**
 * Calculates duration in seconds between game start and completion timestamps.
 * @param startTime Game start date.
 * @param endTime Game completion date or null.
 * @returns Duration in whole seconds, or null if uncompleted.
 */
export function calculateDurationInSeconds(startTime: Date, endTime: Date | null): number | null {
  if (!endTime) return null;
  return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
}

/** Service managing public queries for completed games and global leaderboards. */
export class PublicService {
  /**
   * Retrieves recently completed games with navigation steps.
   * @param limit Max games to return (default 20).
   * @returns List of completed games.
   */
  public async getCompletedGames(limit = 20): Promise<CompletedGameView[]> {
    const games = await prisma.game.findMany({
      where: { status: GameStatus.COMPLETED },
      orderBy: { endTime: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true } },
        steps: { orderBy: { stepOrder: 'asc' }, select: { stepOrder: true, pageTitle: true } },
      },
    });

    return games.map((game) => ({
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
   * Computes global leaderboard rankings (clicks ASC, duration ASC, games DESC).
   * @param limit Max rankings to return (default 50).
   * @returns Ranked leaderboard list.
   */
  public async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const completedGames = await prisma.game.findMany({
      where: { status: GameStatus.COMPLETED, endTime: { not: null } },
      include: { user: { select: { id: true, username: true } } },
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
      if (a.bestClickCount !== b.bestClickCount) return a.bestClickCount - b.bestClickCount;
      if (a.bestDurationSeconds !== b.bestDurationSeconds) return a.bestDurationSeconds - b.bestDurationSeconds;
      return b.completedGamesCount - a.completedGamesCount;
    });

    return sortedStats.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username,
      user: { id: entry.userId, username: entry.username },
      completedGamesCount: entry.completedGamesCount,
      bestClickCount: entry.bestClickCount,
      bestDurationSeconds: entry.bestDurationSeconds,
    }));
  }
}

export const publicService = new PublicService();


