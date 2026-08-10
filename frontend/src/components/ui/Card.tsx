import React from 'react';

/** Neobrutalist background variant options for Card container */
export type CardVariant = 'white' | 'yellow' | 'cyan' | 'pink' | 'neutral';

/**
 * Component props for Card extending HTML div attributes.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Color theme variant of card background */
  variant?: CardVariant;
  /** Optional title text rendered in card header bar */
  title?: string;
  /** Material Symbols icon identifier string for header title */
  icon?: string;
  /** Optional React element rendered on right side of card header */
  headerAction?: React.ReactNode;
}

/**
 * Reusable Neobrutalist container Card component supporting header bars and themes.
 *
 * @param props - Component props matching CardProps.
 * @example
 * ```tsx
 * <Card variant="yellow" title="Rules" icon="menu_book">
 *   <p>Follow internal links to target page.</p>
 * </Card>
 * ```
 */
export const Card: React.FC<CardProps> = ({
  variant = 'white',
  title,
  icon,
  headerAction,
  children,
  className = '',
  ...props
}) => {
  const getCardBg = () => {
    switch (variant) {
      case 'yellow':
        return 'card-neo-yellow';
      case 'cyan':
        return 'card-neo-cyan';
      case 'pink':
        return 'card-neo-pink';
      case 'neutral':
        return 'bg-surface-container border-3 border-neo-black shadow-neo text-neo-black';
      case 'white':
      default:
        return 'card-neo';
    }
  };

  const isAccent = variant === 'yellow' || variant === 'cyan' || variant === 'pink';

  return (
    <div className={`${getCardBg()} ${className}`} {...props}>
      {title && (
        <div
          className={`border-b-3 border-neo-black p-4 flex justify-between items-center text-neo-black ${
            isAccent ? 'bg-neo-surface' : 'bg-surface-container-low'
          }`}
        >
          <h3 className="font-space font-black text-xl uppercase tracking-tight flex items-center gap-2 text-neo-black">
            {icon && <span aria-hidden="true" className="material-symbols-outlined text-2xl text-neo-black">{icon}</span>}
            <span className="text-neo-black font-bold">{title}</span>
          </h3>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={title ? 'p-6' : ''}>{children}</div>
    </div>
  );
};

export default Card;
