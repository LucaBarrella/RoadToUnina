# Capitolo 2: Il Server HTTP, Express 5 e la Pipeline dei Middleware

---

## 1. Teoria Fondamentale

### 1.1 L'Architettura a Singolo Thread e l'Event Loop di Node.js
A differenza dei server web multi-thread tradizionali (es. Apache Tomcat o server basati su thread-per-request), **Node.js** adotta un'architettura **single-threaded, non-bloccante e basata su eventi** (*event-driven*). Il codice JavaScript dell'applicazione viene eseguito da un singolo thread all'interno del motore Google V8. 

Per gestire decine di migliaia di connessioni I/O concorrenti senza bloccare l'esecuzione, Node.js si interfaccia con la libreria nativa C **libuv**.

```
   ┌──────────────────────────────────────────────────────────┐
   │                      V8 Call Stack                       │
   │               (Esecuzione codice sincrono)               │
   └─────────────┬──────────────────────────────▲─────────────┘
                 │ Chiamate I/O                 │ Esecuzione
                 │ Asincrone                    │ Callback
                 ▼                              │
   ┌──────────────────────────┐   ┌─────────────┴─────────────┐
   │    libuv Thread Pool     │   │      Event Loop           │
   │  & OS Asynchronous APIs  │   │  (Controllo delle code)   │
   │  (FS, DNS, Crypto, Net)  │   └─────────────▲─────────────┘
   └─────────────┬────────────┘                 │
                 │ Risoluzione                  │ Prelievo
                 ▼                              │
   ┌────────────────────────────────────────────┴─────────────┐
   │ 1. Microtask Queue (process.nextTick, Promise.then)     │
   ├──────────────────────────────────────────────────────────┤
   │ 2. Timers Queue (setTimeout, setInterval)                │
   ├──────────────────────────────────────────────────────────┤
   │ 3. Pending I/O Callbacks (TCP, errors, FS ready)         │
   ├──────────────────────────────────────────────────────────┤
   │ 4. Poll Phase (Nuove connessioni I/O, attesa eventi)     │
   ├──────────────────────────────────────────────────────────┤
   │ 5. Check Phase (setImmediate)                            │
   ├──────────────────────────────────────────────────────────┤
   │ 6. Close Callbacks (socket.on('close'))                  │
   └──────────────────────────────────────────────────────────┘
```

#### Anatomia dei componenti dell'Event Loop:
1. **Call Stack (V8)**: Struttura dati LIFO (*Last In, First Out*) in cui i frame delle funzioni sincrone vengono inseriti ed estratti. Se una funzione occupa il Call Stack per calcoli computazionali pesanti (*CPU-bound*), l'intero server si blocca, rendendosi incapace di rispondere a qualsiasi nuova richiesta HTTP.
2. **libuv & Thread Pool**: Gestisce le operazioni asincrone a basso livello. Per le operazioni su socket di rete sfrutta le primitive asincrone del kernel del sistema operativo (`epoll` su Linux, `kqueue` su macOS, `IOCP` su Windows). Per operazioni bloccanti prive di supporto asincrono nativo nel kernel (come il file system locale o la crittografia `crypto/bcrypt`), libuv impiega un pool interno di thread worker (di default 4 thread).
3. **Code di Esecuzione**:
   - **Microtask Queue**: Possiede la priorità assoluta. Si divide in `process.nextTick` queue e Promise resolution queue (`Promise.then`, `catch`, `finally`, `await`). L'Event Loop svuota l'intera coda dei microtask immediatamente dopo il completamento di ogni singola operazione nel Call Stack, prima di passare a qualunque altra fase.
   - **Macrotask / Event Loop Phases**: Le code attraversate ciclicamente nell'Event Loop: *Timers* -> *Pending I/O* -> *Poll* -> *Check* -> *Close*.

---

