# UNIVERSITÀ DEGLI STUDI DI NAPOLI FEDERICO II

**BACHELOR OF SCIENCE IN COMPUTER SCIENCE**

**WEB TECHNOLOGIES COURSE - SPRING 2026**

**TEACHER:** Luigi Libero Lucio Starace, Ph.D.

**ELABORATO PROGETTUALE: REQUISITI E LINEE GUIDA** *(20/04/2026)*

---

## 1. INFORMAZIONI GENERALI SULLE MODALITÀ DI ESAME

Per superare l'esame di Tecnologie Web, come indicato nella Scheda dell'Insegnamento, è necessario:

1. **Superare una prova scritta**, con domande a risposta multipla e/o aperta;
2. **Consegnare e discutere**, con esito sufficiente, un **elaborato progettuale**, consistente nella realizzazione di un'applicazione web moderna. L'elaborato progettuale dovrà essere realizzato **singolarmente**.

A ciascuno dei due punti sarà assegnata una valutazione in trentesimi. Per superare l'esame, è necessaria una valutazione almeno sufficiente ($\ge 18$) per entrambi i punti. La valutazione finale sarà calcolata come **media pesata** delle due componenti:

* **Prova scritta:** 60%
* **Progetto e discussione:** 40%

---

## 2. VINCOLI E TEMPISTICHE

* **Prova Scritta:** Non c'è alcun vincolo sulla partecipazione. È possibile risostenere la prova scritta per migliorare il voto, ma il punteggio valido sarà **sempre quello dell'ultima prova sostenuta**, anche se peggiorativo. È anche possibile superare la scritta tramite due prove intercorso (media dei due voti).


* **Elaborato Progettuale:** Non c'è alcun vincolo temporale sulla consegna. Può essere consegnato prima o dopo la scritta.


* **Discussione:** Può essere sostenuta **solo dopo** aver consegnato il progetto e superato la prova scritta.


* **Rifiuto voto:** In caso si voglia rifiutare il voto del progetto per migliorarlo, sarà necessario aggiungere nuove funzionalità o cambiare traccia, a discrezione del docente.



---

## 3. REQUISITI GENERALI

Il progetto consiste nella progettazione e implementazione **full-stack** di un'applicazione web moderna e sicura:

* **Back-end:** Espone un'API (es. REST).


* **Front-end:** Realizzato come **Single Page Application (SPA)**, responsive e adattabile a viewport di varie dimensioni.


* **Testing:** Richiesta la realizzazione di **almeno 10 test End-to-End automatici**.


* **Framework & Tecnologia:** Utilizzo obbligatorio di framework web sia per back-end che per front-end. **Vietato l'uso di CMS** (es. WordPress, Strapi, ecc.). Massima libertà di scelta su linguaggi, librerie e framework allo stato dell'arte.



### Suggerimenti Utili

Per integrare contenuti dinamici da enciclopedie online, una risorsa utile è la **MediaWiki API**:

* Per selezionare una voce casuale: `action=query` + `list=random`.


* Parametri utili: `rnnamespace` (limitare a sole voci enciclopediche), `rnfilterredir` (escludere redirect), `rnminsize` e `rnmaxsize` (filtrare pagine troppo brevi o lunghe).



---

## 4. TRACCIA SELEZIONATA: WEBTECH'S ROADTOUNINA

Si vuole realizzare **ROADTOUNINA**, una piattaforma web in cui gli utenti registrati possono avviare una nuova sfida partendo da una voce iniziale casuale (tramite API esterne, vedi Sez. 3) e cercando di raggiungere, nel minor numero possibile di passaggi, una **pagina obiettivo prefissata**.

* **Obiettivo del Gioco:** Il giocatore dovrà raggiungere la voce dedicata all'**Università degli Studi di Napoli Federico II** (o altra pagina a scelta dello studente), potendo avanzare **esclusivamente attraverso i link presenti nella voce corrente**.


