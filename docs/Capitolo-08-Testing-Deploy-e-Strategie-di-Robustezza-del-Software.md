# Capitolo 8: Testing, Deploy e Strategie di Robustezza del Software

---

## 1. Teoria Fondamentale

### 1.1 La Piramide dei Test e il Modello di Qualità del Software (ISO/IEC 25010)
Nell'Ingegneria del Software, la validazione della correttezza di un sistema non può basarsi su controlli manuali estemporanei. Si adotta la **Piramide dei Test** (ideata da Mike Cohn):

```
                     / \
                    /   \
                   / E2E \          <-- Pochi, lenti, costosi, ambiente reale
                  /-------\
                 / Integr. \        <-- Componenti + DB + Middleware + HTTP
                /-----------\
               /    Unit     \      <-- Molti, veloci (<1ms), isolamento puro
              /---------------\
```

1. **Unit Test (Base)**: Testano la più piccola unità computabile di codice (una singola funzione pura o classe) in totale isolamento. Qualsiasi dipendenza esterna (database, rete, timer) viene simulata tramite *Mock*. Sono velocissimi (frazioni di millisecondo) e consentono di coprire in modo esaustivo tutti i rami di controllo (*branch coverage*).
2. **Integration Test (Centro)**: Verificano la cooperazione tra più moduli integrati: es. l'applicazione Express che invoca la pipeline dei middleware, esegue le validazioni Zod e comunica con un'istanza reale di PostgreSQL tramite Prisma.
3. **End-to-End (E2E) Test (Vertice)**: Verificano l'intero sistema integrato dal punto di vista dell'utente finale. Un browser headless (guidato da **Playwright**) simula click, input tastiera e navigazioni su rete reale, verificando l'esperienza utente completa.

---

### 1.2 Toolchain di Testing: Vitest vs Jest, Supertest e Playwright
- **Perché Vitest anziché Jest**: Vitest è progettato nativamente sull'infrastruttura di **Vite**. Condivide la stessa configurazione di build, le trasformazioni dei moduli e i plugin (`esbuild`), supportando nativamente TypeScript e ECMAScript Modules (ESM) senza richiedere complessi file di configurazione (`ts-jest`, `babel.config.js`). L'esecuzione dei test è multi-thread e da 2 a 10 volte più rapida rispetto a Jest.
- **Supertest**: Libreria di astrazione HTTP per test di integrazione in Node.js. Permette di testare le rotte di un'applicazione Express (`request(app).post(...)`) iniettando le richieste direttamente sul listener interno del framework **senza dover legare l'applicazione a una porta TCP fisica reale del sistema operativo** (`app.listen()`). Ciò elimina conflitti di porte (`EADDRINUSE`) e consente l'esecuzione deterministica delle suite di test.
- **Playwright**: Framework di automazione browser headless moderno. Consente di testare scenari E2E complessi con rendering di browser multipiattaforma (Chromium, Firefox, WebKit), gestendo automaticamente l'attesa degli elementi nel DOM (*Auto-Waiting*) e prevenendo problemi di instabilità nei test (*flaky tests*).

---

### 1.3 Strategie di Mocking: Mock, Stub e Spy
Durante l'esecuzione dei test unitari, isolare i comportamenti esterni non deterministici o a pagamento è obbligatorio:
- **Dummy**: Valori passati solo per riempire i parametri di una funzione ma mai usati.
- **Stub**: Oggetto che restituisce risposte pre-configurate (*canned answers*) a chiamate effettuate durante il test (es. `mockResolvedValueOnce({ title: 'Vesuvio' })`).
- **Spy**: Wrapper che osserva e registra come una funzione viene invocata (quante volte, con quali argomenti, se ha sollevato eccezioni). In Vitest si crea con `vi.spyOn()`.
- **Mock**: Oggetto pre-programmato con aspettative che formano una specifica dei comportamenti attesi (creato in Vitest con `vi.fn()` o `vi.mock('modulo')`).

#### Perché mockare l'API di Wikipedia nei Test Unitari:
Se la suite di test dipendesse dai server remoti di `it.wikipedia.org`:
1. Una disconnessione internet locale farebbe fallire tutti i test di build.
2. Le pagine di Wikipedia possono essere modificate in qualsiasi istante da utenti terzi, rompendo l'asserzione dei test (*Non-Deterministic Tests*).
3. Eseguire centinaia di test al secondo causerebbe il blocco immediato dell'IP per violazione dei rate limit della Wikimedia Foundation.

