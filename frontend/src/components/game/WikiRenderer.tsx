import React, { useRef, useMemo, useState, useEffect } from 'react';

/**
 * Props for the WikiRenderer component.
 */
export interface WikiRendererProps {
  /** Title of the current Wikipedia article */
  title: string;
  /** Sanitized HTML content received from backend */
  htmlContent: string;
  /** Callback fired when a valid internal link is clicked or selected */
  onNavigate: (targetTitle: string) => void;
  /** Optional callback fired when an invalid or stripped link is clicked */
  onInvalidLink?: () => void;
  /** Loading state flag indicating an active navigation request */
  loading?: boolean;
}

/**
 * Represents a parsed section of a Wikipedia article.
 */
export interface WikiSection {
  id: number;
  title: string;
  html: string;
  linkCount: number;
}

/**
 * Wikipedia class names that represent non-content service elements to strip if present.
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
  'a.external',
];

/**
 * Non-encyclopedic namespaces to reject.
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
  'talk:',
  'user:',
  'utente:',
  'file:',
  'immagine:',
  'template:',
  'template_talk:',
  'modulo:',
  'progetto:',
  'project:',
  'mediawiki:',
  'bozza:',
  'guida:',
  'media:',
];

/**
 * Evaluates whether an anchor link is a valid Namespace 0 internal Wikipedia article.
 */
export function isInternalNamespaceZeroLink(
  href: string,
  className?: string
): { isValid: boolean; targetTitle: string | null } {
  if (!href || typeof href !== 'string') {
    return { isValid: false, targetTitle: null };
  }

  const trimmedHref = href.trim();

  if (
    trimmedHref.startsWith('#') ||
    trimmedHref.startsWith('mailto:') ||
    trimmedHref.startsWith('tel:') ||
    trimmedHref.startsWith('javascript:')
  ) {
    return { isValid: false, targetTitle: null };
  }

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

  if (
    trimmedHref.includes('action=edit') ||
    trimmedHref.includes('redlink=1') ||
    trimmedHref.includes('oldid=') ||
    trimmedHref.includes('/w/index.php') ||
    trimmedHref.includes('action=')
  ) {
    return { isValid: false, targetTitle: null };
  }

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

  let rawTitle = '';
  if (pathname.startsWith('/wiki/')) {
    rawTitle = pathname.substring('/wiki/'.length);
  } else if (pathname.startsWith('./')) {
    rawTitle = pathname.substring('./'.length);
  } else {
    return { isValid: false, targetTitle: null };
  }

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

  decodedTitle = decodedTitle
    .replace(/\s*\(la pagina non esiste\)$/i, '')
    .replace(/\s*\(pagina non esiste\)$/i, '')
    .trim();

  const lowerTitle = decodedTitle.toLowerCase();
  for (const ns of NON_ENC_NAMESPACES) {
    if (lowerTitle.startsWith(ns)) {
      return { isValid: false, targetTitle: null };
    }
  }

  return { isValid: true, targetTitle: decodedTitle };
}

/**
 * Sanitizes raw HTML if needed. Bypasses expensive DOMParser if already processed by backend.
 */
export function cleanAndSanitizeWikiHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // If backend already marked valid links with wiki-chip class, bypass DOMParser
  if (rawHtml.includes('class="wiki-chip"') || rawHtml.includes("class='wiki-chip'")) {
    return rawHtml;
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawHtml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    STRIP_SELECTORS.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    });

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
 * Splits sanitized Wikipedia HTML into logical sections based on <h2> tags.
 */
