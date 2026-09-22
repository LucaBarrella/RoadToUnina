# Capitolo 4: Autenticazione, Sicurezza e Validazione Runtime

---

## 1. Teoria Fondamentale

### 1.1 Crittografia Applicata: Hashing Unidirezionale vs Cifratura
Nel campo della sicurezza del software, una distinzione teorica imperativa riguarda le primitive crittografiche:
- **Cifratura (Simmetrica / Asimmetrica)**: Funzione biiettiva reversibile. Dato un testo in chiaro (*plaintext*) e una chiave crittografica, si ottiene un testo cifrato (*ciphertext*); applicando la chiave (o la controparte privata) è sempre possibile decifrare e recuperare il dato originario. Non deve mai essere usata per memorizzare password.
- **Funzione di Hashing Crittografico**: Funzione unidirezionale non invertibile (*one-way mathematical function*). Mappa una stringa di lunghezza arbitraria in un digest a lunghezza fissa ($H(m) = h$). Non esiste una funzione inversa $H^{-1}(h)$ per risalire matematicamente alla password originaria.

```
       Plaintext Password: "Password123!"
                     │
                     ▼
           [ + Random Salt (16 bytes) ]
                     │
                     ▼
         ┌───────────────────────┐
         │  bcrypt Hash Function │ ◄── Cost Factor: 2^10 iterazioni
         └───────────┬───────────┘
                     │
                     ▼
    $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
    ├──┘├──┘└────────────────────┘└────────────────────────────┘
    Alg  Cost     128-bit Salt              184-bit Hash Digest
```

