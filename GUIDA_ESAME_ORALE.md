# 🎓 Guida Definitiva per l'Esame Orale di Tecnologie Web
## Progetto: RoadToUnina (Wikipedia Speedrun) — Candidato: Luca Barrella (N86004677)

> 💡 **Come usare questa guida:** Questa dispensa contiene tutto ciò che serve per sostenere l'orale con il **Prof. Starace**: l'architettura, il funzionamento interno dei framework, la mappa di **tutti i file**, gli snippet di codice analizzati riga per riga, le domande trabocchetto e il metodo infallibile per spiegare qualsiasi riga a sorpresa.

---

## 🗺️ 1. L'Architettura Generale (Il Quadro d'Insieme)

L'applicazione rispetta la classica architettura a **3 Livelli (3-Tier)** con separazione netta delle responsabilità:

```
[ Browser / Client ]  <--(HTTP REST / JSON)-->  [ Server Node.js / Express ]  <--(SQL / Prisma Pool)-->  [ Database PostgreSQL ]
  (React 18 SPA + Vite)                               (TypeScript + Zod + JWT)                                  (Supabase Cloud DB)
```

1. **Frontend (React 18 + Vite + Tailwind CSS):**
   - Single Page Application (SPA): gira interamente nel browser del client.
   - Si occupa solo della presentazione grafica (UI), gestione dello stato reattivo e interazione utente.
   - Non prende **mai** decisioni sul gioco (non valida mosse, non calcola tempi ufficiali, non decide la classifica).
2. **Backend (Node.js + Express + TypeScript):**
   - Cuore computazionale e di sicurezza (Anti-Cheat).
   - Valida i payload in ingresso con **Zod**, applica le regole di gioco, scarica e sanitizza gli articoli di Wikipedia, gestisce la concorrenza e firma i token **JWT**.
3. **Database (PostgreSQL + Prisma ORM con Connection Pool):**
   - Persistenza dei dati su 3 modelli relazionali: `User`, `Game`, `GameStep`.

---

## ⚙️ 2. Come Funzionano i Framework "Sotto il Cofano" (Teoria & Pratica)

Se il professore chiede: *"Come funziona internamente questo framework/libreria che hai usato?"*, ecco le risposte accademiche esatte:

### 🟢 A. Express.js (Backend)
* **La Pipeline dei Middleware (Catena di Responsabilità):**
  > *"Express elabora ogni richiesta HTTP attraverso una catena sequenziale di funzioni: i middleware `(req, res, next)`. Ciascun middleware può ispezionare la richiesta, modificarla (es. allegando `req.user`), inviare una risposta o passare il controllo al successivo con `next()`. Se si verifica un errore, chiamando `next(error)` Express interrompe la normale pipeline e salta direttamente al middleware centralizzato di errore con firma a 4 argomenti `(err, req, res, next)` in `errorMiddleware.ts`."*
* **Perché c'è `app.set('trust proxy', 1)` in `server.ts`:**
  > *"Essendo l'app deployata su cloud (Render/Vercel) dietro un Reverse Proxy, l'indirizzo IP reale del client viene inoltrato nell'header `X-Forwarded-For`. Senza `trust proxy 1`, Express vedrebbe tutte le richieste provenire dall'IP interno del proxy, compromettendo il corretto funzionamento del Rate Limiting."*

### 🔵 B. React 18 e Architettura SPA (Frontend)
* **Funzionamento della Single Page Application (SPA):**
  > *"Il server web invia al browser un solo file `index.html` statico e il bundle JavaScript. Da quel momento, ogni cambio di pagina (`/game`, `/leaderboard`) è gestito lato client da `react-router-dom` tramite le **HTML5 History API** (`pushState`), evitando il ricaricamento completo della pagina e offrendo un'esperienza fluida simile a un'app nativa."*
