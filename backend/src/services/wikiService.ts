import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { LRUCache } from 'lru-cache';
import { AppError } from '../middlewares/errorMiddleware';

/** Structured Wikipedia article content. */
export interface WikiArticleContent {
  /** Article canonical title. */
  title: string;
  /** Sanitized HTML content of the article body. */
  htmlContent: string;
  /** Valid internal links (namespace 0). */
  validLinks: string[];
}

/** Raw Wikipedia API parse link object. */
export interface WikiParseLink {
  ns?: number;
  '*'?: string;
}

/** Raw Wikipedia API parse response. */
export interface WikiParseApiResponse {
  parse?: {
    title?: string;
    text?: { '*'?: string };
    links?: WikiParseLink[];
  };
  error?: { code?: string; info?: string };
}

const WIKIPEDIA_API_URL = 'https://it.wikipedia.org/w/api.php';
const HTTP_TIMEOUT_MS = 10000;
const USER_AGENT_HEADER = 'RoadToUnina/1.0 (https://unina.it; info@unina.it)';

/** Selectors and class names of service elements to strip. */
export const STRIP_CLASSES = [
  'mw-editsection', 'mw-editsection-like', 'ambox', 'tmbox', 'cmbox', 'fmbox',
  'navbox', 'vertical-navbox', 'wikidatainfobox-edit', 'wikidata-link',
  'noprint', 'hatnote', 'shortcut',
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
 * Evaluates whether an anchor href points to a valid Namespace 0 article.
 * @param href Anchor target href.
 * @param className Anchor class attribute string.
 * @returns Object with validity status and extracted target title.
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
      const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
      if (parsed.hostname !== 'it.wikipedia.org' && parsed.hostname !== 'it.m.wikipedia.org') {
        return { isValid: false, targetTitle: null };
      }
      pathname = parsed.pathname;
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

  let decoded = '';
  try {
    decoded = decodeURIComponent(rawTitle).replace(/_/g, ' ').trim();
  } catch {
    decoded = rawTitle.replace(/_/g, ' ').trim();
  }

  if (!decoded) return { isValid: false, targetTitle: null };

  decoded = decoded.replace(/\s*\(la pagina non esiste\)$/i, '').replace(/\s*\(pagina non esiste\)$/i, '').trim();

  const lower = decoded.toLowerCase();
  if (NON_ENC_NAMESPACES.some(ns => lower.startsWith(ns))) {
    return { isValid: false, targetTitle: null };
  }

  return { isValid: true, targetTitle: decoded };
}

