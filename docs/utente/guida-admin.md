# Guida per l'amministratore

> **Versione per il pilota (Fase 2).** Descrive le schermate come sono nel codice
> attuale. Le sigle sono
> spiegate nel [glossario](glossario.md). Per l'organizzazione del pilota vedi il
> [piano del pilota](../pilota/piano-del-pilota.md).

L'amministratore configura il Cruscotto per tutto lo studio. Può vedere tutte le
commesse; sulle singole commesse lavora come un PM solo se serve. La voce
**Amministrazione** in alto compare solo agli amministratori; chi non lo è e apre
`/admin` riceve "accesso negato".

Ogni modifica fatta dall'amministratore finisce nel **registro di audit** (chi, quando,
valore prima e dopo). Se due amministratori modificano la stessa voce insieme, chi salva
per secondo vede un **avviso di conflitto** con il valore aggiornato e deve ripetere la
modifica.

La pagina **Amministrazione** ha un sottomenu: *Impostazioni e soglie*, *Commesse*,
*Utenti e ruoli*, *Discipline*, *Stati e pesi*, *Colonne Kanban e WIP*, *Cause di non
completamento*.

## 0. Preparare il pilota

Il pilota parte **vuoto**: nessuna commessa, solo configurazione e utenti.

1. **Configurazione.** Controlla le sezioni 2–5 di questa guida: stati e pesi, colonne
   e limiti WIP, cause, discipline, impostazioni. I valori di partenza sono quelli
   confermati al Gate 0; non serve cambiarli prima di iniziare.
2. **Utenti.** Crea gli account locali dei 2 PM (ruolo **pm**) e delle persone dei loro
   team (ruolo **progettista**); vedi la sezione 1.
3. **Commesse.** In *Commesse* apri le commesse del pilota: codice, nome, cliente,
   **PM**, inizio e fine prevista → **Crea commessa**. Il PM indicato entra nel team
   con ruolo "pm" e da lì completa lui team, milestone ed elaborati.
4. **Server.** Il server deve restare acceso anche di notte: ogni giorno alle 06:10
   l'app scatta le fotografie settimanali di Last Planner ed EVM. Se il server era
   spento, le recupera al giro successivo.
5. Consegna ai partecipanti l'**informativa** (sezione 5, "Ore per persona").

## 1. Utenti e ruoli

### Come nasce un utente

**Nel pilota: account locali.**

- Il **primo amministratore** lo crea l'IT sul server:
  `node ace utenti:crea-admin --email nome.cognome@climosfera.it --nome "Nome Cognome"`
  (lo script di installazione lo chiede). Il comando mostra una password temporanea.
- Gli altri utenti li crea l'amministratore da **Amministrazione → Utenti e ruoli**:
  **Email**, **Nome e cognome**, **Ruolo** (per i PM del pilota: `pm`), poi
  **Crea utente**. L'app genera una **password temporanea** e la mostra **una sola
  volta**: copiala e consegnala di persona o per telefono.
- Al primo accesso l'utente deve sceglierne una nuova (almeno 12 caratteri). Dopo,
  può cambiarla da **Cambia password** in alto a destra.
- Se un utente dimentica la password, nella sua riga di **Utenti e ruoli** si genera
  una nuova password temporanea; dopo troppi tentativi sbagliati l'account si blocca
  per qualche minuto e si può **sbloccare** dalla stessa riga. Nessuno può leggere le
  password salvate.
- Gli utenti con ruolo globale **pm** aprono da soli le proprie commesse
  (**Nuova commessa** in *Le mie commesse*).

**Con Microsoft 365 (dopo il pilota)**: l'utente **nasce al primo accesso**.

- Al primo accesso l'utente viene creato con ruolo **progettista**.
- Gli indirizzi email elencati nell'impostazione del server `ADMIN_EMAILS` diventano
  **amministratori** al loro accesso (servono almeno per i primi amministratori; chi è
  già admin non viene mai retrocesso da questa lista). La lista si modifica nel file di
  configurazione del server (vedi la guida di installazione).