---

### 1.4 Containerizzazione e Architettura di Deployment (Docker vs VM)
A differenza di una **Macchina Virtuale (VM)** — che virtualizza l'intero hardware ed esegue un sistema operativo guest completo con pesante overhead di RAM e kernel separato —, un **Container Docker** condivide il kernel del sistema operativo host. Ogni container isola lo spazio dei processi (*Process Namespaces*), il file system (*chroot/overlay2*) e le risorse di CPU/RAM (*cgroups*), garantendo avvii istantanei e consumo minimo di memoria.

```
┌────────────────────────────────────────────────────────┐
│               Docker Compose Network                   │
│                                                        │
│  ┌──────────────────┐            ┌──────────────────┐  │
│  │   frontend       │            │     backend      │  │
│  │   (Nginx / Vite) │            │   (Node.js API)  │  │
│  │   Porta: 80/5173 │            │   Porta: 3001    │  │
│  └─────────┬────────┘            └────────┬─────────┘  │
│            │                              │            │
│            └──────────────┬───────────────┘            │
│                           │ TCP Interno                │
│                           ▼                            │
│                  ┌──────────────────┐                  │
│                  │        db        │                  │
│                  │ (PostgreSQL 16)  │                  │
│                  │ Volume: pg_data  │                  │
│                  └──────────────────┘                  │
└────────────────────────────────────────────────────────┘
```

---

### 1.5 Disaster Recovery, Resilienza Operativa e Graceful Shutdown
In un ambiente cloud o containerizzato (Render, Kubernetes, Docker), i nodi di calcolo possono essere riavviati, scalati o sostituiti in qualsiasi momento.
Un'applicazione software professionale non deve terminare bruscamente (*abrupt termination* o `kill -9`):
1. Quando l'orchestratore arresta un container, invia il segnale POSIX **`SIGTERM`** (o `SIGINT` da tastiera Ctrl+C).
2. Il processo Node.js intercetta il segnale e avvia la procedura di **Graceful Shutdown**:
   - Smette di accettare nuove connessioni HTTP in ingresso (`server.close()`).
   - Attende il completamento delle richieste HTTP già in volo entro un periodo di grace period.
   - Esegue il draining e la chiusura ordinata del pool di connessioni del database (`await prisma.$disconnect()`), evitando transazioni sospese o lock orfani su PostgreSQL.
   - Termina pulitamente con codice di uscita zero (`process.exit(0)`).

---

## 2. Il Codice nel Nostro Progetto

### 2.1 File: `backend/vitest.config.mts` (Configurazione Runner)
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
```

### 2.2 File: `backend/src/__tests__/robustnessQA.test.ts` (Estratto Concorrenza e Anti-Cheat)
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../config/db';
import { authService } from '../services/authService';
import { gameService } from '../services/gameService';
import { wikiService } from '../services/wikiService';
import { GameStatus } from '@prisma/client';

describe('Principal QA Robustness Suite — RoadToUnina Backend', () => {
  let app: Express;
  let userAlphaToken: string;
  let userAlphaId: string;

  beforeAll(async () => {
    app = createApp();
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.user.deleteMany({});

    const resAlpha = await authService.register({
      email: 'qa.alpha@unina.it',
      username: 'qa_alpha_tester',
      password: 'StrongPassword123!',
    });
    userAlphaToken = resAlpha.token;
    userAlphaId = resAlpha.user.id;
  });

  beforeEach(async () => {
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
  });

  afterAll(async () => {
    await prisma.gameStep.deleteMany({});
    await prisma.game.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('should maintain atomic consistency under 15 simultaneous step requests on the same game', async () => {
    process.env.NODE_ENV = 'test';
    const { game } = await gameService.startGame(userAlphaId, 'Napoli');

    const napoliContent = await wikiService.getWikiArticleContent('Napoli');
    const validLink = napoliContent.validLinks[0] || 'Vesuvio';

    // Lancio di 15 richieste parallele concorrenti
    const concurrentRequests = Array.from({ length: 15 }).map(() =>
      request(app)
        .post(`/api/games/${game.id}/step`)
        .set('Authorization', `Bearer ${userAlphaToken}`)
        .send({ targetTitle: validLink })
    );

    const responses = await Promise.all(concurrentRequests);

    const successResponses = responses.filter((r) => r.status === 200);
    const conflictOrRejected = responses.filter((r) => [400, 409].includes(r.status));

    // Esattamente 1 sola richiesta deve andare a buon fine, le altre 14 respinte
    expect(successResponses.length).toBe(1);
    expect(conflictOrRejected.length).toBe(14);

    const finalGame = await prisma.game.findUniqueOrThrow({
      where: { id: game.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    expect(finalGame.clickCount).toBe(1);
    expect(finalGame.steps.length).toBe(2);
    expect(finalGame.steps[0]?.stepOrder).toBe(1);
    expect(finalGame.steps[1]?.stepOrder).toBe(2);
  });
});
```