### 1.2 Il Modello Client-Server HTTP Stateless e il Protocollo REST
Il protocollo HTTP è intrinsecamente **stateless** (senza stato): il server non conserva traccia della sessione tra una transazione e l'altra a livello di trasporto TCP. Ogni richiesta HTTP inviata dal client deve contenere in sé tutte le informazioni necessarie per essere compresa, validata ed elaborata dal server:
- Metodo HTTP idempotente o safe (`GET`, `HEAD`, `OPTIONS`) o non idempotente (`POST`, `PUT`, `DELETE`).
- Headers di controllo (es. `Authorization: Bearer <token>`, `Content-Type: application/json`).
- Payload (Request Body) e parametri di query o di route.

Nel backend di RoadToUnina, la sessione utente è governata tramite il pattern dei **JSON Web Tokens (JWT)**: il server non salva token in session storage o memory store centralizzati, ma verifica crittograficamente l'integrità del token a ogni singola richiesta.

---

### 1.3 Il Pattern Middleware ad Architettura a Cipolla (Onion Model)
In un framework web come Express, un **middleware** è una funzione che ha accesso all'oggetto richiesta (`Request`), all'oggetto risposta (`Response`) e alla funzione di transizione successiva nella pipeline (`NextFunction`).

La pipeline di Express adotta un'architettura modulare a filtri a catena (*Chain of Responsibility*), concettualmente analoga al modello "a cipolla":

```
  RICHIESTA CLIENT
         │
         ▼
 ┌──────────────────────────────────────────────────────────┐
 │ [1] express.set('trust proxy')                           │
 ├──────────────────────────────────────────────────────────┤
 │ [2] compression() (Gzip / Deflate stream encoder)        │
 ├──────────────────────────────────────────────────────────┤
 │ [3] helmet() (Security Headers HTTP)                     │
 ├──────────────────────────────────────────────────────────┤
 │ [4] cors() (Cross-Origin Resource Sharing Policy)        │
 ├──────────────────────────────────────────────────────────┤
 │ [5] express.json() (Body Parser / Buffer to JSON)        │
 ├──────────────────────────────────────────────────────────┤
 │ [6] Route Limiter (express-rate-limit)                   │
 ├──────────────────────────────────────────────────────────┤
 │ [7] Route Controller & Business Logic (Services)         │
 └──────────────────────────┬───────────────────────────────┘
                            │ (In caso di throw o next(err))
                            ▼
 ┌──────────────────────────────────────────────────────────┐
 │ [8] errorMiddleware (Centralized Error Handling)         │
 └──────────────────────────┬───────────────────────────────┘
                            │
                            ▼
                     RISPOSTA JSON (Client)
```

Ogni middleware può:
- Eseguire codice di pre-elaborazione.
- Modificare gli oggetti `req` e `res` (es. attaccare i claim utente decodificati: `req.user = payload`).
- Interrompere la pipeline inviando una risposta al client (`res.status(403).json(...)`).
- Invocare `next()` per passare il controllo al middleware successivo.
- Invocare `next(err)` o sollevare un'eccezione per instradare il flusso direttamente al middleware di gestione errori a 4 argomenti.

---

### 1.4 La Rivoluzione di Express 5: Gestione Automatica delle Promise Rifiutate
Uno dei cambiamenti più significativi apportati da **Express 5** (utilizzato nella nostra codebase alla versione `^5.2.1`) riguarda la gestione delle funzioni middleware asincrone.

- **In Express 4 (Legacy)**: Se all'interno di una route `async (req, res, next) => { ... }` si verificava un'eccezione non catturata da un blocco `try/catch` (un *unhandled Promise rejection*), Express non intercettava l'errore. La richiesta rimaneva "appesa" fino al timeout del client oppure provocava il crash dell'intero processo Node.js con `UnhandledPromiseRejectionWarning`. Gli sviluppatori erano costretti ad avvolgere ogni controller in boilerplate di tipo `try { ... } catch (err) { next(err); }` o a usare utility wrapper esterne come `express-async-errors`.
- **In Express 5**: Il router interno gestisce nativamente le funzioni che ritornano una `Promise`. Se una Promise viene rigettata (`Promise.reject()` o `throw new AppError()`), Express 5 cattura automaticamente il rifiuto e inoltra l'errore al primo middleware di gestione errori disponibile (`next(err)`), eliminando la necessità di wrapper ridondanti e garantendo la robustezza del server.

