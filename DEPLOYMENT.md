# 🚀 Guida al Deployment & CI/CD — RoadToUnina

Questa guida descrive l'architettura di deployment in produzione, la pipeline di **Continuous Integration / Continuous Deployment (CI/CD)** e come avvengono gli aggiornamenti automatici a ogni `git push`.

---

## 🌐 Link Ufficiali di Produzione

| Servizio | Piattaforma Cloud | URL Live |
| :--- | :--- | :--- |
| **🖥️ Frontend SPA** | **Vercel** | **[`https://road-to-unina.vercel.app`](https://road-to-unina.vercel.app)** |
| **⚙️ Backend REST API** | **Render.com** | **[`https://roadtounina-backend.onrender.com/api`](https://roadtounina-backend.onrender.com/api)** |
| **🗄️ Cloud Database** | **Supabase** | `aws-0-eu-north-1.pooler.supabase.com` (PostgreSQL 16) |

---

## 🔄 Come Avvengono gli Aggiornamenti Automatici (Git Push)

Quando effettui modifiche al codice e le invii su GitHub:

```bash
git add .
git commit -m "feat: aggiornamento applicazione"
git push origin main
```

Si attivano automaticamente **3 processi in parallelo**:

```mermaid
graph TD
    Push([🐙 Git Push su main]) --> GHA[⚙️ GitHub Actions CI]
    Push --> Vercel[⚡ Vercel Auto-Deploy]
    Push --> Render[🛠️ Render.com Auto-Deploy]

    GHA -->|1. Test Backend| Vitest[🧪 53 Test Vitest]
    GHA -->|2. Build Frontend| ViteBuild[🔨 tsc + vite build]
    GHA -->|3. Test E2E| Playwright[🎭 18 Test Playwright]

    Vercel -->|Build Vite| CDN[🌍 Aggiornamento CDN Globale]
    Render -->|npm ci + build| App[🚀 Zero-Downtime Container Restart]
    App --> Supabase[(🐘 Supabase PostgreSQL)]
```

1. **Vercel (Frontend)**: Rileva il push, compila il bundle di produzione (`vite build`) e aggiorna la CDN globale in ~30 secondi.
2. **Render.com (Backend)**: Rileva il push, esegue `npm ci --include=dev && npx prisma generate && npm run build` e avvia la nuova versione del server con routing zero-downtime.
3. **GitHub Actions (CI)**: Esegue in ambiente pulito l'intera suite di 53 test backend e 18 test E2E Playwright per validare che nessuna regressione sia stata introdotta.

---

## 🛠️ Configurazione dei Servizi Cloud

### 1. Backend Web Service (Render.com)
- **Service Name**: `roadtounina-backend`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm ci --include=dev && npx prisma generate && npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/api/public/leaderboard`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `DATABASE_URL`: `postgresql://postgres.rocipfcbkqpkplbpnjkr:[PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
  - `DIRECT_URL`: `postgresql://postgres.rocipfcbkqpkplbpnjkr:[PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:5432/postgres`
  - `JWT_SECRET`: `roadtounina_super_secret_jwt_key_2026`
  - `ALLOWED_ORIGINS`: `https://road-to-unina.vercel.app,http://localhost:5173`

### 2. Frontend SPA (Vercel)
- **Project Name**: `road-to-unina`
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Build Command**: `vite build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://roadtounina-backend.onrender.com/api`
- **SPA Rewrites**: Configurate in [`frontend/vercel.json`](file:///Users/lucabarrella/Documents/RoadToUnina/frontend/vercel.json) (`/* -> /index.html`).

---

## 🌱 Sincronizzazione Database & Seeding sul Cloud

Per applicare modifiche allo schema del database o rigenerare i dati simulati:

```bash
cd backend

# Applica modifiche allo schema su Supabase
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config ./node_modules/prisma/build/index.js db push

# Popola il database con 10 utenti e 20 partite di test
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config ./node_modules/prisma/build/index.js db seed
```

---

## 🐳 Esecuzione Locale Alternativa con Docker Compose

Se durante la discussione d'esame si desidera mostrare l'applicazione containerizzata in locale:

```bash
# Avvia Frontend + Backend + PostgreSQL locale
docker compose up --build

# In un secondo terminale, esegui il seed iniziale nel container
docker compose exec backend npx prisma db seed
```

- **Frontend**: `http://localhost:5173` (o `http://localhost:80`)
- **Backend API**: `http://localhost:3001`
- **PostgreSQL**: `localhost:5432`
