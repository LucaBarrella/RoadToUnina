# Capitolo 3: Persistenza Dati, Prisma ORM e PostgreSQL

---

## 1. Teoria Fondamentale

### 1.1 Il Livello di Persistenza e il Modello Relazionale (RDBMS)
Nei sistemi enterprise e nelle architetture web moderne, il **Data Persistence Layer** ha il compito di garantire l'integrità, la durabilità e la consistenza delle informazioni applicative. PostgreSQL è un sistema di gestione di basi di dati relazionali ad oggetti (**ORDBMS**) pienamente conforme agli standard SQL e ai principi **ACID**:
- **Atomicity (Atomicità)**: Tutte le modifiche comprese in una transazione vengono eseguite con successo come singola unità indivisibile; se una qualsiasi operazione fallisce, l'intera transazione subisce un *rollback*, riportando il database allo stato iniziale.
- **Consistency (Consistenza)**: Il database passa esclusivamente da uno stato valido a un altro stato valido, nel rigoroso rispetto di tutti i vincoli (*constraints*), chiavi uniche e chiavi esterne.
- **Isolation (Isolamento)**: Le transazioni concorrenti vengono eseguite senza interferire tra loro.
- **Durability (Durabilità)**: Una volta eseguito il *commit*, le modifiche sono registrate permanentemente (nei file di log Write-Ahead Logging - WAL) e sopravvivono a crash di sistema o interruzioni di corrente.

#### Vincoli Relazionali Fondamentali
1. **Primary Key (Chiave Primaria)**: Attributo o insieme di attributi che identifica univocamente ogni tupla (riga) di una tabella. Non può contenere valori `NULL`.
2. **Foreign Key (Chiave Esterna)**: Attributo che stabilisce una relazione referenziale verso la chiave primaria di un'altra tabella. Mantiene l'**integrità referenziale**: il motore impedisce l'inserimento di valori orfani.
3. **Unique Constraint**: Impedisce la duplicazione di valori in una colonna (es. `email` o `username` unici per ciascun account utente).
4. **Indici B-Tree**: Strutture dati ad albero bilanciato ($O(\log N)$) mantenute dal database per evitare costose scansioni sequenziali dell'intera tabella (*Sequential Scan* o $O(N)$), velocizzando drasticamente le clausole `WHERE`, `JOIN` e `ORDER BY`.

---

### 1.2 ORM (Object-Relational Mapping) vs Query SQL Native
La discrepanza tra il modello orientato agli oggetti (tipi, classi, riferimenti in memoria in TypeScript/JavaScript) e il modello relazionale (tabelle, righe, colonne, algebra relazionale in SQL) prende il nome di **Object-Relational Impedance Mismatch**.

```
┌──────────────────────────────────────────────────────────┐
│              Object-Oriented World (TypeScript)          │
│   const user = { id: "uuid", games: [ { ... } ] }        │
└────────────────────────────┬─────────────────────────────┘
                             │  Prisma Client
                             │  (Type-Safe Query Generation)
                             ▼
┌──────────────────────────────────────────────────────────┐
│              Relational World (PostgreSQL)               │
│   SELECT u.id, g.id FROM "User" u LEFT JOIN "Game" g...   │
└──────────────────────────────────────────────────────────┘
```

- **Query SQL Native**: Massima flessibilità ed efficienza teorica, ma presentano criticità gravi: nessun controllo dei tipi a tempo di compilazione (TypeScript non può validare una stringa SQL grezza), alto rischio di **SQL Injection** se non si usano prepared statements con parametri bindati, e fragilità durante i refactoring.
- **Prisma ORM**: Adotta un approccio basato su **schema dichiarativo**. A partire dal file `schema.prisma`, il compilatore di Prisma genera automaticamente un client TypeScript fortemente tipizzato (`@prisma/client`). Se si rinomina un campo nel database, TypeScript segnala immediatamente tutti gli errori nel codice applicativo a compile-time.

---