---

## 2. Il Codice nel Nostro Progetto

Esaminiamo i due file centrali per l'infrastruttura HTTP del backend: la configurazione dell'ambiente e il server principale.

### 2.1 File: `backend/src/config/env.ts`
```typescript
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION: boolean = NODE_ENV === 'production';
export const IS_TEST: boolean = NODE_ENV === 'test';
export const PORT: number = parseInt(process.env.PORT || '3001', 10);

export const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (IS_TEST) {
      return 'test_super_secret_jwt_key_at_least_32_characters_long_for_vitest';
    }
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  if (secret.length < 32) {
    if (IS_TEST) {
      return 'test_super_secret_jwt_key_at_least_32_characters_long_for_vitest';
    }
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long.');
  }
  return secret;
})();

export const DATABASE_URL: string =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/roadtounina?schema=public';

export const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:80'];
```

### 2.2 File: `backend/src/server.ts` (Estratto Principale della Pipeline)
```typescript
import express, { Express } from 'express';
import cors from 'cors';
import { Server } from 'http';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import authRoutes from './routes/authRoutes';
import gameRoutes from './routes/gameRoutes';
import publicRoutes from './routes/publicRoutes';
import { errorMiddleware, AppError } from './middlewares/errorMiddleware';
import { ErrorCode } from './constants/errorCodes';
import { prisma } from './config/db';
import { IS_PRODUCTION, IS_TEST, PORT, ALLOWED_ORIGINS } from './config/env';

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 50 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

export const gameLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 120 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many game actions, please slow down.' },
});

export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many public requests, please try again later.' },
});

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    if (!IS_PRODUCTION) {
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
    }
    callback(new AppError(`CORS Policy: Origin ${origin} is not permitted`, 403, ErrorCode.CORS_NOT_ALLOWED));
  },
  credentials: true,
};

export const createApp = (): Express => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAPI Documentation & Swagger UI
  app.get('/api/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/games', gameLimiter, gameRoutes);
  app.use('/api/public', publicLimiter, publicRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: ErrorCode.NOT_FOUND,
    });
  });

  app.use(errorMiddleware);
  return app;
};
```

---

## 3. Disamina Riga per Riga

### 3.1 `backend/src/config/env.ts`
* **Righe 1-4: `import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' }); dotenv.config();`**: Il modulo `dotenv` carica le variabili definite nei file `.env` all'interno dell'oggetto globale di Node `process.env`. Viene invocato prima con `.env.local` e poi con il fallback `.env` di default, consentendo configurazioni locali personalizzate che hanno la precedenza e non vengono tracciate da Git.
* **Righe 11-17: `NODE_ENV`, `IS_PRODUCTION`, `IS_TEST`**: Costanti booleane derivate. Isolare flag come `IS_PRODUCTION` e `IS_TEST` previene errori di battitura sparsi nel codice e garantisce un'esecuzione condizionale pulita (es. rate-limiting permissivo durante i test automatizzati).
* **Riga 20: `PORT = parseInt(process.env.PORT || '3001', 10)`**: Esegue il parsing della porta TCP specificando base decimale (`10`). Se la variabile d'ambiente non è impostata (es. su host cloud come Render o Heroku che iniettano dinamicamente `process.env.PORT`), effettua il fallback su `3001`.
* **Righe 26-41: `JWT_SECRET = (() => { ... })()`**: **IIFE (Immediately Invoked Function Expression)** che implementa il pattern architetturale del **Fail-Fast**:
  - Se `JWT_SECRET` è assente nel `.env` o possiede un'entropia crittografica insufficiente (lunghezza minore di 32 caratteri / 256 bit), l'applicazione solleva un'eccezione irreversibile (`throw new Error('FATAL: ...')`) prima ancora che il server web si leghi alla porta di rete.
  - L'unica deroga controllata è riservata all'ambiente di test (`IS_TEST`), dove viene fornito un valore mock deterministico per permettere a Vitest di eseguire i test unitari senza richiedere la configurazione manuale di un `.env`.
