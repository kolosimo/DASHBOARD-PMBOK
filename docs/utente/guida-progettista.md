# Guida per il progettista

> **Versione per il pilota (Fase 2).** Descrive le schermate come sono nel codice
> attuale. Le sigle sono spiegate nel
> [glossario](glossario.md).

Questa guida vale per chi nel team di una commessa ha il ruolo di **progettista** o
**verificatore**. Chi è **osservatore** vede le stesse pagine ma non modifica nulla.

Nel Cruscotto il progettista fa tre cose:

1. **registra le proprie ore** ogni giorno o almeno ogni settimana;
2. **prende e chiude i propri impegni** nel piano settimanale;
3. **fa avanzare i propri elaborati** sul Kanban.

> Il Cruscotto non fa classifiche e non dà punteggi alle persone. Gli indicatori
> (PPC, SPI, CPI…) riguardano la commessa e il team.

## Entrare

1. Apri il Cruscotto dal browser (Edge o Chrome; sul Mac anche Safari).
2. **Nel pilota** accedi con **Email** e **Password** temporanea che ti ha dato
   l'amministratore; al primo accesso la pagina **Cambia password** chiede una password
   nuova di almeno 12 caratteri. Dopo il pilota si entrerà con **Accedi con
   Microsoft 365** (lo stesso account di Outlook e Teams).
3. Si apre **Le mie commesse**: le commesse di cui fai parte, con il tuo ruolo.
   Se una commessa manca, chiedi al PM di aggiungerti al team.

Per aprire il Cruscotto come un'app: in Edge menu **…** → **App** → **Installa questo
sito come app**; in Safari sul Mac **File** → **Aggiungi al Dock**.

## 1. Registrare le ore

Dalla voce **Le mie ore** in alto:

1. Si apre la **settimana corrente**; con le frecce vai alla settimana precedente o
   successiva. Sabato e domenica sono nascosti: **Mostra sabato e domenica** li
   aggiunge.
2. Ogni riga è un **elaborato**, ogni colonna un **giorno**. In cima ci sono gli
   elaborati di cui sei responsabile; gli altri elaborati delle tue commesse si aprono
   con **Mostra gli altri elaborati delle tue commesse**.
3. Scrivi le ore nella cella in decimali (`1,5` = un'ora e mezza) o come `1:30`: la
   cella **si salva da sola** quando esci dal campo. Per cancellare lascia la cella
   vuota. In fondo vedi il totale del giorno e della settimana e, per ogni elaborato,
   le **ore a oggi rispetto al budget**.

Regole:

- **Registri solo le tue ore.** Nessuno può registrarle al posto tuo, nemmeno il PM.
- Al massimo **12 ore al giorno** (valore di partenza, lo imposta l'amministratore).
- Puoi correggere una settimana fino a **7 giorni dopo la sua fine** (valore di
  partenza); la data limite è scritta sopra la griglia. Dopo, la settimana è bloccata:
  per una correzione rivolgiti all'**amministratore**, che la registra con il motivo.
- Le ore sono il **costo effettivo (AC)** della commessa: appena salvi, CPI e stima a
  completamento della commessa si aggiornano. Registrarle con puntualità rende i numeri
  affidabili per tutti.

Chi vede le tue ore: tu sempre; il PM della commessa, per organizzare il lavoro, anche
nel dettaglio per persona (impostazione attiva per decisione del 28/09/2026; prima
di iniziare ricevi l'informativa sul trattamento dei dati); la direzione **solo i
totali** per commessa.

## 2. Gli impegni della settimana (Last Planner)

**Lunedì**, nella riunione di team, ognuno dice cosa **promette** di finire in
settimana. Ogni promessa è un **impegno** nella scheda **Piano settimanale** della
commessa.

- Prometti solo attività **pronte**: senza vincoli aperti (niente input mancanti,
  approvazioni attese, ecc.). Se manca qualcosa, dillo al PM: diventa un **vincolo** nel
  registro, con chi lo deve rimuovere e entro quando.
- Prometti ciò che sei ragionevolmente sicuro di finire. È meglio promettere 4 e fare
  4 che promettere 7 e fare 5.

**Venerdì** nella scheda **Piano settimanale** segni i tuoi impegni:

- **Sì** se l'attività è finita davvero (non "quasi").
- **No**, scegliendo la **causa** nel menu che compare (i "5 perché" sono
  facoltativi): Input mancante da altri, Criteri o requisiti
  cambiati, Approvazione cliente/ente attesa, Risorsa non disponibile, Stima troppo
  ottimista, Errore o rilavorazione, Priorità cambiata dal PM, Altro.

La causa non serve a trovare un colpevole: serve al team per capire cosa blocca il
lavoro (Pareto delle cause) e rimuoverlo nelle settimane successive.

Esempio: in W39 il team ha promesso 7 impegni e ne ha fatti 5: PPC 71%.

## 3. Il Kanban degli elaborati

Nella scheda **Kanban** ogni scheda è un elaborato, con codice, titolo, responsabile,
**età nello stato** (giorni da cui è fermo nello stato attuale) e ore registrate sul
budget.

| Colonna | Stati | Limite WIP |
|---|---|---|
| Da fare | Non iniziato | — |
| In corso | Impostato, Calcoli e dimensionamento | 4 |
| In verifica | Emissione interna, Verificato | 3 |
| Emesso | Emesso al cliente | — |

Come si usa:

1. Quando fai un passo avanti su un tuo elaborato, **avanzalo di uno stato** con la
   freccia sulla scheda o trascinandola (per esempio da "Impostato" a "Calcoli e
   dimensionamento"). Non si saltano stati.
2. Per **tornare indietro** (per esempio dopo i commenti del verificatore) l'app ti
   chiede il **motivo**.
3. Se la colonna di arrivo è già al limite WIP, l'app ti chiede conferma. Prima di
   aprire un nuovo elaborato, prova ad aiutare a chiudere quelli già in corso.
4. Se un elaborato resta fermo nello stesso stato oltre 10 giorni (soglia di partenza)
   viene segnalato: di solito c'è un vincolo da far emergere.

Perché lo stato è importante: il **valore guadagnato (EV)** di un elaborato dipende solo
dal suo stato. Esempio: MEC-RT-001 (budget 40 h) in "Emissione interna" vale 70% →
28 h di lavoro prodotto. Se lo stato sul Kanban non è aggiornato, l'avanzamento della
commessa risulta più basso del vero.

## Se compare un avviso di conflitto

Se tu e un collega modificate la stessa cosa quasi insieme, chi salva per secondo vede
l'avviso "Qualcun altro ha modificato questo dato mentre lo stavi modificando" con il
valore aggiornato. Rileggi e, se serve, ripeti la modifica: nessun dato
viene perso di nascosto.

## Domande frequenti

- **Non trovo un elaborato nel timesheet.** Guarda tra "gli altri elaborati delle tue
  commesse"; se non c'è, chiedi al PM di aggiungerti al team della commessa.
- **Ho sbagliato le ore di due settimane fa.** Se la settimana è bloccata chiedi
  all'amministratore.
- **Ho dimenticato la password.** Chiedi all'amministratore di reimpostarla.
- **Cosa vuol dire "n.d."?** Che il valore non si può calcolare perché mancano i dati.
