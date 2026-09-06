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
   * Computes global leaderboard rankings using pure Prisma ORM methods.
   * Leverages Prisma aggregation and bounded user/game relation queries.
   * Ranks players by fewest clicks (ASC), shortest duration (ASC), and total games (DESC).
   *
   * @param limit Max rankings to return (default 50).
   * @returns Ranked leaderboard list matching LeaderboardEntry schema.
   */
  public async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const safeLimit = Math.min(100, Math.max(1, limit));

    // 1. Fetch top user aggregations using standard Prisma groupBy
    const candidateGroups = await prisma.game.groupBy({
      by: ['userId'],
      where: {
        status: GameStatus.COMPLETED,
        endTime: { not: null },
      },
      _count: {
        _all: true,
      },
      _min: {
        clickCount: true,
      },
      orderBy: [
        { _min: { clickCount: 'asc' } },
        { _count: { id: 'desc' } },
      ],
      take: safeLimit * 3, // Bounded candidate pool to account for secondary duration ordering
    });

    if (candidateGroups.length === 0) {
      return [];
    }

    const candidateUserIds = candidateGroups.map((g) => g.userId);
    const countMap = new Map<string, number>();
    for (const g of candidateGroups) {
      countMap.set(g.userId, g._count._all);
    }

    // 2. Fetch user profiles and their top completed runs using standard Prisma findMany
    const usersWithGames = await prisma.user.findMany({
      where: {
        id: { in: candidateUserIds },
      },
      select: {
        id: true,
        username: true,
        games: {
          where: {
            status: GameStatus.COMPLETED,
            endTime: { not: null },
          },
          orderBy: [
            { clickCount: 'asc' },
            { startTime: 'asc' },
          ],
          take: 10, // Bounded game history per candidate user
          select: {
            clickCount: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // 3. Compute best run per candidate user
    interface UserLeaderboardCandidate {
      userId: string;
      username: string;
      completedGamesCount: number;
      bestClickCount: number;
      bestDurationSeconds: number;
    }

    const candidates: UserLeaderboardCandidate[] = [];

    for (const user of usersWithGames) {
      if (user.games.length === 0) continue;

      let bestClickCount = Number.MAX_SAFE_INTEGER;
      let bestDurationSeconds = Number.MAX_SAFE_INTEGER;

      for (const game of user.games) {
        if (!game.endTime) continue;
        const durationSeconds = calculateDurationInSeconds(game.startTime, game.endTime) ?? 0;

        const isFewerClicks = game.clickCount < bestClickCount;
        const isSameClicksFaster = game.clickCount === bestClickCount && durationSeconds < bestDurationSeconds;

        if (isFewerClicks || isSameClicksFaster) {
          bestClickCount = game.clickCount;
          bestDurationSeconds = durationSeconds;
        }
      }

      if (bestClickCount !== Number.MAX_SAFE_INTEGER) {
        candidates.push({
          userId: user.id,
          username: user.username,
          completedGamesCount: countMap.get(user.id) ?? user.games.length,
          bestClickCount,
          bestDurationSeconds,
        });
      }
    }

    // 4. Sort candidates strictly: lowest clicks first, shortest duration, most games completed
    candidates.sort((a, b) => {
      if (a.bestClickCount !== b.bestClickCount) return a.bestClickCount - b.bestClickCount;
      if (a.bestDurationSeconds !== b.bestDurationSeconds) return a.bestDurationSeconds - b.bestDurationSeconds;
      return b.completedGamesCount - a.completedGamesCount;
    });

    // 5. Slice to requested limit and format output
    return candidates.slice(0, safeLimit).map((entry, index) => ({
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

export const publicService = new PublicService();


