# 🎓 Guida di Preparazione all'Esame Orale di Tecnologie Web
## Progetto: RoadToUnina (Wikipedia Speedrun)

Questa guida è pensata per spiegare l'intero progetto in modo chiaro, semplice e senza tecnicismi inutili. Leggila con calma: qui trovi l'architettura, i file chiave, gli snippet di codice che il professore potrebbe chiederti e le risposte pronte per l'orale.

---

## 🗺️ 1. L'Architettura Generale (Il Quadro d'Insieme)

L'applicazione segue l'architettura classica a **3 Livelli (3-Tier)**:

```
[ Browser / Client ]  <--(HTTP / JSON)-->  [ Server Node.js / Express ]  <--(SQL / Prisma)-->  [ Database PostgreSQL ]
  (React + Tailwind)                            (TypeScript + Zod)                                (3 Tabelle Relazionali)
```

1. **Frontend (React + Vite)**:
   - Gira nel browser dell'utente.
   - Si occupa solo di mostrare l'interfaccia grafica (UI) e inviare richieste HTTP (GET, POST) al backend.
   - Non prende mai decisioni critiche sul gioco (non valida le vittorie, non decide la classifica).

2. **Backend (Express + TypeScript)**:
   - È il "cervello" dell'applicazione.
   - Riceve le richieste dal frontend, le valida con **Zod**, applica le regole del gioco (Anti-cheat), interroga l'API di Wikipedia e calcola i tempi/click.

3. **Database (PostgreSQL + Prisma ORM)**:
   - È la memoria persistente.
   - Contiene 3 tabelle:
     - `User`: account utente (email, username, hash password).
     - `Game`: partite (stato: `IN_PROGRESS`, `COMPLETED`, `ABANDONED`, click totali, orari).
     - `GameStep`: storico cronologico di ogni singolo link cliccato durante la partita.

---

## 📂 2. Mappa dei File Chiave (Dove mettere le mani)

| File | Cosa fa in una frase |
|---|---|
| [`backend/src/server.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/server.ts) | Avvia il server Express, imposta CORS, rate limiting, helmet e le rotte. |
| [`backend/src/config/env.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/config/env.ts) | Controlla all'avvio che `JWT_SECRET` e il database siano configurati correttamente (fail-fast). |
| [`backend/src/middlewares/authMiddleware.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/middlewares/authMiddleware.ts) | Blocca le richieste non autenticate verificando il token JWT nell'header `Authorization`. |
| [`backend/src/services/gameService.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/services/gameService.ts) | Cuore del gioco: avvio partita, validazione anti-cheat di ogni passo, rilevamento vittoria e concorrenza. |
| [`backend/src/services/wikiService.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/services/wikiService.ts) | Scarica gli articoli da Wikipedia, pulisce l'HTML (rimuove pubblicità/navbox) ed estrae i link cliccabili. |
| [`backend/prisma/schema.prisma`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/prisma/schema.prisma) | Schema delle tabelle del database con relazioni e vincoli di unicità. |
| [`frontend/src/components/game/WikiRenderer.tsx`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/src/components/game/WikiRenderer.tsx) | Renderizza l'articolo nel frontend usando **DOMPurify** per evitare attacchi XSS. |

---

## 🔍 3. I 6 Snippet di Codice che il Professore può chiederti

Se il professore punta il dito sul codice, punterà su uno di questi 6 blocchi:

---

### 1️⃣ Controllo e Validazione del Token JWT
📁 File: `backend/src/middlewares/authMiddleware.ts`

```typescript
const authHeader = req.headers.authorization;

if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return next(new AppError('Unauthorized: Token missing or invalid format', 401));
}

const token = authHeader.substring(7).trim();

try {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  req.user = decoded; // Salva l'utente nella richiesta per i controller successivi
  next();             // Lascia passare la richiesta
} catch {
  return next(new AppError('Unauthorized: Invalid or expired token', 401));
}
```

* **Come spiegarlo al prof:**
  > "Questo è un middleware Express. Intercetta ogni richiesta diretta alle rotte protette. Legge l'header `Authorization`, controlla che inizi con il prefisso standard `Bearer `, estrae la stringa del token e ne verifica la firma crittografica con la chiave `JWT_SECRET`. Se il token è valido, salva i dati dell'utente su `req.user` e chiama `next()` per far proseguire la richiesta. Se il token è assente, manomesso o scaduto, risponde subito con `401 Unauthorized`."

---

### 2️⃣ Anti-Cheat: Validazione del Passo Lato Server
📁 File: `backend/src/services/gameService.ts`

```typescript
// 1. Recupera il contenuto e i link validi della pagina corrente
const currentContent = await wikiService.getWikiArticleContent(game.currentPageTitle);

