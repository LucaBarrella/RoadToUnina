import os
import re

DOCS_DIR = "docs"
OUTPUT_FILE = os.path.join(DOCS_DIR, "RoadToUnina-Manuale-Completo.md")

chapters = [
    ("Capitolo 1: Architettura Monorepo, Toolchain e Fondamenti TypeScript", "Capitolo-01-Architettura-Monorepo-e-Toolchain.md"),
    ("Capitolo 2: Il Server HTTP, Express 5 e la Pipeline dei Middleware", "Capitolo-02-Il-Server-HTTP-e-la-Pipeline-Middleware.md"),
    ("Capitolo 3: Persistenza Dati, Prisma ORM e PostgreSQL", "Capitolo-03-Persistenza-Dati-Prisma-ORM-e-PostgreSQL.md"),
    ("Capitolo 4: Autenticazione, Sicurezza e Validazione Runtime", "Capitolo-04-Autenticazione-Sicurezza-e-Validazione-Runtime.md"),
    ("Capitolo 5: Business Logic del Gioco, Algoritmi e Caching", "Capitolo-05-Business-Logic-del-Gioco-Algoritmi-e-Caching.md"),
    ("Capitolo 6: Frontend React 18 Architecture e State Management", "Capitolo-06-Frontend-React-18-Architecture-e-State-Management.md"),
    ("Capitolo 7: Custom Hooks, Game Engine e Sicurezza del DOM", "Capitolo-07-Custom-Hooks-Game-Engine-e-Sicurezza-del-DOM.md"),
    ("Capitolo 8: Testing, Deploy e Strategie di Robustezza del Software", "Capitolo-08-Testing-Deploy-e-Strategie-di-Robustezza-del-Software.md"),
]

