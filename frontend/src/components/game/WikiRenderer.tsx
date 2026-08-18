import React, { useRef, useMemo, useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

/** Props for the WikiRenderer component. */
export interface WikiRendererProps {
  /** Title of the current Wikipedia article */
  title: string;
  /** Sanitized HTML content received from backend */
  htmlContent: string;
  /** Callback fired when a valid internal link is clicked */
  onNavigate: (targetTitle: string) => void;
  /** Callback fired when an invalid link is clicked */
  onInvalidLink?: () => void;
  /** Loading state flag */
  loading?: boolean;
}

/** Parsed section of a Wikipedia article. */
export interface WikiSection {
  id: number;
  title: string;
  html: string;
  linkCount: number;
}

/** Non-content selectors to strip in client fallback parser. */
export const STRIP_SELECTORS = [
  '.mw-editsection', '.mw-editsection-like', '.ambox', '.tmbox', '.cmbox',
  '.fmbox', '.navbox', '.vertical-navbox', '.wikidatainfobox-edit', '.wikidata-link',
  '.noprint', '.hatnote', '.shortcut', 'a.external',
];

/** Non-encyclopedic Wikipedia namespaces to reject as game links. */
export const NON_ENC_NAMESPACES = [
  'wikipedia:', 'wp:', 'aiuto:', 'speciale:', 'special:', 'categoria:', 'category:',
  'portale:', 'portal:', 'discussione:', 'discussioni:', 'discussioni_utente:',
  'discussioni_progetto:', 'discussioni_wikipedia:', 'discussioni_portale:',
  'discussioni_template:', 'discussioni_categoria:', 'discussione_aiuto:',
  'talk:', 'user:', 'utente:', 'file:', 'immagine:', 'template:', 'template_talk:',
  'modulo:', 'module:', 'progetto:', 'project:', 'mediawiki:', 'bozza:', 'guida:', 'media:',
];

/**
 * Validates whether an anchor href points to a valid Namespace 0 article.
 * @param href Target URL or relative path.
 * @param className Anchor class attribute string.
 * @returns Object with validity status and target title.
 */
export function isInternalNamespaceZeroLink(
  href: string,
  className?: string
): { isValid: boolean; targetTitle: string | null } {
  if (!href || typeof href !== 'string') return { isValid: false, targetTitle: null };
  const trimmed = href.trim();

  if (trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('javascript:')) {
    return { isValid: false, targetTitle: null };
  }

  if (className && typeof className === 'string') {
    const classes = className.toLowerCase().split(/\s+/);
    if (classes.some(c => c === 'external' || c === 'wikidata-link' || c === 'mw-editsection-like' || c === 'new')) {
      return { isValid: false, targetTitle: null };
    }
  }

  if (trimmed.includes('action=edit') || trimmed.includes('redlink=1') || trimmed.includes('oldid=') || trimmed.includes('/w/index.php') || trimmed.includes('action=')) {
    return { isValid: false, targetTitle: null };
  }

  let pathname = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    try {
      const parsedUrl = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
      if (parsedUrl.hostname !== 'it.wikipedia.org' && parsedUrl.hostname !== 'it.m.wikipedia.org') {
        return { isValid: false, targetTitle: null };
      }
      pathname = parsedUrl.pathname;
    } catch {
      return { isValid: false, targetTitle: null };
    }
  }

  let rawTitle = '';
  if (pathname.startsWith('/wiki/')) rawTitle = pathname.slice(6);
  else if (pathname.startsWith('./')) rawTitle = pathname.slice(2);
  else return { isValid: false, targetTitle: null };

  rawTitle = rawTitle.split('#')[0]!.split('?')[0]!;
  if (!rawTitle.trim()) return { isValid: false, targetTitle: null };

  let decodedTitle = '';
  try {
    decodedTitle = decodeURIComponent(rawTitle).replace(/_/g, ' ').trim();
  } catch {
    decodedTitle = rawTitle.replace(/_/g, ' ').trim();
  }

  if (!decodedTitle) return { isValid: false, targetTitle: null };

  decodedTitle = decodedTitle.replace(/\s*\(la pagina non esiste\)$/i, '').replace(/\s*\(pagina non esiste\)$/i, '').trim();

  const lowerTitle = decodedTitle.toLowerCase();
  if (NON_ENC_NAMESPACES.some(ns => lowerTitle.startsWith(ns))) {
    return { isValid: false, targetTitle: null };
  }

  return { isValid: true, targetTitle: decodedTitle };
}

