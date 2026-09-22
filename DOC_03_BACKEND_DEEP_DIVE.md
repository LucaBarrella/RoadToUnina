# ⚙️ Modulo 3: Guida Approfondita al Backend (Express, Anti-Cheat, OCC & Cache)

> **Candidato:** Luca Barrella (`N86004677`)  
> **Progetto:** RoadToUnina (Wikipedia Speedrun)  
> **Obiettivo:** Padroneggiare l'Application Tier, la pipeline middleware, l'Anti-Cheat Zero-Trust, la gestione della concorrenza (OCC) e l'integrazione con MediaWiki.

---

## 1. Mappa Strutturale del Backend (`backend/src/`)

```
backend/src/
├── config/
│   ├── env.ts              # Validazione fail-fast delle variabili d'ambiente (JWT, DB)
│   ├── db.ts               # Singleton PrismaClient configurato con pg.Pool e adapter PostgreSQL
│   └── openApiSpec.ts      # Definizione completa specifica OpenAPI 3.0 (schemi, DTO, rotte)
├── middlewares/
│   ├── authMiddleware.ts   # Guard JWT: verifica header Authorization Bearer
│   ├── validateMiddleware.ts # Validazione runtime dei payload con schemi Zod
│   └── errorMiddleware.ts  # Gestore centralizzato degli errori (AppError, Zod, HTTP codes)
├── routes/
│   ├── authRoutes.ts       # Endpoint /api/auth (register, login, me)
│   ├── gameRoutes.ts       # Endpoint protetti /api/games (start, active, step, abandon)
│   └── publicRoutes.ts     # Endpoint pubblici /api/public (leaderboard, completed-games)
├── scripts/
│   └── exportOpenApi.ts    # Script per esportare la specifica openapi.json
├── services/
│   ├── authService.ts      # Hashing password con Bcrypt e generazione token JWT
│   ├── gameService.ts      # Core computazionale: regole di gioco, anti-cheat, OCC
│   ├── wikiService.ts      # Client MediaWiki: parsing HTML, filtro Namespace 0, LRU Cache
│   └── publicService.ts    # Aggregazione statistiche e calcolo classifica globale
├── utils/
│   └── errors.ts           # Classe personalizzata AppError con statusCode operativi
└── server.ts               # Entry point Express: pipeline middleware, CORS, graceful shutdown
```

---

## 2. L'Entry Point e la Pipeline dei Middleware (`server.ts`)

In Express ogni richiesta attraversa una sequenza ordinata di middleware (**Chain of Responsibility**):

```
Richiesta HTTP in ingresso
        │
        ▼
1. helmet()                   -> Header di sicurezza HTTP (CSP, XSS-Protection, HSTS)
        │
        ▼
2. cors(corsOptions)          -> Whitelist domini (Vercel production + localhost)
        │
        ▼
3. express.json({ limit })    -> Parsing del body JSON con limite 1MB (anti-DoS)
        │
        ▼
4. app.set('trust proxy', 1)  -> Lettura IP reale da header X-Forwarded-For per Render
        │
        ▼
5. /api/docs (Swagger UI)     -> Documentazione interattiva OpenAPI 3.0 & /api/openapi.json
        │
        ▼
6. Routing (/api/...)         -> authRoutes, gameRoutes, publicRoutes
        │
        ▼
7. errorMiddleware            -> Cattura errori (AppError, ZodError, 500) con firma a 4 argomenti
```

### Codice Chiave di `server.ts`:
```typescript
// Configurazione CORS rigorosa per il cloud
const allowedOrigins = [
  'https://road-to-unina.vercel.app',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Consente richieste server-to-server o da origini in whitelist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloccato da policy CORS: origine non autorizzata'));
    }
  },
  credentials: true,
}));
```

---

## 3. Autenticazione & Validazione

