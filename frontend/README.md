# 🖥️ RoadToUnina — Front-end Single Page Application (SPA)

[![Live App](https://img.shields.io/badge/Live_App-road--to--unina.vercel.app-FF007A?style=for-the-badge&logo=vercel&logoColor=white)](https://road-to-unina.vercel.app)
[![React](https://img.shields.io/badge/React-v19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Neo--Brutalist-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Playwright Tests](https://img.shields.io/badge/Playwright_E2E-7%2F7%20Passing%20(100%25)-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](#-test-end-to-end-playwright)

Single Page Application (SPA) reattiva per il gioco di speedrunning enciclopedico **RoadToUnina**, realizzata con **React 19**, **TypeScript**, **Vite**, **Tailwind CSS** con design system **Neo-Brutalism** personalizzato.

---

## 🎨 Design System: Neo-Brutalism Personalizzato

L'interfaccia utente adotta uno stile grafico Neo-Brutalist moderno, accessibile e distintivo:
- **Palette Colori HSL**: Giallo Unina (`#FFE600`), Ciano Elettrico (`#00F0FF`), Rosa Fluo (`#FF2E93`), Nero Puro (`#000000`) e Bianco Superficie (`#FFFFFF`).
- **Ombre Hard Shadow**: `shadow-neo` (`4px 4px 0px #000000`) e `shadow-neo-lg` (`8px 8px 0px #000000`).
- **Bordi Decisi**: Bordi spessi da 3px (`border-3 border-neo-black`).
- **Tipografia**: Font Google *Space Grotesk* per titoli e accenti, *Inter* per testi enciclopedici, *JetBrains Mono* per timer, click e rank.

---

## 🚀 Avvio Locale

```bash
# 1. Accedi alla cartella frontend
cd frontend

# 2. Installa le dipendenze
npm install

# 3. Avvia il server di sviluppo Vite
npm run dev
```

L'applicazione sarà accessibile su: **`http://localhost:5173`**.

---

## 🧪 Test End-to-End (Playwright)

Il frontend include **7 test E2E automatizzati** che simulano le azioni reali del browser:

```bash
# Esegui tutti i test E2E
npx playwright test

# Esegui con interfaccia grafica interattiva
npx playwright test --ui

# Esegui specificamente lo speedrun playtest Moon Knight -> Unina
npx playwright test e2e/speedrun-moonknight.spec.ts
```

---

## 📁 Struttura della Directory

```
frontend/
├── e2e/                     # Suite di test Playwright E2E
│   ├── gameplay.spec.ts     # 6 test E2E completi
│   └── speedrun-moonknight.spec.ts # Test playtest Moon Knight -> Unina
├── public/                  # Asset statici e favicon
├── src/
│   ├── api/                 # Client Axios centralizzato (auth, game, public)
│   ├── components/
│   │   ├── game/            # Componenti di gioco (HUDBar, WikiRenderer)
│   │   └── ui/              # Componenti Neo-Brutalist (Button, Card, Navbar, Toast)
│   ├── hooks/               # Custom Hooks (useAuth, useGameEngine, useLeaderboard)
│   ├── pages/               # Viste SPA (HomePage, GamePage, LeaderboardPage, LoginPage, RegisterPage)
│   ├── styles/              # Token e classi CSS Neo-Brutalism
│   └── types/               # Definizioni TypeScript per API, entità e stato
├── vercel.json              # Configurazione rewrite SPA per Vercel
└── vite.config.ts           # Configurazione bundler Vite
```
