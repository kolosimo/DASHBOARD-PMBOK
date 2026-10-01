# Guida per il PM

> **Versione per il pilota (Fase 2).** Descrive le schermate come sono nel codice
> attuale: se vedi qualcosa di diverso, annotalo nel
> [modulo di feedback del pilota](../pilota/piano-del-pilota.md#6-modulo-di-feedback).
> Per partire in fretta: [guida rapida per il PM](../pilota/guida-rapida-pm.md).
> Le sigle sono spiegate nel [glossario](glossario.md).

## Cosa fa il PM nel Cruscotto

Il PM della commessa (indicato come PM nei dati della commessa o nel team con ruolo
"pm"):

- completa l'**anagrafica**: date, team, milestone, elaborati;
- prepara e approva la **baseline** dell'EVM;
- prepara e aggiorna il **lookahead** e il **registro vincoli**;
- guida il **piano settimanale** con il team e lo chiude a fine settimana;
- tiene d'occhio il **Kanban** degli elaborati e i limiti WIP;
- legge l'**avanzamento in ore (EVM)** e prepara la riunione con la pagina **Commessa**
  (Obeya);
- vede le ore registrate sulla commessa, **anche per persona** (impostazione attiva
  per decisione del 28/09/2026; prima dell'estensione oltre il pilota servono
  l'informativa ai dipendenti e la verifica art. 4).

Il ruolo "PM" da solo non dà diritti sulle commesse di altri PM: si hanno i permessi
di PM solo sulle commesse di cui si è PM. Una commessa nuova la apre il **PM** stesso
(pulsante **Nuova commessa** in *Le mie commesse*: ne diventa il PM) oppure
l'**amministratore**, indicando il PM; da lì in poi la completa il PM.

> **Cosa il Cruscotto non fa, per scelta.** Non mostra classifiche né punteggi per
> persona. Il PPC misura l'affidabilità del piano del team, non la bravura dei singoli.
> Le ore per persona servono a organizzare il lavoro, non a valutare le persone.

## Entrare e trovare la commessa

1. Apri il Cruscotto dal browser (Edge o Chrome; sul Mac anche Safari).
2. **Nel pilota** accedi con **Email** e **Password** che ti ha dato
   l'amministratore; al primo accesso la pagina **Cambia password** chiede una password
   nuova di almeno 12 caratteri (**Salva la nuova password**). Per cambiarla in seguito
   c'è **Cambia password** in alto a destra. Dopo il pilota si potrà entrare con
   **Accedi con Microsoft 365** (lo stesso account di Outlook e Teams).
3. Si apre **Le mie commesse**: l'elenco delle commesse di cui fai parte, con il tuo
   ruolo, il numero di elaborati e la prossima milestone. All'inizio del pilota
   l'elenco è **vuoto**: apri la tua commessa con **Nuova commessa** (codice, nome,
   cliente, date) e premi **Crea commessa**; si apre la scheda *Anagrafica*.
4. Clicca sul **codice** della commessa. In alto compaiono le schede: *Commessa*,
   *Piano settimanale*, *Lookahead e vincoli*, *Kanban*, *Ore*, *Avanzamento EVM*,
   *Anagrafica*.

Per aprire il Cruscotto come un'app (dalla barra delle applicazioni o dal Dock) vedi
la [guida rapida](../pilota/guida-rapida-pm.md#2-installare-lapp-facoltativo-consigliato).

## La settimana tipo

| Quando | Cosa | Scheda |
|---|---|---|
| Lunedì mattina | Riunione di team: stato della commessa, avvisi, vincoli in scadenza | Commessa (Obeya) |
| Lunedì | Si prepara e si **promette** il piano della settimana | Piano settimanale |
| Durante la settimana | Si rimuovono i vincoli; gli elaborati avanzano sul Kanban; ognuno registra le ore | Lookahead e vincoli, Kanban, Le mie ore |
| Venerdì | Si segna sì / no su ogni impegno e si **chiude** il piano | Piano settimanale |
| Venerdì | Si aggiorna il lookahead delle prossime settimane | Lookahead e vincoli |
| Quando serve | Si legge l'avanzamento in ore e si decide se intervenire | Avanzamento EVM |

## 1. Anagrafica della commessa (all'avvio)

Scheda **Anagrafica**. Ogni riquadro ha il suo pulsante di salvataggio e si aggiorna
senza ricaricare la pagina.

**Dati della commessa.** Codice, nome, cliente, PM, stato (attiva, sospesa, chiusa),
**Inizio**, **Fine prevista**, note. Inizio e fine servono alla baseline: compilali
subito.

**Team.** In fondo al riquadro scegli la persona in **Aggiungi persona**, il
**Ruolo** e premi **Aggiungi**. Ruoli: **pm**, **progettista**, **verificatore**,
**osservatore** (solo lettura). Il ruolo si cambia con **Salva ruolo**, la persona si
toglie con **Togli**. Nell'elenco compaiono solo le persone che hanno già un
account: se ne manca una, chiedila all'amministratore. Se il team supera il numero
consigliato per la riunione, l'app lo segnala: valuta sottogruppi per disciplina.

**Milestone.** Titolo, data target, data effettiva, contrattuale sì/no, ordine.

**Elaborati.** Due modi:
- **Importa da Excel**: copia da Excel quattro colonne (**codice, titolo, disciplina,
  budget in ore**) e incollale; va bene anche un CSV con il punto e virgola. Una riga
  d'intestazione viene ignorata; la disciplina si scrive con il codice (MEC) o il
  nome; il budget accetta la virgola (12,5). Premi **Anteprima**: se anche una sola
  riga ha errori non si importa nulla, correggi il testo e rifai l'anteprima. Poi
  **Importa**. Gli elaborati importati partono dal primo stato con classe di servizio
  standard.
- **Nuovo elaborato**: codice, titolo, disciplina, budget, classe di servizio
  (standard, data fissa, urgente, intangibile), data fissa, responsabile, milestone.

Dopo l'import apri ogni elaborato (clic sul codice) per assegnare **responsabile** e
**milestone**. Lo **stato** non si cambia qui: si cambia dal Kanban.

**Limiti WIP.** Nell'ultimo riquadro puoi cambiare i limiti delle colonne per la tua
commessa (i valori di partenza li decide l'amministratore).

## 2. La baseline

Prima di leggere SPI e PV serve una **baseline approvata**: budget degli elaborati,
date previste per ogni stato e pesi.

1. Scheda **Avanzamento EVM** → **Prepara la baseline** → **Crea la bozza con date
   automatiche**. Le date di ogni stato si distribuiscono tra inizio e fine prevista
   della commessa.
2. Per ogni elaborato correggi le date che non tornano. **Distribuisci tra inizio e
   fine** riempie gli stati intermedi in modo uniforme tra la prima e l'ultima data;
   poi premi **Salva** sulla riga. Le date devono essere in ordine.
3. Se un elaborato è stato aggiunto dopo la creazione della bozza compare "senza
   date": usa **Aggiungi con date automatiche**.
4. Premi **Approva e congela** e conferma. Da quel momento pesi, budget, BAC e valore
   pianificato di ogni settimana non cambiano più, anche se l'amministratore modifica
   i pesi.
5. Per una variante concordata premi **Nuova baseline**: il **motivo** è
   obbligatorio; la bozza parte dalle date della baseline attiva, che resta valida
   finché non approvi la nuova. **Scarta la bozza** la elimina.

Avvisi che puoi vedere nella pagina EVM:
- **fuori baseline**: elaborato aggiunto dopo l'approvazione; le sue ore entrano in
  AC ma non ha valore pianificato né guadagnato. Serve una nuova baseline.
- **budget cambiato**: il budget attuale è diverso da quello della baseline; l'EVM
  usa quello della baseline.

## 3. Lookahead e vincoli

Nella scheda **Lookahead e vincoli** trovi:

- la tabella delle attività delle **prossime 6 settimane** (una colonna per
  settimana) con lo stato di ciascuna: **pronta** oppure **vincolata**; con **Precedente**,
  **Successiva** e **Da oggi** ti sposti nelle settimane;
- il **registro vincoli**: ID, vincolo, categoria, attività bloccate, chi lo rimuove,
  serve entro, identificato il, stato; filtro **aperti** / **tutti**.

Cosa fare:

1. **Nuova attività**: codice, titolo, tipo (attività o milestone), last planner,
   disciplina, elaborato (facoltativo), **dalla settimana** / **alla settimana**.
2. Per ogni attività chiediti: "cosa manca per poterla fare?". Ogni risposta è un
   **vincolo**: **Nuovo vincolo** con descrizione, categoria, stato (da analizzare o
   aperto), chi lo rimuove (del team, oppure un esterno come "Architetto"), **serve
   entro** e le **attività bloccate**. Il codice V-n si assegna da solo.
3. Un vincolo può bloccare più attività: spuntale tutte.
4. Quando l'ostacolo è risolto premi **Segna rimosso**; se non serve più,
   **Annulla** (esce dal conteggio del PCR); per ripensarci, **Riapri**.
5. Un'attività diventa **pronta** quando nessun vincolo collegato è aperto o da
   analizzare: solo allora conviene prometterla nel piano settimanale.

Ogni lunedì mattina l'app salva da sola una "fotografia" del lookahead: due settimane
dopo serve a calcolare **TMR** e **TA**. Non devi fare nulla; nelle prime due
settimane di una commessa questi indicatori sono **n.d.**

## 4. Piano settimanale (lunedì)

1. Apri **Piano settimanale** e premi **Prepara il piano (bozza)**.
2. Con il team aggiungi gli **impegni**: attività del lookahead (quelle vincolate sono
   indicate tra parentesi), testo dell'impegno (vuoto = titolo dell'attività),
   elaborato, **last planner** e, se volete, i **punti** → **Aggiungi impegno**. In
   bozza un impegno si può eliminare e i suoi punti si possono cambiare dalla colonna
   **Punti**.
3. Quando tutti sono d'accordo premi **Prometti il piano**. Da quel momento gli
   impegni non si eliminano più e quelli aggiunti dopo sono marcati "aggiunto dopo la
   promessa · fuori dal PPC".

In alto trovi PPC, PCR, TMR, TA e vincoli aperti della settimana. Con **Precedente** e
**Successiva** vedi le altre settimane.

Regola d'oro: si promette solo ciò che si è ragionevolmente sicuri di finire. Un PPC
alto con impegni onesti vale più di tanti impegni non mantenuti.

### Punti degli impegni (facoltativi)

I punti dicono quanto è "grande" un impegno rispetto agli altri: **1, 2, 3, 5, 8 o
13**. Si decidono insieme in riunione; "?" vuol dire non stimato.

- Un impegno che sembra più grande di 13 va **diviso** in impegni più piccoli.
- Il riquadro **Punti promessi** mostra i punti del piano, quelli fatti e la
  **capacità indicativa**: la media dei punti fatti nelle ultime 4 settimane chiuse
  con i punti. Finché non ci sono 4 settimane così, la capacità è **n.d.**
- Se i punti promessi superano la capacità compare **oltre la capacità**: è un
  invito a togliere qualcosa, non un blocco.
- Dopo la promessa i punti non si cambiano più.
- I punti **non sono ore**: non entrano nell'EVM, nella curva S né nel portafoglio,
  e non si sommano per persona. Il PPC resta il conteggio degli impegni.

Esempio (dati di esempio, W39): promessi 24 punti, capacità indicativa 23,8 →
"oltre la capacità".

## 5. Chiusura della settimana (venerdì)

1. Per ogni impegno si segna **Sì** (fatto) o **No**. Ciascuno può segnare i propri
   impegni; il PM può segnarli tutti.
2. Per ogni **No** la **causa è obbligatoria** (per esempio "Input mancante da
   altri", "Approvazione cliente/ente attesa", "Stima troppo ottimista"). Per i casi
   importanti c'è l'**Analisi dei 5 perché** (facoltativa).
3. Premi **Chiudi il piano**: serve un sì o un no su ogni impegno e la causa per ogni
   no, altrimenti l'app non chiude.
4. Il **PPC** si aggiorna subito. Il grafico **PPC nelle ultime settimane** e il
   **Pareto delle cause** mostrano l'andamento e le cause che tornano più spesso: la
   prima causa è il primo punto da affrontare nella riunione.

Esempio: 5 impegni fatti su 7 promessi → PPC 71%.

## 6. Kanban degli elaborati

- Ogni scheda è un elaborato; le colonne di partenza sono **Da fare**, **In corso**
  (limite 4), **In verifica** (limite 3), **Emesso**.
- Un elaborato **avanza di uno stato alla volta** (Non iniziato → Impostato → Calcoli
  e dimensionamento → Emissione interna → Verificato → Emesso al cliente) con i
  pulsanti **Avanti** e **Indietro** sulla scheda o trascinandola. Per tornare indietro l'app chiede il
  **motivo**.
- Se la colonna di arrivo supera il limite WIP, l'app chiede conferma e registra lo
  sforamento. Meglio finire un elaborato in corso che aprirne uno nuovo.
- Su ogni scheda ci sono l'**età nello stato** e le ore registrate sul budget. Oltre
  la soglia impostata (10 giorni) l'elaborato è segnalato come fermo: chiedi al
  responsabile cosa lo blocca.
- In basso trovi throughput (elaborati emessi a settimana), cycle time e il diagramma
  di flusso cumulativo (CFD).

Possono spostare le schede il PM, i progettisti e i verificatori della commessa;
osservatori e direzione vedono la board in sola lettura.

## 7. Leggere l'avanzamento in ore (EVM)

La scheda **Avanzamento EVM** mostra, in ore (valori di esempio dei dati
dimostrativi):

| Riquadro | Domanda a cui risponde | Esempio |
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

1. **Guarda SPI e CPI e il loro semaforo** (quadratino colorato con la parola). Verde da 0,95, giallo da 0,85, sotto è
   rosso (soglie di partenza, da tarare nel pilota). Se vedi **n.d.** mancano i dati:
   per esempio nessuno ha ancora registrato ore (CPI) o non c'è una baseline
   approvata (SPI).
2. **Guarda la curva S.** Se la linea EV sta sotto la PV sei in ritardo; se la linea
   AC sta sopra la EV stai spendendo più ore del lavoro prodotto.
3. **Scendi al registro per elaborato** per capire dove nasce lo scarto: l'EV di ogni
   elaborato dipende solo dal suo **stato** (budget × peso), non da una percentuale
   dichiarata.

Lo **storico settimanale** mostra i valori congelati a fine settimana: una settimana
viene fissata solo quando scade il termine per correggere le ore (7 giorni dopo la
sua fine). Se qualcuno corregge ore dopo, la riga è segnata come rettificata.

## 8. La pagina Commessa (Obeya) per la riunione

Su una commessa appena aperta la pagina elenca i **passi mancanti** (elaborati,
milestone, baseline, primo piano, prime ore) con il link alla scheda dove farli.

La scheda **Commessa** riunisce in una vista: SPI, CPI, stima a completamento, PPC
della settimana, vincoli aperti, milestone, curva S, andamento del PPC e l'elenco
**Da affrontare in riunione** generato dai dati, per esempio:

- "SPI 0,78: in ritardo rispetto al piano";
- "Vincolo V-13 da rimuovere entro il 29/09";
- "Kanban: 5 elaborati in corso con limite WIP 4";
- "Elaborato fermo nello stesso stato da 15 giorni".

## 9. Ore della commessa

Nella scheda **Ore** scegli la settimana e vedi: ore nella settimana, ore cumulate
(AC) e budget, poi le **ore per elaborato** (settimana, a fine settimana, budget,
budget residuo) e, con l'impostazione attiva, le **ore per persona** della tua
commessa. Non ci sono classifiche.

Le ore le registra ognuno per sé da **Le mie ore** (vedi la
[guida per il progettista](guida-progettista.md)): il PM non può registrare ore al
posto di altri. Le correzioni su settimane già bloccate le fa l'amministratore.

## Se due persone modificano la stessa cosa

Se tu e un collega modificate lo stesso dato quasi insieme, chi salva per secondo vede
l'avviso "Qualcun altro ha modificato questo dato mentre lo stavi modificando" con la
versione aggiornata: rileggi e, se serve, ripeti la tua modifica. Nessun dato viene
sovrascritto di nascosto. Ogni modifica finisce nel registro di audit.

## Domande frequenti

- **Perché vedo "n.d."?** L'indicatore non si può calcolare: mancano i dati (vedi il
  [glossario](glossario.md)).
- **Non trovo una persona da aggiungere al team.** Non ha ancora un account: nel
  pilota gli account li crea l'amministratore.
- **Posso aprire io una commessa nuova?** Sì: in *Le mie commesse* premi **Nuova
  commessa** e ne diventi il PM. Può aprirla anche l'amministratore indicandoti come PM.
- **Chi decide le soglie dei colori?** L'amministratore; quelle di partenza si
  tareranno con i PM durante il pilota.
- **Posso cambiare il peso di uno stato solo per la mia commessa?** No: i pesi sono
  unici per lo studio e li gestisce l'amministratore; ogni baseline congela quelli in
  vigore al momento dell'approvazione.
