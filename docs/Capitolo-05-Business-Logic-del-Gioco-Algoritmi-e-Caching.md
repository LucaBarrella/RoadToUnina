# Capitolo 5: Business Logic del Gioco, Algoritmi e Caching

---

## 1. Teoria Fondamentale

### 1.1 Il Pattern Architetturale Service Layer e la Separazione delle Responsabilità (SoC)
In un'applicazione enterprise orientata al web, violare la separazione dei livelli inserendo la logica di business direttamente all'interno dei route handler di Express (*Fat Controllers*) è un grave anti-pattern. 

Il progetto RoadToUnina adotta rigorosamente il pattern **Service Layer**:
1. **Routing Layer (`gameRoutes.ts`)**: Responsabile unicamente degli aspetti legati al protocollo HTTP: ricezione della richiesta, applicazione dei middleware di autenticazione e validazione dei parametri (`validateMiddleware`), invocazione del service competente e serializzazione della risposta (`res.status(200).json(...)`). Non esegue mai query dirette al database né calcoli di stato del gioco.
2. **Service Layer (`gameService.ts`, `wikiService.ts`)**: Contiene la logica di dominio pura (*Business Logic*). È agnostico rispetto al protocollo HTTP (non riceve né `req` né `res`), rendendo le funzioni deterministiche, altamente riutilizzabili e testabili con suite di unit testing isolate.
3. **Data Access Layer (`prisma`)**: Gestisce la persistenza, l'integrità referenziale e le transazioni a basso livello.

```
                  ┌───────────────────────────────┐
                  │    HTTP Client (Vite / SPA)   │
                  └───────────────┬───────────────┘
                                  │ HTTP POST /api/games/:id/step
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Routing Layer (gameRoutes.ts)                                    │
│ - Autenticazione (authMiddleware -> req.user)                    │
│ - Validazione payload (makeStepSchema con Zod)                   │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ targetTitle: string, userId: string
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Business Service Layer (gameService.ts)                          │
│ - Verifica stato IN_PROGRESS e timeout inattività               │
│ - Anti-Cheat Validation (link target contenuto in validLinks)   │
│ - Calcolo condizione di vittoria (TARGET_PAGE_TITLE)             │
│ - Orchestrazione della transazione atomica                       │
└───────────────────┬───────────────────────────────┬──────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌──────────────────────────────┐
│ WikiService & LRU Cache       │   │ Data Access Layer (Prisma)   │
│ - In-memory cache hit/miss    │   │ - Concurrency lock ($tx)     │
│ - Sanitization & parsing HTML │   │ - Creazione GameStep         │
│ - External API integration    │   │ - Commit / Rollback          │
└───────────────────────────────┘   └──────────────────────────────┘
```

---

