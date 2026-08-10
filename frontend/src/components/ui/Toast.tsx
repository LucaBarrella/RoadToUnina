import React, { useEffect } from 'react';

/**
 * Component props for the Toast notification component.
 */
export interface ToastProps {
  /** Notification message string to display */
  message: string;
  /** Visibility toggle boolean flag */
  isOpen: boolean;
  /** Callback triggered when the toast closes via timeout or user action */
  onClose: () => void;
  /** Auto-dismiss duration in milliseconds (defaults to 2500ms / 2.5s) */
  duration?: number;
  /** Material Symbols icon identifier string */
  icon?: string;
  /** Neobrutalist background color variant */
  variant?: 'pink' | 'yellow' | 'cyan';
}

/**
 * Reusable Neobrutalist Toast notification component.
 * Displays discreet floating alerts in the bottom-right corner with auto-dismissal.
 * Complies with WCAG 2.1 AA/AAA accessibility standards with aria-live polite regions.
 *
 * @param props - Component props matching ToastProps.
 * @example
 * ```tsx
 * <Toast
 *   isOpen={true}
 *   message="Link non valido o non enciclopedico"
 *   onClose={() => setIsOpen(false)}
 *   duration={2500}
 * />
 * ```
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  isOpen,
  onClose,
  duration = 2500,
  icon = 'warning',
  variant = 'pink',
}) => {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, message, onClose]);

  if (!isOpen || !message) return null;

  const getBgClass = () => {
    switch (variant) {
      case 'yellow':
        return 'bg-neo-yellow text-neo-on-accent';
      case 'cyan':
        return 'bg-neo-cyan text-neo-on-accent';
      case 'pink':
      default:
        return 'bg-neo-pink text-neo-on-accent';
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm sm:max-w-md ${getBgClass()} border-3 border-neo-black shadow-neo p-3.5 sm:p-4 font-space font-bold text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-150 select-none`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-xl flex-shrink-0">
        {icon}
      </span>
      <span className="flex-1 break-words">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="p-1 hover:bg-black/15 active:translate-y-[1px] transition-all cursor-pointer flex-shrink-0 flex items-center justify-center"
        aria-label="Chiudi notifica"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-lg">
          close
        </span>
      </button>
    </div>
  );
};

export default Toast;