### A. Guard di Autenticazione (`authMiddleware.ts`)
Intercetta le route private ed estrae il token dall'header HTTP:
```typescript
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return next(new AppError('Unauthorized: Token mancante o formato non valido', 401));
}

const token = authHeader.substring(7).trim();

try {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  req.user = decoded; // Dati utente iniettati nella richiesta per i controller successivi
  next();
} catch {
  return next(new AppError('Unauthorized: Token non valido o scaduto', 401));
}
```

### B. Validatore Generico Zod (`validateMiddleware.ts`)
Garantisce che il tipo dei dati a runtime coincida con le definizioni TypeScript:
```typescript
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(error); // Inoltra l'errore Zod direttamente all'errorMiddleware
    }
  };
};
```

---

## 4. Il Cuore di Gioco: `gameService.ts`

### A. Anti-Cheat (Zero-Trust Architecture)
Il server non dà mai per scontato che una mossa inviata dal client sia legittima. Se un utente invia una richiesta artefatta tramite curl o Postman per saltare direttamente alla destinazione:

```typescript
// 1. Recupera l'articolo della pagina corrente da Wikipedia
const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);

// 2. Normalizza le stringhe e verifica l'esistenza del link nella pagina di provenienza
const normalizedTarget = normalizeWikiTitle(targetTitle);
const isLinkValid = currentContent.validLinks.some(
  link => normalizeWikiTitle(link) === normalizedTarget
);

if (!isLinkValid) {
  throw new AppError(
    'Invalid step: target article is not linked from current article',
    400
  );
}
```
**Risultato:** L'attacco viene stroncato con `400 Bad Request`.

---

### B. Concorrenza Atomica: Optimistic Concurrency Control (OCC)
Se un utente clicca ripetutamente o simultaneamente, per evitare **Race Conditions** sul conteggio dei click e sullo storico dei passi:

```typescript
const updateResult = await prisma.game.updateMany({
  where: {
    id: gameId,
    userId,
    status: 'IN_PROGRESS',
    currentPageTitle: game.currentPageTitle, // <-- GUARDIA OCC!
  },
  data: {
    currentPageTitle: targetTitle,
    clicksCount: { increment: 1 },
  },
});

// Se un'altra richiesta concorrente ha già aggiornato il record, count sarà 0
if (updateResult.count === 0) {
  throw new AppError(
    'Conflict: Game state was modified concurrently. Please retry.',
    409
  );
}
```

---

### C. Rilevamento Vittoria e Timeout Automatico (24h)
- **Vittoria:** Se `normalizeWikiTitle(targetTitle) === 'Università degli Studi di Napoli Federico II'`, lo stato passa ad `COMPLETED`, si imposta `endedAt: new Date()` e la partita diventa valida per la leaderboard.
- **Abbandono per Inattività:** All'inizio di ogni interazione, il servizio verifica se sono trascorse più di 24 ore dall'avvio della partita (`game.startedAt`). In caso positivo, imposta automaticamente `status: 'ABANDONED'` per non lasciare partite fantasma aperte.

---

## 5. Il Motore Wikipedia: `wikiService.ts`

Interagisce con l'API pubblica di Wikimedia (`https://it.wikipedia.org/api/rest_v1/page/html/{title}`):

1. **Filtro Namespace 0:**
   - Analizza i tag `<a>` dell'HTML restituito.
   - Scarta categoricamente link di servizio come `Categoria:`, `Discussione:`, `Portale:`, `File:`, `Speciale:`, `Aiuto:`.
   - Mantiene esclusivamente i link enciclopedici legittimi.
2. **Sanitizzazione Server-Side con `sanitize-html`:**
   - Rimuove script malevoli, tag `<style>`, tag `<iframe>`, attributi `onclick` e inline CSS.
   - Converte i link validi in chip grafiche con attributo `data-wiki-title`.
3. **In-Memory LRU Cache (Least Recently Used):**
   - Mantiene in memoria RAM fino a **200 articoli** e **50MB** massimi.
   - Le voci più lette (es. *"Napoli"*, *"Campania"*, *"Italia"*) vengono servite in **< 1ms**, azzerando la latenza di rete e prevenendo il rate-limiting dalle API di Wikipedia.
