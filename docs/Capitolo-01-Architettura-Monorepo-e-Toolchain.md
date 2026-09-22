# Capitolo 1: Architettura Monorepo, Toolchain e Fondamenti TypeScript

---

## 1. Teoria Fondamentale

### 1.1 L'Architettura Software a Livelli e il Disaccoppiamento Monorepo
Nel paradigma dell'Ingegneria del Software moderno, un'applicazione web complessa non viene più concepita come un blocco monolitico indivisibile, bensì come un sistema distribuito su più livelli architetturali (*n-tier architecture*):
1. **Presentation Layer (Frontend / SPA)**: Eseguito all'interno della sandbox del browser utente (Client-side), responsabile dell'interfaccia utente (UI), della reattività dell'esperienza d'uso (UX), della gestione dello stato locale e dell'interazione con l'utente.
2. **Application / Business Logic Layer (Backend API)**: Eseguito in un ambiente di esecuzione controllato (Server-side, tipicamente Node.js), responsabile dell'elaborazione delle regole di business, dell'autenticazione, della validazione dei dati e dell'orchestrazione dei flussi.
3. **Data Persistence Layer (Database)**: Responsabile dello storage persistente, dell'integrità referenziale e delle transazioni ACID (es. PostgreSQL gestito tramite un ORM).

Per gestire questo disaccoppiamento mantenendo coerenza, atomicità delle modifiche e semplicità di versionamento, si adotta la strategia del **Monorepo** (*Monolithic Repository*). Un monorepo aggrega molteplici pacchetti logicamente distinti in un unico repository Git.

```
┌──────────────────────────────────────────────────────────┐
│                Root Monorepo (npm workspaces)            │
│  - Gestione unificata dipendenze                         │
│  - Orchestrazione script (build, dev, test)              │
├────────────────────────────┬─────────────────────────────┤
│   frontend/ (SPA React)    │     backend/ (Node.js API)  │
│  - Vite + React 18 + TS    │    - Express 5 + TS         │
│  - Bundler: esbuild/rollup │    - Compiler: tsc / tsx    │
│  - Target: Browser Sandbox │    - Target: Node.js V8     │
└────────────────────────────┴─────────────────────────────┘
```

#### npm Workspaces e Symlink Resolution
Nativamente, npm permette di gestire i monorepo tramite la direttiva `workspaces` nel `package.json` radice. Quando si esegue `npm install` alla radice:
- npm calcola il grafo combinato delle dipendenze di tutti i package child.
- Esegue l'**hoisting**: solleva le dipendenze condivise nella cartella `node_modules` root, evitando ridondanze su disco.
- Crea collegamenti simbolici (*symlink*) all'interno di `node_modules` che puntano direttamente alle directory dei sub-package (es. `node_modules/frontend` -> `../frontend`).

---

### 1.2 TypeScript: Type System Strutturale, Compilazione ed Erasure
JavaScript nasce come linguaggio a tipizzazione debole e dinamica: i tipi sono associati ai valori a runtime e non alle variabili a tempo di compilazione. Questo genera categorie critiche di bug a runtime (es. `TypeError: Cannot read properties of undefined`).

**TypeScript** estende JavaScript introducendo un sistema di tipi statico e formale con tre caratteristiche cardine:
1. **Type Inference**: Il compilatore è in grado di dedurre autonomamente il tipo di variabili ed espressioni senza bisogno di annotazioni esplicite.
2. **Structural Subtyping (Duck Typing)**: La compatibilità dei tipi non è basata sul nome della classe o dell'interfaccia (nominal typing, come in Java o C++), ma sulla conformità della forma e delle proprietà dell'oggetto. Se un tipo `A` possiede almeno tutti i membri richiesti dal tipo `B`, allora `A` è compatibile con `B`.
3. **Type Erasure**: Il type checker di TypeScript opera esclusivamente a tempo di compilazione (*compile-time*). Durante il processo di transpilation verso JavaScript, tutte le interfacce, i type alias, i generics e le annotazioni di tipo vengono completamente eliminati dal codice sorgente generato. A runtime esiste unicamente JavaScript puro.

#### TypeScript Project References (`tsconfig.json`)
Nei monorepo complessi, il flag `references` di `tsconfig.json` consente di strutturare la base di codice in progetti TypeScript indipendenti ma correlati. Permette al compilatore di:
- Verificare i confini architetturali tra frontend e backend (il frontend non può importare codice backend o viceversa, salvo pacchetti condivisi espliciti).
- Ottimizzare la compilazione incrementale (`tsc -b`).

---