### 2.3 File: `docker-compose.yml` (Orchestrazione Multi-Container)
```yaml
version: '3.8'

services:
  db:
    image: postgres:18-alpine
    container_name: roadtounina_db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: roadtounina
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: roadtounina_backend
    restart: always
    environment:
      PORT: 3001
      DATABASE_URL: "postgresql://postgres:postgrespassword@db:5432/roadtounina?schema=public"
      JWT_SECRET: "${JWT_SECRET:-local_dev_docker_compose_super_secret_jwt_key_32_chars}"
      NODE_ENV: "${NODE_ENV:-development}"
      ALLOWED_ORIGINS: "http://localhost:80,http://localhost:5173,http://localhost"
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
    command: >
      sh -c "npx prisma db push && npm run start"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: roadtounina_frontend
    restart: always
    ports:
      - "80:80"
      - "5173:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### 2.4 File: `backend/src/server.ts` (Graceful Shutdown)
```typescript
export const gracefulShutdown = async (server?: Server): Promise<void> => {
  console.log('\n⏳ Gracefully shutting down RoadToUnina server...');
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma DB connection pool disconnected.');
  } catch (err) {
    console.error('❌ Error disconnecting Prisma:', err);
  }

  if (server) {
    server.close(() => {
      console.log('👋 HTTP server closed.');
      process.exit(0);
    });
    return;
  }
  process.exit(0);
};