export function parseWikiSections(html: string): WikiSection[] {
  if (!html) return [];

  // Match <h2> tags and split
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const sections: WikiSection[] = [];
  let match: RegExpExecArray | null;
  let sectionIndex = 0;

  const matches: Array<{ title: string; index: number; fullMatchLength: number }> = [];

  while ((match = h2Regex.exec(html)) !== null) {
    // Strip inner HTML tags from h2 title (e.g. span mw-headline)
    const rawHeading = match[1] || '';
    const cleanHeading = rawHeading.replace(/<[^>]*>/g, '').trim();
    matches.push({
      title: cleanHeading || `Sezione ${sectionIndex + 1}`,
      index: match.index,
      fullMatchLength: match[0].length,
    });
  }

  if (matches.length === 0) {
    // Single section article
    const chipMatches = html.match(/class=["']wiki-chip["']/g);
    return [
      {
        id: 0,
        title: 'Articolo Completo',
        html,
        linkCount: chipMatches ? chipMatches.length : 0,
      },
    ];
  }

  // 1. Intro section (before first <h2>)
  const firstMatch = matches[0];
  if (firstMatch) {
    const introHtml = html.substring(0, firstMatch.index).trim();
    if (introHtml.length > 0) {
      const chipMatches = introHtml.match(/class=["']wiki-chip["']/g);
      sections.push({
        id: 0,
        title: 'Introduzione & Panoramica',
        html: introHtml,
        linkCount: chipMatches ? chipMatches.length : 0,
      });
      sectionIndex++;
    }
  }

  // 2. Subsequent <h2> sections
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (!current) continue;
    const next = matches[i + 1];
    const startIndex = current.index + current.fullMatchLength;
    const endIndex = next ? next.index : html.length;
    const sectionHtml = html.substring(startIndex, endIndex).trim();
    const chipMatches = sectionHtml.match(/class=["']wiki-chip["']/g);

    sections.push({
      id: sectionIndex,
      title: current.title,
      html: sectionHtml,
      linkCount: chipMatches ? chipMatches.length : 0,
    });
    sectionIndex++;
  }

  return sections;
}

/**
 * Extracts all unique target titles linked as .wiki-chip in the article HTML.
 */
export function extractQuickLinks(html: string): string[] {
  if (!html) return [];
  const linkSet = new Set<string>();
  const regex = /data-title=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      linkSet.add(match[1].trim());
    }
  }
  return Array.from(linkSet);
}

/**
 * High-performance Wikipedia Article Renderer with Progressive Lazy Loading,
 * Native CSS content-visibility virtualization, and Instant Link Quick-Search.
 */
export const WikiRenderer: React.FC<WikiRendererProps> = ({
  title,
  htmlContent,
  onNavigate,
  onInvalidLink,
  loading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 0: true });

  const sanitizedHtml = useMemo(() => {
    return cleanAndSanitizeWikiHtml(htmlContent);
  }, [htmlContent]);

  const sections = useMemo(() => {
    return parseWikiSections(sanitizedHtml);
  }, [sanitizedHtml]);

  const allAvailableLinks = useMemo(() => {
    return extractQuickLinks(sanitizedHtml);
  }, [sanitizedHtml]);

  // Open all sections by default so content-visibility auto handles virtualization seamlessly
  useEffect(() => {
    setSearchQuery('');
    const allOpen: Record<number, boolean> = {};
    sections.forEach((s) => {
      allOpen[s.id] = true;
    });
    setOpenSections(allOpen);
  }, [title, sections]);

  const filteredQuickLinks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allAvailableLinks.filter((link) => link.toLowerCase().includes(q)).slice(0, 30);
  }, [searchQuery, allAvailableLinks]);

  const toggleSection = (id: number) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAllSections = () => {
    const allOpen: Record<number, boolean> = {};
    sections.forEach((s) => {
      allOpen[s.id] = true;
    });
    setOpenSections(allOpen);
  };

  const collapseAllSections = () => {
    setOpenSections({ 0: true });
  };

  const processNavigation = (targetTitle: string) => {
    if (!targetTitle) {
      if (onInvalidLink) onInvalidLink();
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
      const dataTitle = anchor.getAttribute('data-title');
      if (dataTitle) {
        processNavigation(dataTitle);
        return;
      }

      const href = anchor.getAttribute('href') || '';
      const className = anchor.getAttribute('class') || '';
      const { isValid, targetTitle } = isInternalNamespaceZeroLink(href, className);

      if (!isValid || !targetTitle) {
        if (onInvalidLink) onInvalidLink();
      } else {
        processNavigation(targetTitle);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        e.preventDefault();
        anchor.click();
      }
    }
  };

  const totalLinksCount = allAvailableLinks.length;

  return (
    <article
      aria-label={`Articolo Wikipedia: ${title}`}
      className="card-neo p-4 sm:p-6 md:p-8 relative min-h-[500px] overflow-hidden transition-all"
    >
      {/* Article Top Header */}
      <header className="border-b-3 border-neo-black pb-4 mb-6 flex justify-between items-start flex-wrap gap-3">
        <div className="space-y-1 max-w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-neo-yellow text-neo-on-accent px-2.5 py-1 border-2 border-neo-black font-bold">
              ⚡ Ultra-Fast Lazy Engine
            </span>
            <span className="font-mono text-xs bg-neo-cyan text-neo-on-accent px-2.5 py-1 border-2 border-neo-black font-bold">
              🔗 {totalLinksCount} Link Disponibili
            </span>
            {sections.length > 1 && (
              <span className="font-mono text-xs bg-neo-surface text-neo-black px-2.5 py-1 border-2 border-neo-black font-bold">
                📑 {sections.length} Sezioni
              </span>
            )}
          </div>
          <h1 className="font-space font-black text-2xl sm:text-3xl md:text-4xl tracking-tight text-neo-black break-words">
            {title}
          </h1>
        </div>

        {/* Section Accordion Quick Controls */}
        {sections.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={expandAllSections}
              className="btn-neo-outline text-xs py-1.5 px-3 min-h-0"
              title="Espandi tutte le sezioni dell'articolo"
            >
              📖 Espandi Tutte
            </button>
            <button
              type="button"
              onClick={collapseAllSections}
              className="btn-neo-outline text-xs py-1.5 px-3 min-h-0"
              title="Collassa le sezioni mantenendo l'introduzione"
            >
              📕 Compatta
            </button>
          </div>
        )}
      </header>

      {/* Speedrunner Quick Link Finder & Filter */}
      <div className="mb-6 bg-neo-surface border-3 border-neo-black shadow-neo-sm p-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-neo-black text-xl select-none"
          >
            search
          </span>
          <input
            type="text"
            id="wiki-link-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca un link nella pagina (es. Napoli, Università, Italia)..."
            className="w-full bg-neo-bg font-inter text-sm md:text-base text-neo-black px-3 py-1.5 border-2 border-neo-black focus:outline-none focus:ring-2 focus:ring-neo-yellow"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-mono font-bold bg-neo-pink text-neo-on-accent px-2 py-1 border-2 border-neo-black"
            >
              Reset
            </button>
          )}
        </div>

        {/* Real-Time Filtered Links Dropdown Chips */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-3 pt-3 border-t-2 border-dashed border-neo-black">
            <div className="font-space font-bold text-xs uppercase mb-2 flex justify-between">
              <span>Risultati ricerca rapida ({filteredQuickLinks.length})</span>
              {filteredQuickLinks.length >= 30 && (
                <span className="text-neo-text-muted font-mono">(Primi 30 mostrati)</span>
              )}
            </div>
            {filteredQuickLinks.length === 0 ? (
              <p className="text-sm font-inter text-neo-text-muted italic">
                Nessun link corrispondente trovato in questa voce.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                {filteredQuickLinks.map((linkTitle) => (
                  <button
                    key={linkTitle}
                    type="button"
                    onClick={() => processNavigation(linkTitle)}
                    className="wiki-chip text-left text-sm"
                    title={`Vai a: ${linkTitle}`}
                  >
                    🔗 {linkTitle}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Main Lazy-Rendered Sections Container */}
      <div
        ref={containerRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="wiki-content font-inter text-base md:text-lg leading-relaxed text-left text-neo-black space-y-4 select-text break-words overflow-x-auto"
      >
        {sections.map((section) => {
          const isOpen = openSections[section.id] ?? false;
          const isIntro = section.id === 0;

          return (
            <section
              key={`${title}-sec-${section.id}`}
              className="wiki-section border-b-2 border-neo-black/20 pb-4 last:border-b-0"
            >
              {/* Section Header Accordion Trigger (for sections after intro) */}
              {!isIntro && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  className="wiki-section-btn"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-xl transition-transform duration-100"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      chevron_right
                    </span>
                    {section.title}
                  </span>
                  <span className="font-mono text-xs bg-neo-yellow text-neo-on-accent px-2 py-0.5 border-2 border-neo-black font-bold">
                    {section.linkCount} Link
                  </span>
                </button>
              )}

              {/* Section Body with CSS Native Virtualization */}
              {(isOpen || isIntro) && (
                <div
                  className="wiki-section-body space-y-3 pt-2"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
};

export default WikiRenderer;