/** HTML sanitization options for Wikipedia article content. */
export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'span', 'div', 'table', 'tbody', 'thead', 'tr', 'th', 'td', 'caption',
    'abbr', 'bdi', 'sup', 'sub', 'figure', 'figcaption',
  ]),
  allowedAttributes: {
    '*': ['class', 'id', 'style', 'title', 'lang', 'dir', 'data-title'],
    'a': ['href', 'title', 'target', 'data-title', 'class'],
    'img': ['src', 'alt', 'width', 'height', 'srcset', 'loading', 'decoding'],
  },
  allowedSchemes: ['http', 'https', 'data'],
  exclusiveFilter: (frame) => {
    const className = frame.attribs?.class;
    if (className && typeof className === 'string') {
      const classList = className.toLowerCase().split(/\s+/);
      return classList.some(c => STRIP_CLASSES.includes(c) || STRIP_CLASSES.some(prefix => c.startsWith(prefix)));
    }
    return false;
  },
  transformTags: {
    'img': (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => ({
      tagName: 'img',
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
    'a': (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => {
      const href = attribs['href'] || '';
      const className = attribs['class'] || '';
      const { isValid, targetTitle } = isInternalNamespaceZeroLink(href, className);

      if (!isValid || !targetTitle) {
        return { tagName: 'span', attribs: {} };
      }

      return {
        tagName: 'a',
        attribs: {
          href: `/wiki/${encodeURIComponent(targetTitle.replace(/ /g, '_'))}`,
          'data-title': targetTitle,
          title: targetTitle,
          class: 'wiki-chip',
        },
      };
    },
  },
};

/** Normalizes article title to an LRU cache key. */
export function normalizeWikiCacheKey(title: string): string {
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

/** In-memory LRU cache for Wikipedia article content. */
export const wikiArticleCache = new LRUCache<string, WikiArticleContent>({
  max: 500,
  ttl: 1000 * 60 * 60,
});

/** Service managing Wikipedia API fetching, parsing, link validation, and caching. */
export class WikiService {
  /**
   * Fetches a random article title from Italian Wikipedia (ns=0).
   * @returns Random article title.
   * @throws AppError 502 Bad Gateway if Wikipedia API call fails.
   */
  public async getRandomWikiArticle(): Promise<string> {
    try {
      const response = await axios.get(WIKIPEDIA_API_URL, {
        params: { action: 'query', list: 'random', rnnamespace: 0, rnfilterredir: 'nonredirects', format: 'json' },
        headers: { 'User-Agent': USER_AGENT_HEADER },
        timeout: HTTP_TIMEOUT_MS,
      });

      const randomPages = response.data?.query?.random;
      if (!Array.isArray(randomPages) || randomPages.length === 0 || !randomPages[0]?.title) {
        throw new AppError('Failed to fetch a random article from Wikipedia', 502);
      }
      return String(randomPages[0].title);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error communicating with Wikipedia API', 502);
    }
  }

  /**
   * Retrieves parsed, sanitized HTML content and valid internal links for an article.
   * @param title Title of the Wikipedia article.
   * @returns Article title, sanitized HTML, and array of valid link titles.
   * @throws AppError 400 if title empty, 404 if article not found, 502 on API failure.
   */
  public async getWikiArticleContent(title: string): Promise<WikiArticleContent> {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new AppError('Invalid or empty Wikipedia article title requested', 400);
    }

    const cacheKey = normalizeWikiCacheKey(title);
    const cachedArticle = wikiArticleCache.get(cacheKey);
    if (cachedArticle) return cachedArticle;

    try {
      const response = await axios.get<WikiParseApiResponse>(WIKIPEDIA_API_URL, {
        params: { action: 'parse', page: title, prop: 'text|links', redirects: 1, format: 'json' },
        headers: { 'User-Agent': USER_AGENT_HEADER },
        timeout: HTTP_TIMEOUT_MS,
      });

      const data = response.data;
      if (!data || typeof data !== 'object') {
        throw new AppError(`Malformed response from Wikipedia for page: ${title}`, 502);
      }

      if (data.error) {
        try {
          const searchResponse = await axios.get(WIKIPEDIA_API_URL, {
            params: { action: 'query', list: 'search', srsearch: title, srnamespace: 0, srlimit: 1, format: 'json' },
            headers: { 'User-Agent': USER_AGENT_HEADER },
            timeout: HTTP_TIMEOUT_MS,
          });
          const searchResults = searchResponse.data?.query?.search;
          if (Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0]?.title) {
            return await this.getWikiArticleContent(searchResults[0].title);
          }
        } catch {}

        throw new AppError(`Pagina Wikipedia non trovata per: "${title}"`, 404);
      }

      const parseData = data.parse;
      if (!parseData || typeof parseData !== 'object') {
        throw new AppError(`Failed to parse Wikipedia article: ${title}`, 502);
      }

      const articleTitle = String(parseData.title || title);
      const rawHtmlContent = typeof parseData.text?.['*'] === 'string' ? parseData.text['*'] : '';
      const cleanHtmlContent = sanitizeHtml(rawHtmlContent, SANITIZE_OPTIONS);

      const rawLinks = Array.isArray(parseData.links) ? parseData.links : [];
      const validLinks = rawLinks
        .filter((link): link is WikiParseLink & { '*': string } => {
          if (!link || link.ns !== 0 || typeof link['*'] !== 'string') return false;
          const trimmed = link['*'].trim();
          if (!trimmed) return false;
          const lower = trimmed.toLowerCase();
          return !NON_ENC_NAMESPACES.some(ns => lower.startsWith(ns));
        })
        .map(link => link['*'].trim());

      const result: WikiArticleContent = { title: articleTitle, htmlContent: cleanHtmlContent, validLinks };

      wikiArticleCache.set(cacheKey, result);
      wikiArticleCache.set(normalizeWikiCacheKey(articleTitle), result);

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Error fetching content for page: ${title}`, 502);
    }
  }

  /** Clears the in-memory Wikipedia LRU cache. */
  public clearCache(): void {
    wikiArticleCache.clear();
  }
}

export const wikiService = new WikiService();