* **Righe 49-51: `ALLOWED_ORIGINS`**: Estrae una stringa separata da virgole dalle variabili d'ambiente, la divide in array (`split(',')`), rimuove spazi bianchi (`trim()`) e filtra valori nulli. In assenza di configurazione, ripiega su whitelist locali standard (`5173` per Vite, `3000` per client alternativi, `80` per Docker).

---

### 3.2 `backend/src/server.ts`
* **Riga 6: `import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';`**: Importa il middleware per la limitazione delle richieste HTTP.
* **Righe 19-26: `authLimiter = rateLimit({ ... })`**:
  - `windowMs: 15 * 60 * 1000`: Finestra temporale di accumulo delle richieste (15 minuti).
  - `max: IS_PRODUCTION ? 50 : 1000`: Numero massimo di tentativi permessi per IP nella finestra. Limita a 50 in produzione per mitigare attacchi a forza bruta (*Credential Stuffing*) su login e registrazione.
  - `standardHeaders: true`: Ritorna al client gli header standard IETF (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
  - `legacyHeaders: false`: Disabilita i vecchi header non standard `X-RateLimit-*`.
  - `skip: () => IS_TEST`: Ignora completamente il conteggio se `IS_TEST` è vero, impedendo che i test automatici di integrazione falliscano a causa del superamento della soglia.
* **Righe 29-52: `gameLimiter` e `publicLimiter`**: Applica policy distinte: il rate-limit di gioco è tarato su finestra corta (60 secondi con 120 click max, per prevenire bot di navigazione Wikipedia automatizzata), mentre le route pubbliche consentono fino a 300 richieste ogni 15 minuti.
* **Righe 54-79: `corsOptions` e Origin Validation Functor**:
  - `origin: (origin, callback)`: Funzione dinamica di convalida dell'origine della richiesta.
  - `if (!origin) return callback(null, true);`: Permette le richieste prive di header `Origin` (es. tool da riga di comando `curl`, script interni server-to-server o mobile client nativi).
  - `if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);`: Verifica se l'header `Origin` del browser è esplicitamente registrato nella whitelist.
  - `if (!IS_PRODUCTION) ...`: In ambiente di sviluppo locale, accetta dinamicamente varianti su `localhost` e `127.0.0.1` con qualsiasi porta assegnata da Vite.
  - Altrimenti invoca la callback con un `AppError` avente codice HTTP `403 Forbidden` e codice di dominio `CORS_NOT_ALLOWED`.
  - `credentials: true`: Consente al client l'invio di credenziali (come header Authorization o cookie).
* **Riga 88: `export const createApp = (): Express => {`**: Factory pattern che crea e restituisce una nuova istanza dell'applicazione Express. Permette di isolare l'app Express nei test di integrazione (`supertest(createApp())`) senza dover avviare un listener di rete TCP fisico.
* **Riga 90: `app.set('trust proxy', 1);`**: Istruisce Express a fidarsi del primo reverse proxy a monte (es. Nginx, Cloudflare, o il bilanciatore di carico di Render). Questo consente a middleware come `express-rate-limit` di leggere il vero indirizzo IP del client dall'header `X-Forwarded-For`, anziché bloccare l'IP unico del reverse proxy condiviso da tutti gli utenti.
* **Riga 91: `app.use(compression());`**: Middleware che comprime il payload delle risposte HTTP utilizzando l'algoritmo Gzip o Deflate se supportato dal client (indicato nell'header `Accept-Encoding: gzip`). Riduce drasticamente il consumo di banda sulle risposte che trasferiscono pagine Wikipedia HTML di grandi dimensioni.
* **Riga 92: `app.use(helmet({ ... }));`**: Configura automaticamente 11 header HTTP di sicurezza per proteggere l'applicazione da attacchi comuni:
  - Disabilita l'header `X-Powered-By: Express` (evitando l'identificazione della tecnologia del server).
  - Imposta `X-Content-Type-Options: nosniff` (previene il MIME-type sniffing).
  - Imposta `X-Frame-Options: SAMEORIGIN` (mitiga attacchi di clickjacking).
  - Personalizzazione: `crossOriginResourcePolicy: { policy: 'cross-origin' }` per permettere l'incorporamento di risorse cross-origin, e `contentSecurityPolicy: false` per evitare conflitti con i contenuti e gli stili iniettati dal frontend di gioco.