* **Virtual DOM & Reconciliation (Diffing):**
  > *"React mantiene in memoria una copia leggera del DOM reale. Quando lo stato cambia (`useState`), React genera un nuovo Virtual DOM, calcola l'insieme minimo di differenze tramite l'algoritmo di **Reconciliation (Diffing O(n))** e applica al DOM reale del browser solo i nodi modificati, riducendo i costosi reflow e repaint del browser."*
* **Gli Hook di React spiegati nel dettaglio:**
  - `useState`: incapsula lo stato locale e innesca il re-render al variare del valore.
  - `useEffect`: gestisce i side-effect (es. fetch API all'avvio, timer a intervallo con cleanup `clearInterval`).
  - `useCallback`: memorizza l'istanza di una funzione tra i render, evitando che componenti figli vengano renderizzati inutilmente.
  - `useMemo`: memorizza il valore computato di un'operazione pesante (es. sezionamento dell'HTML in `WikiRenderer.tsx`) rieseguendolo solo se cambiano le dipendenze.
  - `useRef`: mantiene un riferimento persistente a un elemento del DOM reale senza innescare re-render.
* **Event Delegation nel Rendering degli Articoli:**
  > *"In `WikiRenderer.tsx` una pagina di Wikipedia può contenere centinaia di link. Invece di agganciare centinaia di `onClick` su ogni singolo elemento (che saturerebbero la memoria), usiamo l'**Event Delegation**: agganciamo un unico listener sul container padre `handleClick`, intercettando il click del link risalendo l'albero con `e.target.closest('a')`."*

### 🐘 C. Prisma ORM & PostgreSQL (Database Layer)
* **Cos'è un ORM:**
  > *"Un Object-Relational Mapper che astrae il dialetto SQL, mappando le tabelle relazionali in modelli e tipi TypeScript sincronizzati a tempo di compilazione."*
* **Connection Pooling (`pg.Pool` in `db.ts`):**
  > *"Aprire una connessione TCP verso un database PostgreSQL remoto ha un costo computazionale e di latenza notevole (handshake SSL, autenticazione). Il Connection Pool mantiene un insieme di connessioni aperte e riutilizzabili (es. max 10), prestandone una alla richiesta ed evitando di esaurire le risorse del database durante picchi di traffico."*
* **Transazioni Atomiche (`prisma.$transaction`):**
  > *"Garantiscono le proprietà **ACID**. Se una qualsiasi operazione all'interno della transazione fallisce (es. conflitto di concorrenza o vincolo di integrità violato), il database esegue un `ROLLBACK` automatico, mantenendo i dati sempre coerenti."*

### 🔒 D. Sicurezza & Crittografia (JWT e Bcrypt)
* **JWT (JSON Web Token) - Autenticazione Stateless:**
  > *"È composto da tre parti separate da punti: `Header.Payload.Signature` in Base64Url. Il server firma il payload (id utente e username) con la chiave segreta `JWT_SECRET` usando HMAC SHA-256. Il server non ha bisogno di salvare sessioni in RAM o su DB: per autorizzare una richiesta basta verificare matematicamente la firma del token ricevuto nell'header `Authorization: Bearer <token>`."*
* **Bcrypt vs Hashing Semplice (SHA-256):**
  > *"SHA-256 è un algoritmo veloce progettato per checksum e non è sicuro per le password perché vulnerabile ad attacchi brute-force su GPU con miliardi di tentativi al secondo. `Bcrypt` è un algoritmo **slow hashing** che integra un `salt` casuale univoco e un fattore di costo esponenziale (cost factor 10), rendendo computazionalmente infattibili attacchi con Rainbow Tables o dizionari."*

---

## 🗂️ 3. Mappa Completa di TUTTI i File del Progetto

Se il professore apre un file qualsiasi a schermo, ecco la spiegazione immediata in una riga:

