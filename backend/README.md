# 🚀 RoadToUnina — Back-end API

[![Università Federico II](https://img.shields.io/badge/Università-Federico%20II%20di%20Napoli-blue?logo=academia&logoColor=white)](https://www.unina.it/)
[![Corso](https://img.shields.io/badge/Corso-Tecnologie%20Web%20(Spring%202026)-0052CC)](../REQUIREMENTS.md)
[![Autore](https://img.shields.io/badge/Studente-Luca%20Barrella%20(N86004677)-success)](#-progetto--studente)
[![PostgreSQL 18](https://img.shields.io/badge/Database-PostgreSQL%2018-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-50%2F50%20Passing%20(100%25)-44A833?logo=vitest&logoColor=white)](#-esecuzione-dei-test-automatizzati)

API RESTful per la piattaforma di speedrunning enciclopedico **RoadToUnina** sviluppata con **Node.js**, **Express 5**, **TypeScript**, **Prisma ORM** e **PostgreSQL 18** (driver `pg` / `@prisma/adapter-pg`).

> 📄 **Requisiti d'Esame:** [REQUIREMENTS.md](../REQUIREMENTS.md)  
> 📖 **Specifiche Architetturali:** [ARCHITECTURE.md](./ARCHITECTURE.md) (Diagrammi UML, Casi d'Uso, Macchina a Stati, ER, Sequenza, OCC & Anti-Cheat)

---

## 👨‍🎓 Progetto & Studente

- **Istituzione:** Università degli Studi di Napoli Federico II
- **Insegnamento:** Tecnologie Web (Spring 2026) — Docente: **Prof. Luigi Libero Lucio Starace, Ph.D.**
- **Studente:** **Luca Barrella** — Matricola: **`N86004677`**
- **Traccia:** **RoadToUnina** *(Sez. 4 di [REQUIREMENTS.md](../REQUIREMENTS.md))*

---

## 🐳 1. Avvio Rapido con Docker Compose (Raccomandato)

La modalità di esecuzione tramite **Docker Compose** è la procedura consigliata e più rapida:

```bash
# Dalla radice del progetto:
docker compose up --build
```

- **Backend REST API:** `http://localhost:3001`
- **Database PostgreSQL 18:** `localhost:5432`
- **Frontend SPA (Nginx):** `http://localhost:80` (o `http://localhost:5173`)

Per arrestare i container:
```bash
docker compose down -v
```

---

## 💻 2. Esecuzione Locale (Development)

Per eseguire il solo server backend in locale:

### Prerequisiti
- **Node.js** v20.x o superiore
- **npm** v10.x o superiore
- Container PostgreSQL 18 attivo (`docker compose up db -d` dalla radice) oppure istanza PostgreSQL 18 locale.

### Passaggi:
```bash
# 1. Posizionati nella directory backend
cd backend

# 2. Installa le dipendenze
npm install

# 3. Sincronizza lo schema Prisma con PostgreSQL 18
npx prisma generate
npx prisma db push

# 4. Avvia il server in modalità sviluppo con hot-reloading
npm run dev
```

Il server sarà attivo e in ascolto su: **`http://localhost:3001`**.

---

## 🧪 Esecuzione dei Test Automatizzati

Il backend include **50 test automatizzati** (unitari, di integrazione, concorrenza e sicurezza):

```bash
# Esecuzione della suite completa
npm test

# Esecuzione interattiva in watch mode
npx vitest

# Esecuzione con report di copertura
npx vitest run --coverage
```

---

## ⚙️ Variabili d'Ambiente (`.env`)

Crea un file `.env` all'interno della cartella `backend/` con i seguenti parametri:

```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/roadtounina?schema=public"
JWT_SECRET="roadtounina_super_secret_jwt_key_2026"
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000,http://localhost:80"
```

| Variabile | Default | Descrizione |
| :--- | :--- | :--- |
| `PORT` | `3001` | Porta TCP di ascolto del server Express. |
| `DATABASE_URL` | `postgresql://...` | Stringa di connessione PostgreSQL 18. |
| `JWT_SECRET` | `...` | Chiave crittografica per la firma dei token JWT. |
| `NODE_ENV` | `development` | Ambiente di runtime (`development`, `production`, `test`). |
| `ALLOWED_ORIGINS`| `...` | Whitelist domini autorizzati CORS. |

---

## 📡 Riepilogo Endpoint REST API

| Metodo | Endpoint | Accesso | Descrizione |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Pubblico | Registrazione nuovo utente con password cifrata in bcrypt. |
| `POST` | `/api/auth/login` | Pubblico | Autenticazione utente ed emissione token JWT. |
| `GET` | `/api/auth/me` | Protetto | Profilo utente autenticato. |
| `POST` | `/api/games/start` | Protetto | Avvio nuova partita da voce casuale Wikipedia. |
| `GET` | `/api/games/active` | Protetto | Recupero stato partita attiva e contenuto HTML pagina corrente. |
| `POST` | `/api/games/:id/step` | Protetto | Navigazione a un link target con verifica anti-cheat. |
| `POST` | `/api/games/:id/abandon` | Protetto | Forfeit / abbandono manuale della partita attiva. |
| `GET` | `/api/public/completed-games` | Pubblico | Storico partite concluse con percorso e tempi. |
| `GET` | `/api/public/leaderboard` | Pubblico | Classifica globale dei migliori giocatori. |

---

## 📜 Script Disponibili (`package.json`)

- `npm run dev`: Avvia il server in modalità watch con `tsx`.
- `npm run build`: Compila il codice TypeScript nella cartella `dist/`.
- `npm run start`: Esegue il server compilato in produzione (`node dist/server.js`).
- `npm test`: Esegue la suite di test Vitest (50 test).