* **Riga 93: `app.use(cors(corsOptions));`**: Registra il middleware CORS all'inizio della pipeline per gestire le richieste pre-flight (`OPTIONS`) prima che raggiungano i router.
* **Riga 94: `app.use(express.json());`**: Body parser integrato basato su `body-parser`. Analizza lo stream dei dati in ingresso aventi `Content-Type: application/json` e popola l'oggetto `req.body` come dizionario JavaScript.
* **Righe 97-103: `app.get('/api/health', ...)`**: Endpoint di monitoraggio (*Liveness Probe*) per orchestratori cloud (es. Render, Kubernetes). Non interroga il database per minimizzare il consumo di risorse e risponde con lo stato di salute, l'uptime del processo e il timestamp UTC.
* **Righe 105-110: `app.get('/api/openapi.json', ...)` e `app.use('/api/docs', ...)`**: Esposizione formale della specifica OpenAPI 3.0 e montaggio dell'interfaccia interattiva **Swagger UI**. Consente l'ispezione visiva dei contratti API, il testing live delle richieste e funge da fonte di verità per la code-generation automatica dei tipi TypeScript sul frontend (`openapi-typescript`).
* **Righe 112-114: `app.use('/api/auth', authLimiter, authRoutes); ...`**: Montaggio dei sub-router modulari associando a ciascuno il rispettivo rate-limiter dedicato.
* **Righe 110-115: `app.use((_req, res) => { ... 404 });`**: Middleware "catch-all" per route non definite. Poiché è posizionato dopo tutti i router validi, qualsiasi richiesta a un percorso inesistente viene intercettata e riceve una risposta standardizzata JSON con status `404 Not Found`.
* **Riga 117: `app.use(errorMiddleware);`**: Registrazione finale del middleware di gestione centralizzata degli errori. Deve trovarsi rigorosamente all'ultimo posto nella pipeline.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Inversione dell'ordine tra `express.json()` e i Router
* **Domanda del Docente**: *"Cosa accade esattamente se spostiamo la riga `app.use(express.json())` dopo la registrazione delle rotte di autenticazione `app.use('/api/auth', ...)` e un utente invia una richiesta `POST /api/auth/login` con un body JSON valido?"*
* **Risposta dello Studente**: *"La richiesta fallisce con un errore di validazione o un crash a runtime. In Express i middleware vengono eseguiti nell'esatto ordine sequenziale con cui sono registrati. Se `express.json()` si trova sotto le rotte, la richiesta raggiunge il controller di autenticazione prima che lo stream HTTP sia stato intercettato e decodificato: l'oggetto `req.body` risulterà `undefined`. Di conseguenza, qualsiasi tentativo di destrutturazione (es. `const { email, password } = req.body`) solleverà un'eccezione `TypeError: Cannot destructure property 'email' of undefined as it is undefined`, oppure la validazione dello schema Zod fallirà con errore 400."*

---

### Scenario 4.2: Omissione di `next(err)` o Promise rigettata non catturata
* **Domanda del Docente**: *"Cosa accade se all'interno di un middleware personalizzato asincrono si verifica un errore ma non invoco `next(err)` né sollevo un'eccezione?"*
* **Risposta dello Studente**: *"La richiesta HTTP entra in uno stato di stallo permanente (*request hanging*). Express non sa che l'operazione è terminata né che si è verificato un errore, e il client rimane in attesa finché non scatta il timeout della connessione TCP o del browser (es. Gateway Timeout 504). In Express 5, se la funzione asincrona lancia un'eccezione (`throw err`) o ritorna una `Promise` che si rigetta, Express se ne accorge automaticamente e la inoltra a `errorMiddleware`. Se invece l'errore avviene all'interno di una callback asincrona tradizionale legacy (es. `fs.readFile`) e non viene passato esplicitamente a `next(err)`, la pipeline si interrompe senza mai inviare una risposta al client."*