### ⚙️ Backend (`backend/src/`)
| File | Scopo & Funzionalità |
|---|---|
| [`server.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/server.ts) | Entry point Express: configura CORS whitelist, compression, helmet, rate limiting e graceful shutdown. |
| [`config/env.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/config/env.ts) | Principio Fail-Fast: valida all'avvio che `JWT_SECRET` (>=32 char) e `DATABASE_URL` siano presenti, altrimenti arresta il boot. |
| [`config/db.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/config/db.ts) | Istanza Singleton di `PrismaClient` configurata con `pg.Pool` per il connection pooling. |
| [`middlewares/authMiddleware.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/middlewares/authMiddleware.ts) | Guard di autenticazione: legge l'header `Authorization`, verifica il JWT e allega i dati a `req.user`. |
| [`middlewares/errorMiddleware.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/middlewares/errorMiddleware.ts) | Gestione centralizzata errori: mappa `AppError`, errori Zod e 500 in risposte JSON uniformi con codici operativi. |
| [`middlewares/validateMiddleware.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/middlewares/validateMiddleware.ts) | Middleware generico di validazione che confronta `req.body`, `req.query` o `req.params` con uno schema Zod. |
| [`routes/authRoutes.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/routes/authRoutes.ts) | Router di autenticazione: endpoint `POST /register`, `POST /login`, `GET /me`. |
| [`routes/gameRoutes.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/routes/gameRoutes.ts) | Router protetto del gioco: `POST /start`, `GET /active`, `POST /:id/step`, `POST /:id/abandon`. |
| [`routes/publicRoutes.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/routes/publicRoutes.ts) | Router pubblico per ospiti: `GET /leaderboard` e `GET /completed-games`. |
| [`services/authService.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/services/authService.ts) | Logica di business per registrazione (controllo duplicati email/username), login (confronto bcrypt) e firma JWT. |
| [`services/gameService.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/services/gameService.ts) | **Cuore del gioco:** avvio partita, verifica anti-cheat sui link, rilevamento vittoria, gestione concorrenza OCC e timeout 24h. |
| [`services/wikiService.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/services/wikiService.ts) | Client MediaWiki: fetch API Wikipedia, sanitizzazione HTML con whitelist, trasformazione in `.wiki-chip` e cache LRU in RAM. |
| [`services/publicService.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/services/publicService.ts) | Calcolo aggregato della classifica (ordinata per minor click, minor tempo e maggior numero partite). |
| [`prisma/schema.prisma`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/prisma/schema.prisma) | Modelli del database relazionale (`User`, `Game`, `GameStep`) con indici e vincoli di unicità. |

### 🖥️ Frontend (`frontend/src/`)
| File | Scopo & Funzionalità |
|---|---|
| [`api/client.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/api/client.ts) | Istanza Axios centralizzata con Request Interceptor (aggiunge token Bearer) e Response Interceptor (gestione 401). |
| [`hooks/useAuth.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/hooks/useAuth.tsx) | React Context globale per lo stato di autenticazione, login, registrazione, logout e persistenza token. |
| [`hooks/useGameEngine.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/hooks/useGameEngine.ts) | Hook motore di gioco: gestisce il cronometro in tempo reale, chiamate step, transizioni di stato e mapping errori utente. |
| [`hooks/useLeaderboard.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/hooks/useLeaderboard.ts) | Hook per caricare e aggiornare i dati della classifica globale e delle partite recenti. |
| [`components/game/WikiRenderer.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/components/game/WikiRenderer.tsx) | Componente di rendering articolo: sanitizzazione con DOMPurify, accordion a sezioni e ricerca rapida link. |
| [`components/game/HUDBar.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/components/game/HUDBar.tsx) | Barra di stato superiore (HUD): mostra titolo corrente, target Federico II, click effettuati, timer e tasto resa. |
| [`components/ui/Button.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/components/ui/Button.tsx) | Componente pulsante riutilizzabile in stile Neo-Brutalist con varianti di colore e stato di loading. |
| [`components/ui/Card.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/components/ui/Card.tsx) | Contenitore grafico modulare con bordo netto ed effetto rilievo shadow. |
| [`components/ui/Toast.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/components/ui/Toast.tsx) | Notifica temporanea a scomparsa automatica (usata per segnalare click non validi). |
| [`pages/GamePage.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/pages/GamePage.tsx) | Vista principale di gioco: gestisce schermata di avvio, canvas articolo, storico passi laterale e modale di vittoria. |
| [`pages/LeaderboardPage.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/pages/LeaderboardPage.tsx) | Pagina classifica pubblica: mostra il podio dei primi 3 giocatori e la tabella ordinata. |
| [`pages/LoginPage.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/pages/LoginPage.tsx) / [`RegisterPage.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/pages/RegisterPage.tsx) | Pagine di autenticazione con validazione form e gestione errori di credenziali. |