export const startServer = (): Server => {
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`🚀 RoadToUnina Backend Server running on port ${PORT}`);
  });

  process.on('SIGINT', () => gracefulShutdown(server));
  process.on('SIGTERM', () => gracefulShutdown(server));

  return server;
};
```

---

## 3. Disamina Riga per Riga

### 3.1 `backend/vitest.config.mts`
* **Riga 5: `globals: true`**: Rende globali le funzioni di test (`describe`, `it`, `expect`, `vi`), evitando di doverle importare manualmente all'inizio di ciascun file di test.
* **Riga 6: `fileParallelism: false`**: Direttiva architetturale cruciale. Forza l'esecuzione **sequenziale** dei file di test anziché parallela. Poiché i test di integrazione operano su un database PostgreSQL reale condiviso, l'esecuzione parallela di più suite causerebbe conflitti di pulizia tabelle e violazioni di chiavi esterne (*inter-test interference*).
* **Riga 7: `testTimeout: 30000`**: Fissa il timeout di ciascun test a 30 secondi (rispetto ai 5 secondi standard di Jest), garantendo che le operazioni di transazione o le chiamate con fallback a Wikipedia non falliscano prematuramente per timeout di test.

---

### 3.2 `backend/src/__tests__/robustnessQA.test.ts`
* **Righe 21-46: `beforeAll` Lifecycle Hook**:
  - Esegue il setup iniziale: inizializza l'istanza di Express (`createApp()`) e azzera il database da eventuali dati residui (`deleteMany`).
  - Registra due utenti distinti (`User Alpha` e `User Beta`) e ne estrae ID e token JWT per simulare attacchi di autorizzazione e scalata di privilegi (IDOR - Insecure Direct Object Reference).
* **Righe 48-52: `beforeEach` e Isolamento dello Stato**:
  - Pulisce le tabelle `gameStep` e `game` prima di ogni singolo test `it(...)`. Garantisce il principio di **Indipendenza dei Test**: l'ordine di esecuzione dei test non deve influenzare l'esito del test successivo.
* **Righe 54-58: `afterAll` Teardown Hook**:
  - Pulisce completamente il database al termine della suite per lasciare l'ambiente pronto ad altre esecuzioni.
* **Righe 495-528: Test di Stress e Concorrenza (Race Condition)**:
  - Genera 15 promesse parallele con `Array.from({ length: 15 }).map(...)` e le invia simultaneamente con `Promise.all()`.
  - Simula l'invio concorrente di 15 click contemporanei per la stessa mossa di gioco.
  - Verifica l'integrità del database: solo **1 sola mossa** viene registrata, il contatore `clickCount` vale rigorosamente `1` e `steps.length` è esattamente `2` (partenza + 1 arrivo), certificando che il meccanismo di Optimistic Concurrency Control implementato con Prisma impedisce la duplicazione dei dati.

---

### 3.3 `docker-compose.yml`
* **Righe 16-20: Database Healthcheck**:
  - Esegue periodicamente il comando `pg_isready -U postgres` all'interno del container DB.
  - Verifica che PostgreSQL sia fisicamente pronto ad accettare connessioni prima che il backend venga avviato.
* **Righe 37-38: `depends_on: db: condition: service_healthy`**:
  - Risolve il classico problema dei microservizi containerizzati: senza questo controllo, il backend si avvierebbe prima che il database abbia terminato la fase di inizializzazione dei file di storage, fallendo con `ECONNREFUSED`.
* **Riga 40: `command: sh -c "npx prisma db push && npm run start"`**:
  - All'avvio del container backend, Prisma allinea automaticamente lo schema di PostgreSQL con `db push` e successivamente avvia il server Express in produzione.
* **Righe 54-56: Named Volume `postgres_data`**:
  - Monta il volume persistente sul path `/var/lib/postgresql` del container. Garantisce la **Durabilità dei Dati**: se il container del database viene arrestato o distrutto, i dati degli utenti e delle classifiche non vengono persi.

---

### 3.4 `backend/src/server.ts` (Graceful Shutdown)
* **Righe 128-145: Funzione `gracefulShutdown`**:
  - Invoca `await prisma.$disconnect()`: attende che le query in corso terminino e rilascia tutte le connessioni del pool `pg`.
  - Invoca `server.close()`: chiude il socket HTTP TCP di Express, rifiutando nuove connessioni e terminando il processo pulitamente con `process.exit(0)`.
* **Righe 159-160: Process Signal Listeners**:
  - Registra i listener sugli eventi di sistema `SIGINT` (interruzione da terminale) e `SIGTERM` (richiesta di terminazione controllata da orchestratori cloud come Docker o Render).

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Omissione della Pulizia del Database nei Test (`beforeEach` / `afterEach`)
* **Domanda del Docente**: *"Cosa accadrebbe se rimuovessimo il blocco `beforeEach` che esegue `prisma.game.deleteMany({})` all'interno della suite di test di robustezza?"*
* **Risposta dello Studente**: *"I test diventerebbero **flaky** (non deterministici e interdipendenti). Se un test avvia una partita per lo User Alpha (`status: IN_PROGRESS`) e il database non viene ripulito prima del test successivo, il test successivo fallirà con errore 400 (`ACTIVE_GAME_EXISTS`) appena tenterà di invocare `startGame`. Inoltre, l'ordine di esecuzione dei test diventerebbe vincolante: eseguendo un singolo test isolato (`vitest -t 'makeStep'`) il test potrebbe passare, ma fallirebbe se eseguito all'interno dell'intera suite. La pulizia preliminare in `beforeEach` è un pilastro fondamentale dell'integrità dei test."*

---

### Scenario 4.2: Arresto Brusco del Processo (SIGKILL) vs Graceful Shutdown
* **Domanda del Docente**: *"Cosa accade a runtime se Docker o il server cloud termina il processo con `kill -9` (SIGKILL) anziché consentire l'esecuzione di `gracefulShutdown` con SIGTERM?"*
* **Risposta dello Studente**: *"Con `kill -9`, il sistema operativo termina istantaneamente il processo Node.js senza concedergli alcuna opportunità di eseguire codice di pulizia. 
  - Tutte le richieste HTTP dei client attualmente in transito vengono troncate bruscamente con `ERR_CONNECTION_RESET`.
  - Le connessioni TCP aperte verso PostgreSQL rimangono 'orfane' sul server database finché non scatta il keep-alive del socket TCP, saturando temporaneamente il connection pool.
  - Se il server stava eseguendo una transazione multi-query non ancora committata, PostgreSQL deve ricorrere al rollback d'emergenza tramite i file WAL (Write-Ahead Logging). Con il nostro **Graceful Shutdown**, intercettiamo SIGTERM, chiudiamo le connessioni HTTP e rilasciamo il pool Prisma in modo ordinato."*

---

### Scenario 4.3: Esposizione Pubblica della Porta del Database PostgreSQL
* **Domanda del Docente**: *"Nel file `docker-compose.yml`, la porta 5432 è mappata come `"5432:5432"`. Qual è il pericolo di sicurezza se pubblichiamo questa configurazione su un server di produzione aperto su Internet?"*
* **Risposta dello Studente**: *"Mappare `"5432:5432"` sull'interfaccia pubblica dell'host espone la porta di PostgreSQL all'intera rete Internet. Qualsiasi bot o attaccante esterno potrebbe tentare attacchi a forza bruta sulle credenziali di Postgres o sfruttare vulnerabilità del servizio. In produzione, la porta del database non deve mai essere esposta sull'host pubblico: all'interno della rete virtuale privata creata da Docker Compose, il container `backend` può comunicare con il database usando il nome del servizio DNS interno (`postgresql://...@db:5432`), mantenendo la porta 5432 completamente chiusa e inaccessibile dall'esterno."*

