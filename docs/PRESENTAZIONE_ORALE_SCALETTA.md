# 🎤 Scaletta & Slide-by-Slide: Presentazione Orale RoadToUnina
**Candidato:** Luca Barrella (Matricola `N86004677`)  
**Corso:** Tecnologie Web — Prof. Luigi Libero Lucio Starace, Ph.D.  
**Traccia:** 4.C — WEBTECH'S ROADTOUNINA (Wikipedia Speedrun)

---

## ⏱️ Regola dei 5-7 Minuti (Come gestire il tempo)
All'orale il professore non vuole un monologo di 40 minuti. Vuole vedere:
1. **Chiarezza e sintesi** (2-3 minuti di presentazione ad alto livello).
2. **Demo pratica dal vivo** (2 minuti di gioco/navigazione).
3. **Controllo del codice sorgente** (domande tecniche mirate sulle scelte architetturali).

Puoi usare questa scaletta sia per preparare **7-8 slide in PowerPoint/Canva/Keynote**, sia come **guida mentale** per sapere esattamente cosa dire parola per parola.

---

## 📑 Slide 1: Titolo & Presentazione Accademica
- **Titolo Slide:** RoadToUnina — Piattaforma Web & Speedrun Enciclopedico
- **Sottotitolo:** Progetto Full-Stack per il corso di Tecnologie Web (A.A. 2025/2026)
- **Dati:** Candidato: Luca Barrella (`N86004677`) — Docente: Prof. Luigi Libero Lucio Starace
- **Cosa dire a voce (30 secondi):**
  > *"Buongiorno Professore. Con questo elaborato ho progettato e implementato RoadToUnina, una Single Page Application full-stack in cui gli utenti registrati sfidano la community partendo da un articolo casuale estratto in tempo reale da Wikipedia per raggiungere la voce cardine 'Università degli Studi di Napoli Federico II' nel minor tempo e con il minor numero di click possibile, navigando esclusivamente tramite collegamenti interni verificati dal server."*

---

## 📑 Slide 2: Architettura a 3 Livelli & Monorepo
- **Titolo Slide:** Architettura di Sistema (3-Tier & Monorepo)
- **Elementi Grafici:**
  - **Client Tier:** React 18 SPA (Vite + TypeScript + Tailwind CSS Neo-Brutalist).
  - **Application Tier:** Node.js 24 + Express 5 REST API (Clean Layered Architecture: Routes ➔ Middlewares ➔ Services).
  - **Data Tier:** PostgreSQL 16 su Supabase + Prisma ORM v7 (`@prisma/adapter-pg` con Connection Pooling).
- **Cosa dire a voce (45 secondi):**
  > *"Il sistema adotta un'architettura rigorosamente disaccoppiata a 3 livelli, organizzata come monorepo con npm workspaces. La Presentation Tier è una Single Page Application reattiva deployata su Vercel. L'Application Tier è un'API RESTful containerizzata con Docker e deployata su Render. La Data Tier è affidata a PostgreSQL con Prisma ORM. Frontend e Backend non condividono stato a runtime, ma dialogano esclusivamente via HTTP/JSON attraverso un contratto formale OpenAPI 3.0 con generazione automatica dei tipi TypeScript via openapi-typescript."*

---

## 📑 Slide 3: Il Flusso di Gioco & Regole della Sfida
- **Titolo Slide:** Game Engine & State Machine
- **Elementi Grafici:** Diagramma a stati della partita:
  - `START` ➔ Estrazione casuale voce Wikipedia (Namespace 0).
  - `IN_PROGRESS` ➔ Navigazione a click tramite chip interattivi (`.wiki-chip`).
  - Transizione a `COMPLETED` se `targetTitle === targetPageTitle` (Vittoria con registrazione tempo e click).
  - Transizione a `ABANDONED` per resa volontaria o timeout automatico dopo 24 ore.
