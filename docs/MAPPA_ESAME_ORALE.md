# 🗺️ RoadToUnina — Mappa del Codice & Cheat Sheet per la Discussione Orale

Questa guida rapida è pensata per **trovare qualsiasi funzionalità in 2 secondi** durante l'esame orale con il **Prof. Luigi Libero Lucio Starace**.

> 💡 **Consiglio Pro:** Durante l'esame, usa **`Cmd + P`** nel tuo editor (VS Code / Cursor) e digita direttamente il nome del file indicato qui sotto. Mai cercare cartella per cartella con il mouse!

---

## 🧭 Indice Rapido delle Funzionalità

| Se il Prof ti chiede... | File Esatto da Aprire | Funzione / Riga Chiave |
| :--- | :--- | :--- |
| **"Dove gestisci i click sui link di Wikipedia?"** | `frontend/src/components/game/WikiRenderer.tsx` | Funzione `handleClick` e `processNavigation` |
| **"Dove chiami l'API di Wikipedia?"** | `backend/src/services/wikiService.ts` | Funzione `fetchArticleHtml` e `extractValidLinks` |
| **"Dove controlli l'Anti-Cheat (impedire salti illeciti)?"** | `backend/src/services/gameService.ts` | Nel metodo `makeStep`: `validLinks.includes(targetTitle)` |
| **"Dove generi e firmi il Token JWT?"** | `backend/src/services/authService.ts` | Funzione `generateToken`: `jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })` |
| **"Dove verifichi il token e proteggi le rotte?"** | `backend/src/middlewares/authMiddleware.ts` | `jwt.verify(token, JWT_SECRET)` e assegnazione a `req.user` |
| **"Dove hashate le password con bcrypt?"** | `backend/src/services/authService.ts` | `bcrypt.hash(password, 10)` e `bcrypt.compare()` |
| **"Dove gestisci il timer e lo stato del gioco nel frontend?"**| `frontend/src/hooks/useGameEngine.ts` | Hook `useGameEngine`: `calculateElapsed` e interval |
| **"Dove sono definiti i modelli del Database (User, Game)?"** | `backend/prisma/schema.prisma` | Modelli `User`, `Game`, `GameStep` e vincolo `[gameId, stepOrder]` |
| **"Dove definisci le rotte e i Rate Limiter del server?"** | `backend/src/server.ts` | `createApp()` con `authLimiter`, `gameLimiter`, `publicLimiter` |
| **"Dove validi i dati in ingresso con Zod?"** | `backend/src/routes/authRoutes.ts` e `gameRoutes.ts` | Schemi `registerSchema`, `loginSchema`, `makeStepSchema` |
| **"Dove intercetti gli errori centralizzati?"** | `backend/src/middlewares/errorMiddleware.ts` | Middleware Express a 4 parametri `(err, req, res, next)` |
| **"Dove sono i colori Neo-Brutalist e le ombre?"** | `frontend/tailwind.config.js` e `styles/neo-brutalism.css`| Classi `.shadow-neo`, `.border-3`, colori `neo-yellow`, `neo-pink` |
| **"Dove si trova la barra in alto con Timer e Click?"** | `frontend/src/components/game/HUDBar.tsx` | Componente `HUDBar` con props `elapsedSeconds`, `clickCount` |
| **"Dove mostri la classifica e il podio?"** | `frontend/src/pages/LeaderboardPage.tsx` | Componente `LeaderboardPage` e hook `useLeaderboard` |
| **"Dove si trova il popup di vittoria Unina?"** | `frontend/src/pages/GamePage.tsx` | Blocco condizionale `game.status === 'COMPLETED'` |

---

## 🔍 Focus Dettagliato: I 5 File Più Importanti

---

### 1. `frontend/src/components/game/WikiRenderer.tsx`
**Cosa fa:** Renderizza l'articolo Wikipedia, divide il testo in sezioni a fisarmonica, filtra i link non enciclopedici e intercetta i click.
* **Funzione `handleClick(e)` (circa riga 288):**
  ```typescript
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;
    e.preventDefault(); // <-- FONDAMENTALE: impedisce al browser di uscire dalla SPA!
    const dataTitle = anchor.getAttribute('data-title');
    if (dataTitle) {
      processNavigation(dataTitle);
    }
  };
  ```
* **Domanda trabocchetto:** *"Perché non metti `onClick` su ogni singolo link?"*  
  **Risposta:** *"Perché una pagina Wikipedia può avere 500 link. Mettere 500 handler appesantirebbe la memoria e rallenterebbe il Garbage Collector. Usando l'**Event Delegation** abbiamo un solo listener sul container padre che sfrutta l'event bubbling."*

---

