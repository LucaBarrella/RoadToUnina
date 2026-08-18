import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useGameEngine } from '../hooks';
import HUDBar from '../components/game/HUDBar';
import WikiRenderer from '../components/game/WikiRenderer';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';

/**
 * Main game page view managing active Wikipedia speedruns, victory screens, and session initialization.
 *
 * @returns React view component for the /game route.
 */
export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    game,
    currentArticle,
    elapsedSeconds,
    loading,
    error,
    setError,
    toastMessage,
    showToast,
    hideToast,
    startNewGame,
    loadActiveGame,
    makeStep,
    abandonGame,
  } = useGameEngine();

  const [overrideStartPage, setOverrideStartPage] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadActiveGame();
    }
  }, [user, loadActiveGame]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await startNewGame(overrideStartPage.trim() || undefined);
    } catch {
      // Error state is already set and managed inside useGameEngine
    }
  };

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check for navigation loops in steps
  const detectLoop = () => {
    if (!game?.steps) return false;
    const titles = game.steps.map((s) => s.pageTitle.toLowerCase());
    const current = (currentArticle?.title || game.currentPageTitle).toLowerCase();
    return titles.filter((t) => t === current).length > 1;
  };

  // If user is not authenticated, prompt to login/register
  if (!user) {
    return (
      <div className="min-h-screen bg-neo-bg bg-dot-pattern flex items-center justify-center p-4 text-neo-black">
        <Card variant="yellow" className="w-full max-w-lg p-6 sm:p-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-5xl mb-3 text-neo-on-accent">
            lock
          </span>
          <h1 className="font-space font-black text-2xl sm:text-3xl uppercase tracking-tight mb-3 text-neo-on-accent">
            Autenticazione Richiesta
          </h1>
          <p className="font-inter text-sm sm:text-base mb-6 font-medium text-neo-on-accent">
            Devi effettuare l'accesso per avviare una speedrun e registrare il tuo punteggio in classifica.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="primary" onClick={() => navigate('/login')}>
              Accedi
            </Button>
            <Button variant="secondary" onClick={() => navigate('/register')}>
              Registrati
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 1. Victory Modal Screen
  if (game && game.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-neo-bg bg-dot-pattern flex items-center justify-center p-4 relative text-neo-black">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="victory-heading"
          aria-describedby="victory-desc"
          className="fixed inset-0 bg-black/75 z-50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <Card variant="white" className="w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150 my-auto">
            {/* Header Emerald */}
            <div className="bg-neo-green text-neo-on-accent border-b-3 border-neo-black p-6 sm:p-8 text-center relative">
              <span aria-hidden="true" className="material-symbols-outlined text-5xl sm:text-6xl mb-2">
                emoji_events
              </span>
              <h1 id="victory-heading" className="font-space font-black text-3xl sm:text-5xl uppercase tracking-tight">
                UNINA REACHED!
              </h1>
              <p id="victory-desc" className="font-mono text-xs sm:text-sm uppercase font-bold mt-1 text-neo-on-accent">
                Hai completato la rotta Wikipedia Speedrun
              </p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 border-b-3 border-neo-black bg-surface-container-low text-center">
              <div className="p-4 sm:p-6 border-b-3 sm:border-b-0 sm:border-r-3 border-neo-black flex flex-col items-center">
                <span className="font-mono text-xs font-bold uppercase text-neo-black mb-1">
                  Click Totali
                </span>
                <div className="bg-neo-yellow text-neo-on-accent border-3 border-neo-black shadow-neo-sm px-6 py-2 font-mono font-bold text-xl sm:text-2xl">
                  {game.clickCount} CLICKS
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-neo-pink/10 flex flex-col items-center">
                <span className="font-mono text-xs font-bold uppercase text-neo-black mb-1">
                  Tempo Finale
                </span>
                <div className="bg-neo-pink text-neo-on-accent border-3 border-neo-black shadow-neo-sm px-6 py-2 font-mono font-bold text-xl sm:text-2xl">
                  {formatSeconds(elapsedSeconds)}
                </div>
              </div>
            </div>

            {/* Steps Path Trail */}
            <div className="p-4 sm:p-6 bg-surface-container border-b-3 border-neo-black">
              <h3 className="font-space font-bold text-base sm:text-lg uppercase mb-3 text-neo-black">
                Percorso Completato
              </h3>
              <div className="flex flex-wrap gap-2 items-center font-mono text-xs">
                {game.steps?.map((st, idx) => (
                  <React.Fragment key={st.id || idx}>
                    <span className="bg-neo-surface text-neo-black border-2 border-neo-black px-2.5 py-1 font-bold shadow-neo-sm">
                      {st.pageTitle}
                    </span>
                    {idx < (game.steps?.length || 0) - 1 && (
                      <span aria-hidden="true" className="material-symbols-outlined text-sm font-bold text-neo-black">
                        arrow_forward
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end bg-neo-surface">
              <Button
                variant="outline"
                icon="leaderboard"
                onClick={() => navigate('/leaderboard')}
              >
                Classifica
              </Button>

              <Button
                variant="success"
                icon="replay"
                onClick={() => startNewGame()}
              >
                Gioca Di Nuovo
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 2. Start Game Form Screen (No active game)
  if (!game || game.status !== 'IN_PROGRESS') {
    return (
      <div className="min-h-screen bg-neo-bg bg-dot-pattern flex flex-col items-center justify-center p-3 sm:p-4 text-neo-black">
        <Card variant="white" className="w-full max-w-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <img
              src="/logo.png"
              alt="RoadToUnina Logo"
              className="w-16 h-16 object-contain border-3 border-neo-black shadow-neo mx-auto mb-4 bg-neo-yellow p-1"
            />
            <h1 className="font-space font-black text-2xl sm:text-4xl uppercase tracking-tight text-neo-black">
              Nuova Partita Speedrun
            </h1>
            <p className="font-inter text-sm text-neo-black mt-2 font-medium">
              Pronto a sfidare la rete? Clicca per generare un articolo casuale di partenza o imposta un titolo specifico.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 bg-neo-pink text-neo-on-accent p-3.5 border-3 border-neo-black shadow-neo-sm font-space font-bold text-sm flex items-center justify-between gap-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span aria-hidden="true" className="material-symbols-outlined text-xl shrink-0">
                  warning
                </span>
                <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Chiudi avviso"
                className="bg-neo-surface text-neo-black border-2 border-neo-black px-2 py-0.5 font-mono font-bold text-xs shrink-0 cursor-pointer hover:bg-black/10 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleStart} className="space-y-6">
            {import.meta.env.DEV && (
              <div className="p-3 bg-neo-yellow/20 border-2 border-dashed border-neo-black">
                <label
                  htmlFor="override-start-page"
                  className="block font-mono text-xs font-bold uppercase mb-2 text-neo-black"
                >
                  🛠️ Articolo di Partenza Personalizzato (Solo DEV / Test)
                </label>
                <input
                  id="override-start-page"
                  type="text"
                  value={overrideStartPage}
                  onChange={(e) => setOverrideStartPage(e.target.value)}
                  placeholder="Es. Napoli (solo per collaudo locale)"
                  className="w-full p-2.5 border-2 border-neo-black font-inter text-neo-black bg-neo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-black shadow-neo-sm text-sm"
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon="play_arrow"
              loading={loading}
              className="w-full"
            >
              Avvia Partita Ora
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // 3. Active Game Screen
  return (
    <div className="min-h-screen bg-neo-bg bg-dot-pattern flex flex-col overflow-x-hidden text-neo-black">
      {/* Toast Notification for 400 Bad Request / Invalid Link */}
      <Toast
        isOpen={Boolean(toastMessage)}
        message={toastMessage || ''}
        onClose={hideToast}
        duration={2500}
        icon="warning"
      />

      {/* 
        FIXED Error Overlay — renders at the very top of the viewport (below Navbar),
        with z-[45] so it floats above ALL page content (HUDBar, article, sidebar)
        but below the Navbar (z-50) and modals.
        Uses fixed positioning so it's completely independent of document flow.
      */}
      {error && (
        <div
          role="alert"
          className="fixed top-[64px] left-0 right-0 z-[45] bg-neo-pink text-neo-on-accent px-4 sm:px-6 py-3 sm:py-4 border-b-3 border-neo-black shadow-neo font-space font-bold text-sm sm:text-base flex items-center justify-between gap-4"
          style={{ minHeight: '52px' }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span aria-hidden="true" className="material-symbols-outlined text-2xl shrink-0">
              error
            </span>
            <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="bg-neo-surface text-neo-black border-3 border-neo-black px-3 py-1.5 font-mono font-bold text-xs shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all shrink-0 cursor-pointer"
          >
            ✕ Chiudi
          </button>
        </div>
      )}

      {/* Main Workspace Layout — extra top padding when error bar is visible */}
      <main
        className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col gap-6"
        style={error ? { paddingTop: '68px' } : undefined}
      >
        {/* HUD Bar in standard page flow */}
        <div className="w-full">
          <HUDBar
            currentTitle={currentArticle?.title || game.currentPageTitle}
            targetTitle={game.targetPageTitle}
            elapsedSeconds={elapsedSeconds}
            clickCount={game.clickCount}
            onAbandon={abandonGame}
          />
        </div>

        {/* Grid Canvas */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Article Canvas (9 Cols) */}
          <div className="md:col-span-9 w-full min-w-0">
            <WikiRenderer
              title={currentArticle?.title || game.currentPageTitle}
              htmlContent={currentArticle?.htmlContent || '<p>Caricamento articolo Wikipedia...</p>'}
              onNavigate={(title) => makeStep(title)}
              onInvalidLink={() => showToast('Link non valido o non enciclopedico')}
              loading={loading}
            />
          </div>

          {/* Path Traversed History Sidebar (3 Cols) */}
          <aside aria-label="Cronologia Passi" className="md:col-span-3 sticky top-[180px]">
            <Card variant="neutral" title="Percorso Effettuato" icon="route">
              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                {game.steps && game.steps.length > 0 ? (
                  game.steps.map((st, idx) => (
                    <div key={st.id || idx} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="w-7 h-7 bg-neo-yellow text-neo-on-accent border-2 border-neo-black font-mono font-bold text-xs flex items-center justify-center flex-shrink-0"
                      >
                        {st.stepOrder}
                      </span>
                      <div className="flex-1 overflow-hidden">
                        <span className="sr-only">Passo {st.stepOrder}: </span>
                        <span className="font-inter text-sm font-bold block truncate text-neo-black" title={st.pageTitle}>
                          {st.pageTitle}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="font-mono text-xs text-neo-black">Nessun passo ancora effettuato.</div>
                )}

                {detectLoop() && (
                  <div
                    role="alert"
                    className="mt-2 bg-neo-pink text-neo-on-accent p-2 border-2 border-neo-black font-mono text-xs font-bold animate-pulse text-center"
                  >
                    ⚠️ Loop Rilevato! (Stato già visitato)
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default GamePage;
