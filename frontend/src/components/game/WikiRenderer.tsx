import React, { useRef, useMemo } from 'react';

/**
 * Props for the WikiRenderer component.
 */
export interface WikiRendererProps {
  /** Display title of the Wikipedia article */
  title: string;
  /** Sanitized HTML content string of the article body */
  htmlContent: string;
  /** Navigation callback triggered when an internal Wikipedia link is clicked */
  onNavigate: (targetTitle: string) => void;
  /** Optional callback triggered when an invalid link is clicked or attempted */
  onInvalidLink?: () => void;
  /** Optional loading state boolean displaying an overlay spinner during step fetch */
  loading?: boolean;
}

/**
 * Service elements, notices, edit bars, portal boxes, and Wikidata links to strip from DOM.
 */
export const STRIP_SELECTORS: string[] = [
  '.mw-editsection',
  '.mw-editsection-like',
  '.ambox',
  '.tmbox',
  '.cmbox',
  '.fmbox',
  '.navbox',
  '.vertical-navbox',
  '.wikidatainfobox-edit',
  '.wikidata-link',
  '.noprint',
  '.hatnote',
  '.shortcut',
];

/**
 * Non-encyclopedic Wikipedia namespaces to reject as game links.
 */
export const NON_ENC_NAMESPACES: string[] = [
  'wikipedia:',
  'wp:',
  'aiuto:',
  'speciale:',
  'special:',
  'categoria:',
  'category:',
  'portale:',
  'portal:',
  'discussione:',
  'discussioni:',
  'discussioni_utente:',
  'discussioni_progetto:',
  'discussioni_wikipedia:',
  'discussioni_portale:',
  'discussioni_template:',
  'discussioni_categoria:',
  'discussione_aiuto:',
  'talk:',
  'user:',
  'utente:',
  'file:',
  'immagine:',
  'template:',
  'template_talk:',
  'modulo:',
  'module:',
  'progetto:',
  'project:',
  'mediawiki:',
  'bozza:',
  'guida:',
  'media:',
];

/**
 * Evaluates whether a Wikipedia anchor target represents a valid Namespace 0 internal encyclopedic article.
 *
 * @param {string} href - The href attribute of the anchor.
 * @param {string} [className] - Optional class attribute string of the anchor.
 * @returns {{ isValid: boolean; targetTitle: string | null }} Result object indicating validity and target title.
 */
export function isInternalNamespaceZeroLink(
  href: string,
  className?: string
): { isValid: boolean; targetTitle: string | null } {
  if (!href || typeof href !== 'string') {
    return { isValid: false, targetTitle: null };
  }

  const trimmedHref = href.trim();

  // 1. Intra-page fragment anchors (#cite_note, #mw-head, etc.) and non-http protocols
  if (
    trimmedHref.startsWith('#') ||
    trimmedHref.startsWith('mailto:') ||
    trimmedHref.startsWith('tel:') ||
    trimmedHref.startsWith('javascript:')
  ) {
    return { isValid: false, targetTitle: null };
  }

  // 2. Class check for external or service elements
  if (className && typeof className === 'string') {
    const classes = className.toLowerCase().split(/\s+/);
    if (
      classes.some(
        (c) =>
          c === 'external' ||
          c === 'wikidata-link' ||
          c === 'mw-editsection-like' ||
          c === 'new'
      )
    ) {
      return { isValid: false, targetTitle: null };
    }
  }

  // 3. Query parameters (e.g. action=edit, redlink=1, oldid=)
  if (
    trimmedHref.includes('action=edit') ||
    trimmedHref.includes('redlink=1') ||
    trimmedHref.includes('oldid=') ||
    trimmedHref.includes('/w/index.php') ||
    trimmedHref.includes('action=')
  ) {
    return { isValid: false, targetTitle: null };
  }

  // 4. External URL check (reject domains outside it.wikipedia.org)
  let pathname = trimmedHref;
  if (
    trimmedHref.startsWith('http://') ||
    trimmedHref.startsWith('https://') ||
    trimmedHref.startsWith('//')
  ) {
    try {
      const parsedUrl = new URL(
        trimmedHref.startsWith('//') ? `https:${trimmedHref}` : trimmedHref
      );
      if (
        parsedUrl.hostname !== 'it.wikipedia.org' &&
        parsedUrl.hostname !== 'it.m.wikipedia.org'
      ) {
        return { isValid: false, targetTitle: null };
      }
      pathname = parsedUrl.pathname;
    } catch {
      return { isValid: false, targetTitle: null };
    }
  }

  // 5. Internal link path must begin with /wiki/ or ./
  let rawTitle = '';
  if (pathname.startsWith('/wiki/')) {
    rawTitle = pathname.substring('/wiki/'.length);
  } else if (pathname.startsWith('./')) {
    rawTitle = pathname.substring('./'.length);
  } else {
    return { isValid: false, targetTitle: null };
  }

  // Strip intra-page fragments or remaining parameters from target title
  rawTitle = rawTitle.split('#')[0]!.split('?')[0]!;

  if (!rawTitle || rawTitle.trim().length === 0) {
    return { isValid: false, targetTitle: null };
  }

  let decodedTitle = '';
  try {
    decodedTitle = decodeURIComponent(rawTitle).replace(/_/g, ' ').trim();
  } catch {
    decodedTitle = rawTitle.replace(/_/g, ' ').trim();
  }

  if (!decodedTitle) {
    return { isValid: false, targetTitle: null };
  }

  // Strip redlink notice text if present in title
  decodedTitle = decodedTitle
    .replace(/\s*\(la pagina non esiste\)$/i, '')
    .replace(/\s*\(pagina non esiste\)$/i, '')
    .trim();

  // 6. Namespace check (must not be Wikipedia:, Aiuto:, Categoria:, Portale:, Discussione:, File:, etc.)
  const lowerTitle = decodedTitle.toLowerCase();
  for (const ns of NON_ENC_NAMESPACES) {
    if (lowerTitle.startsWith(ns)) {
      return { isValid: false, targetTitle: null };
    }
  }

  return { isValid: true, targetTitle: decodedTitle };
}

