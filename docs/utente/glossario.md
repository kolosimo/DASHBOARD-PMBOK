# Glossario del Cruscotto commesse

Le parole e le sigle che si leggono nel Cruscotto, spiegate in italiano semplice.
Le sigle restano in inglese perché sono quelle usate in tutti i manuali di project
management; accanto trovi sempre il nome italiano che compare nelle schermate.

Tutti gli esempi usano i **dati di esempio** dell'app: la commessa **CL-2026-031
"Scuola primaria – impianti meccanici ed elettrici"**, alla data di giovedì
**24/09/2026** (settimana W39, dal 21 al 27/09/2026). I calcoli completi sono in
`docs/formule/formule.md` e `docs/formule/casi-di-prova.md`.

Due regole valgono per tutti gli indicatori:

- **"n.d." (non disponibile)** compare quando un indicatore non si può calcolare,
  di solito perché bisognerebbe dividere per zero (per esempio una commessa senza ore
  registrate). Non è un errore: significa che mancano i dati.
- **I colori dei semafori** (verde "in linea", giallo "attenzione", rosso "critico",
  grigio "n.d.") dipendono da soglie decise dall'amministratore. Oggi sono valori di
  esempio, da tarare con i PM durante il pilota.

Gli indicatori misurano **la commessa o il team, mai la singola persona**. Nel
Cruscotto non esistono classifiche né punteggi per persona.

---

## Pianificazione (Last Planner)

### Lookahead

**Cos'è.** La lista delle attività delle **prossime 6 settimane**, con lo stato dei
loro vincoli. Serve a preparare il lavoro in anticipo: un'attività entra nel piano
settimanale solo quando tutti i suoi vincoli sono stati rimossi (si dice che è
"pronta").

**Esempio.** Nel lookahead di CL-2026-031 c'è l'attività **L1 "MEC-PL-102 · Pianta P1
riscaldamento"**. Non è ancora pronta perché ha aperto il vincolo V-12 (manca il
layout arredi dall'architetto). Finché V-12 non è rimosso, L1 non va promessa nel
piano settimanale.

### Vincolo

**Cos'è.** Qualcosa che impedisce di iniziare o finire un'attività: un input che
deve arrivare da altri, un'approvazione, una persona disponibile, un criterio da
decidere. Ogni vincolo ha una descrizione, **chi lo rimuove**, la data entro cui
**serve** e uno stato: *da analizzare*, *aperto*, *rimosso* o *annullato*. Un vincolo
può bloccare più attività e un'attività può avere più vincoli.

**Esempio.** **V-13 "Planimetria architettonica rev. C"**: categoria "input da altri",
blocca l'attività L2 (schemi quadri elettrici), la deve procurare il PM, serve entro
il 29/09/2026. È aperto.

### Piano settimanale e impegni

**Cos'è.** All'inizio della settimana il team decide cosa **promette** di finire: ogni
riga del piano è un **impegno** preso da una persona (il "last planner") su un'attività
pronta. Il piano passa da *bozza* a *promesso* e, a fine settimana, a *chiuso*. Alla
chiusura ogni impegno si segna **fatto** o **non fatto**; per ogni "non fatto" si
sceglie una **causa** (per esempio "Input mancante da altri").

### PPC — Impegni mantenuti (Percent Plan Complete)

**Cos'è.** Quanti impegni della settimana sono stati mantenuti, sul totale di quelli
promessi. Misura **l'affidabilità del piano del team**, non la bravura delle singole
persone.

**Come si calcola.** PPC = impegni fatti ÷ impegni promessi.
- Gli impegni **aggiunti dopo la promessa** non contano (né sopra né sotto).
- Un impegno che a fine settimana nessuno ha segnato conta come **non fatto**.
- Se non c'erano impegni promessi il PPC è **n.d.**

