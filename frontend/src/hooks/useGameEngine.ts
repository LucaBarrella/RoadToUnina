import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Game, WikiArticleContent } from '../types';
import { gameApi } from '../api';

/**
 * Return type interface for the useGameEngine hook.
 */
export interface UseGameEngineReturn {
  /** Current active or completed game session entity */
  game: Game | null;
  /** Parsed Wikipedia HTML content and metadata for active step */
  currentArticle: WikiArticleContent | null;
  /** Real-time elapsed duration in seconds */
  elapsedSeconds: number;
  /** Asynchronous loading state flag */
  loading: boolean;
  /** Human-readable permanent error message or null */
  error: string | null;
  /** Temporary toast notification message or null */
  toastMessage: string | null;
  /** Triggers a discreet toast notification */
  showToast: (msg?: string) => void;
  /** Closes and clears active toast notification */
  hideToast: () => void;
  /** Initializes and starts a new speedrun game session */
  startNewGame: (overrideStartPage?: string) => Promise<Game>;
  /** Fetches active game session state and article content */
  loadActiveGame: () => Promise<void>;
  /** Performs a step navigation to a target Wikipedia article */
  makeStep: (targetTitle: string) => Promise<void>;
  /** Abandons and forfeits current game session */
  abandonGame: () => Promise<void>;
  /** Utility function to manually set or reset error message state */
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  /** Utility function to manually set or reset toast message state */
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Custom hook providing game state management, real-time timer tracking, and step navigation.
 *
 * @returns Object adhering to UseGameEngineReturn interface.
 * @example
 * ```typescript
 * const { game, currentArticle, elapsedSeconds, makeStep, toastMessage, hideToast } = useGameEngine();
 * ```
 */
export function useGameEngine(): UseGameEngineReturn {
  const [game, setGame] = useState<Game | null>(null);
  const [currentArticle, setCurrentArticle] = useState<WikiArticleContent | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string = 'Link non valido o non enciclopedico') => {
    setToastMessage(msg);
  }, []);

  const hideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Helper to calculate seconds passed since startTime (or between startTime and endTime)
  const calculateElapsed = (startTimeStr?: string, endTimeStr?: string) => {
    if (!startTimeStr) return 0;
    const start = new Date(startTimeStr).getTime();
    const end = endTimeStr ? new Date(endTimeStr).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  };

  // Timer loop for active game
  useEffect(() => {
    if (game) {
      if (game.status === 'IN_PROGRESS') {
        setElapsedSeconds(calculateElapsed(game.startTime));

        timerRef.current = setInterval(() => {
          setElapsedSeconds(calculateElapsed(game.startTime));
        }, 1000);
      } else if (game.status === 'COMPLETED') {
        setElapsedSeconds(calculateElapsed(game.startTime, game.endTime));
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } else {
      setElapsedSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [game?.status, game?.startTime, game?.endTime]);

  const loadActiveGame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.getActiveGame();
      if (activeData) {
        setGame(activeData.game);
        setCurrentArticle(activeData.currentArticle);
      } else {
        setGame(null);
        setCurrentArticle(null);
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Errore durante il caricamento della partita attiva.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getErrorMessage = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err)) {
      const serverErr = err.response?.data?.error;
      if (typeof serverErr === 'string' && serverErr.trim().length > 0) {
        return serverErr;
      }
      if (err.response?.status === 404) {
        return 'Pagina Wikipedia non trovata. Inserisci un altro titolo o lascia il campo vuoto per una voce casuale.';
      }
      if (err.response?.status === 502) {
        return 'Errore di comunicazione con Wikipedia. Riprova tra qualche istante.';
      }
    }
    if (err instanceof Error && err.message) {
      if (err.message.includes('404')) {
        return 'Pagina Wikipedia non trovata. Inserisci un altro titolo o lascia il campo vuoto per una voce casuale.';
      }
      return err.message;
    }
    return fallback;
  };

  const startNewGame = async (overrideStartPage?: string) => {
    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.startGame(overrideStartPage);
      setGame(activeData.game);
      setCurrentArticle(activeData.currentArticle);
      return activeData.game;
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Impossibile avviare una nuova partita.');
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const makeStep = async (targetTitle: string) => {
    if (!game) return;
    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.makeStep(game.id, targetTitle);
      setGame(activeData.game);
      setCurrentArticle(activeData.currentArticle);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && (err.response?.status === 400 || err.status === 400)) {
        // Bad request / invalid link clicked -> Show discreet temporary toast instead of permanent error banner
        showToast('Link non valido o non enciclopedico');
      } else {
        const msg = getErrorMessage(err, 'Mossa non valida o errore di rete.');
        if (
          msg.includes('400') ||
          msg.toLowerCase().includes('non valido') ||
          msg.toLowerCase().includes('invalid step')
        ) {
          showToast('Link non valido o non enciclopedico');
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const abandonGame = async () => {
    if (!game) return;
    try {
      setLoading(true);
      setError(null);
      const abandonedGame = await gameApi.abandonGame(game.id);
      setGame(abandonedGame);
      setCurrentArticle(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante l'abbandono della partita.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    game,
    currentArticle,
    elapsedSeconds,
    loading,
    error,
    toastMessage,
    showToast,
    hideToast,
    startNewGame,
    loadActiveGame,
    makeStep,
    abandonGame,
    setError,
    setToastMessage,
  };
}