---

### Scenario 4.4: Test con Database SQLite in Memoria vs PostgreSQL Reale
* **Domanda del Docente**: *"Alcuni sviluppatori preferiscono eseguire le suite di test contro un database SQLite in memoria (`:memory:`) per velocità. Perché per il nostro progetto abbiamo scelto di eseguire i test di integrazione su PostgreSQL reale?"*
* **Risposta dello Studente**: *"Perché testare su SQLite introduce una pericolosa discrepanza architetturale (**Environment Parity Mismatch**). SQLite e PostgreSQL presentano differenze sostanziali:
  1. SQLite non supporta i tipi nativi ENUM di PostgreSQL (come il nostro `GameStatus`).
  2. La gestione della concorrenza e dei blocchi a livello di riga (*Row-Level Locking*) è profondamente diversa: SQLite blocca l'intero database in scrittura, mentre PostgreSQL supporta transazioni concorrenti avanzate e clausole optimistic concurrency.
  3. Funzioni di date/time e indici compositi hanno comportamenti differenti.
  Eseguire i test su PostgreSQL (locale o containerizzato) garantisce che ciò che viene collaudato nei test automatici rispecchi al 100% il comportamento esatto dell'ambiente di produzione."*

---

### Scenario 4.5: Dimostrazione di Robustezza ad Input Anomali all'Esame Orale
* **Domanda del Docente**: *"Come puoi dimostrarmi formalmente durante l'esame che la tua applicazione è pienamente resistente a payload malevoli, input malformati e tentativi di exploit senza andare in crash?"*
* **Risposta dello Studente**: *"Posso dimostrarlo lanciando in tempo reale la suite di test dedicata [`robustnessQA.test.ts`](file:///Users/lucabarrella/Documents/RoadToUnina/backend/src/__tests__/robustnessQA.test.ts) tramite il comando `npm test`. La suite esegue decine di test automatici che verificano:
  - Resilienza a JSON con sintassi corrotta (`Malformed JSON payload`).
  - Stringhe che superano i limiti di confine (email > 255 caratteri, password > 128 caratteri, username fuori range).
  - Type confusion (invio di array, numeri o booleani al posto di stringhe).
  - Tentativi di scalata di privilegi (un utente che tenta di muovere o abbandonare la partita di un altro giocatore, respinto con 404/403).
  - Concorrenza estrema con 15 richieste simultanee per la stessa mossa, gestite senza duplicazioni o incoerenze nel DB.
  Tutti i test passano con successo (verdi), dimostrando l'assoluta robustezza dell'architettura e l'efficacia del middleware di gestione centralizzata degli errori."*
