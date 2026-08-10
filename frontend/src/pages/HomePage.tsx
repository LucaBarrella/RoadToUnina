import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLeaderboard } from '../hooks';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

/**
 * Landing page view explaining game rules, introducing the challenge, and highlighting recent runs.
 *
 * @returns React view component for the root (/) route.
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completedGames, loading } = useLeaderboard(3);

  const formatSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-neo-bg bg-dot-pattern flex flex-col items-center justify-between p-3 sm:p-4 md:p-8 text-neo-black">
      <main className="w-full max-w-5xl my-auto flex flex-col gap-8 md:gap-10">
        {/* Hero Section */}
        <section className="card-neo p-6 sm:p-8 md:p-16 text-center relative overflow-hidden">
          <div className="inline-block mb-4">
            <span className="font-mono text-xs uppercase font-bold bg-neo-cyan text-neo-on-accent px-3 py-1 border-2 border-neo-black shadow-neo-sm">
              Wikipedia Speedrun Challenge
            </span>
          </div>

          <div className="my-2">
            <h1 className="font-space font-black text-3xl sm:text-5xl md:text-7xl uppercase tracking-tighter text-neo-on-accent inline-block bg-neo-yellow px-4 sm:px-6 py-2 sm:py-3 border-3 border-neo-black shadow-neo max-w-full break-words">
              ROAD TO UNINA
            </h1>
          </div>

          <p className="font-inter text-base md:text-xl text-neo-black max-w-2xl mx-auto my-6 bg-surface-container px-4 sm:px-6 py-4 border-3 border-neo-black shadow-neo-sm leading-relaxed font-medium">
            Parti da un articolo casuale di Wikipedia. Raggiungi l'articolo dell'
            <strong className="bg-neo-pink text-neo-on-accent px-1.5 py-0.5 border-2 border-neo-black shadow-neo-sm inline-block my-1 font-bold">
              Università degli Studi di Napoli Federico II
            </strong>{' '}
            nel minor tempo e col minor numero di click possibili.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              variant="primary"
              size="lg"
              icon="play_arrow"
              onClick={() => navigate('/game')}
            >
              Inizia Sfida Ora
            </Button>

            {!user && (
              <Button
                variant="secondary"
                size="lg"
                icon="person_add"
                onClick={() => navigate('/register')}
              >
                Crea Account
              </Button>
            )}
          </div>
        </section>

        {/* How it Works / Rules Grid */}
        <section aria-label="Come Funziona" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="yellow" title="1. Partenza Casuale" icon="shuffle">
            <p className="font-inter text-sm leading-relaxed text-neo-on-accent font-medium">
              Il sistema sceglie un articolo iniziale casuale su Wikipedia. Dovrai orientarti rapidamente tra le prime righe di testo.
            </p>
          </Card>

          <Card variant="cyan" title="2. Segui i Link" icon="ads_click">
            <p className="font-inter text-sm leading-relaxed text-neo-on-accent font-medium">
              Clicca sui collegamenti nel testo degli articoli per navigare. Ogni click conta ai fini della classifica!
            </p>
          </Card>

          <Card variant="pink" title="3. Raggiungi Unina" icon="flag">
            <p className="font-inter text-sm leading-relaxed text-neo-on-accent font-medium">
              Trova la rotta più breve verso l'Università Federico II per scalare la classifica ed entrare tra i top speedrunner.
            </p>
          </Card>
        </section>

        {/* Recent Runs Section */}
        <section aria-label="Sfide Recenti" className="flex flex-col gap-4">
          <h2 className="font-space font-black text-xl sm:text-2xl uppercase tracking-tight inline-block bg-neo-yellow text-neo-on-accent border-3 border-neo-black shadow-neo px-4 py-2 self-start">
            Ultime Sfide Completate
          </h2>

          {loading ? (
            <div className="text-center py-8 font-mono font-bold text-neo-black" role="status">
              Caricamento sfide...
            </div>
          ) : completedGames.length === 0 ? (
            <Card variant="neutral">
              <p className="font-inter text-sm text-center text-neo-black font-medium">
                Nessuna sfida ancora completata. Sii il primo a completare la run!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {completedGames.slice(0, 3).map((g) => (
                <article key={g.id} className="card-neo p-6 flex flex-col justify-between gap-4">
                  <header className="border-b-3 border-neo-black pb-2 flex justify-between items-center gap-2">
                    <span className="font-space font-bold text-base sm:text-lg truncate text-neo-black">
                      {g.user?.username || 'Anonimo'}
                    </span>
                    <span className="bg-neo-black text-neo-yellow px-2 py-0.5 border border-neo-black font-mono text-xs font-bold shrink-0">
                      {g.clickCount} Clicks
                    </span>
                  </header>

                  <div className="space-y-2 font-inter text-sm">
                    <div className="flex justify-between items-center border-b border-dashed border-gray-400 pb-1">
                      <span className="font-mono text-xs uppercase font-bold text-neo-black">Tempo:</span>
                      <span className="font-mono font-bold bg-neo-pink text-neo-on-accent px-2 py-0.5 border border-neo-black text-xs">
                        {formatSeconds(g.durationSeconds)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs uppercase font-bold text-neo-black">Start:</span>
                      <span className="font-bold truncate max-w-[140px] text-neo-black" title={g.startPageTitle}>
                        {g.startPageTitle}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default HomePage;