---

## 🔍 4. I 6 Snippet Fondamentali Spiegati Riga per Riga

---

### 1️⃣ Controllo e Validazione del Token JWT
📁 **File:** `backend/src/middlewares/authMiddleware.ts`

```typescript
const authHeader = req.headers.authorization;

if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return next(new AppError('Unauthorized: Token missing or invalid format', 401));
}

const token = authHeader.substring(7).trim();

try {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  req.user = decoded; // Salva l'utente nella richiesta per i controller successivi
  next();             // Lascia passare la richiesta al prossimo middleware
} catch {
  return next(new AppError('Unauthorized: Invalid or expired token', 401));
}
```

* **Cosa dire al professore:**
  > *"Questo è il middleware di autenticazione che protegge le route private. Intercetta la richiesta, verifica la presenza dell'header `Authorization: Bearer <token>`, estrae la stringa e ne verifica crittograficamente la firma tramite `jwt.verify` con la chiave segreta `JWT_SECRET`. Se è valido, popola `req.user` con l'ID e l'username dell'utente e chiama `next()`. Se il token è assente, manomesso o scaduto, interrompe subito l'esecuzione restituendo `401 Unauthorized`."*

---

### 2️⃣ Anti-Cheat: Validazione del Passo Lato Server
📁 **File:** `backend/src/services/gameService.ts`

```typescript
// 1. Recupera il contenuto e i link validi della pagina corrente dal wikiService
const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);

// 2. Verifica se il link cliccato appartiene ai link reali ed enciclopedici della pagina
const isLinkValid = currentContent.validLinks.some(
  link => normalizeWikiTitle(link) === normalizedTarget
);

if (!isLinkValid) {
  throw new AppError(`Invalid step: link "${targetTitle}" is not present in "${game.currentPageTitle}"`, 400, 'INVALID_STEP');
}
```

* **Cosa dire al professore:**
  > *"Per evitare che un utente malevolo falsifichi la partita inviando richieste POST arbitrarie (ad esempio saltando direttamente alla pagina della Federico II), il server applica una validazione **Zero-Trust**: riscarica la pagina su cui si trova il giocatore, ne estrae i link consentiti (Namespace 0) e verifica che la destinazione richiesta sia effettivamente presente nel testo della pagina corrente. In caso contrario, rifiuta la mossa con `400 Bad Request`."*

---

### 3️⃣ Gestione della Concorrenza (Optimistic Concurrency Control - OCC)
📁 **File:** `backend/src/services/gameService.ts`

```typescript
const updateResult = await tx.game.updateMany({
  where: {
    id: gameId,
    userId,
    status: GameStatus.IN_PROGRESS,
    currentPageTitle: game.currentPageTitle, // <-- GUARDIA SULLO STATO CORRENTE
  },
  data: {
    currentPageTitle: resolvedTitle,
    clickCount: { increment: 1 },
    ...(isVictory ? { status: GameStatus.COMPLETED, endTime: new Date() } : {}),
  },
});

if (updateResult.count === 0) {
  throw new AppError('Concurrent step conflict: game state has already advanced', 409, 'CONCURRENT_CONFLICT');
}
```

