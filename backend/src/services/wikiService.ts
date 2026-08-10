import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { LRUCache } from 'lru-cache';
import { AppError } from '../middlewares/errorMiddleware';

/**
 * Structured Wikipedia article content returned by WikiService.
 */
export interface WikiArticleContent {
  /**
   * Canonical title of the Wikipedia article.
   */
  title: string;

  /**
   * Parsed and sanitized HTML markup of the article body.
   */
  htmlContent: string;

  /**
   * Array of valid internal Wikipedia page titles linked in namespace 0 (main encyclopedia namespace).
   */
  validLinks: string[];
}

/**
 * Raw link object returned inside the Wikipedia parse API response.
 */
export interface WikiParseLink {
  /**
   * Namespace number (0 indicates standard encyclopedia article).
   */
  ns?: number;

  /**
   * Target article page title.
   */
  '*'?: string;

  /**
   * Marker indicating whether the target page exists.
   */
  exists?: string;
}

/**
 * Raw Wikipedia API response structure for parse queries.
 */
export interface WikiParseApiResponse {
  parse?: {
    title?: string;
    pageid?: number;
    text?: {
      '*'?: string;
    };
    links?: WikiParseLink[];
  };
  error?: {
    code?: string;
    info?: string;
  };
}

/**
 * Raw Wikipedia API response structure for random queries.
 */
export interface WikiRandomApiResponse {
  query?: {
    random?: Array<{
      id?: number;
      ns?: number;
      title?: string;
    }>;
  };
  error?: {
    code?: string;
    info?: string;
  };
}

const WIKIPEDIA_API_URL: string = 'https://it.wikipedia.org/w/api.php';
const HTTP_TIMEOUT_MS: number = 10000;
const USER_AGENT_HEADER: string = 'RoadToUnina/1.0 (https://unina.it; info@unina.it)';

/**
 * Wikipedia class names / selectors that represent non-content service elements,
 * warnings, notices, edit buttons, portal navboxes, and Wikidata links to completely strip.
 */
