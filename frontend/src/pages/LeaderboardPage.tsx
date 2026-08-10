import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLeaderboard } from '../hooks';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

/**
 * Leaderboard page view rendering global speedrun rankings, user stats, and recent game history.
 *
 * @returns React view component for the /leaderboard route.
 */
export const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { leaderboard, completedGames, loading, error, refetch } = useLeaderboard(50);

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-neo-bg bg-dot-pattern p-3 sm:p-4 md:p-8 text-neo-black">
      <main className="max-w-6xl mx-auto flex flex-col gap-6 sm:gap-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neo-surface border-3 border-neo-black shadow-neo p-4 sm:p-6">
          <div>
            <h1 className="font-space font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight flex items-center gap-2 sm:gap-3 text-neo-black">
              <span aria-hidden="true" className="material-symbols-outlined text-3xl sm:text-4xl">
                trophy
              </span>
              Classifica Globale
            </h1>
            <p className="font-inter text-xs sm:text-sm text-neo-black mt-1 font-medium">
              Top speedrunner ordinati per minor numero di click e miglior tempo
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              icon="refresh"
              onClick={refetch}
              aria-label="Aggiorna classifica"
              className="flex-1 sm:flex-initial"
            >
              Aggiorna
            </Button>
            <Button
              variant="primary"
              icon="play_arrow"
              onClick={() => navigate('/game')}
              className="flex-1 sm:flex-initial"
            >
              Gioca Ora
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-neo-pink text-neo-on-accent p-4 border-3 border-neo-black shadow-neo font-space font-bold flex items-center gap-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              warning
            </span>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Main Rankings Table (8 Cols) */}
          <section aria-label="Tabella Classifica" className="md:col-span-8 flex flex-col gap-4">
            <Card variant="white" className="p-0 overflow-x-auto">
              <table className="w-full text-left font-inter border-collapse min-w-[500px]">
                <caption className="sr-only">Classifica Globale Speedrun RoadToUnina</caption>
                <thead>
                  <tr className="bg-neo-yellow text-neo-on-accent border-b-3 border-neo-black font-mono text-xs uppercase font-bold">
                    <th scope="col" className="p-3 sm:p-4 border-r-3 border-neo-black w-16 text-center">
                      Rank
                    </th>
                    <th scope="col" className="p-3 sm:p-4 border-r-3 border-neo-black">
                      Giocatore
                    </th>
                    <th scope="col" className="p-3 sm:p-4 border-r-3 border-neo-black text-center">
                      Miglior Tempo
                    </th>
                    <th scope="col" className="p-3 sm:p-4 border-r-3 border-neo-black text-center">
                      Miglior Click
                    </th>
                    <th scope="col" className="p-3 sm:p-4 text-center">
                      Run Concluse
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center font-mono font-bold text-neo-black" role="status">
                        Caricamento classifica...
                      </td>
                    </tr>
                  ) : leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center font-inter text-neo-black font-medium">
                        Nessuna voce presente in classifica. Completa una run per primo!
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((entry) => (
                      <tr
                        key={entry.user?.id || `rank-${entry.rank}`}
                        className="border-b-2 border-neo-black hover:bg-neo-cyan/20 transition-colors text-neo-black"
                      >
                        <td className="p-3 sm:p-4 border-r-3 border-neo-black text-center">
                          <span
                            className={`inline-block font-mono font-bold px-2 py-0.5 border-2 border-neo-black shadow-neo-sm ${
                              entry.rank === 1
                                ? 'bg-neo-yellow text-neo-on-accent'
                                : entry.rank === 2
                                ? 'bg-surface-container-high text-neo-black'
                                : entry.rank === 3
                                ? 'bg-amber-400 text-neo-on-accent'
                                : 'bg-neo-surface text-neo-black'
                            }`}
                          >
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="p-3 sm:p-4 border-r-3 border-neo-black font-bold text-neo-black">
                          {entry.user?.username || 'Anonimo'}
                        </td>
                        <td className="p-3 sm:p-4 border-r-3 border-neo-black font-mono font-bold text-center">
                          <span className="bg-neo-pink text-neo-on-accent px-2 py-0.5 border border-neo-black text-xs font-bold shadow-neo-sm">
                            {formatSeconds(entry.bestDurationSeconds)}
                          </span>
                        </td>
                        <td className="p-3 sm:p-4 border-r-3 border-neo-black font-mono font-bold text-center text-neo-black">
                          {entry.bestClickCount}
                        </td>
                        <td className="p-3 sm:p-4 font-mono font-bold text-center text-neo-black">
                          {entry.completedGamesCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          </section>

          {/* User Profile & Recent Completed Games Sidebar (4 Cols) */}
          <aside aria-label="Profilo e Storico" className="md:col-span-4 flex flex-col gap-6">
            {user ? (
              <Card variant="cyan" title="Il Tuo Profilo" icon="person">
                <div className="space-y-3 font-inter text-sm text-neo-on-accent">
                  <div className="flex justify-between border-b-2 border-dashed border-neo-black pb-2">
                    <span className="font-mono text-xs uppercase font-bold">Username</span>
                    <span className="font-bold">{user.username}</span>
                  </div>
                  <div className="flex justify-between border-b-2 border-dashed border-neo-black pb-2">
                    <span className="font-mono text-xs uppercase font-bold">Email</span>
                    <span className="font-mono text-xs font-bold truncate max-w-[160px]">{user.email}</span>
                  </div>
                </div>
              </Card>
            ) : (
              <Card variant="yellow" title="Partecipa alla Sfida" icon="stars">
                <p className="font-inter text-sm mb-4 text-neo-on-accent font-medium">
                  Crea un account gratuito per registrare le tue speedrun nella classifica globale.
                </p>
                <Button variant="primary" className="w-full" onClick={() => navigate('/register')}>
                  Registrati Ora
                </Button>
              </Card>
            )}

            {/* Recent Completed Games */}
            <Card variant="white" title="Storico Recente" icon="history">
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {completedGames.slice(0, 5).map((g) => (
                  <div
                    key={g.id}
                    className="p-3 bg-surface-container border-2 border-neo-black shadow-neo-sm font-inter text-xs text-neo-black"
                  >
                    <div className="flex justify-between font-bold mb-1">
                      <span>{g.user?.username || 'Anonimo'}</span>
                      <span className="font-mono font-bold bg-neo-pink text-neo-on-accent px-1.5 py-0.5 border border-neo-black">
                        {formatSeconds(g.durationSeconds)}
                      </span>
                    </div>
                    <div className="text-neo-black font-medium truncate" title={`${g.startPageTitle} ➔ Unina`}>
                      {g.startPageTitle} ➔ Unina
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default LeaderboardPage;