#### Perché SHA-256 semplice è insicuro per le password: Il ruolo di bcrypt
Algoritmi generici come MD5, SHA-1 o SHA-256 sono stati progettati per essere estremamente veloci (calcolano milioni di hash al secondo per verificare l'integrità dei file). Questa rapidità li rende fatalmente vulnerabili ad attacchi condotti su GPU moderne, in grado di calcolare miliardi di combinazioni al secondo mediante:
1. **Dizionario & Brute-Force**: Tentativi massivi su elenchi di password comuni.
2. **Rainbow Tables**: Tabelle precalcolate di corrispondenze tra plaintext e hash.

**bcrypt** (basato sull'algoritmo di cifratura Blowfish) risolve questi vettori d'attacco attraverso tre principi:
1. **Salt Crittografico Automatico**: Una sequenza casuale generata da un CSPRNG (*Cryptographically Secure Pseudo-Random Number Generator*) viene concatenata alla password prima del calcolo dell'hash. Il salt rende unico l'hash anche per due utenti che scelgono la stessa password, vanificando completamente le Rainbow Tables.
2. **Slow by Design (Key Stretching)**: Introduce un parametro di costo (*work factor* o *cost*, nel nostro progetto fissato a `10`). Il costo definisce il numero di iterazioni dell'algoritmo ($2^{10} = 1024$ cicli di espansione della chiave).
3. **Memory Hardness**: Richiede accesso continuo a tabelle in memoria, limitando drasticamente la parallelizzazione su circuiti ASIC o GPU rispetto a SHA-256.

---

### 1.2 Lo Standard JWT (JSON Web Token - RFC 7519)
Un **JSON Web Token (JWT)** è una stringa compatta, sicura per il trasporto via URL e header HTTP, impiegata per trasmettere asserzioni (*claims*) verificate tra due parti.

Un token JWT è composto rigorosamente da tre parti separate da punti (`.`):
$$\text{JWT} = \text{Header}.\text{Payload}.\text{Signature}$$

```
   ┌──────────────────────────────────────────────────────────┐
   │ Header (Base64Url)                                       │
   │ {"alg": "HS256", "typ": "JWT"}                           │
   ├──────────────────────────────────────────────────────────┤
   │ Payload / Claims (Base64Url) - NON CIFRATO!             │
   │ {"id": "uuid-123", "username": "runner", "exp": 1740000} │
   ├──────────────────────────────────────────────────────────┤
   │ Cryptographic Signature (HMAC-SHA256)                    │
   │ HMACSHA256(                                              │
   │   base64Url(Header) + "." + base64Url(Payload),          │
   │   JWT_SECRET                                             │
   │ )                                                        │
   └──────────────────────────────────────────────────────────┘
```

1. **Header**: Oggetto JSON codificato in Base64Url contenente i metadati del token (tipo di token `JWT` e algoritmo crittografico `HS256`).
2. **Payload (Claims)**: Oggetto JSON codificato in Base64Url contenente le asserzioni sull'utente (es. identificatore univoco `id`, `username`, scadenza `exp`). **Attenzione**: il payload è semplicemente codificato in Base64, non è cifrato! Chiunque entri in possesso del token può leggerne il contenuto.
3. **Signature (Firma Digitale)**: Calcolata prendendo l'header codificato, il payload codificato, concatenandoli con un punto e applicando l'algoritmo HMAC-SHA256 con il segreto simmetrico custodito esclusivamente dal server (`JWT_SECRET`).

#### Stateless Auth vs Stateful Session Cookies
- **Stateful (Session Cookie)**: Il server memorizza l'ID sessione in RAM o Redis e invia un cookie al browser. A ogni richiesta cerca la sessione nel DB. Scalabilità orizzontale complessa (richiede session store condiviso).
- **Stateless (JWT Bearer Token)**: Il server non interroga il database per verificare la sessione. Basta convalidare matematicamente la firma con `JWT_SECRET`. Se la firma corrisponde e il token non è scaduto, l'identità dell'utente è certificata.

---

### 1.3 Static Typing (TypeScript) vs Runtime Validation (Zod)
Uno dei punti di vulnerabilità più critici nello sviluppo in TypeScript è il **falso senso di sicurezza** generato dal compilatore statico:

> **Teorema del Type Erasure**: A tempo di compilazione, TypeScript verifica che i tipi siano coerenti. A tempo di esecuzione (*runtime*), tutti i tipi TypeScript vengono cancellati. 

Se definiamo un'interfaccia:
```typescript
interface RegisterDTO {
  email: string;
  password: string;
}
```
e nel controller scriviamo `const body = req.body as RegisterDTO;`, stiamo eseguendo una mera asserzione di tipo (*Type Assertion*). Se un client malevolo invia `{ email: 12345, payload: "<script>..." }` o omette campi obbligatori, il processo Node.js accetta il dato senza errori immediati, provocando crash o vulnerabilità SQL/NoSQL più a fondo nella pipeline.

Per garantire la sicurezza alle frontiere dell'applicazione (*Edge boundaries*), è obbligatorio usare la **validazione a runtime** tramite **Zod**:
- Zod definisce uno schema che esiste fisicamente a runtime in memoria come oggetto JavaScript.
- Analizza, valida e sanifica il payload in ingresso.
- **Type Inference di Zod**: Consente di derivare il tipo TypeScript statico direttamente dallo schema di runtime tramite `z.infer<typeof schema>`, mantenendo un'unica fonte di verità (*Single Source of Truth*).

---

## 2. Il Codice nel Nostro Progetto

### 2.1 File: `backend/src/services/authService.ts`
```typescript
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';
import { JWT_SECRET } from '../config/env';

export type UserProfile = Omit<User, 'password'>;

export interface RegisterDTO {
  email: string;
  username: string;
  password: string;
}

export interface LoginDTO {
  login: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export function sanitizeUser(user: User): UserProfile {
  const { password: _, ...profile } = user;
  return profile;
}

export class AuthService {
  public async register(dto: RegisterDTO): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === normalizedEmail) {
        throw new AppError('Email is already registered', 400, ErrorCode.EMAIL_ALREADY_REGISTERED);
      }
      throw new AppError('Username is already taken', 400, ErrorCode.USERNAME_ALREADY_TAKEN);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
      },
    });

    return {
      token: this.generateToken(user.id, user.username),
      user: sanitizeUser(user),
    };
  }

  public async login(dto: LoginDTO): Promise<AuthResponse> {
    const loginIdentifier = dto.login.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginIdentifier }, { username: dto.login.trim() }],
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new AppError('Invalid credentials', 401, ErrorCode.INVALID_CREDENTIALS);
    }

    return {
      token: this.generateToken(user.id, user.username),
      user: sanitizeUser(user),
    };
  }

  public async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCode.USER_NOT_FOUND);
    return sanitizeUser(user);
  }

  private generateToken(id: string, username: string): string {
    return jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
  }
}

export const authService: AuthService = new AuthService();
```

### 2.2 File: `backend/src/types/express.d.ts` (Declaration Merging)
```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

export {};
```

### 2.3 File: `backend/src/middlewares/authMiddleware.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorMiddleware';
import { ErrorCode } from '../constants/errorCodes';
import { JWT_SECRET } from '../config/env';

export interface JwtPayload {
  id: string;
  username: string;
}

export function isJwtPayload(val: unknown): val is JwtPayload {
  if (typeof val !== 'object' || val === null) return false;
  const candidate = val as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.username === 'string';
}

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Token missing or invalid format', 401, ErrorCode.UNAUTHORIZED));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new AppError('Unauthorized: Token missing or invalid format', 401, ErrorCode.UNAUTHORIZED));
  }

  try {
    const decoded: unknown = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!isJwtPayload(decoded)) {
      return next(new AppError('Unauthorized: Malformed token payload', 401, ErrorCode.UNAUTHORIZED));
    }
    req.user = decoded;
    next();
  } catch (_jwtErr) {
    return next(new AppError('Unauthorized: Invalid or expired token', 401, ErrorCode.UNAUTHORIZED));
  }
};
```

### 2.4 File: `backend/src/middlewares/validateMiddleware.ts` e Schemi Zod
```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, z, ZodType } from 'zod';
import { RegisterDTO, LoginDTO } from '../services/authService';

