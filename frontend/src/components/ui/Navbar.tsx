import React from 'react';
import { useAuth } from '../../hooks';
import Button from './Button';

/**
 * Props for Navbar header component.
 */
export interface NavbarProps {
  /** Active tab indicator identifier */
  activeTab?: 'game' | 'leaderboard' | 'rules';
  /** Callback fired when user selects a tab navigation button */
  onNavigateTab?: (tab: 'game' | 'leaderboard' | 'rules') => void;
  /** Callback fired when unauthenticated user triggers login/register modal/route */
  onOpenAuthModal?: (mode: 'login' | 'register') => void;
}

/**
 * Global navigation header bar displaying application branding, main routes, and user authentication actions.
 * Fully accessible with semantic roles, keyboard navigation, and touch target sizes >= 44px.
 *
 * @param props - Component props matching NavbarProps.
 * @example
 * ```tsx
 * <Navbar activeTab="game" onNavigateTab={(tab) => console.log(tab)} />
 * ```
 */
export const Navbar: React.FC<NavbarProps> = ({
  activeTab = 'game',
  onNavigateTab,
  onOpenAuthModal,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-neo-surface border-b-3 border-neo-black shadow-neo px-4 md:px-8 py-3 sticky top-0 z-50 flex justify-between items-center w-full text-neo-black">
      {/* Brand Logo Button */}
      <button
        type="button"
        className="flex items-center gap-3 cursor-pointer select-none text-left bg-transparent border-0 p-1 rounded-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 text-neo-black"
        onClick={() => onNavigateTab && onNavigateTab('rules')}
        aria-label="RoadToUnina - Torna alla pagina iniziale"
      >
        <img
          src="/logo.png"
          alt="RoadToUnina Logo"
          className="w-10 h-10 object-contain border-2 border-neo-black shadow-neo-sm bg-neo-yellow p-0.5"
        />
        <span className="font-space font-black text-xl sm:text-2xl uppercase tracking-tighter text-neo-black">
          RoadToUnina
        </span>
      </button>

      {/* Navigation Links */}
      <nav aria-label="Navigazione principale" className="hidden md:flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('game')}
          aria-current={activeTab === 'game' ? 'page' : undefined}
          className={`font-space font-bold uppercase px-4 py-2 min-h-[44px] border-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 ${
            activeTab === 'game'
              ? 'bg-neo-yellow text-neo-on-accent border-neo-black shadow-neo-sm'
              : 'text-neo-black border-transparent hover:border-neo-black hover:bg-neo-cyan hover:text-neo-on-accent'
          }`}
        >
          Gioca
        </button>
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('leaderboard')}
          aria-current={activeTab === 'leaderboard' ? 'page' : undefined}
          className={`font-space font-bold uppercase px-4 py-2 min-h-[44px] border-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 ${
            activeTab === 'leaderboard'
              ? 'bg-neo-yellow text-neo-on-accent border-neo-black shadow-neo-sm'
              : 'text-neo-black border-transparent hover:border-neo-black hover:bg-neo-cyan hover:text-neo-on-accent'
          }`}
        >
          Classifica
        </button>
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('rules')}
          aria-current={activeTab === 'rules' ? 'page' : undefined}
          className={`font-space font-bold uppercase px-4 py-2 min-h-[44px] border-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 ${
            activeTab === 'rules'
              ? 'bg-neo-yellow text-neo-on-accent border-neo-black shadow-neo-sm'
              : 'text-neo-black border-transparent hover:border-neo-black hover:bg-neo-cyan hover:text-neo-on-accent'
          }`}
        >
          Regole
        </button>
      </nav>

      {/* User Actions / Auth Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          role="status"
          aria-label="Stato API: Online"
          className="hidden lg:flex font-mono text-xs text-neo-black bg-surface-container border-2 border-neo-black px-2.5 py-1 font-bold"
        >
          API: Live
        </div>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              role="status"
              aria-label={`Utente connesso: ${user.username}`}
              className="bg-neo-cyan text-neo-on-accent border-3 border-neo-black shadow-neo-sm px-3 py-1.5 min-h-[40px] flex items-center gap-2 font-mono text-sm font-bold"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                person
              </span>
              <span className="max-w-[100px] sm:max-w-[150px] truncate">{user.username}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon="logout"
              onClick={logout}
              aria-label="Disconnetti account"
              title="Disconnetti account"
            >
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
            >
              Accedi
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenAuthModal && onOpenAuthModal('register')}
            >
              Registrati
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