### 1.3 Il Modello di Esecuzione e la Toolchain: Transpiler vs Bundler vs JIT

Un errore concettuale diffuso all'esame è confondere il ruolo del compilatore TypeScript (`tsc`), del bundler client-side (Vite) e del runtime/transpiler server-side (`tsx`).

#### Backend Pipeline: `tsc` vs `tsx`
- **In Produzione**: Node.js non comprende nativamente la sintassi TypeScript pura né le annotazioni di tipo. Si usa `tsc` (*TypeScript Compiler*) come transpiler puro: analizza i tipi, solleva errori di tipo e produce file JavaScript standard (`.js`) nella cartella `dist/`. Successivamente, il motore V8 di Node esegue direttamente `node dist/server.js`.
- **In Sviluppo**: Avviare la compilazione `tsc` continua e riavviare il server ad ogni modifica introduce un overhead di latenza notevole. Si usa perciò `tsx` (*TypeScript Execute*): uno strumento CLI basato su `esbuild` che esegue TypeScript on-the-fly tramite transpilation in-memory senza eseguire type-checking preventivo, abbinato a un file-watcher (`tsx watch`).

#### Frontend Pipeline: Perché Vite sostituisce Webpack
I browser moderni supportano nativamente lo standard ECMAScript Modules (ESM: `import` / `export`). Vite sfrutta questa capacità:
1. **In Dev Mode**: Non esegue il bundling preventivo dell'intera applicazione. Serve i moduli sorgente nativi al browser via HTTP/2, compilando i singoli file TypeScript e JSX istantaneamente tramite `esbuild` (scritto in Go, da 10 a 100 volte più veloce dei transpiler scritti in JS). Il browser richiede solo i file effettivamente necessari alla pagina corrente.
2. **HMR (Hot Module Replacement)**: Modificando un componente React, Vite aggiorna esclusivamente quel modulo nel browser senza ricaricare l'intera pagina né perdere lo stato dell'applicazione.
3. **In Production Build**: Esegue il type-checking preliminare (`tsc -b`), e delega a **Rollup** la creazione di bundle statici altamente ottimizzati (minificati, con tree-shaking aggressivo e code-splitting in chunk separati).

---

## 2. Il Codice nel Nostro Progetto

Esaminiamo i file di configurazione fondamentali alla base dell'intera infrastruttura del progetto.

### 2.1 File: `package.json` (Root)
```json
{
  "name": "roadtounina",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "build": "npm run build --prefix frontend",
    "dev": "npm run dev --prefix frontend",
    "start": "npm run start --prefix backend",
    "codegen": "npm run codegen --prefix backend"
  }
}
```

### 2.2 File: `tsconfig.json` (Root)
```json
{
  "files": [],
  "references": [
    { "path": "./backend" },
    { "path": "./frontend" }
  ]
}
```

### 2.3 File: `backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/__tests__/**/*", "**/*.test.ts"]
}
```

### 2.4 File: `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