* **Cosa dire al professore:**
  > *"Se l'utente invia due click quasi simultanei, si potrebbe verificare una race condition che corrompe la sequenza dei passi. Per evitarlo usiamo l'**Optimistic Concurrency Control** all'interno di una transazione Prisma: la clausola `where` verifica che `currentPageTitle` sia ancora identico a quello di inizio mossa. La prima richiesta aggiorna lo stato; la seconda trova `count === 0` perché lo stato è già cambiato, e fallisce in modo pulito con `409 Conflict`."*

---

### 4️⃣ Sanitizzazione HTML e Difesa in Profondità (XSS)
📁 **File:** `backend/src/services/wikiService.ts` & `frontend/src/components/game/WikiRenderer.tsx`

```typescript
// Backend (wikiService.ts): Sanitizzazione e trasformazione tag
const cleanHtmlContent = sanitizeHtml(rawHtmlContent, {
  allowedTags: ['p', 'span', 'div', 'a', 'b', 'table', 'tr', 'td', 'img'],
  transformTags: {
    'a': (_tag, attribs) => {
      const { isValid, targetTitle } = isInternalNamespaceZeroLink(attribs['href'], attribs['class']);
      if (!isValid || !targetTitle) return { tagName: 'span', attribs: {} };
      return {
        tagName: 'a',
        attribs: { href: `/wiki/${targetTitle}`, 'data-title': targetTitle, class: 'wiki-chip' }
      };
    }
  }
});

// Frontend (WikiRenderer.tsx): Ulteriore passata con DOMPurify
const purified = DOMPurify.sanitize(htmlContent, { ... });
```

* **Cosa dire al professore:**
  > *"Wikipedia è una sorgente dati esterna non fidata. Applichiamo una strategia di **Defense-in-Depth**: lato server usiamo `sanitize-html` per eliminare tag di script, iframe, box di servizio e trasformare i soli link enciclopedici in chip interattivi `.wiki-chip`. Lato client ripassiamo il codice in `DOMPurify.sanitize` prima di inserirlo nel DOM, neutralizzando qualsiasi possibile vettore di attacco **Stored Cross-Site Scripting (XSS)**."*

---

### 5️⃣ Validazione dei Payload con Zod al Confine dell'Applicazione
📁 **File:** `backend/src/middlewares/validateMiddleware.ts`

```typescript
export const validateMiddleware = <T>(schema: ZodSchema<T>, source: ValidationSource = 'body'): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated: T = await schema.parseAsync(req[source]);
      req[source] = validated; // Sostituisce i dati grezzi con quelli validati e tipizzati
      next();
    } catch (error) {
      next(error); // Invia il ZodError all'errorMiddleware
    }
  };
};
```

* **Cosa dire al professore:**
  > *"È una Higher-Order Function che genera un middleware Express. Valida ed esegue il parsing del payload HTTP (`req.body`, `req.query` o `req.params`) confrontandolo con lo schema Zod. Se i dati sono corretti, sovrascrive `req[source]` con i dati sanitizzati; se la struttura è invalida, inoltra l'errore al gestore centralizzato che restituirà un `400 Bad Request` strutturato."*

---

### 6️⃣ Schema del Database e Vincoli Relazionali
📁 **File:** `backend/prisma/schema.prisma`

```prisma
model GameStep {
  id        String   @id @default(uuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  pageTitle String
  stepOrder Int
  createdAt DateTime @default(now())

  @@unique([gameId, stepOrder]) // Vincolo di unicità: previene passi duplicati
  @@index([gameId, stepOrder])  // Indice B-Tree per velocizzare le query ordinate
}
```

* **Cosa dire al professore:**
  > *"Nel modello `GameStep`, il vincolo `@@unique([gameId, stepOrder])` impone a livello di schema relazionale che in una partita non possano mai esistere due passi con lo stesso numero d'ordine. La clausola `onDelete: Cascade` garantisce l'integrità referenziale: se una partita viene eliminata, tutti i suoi passi vengono rimossi a cascata dal database."*

