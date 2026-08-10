import React from 'react';

/** Variant styles supported by the neobrutalist Button component */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';

/** Size options supported by the Button component */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Component props for Button extending standard HTML button attributes.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant style theme */
  variant?: ButtonVariant;
  /** Size dimension modifier */
  size?: ButtonSize;
  /** Material Symbols icon identifier string */
  icon?: string;
  /** Loading state indicator displaying a spinning progress icon */
  loading?: boolean;
}

/**
 * Reusable Neobrutalist action button component with loading state and icon support.
 * Compliant with WCAG 2.1 AA/AAA contrast and minimum touch target size.
 *
 * @param props - Component props matching ButtonProps.
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" icon="play_arrow" onClick={handlePlay}>
 *   Start Game
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'secondary':
        return 'btn-neo-secondary';
      case 'danger':
        return 'btn-neo-danger';
      case 'success':
        return 'btn-neo-success';
      case 'outline':
        return 'btn-neo-outline';
      case 'primary':
      default:
        return 'btn-neo-primary';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 min-h-[40px] text-xs sm:text-sm';
      case 'lg':
        return 'px-8 py-4 min-h-[48px] text-lg sm:text-xl tracking-wider';
      case 'md':
      default:
        return 'px-6 py-3 min-h-[44px] text-base';
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      className={`${getVariantClass()} ${getSizeClass()} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span aria-hidden="true" className="material-symbols-outlined animate-spin text-xl">
          progress_activity
        </span>
      ) : icon ? (
        <span aria-hidden="true" className="material-symbols-outlined text-xl">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