- Un utente **disattivato** non può più entrare, ma le sue ore e il suo storico restano.
  Non si cancellano utenti: si disattivano.

### Ruoli globali

| Ruolo | A cosa serve |
|---|---|
| **admin** | configura l'app, vede tutte le commesse |
| **direzione** | vede tutte le commesse, **solo i totali per commessa**; mai ore per persona |
| **pm** | può essere PM di commessa; vede solo le commesse di cui fa parte |
| **progettista** | registra le proprie ore, prende impegni, avanza i propri elaborati |

### Ruoli di commessa

Dentro ogni commessa, il team ha un ruolo proprio (lo assegna il PM o l'admin
nell'anagrafica della commessa): **pm**, **progettista**, **verificatore**,
**osservatore** (solo lettura). Il ruolo globale "pm" da solo non dà diritti sulle
commesse di altri: contano il PM indicato nella commessa e il ruolo di commessa.

### Cambiare ruolo o disattivare

Da **Amministrazione → Utenti e ruoli**: per ogni utente scegli il **ruolo globale**,
spunta o togli **attivo** e premi **Salva**. Non puoi togliere a te stesso il ruolo di
amministratore. Il ruolo dentro una commessa si decide nel team della commessa
(scheda Anagrafica).

## 2. Stati degli elaborati e pesi

Da **Amministrazione → Stati e pesi** si cambiano, per ogni stato, il **nome**, il
**peso EV** e la **colonna Kanban**, con **Salva** sulla riga. Gli stati non si
aggiungono né si tolgono.

Gli stati di un elaborato e il loro **peso** determinano il valore guadagnato (EV).
Valori confermati al Gate 0 (28/09/2026) come punto di partenza:

| Ordine | Stato | Peso EV (cumulativo) | Colonna Kanban |
|---|---|---|---|
| 0 | Non iniziato | 0% | Da fare |
| 1 | Impostato | 20% | In corso |
| 2 | Calcoli e dimensionamento | 50% | In corso |
| 3 | Emissione interna | 70% | In verifica |
| 4 | Verificato | 85% | In verifica |
| 5 | Emesso al cliente | 100% | Emesso |

Cose da sapere prima di cambiarli:

- I pesi sono **cumulativi**: un elaborato "Verificato" vale l'85% del suo budget, non
  il 15%.
- Salendo di stato **non possono diminuire**: l'app rifiuta un peso minore di quello
  dello stato precedente o maggiore di quello del successivo. Il primo stato vale 0% e
  l'ultimo 100%.
- Ogni baseline approvata **congela** i pesi in vigore quel giorno: cambiare i pesi
  vale solo per le baseline approvate dopo. La storia delle commesse non cambia.
- Esempio dell'effetto: un elaborato da 40 h in "Emissione interna" vale 28 h di EV con
  peso 70%; con peso 60% varrebbe 24 h.

## 3. Colonne del Kanban e limiti WIP

Da **Amministrazione → Colonne Kanban e WIP**. Colonne di partenza: **Da fare**, **In corso** (limite WIP 4), **In verifica** (limite
WIP 3), **Emesso**. L'amministratore imposta i limiti di partenza; il PM li può
cambiare per la sua commessa.

## 4. Cause di mancato completamento e discipline

Da **Amministrazione → Cause di non completamento** e **→ Discipline** si aggiungono
voci nuove (codice e nome) e si modificano quelle esistenti. Una voce non più usata
si **disattiva**: resta sugli elaborati e nello storico, ma non si può più scegliere.

Le 8 cause tra cui si sceglie per ogni impegno "non fatto": Input mancante da altri,
Criteri o requisiti cambiati, Approvazione cliente/ente attesa, Risorsa non disponibile,
Stima troppo ottimista, Errore o rilavorazione, Priorità cambiata dal PM, Altro.
Discipline: MEC, ELE, IDR, ANT. Meglio non rinominare una causa già usata cambiandone il
significato: i Pareto delle settimane passate diventerebbero fuorvianti.

## 5. Impostazioni e soglie dei semafori

Questa parte **esiste già**: **Amministrazione → Impostazioni**.

Ogni riquadro mostra la descrizione, il nome tecnico, la versione e l'etichetta
**"valore di esempio"** finché nessuno lo ha modificato. Si cambia il valore e si preme
**Salva**; dopo il salvataggio compare "Impostazione salvata".

| Impostazione | Valore di partenza | Effetto |
|---|---|---|
| Semaforo SPI | verde da 0,95, giallo da 0,85 | colore di SPI in tutte le pagine |
| Semaforo CPI | verde da 0,95, giallo da 0,85 | colore di CPI |
| Semaforo PPC | verde da 0,70, giallo da 0,55 | colore del PPC (si scrive come rapporto: 0,70 = 70%) |
| Semaforo PCR | verde da 0,80, giallo da 0,60 | colore del PCR (rapporto) |
| Minuti massimi al giorno | 720 (12 h) | ore massime registrabili da una persona in un giorno |
| Giorni per modificare le ore | 7 | dopo quanti giorni dalla fine della settimana le ore si bloccano |
| Ore per persona visibili al PM | attivo | il PM vede le ore per persona della sua commessa |
| Giorni elaborato fermo | 10 | oltre questa età nello stato l'elaborato è segnalato |
| Settimane di lookahead | 6 | settimane mostrate nel lookahead |
| Giorni di preavviso vincoli | 7 | quanto prima avvisare dei vincoli in scadenza |

Come si leggono le soglie: un valore **uguale o sopra "verde da"** è verde; uguale o
sopra "giallo da" è giallo; sotto è rosso. Un valore non calcolabile è sempre grigio
"n.d.". Esempio: con le soglie di partenza uno SPI di 0,78 è rosso; se si
abbassasse "giallo da" a 0,75 diventerebbe giallo. Le soglie valgono per tutte le
pagine (portafoglio, commessa, EVM, piano settimanale): non ci sono soglie diverse da
una pagina all'altra.

Scrivi i numeri **sempre con la virgola** (0,95). **Non usare il punto**: il punto
viene letto come separatore delle migliaia, quindi "0.95" diventerebbe 95.
Un valore non valido (per esempio una lettera, o una soglia fuori dall'intervallo
0–2) viene rifiutato con il messaggio "Valore non valido: controlla i numeri
inseriti.". Se "verde da" è più basso di "giallo da" l'app rifiuta il salvataggio con
"La soglia del verde deve essere uguale o maggiore di quella del giallo.".

Durante il pilota annota con i PM i casi in cui un colore non corrisponde alla
situazione reale: a fine pilota si confermano o si correggono le soglie.

### Ore per persona: attenzione

L'impostazione "ore per persona visibili al PM" è **attiva** per decisione dell'utente
al Gate 0 (28/09/2026). I partecipanti al pilota ricevono l'informativa **prima di
iniziare**; **prima di estendere il Cruscotto oltre il pilota** serve anche la verifica
con il consulente del lavoro (art. 4 Statuto dei lavoratori, decisione D4). Se la
verifica non è chiusa, si può disattivare l'impostazione finché non lo è.
Anche con l'impostazione attiva:

- la direzione non vede **mai** le ore per persona;
- nessuna pagina mostra classifiche o indicatori di rendimento per persona.

## 6. Correzione delle ore

La voce **Correzione ore** in alto (solo amministratori) apre il timesheet di una
persona anche nelle settimane già bloccate. Ogni correzione chiede il **motivo** e
finisce nel registro di audit. Se la settimana ha già la sua fotografia EVM, la riga
dello storico viene segnata come rettificata.

## 7. Registro di audit

Si consulta da **Amministrazione → Registro attività** (`/admin/registro`), con filtri
per periodo (**dal**, **al**), utente ed entità e con la paginazione.

Ogni modifica (impostazioni, stati, vincoli, piani, ore, baseline, sforamenti WIP) viene
registrata con autore, data e valori prima e dopo. Il registro non si può modificare né
cancellare.
