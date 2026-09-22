# Capitolo 6: Frontend React 18 Architecture e State Management

---

## 1. Teoria Fondamentale

### 1.1 Il Modello di React: Virtual DOM, Reconciliation e React Fiber
I browser web rappresentano i documenti caricati tramite il **DOM (Document Object Model)**, un albero di nodi manipolabile via JavaScript. Tuttavia, le mutazioni dirette sul DOM del browser sono operazioni intrinsecamente lente: ogni modifica a un nodo può forzare il browser a ricalcolare stili, geometrie (*Reflow / Layout*) e ridisegnare i pixel a schermo (*Repaint*).

Per ottimizzare questo processo, **React** introduce il **Virtual DOM (VDOM)**: una rappresentazione virtuale e leggera dell'albero DOM mantenuta in memoria RAM sotto forma di oggetti JavaScript.

```
 [ Stato / Props Cambiano ]
             │
             ▼
 ┌───────────────────────┐
 │   Nuovo Virtual DOM   │
 └───────────┬───────────┘
             │
             ├─────────────────────────────────────────┐
             ▼                                         ▼
 ┌───────────────────────┐                 ┌───────────────────────┐
 │  Vecchio Virtual DOM  │                 │ Algoritmo Diffing     │
 └───────────────────────┘                 │ Complessità: O(n)     │
                                           └───────────┬───────────┘
                                                       │ Calcolo mutazioni minime
                                                       ▼
                                           ┌───────────────────────┐
                                           │       Real DOM        │
                                           │  (Batch DOM Patching) │
                                           └───────────────────────┘
```

#### 1. L'Algoritmo di Reconciliation (Diffing $O(n)$)
Il problema del confronto tra due alberi arbitrari ha una complessità computazionale teorica di $O(n^3)$. React adotta un'euristica basata su due assunti, riducendo la complessità a $O(n)$:
- **Elementi di tipo diverso producono alberi diversi**: Se un tag `<button>` viene rimpiazzato da un `<div>`, React non analizza i figli: demolisce l'intero sottoalbero e lo ricrea da zero (*unmount* e *mount*).
- **Stabilità delle chiavi con la prop `key`**: Negli array dinamici di componenti, la prop `key` fornisce un'identità persistente a ciascun elemento tra un render e l'altro, permettendo a React di riordinare, inserire o cancellare nodi senza dover ricostruire la lista intera.