export const registerSchema: ZodType<RegisterDTO> = z.object({
  email: z.string().trim().max(255).email('Invalid email address format'),
  username: z.string().trim().min(3).max(30),
  password: z.string().min(6).max(128),
});

export const loginSchema: ZodType<LoginDTO> = z.object({
  login: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(128),
});

export type ValidationSource = 'body' | 'query' | 'params';

export const validateMiddleware = <T>(
  schema: ZodSchema<T>,
  source: ValidationSource = 'body'
): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated: T = await schema.parseAsync(req[source]);
      if (source === 'query') {
        Object.defineProperty(req, 'query', {
          value: validated,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[source] = validated;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

---

## 3. Disamina Riga per Riga

### 3.1 `backend/src/services/authService.ts`
* **Riga 12: `export type UserProfile = Omit<User, 'password'>;`**: Sfrutta la utility type di TypeScript `Omit<T, K>`. Costruisce un nuovo tipo identico all'entità `User` di Prisma, ma esclude tassativamente la proprietà `password`. Questo tipo protegge le risposte API dalla diffusione accidentale degli hash delle password.
* **Righe 52-55: `sanitizeUser(user: User): UserProfile`**: Funzione pura che adotta l'object rest destructuring (`const { password: _, ...profile } = user; return profile;`). Rimuove fisicamente il campo password dal record restituito da Prisma prima di inviarlo in formato JSON al client.
* **Righe 70-71: Normalizzazione input (`toLowerCase()`, `trim()`)**: Fondamentale per prevenire attacchi di spoofing e duplicati logici (es. `Admin@unina.it` vs `admin@unina.it`).
* **Righe 86-87: `bcrypt.genSalt(10)` e `bcrypt.hash(dto.password, salt)`**: Genera un salt crittografico a 16 byte con fattore di costo 10 ($2^{10}$ round) e calcola l'hash finale combinato da persistere nel database.
* **Righe 119-121: `!(await bcrypt.compare(dto.password, user.password))` e Timing Attack Prevention**: `bcrypt.compare` estrae il salt e il fattore di costo dall'hash memorizzato nel DB, calcola l'hash della password fornita dal client con gli stessi parametri e confronta i due digest. L'implementazione esegue il confronto in **tempo costante** (*constant-time comparison*), mitigando i **Timing Attacks** (attacchi in cui un malintenzionato misura le discrepanze nei nanosecondi di risposta per indovinare i caratteri della password). Inoltre, rispondiamo con un messaggio generico `'Invalid credentials'` (senza specificare se è errata l'email o la password) per prevenire l'**Account Enumeration**.
* **Riga 150: `jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' })`**: Firma un nuovo token con scadenza prefissata a 7 giorni (`expiresIn: '7d'`). Inserisce automaticamente nel payload il timestamp di emissione `iat` (*issued at*) e di scadenza `exp` (*expiration time*).

---

### 3.2 `backend/src/types/express.d.ts` (Declaration Merging)
* **Righe 1-27: `declare global { namespace Express { interface Request { user?: ... } } }`**: Utilizza la caratteristica avanzata di TypeScript nota come **Declaration Merging** (*fusione delle dichiarazioni*). In TypeScript, le interfacce con lo stesso nome nello stesso namespace vengono fuse insieme. Estendiamo l'interfaccia nativa `Request` di Express aggiungendo il campo opzionale `user`. In questo modo, in tutti i file TypeScript del backend, scrivendo `req.user.id` il compilatore offre piena tipizzazione e autocompletamento senza dover ricorrere a cast non sicuri come `(req as any).user`.

---

### 3.3 `backend/src/middlewares/authMiddleware.ts`
* **Righe 28-32: User-Defined Type Guard (`val is JwtPayload`)**: Funzione con predicato di tipo. Ispeziona a runtime un valore sconosciuto (`unknown`). Se e solo se la funzione ritorna `true`, il compilatore TypeScript restringe (*type narrowing*) il tipo della variabile da `unknown` a `JwtPayload`.
* **Righe 53-62: Estrazione dello schema Bearer**: Verifica la presenza dell'header `Authorization: Bearer <token>`. Esegue lo slicing con `substring(7)` per rimuovere il prefisso standard RFC 6750.
* **Riga 65: `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`**: Verifica crittografica rigorosa. Il parametro esplicito `algorithms: ['HS256']` è una contromisura critica contro l'attacco di **Algorithm Downgrade** (es. l'attacco in cui un hacker modifica l'header del JWT indicando `"alg": "none"` per bypassare la verifica della firma). Se la firma non coincide o il token è scaduto, `jwt.verify` lancia un'eccezione.
* **Riga 69: `req.user = decoded;`**: Associa il payload validato all'oggetto richiesta per essere consumato dai router successivi.

---

### 3.4 `backend/src/middlewares/validateMiddleware.ts`
* **Righe 21-25: Generics `<T>` e Higher-Order Function**: Factory che riceve uno schema Zod `ZodSchema<T>` e restituisce un handler Express.
* **Riga 27: `await schema.parseAsync(req[source])` vs `safeParse`**:
  - `schema.parseAsync()`: Esegue la validazione asincrona (supportando eventuali raffinamenti asincroni con DB). Se i dati sono validi, restituisce il dato ripulito (es. rimuovendo spazi con `.trim()`); se non sono validi, solleva un'eccezione `ZodError` che viene inoltrata a `next(error)` e gestita dal nostro `errorMiddleware` (restituendo status `400 Validation Error` con la lista dettagliata dei campi errati).
  - Al contrario, `schema.safeParse()` restituisce un oggetto discriminato `{ success: true, data }` o `{ success: false, error }`, richiedendo un controllo manuale con `if (!result.success)`. L'approccio con `parseAsync` all'interno di un middleware standardizza il flusso delle eccezioni.
* **Righe 28-37: Mutazione controllata di `req[source]`**: Sostituisce l'oggetto non fidato originario (`req.body`) con la versione processata e validata da Zod (`validated`), garantendo che i tipi siano sanificati prima di raggiungere i service.

---

## 4. Scenari d'Esame "What-If" (Simulazione Orale)

### Scenario 4.1: Type Cast statico `req.body as RegisterDTO` vs Schema Zod
* **Domanda del Docente**: *"Perché non possiamo semplicemente omettere Zod e affidarci al compilatore TypeScript scrivendo `const { email, password } = req.body as RegisterDTO;` all'inizio del controller?"*
* **Risposta dello Studente**: *"Perché l'operatore `as` di TypeScript è una mera **asserzione di tipo** a tempo di compilazione che viene completamente cancellata durante la fase di transpilation in JavaScript (**Type Erasure**). A runtime, TypeScript non esegue alcun controllo fisico sulla memoria. Se un client malevolo o un bug inviasse `{ email: null, password: "" }` o un payload privo di campi, l'istruzione `as RegisterDTO` non fermerebbe la richiesta: il dato non validato raggiungerebbe il database, provocando crash del server (`TypeError`), violazioni di vincoli SQL o peggio corruzione di dati. Con lo schema Zod (`registerSchema`), la richiesta viene analizzata fisicamente a runtime, garantendo che email sia valida, username abbia almeno 3 caratteri e la password almeno 6 prima di eseguire qualunque logica di business."*

---

### Scenario 4.2: Manomissione manuale del Payload di un JWT
* **Domanda del Docente**: *"Un utente malintenzionato decodifica il proprio JWT da Base64Url, modifica il payload sostituendo il proprio `id` con quello di un amministratore (`"id": "admin-uuid"`), ricodifica in Base64Url e invia la richiesta all'endpoint protetto `/api/auth/me`. Cosa accade esattamente?"*
* **Risposta dello Studente**: *"La richiesta viene respinta immediatamente con codice `401 Unauthorized`. Quando il token raggiunge il middleware `authMiddleware`, viene invocata la funzione `jwt.verify(token, JWT_SECRET)`. La funzione ricalcola l'HMAC-SHA256 tra l'header fornito, il nuovo payload modificato dall'utente e il segreto del server `JWT_SECRET`. Poiché l'attaccante non conosce la chiave segreta `JWT_SECRET`, la firma ricalcolata dal server non corrisponderà alla firma originale allegata nel token. `jwt.verify` lancia un'eccezione `JsonWebTokenError: invalid signature`, il blocco `catch` intercetta l'errore e ritorna un `AppError(..., 401, UNAUTHORIZED)`."*

---

### Scenario 4.3: Token Scaduto e Gestione di `TokenExpiredError`
* **Domanda del Docente**: *"Cosa succede a runtime quando un utente invia una richiesta con un token emesso 8 giorni fa (scaduto), e come reagisce la pipeline del server?"*
* **Risposta dello Studente**: *"Durante la verifica `jwt.verify`, la libreria esamina il claim `exp` (timestamp di scadenza UNIX) confrontandolo con l'orario UTC corrente del server. Rilevando che il tempo attuale supera `exp`, lancia un'eccezione specifica di classe `TokenExpiredError`. Nel nostro `authMiddleware`, il blocco `try/catch` intercetta qualsiasi errore derivante da `jwt.verify` (incluso `TokenExpiredError`) e invoca `next(new AppError('Unauthorized: Invalid or expired token', 401, ErrorCode.UNAUTHORIZED))`. Questo impedisce crash del processo Node.js e restituisce al client una risposta HTTP 401 standardizzata, consentendo al frontend di reindirizzare l'utente alla schermata di Login."*

---

### Scenario 4.4: Inserimento di Dati Sensibili nel Payload del JWT
* **Domanda del Docente**: *"Supponiamo che uno sviluppatore aggiunga la password in chiaro o il codice fiscale dell'utente nel payload del token JWT per averli comodamente a disposizione in `req.user`. Qual è la gravità di questa scelta dal punto di vista della sicurezza?"*
* **Risposta dello Studente**: *"È una falla di sicurezza critica. La codifica Base64Url del payload di un JWT **non è una cifratura**, ma un semplice formato di serializzazione leggibile da chiunque. Qualsiasi intermediario di rete (proxy, logger, man-in-the-middle), estensione del browser o script client-side può decodificare la stringa con una semplice chiamata `atob(token.split('.')[1])` e visualizzare i dati sensibili in chiaro. Il payload del JWT deve contenere esclusivamente identificatori minimi e non sensibili (come lo User ID e lo username)."*

---

### Scenario 4.5: Debolezza di SHA-256 semplice per la persistenza delle password
* **Domanda del Docente**: *"Se al posto di bcrypt usassimo il modulo nativo di Node `crypto.createHash('sha256').update(password).digest('hex')`, quali vulnerabilità introdurremmo nel sistema?"*
* **Risposta dello Studente**: *"Introdurremmo due vulnerabilità gravissime:
  1. **Assenza di Salt (Vulnerabilità a Rainbow Tables)**: Due utenti con la stessa password avrebbero lo stesso identico hash nel database. In caso di data breach, un attaccante potrebbe confrontare l'intero database con Rainbow Tables precalcolate e risalire alle password in frazioni di secondo.
  2. **Eccessiva Velocità Computazionale (Vulnerabilità a Brute-Force su GPU)**: Una GPU di fascia moderna può calcolare oltre 10 miliardi di hash SHA-256 al secondo. Una password di 8 caratteri alfanumerici verrebbe violata in poche decine di minuti. Con bcrypt a costo 10, il calcolo di un singolo hash richiede circa 80-100 millisecondi di tempo di CPU: lo stesso attacco a forza bruta richiederebbe decenni, rendendolo computazionalmente infattibile."*