frontespizio = """# UNIVERSITÀ DEGLI STUDI DI NAPOLI FEDERICO II
### Dipartimento di Ingegneria Elettrica e delle Tecnologie dell'Informazione
### Corso di Laurea in Informatica — Corso di Tecnologie Web (A.A. 2025/2026)

---

# RoadToUnina: Architettura, Ingegnerizzazione e Guida all'Esame
## Manuale Didattico Ufficiale ed Analisi della Codebase Full-Stack (React 18 + Node.js Express 5 + PostgreSQL)

**Candidato:** Luca Barrella (Matricola N86004677)  
**Docente Titolare:** Prof. Luigi Libero Lucio Starace, Ph.D.  
**Data di Pubblicazione:** Settembre 2026  
**Repository e Traccia:** Traccia 4.C — *WebTech's RoadToUnina Speedrun Game*  
**Web Demo Ufficiale:** [https://road-to-unina.vercel.app](https://road-to-unina.vercel.app)  
**Backend API Live:** [https://roadtounina-backend.onrender.com/api](https://roadtounina-backend.onrender.com/api)  

---

<div style="page-break-after: always;"></div>

# Sommario e Indice Generale dell'Opera

1. [Capitolo 1: Architettura Monorepo, Toolchain e Fondamenti TypeScript](#capitolo-1-architettura-monorepo-toolchain-e-fondamenti-typescript)
   - 1.1 L'Architettura Software a Livelli e il Disaccoppiamento Monorepo
   - 1.2 TypeScript: Type System Strutturale, Compilazione ed Erasure
   - 1.3 Il Modello di Esecuzione e la Toolchain: Transpiler vs Bundler vs JIT
   - 2. Il Codice nel Nostro Progetto (package.json, tsconfig.json, vite.config.ts)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
2. [Capitolo 2: Il Server HTTP, Express 5 e la Pipeline dei Middleware](#capitolo-2-il-server-http-express-5-e-la-pipeline-dei-middleware)
   - 1.1 L'Architettura a Singolo Thread e l'Event Loop di Node.js
   - 1.2 Il Modello Client-Server HTTP Stateless e il Protocollo REST
   - 1.3 Il Pattern Middleware ad Architettura a Cipolla (Onion Model)
   - 1.4 La Rivoluzione di Express 5: Gestione Automatica delle Promise Rifiutate
   - 2. Il Codice nel Nostro Progetto (server.ts, env.ts, errorMiddleware.ts)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
3. [Capitolo 3: Persistenza Dati, Prisma ORM e PostgreSQL](#capitolo-3-persistenza-dati-prisma-orm-e-postgresql)
   - 1.1 Il Livello di Persistenza e il Modello Relazionale (RDBMS)
   - 1.2 ORM (Object-Relational Mapping) vs Query SQL Native
   - 1.3 Migrazioni Declarative (prisma migrate) vs Introspezione (prisma db pull)
   - 1.4 Connection Pooling e Gestione delle Connessioni Concorrenti
   - 2. Il Codice nel Nostro Progetto (schema.prisma, db.ts, seed.ts)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
4. [Capitolo 4: Autenticazione, Sicurezza e Validazione Runtime](#capitolo-4-autenticazione-sicurezza-e-validazione-runtime)
   - 1.1 Crittografia Applicata: Hashing Unidirezionale vs Cifratura
   - 1.2 Lo Standard JWT (JSON Web Token - RFC 7519)
   - 1.3 Static Typing (TypeScript) vs Runtime Validation (Zod)
   - 2. Il Codice nel Nostro Progetto (authService.ts, authMiddleware.ts, validateMiddleware.ts)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
5. [Capitolo 5: Business Logic del Gioco, Algoritmi e Caching](#capitolo-5-business-logic-del-gioco-algoritmi-e-caching)
   - 1.1 Il Pattern Architetturale Service Layer e la Separazione delle Responsabilità
   - 1.2 Algoritmi di Caching in Memoria: La Politica LRU (Least Recently Used)
   - 1.3 Resilient Integration Design con API Esterne (Wikipedia API)
   - 1.4 Sanificazione del Markup HTML, Prevenzione XSS e Mitigazione SSRF
   - 2. Il Codice nel Nostro Progetto (wikiService.ts, gameService.ts, gameRoutes.ts)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
6. [Capitolo 6: Frontend React 18 Architecture e State Management](#capitolo-6-frontend-react-18-architecture-e-state-management)
   - 1.1 Il Modello di React: Virtual DOM, Reconciliation e React Fiber
   - 1.2 Il Rendering Cycle in React 18 e l'Automatic Batching
   - 1.3 SPA Routing con React Router v7
   - 1.4 State Management: Local State, Lifting State Up e Context API
   - 2. Il Codice nel Nostro Progetto (main.tsx, App.tsx, useAuth.tsx, GamePage.tsx)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
7. [Capitolo 7: Custom Hooks, Game Engine e Sicurezza del DOM](#capitolo-7-custom-hooks-game-engine-e-sicurezza-del-dom)
   - 1.1 Le Regole degli Hook e l'Architettura Interna di React Fiber
   - 1.2 Il Pattern Custom Hook: Separazione tra Presentazione e Logica di Dominio
   - 1.3 Ottimizzazione e Memoization: useCallback, useMemo e React.memo
   - 1.4 Gestione della Mutabilità con useRef
   - 1.5 Sicurezza Client-Side del DOM, Attacchi XSS e Sanitization con DOMPurify
   - 1.6 Event Delegation su Contenuti HTML Dinamici
   - 2. Il Codice nel Nostro Progetto (useGameEngine.ts, WikiRenderer.tsx, HUDBar.tsx, client.ts)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)
8. [Capitolo 8: Testing, Deploy e Strategie di Robustezza del Software](#capitolo-8-testing-deploy-e-strategie-di-robustezza-del-software)
   - 1.1 La Piramide dei Test e il Modello di Qualità del Software (ISO/IEC 25010)
   - 1.2 Toolchain di Testing: Vitest vs Jest, Supertest e Playwright
   - 1.3 Strategie di Mocking: Mock, Stub e Spy
   - 1.4 Containerizzazione e Architettura di Deployment (Docker vs VM)
   - 1.5 Disaster Recovery, Resilienza Operativa e Graceful Shutdown
   - 2. Il Codice nel Nostro Progetto (robustnessQA.test.ts, vitest.config.mts, docker-compose.yml)
   - 3. Disamina Riga per Riga
   - 4. Scenari d'Esame "What-If" (Simulazione Orale)

---

<div style="page-break-after: always;"></div>
"""

full_content = [frontespizio]

for title, filename in chapters:
    filepath = os.path.join(DOCS_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            chapter_text = f.read()
            full_content.append(f"\n<div style=\"page-break-after: always;\"></div>\n\n{chapter_text}\n")
    else:
        print(f"Warning: {filepath} not found!")

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(full_content))

print(f"✅ File Markdown unificato generato con successo in: {OUTPUT_FILE}")
