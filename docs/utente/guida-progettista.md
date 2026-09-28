# Guida per il progettista (bozza)

> **Bozza di Fase 1.** Le parti segnate **[DA AGGIORNARE]** riguardano schermate che oggi
> sono ancora un segnaposto ("in costruzione") e verranno riscritte con le schermate
> vere. Le sigle sono spiegate nel [glossario](glossario.md).

Questa guida vale per chi nel team di una commessa ha il ruolo di **progettista** o
**verificatore**. Chi è **osservatore** vede le stesse pagine ma non modifica nulla.

Nel Cruscotto il progettista fa tre cose:

1. **registra le proprie ore** ogni giorno o almeno ogni settimana;
2. **prende e chiude i propri impegni** nel piano settimanale;
3. **fa avanzare i propri elaborati** sul Kanban.

> Il Cruscotto non fa classifiche e non dà punteggi alle persone. Gli indicatori
> (PPC, SPI, CPI…) riguardano la commessa e il team.

## Entrare

1. Apri il Cruscotto dal browser e premi **Accedi con Microsoft 365** (lo stesso
   account di Outlook e Teams).
2. Si apre **Le mie commesse**: le commesse di cui fai parte, con il tuo ruolo.
   Se una commessa manca, chiedi al PM di aggiungerti al team.

## 1. Registrare le ore

**[DA AGGIORNARE]** — schermata in costruzione (agente A4, Fase 1).

Dalla voce **Le mie ore** in alto:

1. Si apre la **settimana corrente** (da lunedì a domenica).
2. Ogni riga è un **elaborato** su cui lavori; ogni colonna è un **giorno**.
3. Scrivi le ore nella cella (per esempio `3` oppure `2,5`) e salva. In fondo vedi il
   totale del giorno e della settimana e, per ogni elaborato, le ore a oggi rispetto al
   budget.

Regole:

- **Registri solo le tue ore.** Nessuno può registrarle al posto tuo, nemmeno il PM.
- Al massimo **12 ore al giorno** (valore di esempio impostato dall'amministratore).
- Puoi correggere una settimana fino a **7 giorni dopo la sua fine** (valore di
  esempio); dopo la settimana è bloccata. Per correzioni tardive chiedi al PM.
- Le ore sono il **costo effettivo (AC)** della commessa: appena salvi, CPI e stima a
  completamento della commessa si aggiornano. Registrarle con puntualità rende i numeri
  affidabili per tutti.

Chi vede le tue ore: tu sempre; il PM della commessa, per organizzare il lavoro, anche
nel dettaglio per persona (impostazione attiva per decisione del 28/09/2026; prima
dell'avvio in produzione riceverai l'informativa); la direzione **solo i totali** per
commessa.

## 2. Gli impegni della settimana (Last Planner)

**[DA AGGIORNARE]** — schermata in costruzione (agente A2, Fase 1).

**Lunedì**, nella riunione di team, ognuno dice cosa **promette** di finire in
settimana. Ogni promessa è un **impegno** nella scheda **Piano settimanale** della
commessa.

- Prometti solo attività **pronte**: senza vincoli aperti (niente input mancanti,
  approvazioni attese, ecc.). Se manca qualcosa, dillo al PM: diventa un **vincolo** nel
  registro, con chi lo deve rimuovere e entro quando.
- Prometti ciò che sei ragionevolmente sicuro di finire. È meglio promettere 4 e fare
  4 che promettere 7 e fare 5.

**Venerdì** segni i tuoi impegni:

- **Fatto** se l'attività è finita davvero (non "quasi").
- **Non fatto**, scegliendo la **causa**: Input mancante da altri, Criteri o requisiti
  cambiati, Approvazione cliente/ente attesa, Risorsa non disponibile, Stima troppo
  ottimista, Errore o rilavorazione, Priorità cambiata dal PM, Altro.

La causa non serve a trovare un colpevole: serve al team per capire cosa blocca il
lavoro (Pareto delle cause) e rimuoverlo nelle settimane successive.

Esempio: in W39 il team ha promesso 7 impegni e ne ha fatti 5: PPC 71%.

## 3. Il Kanban degli elaborati

**[DA AGGIORNARE]** — schermata in costruzione (agente A3, Fase 1).

Nella scheda **Kanban** ogni scheda è un elaborato, con codice, titolo, responsabile e
**età nello stato** (giorni da cui è fermo nello stato attuale).

| Colonna | Stati | Limite WIP |
|---|---|---|
| Da fare | Non iniziato | — |
| In corso | Impostato, Calcoli e dimensionamento | 4 |
| In verifica | Emissione interna, Verificato | 3 |
| Emesso | Emesso al cliente | — |

Come si usa:

1. Quando fai un passo avanti su un tuo elaborato, **avanzalo di uno stato** (per
   esempio da "Impostato" a "Calcoli e dimensionamento"). Non si saltano stati.
2. Per **tornare indietro** (per esempio dopo i commenti del verificatore) devi scrivere
   il **motivo**.
3. Se la colonna di arrivo è già al limite WIP, l'app ti chiede conferma. Prima di
   aprire un nuovo elaborato, prova ad aiutare a chiudere quelli già in corso.
4. Se un elaborato resta fermo nello stesso stato oltre 10 giorni (soglia di esempio)
   viene segnalato: di solito c'è un vincolo da far emergere.

Perché lo stato è importante: il **valore guadagnato (EV)** di un elaborato dipende solo
dal suo stato. Esempio: MEC-RT-001 (budget 40 h) in "Emissione interna" vale 70% →
28 h di lavoro prodotto. Se lo stato sul Kanban non è aggiornato, l'avanzamento della
commessa risulta più basso del vero.

## Se compare un avviso di conflitto

Se tu e un collega modificate la stessa cosa quasi insieme, chi salva per secondo vede
un avviso con il valore aggiornato. Rileggi e, se serve, ripeti la modifica: nessun dato
viene perso di nascosto.

## Domande frequenti

- **Non trovo un elaborato nel timesheet.** Chiedi al PM di assegnartelo o di
  aggiungerti al team della commessa.
- **Ho sbagliato le ore di due settimane fa.** Se la settimana è bloccata chiedi al PM.
- **Cosa vuol dire "n.d."?** Che il valore non si può calcolare perché mancano i dati.