**Esempio.** Nella settimana W39 il team ha promesso 7 impegni e ne ha fatti 5:
PPC = 5 ÷ 7 = 0,714 → **71%** (semaforo verde, soglia di esempio 70%). Se il giovedì
qualcuno aggiunge un ottavo impegno, il PPC resta 5 ÷ 7: l'aggiunta non era stata
promessa.

### Pareto delle cause

**Cos'è.** L'elenco delle cause dei "non fatto", dalla più frequente alla meno
frequente. Aiuta a capire cosa blocca davvero il team.

**Esempio.** Nelle settimane W31–W38 la causa più frequente è stata "Input mancante"
(9 volte), seguita da "Approvazione attesa" (5).

### PCR — Vincoli rimossi (Percent Constraints Removed)

**Cos'è.** Di tutti i vincoli che andavano rimossi **entro una certa settimana**, quanti
sono stati rimossi davvero in tempo. Dice se il lavoro di preparazione funziona.

**Come si calcola.** Per la settimana w:

PCR = vincoli rimossi entro la domenica di w ÷ vincoli **aperti il lunedì** di w che
**servono entro la domenica** di w.

- Contano solo i vincoli che il lunedì erano già noti e ancora aperti.
- Un vincolo annullato durante la settimana esce dal conto.
- Se nessun vincolo scade nella settimana il PCR è **n.d.**

**Esempio.** Settimana W40 (28/09–04/10/2026). Il lunedì 28/09 sono aperti, con
scadenza entro il 04/10, i vincoli V-12, V-13 e V-15 (V-17 non conta: era già stato
rimosso il 22/09). Il denominatore è 3. Se entro domenica si rimuove solo V-12:
PCR = 1 ÷ 3 = **0,33 (33%)**, semaforo rosso (soglia di esempio: verde da 80%, giallo
da 60%).
Nella settimana W39 invece nessun vincolo aperto scadeva entro il 27/09: PCR = **n.d.**

### TMR e TA — Attività rese pronte e Attività anticipate