### 1.3 Migrazioni Declarative (`prisma migrate`) vs Introspezione (`prisma db pull`)
1. **Prisma Migrate (`prisma migrate dev`)**: Approccio *Code-First/Schema-First*. Lo sviluppatore modifica `schema.prisma`. Prisma calcola la differenza (*diff*) rispetto allo stato del database, genera un file SQL versionabile (es. `20260910_add_status/migration.sql`) e lo applica in modo deterministico. Questo file viene committato nel repository Git.
2. **Prisma DB Pull (`prisma db pull`)**: Approccio *Database-First*. Si usa quando il database esiste già (es. legacy DB). Prisma analizza lo schema fisico di PostgreSQL e genera a ritroso il codice `schema.prisma`.

---

### 1.4 Connection Pooling e Gestione delle Connessioni Concorrenti
In PostgreSQL, ogni connessione TCP aperta da un client genera un processo worker dedicato lato server sul sistema operativo. Aprire e chiudere una connessione di rete per ciascuna richiesta HTTP è un'operazione estremamente costosa (handshake TCP, SSL/TLS, autenticazione, allocazione memoria di processo).

Per ovviare a questo problema si utilizza un **Connection Pool** (gestito tramite la libreria `pg` e l'adapter `@prisma/adapter-pg`):
- Il server mantiene un insieme pre-inizializzato di connessioni aperte e persistenti verso PostgreSQL (es. `max: 10`).
- Quando una richiesta HTTP necessita di eseguire una query, preleva una connessione libera dal pool (*lease*).
- Terminata l'operazione, la connessione non viene distrutta, ma rilasciata nuovamente al pool per essere riutilizzata da richieste successive.
- Se tutte le connessioni sono occupate, le nuove richieste attendono in coda fino allo scadere di un timeout configurabile (`connectionTimeoutMillis`).

```
Richieste HTTP Concorrenti (Node.js Express)
     │         │         │         │
     ▼         ▼         ▼         ▼
┌───────────────────────────────────────────────┐
│        Node.js Process (Singleton Pool)       │
│        Pool pg.Pool (Max: 10 Connessioni)     │
│   [ Conn 1 ] [ Conn 2 ] ... [ Conn 10 ]       │
└───────────────────────┬───────────────────────┘
                        │ Connessioni TCP Persistenti
                        ▼
┌───────────────────────────────────────────────┐
│              PostgreSQL Server                │
│    Worker 1    Worker 2   ...  Worker 10      │
└───────────────────────────────────────────────┘
```

---

## 2. Il Codice nel Nostro Progetto

### 2.1 File: `backend/prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum GameStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  games     Game[]
}

model Game {
  id               String     @id @default(uuid())
  userId           String
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  startPageTitle   String
  currentPageTitle String
  targetPageTitle  String     @default("Università degli Studi di Napoli Federico II")
  status           GameStatus @default(IN_PROGRESS)
  clickCount       Int        @default(0)
  startTime        DateTime   @default(now())
  endTime          DateTime?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  steps            GameStep[]

  @@index([userId, status])
  @@index([status, endTime])
}