// 2. Verifica se il link cliccato appartiene ai link reali della pagina
const isLinkValid = currentContent.validLinks.some(
  link => normalizeWikiTitle(link) === normalizedTarget
);

if (!isLinkValid) {
  throw new AppError(`Invalid step: link "${targetTitle}" is not present in "${game.currentPageTitle}"`, 400, 'INVALID_STEP');
}
```

* **Come spiegarlo al prof:**
  > "Per impedire cheating (ad esempio un utente che invia via Postman/curl un salto diretto alla Federico II), il server non si fida del client. Prima di accettare una mossa, scarica la pagina su cui si trova il giocatore ed estrae l'insieme dei link effettivamente visibili. Se il `targetTitle` richiesto non appartiene a quell'insieme, il server rifiuta la mossa con codice `400 Bad Request`."

---

### 3️⃣ Gestione della Concorrenza (Optimistic Concurrency Control)
📁 File: `backend/src/services/gameService.ts`

```typescript
const updateResult = await tx.game.updateMany({
  where: {
    id: gameId,
    userId,
    status: GameStatus.IN_PROGRESS,
    currentPageTitle: game.currentPageTitle, // <-- GUARDIA SULLO STATO
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

* **Come spiegarlo al prof:**
  > "Cosa succede se un utente invia due click simultanei? Per evitare race condition (es. contare due passi diversi dallo stesso articolo), usiamo l'**Optimistic Concurrency Control (OCC)**. Nella clausola `where` verifichiamo che `currentPageTitle` sia ancora quello di partenza. La prima richiesta aggiorna lo stato; la seconda richiesta troverà `currentPageTitle` già modificato, quindi `updateMany` aggiornerà 0 righe e lanceremo un `409 Conflict`, preservando l'integrità del grafo di navigazione."

---

### 4️⃣ Sanitizzazione e Difesa in Profondità (XSS)
📁 File: `frontend/src/components/game/WikiRenderer.tsx`

```typescript
const purified = DOMPurify.sanitize(rawHtml, {
  ALLOWED_TAGS: [
    'p', 'span', 'div', 'a', 'b', 'strong', 'i', 'em', 'table',
    'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'h1', 'h2', 'img'
  ],
  ALLOWED_ATTR: ['class', 'id', 'title', 'data-title', 'href', 'src', 'alt'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
});
```

* **Come spiegarlo al prof:**
  > "Poiché l'HTML proviene da Wikipedia (sorgente esterna), usiamo un approccio di **difesa in profondità**:
  > 1. Lato backend filtriamo il wikitesto con `sanitize-html` eliminando script e box di servizio.
  > 2. Lato frontend applichiamo **DOMPurify** prima di usare `dangerouslySetInnerHTML`. DOMPurify applica una whitelist rigorosa di tag e attributi permessi, eliminando script inline, iframe e attributi pericolosi come `onload` o `onerror`, proteggendoci completamente da attacchi **Cross-Site Scripting (XSS)**."

---

### 5️⃣ Validazione dei Dati in Ingresso con Zod
📁 File: `backend/src/routes/gameRoutes.ts`

```typescript
export const makeStepSchema = z.object({
  targetTitle: z
    .string()
    .trim()
    .min(1, 'Target Wikipedia page title is required')
    .max(300, 'Target Wikipedia page title cannot exceed 300 characters'),
});

router.post('/:id/step', validateMiddleware(makeStepSchema, 'body'), async (req, res, next) => {
  // Esecuzione protetta: se il body non è valido, non arriva nemmeno qui
});
```

* **Come spiegarlo al prof:**
  > "Usiamo **Zod** per validare il payload HTTP al confine (boundary) dell'applicazione. Prima che la richiesta entri nella logica di business, il middleware `validateMiddleware` verifica tipo, lunghezza e formato. Se il payload è invalido, restituisce automaticamente un `400 Bad Request` strutturato con i dettagli dell'errore, evitando crash a runtime."

---

### 6️⃣ Schema del Database e Vincoli di Unicità
📁 File: `backend/prisma/schema.prisma`

```prisma
model GameStep {
  id        String   @id @default(uuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  pageTitle String
  stepOrder Int
  createdAt DateTime @default(now())

  @@unique([gameId, stepOrder]) // Impedisce due passi con lo stesso numero d'ordine
  @@index([gameId, stepOrder])
}
```

* **Come spiegarlo al prof:**
  > "In `GameStep` teniamo traccia della cronologia dei passi. Il vincolo `@@unique([gameId, stepOrder])` garantisce a livello di database relazionale che non possano mai esistere due passi con lo stesso numero d'ordine nella stessa partita. La clausola `onDelete: Cascade` assicura che se una partita viene cancellata, tutti i suoi passi vengano rimossi automaticamente."

---

## ❓ 4. Le 8 Domande Frequenti del Professore (con Risposte Pronte)

### D1: "Perché usate JWT e non le sessioni con Cookie sul server?"
> **Risposta:** "JWT rende l'architettura REST **stateless**: il server non ha bisogno di memorizzare una sessione in memoria per ogni utente connesso (risparmiando RAM e facilitando la scalabilità). Il client allega il token firmato crittograficamente a ogni richiesta."

### D2: "Come sono protette le password degli utenti?"
> **Risposta:** "Le password non vengono mai salvate in chiaro. Utilizziamo la funzione di hash crittografico **bcrypt** con fattore di costo (salt) pari a 10. Quando l'utente fa il login, confrontiamo l'hash con `bcrypt.compare`."

### D3: "Cos'è CORS e come l'avete configurato?"
> **Risposta:** "CORS (Cross-Origin Resource Sharing) è un meccanismo dei browser per impedire a un sito terzo non autorizzato di fare richieste alla nostra API. In `server.ts` abbiamo configurato una whitelist esatta (`ALLOWED_ORIGINS`) e rifiutiamo con `403 Forbidden` le origini sconosciute."

### D4: "Cosa succede se Wikipedia è lenta o non risponde?"
> **Risposta:** "Abbiamo impostato un timeout HTTP di 10 secondi tramite Axios. Se la chiamata fallisce o va in timeout, catturiamo l'errore e restituiamo un `502 Bad Gateway` pulito invece di far bloccare il server Express."

### D5: "Perché avete una cache LRU nel backend?"
> **Risposta:** "Gli articoli di Wikipedia più popolari (come 'Napoli' o 'Italia') vengono richiesti frequentemente da più giocatori. Abbiamo implementato una **LRU Cache (Least Recently Used)** con un budget massimo di 50MB per memorizzare l'HTML già sanitizzato, riducendo la latenza a <5ms e diminuendo le chiamate verso Wikipedia."

### D6: "Come funziona la classifica (Leaderboard)?"
> **Risposta:** "La classifica aggrega le partite con stato `COMPLETED`. L'ordinamento premia prima il minor numero di click (`clickCount ASC`), a parità di click il minor tempo impiegato (`durationSeconds ASC`), e a parità di tempo il maggior numero di partite completate."

### D7: "Cosa fa il file docker-compose.yml?"
> **Risposta:** "Permette di avviare l'intera infrastruttura (Database PostgreSQL, Backend Express e Frontend Web) con un singolo comando (`docker compose up`), configurando automaticamente le porte, le variabili d'ambiente e l'health check del database."

### D8: "Come avete testato l'applicazione?"
> **Risposta:** "Abbiamo scritto **53 test automatici** con Vitest, suddivisi in test unitari dei servizi, test di integrazione delle rotte HTTP e test di robustezza contro SQL Injection, IDOR, input malevoli e race condition."

---

## 🎯 5. Regola d'oro per l'orale
Quando rispondi:
1. **Mantieni la calma**: prenditi 2 secondi prima di rispondere.
2. **Inizia dall'alto**: dì prima *l'obiettivo* (es. "Serve per impedire che l'utente imbrogli...") e poi *come è fatto nel codice* (es. "...verificando la presenza del link nella pagina precedente").
3. **Se ti chiede di aprire un file**: vai dritto a uno dei 6 file chiave elencati nella sezione 2!