---

## ❓ 5. Domande Trabocchetto dei Docenti (e Risposte Perfette)

### ❓ D1: *"Come impedite a un utente di manipolare la partita di un altro giocatore? (Attacco IDOR)"*
> **Risposta:** *"Tutti gli endpoint di gioco operano sotto l'identità autenticata `req.user.id`. Nelle query di aggiornamento e ricerca (`GameService.makeStep`, `GameService.abandonGame`), la clausola di filtro include sempre `where: { id: gameId, userId }`. Se un utente tenta di inviare un ID partita appartenente a un altro utente, il database non troverà corrispondenza e il server risponderà con `404 Not Found`, impedendo qualsiasi vulnerabilità di tipo **Insecure Direct Object References (IDOR)**."*

### ❓ D2: *"Cosa succede se un utente apre una partita e poi chiude il browser per giorni?"*
> **Risposta:** *"Abbiamo implementato una scadenza per inattività a **24 ore** (`EXPIRATION_HOURS = 24`). Quando l'utente tenta di riprendere o avviare una nuova partita, il metodo `isGameExpired(updatedAt)` rileva che sono trascorse più di 24 ore dall'ultima attività e imposta automaticamente lo stato della vecchia partita su `ABANDONED`, consentendo la creazione di una nuova sessione senza deadlock."*

### ❓ D3: *"Perché avete salvato il JWT in `localStorage` e non in un Cookie HttpOnly?"*
> **Risposta:** *"In un'applicazione didattica Single Page Application, `localStorage` garantisce una gestione client-side immediata con gli Interceptor di Axios. Il rischio teorico di XSS è azzerato grazie alla doppia sanitizzazione con DOMPurify. In uno scenario bancario o enterprise, l'evoluzione ideale prevede cookie `HttpOnly` con flag `SameSite=Strict` e `Secure`, affiancati da una procedura di Refresh Token Rotation per prevenire attacchi CSRF e storage leakage."*

### ❓ D4: *"Come funziona la cache in memoria e perché non consuma tutta la RAM?"*
> **Risposta:** *"In `WikiService` usiamo una **LRU Cache (Least Recently Used)** con limiti stringenti: max 200 voci e budget di memoria massimo di **50MB**. Quando il limite viene raggiunto, la cache espelle automaticamente gli articoli meno consultati di recente (`eviction`). Inoltre, le voci hanno un TTL (Time-To-Live) di 1 ora per garantire che eventuali aggiornamenti su Wikipedia vengano recepiti."*

### ❓ D5: *"Come fate a sapere che il codice funziona sotto carico?"*
> **Risposta:** *"Abbiamo una suite di **53 test automatici con Vitest**. In particolare, nel file `breakBackend.test.ts` eseguiamo stress test con **20 richieste di click simultanee** per verificare che la transazione atomica non crei deadlock e preservi sempre l'integrità del contatore e dello stato."*

---

## 🎯 6. Il "Metodo in 3 Passi" per Spiegare Qualsiasi Riga a Sorpresa

Se il professore punta il dito su una riga qualsiasi del codice, mantieni la calma e rispondi seguendo questo schema in 3 passaggi:

1. **Passo 1 (Descrizione sintattica):**  
   *Es: "Questa riga esegue una chiamata asincrona tramite Prisma con il metodo `findFirst` all'interno della transazione..."*
2. **Passo 2 (Motivo ingegneristico / Requisito):**  
   *Es: "...la usiamo per verificare se l'utente ha già una partita attiva con stato `IN_PROGRESS` prima di permettergli di crearne un'altra..."*
3. **Passo 3 (Cosa previene / Beneficio):**  
   *Es: "...in questo modo garantiamo la regola di business per cui ogni utente può giocare una sola speedrun alla volta, impedendo duplicazioni di stato."*

Con questo schema mentale dimostri padronanza assoluta e una preparazione da **30 e Lode**. In bocca al lupo! 🚀