model GameStep {
  id        String   @id @default(uuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  pageTitle String
  stepOrder Int
  createdAt DateTime @default(now())

  @@unique([gameId, stepOrder])
  @@index([gameId, stepOrder])
}
```

### 2.2 File: `backend/src/config/db.ts`
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString: string =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/roadtounina?schema=public';

const pool = new Pool({
  connectionString,
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);

export const prisma: PrismaClient = new PrismaClient({ adapter });
```

### 2.3 File: `backend/prisma/seed.ts` (Estratto Popolamento e Transazioni)
```typescript
import { GameStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/db';

async function main() {
  console.log('🌱 Starting comprehensive database seeding for RoadToUnina...');

  await prisma.gameStep.deleteMany({});
  await prisma.game.deleteMany({});
  await prisma.user.deleteMany({});

  const defaultPassword = await bcrypt.hash('Password123!', 10);

  const userData = [
    { username: 'unina_runner', email: 'runner@unina.it' },
    { username: 'speedrunner_napoli', email: 'napoli.runner@unina.it' },
    { username: 'wiki_master', email: 'wikimaster@unina.it' },
  ];

  const createdUsers = [];
  for (const u of userData) {
    const user = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        password: defaultPassword,
      },
    });
    createdUsers.push(user);
  }

  // Creazione di una partita con passi inclusi (Nested Write)
  await prisma.game.create({
    data: {
      userId: createdUsers[0].id,
      startPageTitle: 'Pizza',
      currentPageTitle: 'Università degli Studi di Napoli Federico II',
      targetPageTitle: 'Università degli Studi di Napoli Federico II',
      status: GameStatus.COMPLETED,
      clickCount: 2,
      startTime: new Date(Date.now() - 25000),
      endTime: new Date(),
      steps: {
        create: [
          { pageTitle: 'Pizza', stepOrder: 1 },
          { pageTitle: 'Napoli', stepOrder: 2 },
          { pageTitle: 'Università degli Studi di Napoli Federico II', stepOrder: 3 },
        ],
      },
    },
  });
}
```

---

## 3. Disamina Riga per Riga

### 3.1 `backend/prisma/schema.prisma`
* **Righe 4-6: `generator client { provider = "prisma-client-js" }`**: Configura il generatore del client Prisma. Quando si esegue `npx prisma generate`, Prisma ispeziona questo schema e genera codice TypeScript compilato all'interno di `node_modules/@prisma/client`, esportando i tipi esatti (`User`, `Game`, `GameStep`, `GameStatus`).
* **Righe 8-10: `datasource db { provider = "postgresql" }`**: Istruisce Prisma a produrre sintassi e tipi conformi allo standard PostgreSQL (es. costrutti `timestamp with time zone`, `uuid`, enumerati nativi PostgreSQL).
* **Righe 12-16: `enum GameStatus { IN_PROGRESS COMPLETED ABANDONED }`**: Dichiara un tipo enumerato. Nel database PostgreSQL viene convertito in un tipo ENUM nativo (`CREATE TYPE "GameStatus" AS ENUM (...)`). A livello applicativo garantisce che il campo possa assumere solo uno di questi tre valori rigorosi, impedendo stringhe arbitrarie.
* **Righe 18-26: `model User`**:
  - `id String @id @default(uuid())`: Definisce la chiave primaria del modello come identificatore univoco universale (UUID v4) a 128 bit generato automaticamente. A differenza degli interi sequenziali (`autoincrement`), gli UUID evitano attacchi di enumerazione (dove un attaccante deduce gli ID provando `/api/users/1`, `/2`, ecc.) e sono ideali per sistemi distribuiti.
  - `email String @unique` e `username String @unique`: Crea indici unici a livello di DB (`CREATE UNIQUE INDEX`). Il motore PostgreSQL rifiuterà qualsiasi tentativo di inserire una seconda riga con email o username identici sollevando un errore di violazione di vincolo (codice errore `P2002` in Prisma).
  - `password String`: Memorizza la stringa contenente il digest calcolato dell'hash bcrypt con salt. Non viene mai salvata la password in chiaro.
  - `createdAt DateTime @default(now())`: Timestamp con data e ora di creazione, valorizzato in automatico da Postgres (`CURRENT_TIMESTAMP`).
  - `updatedAt DateTime @updatedAt`: Direttiva speciale di Prisma che aggiorna automaticamente il timestamp ogni volta che la riga subisce una mutazione (`UPDATE`).
  - `games Game[]`: Relazione 1-a-Molti (*One-to-Many*). Campo virtuale lato Prisma: non esiste fisicamente come colonna nella tabella `User` di PostgreSQL, ma consente la navigazione relazionale nel codice TypeScript (`include: { games: true }`).
* **Righe 28-45: `model Game`**:
  - `userId String`: Colonna fisica scalare che ospita la chiave esterna.
  - `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`: Stabilisce la foreign key su `userId` puntando a `User.id`. La direttiva `onDelete: Cascade` impone che se un record `User` viene eliminato, PostgreSQL cancella automaticamente a cascata tutte le partite associate a quell'utente, evitando orfani.
  - `endTime DateTime?`: Il simbolo `?` dichiara il campo come opzionale / nullable (`NULL` su PostgreSQL). Una partita in corso non possiede un `endTime` finché non viene completata o abbandonata.
  - `@@index([userId, status])`: **Indice composito (Composite Index)** su `(userId, status)`. Ottimizza la query critica: *"Verifica se questo utente ha già una partita in stato IN_PROGRESS prima di avviarne una nuova"*. Senza questo indice, PostgreSQL dovrebbe esaminare tutte le partite del database.
  - `@@index([status, endTime])`: Indice composito per la classifica (*Leaderboard*): velocizza le query filtrate su `status = 'COMPLETED'` e ordinate temporalmente per `endTime`.
* **Righe 47-57: `model GameStep`**:
  - `@@unique([gameId, stepOrder])`: **Vincolo di unicità composto**. Garantisce matematicamente che all'interno della stessa partita (`gameId`) non possano mai esistere due passi con il medesimo numero ordinale progressivo (`stepOrder`).
  - `@@index([gameId, stepOrder])`: Velocizza il recupero ordinato della cronologia dei passaggi della cronologia di gioco.

---

### 3.2 `backend/src/config/db.ts`
* **Righe 1-3: `import { PrismaClient } from '@prisma/client'; import { PrismaPg } from '@prisma/adapter-pg'; import { Pool } from 'pg';`**: Importa il client Prisma, l'adapter per driver PostgreSQL nativo e il pool di connessioni della libreria `pg`.
* **Righe 12-17: `const pool = new Pool({ ... })`**:
  - `max: parseInt(process.env.DB_POOL_MAX || '10', 10)`: Numero massimo di client/socket TCP simultanei allocati nel pool verso PostgreSQL.
  - `idleTimeoutMillis: 30000`: Chiude e disalloca un client dal pool se rimane inutilizzato per 30 secondi consecutivi, liberando memoria sul server DB.
  - `connectionTimeoutMillis: 10000`: Tempo massimo di attesa (10 secondi) per ottenere una connessione libera dal pool prima che venga sollevata un'eccezione di timeout.
* **Riga 18: `const adapter = new PrismaPg(pool);`**: Sfrutta la nuova architettura driver adapter di Prisma 7+, delegando la gestione delle connessioni di rete TCP e del pooling al driver maturo `pg` anziché all'engine C++ interno monolitico di Prisma.
* **Riga 26: `export const prisma: PrismaClient = new PrismaClient({ adapter });`**: Istanzia e condivide un **Singleton Pattern**. Esportando una singola istanza globale del client, l'intera applicazione condivide l'unico connection pool configurato.

---

### 3.3 `backend/prisma/seed.ts`
* **Righe 18-20: `await prisma.gameStep.deleteMany({}); ...`**: Rispetta l'ordine di dipendenza dell'integrità referenziale. Si puliscono prima le tabelle figlie (`gameStep`), poi le tabelle intermedie (`game`), e solo alla fine le tabelle madri (`user`).
* **Righe 266-282: Nested Write in `prisma.game.create`**:
  - Prisma esegue le scritture nidificate (`steps: { create: stepsData }`) all'interno di una singola **transazione interattiva implicita a livello di database**. Se la creazione di uno qualsiasi dei `steps` fallisce, l'intero inserimento del `game` viene annullato (*rollback*), evitando stati parzialmente inconsistenti.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Istanziazione multipla di `new PrismaClient()` vs Singleton
* **Domanda del Docente**: *"Cosa accadrebbe a runtime se all'interno di ciascun router o service scrivessimo `const prisma = new PrismaClient()` ad ogni richiesta HTTP invece di importare il singleton da `config/db.ts`?"*
* **Risposta dello Studente**: *"Si verificherebbe un rapido collasso del database per **Connection Pool Exhaustion** (esaurimento delle connessioni). Ogni volta che si invoca `new PrismaClient()`, viene inizializzato un nuovo pool di connessioni TCP con i propri thread worker. Sotto carico (ad esempio 50 richieste concorrenti), verrebbero istanziati 50 pool indipendenti, tentando di aprire centinaia di connessioni TCP verso PostgreSQL. Il database raggiungerebbe immediatamente il limite massimo consentito (`max_connections`, tipicamente 100 su PostgreSQL), iniziando a rifiutare qualsiasi nuova connessione con l'errore irreversibile `FATAL: remaining connection slots are reserved for non-replication superuser connections` e portando l'intero server web in stallo."*

---

### Scenario 4.2: Eliminazione utente e clausole di `onDelete`
* **Domanda del Docente**: *"Nel modello `Game`, la relazione con `User` è definita con `onDelete: Cascade`. Cosa accadrebbe se eliminassimo un record utente con `prisma.user.delete(...)` se la relazione fosse invece configurata con `onDelete: Restrict` oppure senza specificare alcuna policy?"*
* **Risposta dello Studente**: *"L'operazione verrebbe respinta da PostgreSQL con un errore di violazione di chiave esterna (`foreign_key_violation`, codice Prisma `P2003` o `P2014`). La clausola `Restrict` (o `NoAction`, comportamento standard in SQL) impedisce esplicitamente la cancellazione di una riga padre se esistono tuple figlie nella tabella `Game` che puntano a quell'ID (`userId`). Al contrario, con `onDelete: Cascade`, quando cancelliamo un utente, PostgreSQL si occupa atomicamente di eliminare tutte le partite collegate e, a cascata, tutti i passi `GameStep` collegati alle partite, garantendo che non rimangano record orfani nel database."*

---

### Scenario 4.3: Impatto prestazionale di indici mancanti all'aumentare dei dati
* **Domanda del Docente**: *"Perché nel modello `Game` abbiamo creato l'indice composito `@@index([userId, status])`? Cosa accade sul motore di database se rimuoviamo questo indice e il sistema raggiunge 500.000 partite registrate?"*
* **Risposta dello Studente**: *"Ogni volta che un giocatore esegue un'azione o tenta di avviare una partita, il server verifica l'esistenza di partite in corso con la query `WHERE userId = $1 AND status = 'IN_PROGRESS'`. 
  - **Con l'indice**: PostgreSQL consulta la struttura B-Tree in tempo logaritmico $O(\log N)$, individuando i record esatti in una frazione di millisecondo con un *Index Scan*.
  - **Senza l'indice**: PostgreSQL è costretto a eseguire un **Sequential Scan** (scansione sequenziale completa della tabella): deve caricare da disco in memoria RAM tutti i 500.000 blocchi di record per verificare la condizione riga per riga. Ciò causa picchi di utilizzo della CPU al 100%, saturazione del throughput di I/O del disco e tempi di risposta che degradano da 2 ms a oltre 1-2 secondi, portando le richieste in timeout."*

---

### Scenario 4.4: Fallimento a metà operazione in `prisma.$transaction`
* **Domanda del Docente**: *"Supponiamo di voler aggiornare lo stato di una partita e contemporaneamente inserire un nuovo `GameStep` utilizzando `prisma.$transaction([ ... ])`. Cosa succede se il primo update va a buon fine ma l'inserimento del passo fallisce per violazione del vincolo unico `@@unique([gameId, stepOrder])`?"*
* **Risposta dello Studente**: *"L'intera operazione viene annullata grazie alle proprietà di **Atomicità** delle transazioni SQL (principi ACID). Il transaction manager invia al database un comando `ROLLBACK`. Anche se l'update era stato eseguito internamente, nessuna modifica viene salvata in modo permanente su disco: lo stato della partita torna esattamente a quello antecedente alla transazione e il database non rimane in uno stato inconsistente o parzialmente modificato. La Promise di `$transaction` viene rigettata, sollevando un'eccezione che può essere gestita in sicurezza dal nostro `errorMiddleware`."*

---

### Scenario 4.5: Il vincolo `@@unique([gameId, stepOrder])` e la prevenzione di Race Conditions
* **Domanda del Docente**: *"Cosa impedisce a due richieste concorrenti inviate quasi simultaneamente dallo stesso utente (ad esempio con doppio click rapido) di registrare due passi con lo stesso numero ordinale per la medesima partita?"*
* **Risposta dello Studente**: *"La garanzia è fornita dal vincolo di unicità a livello di database `@@unique([gameId, stepOrder])`. Anche se entrambe le richieste superassero simultaneamente i controlli applicativi nel codice Node.js a causa di una race condition sull'Event Loop, nel momento in cui le due query `INSERT INTO "GameStep"` raggiungono il motore PostgreSQL, quest'ultimo serializza la verifica dell'indice univoco. La prima transazione avrà successo, mentre la seconda verrà immediatamente abortita da PostgreSQL con un errore di violazione di vincolo univoco (`23505 unique_violation`). Il nostro backend intercetta questo errore e ritorna al client uno stato controllato, proteggendo l'integrità matematica della cronologia di gioco."*
