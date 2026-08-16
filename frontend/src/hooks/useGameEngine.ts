import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Game, WikiArticleContent } from '../types';
import { gameApi } from '../api';

/** Interface for useGameEngine hook return payload. */
export interface UseGameEngineReturn {
  /** Active or completed game session entity */
  game: Game | null;
  /** Wikipedia article content for active step */
  currentArticle: WikiArticleContent | null;
  /** Real-time elapsed duration in seconds */
  elapsedSeconds: number;
  /** Async loading state flag */
  loading: boolean;
  /** Permanent banner error message */
  error: string | null;
  /** Temporary toast message */
  toastMessage: string | null;
  /** Displays a transient toast notification */
  showToast: (msg?: string) => void;
  /** Hides active toast notification */
  hideToast: () => void;
  /** Starts a new speedrun session */
  startNewGame: (overrideStartPage?: string) => Promise<Game>;
  /** Loads current active game session */
  loadActiveGame: () => Promise<void>;
  /** Performs step navigation */
  makeStep: (targetTitle: string) => Promise<void>;
  /** Abandons current game session */
  abandonGame: () => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

/** Hook managing speedrun game session state, timer, and step actions. */
export function useGameEngine(): UseGameEngineReturn {
  const [game, setGame] = useState<Game | null>(null);
  const [currentArticle, setCurrentArticle] = useState<WikiArticleContent | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const showToast = useCallback((msg = 'Link non valido o non enciclopedico') => {
    setToastMessage(msg);
  }, []);

  const hideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const calculateElapsed = (startTimeStr?: string, endTimeStr?: string) => {
    if (!startTimeStr) return 0;
    const start = new Date(startTimeStr).getTime();
    const end = endTimeStr ? new Date(endTimeStr).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  };

  useEffect(() => {
    if (game?.status === 'IN_PROGRESS') {
      setElapsedSeconds(calculateElapsed(game.startTime));
      const timer = setInterval(() => {
        setElapsedSeconds(calculateElapsed(game.startTime));
      }, 1000);
      return () => clearInterval(timer);
    }
    if (game?.status === 'COMPLETED') {
      setElapsedSeconds(calculateElapsed(game.startTime, game.endTime));
    } else {
      setElapsedSeconds(0);
    }
  }, [game?.id, game?.status, game?.startTime, game?.endTime]);

  const getErrorMessage = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as { error?: string; message?: string; code?: string } | string;
      const code = typeof data === 'object' ? data?.code : undefined;
      const serverErr = typeof data === 'string' ? data : data?.error || data?.message;

      // Handle structured machine-readable error codes first
      if (code) {
        switch (code) {
          case 'ACTIVE_GAME_EXISTS':
            return 'Hai già una partita attiva in corso.';
          case 'INVALID_WIKI_TITLE':
          case 'VALIDATION_ERROR':
            return 'Titolo della voce non valido.';
          case 'WIKI_PAGE_NOT_FOUND':
            return 'Pagina Wikipedia non trovata.';
          case 'NOT_FOUND':
          case 'GAME_NOT_FOUND':
            return 'Risorsa non trovata.';
          case 'INVALID_STEP':
            return 'Link non valido o non presente nella pagina corrente.';
          case 'CONCURRENT_CONFLICT':
            return 'Conflitto di sincronizzazione: la partita è già avanzata.';
          case 'WIKI_API_ERROR':
            return 'Errore di comunicazione con Wikipedia.';
        }
      }

      if (serverErr && typeof serverErr === 'string') {
        const lower = serverErr.toLowerCase();
        if (lower.includes('already has an active game')) return 'Hai già una partita attiva in corso.';
        if (lower.includes('validation error') || lower.includes('invalid or empty')) return 'Titolo della voce non valido.';
        if (lower.includes('non trovata') || lower.includes('not found')) return 'Pagina Wikipedia non trovata.';
        if (lower.includes('invalid step')) return 'Link non valido o non presente nella pagina corrente.';
        if (!/request failed with status code/i.test(serverErr)) return serverErr;
      }

      const status = err.response?.status;
      if (status === 404) return 'Pagina Wikipedia non trovata.';
      if (status === 400) return 'Richiesta non valida.';
      if (status === 401) return 'Sessione di accesso scaduta.';
      if (status === 409) return 'Conflitto di sincronizzazione: la partita è già avanzata.';
      if (status === 502 || status === 504) return 'Errore di comunicazione con Wikipedia.';
    }

    if (err instanceof Error && err.message) {
      if (/network error|timeout|econnrefused/i.test(err.message)) return 'Impossibile connettersi al server.';
      if (!/request failed with status code/i.test(err.message)) return err.message;
    }

    return fallback;
  };

  const loadActiveGame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.getActiveGame();
      setGame(activeData?.game || null);
      setCurrentArticle(activeData?.currentArticle || null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Errore durante il caricamento della partita attiva.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const startNewGame = async (overrideStartPage?: string) => {
    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.startGame(overrideStartPage);
      setGame(activeData.game);
      setCurrentArticle(activeData.currentArticle);
      return activeData.game;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && (err.response?.status === 400 || (err.response?.data as { code?: string })?.code === 'ACTIVE_GAME_EXISTS')) {
        try {
          const activeData = await gameApi.getActiveGame();
          if (activeData?.game) {
            setGame(activeData.game);
            setCurrentArticle(activeData.currentArticle);
            return activeData.game;
          }
        } catch {}
      }
      const msg = getErrorMessage(err, 'Impossibile avviare una nuova partita.');
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const makeStep = async (targetTitle: string) => {
    if (!game || loading) return;
    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.makeStep(game.id, targetTitle);
      setGame(activeData.game);
      setCurrentArticle(activeData.currentArticle);
    } catch (err: unknown) {
      const code = axios.isAxiosError(err) ? (err.response?.data as { code?: string })?.code : undefined;
      if (code === 'INVALID_STEP' || code === 'WIKI_PAGE_NOT_FOUND') {
        showToast(code === 'WIKI_PAGE_NOT_FOUND' ? 'Pagina Wikipedia non trovata.' : 'Link non valido o non presente nella pagina corrente.');
      } else if (axios.isAxiosError(err) && (err.response?.status === 400 || err.response?.status === 404)) {
        showToast(err.response?.status === 404 ? 'Pagina Wikipedia non trovata.' : 'Link non valido o non enciclopedico');
      } else {
        const msg = getErrorMessage(err, 'Mossa non valida o errore di rete.');
        if (/non valido|non trovata|invalid step/i.test(msg)) {
          showToast(msg);
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
      setError(getErrorMessage(err, "Errore durante l'abbandono della partita."));
    } finally {
      setLoading(false);
    }
  };

  return {
    game, currentArticle, elapsedSeconds, loading, error, toastMessage,
    showToast, hideToast, startNewGame, loadActiveGame, makeStep, abandonGame,
    setError, setToastMessage,
  };
}