### 1.2 Algoritmi di Caching in Memoria: La Politica LRU (Least Recently Used)
Quando si interfacciano servizi terzi ad alta latenza o soggetti a rate limit (come l'API di Wikipedia), memorizzare temporaneamente le risposte computate è indispensabile per abbattere i tempi di risposta (da centinaia di millisecondi a microsecondi).

Una cache in-memory non può crescere indefinitamente, altrimenti saturerebbe la memoria RAM del server Node.js portando al crash del processo con `JavaScript heap out of memory`. È necessario stabilire una politica di espulsione (*cache eviction policy*):

#### Principio della cache LRU (Least Recently Used)
La politica LRU sfrutta il **principio di località temporale**: i dati consultati più di recente hanno un'alta probabilità di essere richiesti nuovamente nel prossimo futuro.
- **Struttura Dati Sottostante**: Viene realizzata mediante una combinazione di una **Hash Map** (per accessi $O(1)$ alle chiavi) e una **Doubly Linked List** (lista doppiamente concatenata per tracciare la freschezza degli elementi in $O(1)$).
- **Hit**: Quando un elemento viene letto (`get`), viene spostato in cima alla lista (*Most Recently Used*).
- **Eviction**: Quando la cache raggiunge la sua capienza massima (`max` elementi o `maxSize` in byte), il nodo posizionato in coda alla lista (*Least Recently Used*) viene rimosso fisicamente dalla memoria.
- **TTL (Time-To-Live)**: Impone una data di scadenza assoluta a ciascun record per prevenire la persistenza di dati obsoleti (*stale data*).

---

### 1.3 Resilient Integration Design con API Esterne
Comunicare con servizi HTTP terzi (in questo caso `it.wikipedia.org`) introduce punti di fallimento non deterministici:
1. **Network Latency & Spikes**: Ritardi improvvisi nell'instradamento geografico dei pacchetti.
2. **HTTP Timeouts**: Se il server remoto non risponde, la connessione rischia di rimanere aperta a tempo indefinito, consumando socket del sistema operativo. È imperativo impostare un **timeout perentorio** su ogni chiamata (es. `timeout: 10000` ms con Axios).
3. **Upstream Rate Limiting (HTTP 429 Too Many Requests)**: Wikipedia richiede esplicitamente un header `User-Agent` identificativo. Se il bot non si identifica o supera le quote di traffico, le richieste vengono respinte.
4. **Resilienza e Fallback di Ricerca**: Qualora la pagina cercata contenga lievi discrepanze ortografiche o redirect non lineari, un'architettura resiliente implementa meccanismi di *Search Fallback* ricorsivo prima di arrendersi con un errore 404.

---

### 1.4 Sanificazione del Markup HTML, Prevenzione XSS e Mitigazione SSRF
Nel contesto di una wiki-race, il server deve scaricare pagine HTML arbitrarie e fornirle al client affinché le visualizzi. Questa operazione espone a due rischi di sicurezza catastrofici:

#### 1. Cross-Site Scripting (XSS) Lato Backend
L'HTML grezzo restituito dall'API di Wikipedia potrebbe contenere codice JavaScript malevolo (es. `<script>`, attributi `onload`, `onerror`, o iframe con exploit). Se il server inoltrasse questo markup al frontend, un attaccante potrebbe rubare i token JWT dal `localStorage` o impersonare altri giocatori.
- Il backend impiega la libreria `sanitize-html` con una policy *whitelist-based*: accetta solo tag formattativi essenziali (`<p>`, `<a>`, `<table>`, `<img>`) ed elimina tassativamente qualsiasi script, form, oggetto embed o handler di evento.

#### 2. Server-Side Request Forgery (SSRF)
Un attacco SSRF (*Server-Side Request Forgery*) si verifica quando un utente malintenzionato induce il server backend a effettuare richieste HTTP verso indirizzi arbitrari interni non accessibili dall'esterno (es. `http://localhost:5432` per attaccare PostgreSQL o `http://169.254.169.254` per rubare le credenziali dell'instance metadata in cloud AWS/GCP).
- **Mitigazione**: Il nostro `wikiService` impedisce tassativamente all'utente di specificare URL remoti completi per il fetching. Il client può passare unicamente il titolo dell'articolo (`title`), e il backend concatena rigidamente la risorsa al dominio ufficiale statico `https://it.wikipedia.org/w/api.php`. Inoltre, la funzione `isInternalNamespaceZeroLink` valida rigorosamente che i link appartengano solo al dominio `it.wikipedia.org` e al Namespace enciclopedico principale (Namespace 0).

---

## 2. Il Codice nel Nostro Progetto