### 2. `backend/src/services/gameService.ts`
**Cosa fa:** Il cuore della business logic: avvio partita, verifica anti-cheat, cambio stato, calcolo passi e vittoria.
* **Metodo `makeStep(userId, gameId, targetTitle)`:**
  1. Recupera la partita dal DB e verifica che appartenga a `userId` e che lo stato sia `IN_PROGRESS`.
  2. Verifica timeout di 24 ore: se la partita è troppo vecchia viene chiusa in `ABANDONED`.
  3. Chiama `wikiService.extractValidLinks(currentPage)`: estrae l'elenco dei link validi della voce corrente.
  4. **Controllo Anti-Cheat:**
     ```typescript
     if (!validLinks.includes(targetTitle)) {
       throw new AppError('Target page is not linked in current page', 400, ErrorCode.INVALID_STEP);
     }
     ```
  5. Se `targetTitle === game.targetPageTitle`, imposta `status: COMPLETED` e calcola l'esito.
  6. Esegue una **transazione atomica su database** (`prisma.$transaction`) per salvare il `GameStep` e incrementare `clickCount`.

---

### 3. `backend/src/services/wikiService.ts`
**Cosa fa:** Dialoga con l'API ufficiale di Wikipedia Italia (`https://it.wikipedia.org/w/api.php`) e implementa la cache LRU in memoria.
* **Chiamata a Wikipedia:**
  Usa `action=parse&prop=text|links&format=json`.
* **Sanitizzazione XSS lato server:**
  Usa `sanitizeHtml` con una whitelist rigorosa di tag (`<p>`, `<a>`, `<b>`, `<table>`, ecc.) rimuovendo script, iframe, form e attributi pericolosi (`onclick`, `onerror`).
* **Cache LRU (`lru-cache`):**
  Mantiene in RAM le voci più visitate (es. `"Italia"`, `"Napoli"`) con TTL di 1 ora per garantire tempi di risposta inferiori a 1 millisecondo e non sovraccaricare i server della Wikimedia Foundation.

---

### 4. `backend/src/middlewares/authMiddleware.ts`
**Cosa fa:** Protegge tutti gli endpoint privati (`/api/games/*`, `/api/auth/me`).
* **Come funziona riga per riga:**
  ```typescript
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 401, ErrorCode.UNAUTHORIZED));
  }
  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  req.user = { id: decoded.id, username: decoded.username };
  next();
  ```
* **Domanda trabocchetto:** *"Se modifico il token a mano nel browser cosa succede?"*  
  **Risposta:** *"La funzione `jwt.verify` ricalcola la firma crittografica HMAC-SHA256 usando `JWT_SECRET`. Se il payload è stato manomesso, le firme non coincidono e l'accesso viene bloccato con 401."*

---

### 5. `backend/prisma/schema.prisma`
**Cosa fa:** Definisce lo schema del database PostgreSQL e i vincoli di integrità referenziale.
* **Modelli:**
  - `User`: id UUID, email univoca, username univoco, password (hash bcrypt).
  - `Game`: relazione 1-N con User (`onDelete: Cascade`), stato (`IN_PROGRESS`, `COMPLETED`, `ABANDONED`), clickCount, startTime, endTime.
  - `GameStep`: relazione 1-N con Game, traccia la cronologia ordinata (`stepOrder`, `pageTitle`).
* **Vincolo anti-race condition:**
  ```prisma
  @@unique([gameId, stepOrder])
  ```
  Questo vincolo a livello di database impedisce che due click simultanei creino lo stesso numero di passo.

---

## 🛠️ Modifiche Live "Al Volo" che il Prof potrebbe chiederti

### 1. "Cambiami la pagina di arrivo da Federico II a 'Colosseo'"
* Apri `backend/prisma/schema.prisma` riga 34:  
  Cambia `@default("Università degli Studi di Napoli Federico II")` in `@default("Colosseo")`.
* Nel terminale backend lancia: `npx prisma db push --accept-data-loss`. Fatto!

### 2. "Fai apparire un alert in console ogni volta che l'utente clicca un link"
* Apri `frontend/src/components/game/WikiRenderer.tsx` nella funzione `processNavigation`:
  Aggiungi: `console.log("Navigazione verso:", targetTitle);`.

### 3. "Riduci il rate limit delle partite a sole 5 chiamate al minuto per testarlo"
* Apri `backend/src/server.ts` riga 35 (`gameLimiter`):  
  Cambia `max: IS_PRODUCTION ? 120 : 5000` in `max: 5`.

### 4. "Cambia il colore principale dell'interfaccia (dal giallo unina al verde)"
* Apri `frontend/tailwind.config.js`:  
  Sotto `colors.neo.yellow`, cambia `'#FFE600'` in `'#22C55E'`. Vite ricaricherà a caldo la pagina in 100ms!

---

## 🎓 Vocabolario Tecnico da usare all'orale
Usa questi termini spontaneamente per dimostrare padronanza assoluta:
- *"Pattern Event Delegation"* (invece di "ho messo un listener generale").
- *"Difesa in profondità / Defense in Depth"* (per spiegare che sanitizzi l'HTML sia sul backend con `sanitize-html` che sul frontend con `DOMPurify`).
- *"Type Erasure a compile-time"* (per spiegare perché serve Zod a runtime oltre a TypeScript).
- *"Key Stretching con salt casuale a 128 bit"* (per spiegare perché usi Bcrypt per le password).
- *"Zero-Trust Server-Side Validation"* (per spiegare l'anti-cheat sui link).
- *"Transazioni ACID atomiche"* (per spiegare l'avanzamento dei passi su Prisma/PostgreSQL).
