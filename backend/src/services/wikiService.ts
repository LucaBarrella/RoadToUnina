import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { LRUCache } from 'lru-cache';
import { AppError } from '../middlewares/errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';

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
interface WikiParseLink {
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
 * Evaluates whether an anchor href points to a valid Namespace 0 (main encyclopedic) article.
 *
 * @param href - Anchor target href attribute string.
 * @param className - Optional anchor class attribute string.
 * @returns An object containing `isValid` boolean and the extracted `targetTitle` string or `null`.
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
    } catch (_urlErr) {
      // Invalid URL syntax or malformed URI component
      return { isValid: false, targetTitle: null };
    }
  }

  let rawTitle = '';
  if (pathname.startsWith('/wiki/')) rawTitle = pathname.slice(6);
  else if (pathname.startsWith('./')) rawTitle = pathname.slice(2);
  else return { isValid: false, targetTitle: null };

  const cleanHash = rawTitle.split('#')[0] || '';
  rawTitle = cleanHash.split('?')[0] || '';
  if (!rawTitle.trim()) return { isValid: false, targetTitle: null };

  let decoded = '';
  try {
    decoded = decodeURIComponent(rawTitle).replace(/_/g, ' ').trim();
  } catch (_decodeErr) {
    // Malformed URI percent encoding fallback to raw title
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
    '*': ['class', 'id', 'title', 'lang', 'dir', 'data-title'],
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

/**
 * Normalizes a Wikipedia article title to an LRU cache key by replacing underscores with spaces,
 * trimming whitespace, and converting to lowercase.
 *
 * @param title - Raw Wikipedia article title.
 * @returns Lowercase normalized cache key string.
 */
export function normalizeWikiCacheKey(title: string): string {
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

/**
 * Extracts valid target link titles from sanitized HTML by inspecting `data-title` attributes.
 *
 * @param html - The sanitized HTML string of the Wikipedia article.
 * @returns An array of unique article titles linked within the HTML.
 */
export function extractValidLinksFromHtml(html: string): string[] {
  if (!html) return [];
  const linkSet = new Set<string>();
  const regex = /data-title=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const target = (match[1] || '').trim();
    if (target) linkSet.add(target);
  }
  return Array.from(linkSet);
}

/** In-memory bounded LRU cache for Wikipedia article content (max 200 items, ~50MB budget). */
export const wikiArticleCache = new LRUCache<string, WikiArticleContent>({
  max: 200,
  maxSize: 50 * 1024 * 1024,
  sizeCalculation: (entry) => (entry.htmlContent ? entry.htmlContent.length * 2 : 1024) + 1024,
  ttl: 1000 * 60 * 60,
});

/**
 * Service managing Wikipedia API communication, HTML parsing, link validation, and in-memory LRU caching.
 */
export class WikiService {
  /**
   * Fetches a random encyclopedic article title from Italian Wikipedia (Namespace 0).
   *
   * @returns A Promise resolving to a random article title string.
   * @throws {AppError} 502 Bad Gateway if the Wikipedia API call fails or returns empty data.
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
   * Checks in-memory LRU cache before querying the Wikipedia API.
   *
   * @param title - Title of the Wikipedia article to retrieve.
   * @param depth - Recursion depth for search fallback (defaults to 0, max 1).
   * @returns A Promise resolving to {@link WikiArticleContent} containing title, sanitized HTML, and valid links.
   * @throws {AppError} 400 Bad Request if title is empty or invalid.
   * @throws {AppError} 404 Not Found if the article does not exist on Wikipedia.
   * @throws {AppError} 502 Bad Gateway if the Wikipedia API communication fails.
   */
  public async getWikiArticleContent(title: string, depth = 0): Promise<WikiArticleContent> {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new AppError('Invalid or empty Wikipedia article title requested', 400, ErrorCode.INVALID_WIKI_TITLE);
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
        throw new AppError(`Malformed response from Wikipedia for page: ${title}`, 502, ErrorCode.WIKI_API_ERROR);
      }

      if (data.error) {
        if (depth === 0) {
          try {
            const searchResponse = await axios.get(WIKIPEDIA_API_URL, {
              params: { action: 'query', list: 'search', srsearch: title, srnamespace: 0, srlimit: 1, format: 'json' },
              headers: { 'User-Agent': USER_AGENT_HEADER },
              timeout: HTTP_TIMEOUT_MS,
            });
            const searchResults = searchResponse.data?.query?.search;
            if (Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0]?.title) {
              return await this.getWikiArticleContent(searchResults[0].title, depth + 1);
            }
          } catch (_searchErr) {
            // Wikipedia search fallback failed or returned no match, proceed to throw 404
          }
        }

        throw new AppError(`Pagina Wikipedia non trovata per: "${title}"`, 404, ErrorCode.WIKI_PAGE_NOT_FOUND);
      }

      const parseData = data.parse;
      if (!parseData || typeof parseData !== 'object') {
        throw new AppError(`Failed to parse Wikipedia article: ${title}`, 502, ErrorCode.WIKI_API_ERROR);
      }

      const articleTitle = String(parseData.title || title);
      const rawHtmlContent = typeof parseData.text?.['*'] === 'string' ? parseData.text['*'] : '';
      const cleanHtmlContent = sanitizeHtml(rawHtmlContent, SANITIZE_OPTIONS);

      // Extract validLinks directly from the sanitized HTML visible to the player
      const validLinks = extractValidLinksFromHtml(cleanHtmlContent);

      const result: WikiArticleContent = { title: articleTitle, htmlContent: cleanHtmlContent, validLinks };

      wikiArticleCache.set(cacheKey, result);
      wikiArticleCache.set(normalizeWikiCacheKey(articleTitle), result);

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Error fetching content for page: ${title}`, 502, ErrorCode.WIKI_API_ERROR);
    }
  }

  /**
   * Clears all entries from the in-memory Wikipedia LRU cache.
   */
  public clearCache(): void {
    wikiArticleCache.clear();
  }
}

/**
 * Singleton instance of the {@link WikiService}.
 */
export const wikiService = new WikiService();