### 2.1 File: `backend/src/services/wikiService.ts`
```typescript
import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { LRUCache } from 'lru-cache';
import { AppError } from '../middlewares/errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';

export interface WikiArticleContent {
  title: string;
  htmlContent: string;
  validLinks: string[];
}

const WIKIPEDIA_API_URL = 'https://it.wikipedia.org/w/api.php';
const HTTP_TIMEOUT_MS = 10000;
const USER_AGENT_HEADER = 'RoadToUnina/1.0 (https://unina.it; info@unina.it)';

export const NON_ENC_NAMESPACES = [
  'wikipedia:', 'wp:', 'aiuto:', 'speciale:', 'special:', 'categoria:', 'category:',
  'portale:', 'portal:', 'discussione:', 'talk:', 'user:', 'utente:', 'file:', 'template:'
];

export function isInternalNamespaceZeroLink(
  href: string,
  className?: string
): { isValid: boolean; targetTitle: string | null } {
  if (!href || typeof href !== 'string') return { isValid: false, targetTitle: null };

  const trimmed = href.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('javascript:')) {
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
      return { isValid: false, targetTitle: null };
    }
  }

  let rawTitle = '';
  if (pathname.startsWith('/wiki/')) rawTitle = pathname.slice(6);
  else return { isValid: false, targetTitle: null };

  const cleanHash = rawTitle.split('#')[0] || '';
  rawTitle = cleanHash.split('?')[0] || '';
  if (!rawTitle.trim()) return { isValid: false, targetTitle: null };

  let decoded = '';
  try {
    decoded = decodeURIComponent(rawTitle).replace(/_/g, ' ').trim();
  } catch (_decodeErr) {
    decoded = rawTitle.replace(/_/g, ' ').trim();
  }

  const lower = decoded.toLowerCase();
  if (NON_ENC_NAMESPACES.some(ns => lower.startsWith(ns))) {
    return { isValid: false, targetTitle: null };
  }

  return { isValid: true, targetTitle: decoded };
}

export const wikiArticleCache = new LRUCache<string, WikiArticleContent>({
  max: 200,
  maxSize: 50 * 1024 * 1024,
  sizeCalculation: (entry) => (entry.htmlContent ? entry.htmlContent.length * 2 : 1024) + 1024,
  ttl: 1000 * 60 * 60, // 1 ora di TTL
});
```

### 2.2 File: `backend/src/services/gameService.ts` (Estratto Navigazione Step e Anti-Cheat)
```typescript
export class GameService {
  public async makeStep(userId: string, gameId: string, targetTitle: string): Promise<ActiveGameResponse> {
    const normalizedTarget = normalizeWikiTitle(targetTitle);

    const game = await prisma.game.findFirst({
      where: { id: gameId, userId, status: GameStatus.IN_PROGRESS },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!game) throw new AppError('Active game not found or unauthorized', 404, ErrorCode.GAME_NOT_FOUND);

    // 1. Anti-Cheat: verifica che il link target sia fisicamente presente tra i link validi della pagina corrente
    const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);
    const isLinkValid = currentContent.validLinks.some(link => normalizeWikiTitle(link) === normalizedTarget);

    if (!isLinkValid) {
      throw new AppError(
        `Invalid step: link "${targetTitle}" is not present in "${game.currentPageTitle}"`,
        400,
        ErrorCode.INVALID_STEP
      );
    }

    // 2. Fetch dell'articolo target e calcolo della condizione di vittoria
    const targetArticleContent = await wikiService.getWikiArticleContent(targetTitle);
    const resolvedTitle = targetArticleContent.title;
    const normalizedResolved = normalizeWikiTitle(resolvedTitle);
    const normalizedTargetGoal = normalizeWikiTitle(TARGET_PAGE_TITLE);

    const isVictory = normalizedResolved === normalizedTargetGoal || normalizedTarget === normalizedTargetGoal;

    // 3. Transazione Atomica con Concurrency Guard (Optimistic Concurrency Control)
    const updatedGame = await prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.game.updateMany({
          where: {
            id: gameId,
            userId,
            status: GameStatus.IN_PROGRESS,
            currentPageTitle: game.currentPageTitle,
          },
          data: {
            currentPageTitle: resolvedTitle,
            clickCount: { increment: 1 },
            ...(isVictory ? { status: GameStatus.COMPLETED, endTime: new Date() } : {}),
          },
        });

        if (updateResult.count === 0) {
          throw new AppError('Concurrent step conflict: game state has already advanced', 409, ErrorCode.CONCURRENT_CONFLICT);
        }

        const stepCount = await tx.gameStep.count({ where: { gameId } });

        await tx.gameStep.create({
          data: { gameId, pageTitle: resolvedTitle, stepOrder: stepCount + 1 },
        });

        return tx.game.findUniqueOrThrow({
          where: { id: gameId },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
      },
      { timeout: 10000 }
    );

    return { game: updatedGame, currentArticle: targetArticleContent };
  }
}
```