export const STRIP_CLASSES: string[] = [
  'mw-editsection',
  'mw-editsection-like',
  'ambox',
  'tmbox',
  'cmbox',
  'fmbox',
  'navbox',
  'vertical-navbox',
  'wikidatainfobox-edit',
  'wikidata-link',
  'noprint',
  'hatnote',
  'shortcut',
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
 * Sanitization configuration for rendered Wikipedia HTML bodies.
 * Removes service elements completely and converts non-encyclopedic links into plain text.
 */
export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'span', 'div', 'table', 'tbody', 'thead', 'tr', 'th', 'td', 'caption',
    'abbr', 'bdi', 'sup', 'sub', 'figure', 'figcaption',
  ]),
  allowedAttributes: {
    '*': ['class', 'id', 'style', 'title', 'lang', 'dir', 'data-title'],
    'a': ['href', 'title', 'target', 'data-title', 'class'],
    'img': ['src', 'alt', 'width', 'height', 'srcset'],
  },
  allowedSchemes: ['http', 'https', 'data'],
  exclusiveFilter: (frame) => {
    const className = frame.attribs?.class;
    if (className && typeof className === 'string') {
      const classList = className.toLowerCase().split(/\s+/);
      if (
        classList.some(
          (c) =>
            STRIP_CLASSES.includes(c) ||
            STRIP_CLASSES.some((prefix) => c.startsWith(prefix))
        )
      ) {
        return true;
      }
    }
    return false;
  },
  transformTags: {
    'a': (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => {
      const href = attribs['href'] || '';
      const className = attribs['class'] || '';
      const { isValid, targetTitle } = isInternalNamespaceZeroLink(href, className);

      if (!isValid || !targetTitle) {
        // Discard <a> wrapping and render inner text/content inside a plain <span>
        return {
          tagName: 'span',
          attribs: {},
        };
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
 * Normalizes an article title to a deterministic LRU cache key.
 *
 * @param {string} title - Raw Wikipedia title.
 * @returns {string} Normalized cache key.
 */
export function normalizeWikiCacheKey(title: string): string {
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

/**
 * In-memory LRU cache for Wikipedia article content with 1-hour TTL.
 * Maximizes throughput and prevents Wikipedia API rate limiting.
 */
export const wikiArticleCache: LRUCache<string, WikiArticleContent> = new LRUCache<string, WikiArticleContent>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour TTL
});

/**
 * Service managing Italian Wikipedia API communication, parsing, and caching.
 */
export class WikiService {
  /**
   * Fetches a random article title from Italian Wikipedia in namespace 0 (main encyclopedia).
   *
   * @returns {Promise<string>} Promise resolving to the title of a random article.
   * @throws {AppError} 502 Bad Gateway if Wikipedia API call fails or returns empty results.
   *
   * @example
   * const randomTitle = await wikiService.getRandomWikiArticle();
   */
  public async getRandomWikiArticle(): Promise<string> {
    try {
      const response = await axios.get<WikiRandomApiResponse>(WIKIPEDIA_API_URL, {
        params: {
          action: 'query',
          list: 'random',
          rnnamespace: 0,
          rnfilterredir: 'nonredirects',
          format: 'json',
        },
        headers: {
          'User-Agent': USER_AGENT_HEADER,
        },
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
   * Retrieves parsed, sanitized HTML content and valid internal namespace 0 links for a Wikipedia article.
   * Leverages LRU caching to minimize remote network latency.
   *
   * @param {string} title - Title of the Wikipedia article to fetch.
   * @returns {Promise<WikiArticleContent>} Object containing title, sanitized htmlContent, and valid link titles.
   * @throws {AppError} 400 if title is empty, 404 if article not found, 502 on upstream API failure.
   *
   * @example
   * const article = await wikiService.getWikiArticleContent('Napoli');
   */
  public async getWikiArticleContent(title: string): Promise<WikiArticleContent> {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new AppError('Invalid or empty Wikipedia article title requested', 400);
    }

    const cacheKey = normalizeWikiCacheKey(title);
    const cachedArticle = wikiArticleCache.get(cacheKey);
    if (cachedArticle) {
      return cachedArticle;
    }

    try {
      const response = await axios.get<WikiParseApiResponse>(WIKIPEDIA_API_URL, {
        params: {
          action: 'parse',
          page: title,
          prop: 'text|links',
          redirects: 1,
          format: 'json',
        },
        headers: {
          'User-Agent': USER_AGENT_HEADER,
        },
        timeout: HTTP_TIMEOUT_MS,
      });

      const data = response.data;
      if (!data || typeof data !== 'object') {
        throw new AppError(`Malformed response from Wikipedia for page: ${title}`, 502);
      }

      if (data.error) {
        throw new AppError(`Wikipedia article not found: ${title}`, 404);
      }

      const parseData = data.parse;
      if (!parseData || typeof parseData !== 'object') {
        throw new AppError(`Failed to parse Wikipedia article: ${title}`, 502);
      }

      const articleTitle: string = String(parseData.title || title);
      const rawHtmlContent: string = typeof parseData.text?.['*'] === 'string' ? parseData.text['*'] : '';
      const cleanHtmlContent: string = sanitizeHtml(rawHtmlContent, SANITIZE_OPTIONS);

      const rawLinks: WikiParseLink[] = Array.isArray(parseData.links) ? parseData.links : [];
      const validLinks: string[] = rawLinks
        .filter((link): link is WikiParseLink & { '*': string } => {
          if (!link || link.ns !== 0 || typeof link['*'] !== 'string') return false;
          const trimmed = link['*'].trim();
          if (trimmed.length === 0) return false;
          const lower = trimmed.toLowerCase();
          return !NON_ENC_NAMESPACES.some((ns) => lower.startsWith(ns));
        })
        .map((link) => link['*'].trim());

      const result: WikiArticleContent = {
        title: articleTitle,
        htmlContent: cleanHtmlContent,
        validLinks,
      };

      wikiArticleCache.set(cacheKey, result);
      wikiArticleCache.set(normalizeWikiCacheKey(articleTitle), result);

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Error fetching content for page: ${title}`, 502);
    }
  }

  /**
   * Flushes the in-memory Wikipedia LRU cache.
   *
   * @returns {void}
   */
  public clearCache(): void {
    wikiArticleCache.clear();
  }
}

export const wikiService: WikiService = new WikiService();
