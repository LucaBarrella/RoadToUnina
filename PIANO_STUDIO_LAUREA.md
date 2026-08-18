# 🎯 Roadmap Strategica: Da Tecnologie Web alla Laurea (Febbraio 2027)
**Candidato:** Luca Barrella (Matricola `N86004677`)  
**Corso di Laurea:** Informatica (L-31), Università degli Studi di Napoli Federico II  
**Obiettivo:** Consegna documenti entro la prima settimana di Gennaio ➔ Prova Finale / Laurea a Febbraio.

---

## 🗺️ 1. Cronoprogramma Generale (Macro Fasi)

```
[ FASE 1: 19 AGOSTO ➔ 10 SETTEMBRE ]
  └── Focus 100%: Scritto Tecnologie Web + Presentazione Progetto RoadToUnina (Già completo al 100%)
  └── Risultato: Ultimo esame della triennale archiviato con 30L potenziale.

[ FASE 2: METÀ SETTEMBRE ➔ METÀ DICEMBRE ]
  └── Tirocinio curriculare in azienda/laboratorio
  └── Frequenza corsi della Magistrale
  └── Esame di idoneità di Inglese (Appelli: Settembre / Ottobre / Novembre / Dicembre)

[ FASE 3: 15 DICEMBRE ➔ 5 GENNAIO (Pausa Natalizia) ]
  └── Scrittura & compilazione Tesi Applicativa di Tirocinio (in Markdown + LLM)
  └── Revisione tecnica & impaginazione PDF/A finale

[ FASE 4: GENNAIO ➔ FEBBRAIO ]
  └── Prima settimana di Gennaio: Consegna finale documentazione e tesi in segreteria
  └── Febbraio: Discussione di Laurea e Proclamazione 🎓
```

---

## 📚 2. Fase 1: Piano Giornaliero per Tecnologie Web (19 Ago – 10 Set)

* **Totale Lezioni:** 23
* **Struttura Scritto:** 20 domande a risposta multipla + 6 domande aperte (Durata: 1h 30m).
* **Progetto RoadToUnina:** Già completo al 100%, 53 test Vitest passanti, deployato online su Vercel e Render.

### 📅 Tabella di Marcia Quotidiana