/**
 * Cleans and sanitizes Wikipedia HTML on client side:
 * - Strips all non-encyclopedic service elements, notice boxes, portals, and wikidata buttons from the DOM.
 * - Converts external, non-namespace 0, query, and hash links into plain text spans.
 * - Adds .wiki-chip classes to verified Namespace 0 internal links.
 *
 * @param {string} rawHtml - Raw or partially sanitized Wikipedia HTML.
 * @returns {string} Fully cleaned HTML string.
 */
export function cleanAndSanitizeWikiHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawHtml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // 1. DOM Stripping: Remove service elements, edit sections, notice boxes, portals, and wikidata buttons
    STRIP_SELECTORS.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // 2. Strict Link Filtering: Replace non-encyclopedic links with plain text span
    doc.querySelectorAll('a').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      const className = anchor.getAttribute('class') || '';
      const { isValid, targetTitle } = isInternalNamespaceZeroLink(href, className);

      if (!isValid || !targetTitle) {
        const span = doc.createElement('span');
        span.innerHTML = anchor.innerHTML;
        anchor.replaceWith(span);
      } else {
        anchor.setAttribute('href', `/wiki/${encodeURIComponent(targetTitle.replace(/ /g, '_'))}`);
        anchor.setAttribute('data-title', targetTitle);
        anchor.setAttribute('title', targetTitle);
        anchor.classList.add('wiki-chip');
      }
    });

    return doc.body.innerHTML;
  } catch {
    return rawHtml;
  }
}

/**
 * Component responsible for rendering sanitized Wikipedia HTML content and intercepting link navigation clicks.
 * Adheres to WCAG 2.1 AA/AAA readability standards (left-aligned text, high contrast chips, keyboard support).
 *
 * @param props - Component props matching WikiRendererProps.
 * @example
 * ```tsx
 * <WikiRenderer
 *   title="Napoli"
 *   htmlContent="<p>Napoli è un comune italiano...</p>"
 *   onNavigate={(target) => console.log(target)}
 *   onInvalidLink={() => console.warn('Invalid link')}
 *   loading={false}
 * />
 * ```
 */
export const WikiRenderer: React.FC<WikiRendererProps> = ({
  title,
  htmlContent,
  onNavigate,
  onInvalidLink,
  loading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sanitizedHtml = useMemo(() => {
    return cleanAndSanitizeWikiHtml(htmlContent);
  }, [htmlContent]);

  const processNavigation = (anchor: HTMLAnchorElement) => {
    const href = anchor.getAttribute('href') || '';
    const className = anchor.getAttribute('class') || '';
    const { isValid, targetTitle } = isInternalNamespaceZeroLink(href, className);

    if (!isValid || !targetTitle) {
      if (onInvalidLink) {
        onInvalidLink();
      }
      return;
    }

    if (!loading) {
      onNavigate(targetTitle);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor) {
      e.preventDefault();
      processNavigation(anchor);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        e.preventDefault();
        processNavigation(anchor);
      }
    }
  };

  return (
    <article
      aria-label={`Articolo Wikipedia: ${title}`}
      className="card-neo p-4 sm:p-6 md:p-8 relative min-h-[500px] overflow-hidden"
    >
      {/* Article Header */}
      <header className="border-b-3 border-neo-black pb-4 mb-6 flex justify-between items-end flex-wrap gap-3">
        <h1 className="font-space font-black text-2xl sm:text-3xl md:text-4xl tracking-tight text-neo-black break-words max-w-full">
          {title}
        </h1>
        <span className="font-mono text-xs bg-neo-yellow text-neo-on-accent px-2.5 py-1 border-2 border-neo-black font-bold">
          Wikipedia Sanitized HTML
        </span>
      </header>

      {/* Loading Overlay */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 bg-neo-surface/85 backdrop-blur-xs z-20 flex flex-col items-center justify-center gap-3 p-4"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-5xl animate-spin text-neo-black"
          >
            progress_activity
          </span>
          <span className="font-space font-bold text-base sm:text-lg uppercase bg-neo-yellow text-neo-on-accent px-4 py-2 border-3 border-neo-black shadow-neo-sm text-center">
            Caricamento Articolo...
          </span>
        </div>
      )}

      {/* Wikipedia Rendered Content Container */}
      <div
        ref={containerRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="wiki-content font-inter text-base md:text-lg leading-relaxed text-left text-neo-black space-y-4 select-text break-words overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </article>
  );
};

export default WikiRenderer;
