import { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry, CompletedGame } from '../types';
import { publicApi } from '../api';

/**
 * Return type interface for the useLeaderboard hook.
 */
export interface UseLeaderboardReturn {
  /** Global player leaderboard entries sorted by rank */
  leaderboard: LeaderboardEntry[];
  /** Historic list of recent completed speedruns */
  completedGames: CompletedGame[];
  /** Asynchronous loading indicator */
  loading: boolean;
  /** Human-readable error message or null */
  error: string | null;
  /** Refetches leaderboard and completed game datasets */
  refetch: () => Promise<void>;
}

/**
 * Custom hook for querying global player rankings and recent completed speedrun history.
 *
 * @param limit - Maximum number of leaderboard items to fetch (defaults to 20).
 * @returns Object adhering to UseLeaderboardReturn interface.
 * @example
 * ```typescript
 * const { leaderboard, completedGames, loading, refetch } = useLeaderboard(50);
 * ```
 */
export function useLeaderboard(limit: number = 20): UseLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [completedGames, setCompletedGames] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [lbData, gamesData] = await Promise.all([
        publicApi.getLeaderboard(limit),
        publicApi.getCompletedGames(limit),
      ]);
      setLeaderboard(lbData);
      setCompletedGames(gamesData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossibile caricare i dati pubblici.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPublicData();
  }, [fetchPublicData]);

  return {
    leaderboard,
    completedGames,
    loading,
    error,
    refetch: fetchPublicData,
  };
}