#### 2. L'Architettura React Fiber
Introdotto con React 16 e consolidato in React 18, **React Fiber** è una riscrittura totale del motore di riconciliazione.
- **Nel vecchio Stack Reconciler**: La riconciliazione era sincrona e ricorsiva. Una volta iniziato il rendering di un albero complesso, il thread principale del browser rimaneva bloccato (*thread blocking*), provocando perdita di frame (*jank*) negli input e nelle animazioni.
- **In Fiber**: L'albero dei componenti viene modellato come una lista concatenata di unità di lavoro (*Fiber Nodes*). Fiber consente di:
  - Sospendere, riprendere o abortire un lavoro di rendering.
  - Assegnare priorità diverse a task differenti (es. priorità immediata ai click dell'utente, priorità differibile al rendering di background).
  - Eseguire il rendering in modalità concorrente (*Concurrent Features*).

---

### 1.2 Il Rendering Cycle in React 18 e l'Automatic Batching
Il ciclo di vita del rendering in React è rigorosamente suddiviso in tre fasi:
1. **Trigger Phase**: Avvio del rendering, scatenato da una modifica di stato (`useState`, `useReducer`), dal cambio di un `Context`, o dal montaggio iniziale (`createRoot`).
2. **Render Phase**: React invoca i componenti funzionali per determinare la nuova struttura del Virtual DOM. **Questa fase deve essere pura e priva di effetti collaterali (Side Effects)**: non deve interagire con il DOM reale, non deve modificare variabili globali né lanciare chiamate di rete. Con React Fiber, questa fase può essere interrotta o scartata se sopraggiungono eventi a priorità più elevata.
3. **Commit Phase**: React applica le differenze calcolate sul DOM reale del browser (`appendChild`, `removeChild`, mutazione attributi). Questa fase è sincrona per evitare artefatti visivi. Terminata la commit phase, il browser esegue il *Paint* e React invoca gli hook `useEffect`.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRIGGER                                                  │
│    setToken(...) o navigate(...)                             │
├─────────────────────────────────────────────────────────────┤
│ 2. RENDER PHASE (Pura, concorrente, interrompibile)        │
│    Esecuzione Componenti -> Calcolo differenze VDOM         │
├─────────────────────────────────────────────────────────────┤
│ 3. COMMIT PHASE (Sincrona)                                  │
│    Scrittura mutazioni su Real DOM                          │
├─────────────────────────────────────────────────────────────┤
│ 4. BROWSER PAINT                                            │
├─────────────────────────────────────────────────────────────┤
│ 5. PASSIVE EFFECTS                                          │
│    Esecuzione callback degli useEffect                      │
└─────────────────────────────────────────────────────────────┘
```

#### Automatic Batching in React 18
Nelle versioni precedenti di React, il raggruppamento delle mutazioni di stato (*batching*) avveniva unicamente all'interno degli handler di eventi sintetici di React. Se due aggiornamenti di stato venivano eseguiti all'interno di una `Promise`, di un `setTimeout` o di una callback di rete (es. `await authApi.login()`), React causava due re-render separati del componente.
In **React 18**, l'**Automatic Batching** è attivo ovunque: anche all'interno di callback asincrone, aggiornamenti multipli di stato (`setToken(res.token); setUser(res.user);`) vengono accorpati automaticamente in un **singolo re-render finale**, ottimizzando drasticamente le performance.

---

### 1.3 SPA Routing con React Router v7
In un'architettura **Single Page Application (SPA)**, il browser carica un singolo documento HTML (`index.html`). La transizione tra le diverse pagine (`/login`, `/game`, `/leaderboard`) non richiede una nuova richiesta di caricamento pagina al server web (*Full-Page Reload*).

React Router (v7) intercetta la navigazione sfruttando la **HTML5 History API**:
- `window.history.pushState()` e `window.history.replaceState()`: Consentono di aggiornare la barra degli indirizzi del browser senza causare il refresh del documento.
- `window.onpopstate`: Ascolta l'evento scatenato dalla pressione dei tasti "Avanti" e "Indietro" della cronologia del browser.
- **Dichiaratività**: React Router confronta l'URL corrente con l'albero delle `<Route path="..." element={<Component />} />` ed esegue il montaggio condizionale dei soli componenti necessari.

---

### 1.4 State Management: Local State, Lifting State Up e Context API
1. **Local State (`useState`)**: Stato isolato all'interno di un singolo componente (es. il valore digitato in un campo input).
2. **Lifting State Up (Sollevamento dello Stato)**: Quando due componenti fratelli necessitano di condividere un dato, lo stato viene spostato nel loro antenato comune più vicino e ridisceso tramite *props*. Se la gerarchia è profonda, questo genera il problema del **Prop Drilling** (passaggio noioso di props attraverso componenti intermedi che non ne hanno bisogno).
3. **Context API (`createContext` + `useContext`)**: Consente di definire un magazzino globale di dati a cui qualsiasi componente discendente dell'albero può accedere direttamente, aggirando il passaggio manuale delle props.
4. **Context API vs Redux/Zustand**:
   - La Context API è ideale per dati ad **bassa frequenza di aggiornamento** (es. sessione di autenticazione `user`, lingua, preferenze di tema UI).
   - **Il Problema dei Re-Render del Context**: Ogni volta che il valore fornito da un `Context.Provider` cambia (perché muta una qualsiasi proprietà dell'oggetto `value`), **tutti** i componenti che consumano quel Context (`useContext(AuthContext)`) vengono forzati al ri-rendering, a prescindere dal fatto che utilizzino o meno la specifica proprietà modificata. Per stati altamente dinamici o ad alta frequenza (es. aggiornamento al millisecondo del timer di gioco), si preferiscono Custom Hooks atomici (`useGameEngine`) o store con selettori granulari (Zustand/Redux).

---

## 2. Il Codice nel Nostro Progetto

### 2.1 File: `frontend/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 2.2 File: `frontend/src/App.tsx` (Routing e Layout Globale)
```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './hooks';
import Navbar from './components/ui/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = (): 'game' | 'leaderboard' | 'rules' => {
    if (location.pathname.startsWith('/leaderboard')) return 'leaderboard';
    if (location.pathname.startsWith('/game')) return 'game';
    return 'rules';
  };

  const handleNavigateTab = (tab: 'game' | 'leaderboard' | 'rules') => {
    if (tab === 'leaderboard') navigate('/leaderboard');
    else if (tab === 'game') navigate('/game');
    else navigate('/');
  };

  const handleOpenAuthModal = (mode: 'login' | 'register') => {
    if (mode === 'login') navigate('/login');
    else navigate('/register');
  };

  return (
    <div className="min-h-screen bg-neo-bg font-inter text-neo-black flex flex-col antialiased overflow-x-hidden w-full">
      <Navbar
        activeTab={getActiveTab()}
        onNavigateTab={handleNavigateTab}
        onOpenAuthModal={handleOpenAuthModal}
      />
      <div className="flex-1 flex flex-col w-full">{children}</div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### 2.3 File: `frontend/src/hooks/useAuth.tsx` (Context e Gestione Sessione)
```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, LoginDTO, RegisterDTO } from '../types';
import { authApi } from '../api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (data: LoginDTO) => Promise<void>;
  register: (data: RegisterDTO) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const existingToken = localStorage.getItem('token');
    if (!existingToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (_profileErr) {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (data: LoginDTO) => {
    const res = await authApi.login(data);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: RegisterDTO) => {
    const res = await authApi.register(data);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### 2.4 File: `frontend/src/pages/GamePage.tsx` (Protezione Accesso alla Route)
```tsx
export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, ...engine } = useGameEngine();

  // Pattern di Guardia di Navigazione: se l'utente non è autenticato, visualizza la card di blocco
  if (!user) {
    return (
      <div className="min-h-screen bg-neo-bg bg-dot-pattern flex items-center justify-center p-4 text-neo-black">
        <Card variant="yellow" className="w-full max-w-lg p-6 sm:p-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-5xl mb-3 text-neo-on-accent">
            lock
          </span>
          <h1 className="font-space font-black text-2xl sm:text-3xl uppercase tracking-tight mb-3 text-neo-on-accent">
            Autenticazione Richiesta
          </h1>
          <p className="font-inter text-sm sm:text-base mb-6 font-medium text-neo-on-accent">
            Devi effettuare l'accesso per avviare una speedrun e registrare il tuo punteggio in classifica.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="primary" onClick={() => navigate('/login')}>
              Accedi
            </Button>
            <Button variant="secondary" onClick={() => navigate('/register')}>
              Registrati
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Se autenticato, monta il motore di gioco attivo o il form di inizio partita
  return ( /* Rendering HUDBar, WikiRenderer, Sidebar */ );
};
```

---

## 3. Disamina Riga per Riga

### 3.1 `frontend/src/main.tsx`
* **Riga 6: `ReactDOM.createRoot(document.getElementById('root')!).render(...)`**: Inizializza l'applicazione utilizzando la nuova Root API di React 18 (`createRoot`). L'operatore `!` (*non-null assertion operator* di TypeScript) assicura al type checker che l'elemento DOM `<div id="root">` esiste fisicamente nel file `index.html`.
* **Righe 7-9: `<React.StrictMode>`**: Componente wrapper per lo sviluppo. Non produce alcun markup nel DOM reale. Il suo scopo è evidenziare potenziali problemi eseguendo volontariamente **il doppio montaggio e il doppio rendering** di componenti ed effetti in ambiente di sviluppo locale (`NODE_ENV === 'development'`).

---

### 3.2 `frontend/src/App.tsx`
* **Riga 2: `import { BrowserRouter as Router, Routes, Route, Navigate ... }`**: Importa i componenti del router client-side.
* **Righe 11-42: Componente `Layout`**:
  - `const location = useLocation()`: Hook che restituisce l'oggetto `location` corrente (rappresenta l'URL attivo).
  - `getActiveTab()`: Ispeziona `location.pathname` per determinare quale tab della `Navbar` debba essere illuminata graficamente.
  - Avvolge i figli in un container comune con sfondo, font e `Navbar` persistente, evitando che la barra di navigazione venga smontata o ricalcolata a ogni cambio rotta.
* **Righe 52-66: Gerarchia dell'Albero dei Componenti**:
  - `AuthProvider` si trova al livello più esterno possibile, garantendo che sia `Router`, sia `Layout`, sia tutte le route figlie abbiano accesso al contesto di autenticazione.
  - `<Route path="*" element={<Navigate to="/" replace />} />`: Route jolly (*catch-all*). Qualsiasi URL non corrispondente reindirizza istantaneamente alla home page `/`, sostituendo la voce non valida nella cronologia del browser grazie alla direttiva `replace`.

---

### 3.3 `frontend/src/hooks/useAuth.tsx`
* **Riga 25: `const AuthContext = createContext<AuthContextType | undefined>(undefined);`**: Istanzia il Context di React inizializzandolo a `undefined`. Questo valore sentinella viene impiegato per rilevare a runtime se il custom hook viene invocato impropriamente al di fuori dell'albero del provider.
* **Riga 40: Lazy State Initialization**:
  ```tsx
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  ```
  Passare una funzione anonima a `useState` attiva la **Lazy Initialization**: la lettura bloccante di `localStorage.getItem` viene eseguita esclusivamente al primissimo rendering di montaggio del componente e non viene rieseguita a ogni successivo ciclo di rendering di `AuthProvider`.
* **Righe 43-63: `useCallback` su `refreshProfile`**:
  - Memorizza il riferimento della funzione per evitare che venga ricreata ad ogni re-render.
  - Se è presente un token in `localStorage`, invoca `authApi.getProfile()` per verificare che il token sia ancora valido sul server backend e ne ripopola il profilo utente. Se il server risponde con `401 Unauthorized` (es. token scaduto o segreto invalidato), il blocco `catch` pulisce il token compromesso da `localStorage` (`localStorage.removeItem('token')`) e azzera lo stato della sessione.
* **Righe 116-122: Fail-Fast Custom Hook `useAuth`**:
  ```tsx
  export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
  };
  ```
  Risolve il problema del typing nullo: poiché `AuthContext` è stato tipizzato come `<AuthContextType | undefined>`, verificando la falsità di `context` e lanciando un'eccezione esplicita, il tipo di ritorno viene automaticamente ristretto (*type narrowing*) a `AuthContextType`. Se uno sviluppatore usa `useAuth` in un componente orfano, l'applicazione solleva un errore chiaro e immediato anziché fallire silenziosamente a runtime con `TypeError: Cannot read properties of undefined`.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Il ruolo di `<React.StrictMode>` e l'invocazione doppia
* **Domanda del Docente**: *"Nel file `main.tsx`, l'applicazione è racchiusa in `<React.StrictMode>`. Notiamo nella console del browser che durante l'avvio della pagina i messaggi di `console.log` all'interno di `useEffect` o nel corpo dei componenti vengono stampati due volte. Perché avviene questo? Accadrà anche in produzione?"*
* **Risposta dello Studente**: *"No, accade esclusivamente in ambiente di sviluppo (`development`). `React.StrictMode` è un tool di diagnosi architetturale progettato per preparare l'applicazione al modello concorrente di React Fiber. Per individuare bug subdoli, effetti collaterali impuri o memory leak, React forza intenzionalmente un ciclo di **doppio rendering** e una sequenza di **mount -> unmount -> remount** su ogni componente. Questo verifica che le funzioni siano matematicamente pure e che gli `useEffect` implementino correttamente le relative funzioni di cleanup (es. cancellazione di timer, rimozione di listener o abort di richieste Axios). Nella build finale di produzione (`npm run build`), StrictMode non introduce alcun overhead e i componenti vengono eseguiti rigorosamente una volta sola."*

---

### Scenario 4.2: Invocazione di `useAuth()` fuori dal Provider e Fail-Fast
* **Domanda del Docente**: *"Cosa accadrebbe a runtime se tentassimo di invocare `const { user } = useAuth();` all'interno di un componente montato prima o all'esterno di `<AuthProvider>`? Come lo abbiamo gestito nel codice?"*
* **Risposta dello Studente**: *"Se il Context non avesse un controllo esplicito, `useContext(AuthContext)` restituirebbe il valore di default con cui è stato creato (`undefined`). Successivamente, il tentativo di destrutturare `{ user }` provocherebbe un crash generico a runtime: `TypeError: Cannot destructure property 'user' of undefined`. Nel nostro codice abbiamo implementato il pattern **Fail-Fast**: all'interno della definizione del custom hook `useAuth()`, controlliamo `if (!context)` e lanciamo immediatamente un errore descrittivo: `throw new Error('useAuth must be used within an AuthProvider')`. Questo consente allo sviluppatore di identificare istantaneamente la violazione architetturale nella gerarchia dell'albero dei componenti."*

---

### Scenario 4.3: Impatto prestazionale dei cambi di stato nel Context
* **Domanda del Docente**: *"Ogni volta che `AuthProvider` aggiorna il suo stato (es. l'utente effettua il login e cambiano `token` e `user`), quali componenti dell'applicazione vengono ri-renderizzati? Quale problema di performance potrebbe sorgere se inserissimo nel Context anche il timer del gioco che cambia ogni secondo?"*
* **Risposta dello Studente**: *"Tutti i componenti discendenti che consumano `useAuth()` (come la `Navbar` e la `GamePage`) subiscono un ri-rendering immediato perché il riferimento dell'oggetto `value={{ user, token, ... }}` passato al Provider è cambiato. Se inserissimo nel Context di autenticazione globale anche il cronometro dei secondi del gioco (`elapsedSeconds`), la funzione di aggiornamento verrebbe eseguita ogni 1000 millisecondi: questo causerebbe il re-render inutile dell'intera applicazione (inclusa la Navbar, bottoni e pannelli statici) una volta al secondo. Per questa ragione abbiamo disaccoppiato l'architettura: lo stato del gioco e il timer risiedono in un custom hook atomico separato (`useGameEngine`), isolando i re-render ad alta frequenza ai soli componenti che disegnano effettivamente il gioco."*

---

### Scenario 4.4: Mutazione Diretta dello Stato vs Immutabilità nel Virtual DOM
* **Domanda del Docente**: *"Cosa accade se all'interno di un componente React eseguiamo direttamente `user.username = 'NuovoNome'` invece di invocare `setUser({ ...user, username: 'NuovoNome' })`? Perché l'immutabilità è un dogma in React?"*
* **Risposta dello Studente**: *"L'interfaccia utente non si aggiornerà affatto. React determina se un componente deve essere ri-renderizzato confrontando il vecchio stato con il nuovo stato tramite il confronto di uguaglianza per riferimento superficiale (**Shallow Equality**, `Object.is(oldState, newState)`). Se mutiamo l'oggetto direttamente in memoria, il puntatore di memoria dell'oggetto `user` rimane identico: per React `oldState === newState`, il rendering viene saltato e il Virtual DOM non calcola alcuna variazione. Rispettare il principio di immutabilità (creando un nuovo oggetto con lo spread operator `{ ...user }`) è indispensabile affinché l'algoritmo di Riconciliazione rilevi la discrepanza del riferimento e scateni la fase di Render e Commit sul DOM reale."*

---

### Scenario 4.5: Tentativo di Accesso Diretto a Route Protetta via URL
* **Domanda del Docente**: *"Un utente non autenticato incolla direttamente nella barra degli indirizzi del browser l'URL `http://localhost:5173/game`. Spiega l'esatta catena di eventi del frontend e cosa viene visualizzato a schermo."*
* **Risposta dello Studente**: *"Poiché l'applicazione è una SPA, il browser richiede la pagina statica, React si monta e React Router valuta il path `/game`, caricando il componente `GamePage`. Appena `GamePage` viene eseguito, interroga l'autenticazione tramite `const { user } = useAuth()`. Poiché il client è anonimo, `user` è `null`. Il componente esegue la guardia condizionale `if (!user)` e blocca immediatamente il montaggio del motore di gioco (`useGameEngine`), non inviando alcuna richiesta alle API protette di gioco. A schermo viene visualizzata la schermata di blocco stilizzata Neo-Brutalist con il messaggio 'Autenticazione Richiesta' e due pulsanti che guidano l'utente verso `/login` o `/register`, proteggendo l'integrità dell'applicazione anche a livello di Presentation Layer."*
