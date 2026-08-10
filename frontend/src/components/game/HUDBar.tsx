import React from 'react';
import Button from '../ui/Button';

/**
 * Props for the HUDBar component.
 */
export interface HUDBarProps {
  /** Title of the current Wikipedia article */
  currentTitle: string;
  /** Title of the target goal Wikipedia article */
  targetTitle: string;
  /** Real-time elapsed game time in seconds */
  elapsedSeconds: number;
  /** Current click count recorded for active run */
  clickCount: number;
  /** Callback fired when user requests to abandon current game session */
  onAbandon?: () => void;
}

/**
 * Sticky heads-up display (HUD) bar component showing current game progress, timer, click counter, and controls.
 * Fully optimized for WCAG 2.1 AA contrast and adaptive Dark/Light mode.
 *
 * @param props - Component props matching HUDBarProps.
 * @example
 * ```tsx
 * <HUDBar
 *   currentTitle="Informatica"
 *   targetTitle="Università degli Studi di Napoli Federico II"
 *   elapsedSeconds={42}
 *   clickCount={3}
 *   onAbandon={handleAbandon}
 * />
 * ```
 */
export const HUDBar: React.FC<HUDBarProps> = ({
  currentTitle,
  targetTitle,
  elapsedSeconds,
  clickCount,
  onAbandon,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <aside
      aria-label="Pannello di controllo della partita (HUD)"
      className="bg-neo-surface border-3 border-neo-black shadow-neo p-3 sm:p-4 w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 max-w-full"
    >
      {/* Article Status Indicators */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap min-w-0">
        <div className="flex flex-col min-w-0 max-w-full">
          <span className="font-mono text-xs font-bold text-neo-black uppercase tracking-wider">
            Articolo Attuale
          </span>
          <span
            title={currentTitle}
            className="bg-neo-cyan text-neo-on-accent px-3 py-1.5 border-3 border-neo-black shadow-neo-sm font-space font-bold text-xs sm:text-sm md:text-base truncate max-w-[200px] sm:max-w-xs md:max-w-sm"
          >
            {currentTitle || 'In attesa...'}
          </span>
        </div>

        <div className="flex flex-col min-w-0 max-w-full">
          <span className="font-mono text-xs font-bold text-neo-black uppercase tracking-wider">
            Obiettivo Finale
          </span>
          <span
            title={targetTitle}
            className="bg-neo-yellow text-neo-on-accent px-3 py-1.5 border-3 border-neo-black shadow-neo-sm font-space font-bold text-xs sm:text-sm md:text-base truncate max-w-[200px] sm:max-w-xs md:max-w-sm"
          >
            {targetTitle}
          </span>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 flex-wrap">
        {/* Timer */}
        <div
          role="status"
          aria-label={`Tempo trascorso: ${formatTime(elapsedSeconds)}`}
          className="bg-neo-pink text-neo-on-accent px-3 sm:px-4 py-2 border-3 border-neo-black shadow-neo-sm flex items-center gap-1.5 sm:gap-2 min-h-[44px]"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-xl sm:text-2xl">
            timer
          </span>
          <span className="font-mono font-bold text-base sm:text-xl tracking-widest">
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        {/* Clicks */}
        <div
          role="status"
          aria-label={`Conteggio click: ${clickCount}`}
          className="bg-neo-black text-neo-yellow px-3 sm:px-4 py-2 border-3 border-neo-black shadow-neo-sm flex items-center gap-1.5 sm:gap-2 min-h-[44px]"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-xl sm:text-2xl">
            ads_click
          </span>
          <span className="font-mono font-bold text-base sm:text-xl">
            {clickCount} {clickCount === 1 ? 'CLICK' : 'CLICKS'}
          </span>
        </div>

        {/* Abandon Button */}
        {onAbandon && (
          <Button
            variant="danger"
            size="sm"
            icon="warning"
            onClick={onAbandon}
            aria-label="Abbandona la partita attuale"
            title="Abbandona la partita attuale"
            className="min-h-[44px]"
          >
            <span className="hidden xs:inline">Abbandona</span>
          </Button>
        )}
      </div>
    </aside>
  );
};

export default HUDBar;