/** Normalizes Wikipedia links and applies DOMPurify client-side sanitization. */
export function normalizeWikiLinks(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // Defense-in-depth: run DOMPurify to strip XSS, event handlers, and javascript URIs
  const purified = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'span', 'div', 'a', 'b', 'strong', 'i', 'em', 'u', 's', 'small',
      'table', 'tbody', 'thead', 'tr', 'th', 'td', 'caption', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'br',
      'img', 'abbr', 'bdi', 'sup', 'sub', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: ['class', 'id', 'title', 'lang', 'dir', 'data-title', 'href', 'src', 'alt', 'width', 'height', 'loading', 'decoding'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return purified;

  try {
    const doc = new DOMParser().parseFromString(purified, 'text/html');
    STRIP_SELECTORS.forEach(selector => doc.querySelectorAll(selector).forEach(el => el.remove()));
    doc.querySelectorAll('a').forEach((anchor) => {
      const dataTitle = anchor.getAttribute('data-title');
      if (dataTitle && anchor.classList.contains('wiki-chip')) {
        return;
      }
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
    return purified;
  }
}

/** Parses article HTML into <h2> sections for lazy rendering. */
export function parseWikiSections(html: string): WikiSection[] {
  if (!html) return [];
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const sections: WikiSection[] = [];
  let match: RegExpExecArray | null;
  let sectionIndex = 0;
  const matches: Array<{ title: string; index: number; fullMatchLength: number }> = [];

  while ((match = h2Regex.exec(html)) !== null) {
    const cleanHeading = (match[1] || '').replace(/<[^>]*>/g, '').trim();
    matches.push({ title: cleanHeading || `Sezione ${sectionIndex + 1}`, index: match.index, fullMatchLength: match[0].length });
  }

  if (matches.length === 0) {
    const chipMatches = html.match(/class=["']wiki-chip["']/g);
    return [{ id: 0, title: 'Articolo Completo', html, linkCount: chipMatches ? chipMatches.length : 0 }];
  }

  const firstMatch = matches[0];
  if (firstMatch) {
    const introHtml = html.substring(0, firstMatch.index).trim();
    if (introHtml.length > 0) {
      const chipMatches = introHtml.match(/class=["']wiki-chip["']/g);
      sections.push({ id: 0, title: 'Introduzione & Panoramica', html: introHtml, linkCount: chipMatches ? chipMatches.length : 0 });
      sectionIndex++;
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (!current) continue;
    const next = matches[i + 1];
    const sectionHtml = html.substring(current.index + current.fullMatchLength, next ? next.index : html.length).trim();
    const chipMatches = sectionHtml.match(/class=["']wiki-chip["']/g);
    sections.push({ id: sectionIndex, title: current.title, html: sectionHtml, linkCount: chipMatches ? chipMatches.length : 0 });
    sectionIndex++;
  }

  return sections;
}

/** Extracts target titles from .wiki-chip links. */
export function extractQuickLinks(html: string): string[] {
  if (!html) return [];
  const linkSet = new Set<string>();
  const regex = /data-title=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]?.trim()) linkSet.add(match[1].trim());
  }
  return Array.from(linkSet);
}

/** Wikipedia Article Renderer with link event delegation and section accordion. */
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

  const sanitizedHtml = useMemo(() => normalizeWikiLinks(htmlContent), [htmlContent]);
  const sections = useMemo(() => parseWikiSections(sanitizedHtml), [sanitizedHtml]);
  const allAvailableLinks = useMemo(() => extractQuickLinks(sanitizedHtml), [sanitizedHtml]);

  useEffect(() => {
    setSearchQuery('');
    const allOpen: Record<number, boolean> = {};
    sections.forEach(s => { allOpen[s.id] = true; });
    setOpenSections(allOpen);
  }, [title, sections]);


  const filteredQuickLinks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allAvailableLinks.filter(link => link.toLowerCase().includes(q)).slice(0, 30);
  }, [searchQuery, allAvailableLinks]);

  const toggleSection = (id: number) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllSections = () => {
    const allOpen: Record<number, boolean> = {};
    sections.forEach(s => { allOpen[s.id] = true; });
    setOpenSections(allOpen);
  };

  const collapseAllSections = () => setOpenSections({ 0: true });

  const processNavigation = (targetTitle: string) => {
    if (!targetTitle) {
      onInvalidLink?.();
      return;
    }
    if (!loading) onNavigate(targetTitle);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;

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
      onInvalidLink?.();
    } else {
      processNavigation(targetTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      const anchor = (e.target as HTMLElement).closest('a');
      if (anchor) {
        e.preventDefault();
        anchor.click();
      }
    }
  };

  return (
    <article
      aria-label={`Articolo Wikipedia: ${title}`}
      className="card-neo p-4 sm:p-6 md:p-8 relative min-h-[500px] overflow-hidden transition-all"
    >
      <header className="border-b-3 border-neo-black pb-4 mb-6 flex justify-between items-start flex-wrap gap-3">
        <div className="space-y-1 max-w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-neo-yellow text-neo-on-accent px-2.5 py-1 border-2 border-neo-black font-bold">
              ⚡ Ultra-Fast Engine
            </span>
            <span className="font-mono text-xs bg-neo-cyan text-neo-on-accent px-2.5 py-1 border-2 border-neo-black font-bold">
              🔗 {allAvailableLinks.length} Link
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

        {sections.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={expandAllSections} className="btn-neo-outline text-xs py-1.5 px-3 min-h-0">
              📖 Espandi Tutte
            </button>
            <button type="button" onClick={collapseAllSections} className="btn-neo-outline text-xs py-1.5 px-3 min-h-0">
              📕 Compatta
            </button>
          </div>
        )}
      </header>

      <div className="mb-6 bg-neo-surface border-3 border-neo-black shadow-neo-sm p-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-neo-black text-xl select-none">
            search
          </span>
          <input
            type="text"
            id="wiki-link-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca un link nella pagina..."
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

        {searchQuery.trim().length > 0 && (
          <div className="mt-3 pt-3 border-t-2 border-dashed border-neo-black">
            <div className="font-space font-bold text-xs uppercase mb-2 flex justify-between">
              <span>Risultati ricerca rapida ({filteredQuickLinks.length})</span>
              {filteredQuickLinks.length >= 30 && (
                <span className="text-neo-text-muted font-mono">(Primi 30)</span>
              )}
            </div>
            {filteredQuickLinks.length === 0 ? (
              <p className="text-sm font-inter text-neo-text-muted italic">Nessun link corrispondente trovato.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                {filteredQuickLinks.map((linkTitle) => (
                  <button
                    key={linkTitle}
                    type="button"
                    onClick={() => processNavigation(linkTitle)}
                    className="wiki-chip text-left text-sm"
                  >
                    🔗 {linkTitle}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div role="status" aria-live="polite" className="absolute inset-0 bg-neo-surface/85 backdrop-blur-xs z-20 flex flex-col items-center justify-center gap-3 p-4">
          <span aria-hidden="true" className="material-symbols-outlined text-5xl animate-spin text-neo-black">
            progress_activity
          </span>
          <span className="font-space font-bold text-base sm:text-lg uppercase bg-neo-yellow text-neo-on-accent px-4 py-2 border-3 border-neo-black shadow-neo-sm text-center">
            Caricamento Articolo...
          </span>
        </div>
      )}

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
            <section key={`${title}-sec-${section.id}`} className="wiki-section border-b-2 border-neo-black/20 pb-4 last:border-b-0">
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