---

### Scenario 4.3: Errore di configurazione CORS e Pre-flight (`OPTIONS`)
* **Domanda del Docente**: *"Un utente apre l'applicazione React da `http://evil-site.com` e tenta di invocare la nostra API protetta `POST /api/games/start`. Cosa succede a livello di protocollo HTTP e perché?"*
* **Risposta dello Studente**: *"Poiché la richiesta include metodi diversi da GET/HEAD o header personalizzati come `Authorization`, il browser invia prima una richiesta preliminare **Pre-flight HTTP OPTIONS**. Nel nostro server, il middleware `cors(corsOptions)` analizza l'header `Origin: http://evil-site.com`. Non trovandolo in `ALLOWED_ORIGINS` e verificando che non è una variante localhost in sviluppo, la funzione origin invoca la callback passando un errore `AppError(..., 403, CORS_NOT_ALLOWED)`. Il server non invia gli header di autorizzazione (`Access-Control-Allow-Origin: http://evil-site.com`), e il browser blocca immediatamente l'operazione prima ancora che il payload o la richiesta reale `POST` vengano trasmessi, proteggendo gli utenti da attacchi Cross-Origin non autorizzati."*

---

### Scenario 4.4: La gestione nativa delle Promise in Express 5 vs Express 4
* **Domanda del Docente**: *"Nel nostro codice scriviamo controller asincroni senza avvolgerli in `try/catch` o middleware wrapper come `asyncHandler`. Perché questo codice è sicuro in Express 5 mentre in Express 4 avrebbe provocato il crash del server o il blocco della richiesta?"*
* **Risposta dello Studente**: *"In **Express 4**, il motore di routing era concepito per funzioni sincrone con callback. Se una funzione `async (req, res)` sollevava un'eccezione, veniva restituita una Promise nello stato `rejected`. Express 4 ignorava il valore di ritorno delle route e non ascoltava il reject della Promise: la richiesta rimaneva in attesa indefinita e Node.js emetteva un evento `unhandledRejection`, che nelle versioni recenti di Node provoca la terminazione del processo (`process.exit(1)`). In **Express 5**, il router intercetta nativamente il tipo di ritorno del middleware: se rileva una Promise, applica internamente `.catch(next)`. Qualsiasi eccezione sollevata con `throw new AppError(...)` all'interno di un blocco asincrono viene catturata in automatico e trasferita in sicurezza al nostro `errorMiddleware`."*

---

### Scenario 4.5: Riconoscimento della firma a 4 argomenti in `errorMiddleware`
* **Domanda del Docente**: *"Nel file `errorMiddleware.ts` il middleware è dichiarato come: `(err: unknown, _req: Request, res: Response, _next: NextFunction): void`. Cosa accadrebbe se rimuovessimo il quarto parametro `_next` dalla dichiarazione della funzione?"*
* **Risposta dello Studente**: *"Express smetterebbe di trattarlo come un Error Handling Middleware e lo interpreterebbe come un normale middleware di routing! Express distingue i middleware di errore dai middleware standard analizzando la proprietà `.length` della funzione JavaScript a runtime, che rappresenta il numero di argomenti dichiarati (arità della funzione). Se ha 4 parametri (`err, req, res, next`), Express lo registra nella catena degli errori. Se ne ha 3 (`err, req, res`), Express lo tratta come un route handler ordinario a 3 parametri (`req, res, next`): di conseguenza, quando un errore viene sollevato nel codice, questo gestore non verrebbe mai eseguito e l'errore rimarrebbe non gestito."*