### 2.5 File: `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
```

---

## 3. Disamina Riga per Riga

### 3.1 `package.json` (Root)
* **Riga 1: `{`**: Inizio dell'oggetto manifest JSON che definisce metadati e configurazione del progetto.
* **Riga 2: `"name": "roadtounina"`**: Identificativo testuale univoco del workspace monorepo nel registry npm locale.
* **Riga 3: `"private": true`**: Flag di sicurezza fondamentale. Impedisce la pubblicazione accidentale dell'intero repository root sul registro pubblico npm (`npm publish`), dichiarando che si tratta di un'applicazione privata e non di una libreria pubblica.
* **Riga 4-7: `"workspaces": [ "frontend", "backend" ]`**: Notifica al package manager (npm) che le directory `frontend/` e `backend/` contengono sub-progetti indipendenti dotati di propri `package.json`. npm risolve le dipendenze in modo centralizzato, solleva i moduli condivisi e crea link simbolici incrociati.
* **Riga 8: `"scripts": {`**: Dizionario degli alias di comando CLI richiamabili tramite `npm run <command>`.
* **Riga 9: `"build": "npm run build --prefix frontend"`**: Esegue il comando di compilazione e bundling entrando virtualmente nella sottocartella `frontend`. Il flag `--prefix` evita all'operatore di dover eseguire manualmente `cd frontend`.
* **Riga 10: `"dev": "npm run dev --prefix frontend"`**: Lancia il server di sviluppo locale del frontend richiamando lo script `dev` specificato in `frontend/package.json`.
* **Riga 11: `"start": "npm run start --prefix backend"`**: Avvia il server di produzione backend indirizzando il comando al package presente in `backend/`.
* **Riga 12: `"codegen": "npm run codegen --prefix backend"`**: Esegue la pipeline di generazione contrattuale automatica: esporta la specifica formale `openapi.json` dal backend e ricompila istantaneamente i tipi TypeScript per il frontend (`api.generated.ts`) tramite `openapi-typescript`.

---

### 3.2 `tsconfig.json` (Root)
* **Riga 2: `"files": []`**: Array vuoto che informa TypeScript che il file di configurazione radice non compila direttamente alcun file sorgente TypeScript. La root funge unicamente da aggregatore logico.
* **Riga 3-6: `"references": [ { "path": "./backend" }, { "path": "./frontend" } ]`**: Sfrutta la funzionalità **Project References** di TypeScript. Definisce un grafo di dipendenza tra progetti indipendenti: permette l'esecuzione della compilazione build globale tramite `tsc --build` (o `tsc -b`), garantendo che il backend e il frontend posseggano ciascuno il proprio ambiente di compilazione isolato (es. DOM nel browser vs Node APIs nel server).

---

### 3.3 `backend/tsconfig.json`
* **Riga 2: `"compilerOptions": {`**: Sezione contenente le direttive che guidano il compilatore TypeScript (`tsc`).
* **Riga 3: `"target": "ES2022"`**: Specifica la versione ECMAScript del codice JavaScript prodotto in emissione. `ES2022` supporta costrutti moderni quali top-level `await`, campi di classe privati (`#field`), e metodi nativi come `Object.hasOwn()`.
* **Riga 4: `"module": "Node16"`**: Specifica la convenzione di generazione dei moduli. Con `Node16`, TypeScript segue le regole native di Node.js per CommonJS ed ECMAScript Modules a seconda di come i file e i package sono dichiarati.
* **Riga 5: `"moduleResolution": "Node16"`**: Definisce l'algoritmo impiegato per risolvere i percorsi degli `import`. `Node16` rispetta i campi `exports` e `imports` di `package.json` e impone l'accuratezza nelle estensioni dei percorsi.
* **Riga 6: `"outDir": "./dist"`**: Directory di output in cui il compilatore scriverà tutti i file `.js` transpilati e le eventuali declaration maps `.d.ts`.
* **Riga 7: `"rootDir": "./src"`**: Specifica la directory radice dei sorgenti TypeScript. TypeScript riflette la struttura gerarchica di `src` all'interno di `dist`.
* **Riga 8: `"strict": true`**: Attiva la modalità rigida di TypeScript. Abilita un gruppo completo di controlli rigorosi:
  - `noImplicitAny`: Rifiuta qualsiasi variabile il cui tipo non sia annotato e non possa essere dedotto, impedendo che diventi implicitamente di tipo `any`.
  - `strictNullChecks`: Distingue `null` e `undefined` da tutti gli altri tipi (una stringa non può valere `null` a meno che non sia esplicitamente dichiarata come `string | null`).
  - `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`.
* **Riga 9: `"noUnusedLocals": true`**: Errore a tempo di compilazione se una variabile locale viene dichiarata ma mai letta o utilizzata nel codice.
* **Riga 10: `"noUnusedParameters": true`**: Errore a tempo di compilazione se una funzione o un middleware dichiara un parametro formale che non viene mai impiegato nel corpo della funzione.
* **Riga 11: `"noImplicitReturns": true`**: Garantisce che ogni possibile ramo di esecuzione all'interno di una funzione con tipo di ritorno esplicito ritorni un valore appropriato.
* **Riga 12: `"noFallthroughCasesInSwitch": true`**: Errore di compilazione se un blocco `case` in uno `switch` non termina con `break` o `return`, prevenendo il fallthrough involontario ad altri blocchi.
* **Riga 13: `"esModuleInterop": true`**: Crea wrapper ausiliari a tempo di compilazione per garantire l'interoperabilità tra moduli CommonJS (es. librerie legacy con `module.exports`) e la sintassi standard ECMAScript (`import express from 'express'`).
* **Riga 14: `"skipLibCheck": true`**: Disabilita il type-checking dei file di dichiarazione (`.d.ts`) inclusi in `node_modules`. Riduce drasticamente i tempi di compilazione evitando conflitti di tipi interni alle librerie di terze parti.
* **Riga 15: `"forceConsistentCasingInFileNames": true`**: Impedisce importazioni che differiscono solo per maiuscole/minuscole (es. `import User from './User'` vs `./user`), essenziale per prevenire bug quando il team lavora su OS con file-system case-insensitive (macOS/Windows) e distribuisce su OS case-sensitive (Linux Docker container).
* **Riga 17: `"include": ["src/**/*"]`**: Pattern glob che indica al compilatore di elaborare qualsiasi file `.ts` all'interno della directory `src`.
* **Riga 18: `"exclude": ["src/__tests__/**/*", "**/*.test.ts"]`**: Esclude esplicitamente i file di test dalla compilazione di produzione. Questo assicura che in `dist/` finisca unicamente il codice runtime del server e non suite di test o librerie ausiliarie.

---

### 3.4 `frontend/tsconfig.json`
* **Riga 4: `"useDefineForClassFields": true`**: Allinea il comportamento dei campi di classe alla semantica ECMAScript standard (`Object.defineProperty`), fondamentale per la compatibilità moderna.
* **Riga 5: `"lib": ["ES2022", "DOM", "DOM.Iterable"]`**: Specifica le librerie di definizioni dei tipi incluse nella compilazione. A differenza del backend, qui è presente `"DOM"` e `"DOM.Iterable"`, consentendo al codice di accedere a oggetti globali del browser come `window`, `document`, `HTMLElement`, `fetch`, `Event`.
* **Riga 6: `"module": "ESNext"`**: Indica che il codice emette moduli conformi all'ultima specifica ECMAScript, lasciando la risoluzione e l'ottimizzazione dei moduli al bundler (Vite).
* **Riga 8: `"moduleResolution": "bundler"`**: Strategia introdotta in TypeScript 5. Indica al compilatore che la risoluzione effettiva degli import viene gestita da un bundler moderno (Vite/esbuild), consentendo importazioni flessibili senza imporre estensioni rigide nei percorsi relativi.
* **Riga 11: `"isolatedModules": true`**: Avvisa il programmatore se scrive codice che non può essere compilato in modo sicuro da transpiler che operano su un singolo file alla volta (come `esbuild` o `Babel`), ad esempio l'export di tipi non espliciti senza l'uso di `export type`.
* **Riga 12: `"noEmit": true`**: Ordina a `tsc` di NON generare file di output (`.js` o `.d.ts`). Nel frontend, il compito di emettere i file transpilati e minificati spetta a Vite (`vite build`). `tsc` viene utilizzato esclusivamente come **Type Checker** per validare la correttezza formale dell'applicazione (`tsc -b`).
* **Riga 13: `"jsx": "react-jsx"`**: Abilita la nuova trasformazione JSX introdotta in React 17+. Il compilatore trasforma elementi come `<h1>Test</h1>` in chiamate interne `_jsx('h1', { children: 'Test' })` senza richiedere di importare manualmente `import React from 'react'` all'inizio di ogni file `.tsx`.
* **Riga 18: `"types": ["vite/client"]`**: Include le definizioni di tipo globali fornite da Vite, permettendo al codice di riconoscere variabili d'ambiente speciali come `import.meta.env` e importazioni di risorse statiche (`.png`, `.svg`, `.css`).

---

### 3.5 `frontend/vite.config.ts`
* **Riga 1: `import { defineConfig } from 'vite';`**: Importa la funzione helper di Vite che fornisce l'auto-completamento (IntelliSense) e la validazione dei tipi TypeScript sull'oggetto di configurazione.
* **Riga 2: `import react from '@vitejs/plugin-react';`**: Importa il plugin ufficiale Vite per React. Sotto il cofano, applica Babel/esbuild per supportare JSX, React Fast Refresh (HMR istantaneo) e ottimizzazioni di rendering.
* **Riga 4: `export default defineConfig({`**: Esporta come default l'oggetto di configurazione elaborato da Vite all'avvio del server locale o durante il comando di build.
* **Riga 5: `plugins: [react()],`**: Inietta il plugin React nella pipeline di trasformazione di Vite.
* **Riga 6: `server: {`**: Blocco di configurazione del server web di sviluppo locale.
* **Riga 7: `port: 5173,`**: Fissa la porta TCP su cui il frontend sarà in ascolto (`http://localhost:5173`).
* **Riga 8: `host: true,`**: Dice a Vite di effettuare il bind non solo su `127.0.0.1` (localhost), ma su tutte le interfacce di rete della macchina (`0.0.0.0`). Questo è essenziale quando l'applicazione viene eseguita all'interno di un container Docker o per consentire l'accesso al test da altri dispositivi sulla stessa rete LAN.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Il parametro `"noEmit": true` nel frontend
* **Domanda del Docente**: *"Nel file `frontend/tsconfig.json` è impostato `"noEmit": true`. Se da terminale entro nella cartella frontend ed eseguo `npx tsc`, quale cartella di output viene generata e cosa contiene?"*
* **Risposta dello Studente**: *"Nessuna cartella viene generata. `tsc` non produce alcun file JavaScript su disco quando `"noEmit": true` è attivo. Nel nostro frontend, `tsc` viene invocato puramente come Type Checker statico (per validare che non sussistano errori di tipo). La reale emissione dei file fisici, la minificazione, il bundling e il code-splitting sono demandati interamente a Vite tramite Rollup durante il comando `vite build`."*

---

### Scenario 4.2: La violazione di `"strict": true` con `strictNullChecks`
* **Domanda del Docente**: *"Cosa succede a tempo di compilazione se nel backend dichiariamo la seguente funzione e proviamo a compilare con `npm run build`?"*
  ```typescript
  function getUserEmail(user?: { email: string }): string {
    return user.email;
  }
  ```
* **Risposta dello Studente**: *"Il compilatore TypeScript blocca la build con un errore: `TS18048: 'user' is possibly 'undefined'`. Poiché nel file `backend/tsconfig.json` abbiamo impostato `"strict": true`, viene ereditata la direttiva `strictNullChecks`. TypeScript impedisce di accedere direttamente a proprietà di un oggetto che potrebbe essere `undefined` o `null` a runtime, prevenendo crash fatali del processo Node.js (`TypeError: Cannot read properties of undefined`). Per correggere l'errore dobbiamo usare l'optional chaining (`return user?.email ?? ''`) oppure una type-guard esplicita."*

---

### Scenario 4.3: Rimozione di `"host": true` in `vite.config.ts` durante l'esecuzione in Docker
* **Domanda del Docente**: *"Cosa succede se rimuoviamo `host: true` dalla sezione `server` di `vite.config.ts` e avviamo il container Docker esponendo la porta 5173 con `ports: ["5173:5173"]`?"*
* **Risposta dello Studente**: *"L'applicazione non sarà raggiungibile dal browser dell'host (`ERR_EMPTY_RESPONSE` o `Connection Refused`). Senza `host: true`, Vite esegue il bind del server HTTP esclusivamente sull'interfaccia di loopback interna del container (`127.0.0.1`). Di conseguenza, i pacchetti di rete instradati dal demone Docker dall'esterno verso la porta 5173 del container vengono scartati. Impostando `host: true` (equivalente a `--host 0.0.0.0`), Vite ascolta su tutte le interfacce di rete del container, permettendo al port-forwarding di Docker di funzionare correttamente."*

---

### Scenario 4.4: Inversione di configurazione tra `backend` e `frontend`: `"lib": ["DOM"]`
* **Domanda del Docente**: *"Cosa accadrebbe se aggiungessimo `"DOM"` alla voce `"lib"` del file `backend/tsconfig.json`? Il compilatore genererebbe un errore immediato?"*
* **Risposta dello Studente**: *"No, il compilatore non darebbe errore sulla configurazione in sé, ma si creerebbe un grave rischio architetturale: TypeScript renderebbe disponibili al codice del backend i tipi globali del browser (come `document`, `window`, `localStorage`, `HTMLElement`). Se uno sviluppatore scrivesse erroneamente `localStorage.setItem(...)` o tentasse di manipolare il DOM in un controller di Express, TypeScript compilerebbe il codice senza errori a compile-time, ma il server Node.js andrebbe in crash fatale a runtime con `ReferenceError: window is not defined`, poiché tali API esistono esclusivamente all'interno del runtime dei web browser e non nel motore V8 di Node.js."*

---

### Scenario 4.5: Type Erasure e controlli a runtime
* **Domanda del Docente**: *"Supponiamo di avere nel backend un'interfaccia TypeScript `interface UserDTO { username: string; age: number; }`. Possiamo verificare a runtime se il corpo di una richiesta HTTP è conforme a questa interfaccia scrivendo `if (req.body instanceof UserDTO)`?"*
* **Risposta dello Studente**: *"Assolutamente no, questo codice genererà un errore di sintassi a tempo di compilazione: `'UserDTO' only refers to a type, but is being used as a value here`. A causa del principio di **Type Erasure**, tutte le interfacce (`interface`) e i tipi (`type`) di TypeScript svaniscono completamente durante la compilazione in JavaScript: a runtime `UserDTO` non esiste come oggetto, funzione o costruttore. Per validare la forma di un payload a runtime nel nostro progetto impieghiamo la libreria **Zod** (trattata in dettaglio nel Capitolo 4), la quale genera uno schema di validazione presente in memoria a runtime ed è in grado di eseguire sia la validazione dei dati sia l'inferenza del tipo TypeScript statico."*