- **Cosa dire a voce (45 secondi):**
  > *"La macchina a stati della partita è interamente governata dal backend. All'avvio, il server interroga la MediaWiki API ed estrae una voce casuale priva di redirect e appartenente esclusivamente al namespace enciclopedico principale. Lo stato del gioco è salvato in modo persistente su PostgreSQL a ogni singolo step: questo soddisfa il requisito di portabilità e consente all'utente di riprendere la partita da un qualunque altro dispositivo o browser."*

---

## 📑 Slide 4: Sicurezza & Anti-Cheat "Zero-Trust"
- **Titolo Slide:** Sicurezza Applicata: Anti-Cheat & Defense-in-Depth
- **Punti Chiave:**
  1. **Zero-Trust Server Validation:** Il client invia solo l'intenzione di click (`POST /api/games/:id/step`). Il backend verifica che la pagina target sia realmente linkata nel testo della voce corrente (`validLinks.includes(targetTitle)`). Rifiuto con HTTP 400 se l'utente tenta salti arbitrari.
  2. **Doppia Sanitizzazione Anti-XSS:** `sanitize-html` sul server prima del salvataggio/inoltro + `DOMPurify` nel frontend prima del render React.
  3. **Autenticazione Stateless JWT (RFC 7519):** Token firmato con HMAC-SHA256 e chiave minima a 32 caratteri; password cifrate con Bcrypt (cost factor $2^{10}$ e salt crittografico casuale a 128 bit).
  4. **Protezione IDOR:** Un utente non può interagire con partite attive appartenenti ad altri account.
- **Cosa dire a voce (60 secondi):**
  > *"Sul fronte sicurezza abbiamo applicato il principio di Defense-in-Depth. Poiché il contenuto proviene da Wikipedia, abbiamo neutralizzato il rischio XSS a due livelli: sanitizzazione lato server e lato client con DOMPurify. L'Anti-Cheat è totalmente Zero-Trust: il server non si fida del frontend; estrae i link della pagina corrente e convalida ogni passo. Le password sono protette con Bcrypt e salt crittografico, e le API sono protette da middleware JWT e rate limiter differenziati per mitigare tentativi di brute-force e macro di click spamming."*

---

## 📑 Slide 5: Frontend React 18 & Pattern Event Delegation
- **Titolo Slide:** Frontend Architecture & Performance
- **Punti Chiave:**
  - **Design System Neo-Brutalism:** Bordi netti da 3px, ombre rigide `4px 4px 0px`, palette ad alto contrasto (Giallo Unina, Ciano, Rosa Fluo).
  - **Pattern Event Delegation in `WikiRenderer.tsx`:** Un solo event listener sul contenitore genitore intercetta i click con `e.target.closest('a')` e sopprime la navigazione del browser con `e.preventDefault()`.
  - **Custom Hooks Disaccoppiati:** `useGameEngine` per cronometro differenziale e ciclo di vita partita, `useAuth` per sessione e token, `useLeaderboard` per classifica pubblica.
- **Cosa dire a voce (45 secondi):**
  > *"Per l'interfaccia ho sviluppato un design system Neo-Brutalism personalizzato con Tailwind CSS. Una delle sfide tecniche più rilevanti sul frontend è stata la gestione dei link di Wikipedia: inserire centinaia di handler onClick per ogni link avrebbe saturato la memoria del Virtual DOM. Ho quindi implementato il pattern Event Delegation in WikiRenderer: un unico listener sul container cattura l'evento, esegue e.preventDefault() per bloccare la navigazione nativa del browser e invoca il custom hook useGameEngine per avanzare la partita."*

---

## 📑 Slide 6: Qualità del Software & Piramide dei Test
- **Titolo Slide:** Qualità del Software & Testing Automatizzato
- **Punti Chiave:**
  - **Vitest Suite (58 Test - 100% Passati):**
    - Unitari & integrazione: mock MediaWiki, parsing Namespace 0, caching LRU.
    - Concorrenza & Robustezza QA: race condition atomiche con 20 click simultanei, isolamento IDOR, attacchi SQL Injection e timeout.
  - **Playwright Suite (20 Test E2E - 100% Passati):**
    - Simulazione browser reale: registrazione, login, bot speedrunner completo fino a vittoria.
    - Speedrun tematiche (Boris, antirez/Redis, Local LLM, Totò in 1 click).
    - Session persistence al reload di pagina e modalità ospite.