### 2.3 File: `backend/src/routes/gameRoutes.ts`
```typescript
router.post(
  '/:id/step',
  validateMiddleware(gameIdParamSchema, 'params'),
  validateMiddleware(makeStepSchema, 'body'),
  async (req, res, next) => {
    try {
      const gameId = String(req.params.id);
      const { targetTitle } = req.body as { targetTitle: string };
      const activeGame = await gameService.makeStep(req.user!.id, gameId, targetTitle);
      res.status(200).json(activeGame);
    } catch (error) {
      next(error);
    }
  }
);
```

---

## 3. Disamina Riga per Riga

### 3.1 `backend/src/services/wikiService.ts`
* **Riga 35: `USER_AGENT_HEADER = 'RoadToUnina/1.0 (https://unina.it; info@unina.it)'`**: In conformità alle policy di utilizzo delle API della Wikimedia Foundation, ogni client automatizzato deve fornire un header `User-Agent` descrittivo contenente nome dell'app e contatto. Chiamate anonime o con header standard possono incorrere nel blocco automatico dell'indirizzo IP.
* **Righe 44-52: `NON_ENC_NAMESPACES`**: Array di prefissi non enciclopedici da escludere dalla wiki-race (es. pagine di discussione `talk:`, pagine di servizio `wikipedia:`, o categorie `categoria:`).
* **Righe 61-125: `isInternalNamespaceZeroLink(href, className)`**:
  - Filtra link che iniziano con protocolli non sicuri (`javascript:`, `mailto:`).
  - Riconosce e blocca link esterni o di modifica (`action=edit`, `redlink=1`).
  - Utilizza l'API nativa `URL` per analizzare l'hostname: accetta esclusivamente `it.wikipedia.org` e scarta domini esterni.
  - Decodifica la componente URI (`decodeURIComponent`) e sostituisce gli underscore con spazi (`replace(/_/g, ' ')`), producendo il titolo normalizzato dell'articolo.
* **Righe 147-171: `transformTags` in `sanitizeHtml`**:
  - Trasforma i tag `<img>` aggiungendo gli attributi `loading="lazy"` e `decoding="async"` per non saturare la banda del browser client.
  - Trasforma i link `<a>`: se il link punta a un namespace non enciclopedico o a una pagina non valida, lo degrada a un semplice tag neutro `<span>`, impedendo al giocatore di cliccarlo. Se valido, applica la classe CSS di stile `'wiki-chip'` e fissa l'attributo `data-title`.
* **Righe 204-209: Configurazione `LRUCache`**:
  - `max: 200`: Limite massimo di 200 articoli contemporaneamente presenti in memoria.
  - `maxSize: 50 * 1024 * 1024`: Limite di budget di memoria fisica (50 MegaByte).
  - `sizeCalculation`: Calcola accuratamente l'impronta di memoria di ciascuna voce (`string.length * 2` byte per la codifica UTF-16 di JavaScript + overhead oggetto).
  - `ttl: 1000 * 60 * 60`: Scadenza perentoria di 1 ora per garantire l'allineamento con eventuali modifiche su Wikipedia.

---

