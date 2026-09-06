import React from 'react';

/**
 * Variant styles supported by the neobrutalist Button component.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';

/**
 * Size dimension options supported by the Button component.
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-neo-primary',
  secondary: 'btn-neo-secondary',
  danger: 'btn-neo-danger',
  success: 'btn-neo-success',
  outline: 'btn-neo-outline',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 min-h-[40px] text-xs sm:text-sm',
  md: 'px-6 py-3 min-h-[44px] text-base',
  lg: 'px-8 py-4 min-h-[48px] text-lg sm:text-xl tracking-wider',
};

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
 * @returns React button element.
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
  const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      className={`${variantClass} ${sizeClass} ${
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