- **Cosa dire a voce (45 secondi):**
  > *"Per garantire la robustezza richiesta dallo standard ISO 25010, abbiamo coperto l'intera piramide dei test. Abbiamo 58 test automatizzati su backend con Vitest, comprensivi di stress test con 20 richieste parallele per testare la concorrenza atomica sul database. Sul frontend abbiamo ben 20 test End-to-End con Playwright (a fronte dei 10 minimi richiesti dal bando), che automatizzano sia speedrun reali tematiche sia la verifica della persistenza della sessione al ricaricamento del browser."*

---

## 📑 Slide 7: Containerizzazione Docker & Avvio Locale
- **Titolo Slide:** Containerizzazione & Multi-Stage Build
- **Punti Chiave:**
  - Multi-stage build sia per frontend che per backend (immagini leggere Alpine, isolamento dipendenze dev/prod).
  - Nginx come Web Server e Reverse Proxy API (`proxy_pass http://backend:3001;`).
  - Orchestrazione unificata tramite `docker-compose.yml`:
    ```bash
    docker compose up --build
    ```
- **Cosa dire a voce (30 secondi):**
  > *"Come consigliato per la prova d'esame nella Sezione 7, l'intero stack è containerizzato con Docker multi-stage. Un solo comando docker compose up --build avvia il database PostgreSQL, il backend Express compilato e il frontend servito da Nginx con reverse proxy integrato per le chiamate /api, rendendo il progetto portabile e collaudabile all'istante su qualsiasi macchina."*

---

## 🎬 Come fare la Demo Pratica (I 2 Minuti di Show)

Se il docente ti dice: *"Fammi vedere l'applicazione funzionante"*, procedi in questo ordine esatto:

1. **Mostra la Home da Ospite:**  
   Mostra che senza login puoi già vedere la **Leaderboard globale** con il podio e lo storico delle partite concluse.
2. **Effettua il Login / Registrazione:**  
   Accedi con il tuo account di test (oppure registra un utente nuovo in 5 secondi).
3. **Avvia la Partita ("Inizia Sfida"):**  
   Fai notare che l'HUD in alto mostra:
   - Pagina di partenza estratta a caso da Wikipedia.
   - Obiettivo: *Università degli Studi di Napoli Federico II*.
   - Timer che avanza in secondi reali.
   - Click count a 0.
4. **Fai 2 o 3 click sui chip:**  
   Mostra che cliccando un link enciclopedico (`.wiki-chip`), il contenuto della voce si aggiorna istantaneamente e il contatore dei click incrementa.
5. **Simula un cheat o un errore:**  
   Fai vedere che cliccando fuori o tentando un link non valido compare il Toast di sicurezza e il server non fa avanzare la mossa.
6. **Mostra il reload della pagina (F5):**  
   Ricarica la pagina e dimostra che la partita **non si perde e il timer riprende dal secondo esatto**, perché lo stato è salvato sul database PostgreSQL.

---

## 🚨 Checklist dei File da Avere Aperti sul Portatile il Giorno 29:
Prima di entrare in aula, tieni pronto il tuo editor (VS Code / Cursor) con questi 4 tab aperti:
1. `backend/src/services/gameService.ts` (pronto per mostrare l'anti-cheat).
2. `frontend/src/components/game/WikiRenderer.tsx` (pronto per mostrare l'event delegation dei click).
3. `backend/prisma/schema.prisma` (pronto per mostrare i modelli dati relazionali).
4. `MAPPA_ESAME_ORALE.md` (da tenere a portata di mano per qualsiasi evenienza).

Se segui questa scaletta, l'esame sarà una formalità e dimostrerai una padronanza da 30 e lode! 🎓🔥