### 3.2 `backend/src/services/gameService.ts`
* **Righe 28-35: `normalizeWikiTitle(title)`**: Funzione di normalizzazione fondamentale per garantire la consistenza semantica: converte caratteri codificati percentualmente, trasforma caratteri minuscoli/maiuscoli con `.toLowerCase()` e collassa gli spazi. In questo modo titoli scritti come `Napoli`, `napoli` o `Napoli#Storia` vengono ricondotti alla medesima chiave canonica.
* **Righe 43-45: `isGameExpired(lastActivity)`**: Verifica se dall'ultimo passaggio sono trascorse più di 24 ore (`EXPIRATION_HOURS = 24`). Se il giocatore abbandona una partita aperta per giorni, il server la segna automaticamente come `ABANDONED`, sbloccando la possibilità di iniziarne una nuova.
* **Righe 179-183: Logica Anti-Cheat Indipendente**:
  ```typescript
  const isLinkValid = currentContent.validLinks.some(link => normalizeWikiTitle(link) === normalizedTarget);
  ```
  Il server non si fida ciecamente della transizione comunicata dal client. Carica la pagina di Wikipedia su cui il giocatore si trovava all'ultimo click (`currentPageTitle`) ed esamina l'elenco dei link estratti dal markup ripulito (`validLinks`). Se `targetTitle` non è tra questi, rifiuta immediatamente la mossa sollevando `AppError(..., 400, ErrorCode.INVALID_STEP)`.
* **Righe 185-190: Risoluzione del Goal di Vittoria**: Confronta il titolo normalizzato dell'articolo appena raggiunto con la costante `TARGET_PAGE_TITLE` ("Università degli Studi di Napoli Federico II"). Se coincidono, imposta il flag booleano `isVictory = true`.
* **Righe 194-210: Optimistic Concurrency Control**:
  ```typescript
  const updateResult = await tx.game.updateMany({
    where: { id: gameId, userId, status: GameStatus.IN_PROGRESS, currentPageTitle: game.currentPageTitle },
    data: { currentPageTitle: resolvedTitle, clickCount: { increment: 1 }, ... }
  });
  ```
  Invece di affidarsi a un semplice `update`, la query include nella clausola `WHERE` la pagina corrente registrata all'inizio dell'operazione (`currentPageTitle: game.currentPageTitle`). Se un'altra richiesta concorrente ha già fatto avanzare la partita nel frattempo, la clausola fallisce restituendo `count: 0`. Il service rileva il conflitto e lancia un'eccezione `409 Conflict (CONCURRENT_CONFLICT)`, impedendo a richieste duplicate di falsificare il contatore dei click.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Tentativo di Bypass Anti-Cheat via Tool Esterni (curl / Postman)
* **Domanda del Docente**: *"Un giocatore esperto nota che l'endpoint `/api/games/:id/step` è un'API REST pubblica (seppur autenticata). Decide di aprire una partita partendo da 'Fisica', ignora completamente il frontend e con Postman invia un payload `{"targetTitle": "Università degli Studi di Napoli Federico II"}` per vincere in 1 solo click. Come reagisce il server?"*
* **Risposta dello Studente**: *"Il server rifiuta la mossa con codice `400 Bad Request` e codice applicativo `INVALID_STEP`. Nel nostro `GameService.makeStep`, il backend recupera dal database la pagina su cui la partita si trova attualmente (`Fisica`) e ne estrae la lista canonica di link validi (`currentContent.validLinks`). Poiché nella voce 'Fisica' non esiste alcun link ipertestuale diretto a 'Università degli Studi di Napoli Federico II', il controllo `isLinkValid` risulterà falso. La richiesta viene immediatamente rigettata prima di modificare il database o incrementare il contatore dei click. Il client non può barare poiché le regole del gioco sono convalidate rigorosamente sul server."*

---

### Scenario 4.2: Degrado o Timeout dell'API Esterna di Wikipedia (Status 502)
* **Domanda del Docente**: *"Cosa accade se durante una partita l'API di `it.wikipedia.org` subisce un'interruzione di servizio, va in timeout oltre i 10 secondi o risponde con un errore HTTP 500?"*
* **Risposta dello Studente**: *"La chiamata Axios all'interno di `WikiService.getWikiArticleContent` fallisce scatenando un'eccezione (`AxiosError: timeout of 10000ms exceeded` o `500 Internal Server Error`). Il blocco `catch` intercetta l'eccezione e la rimappa semanticamente in un `AppError('Error fetching content for page...', 502, ErrorCode.WIKI_API_ERROR)`. Questo errore viene gestito dal nostro `errorMiddleware`, che restituisce al client il codice HTTP standard **502 Bad Gateway** (indicando con precisione che il server ha ricevuto una risposta non valida dal server upstream a monte). Il database non viene toccato, lo stato della partita rimane intatto e il server non subisce alcun crash."*