| Data | Studio Teorico | Studio Codice / Progetto (Sera - 1h 30m) | Inglese (Sera - 1h) |
| :--- | :--- | :--- | :--- |
| **19 Ago** | Lezione 1 & 2 (Architetture Web, Modello Client-Server) | Panoramica generale: `backend/ARCHITECTURE.md` | Esercizi grammatica / Listening |
| **20 Ago** | Lezione 3 & 4 (HTML5 Semantico, Accessibilità ARIA) | `frontend/src/components/game/WikiRenderer.tsx` | Lettura testi tecnici / Vocabolario |
| **21 Ago** | Lezione 5 & 6 (CSS3, Box Model, Flexbox/Grid) | `frontend/src/components/ui/` (Button, Card, HUDBar) | Esercizi comprensione |
| **22 Ago** | Lezione 7 & 8 (Protocollo HTTP, Metodi, Status Code) | `backend/src/server.ts` e `backend/src/routes/` | Esercizi grammatica / Cloze test |
| **23 Ago** | Lezione 9 & 10 (CORS, Same-Origin Policy, Headers) | `corsOptions` in `server.ts` | Esercizi listening |
| **24 Ago** | Lezione 11 & 12 (JavaScript Moderno ES6+, Event Loop) | Event Delegation in `WikiRenderer.tsx` (`handleClick`) | Lettura articoli B2 |
| **25 Ago** | Lezione 13 & 14 (Node.js, Express, Middleware Chain) | `authMiddleware.ts`, `errorMiddleware.ts`, `validateMiddleware.ts` | Test di simulazione |
| **26 Ago** | Lezione 15 & 16 (Basi di Dati, SQL vs NoSQL, Transazioni) | `backend/prisma/schema.prisma` e `db.ts` (Connection Pool) | Esercizi vocabolario |
| **27 Ago** | Lezione 17 & 18 (React Basi, JSX, Virtual DOM, Props) | `frontend/src/App.tsx` e `pages/GamePage.tsx` | Esercizi grammatica |
| **28 Ago** | Lezione 19 & 20 (React Hooks: useState, useEffect, useMemo) | `frontend/src/hooks/useGameEngine.ts` e `useAuth.tsx` | Esercizi listening |
| **29 Ago** | Lezione 21 & 22 (Sicurezza Web: XSS, CSRF, IDOR, SQLi) | `wikiService.ts` (sanitize-html/DOMPurify) e `authService.ts` | Esercizi lettura |
| **30 Ago** | Lezione 23 (Autenticazione: JWT, Bcrypt, Rate Limiting) | `authService.ts` e `authLimiter` in `server.ts` | Test di riepilogo |
| **31 Ago – 5 Set** | **Simulazione Scritto:** Quiz a crocette e schemi per le 6 domande aperte | Verifica domande trabocchetto in `GUIDA_ESAME_ORALE.md` | Simulazione prova completa |
| **6 – 9 Set** | **Ripasso Finale:** Schemi e definizioni chiave | Rilettura integrale di `GUIDA_ESAME_ORALE.md` | Ripasso finale |
| **10 Settembre** | 🏆 **ESAME SCRITTO DI TECNOLOGIE WEB** | *(Pronto anche per l'orale/presentazione)* | Pronto per il test |

---

## 🎓 3. Fase 2: Gestione Tirocinio, Magistrale e Inglese (Ottobre – Dicembre)

### 1. Il Trucco della "Tesi di Tirocinio" (2 Piccioni con 1 Fava)
* **Strategia:** Concordare con il relatore e il tutor aziendale una **Tesi Applicativa basata direttamente sull'attività del tirocinio**.
* **Vantaggio:** Il software, la pipeline, l'architettura o l'analisi sviluppata durante le ore di tirocinio costituiscono direttamente il corpo dei capitoli 3 e 4 della tesi, azzerando il doppio lavoro.

### 2. Gestione Esame di Inglese
* Finestra principale: Appello di Settembre o Ottobre.
* Finestra di sicurezza: Appello di Novembre o Dicembre (ampio margine per la verbalizzazione entro inizio Gennaio).

---

## 📝 4. Fase 3: Flusso di Scrittura Tesi con LLM (Pausa Natalizia)

### Formato e Toolchain Consigliata
* **Formato:** Markdown (`.md`) o Typst (zero tempo perso sulla sintassi LaTeX).
* **Compilazione:** Pandoc con template accademico (es. *Eisvogel*) ➔ Generazione automatica di PDF/A standard.
* **Se il relatore richiede Overleaf:** Scrittura in Markdown ➔ conversione capitolo per capitolo in codice LaTeX con LLM.

### Workflow di Scrittura e Revisione in 4 Passi

```
[ STEP 1: TU ] ➔ Fornisci all'LLM i bullet point e i dettagli tecnici reali del tirocinio.
       │
[ STEP 2: LLM ] ➔ Genera la bozza estesa del capitolo in stile accademico formale.
       │
[ STEP 3: TU (Critico) ] ➔ Rileggi per verificare la veridicità tecnica ed eliminare allucinazioni.
       │
[ STEP 4: LLM ] ➔ Esegue la rifinitura stilistica finale, coerenza e fluidità del testo.
```

### Struttura Standard della Tesi di Tirocinio (5 Capitoli)
1. **Capitolo 1 — Introduzione:** Contesto aziendale, motivazioni e obiettivi del progetto.
2. **Capitolo 2 — Stato dell'Arte & Tecnologie:** Panoramica dei framework, protocolli e tool utilizzati.
3. **Capitolo 3 — Analisi dei Requisiti & Architettura:** Progettazione del sistema, casi d'uso e diagrammi.
4. **Capitolo 4 — Implementazione & Risultati:** Dettagli implementativi, test eseguiti e metriche ottenute.
5. **Capitolo 5 — Conclusioni & Sviluppi Futuri:** Considerazioni finali e possibili evoluzioni.

---

## 🏆 5. Checklist di Controllo per la Laurea

- [x] **Progetto Tecnologie Web:** Completato, testato (53 test Vitest) e deployato online.
- [ ] **Scritto Tecnologie Web:** Sostenere e superare il 10 Settembre.
- [ ] **Presentazione Orale Progetto:** Sostenere con il supporto di `GUIDA_ESAME_ORALE.md`.
- [ ] **Idoneità di Inglese:** Verbalizzare tra Settembre e Dicembre.
- [ ] **Completamento Ore Tirocinio:** Concludere entro metà Dicembre.
- [ ] **Stesura e Revisione Tesi:** Concludere nella pausa natalizia (entro il 3-5 Gennaio).
- [ ] **Consegna Documenti di Laurea:** Caricare domanda e tesi entro la prima settimana di Gennaio.
- [ ] **Discussione di Laurea:** Febbraio 2027 🎓.
