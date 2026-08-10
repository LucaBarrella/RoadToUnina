import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { wikiService, isInternalNamespaceZeroLink } from '../services/wikiService';
import { AppError } from '../middlewares/errorMiddleware';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('WikiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wikiService.clearCache();
  });

  describe('getRandomWikiArticle', () => {
    it('should return a random article title when API succeeds', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          query: {
            random: [{ title: 'Napoli' }],
          },
        },
      });

      const title = await wikiService.getRandomWikiArticle();
      expect(title).toBe('Napoli');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://it.wikipedia.org/w/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            action: 'query',
            list: 'random',
            rnnamespace: 0,
          }),
        })
      );
    });

    it('should throw AppError 502 if random list is empty', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          query: {
            random: [],
          },
        },
      });

      await expect(wikiService.getRandomWikiArticle()).rejects.toThrow(AppError);
    });

    it('should throw AppError 502 if Wikipedia API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(wikiService.getRandomWikiArticle()).rejects.toThrow(AppError);
    });
  });

  describe('getWikiArticleContent', () => {
    it('should fetch, sanitize HTML, and filter ns=0 valid links', async () => {
      const rawHtml = '<div><p>Welcome to Napoli <script>alert("xss")</script><a href="/wiki/Vesuvio">Vesuvio</a></p></div>';
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          parse: {
            title: 'Napoli',
            text: { '*': rawHtml },
            links: [
              { ns: 0, '*': 'Vesuvio' },
              { ns: 0, '*': 'Campania' },
              { ns: 14, '*': 'Categoria:Città d\'Italia' },
            ],
          },
        },
      });

      const content = await wikiService.getWikiArticleContent('Napoli');

      expect(content.title).toBe('Napoli');
      expect(content.htmlContent).not.toContain('<script>');
      expect(content.htmlContent).toContain('Vesuvio');
      expect(content.htmlContent).toContain('class="wiki-chip"');
      expect(content.validLinks).toEqual(['Vesuvio', 'Campania']);
    });

    it('should completely strip service elements from HTML (mw-editsection, ambox, navbox, wikidata, noprint, hatnote, shortcut)', async () => {
      const rawHtml = `
        <div>
          <div class="mw-editsection"><a href="/w/index.php?title=Napoli&action=edit">modifica</a></div>
          <div class="mw-editsection-like"><span>modifica wikitesto</span></div>
          <table class="ambox ambox-stub"><tr><td>Questa voce è solo un abbozzo.</td></tr></table>
          <div class="tmbox">Discussione avviso</div>
          <div class="cmbox">Categoria avviso</div>
          <div class="fmbox">File avviso</div>
          <div class="navbox">Portale Biografie</div>
          <div class="vertical-navbox">Portale Calcio</div>
          <span class="wikidatainfobox-edit">Modifica su Wikidata</span>
          <a class="wikidata-link" href="https://wikidata.org">Wikidata</a>
          <div class="noprint">Non stampare questo blocco</div>
          <div class="hatnote">Disambiguazione</div>
          <div class="shortcut">WP:NAP</div>
          <p>Napoli è un comune italiano con vista sul <a href="/wiki/Vesuvio">Vesuvio</a>.</p>
        </div>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          parse: {
            title: 'Napoli',
            text: { '*': rawHtml },
            links: [{ ns: 0, '*': 'Vesuvio' }],
          },
        },
      });

      const content = await wikiService.getWikiArticleContent('Napoli');

      expect(content.htmlContent).not.toContain('mw-editsection');
      expect(content.htmlContent).not.toContain('modifica');
      expect(content.htmlContent).not.toContain('modifica wikitesto');
      expect(content.htmlContent).not.toContain('ambox');
      expect(content.htmlContent).not.toContain('Questa voce è solo un abbozzo');
      expect(content.htmlContent).not.toContain('tmbox');
      expect(content.htmlContent).not.toContain('cmbox');
      expect(content.htmlContent).not.toContain('fmbox');
      expect(content.htmlContent).not.toContain('navbox');
      expect(content.htmlContent).not.toContain('Portale Biografie');
      expect(content.htmlContent).not.toContain('vertical-navbox');
      expect(content.htmlContent).not.toContain('Portale Calcio');
      expect(content.htmlContent).not.toContain('wikidatainfobox-edit');
      expect(content.htmlContent).not.toContain('Modifica su Wikidata');
      expect(content.htmlContent).not.toContain('wikidata-link');
      expect(content.htmlContent).not.toContain('noprint');
      expect(content.htmlContent).not.toContain('Non stampare questo blocco');
      expect(content.htmlContent).not.toContain('hatnote');
      expect(content.htmlContent).not.toContain('Disambiguazione');
      expect(content.htmlContent).not.toContain('shortcut');
      expect(content.htmlContent).not.toContain('WP:NAP');
      expect(content.htmlContent).toContain('Napoli è un comune italiano con vista sul');
      expect(content.htmlContent).toContain('<a href="/wiki/Vesuvio" data-title="Vesuvio" title="Vesuvio" class="wiki-chip">Vesuvio</a>');
    });

    it('should transform non-encyclopedic, external, query, and anchor links into plain text spans', async () => {
      const rawHtml = `
        <p>
          Link esterno: <a class="external" href="https://transfermarkt.com/napoli">Transfermarkt</a>.
          Link Wikipedia: <a href="/wiki/Wikipedia:Avvertenze_generali">Avvertenze</a>.
          Link Aiuto: <a href="/wiki/Aiuto:Sommario">Aiuto</a>.
          Link Speciale: <a href="/wiki/Speciale:UltimeModifiche">Ultime modifiche</a>.
          Link Categoria: <a href="/wiki/Categoria:Citt%C3%A0_d%27Italia">Città d'Italia</a>.
          Link Portale: <a href="/wiki/Portale:Campania">Portale Campania</a>.
          Link Discussione: <a href="/wiki/Discussione:Napoli">Discussione</a>.
          Link Parametro: <a href="/w/index.php?title=Napoli&action=edit">Modifica voce</a>.
          Link Redlink: <a href="/w/index.php?title=Sconosciuto&action=edit&redlink=1">Pagina non creata</a>.
          Link Ancora: <a href="#cite_note-1">[1]</a>.
          Link Valido: <a href="/wiki/Campania">Campania</a>.
        </p>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          parse: {
            title: 'Napoli',
            text: { '*': rawHtml },
            links: [
              { ns: 0, '*': 'Campania' },
              { ns: 4, '*': 'Wikipedia:Avvertenze generali' },
              { ns: 14, '*': 'Categoria:Città d\'Italia' },
            ],
          },
        },
      });

      const content = await wikiService.getWikiArticleContent('Napoli');

      // Invalid links must be transformed to spans without href or chip class
      expect(content.htmlContent).toContain('<span>Transfermarkt</span>');
      expect(content.htmlContent).toContain('<span>Avvertenze</span>');
      expect(content.htmlContent).toContain('<span>Aiuto</span>');
      expect(content.htmlContent).toContain('<span>Ultime modifiche</span>');
      expect(content.htmlContent).toContain("<span>Città d'Italia</span>");
      expect(content.htmlContent).toContain('<span>Portale Campania</span>');
      expect(content.htmlContent).toContain('<span>Discussione</span>');
      expect(content.htmlContent).toContain('<span>Modifica voce</span>');
      expect(content.htmlContent).toContain('<span>Pagina non creata</span>');
      expect(content.htmlContent).toContain('<span>[1]</span>');

      // Valid link must remain as <a> with .wiki-chip
      expect(content.htmlContent).toContain('<a href="/wiki/Campania" data-title="Campania" title="Campania" class="wiki-chip">Campania</a>');
      expect(content.validLinks).toEqual(['Campania']);
    });

    it('should throw AppError 404 if Wikipedia returns an error payload', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          error: { code: 'missingtitle', info: 'The page title you specified does not exist.' },
        },
      });

      await expect(wikiService.getWikiArticleContent('NonExistentPage12345')).rejects.toThrow(AppError);
    });
  });

  describe('isInternalNamespaceZeroLink helper', () => {
    it('should correctly identify valid and invalid internal Wikipedia links', () => {
      expect(isInternalNamespaceZeroLink('/wiki/Napoli').isValid).toBe(true);
      expect(isInternalNamespaceZeroLink('/wiki/Napoli').targetTitle).toBe('Napoli');

      expect(isInternalNamespaceZeroLink('/wiki/Vesuvio#Geologia').isValid).toBe(true);
      expect(isInternalNamespaceZeroLink('/wiki/Vesuvio#Geologia').targetTitle).toBe('Vesuvio');

      expect(isInternalNamespaceZeroLink('https://it.wikipedia.org/wiki/Campania').isValid).toBe(true);
      expect(isInternalNamespaceZeroLink('https://it.wikipedia.org/wiki/Campania').targetTitle).toBe('Campania');

      expect(isInternalNamespaceZeroLink('#cite_note-1').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('mailto:info@unina.it').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('https://transfermarkt.com').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Napoli', 'external').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/w/index.php?title=Napoli&action=edit').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Wikipedia:Regole').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Aiuto:Guida').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Speciale:Statistiche').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Categoria:Scienza').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Portale:Storia').isValid).toBe(false);
      expect(isInternalNamespaceZeroLink('/wiki/Discussione:Napoli').isValid).toBe(false);
    });
  });
});