* **Tracciamento:** Il sistema dovrà registrare:
* Il percorso effettuato (sequenza di pagine visitate).


* Il numero di passaggi / click.


* Il tempo impiegato.


* L'esito della partita.




* **Persistenza Stato (Server-Side):** È richiesto che lo stato di ogni partita sia **salvato in maniera persistente lato server**, consentendo all'utente di riprendere la partita su un dispositivo diverso da quello con cui l'ha iniziata.


* **Utenti Non Registrati (Ospiti):** Possono esplorare la raccolta delle partite concluse e visualizzarne i dettagli (pagina iniziale, sequenza di pagine visitate, numero di click, tempo totale).


* **Utenti Autenticati:** Possono avviare nuove sfide e comparire in una **classifica** basata su:
1. Minor numero di passaggi necessari per raggiungere la pagina obiettivo.


2. Numero di sfide completate con successo.





---

## 5. MODALITÀ DI CONSEGNA E OUTPUT ATTESI

È richiesta la consegna di un **singolo archivio ZIP** contenente:

1. **Documento PDF (max 1 pagina):** Indicare nome, cognome, matricola, traccia scelta (*RoadToUnina*) e tecnologie usate per back-end e front-end.


2. **Codice Sorgente:** Directory distinte e organizzate per `back-end` e `front-end`.


3. **File README:** Istruzioni dettagliate per l'esecuzione di front-end e back-end.



> ⚠️ **ATTENZIONE SULLE DIPENDENZE:** L'archivio **NON** deve includere le cartelle delle dipendenze (es. `node_modules`). Inserire solo i descrittori delle dipendenze (es. `package.json`). Si consiglia di usare `.gitignore` e fare un repository ZIP pulito.
> 
> 

### Procedura di invio tramite FileSender Unina

Servizio: [https://filesender.unina.it/](https://www.google.com/search?q=https://filesender.unina.it/)

* **Destinatario:** `luigiliberolucio.starace@unina.it`

* **Oggetto:** `[TECWEB] Consegna progetto 25/26 ${student.matricola} ${student.nome} ${student.cognome}`

* **Corpo del messaggio:** Indicare la traccia svolta (*RoadToUnina*).


* **Scadenza:** Impostare la data più lontana possibile (1 mese).


* **Nome file ZIP:** `${student.matricola}-${student.nome}-${student.cognome}.zip`


---

## 6. PRENOTAZIONE DELLA DISCUSSIONE

Dopo aver superato lo scritto e inviato il progetto, ci si potrà prenotare nelle sessioni comunicate tramite avviso su **WebDocenti**.

---

## 7. DISCUSSIONE DEL PROGETTO

* **Demo:** Lo studente mostrerà una demo dell'applicazione (consigliato l'uso del proprio laptop con dati di esempio già caricati).


* **Uso PC del docente:** In caso di mancanza di laptop proprio, avvisare il docente via mail. È consigliato in tal caso containerizzare back-end e front-end tramite **Docker**.


* **Svolgimento:** Domande tecniche sulle scelte architetturali, interazione diretta del docente con l'app e revisione del codice sorgente.



---

## 8. MODALITÀ DI VALUTAZIONE

La valutazione terrà conto di:

* Qualità dell'applicazione web e della discussione.


* Padronanza della terminologia tecnica ed esposizione autonoma.


* Capacità di argomentare le scelte di progetto.


* Eventuale uso di tecnologie/framework avanzati (non strettamente necessario per il 30L, ma tenuto in considerazione).



---

## 9. POLITICA ANTI-PLAGIO

Il progetto deve essere realizzato in piena autonomia. Se emergono elementi di plagio (progetti identici, incapacità di spiegare la struttura del codice o le tecnologie usate), il progetto **verrà annullato** e verrà assegnata una nuova traccia.

---

## 10. VALIDITÀ DEL PROGETTO

Il progetto è valido per l'A.A. 2025/2026, ovvero **fino al 31 marzo 2027**.