Entrambi confrontano il piano di una settimana con il lookahead di **due settimane
prima** (l'app ne salva automaticamente una "fotografia" ogni settimana). Rispondono
alla domanda: "quello che avevamo previsto due settimane fa è poi entrato davvero nel
piano?".

- **TMR (Tasks Made Ready), "Attività rese pronte"**: delle attività previste due
  settimane prima per questa settimana, quante sono entrate nel piano.
  TMR = attività previste entrate nel piano ÷ attività previste.
- **TA (Tasks Anticipated), "Attività anticipate"**: degli impegni del piano, quanti
  riguardano attività già previste due settimane prima.
  TA = impegni su attività previste ÷ impegni del piano.
- Se manca la fotografia di due settimane prima, o il denominatore è zero, il valore
  è **n.d.**

**Esempio** (da `docs/formule/casi-di-prova.md`). Settimana del 28/09/2026: la
fotografia del lookahead scattata il 14/09 prevedeva per quella settimana le attività
L1, L2 e L5 (3 attività). Il piano contiene 5 impegni sulle attività L1, L2, L3 e X9.
- TMR: di L1, L2, L5 sono entrate nel piano L1 e L2 → 2 ÷ 3 = **0,67 (67%)**.
- TA: 2 impegni su 5 riguardano attività previste → 2 ÷ 5 = **0,40 (40%)**.

---

## Flusso degli elaborati (Kanban)

### Kanban

**Cos'è.** Una bacheca con quattro colonne — **Da fare**, **In corso**, **In verifica**,
**Emesso** — in cui ogni scheda è un elaborato. Ogni colonna raccoglie uno o più stati:

| Stato | Colonna | Peso EV |
|---|---|---|
| Non iniziato | Da fare | 0% |
| Impostato | In corso | 20% |
| Calcoli e dimensionamento | In corso | 50% |
| Emissione interna | In verifica | 70% |
| Verificato | In verifica | 85% |
| Emesso al cliente | Emesso | 100% |

Un elaborato avanza **di uno stato alla volta**; per tornare indietro serve scrivere
un motivo. Ogni cambio di stato cambia anche il valore guadagnato (EV, vedi sotto).

### WIP — Lavoro in corso (Work In Progress) e limite WIP

**Cos'è.** Il numero di elaborati presenti in una colonna. Il **limite WIP** è il
massimo consigliato: serve a non aprire troppi elaborati insieme e a finire prima
quelli già iniziati. I limiti di partenza sono **4 per "In corso"** e **3 per "In
verifica"** e il PM può cambiarli per la sua commessa. Superare il limite si può, ma
l'app chiede conferma e lo annota nel registro delle modifiche.

**Esempio.** In CL-2026-031 la colonna "In corso" contiene 5 elaborati (MEC-PL-101,
MEC-PL-102, MEC-PL-110, ELE-SC-201, IDR-PL-301) con limite 4: la colonna è
evidenziata come fuori limite. "In verifica" ne contiene 3 con limite 3: al limite,
ma non oltre.

### Work Item Age — Età nello stato

**Cos'è.** Da quanti **giorni di calendario** un elaborato è fermo nello stato attuale.
Si calcola solo per gli elaborati non ancora emessi. Oltre una soglia (di esempio
**10 giorni**) l'elaborato viene segnalato come "fermo".

**Esempio.** ELE-SC-201 "Schemi quadri elettrici" è nello stato "Calcoli e
dimensionamento" dal 09/09/2026. Al 24/09/2026 la sua età è **15 giorni**: supera i
10 giorni ed è segnalato.

### Altri termini del flusso

- **Cycle time (tempo di attraversamento)**: giorni tra l'inizio del lavoro su un
  elaborato e la sua emissione.
- **Throughput (elaborati emessi per settimana)**: quanti elaborati sono arrivati allo
  stato finale in una settimana.
- **CFD (diagramma di flusso cumulativo)**: grafico con il numero di elaborati in ogni
  colonna, giorno per giorno. Se una fascia si allarga, lì il lavoro si sta
  accumulando.

---

## Avanzamento e costi in ore (EVM)

L'**Earned Value Management (EVM)** confronta tre numeri espressi **in ore**: quanto
lavoro era previsto a oggi, quanto ne è stato prodotto e quante ore sono state spese.
Nel Cruscotto non si dichiara una percentuale di avanzamento "a occhio": il lavoro
prodotto si ricava dallo **stato** di ogni elaborato.

Numeri di esempio di CL-2026-031 al 24/09/2026:

| Sigla | Nome nell'app | Valore |
|---|---|---|
| BAC | Budget a completamento | 424 h |
| PV | Valore pianificato | 312 h |
| EV | Valore guadagnato | 242 h |
| AC | Ore registrate | 320 h |

### Baseline

**Cos'è.** La "fotografia" del piano approvato della commessa: budget di ogni elaborato,
date in cui ciascun elaborato dovrebbe raggiungere ogni stato, pesi degli stati e
valore pianificato (PV) settimana per settimana. Una volta approvata **non cambia più**:
se l'amministratore modifica i pesi, la baseline già approvata mantiene quelli
vecchi. Così la storia della commessa (la curva S) non viene riscritta.

**Esempio.** La baseline di CL-2026-031 prevede un PV cumulato di 312 h alla settimana
W39 e di 424 h (tutto il budget) alla W46.

### BAC — Budget a completamento

Le ore a budget di tutti gli elaborati. **Esempio:** 40 + 60 + 48 + 48 + 56 + 64 + 36 +
40 + 32 = **424 h**.

### PV — Valore pianificato

Le ore di lavoro che, secondo la baseline, dovevano essere prodotte alla data di oggi.
**Esempio:** **312 h** alla settimana W39.

### EV — Valore guadagnato

Le ore di lavoro effettivamente prodotte: per ogni elaborato, budget × peso dello
stato raggiunto. **Esempio:** MEC-RT-001 ha budget 40 h ed è in "Emissione interna"
(70%): vale 40 × 0,70 = 28 h. Sommando tutti gli elaborati si ottiene **242 h**.

### AC — Ore registrate (costo effettivo)

La somma delle ore registrate da tutti sulla commessa fino a oggi. **Esempio:** 291 h
delle settimane precedenti + 29 h della W39 = **320 h**.

### SPI — Indice di avanzamento (Schedule Performance Index)

**Cos'è.** Dice se il lavoro procede secondo i tempi previsti. SPI = EV ÷ PV.
- 1 = in linea con il piano; **sotto 1 = in ritardo**; sopra 1 = in anticipo.
- Se il PV è 0 (per esempio prima dell'inizio della baseline) lo SPI è **n.d.**

**Esempio:** 242 ÷ 312 = **0,78**. È stato prodotto il 78% del lavoro che era
previsto a oggi: semaforo rosso (soglia di esempio: verde da 0,95, giallo da 0,85).

### CPI — Indice di efficienza (Cost Performance Index)

**Cos'è.** Dice quante ore di lavoro prodotto si ottengono per ogni ora spesa.
CPI = EV ÷ AC.
- **Sotto 1 = servono più ore del previsto** per il lavoro fatto.
- Se nessuno ha ancora registrato ore (AC = 0) il CPI è **n.d.**

**Esempio:** 242 ÷ 320 = **0,76**. Per ogni ora spesa si producono circa 45 minuti di
lavoro a budget: semaforo rosso.

### EAC — Stima a completamento (Estimate At Completion)

**Cos'è.** Quante ore costerà **in totale** la commessa se l'efficienza resta quella di
oggi. EAC = BAC ÷ CPI. È **n.d.** se il CPI è n.d. o zero.

**Esempio:** 424 ÷ 0,756 ≈ **560,7 h**.

### ETC — Ore ancora necessarie (Estimate To Complete)

**Cos'è.** Quante ore servono **ancora** per finire, da oggi in poi. ETC = EAC − AC.
Attenzione a non confonderla con l'EAC: l'EAC è il totale, l'ETC è solo ciò che manca.

**Esempio:** 560,7 − 320 = **240,7 h**.

### VAC — Scarto a completamento (Variance At Completion)

**Cos'è.** La differenza tra il budget e la stima a completamento. VAC = BAC − EAC.
**Negativo = a fine commessa si sforerà il budget** di quelle ore.

**Esempio:** 424 − 560,7 = **−136,7 h**: con l'efficienza attuale si prevede di sforare
il budget di circa 137 ore.

### Curva S

Il grafico con tre linee cumulative nel tempo — PV, EV e AC — settimana per settimana.
Le settimane passate si leggono dalle fotografie salvate ogni settimana e **non si
ricalcolano**; solo la settimana in corso è calcolata al momento.

---

## Altre parole che si incontrano

- **Commessa**: il progetto per un cliente, con codice tipo CL-2026-031.
- **Elaborato**: un documento da produrre (tavola, relazione, calcolo), con codice
  tipo MEC-PL-101, disciplina, budget in ore e responsabile.
- **Disciplina**: MEC (impianti meccanici), ELE (elettrici), IDR (idrico-sanitari),
  ANT (antincendio).
- **Milestone**: una scadenza importante della commessa (per esempio "Esecutivo
  meccanico" il 30/10/2026).
- **Obeya**: la pagina unica della commessa per la riunione settimanale del team:
  tempi, costi, affidabilità del piano e ostacoli.
- **Portafoglio**: l'elenco delle commesse attive con i loro indicatori principali.
- **Settimana W39**: le settimane si numerano come nel calendario ISO e si indicano con
  la data del lunedì (W39 = settimana che inizia lunedì 21/09/2026).
- **Conflitto di modifica**: se due persone modificano lo stesso dato insieme, la
  seconda riceve un avviso e vede il valore aggiornato; deve ripetere la modifica.
