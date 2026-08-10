# 🎓 RoadToUnina — Piattaforma Web & Sfida Enciclopedica

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-v19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3.4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready%201--Command-2496ED?logo=docker&logoColor=white)](#-1-avvio-rapido-con-docker-compose-raccomandato)
[![Tests](https://img.shields.io/badge/Vitest-50%2F50%20Passing%20(100%25)-44A833?logo=vitest&logoColor=white)](#-3-esecuzione-dei-test-automatizzati)

Elaborato progettuale e implementazione full-stack per la traccia d'esame **RoadToUnina**: una piattaforma web competitiva in cui gli utenti registrati avviano una sfida partendo da una voce casuale estratta in tempo reale da Wikipedia e navigano, **esclusivamente attraverso i collegamenti ipertestuali interni verificati dal server**, per raggiungere la pagina dell'**Università degli Studi di Napoli Federico II** nel minor numero di click e nel minor tempo possibile.

> 📄 **Requisiti Ufficiali:** Consulta il documento [REQUIREMENTS.md](./REQUIREMENTS.md) per i dettagli completi della traccia e le linee guida didattiche.  
> 🛡️ **Specifiche Architetturali:** Consulta [backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md) per i diagrammi UML (Casi d'Uso, Macchina a Stati, ER, Sequenza), la gestione della concorrenza e la matrice di tracciabilità software.
> 🔍 **Walkthrough Codice:** Consulta [backend/CODE_WALKTHROUGH.md](./backend/CODE_WALKTHROUGH.md) per l'analisi del codice sorgente backend.

---

## 👨‍🎓 Informazioni Progetto & Studente

| Campo | Dettaglio Accademico |
| :--- | :--- |
| **Istituzione** | **Università degli Studi di Napoli Federico II** |
| **Dipartimento** | Dipartimento di Ingegneria Elettrica e delle Tecnologie dell'Informazione (DIETI) |
| **Corso di Laurea** | Corso di Laurea Triennale in **Informatica** |
| **Insegnamento** | **Tecnologie Web** — Anno Accademico 2025/2026 (Spring 2026) |
| **Docente** | **Prof. Luigi Libero Lucio Starace, Ph.D.** |
| **Studente** | **Luca Barrella** |
| **Matricola** | **`N86004677`** |
| **Traccia Assegnata** | **RoadToUnina** *(Sezione 4 di [REQUIREMENTS.md](./REQUIREMENTS.md))* |

---

## 🎮 Descrizione del Gioco e Regole di RoadToUnina

**RoadToUnina** è uno speedrun enciclopedico interattivo basato sulle voci di Wikipedia Italia.

### 📋 Regole di Gioco:
1. **Origine Casuale:** Ad ogni nuova partita (`IN_PROGRESS`), il sistema estrae una voce di partenza casuale dal namespace principale (Namespace 0) di Wikipedia Italia.
2. **Obiettivo Finale:** Raggiungere la pagina target ufficiale dell'**Università degli Studi di Napoli Federico II** (`"Università degli Studi di Napoli Federico II"`).
3. **Navigazione Vincolata e Anti-Cheat:** 
   - Il giocatore può proseguire la partita **esclusivamente** cliccando sui link ipertestuali interni (Namespace 0) presenti nell'HTML sanitizzato restituito dal server.
   - Ogni click invia una richiesta HTTP `POST /api/games/:id/step` specificando il titolo target. Il backend valida lato server che il link sia effettivamente contenuto nella pagina corrente prima di avanzare. tentativi di manomissione o inserimento manuale di link non presenti vengono bloccati dal sistema anti-cheat.
4. **Condizioni di Conclusione:**
   - **Vittoria (`COMPLETED`):** Raggiungimento della pagina target. Vengono registrati nel database il numero totale di passi (click), la durata cronometrata in secondi e il percorso esatto di titoli visitati.
   - **Abbandono (`ABANDONED`):** Resa volontaria dell'utente tramite apposito pulsante.
   - **Timeout per Inattività (`EXPIRED`):** Partite aperte da oltre 24 ore senza attività vengono automaticamente invalidate.
5. **Classifica & Trasparenza:** Le partite completate alimentano la leaderboard pubblica globale (classificata per minor numero di passi e minor tempo di completamento).

---

## 🐳 1. Avvio Rapido con Docker Compose (Raccomandato)

La modalità di esecuzione tramite **Docker Compose** è la soluzione **ufficiale e raccomandata per la valutazione**, in quanto orchestra e avvia l'intero stack applicativo con **un solo comando**:

```bash
docker-compose up --build
```

*(oppure `docker compose up --build` sulle versioni più recenti di Docker)*

### 🌐 Servizi Attivati & Porte di Ascolto

| Servizio | URL / Porta | Descrizione |
| :--- | :--- | :--- |
| **🖥️ Front-end SPA** | **[`http://localhost:80`](http://localhost:80)** (o `http://localhost:5173`) | Single Page Application React servita da Nginx con Reverse Proxy verso `/api/`. |
| **⚙️ Back-end API** | **[`http://localhost:3001`](http://localhost:3001)** | Server RESTful Express 5 + TypeScript + Prisma ORM con attesa DB pronto via healthcheck. |
| **🗄️ Database** | **`localhost:5432`** | PostgreSQL 18 Alpine con healthcheck `pg_isready` e volume persistente (`postgres_data`). |

### Arresto dei Container
Per fermare ed eliminare i container e i volumi:
```bash
docker-compose down -v
```

---

## 💻 2. Esecuzione Locale / Sviluppo (Due Terminali)

Per attività di sviluppo con hot-reloading attivo su entrambi i livelli (Backend e Frontend):

### Prerequisiti Locali
- **Node.js** v20.x o superiore
- **npm** v10.x o superiore
- Database **PostgreSQL 18** attivo (tramite `docker-compose up db -d` o istanza locale su porta 5432).

---

### Terminale 1: Back-end API (Node.js / Express)

```bash
# 1. Accedi alla cartella backend
cd backend

# 2. Configura le variabili d'ambiente (se necessario)
cp .env.example .env

# 3. Installa le dipendenze
npm install

# 4. Sincronizza lo schema Prisma con PostgreSQL
npx prisma generate
npx prisma db push

# 5. Avvia il server in modalità dev
npm run dev
```
*(Backend disponibile su: `http://localhost:3001`)*

---

### Terminale 2: Front-end SPA (React / Vite)

```bash
# 1. Accedi alla cartella frontend
cd frontend

# 2. Configura le variabili d'ambiente (se necessario)
cp .env.example .env

# 3. Installa le dipendenze
npm install

# 4. Avvia il server di sviluppo Vite
npm run dev
```
*(Frontend disponibile su: `http://localhost:5173`)*

---

## 🧪 3. Esecuzione dei Test Automatizzati

Il progetto include una suite completa di **50 test automatizzati** (unitari, di integrazione, stress test e sicurezza):

```bash
cd backend

# Esecuzione della suite completa
npm test

# Esecuzione in modalità interattiva watch
npx vitest

# Generazione report di copertura
npx vitest run --coverage
```

### Copertura Test:
- **`robustnessQA.test.ts` (25 test):** Validazione Zod, anti-cheat su Wikipedia, isolamento IDOR, race condition, timeout 24h.
- **`breakBackend.test.ts` (12 test):** Stress test (20 req simultanee), SQL injection, DoS protection (payload giganti), XSS filtering, JWT security.
- **`gameService.test.ts` (8 test):** Ciclo di vita del gioco, transizioni di stato atomiche, vittoria e calcolo path.
- **`wikiService.test.ts` (5 test):** Parsing MediaWiki, estrazione link Namespace 0, sanitizzazione HTML, caching LRU.

---

## 🗺️ Mappa dei Documenti di Progetto

| Documento | Percorso | Descrizione |
| :--- | :--- | :--- |
| 📄 **Requisiti d'Esame** | [`/REQUIREMENTS.md`](./REQUIREMENTS.md) | Traccia ufficiale del progetto didattico d'esame. |
| 🚀 **Backend README** | [`/backend/README.md`](./backend/README.md) | Documentazione operativa dell'API REST, env vars ed endpoint backend. |
| 🛡️ **Backend Architecture** | [`/backend/ARCHITECTURE.md`](./backend/ARCHITECTURE.md) | Specifica architetturale completa (UML Use Case, FSM, ER, Sequence, OCC, Matrice di Tracciabilità). |
| 🔍 **Backend Code Walkthrough** | [`/backend/CODE_WALKTHROUGH.md`](./backend/CODE_WALKTHROUGH.md) | Analisi riga per riga del sorgente backend, pattern e sicurezza. |

---

## 🛠️ Stack Tecnologico

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ROADTOUNINA STACK                             │
├───────────────────┬────────────────────────────────────────────────────┤
│ Front-end SPA     │ React 19, TypeScript, Vite, Tailwind CSS / Vanilla │
│ Back-end API      │ Node.js (v20+), Express 5, TypeScript (Strict)     │
│ Data Layer / ORM  │ Prisma ORM v7, PostgreSQL 18, @prisma/adapter-pg   │
│ Security & Anti-XSS│ Sanitize-HTML, Helmet, Rate Limiter, Bcrypt, JWT   │
│ Caching Layer     │ LRU Cache In-Memory (TTL 1h, latenza < 1ms)        │
│ Test Runner       │ Vitest (50/50 test superati - 100% passing)        │
│ Container Engine  │ Docker, Docker Compose, Nginx Multi-Stage Alpine   │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

<div align="center">
  <b>Università degli Studi di Napoli Federico II</b><br>
  <i>Corso di Laurea in Informatica — Tecnologie Web (Spring 2026)</i><br>
  <b>Luca Barrella</b> (Matricola <code>N86004677</code>)
</div>