---

### Scenario 4.3: Disattivazione Totale della Cache LRU
* **Domanda del Docente**: *"Quale impatto concreto si verificherebbe se eliminassimo completamente la cache LRU (`wikiArticleCache`) effettuando una richiesta di rete all'API di Wikipedia per ogni singolo click di ogni giocatore?"*
* **Risposta dello Studente**: *"Si verificherebbero tre conseguenze gravissime:
  1. **Latenza di Gioco Decuplicata**: Ogni click del giocatore dovrebbe attendere il round-trip di rete verso i server di Wikimedia e l'esecuzione del parsing, passando da una latenza in memoria di < 1 ms a oltre 300-800 ms, distruggendo l'esperienza utente da speedrun.
  2. **Rate Limiting e Ban IP (HTTP 429)**: Sotto carico concorrente (es. 100 utenti simultanei), il server invierebbe migliaia di richieste al minuto a Wikipedia con lo stesso indirizzo IP, superando le soglie consentite e venendo temporaneamente o definitivamente bannato.
  3. **Consumo Inutile di Banda e CPU**: Il server dovrebbe ri-sanificare con `sanitize-html` lo stesso testo HTML centinaia di volte, saturando il thread V8 di Node.js. Con la cache LRU (budget 50MB, 200 pagine), pagine frequentissime come 'Napoli' o 'Italia' rimangono pronte in RAM."*

---

### Scenario 4.4: Memorizzazione di Riferimenti Mutabili nella Cache LRU
* **Domanda del Docente**: *"Supponiamo che nella cache LRU salviamo direttamente un oggetto JavaScript contenente array o proprietà mutabili (`WikiArticleContent`), e che un metodo nel service modifichi l'array `validLinks.push('hack')`. Qual è il pericolo?"*
* **Risposta dello Studente**: *"In JavaScript, gli oggetti e gli array vengono passati e memorizzati **per riferimento** (*by reference*). Se un controller o un service muta direttamente le proprietà di un oggetto restituito dalla cache, quella modifica si riflette istantaneamente sull'oggetto condiviso in memoria RAM all'interno della cache LRU globale. Tutte le richieste successive di qualsiasi altro utente riceverebbero la versione modificata e corrotta dell'articolo. Per scongiurare questo rischio, le strutture dati devono essere trattate come immutabili (tramite *object spread*, `Object.freeze` o copie difensive), garantendo l'integrità dello stato condiviso in memoria."*

---

### Scenario 4.5: Prevenzione di Attacchi SSRF (Server-Side Request Forgery)
* **Domanda del Docente**: *"Come impedisce la nostra architettura che un attaccante invii come target di navigazione un URL locale come `http://127.0.0.1:5432` o l'indirizzo dei metadati cloud `http://169.254.169.254/latest/meta-data/` per estrarre informazioni riservate dal server?"*
* **Risposta dello Studente**: *"L'architettura neutralizza completamente l'attacco SSRF su due livelli distinti:
  1. **Costruzione Rigida delle Query Upstream**: Il backend non riceve mai dal client un URL di destinazione arbitrario. L'endpoint accetta unicamente il parametro `targetTitle` (una stringa con il titolo della pagina). La URL finale viene assemblata rigidamente nel service fissando l'origine (`const WIKIPEDIA_API_URL = 'https://it.wikipedia.org/w/api.php'`), passando il titolo solo come parametro querystring `page: title`.
  2. **Ispezione Rigorosa dei Link con URL Parsing**: All'interno di `isInternalNamespaceZeroLink`, se un link inizia per `http://` o `https://`, il server esegue il parsing formale con l'oggetto `new URL(trimmed)` e verifica tassativamente che `hostname === 'it.wikipedia.org'`. Qualsiasi link verso IP locali, loopback (`localhost`, `127.0.0.1`) o host interni viene scartato a priori restituendo `{ isValid: false, targetTitle: null }`."*
