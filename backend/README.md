# 🚀 RoadToUnina — Back-end API

[![Live API](https://img.shields.io/badge/Live_API-Render.com-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://roadtounina-backend.onrender.com/api/public/leaderboard)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Vitest Tests](https://img.shields.io/badge/Vitest-58%2F58%20Passing%20(100%25)-44A833?style=for-the-badge&logo=vitest&logoColor=white)](#-esecuzione-dei-test-automatizzati)

API RESTful per la piattaforma di speedrunning enciclopedico **RoadToUnina** sviluppata con **Node.js**, **Express 5**, **TypeScript**, **Prisma ORM v7** e **PostgreSQL** (driver `@prisma/adapter-pg` con Supabase connection pooling).

---

## 👨‍🎓 Progetto & Studente

- **Istituzione:** Università degli Studi di Napoli Federico II
- **Insegnamento:** Tecnologie Web (Spring 2026) — Docente: **Prof. Luigi Libero Lucio Starace, Ph.D.**
- **Studente:** **Luca Barrella** — Matricola: **`N86004677`**
- **Traccia:** **RoadToUnina** *(Sez. 4 di [REQUIREMENTS.md](../REQUIREMENTS.md))*

---

## 🐳 1. Avvio con Docker Compose (Locale)

```bash
# Dalla radice del progetto:
docker compose up --build
```

- **Backend REST API:** `http://localhost:3001`
- **Database PostgreSQL:** `localhost:5432`
- **Frontend SPA:** `http://localhost:5173` (o `http://localhost:80`)

---

## 💻 2. Esecuzione Locale (Development)

```bash
cd backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss
npx prisma db seed   # Popola 10 utenti e 20 partite storiche
npm run dev
```

Il server sarà attivo su: **`http://localhost:3001`**.

---

## 🧪 Esecuzione dei Test Automatizzati

Il backend include **58 test automatizzati** (unitari, di integrazione, concorrenza, anti-cheat e sicurezza):

```bash
cd backend
npm test
```

### Dettaglio Suite:
- **`robustnessQA.test.ts` (25 test):** Validazione Zod, anti-cheat su Wikipedia, isolamento IDOR, race condition atomiche, timeout 24h.
- **`breakBackend.test.ts` (12 test):** Stress test (20 req simultanee), SQL injection, DoS protection, XSS filtering, JWT security.
- **`wikiService.test.ts` (8 test):** Parsing MediaWiki, estrazione link Namespace 0, DOM sanitization, caching LRU.
- **`gameService.test.ts` (13 test):** Ciclo di vita del gioco, transizioni di stato atomiche, vittoria e calcolo path.

---

## 📡 Riepilogo Endpoint REST API

| Metodo | Endpoint | Accesso | Descrizione |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | Pubblico | Health check diagnostico per cloud orchestrator e Docker. |
| `GET` | `/api/docs/` | Pubblico | Documentazione interattiva Swagger UI (OpenAPI 3.0). |
| `GET` | `/api/openapi.json` | Pubblico | Specifica raw OpenAPI 3.0 in formato JSON. |
| `POST` | `/api/auth/register` | Pubblico | Registrazione nuovo utente con password cifrata in bcrypt. |
| `POST` | `/api/auth/login` | Pubblico | Autenticazione utente ed emissione token JWT. |
| `GET` | `/api/auth/me` | Protetto | Profilo utente autenticato. |
| `POST` | `/api/games/start` | Protetto | Avvio nuova partita da voce casuale (restituisce stato gioco + HTML voce iniziale). |
| `GET` | `/api/games/active` | Protetto | Recupero stato partita attiva e contenuto HTML pagina corrente. |
| `POST` | `/api/games/:id/step` | Protetto | Navigazione a un link target con anti-cheat (restituisce stato aggiornato + HTML nuovo articolo). |
| `POST` | `/api/games/:id/abandon` | Protetto | Forfeit / abbandono manuale della partita attiva. |
| `GET` | `/api/public/completed-games` | Pubblico | Storico partite concluse con percorso e tempi. |
| `GET` | `/api/public/leaderboard` | Pubblico | Classifica globale dei migliori giocatori. |

---

## 📁 Struttura della Directory

```
backend/
├── prisma/                  # Schema relazionale Prisma e seed di popolamento
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── __tests__/           # Suite di test automatizzati Vitest (58 test)
│   ├── config/              # Configurazione DB, pooler, env e OpenAPI
│   ├── constants/           # Codici di errore standardizzati
│   ├── middlewares/         # Pipeline middleware (Auth JWT, Zod validation, Error)
│   ├── routes/              # Express Router (auth, games, public)
│   ├── services/            # Business logic (Wikipedia client, anti-cheat, sessioni)
│   ├── types/               # Definizioni TypeScript globali (Express request user)
│   └── server.ts            # Entry point dell'applicazione Express
├── Dockerfile               # Configurazione multi-stage container Docker
├── package.json             # Descrittore dipendenze e script npm
└── tsconfig.json            # Configurazione TypeScript (strict mode)
```
