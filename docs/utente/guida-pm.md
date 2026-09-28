# Guida per il PM (bozza)

> **Bozza di Fase 1.** Descrive come funzionerà il Cruscotto secondo il piano e il
> prototipo. Le parti segnate **[DA AGGIORNARE]** riguardano schermate che oggi sono
> ancora un segnaposto ("in costruzione"): verranno riscritte con le schermate vere
> quando i moduli saranno pronti.
> Le sigle sono spiegate nel [glossario](glossario.md).

## Cosa fa il PM nel Cruscotto

Il PM della commessa (indicato come PM nell'anagrafica o nel team con ruolo "pm"):

- prepara e aggiorna il **lookahead** e il **registro vincoli**;
- guida il **piano settimanale** con il team e lo chiude a fine settimana;
- tiene d'occhio il **Kanban** degli elaborati e i limiti WIP;
- legge l'**avanzamento in ore (EVM)** e prepara la riunione con la pagina **Commessa**
  (Obeya);
- vede le ore registrate sulla commessa, **anche per persona** (impostazione attiva
  per decisione del 28/09/2026; prima dell'avvio in produzione serve l'informativa ai
  dipendenti).

Il ruolo "PM" da solo non dà diritti sulle commesse di altri PM: si hanno i permessi
di PM solo sulle commesse di cui si è PM.

> **Cosa il Cruscotto non fa, per scelta.** Non mostra classifiche né punteggi per
> persona. Il PPC misura l'affidabilità del piano del team, non la bravura dei singoli.
> Le ore per persona servono a organizzare il lavoro, non a valutare le persone.

## Entrare e trovare la commessa

1. Apri il Cruscotto dal browser (Edge o Chrome; sul Mac anche Safari) e premi
   **Accedi con Microsoft 365**.
2. Si apre **Le mie commesse**: l'elenco delle commesse di cui fai parte, con il tuo
   ruolo, il numero di elaborati e la prossima milestone.
3. Clicca sul **codice** della commessa (per esempio CL-2026-031). In alto compaiono le
   schede: *Commessa*, *Piano settimanale*, *Lookahead e vincoli*, *Kanban*, *Ore*,
   *Avanzamento EVM*, *Anagrafica*.

## La settimana tipo

| Quando | Cosa | Scheda |
|---|---|---|
| Lunedì mattina | Riunione di team: stato della commessa, avvisi, vincoli in scadenza | Commessa (Obeya) |
| Lunedì | Si prepara e si **promette** il piano della settimana | Piano settimanale |
| Durante la settimana | Si rimuovono i vincoli; gli elaborati avanzano sul Kanban; ognuno registra le ore | Lookahead e vincoli, Kanban, Ore |
| Venerdì | Si segna fatto / non fatto e si **chiude** il piano | Piano settimanale |
| Venerdì | Si aggiorna il lookahead delle prossime 6 settimane | Lookahead e vincoli |
| Quando serve | Si legge l'avanzamento in ore e si decide se intervenire | Avanzamento EVM |

### 1. Lookahead e vincoli

**[DA AGGIORNARE]** — schermata in costruzione (agente A2, Fase 1).

Nella scheda **Lookahead e vincoli** trovi:

- la tabella delle attività delle **prossime 6 settimane** (una colonna per settimana)
  con lo stato di ciascuna: pronta oppure bloccata da vincoli;
- il **registro vincoli**: codice, descrizione, categoria, attività bloccate, chi lo
  rimuove, data entro cui serve, stato;
- il **PCR** della settimana (vincoli rimossi in tempo).

Cosa fare:

1. Per ogni attività delle prossime settimane chiediti: "cosa manca per poterla fare?".
   Ogni risposta è un **vincolo**: registralo con chi lo deve rimuovere e **entro
   quando** serve.
2. Un vincolo può bloccare più attività: collegalo a tutte.
3. Quando l'ostacolo è risolto segna il vincolo come **rimosso**; se non serve più,
   **annullato** (esce dal conteggio del PCR).
4. Un'attività diventa **pronta** quando tutti i suoi vincoli sono rimossi: solo allora
   può entrare nel piano settimanale.

Esempio con i dati di esempio: V-12 "Layout arredi P1 dall'architetto" blocca L1
(pianta P1 riscaldamento) e serve entro il 29/09/2026. Se lo rimuovi entro domenica
04/10, conta come rimosso in tempo nel PCR della settimana W40.

Ogni settimana l'app salva da sola una "fotografia" del lookahead: due settimane dopo
serve a calcolare **TMR** e **TA** (quanto di ciò che era previsto è davvero entrato nel
piano). Non devi fare nulla.

### 2. Piano settimanale (lunedì)

**[DA AGGIORNARE]** — schermata in costruzione (agente A2, Fase 1).

1. Apri **Piano settimanale**: il piano nuovo è in stato **bozza**.
2. Con il team inserisci gli **impegni**: attività (solo quelle pronte), elaborato,
   persona che si impegna (il "last planner").
3. Quando tutti sono d'accordo premi **Prometti**. Da quel momento il piano è
   **promesso**: gli impegni aggiunti dopo sono segnati come "aggiunti dopo la
   promessa" e **non contano** nel PPC.

Regola d'oro: si promette solo ciò che si è ragionevolmente sicuri di finire. Un PPC
alto con impegni onesti vale più di tanti impegni non mantenuti.

### 3. Chiusura della settimana (venerdì)

**[DA AGGIORNARE]** — schermata in costruzione (agente A2, Fase 1).

1. Per ogni impegno si segna **fatto** o **non fatto**. Ciascuno può segnare i propri
   impegni; il PM può segnarli tutti.
2. Per ogni "non fatto" la **causa è obbligatoria** (per esempio "Input mancante da
   altri", "Approvazione cliente/ente attesa", "Stima troppo ottimista"). Per i casi
   importanti si può compilare anche l'analisi dei "5 perché".
3. Premi **Chiudi il piano**. Gli impegni non segnati contano come non fatti.
4. Il **PPC** si aggiorna subito. Il **Pareto delle cause** mostra quali cause tornano
   più spesso: sono il punto da cui partire per migliorare.

Esempio: in W39 sono stati fatti 5 impegni su 7 promessi → PPC 71%.

### 4. Kanban degli elaborati

**[DA AGGIORNARE]** — schermata in costruzione (agente A3, Fase 1).

- Ogni scheda è un elaborato; le colonne sono **Da fare**, **In corso** (limite 4),
  **In verifica** (limite 3), **Emesso**.
- Un elaborato **avanza di uno stato alla volta** (Non iniziato → Impostato → Calcoli e
  dimensionamento → Emissione interna → Verificato → Emesso al cliente). Per tornare
  indietro serve scrivere il motivo.
- Se una colonna supera il limite WIP, l'app chiede conferma e registra lo sforamento.
  Meglio finire un elaborato in corso che aprirne uno nuovo.
- Su ogni scheda c'è l'**età nello stato** (Work Item Age). Oltre 10 giorni (soglia di
  esempio) l'elaborato è segnalato come fermo: chiedi al responsabile cosa lo blocca.
- In basso trovi throughput (elaborati emessi a settimana), cycle time e il diagramma
  di flusso cumulativo (CFD).

Come PM puoi cambiare i limiti WIP della tua commessa.

### 5. Leggere l'avanzamento in ore (EVM)

**[DA AGGIORNARE]** — schermata in costruzione (agente A5, Fase 1).

La scheda **Avanzamento EVM** mostra, in ore:

| Riquadro | Domanda a cui risponde | CL-2026-031 al 24/09/2026 |
|---|---|---|
| BAC | Quante ore ha a budget la commessa? | 424 h |
| PV | Quanto lavoro doveva essere fatto a oggi? | 312 h |
| EV | Quanto lavoro è stato fatto davvero? | 242 h |
| AC | Quante ore abbiamo speso? | 320 h |
| SPI | Siamo nei tempi? (EV ÷ PV) | 0,78 — in ritardo |
| CPI | Siamo efficienti? (EV ÷ AC) | 0,76 — servono più ore del previsto |
| Stima a completamento (EAC) | Quante ore costerà in totale? | 560,7 h |
| Ore ancora necessarie (ETC) | Quante ore servono ancora da oggi? | 240,7 h |
| Scarto a completamento (VAC) | Di quanto sforeremo il budget? | −136,7 h |

Come leggerla, in tre passi:

1. **Guarda SPI e CPI e il loro semaforo.** Verde da 0,95, giallo da 0,85, sotto è
   rosso (soglie di esempio). Se vedi **n.d.** mancano i dati: per esempio nessuno ha
   ancora registrato ore (CPI) o la baseline non è ancora iniziata (SPI).
2. **Guarda la curva S.** Se la linea EV sta sotto la PV sei in ritardo; se la linea AC
   sta sopra la EV stai spendendo più ore del lavoro prodotto.
3. **Scendi al registro elaborati** per capire dove nasce lo scarto: l'EV di ogni
   elaborato dipende solo dal suo **stato** (budget × peso), non da una percentuale
   dichiarata.

Nell'esempio: SPI 0,78 e CPI 0,76 → la commessa è in ritardo e sta consumando più
ore del previsto. Il budget di 424 h verrà probabilmente superato di circa 137 h se
non cambia nulla.

#### La baseline

**[DA AGGIORNARE]** — editor della baseline in costruzione (agente A5, Fase 1).

Prima di leggere SPI e PV serve una **baseline approvata**: budget degli elaborati, date
previste per ogni stato e pesi. Quando la approvi, l'app congela i pesi e il valore
pianificato di ogni settimana: da quel momento la storia non cambia più, anche se
l'amministratore modifica i pesi. Una nuova baseline si approva solo per varianti
concordate.

### 6. La pagina Commessa (Obeya) per la riunione

**[DA AGGIORNARE]** — pagina in costruzione (agente B1, Fase 2).

La scheda **Commessa** riunisce in una vista: SPI, CPI, stima a completamento, PPC della
settimana, vincoli aperti, milestone, curva S, andamento del PPC e l'elenco **Da
affrontare in riunione** generato dai dati, per esempio:

- "SPI 0,78: in ritardo di 70 h di lavoro rispetto al piano";
- "Vincolo V-13 da rimuovere entro il 29/09";
- "Kanban: 5 elaborati in corso con limite WIP 4";
- "ELE-SC-201 fermo nello stesso stato da 15 giorni".

### 7. Ore della commessa

**[DA AGGIORNARE]** — schermata in costruzione (agente A4, Fase 1).

Nella scheda **Ore** vedi i totali per elaborato e per settimana e, con l'impostazione
attiva, anche il dettaglio per persona della tua commessa. Non ci sono classifiche.
Le ore le registra ognuno per sé (vedi la [guida per il progettista](guida-progettista.md)):
il PM non può registrare ore al posto di altri.

### 8. Anagrafica della commessa

**[DA AGGIORNARE]** — schermata in costruzione (agente A1, Fase 1).

Dati della commessa, team con ruoli (pm, progettista, verificatore, osservatore),
milestone ed elaborati con budget in ore. Gli elaborati si potranno importare da Excel
(copia e incolla).

## Se due persone modificano la stessa cosa

Se tu e un collega modificate lo stesso dato quasi insieme, chi salva per secondo vede
un **avviso di conflitto** con il valore aggiornato: rileggi e, se serve, ripeti la tua
modifica. Nessun dato viene sovrascritto di nascosto. Ogni modifica finisce nel
registro di audit.

## Domande frequenti

- **Perché vedo "n.d."?** L'indicatore non si può calcolare: mancano i dati (vedi il
  [glossario](glossario.md)).
- **Chi decide le soglie dei colori?** L'amministratore; oggi sono di esempio e si
  tareranno con i PM durante il pilota.
- **Posso cambiare il peso di uno stato solo per la mia commessa?** No: i pesi sono
  unici per lo studio e li gestisce l'amministratore; ogni baseline congela quelli in
  vigore al momento dell'approvazione.
