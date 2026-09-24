# Formule

Fonte: `docs/sviluppo/piano.md` (sezione "Formule"). Le firme sono in `app/domain/*.ts`;
i casi di prova completi li scrive T1 in `docs/formule/casi-di-prova.md` e
`tests/unit/domain/`. Le voci marcate **DA CONFERMARE AL GATE 0** attendono l'OK dell'utente.

Convenzioni: valori in **minuti interi**; indici come decimali; `null` → "n.d." nell'interfaccia.

## Pesi degli stati (EV) — DA CONFERMARE AL GATE 0

Pesi **cumulativi** di esempio, congelati nella baseline al momento dell'approvazione:

| Ordine | Stato | Peso EV | Colonna Kanban |
|---|---|---|---|
| 0 | Non iniziato | 0% | Da fare |
| 1 | Impostato | 20% | In corso (WIP 4) |
| 2 | Calcoli e dimensionamento | 50% | In corso |
| 3 | Emissione interna | 70% | In verifica (WIP 3) |
| 4 | Verificato | 85% | In verifica |
| 5 | Emesso al cliente | 100% | Emesso |

## EVM in ore

| Grandezza | Formula | Se non calcolabile |
|---|---|---|
| BAC | Σ budget degli elaborati | — |
| EV | Σ budget × peso dello stato attuale / 100 (pesi della baseline) | — |
| PV | PV cumulato congelato nella baseline per la settimana (`baseline_pv_settimana`) = Σ budget × peso dello stato pianificato alla data | — |
| AC | Σ minuti registrati fino alla data di stato | — |
| SPI | EV / PV | **null se PV = 0** |
| CPI | EV / AC | **null se AC = 0** (con EV = 0 e AC > 0 vale 0) |
| EAC "Stima a completamento" | BAC / CPI | null se CPI è null o 0 |
| ETC "Ore ancora necessarie" | EAC − AC | null se EAC è null |
| VAC "Scarto a completamento" | BAC − EAC | null se EAC è null |

Arrotondamento: EV e PV al minuto sulla somma; EAC al minuto.
La curva S storica si legge da `snapshot_evm` e **non si ricalcola**; solo la settimana
corrente è calcolata al momento.

### Caso calcolato a mano: CL-2026-031 al 24/09/2026 (dati di esempio)

| Elaborato | Budget h | Stato attuale (peso) | EV h | Stato pianificato (peso) | PV h |
|---|---|---|---|---|---|
| MEC-RT-001 | 40 | Emissione interna (70%) | 28,0 | Verificato (85%) | 34,0 |
| MEC-CA-002 | 60 | Emesso (100%) | 60,0 | Emesso (100%) | 60,0 |
| MEC-PL-101 | 48 | Calcoli (50%) | 24,0 | Verificato (85%) | 40,8 |
| MEC-PL-102 | 48 | Impostato (20%) | 9,6 | Emissione interna (70%) | 33,6 |
| MEC-PL-110 | 56 | Calcoli (50%) | 28,0 | Emissione interna (70%) | 39,2 |
| ELE-SC-201 | 64 | Calcoli (50%) | 32,0 | Calcoli (50%) | 32,0 |
| ELE-PL-210 | 36 | Emissione interna (70%) | 25,2 | Emissione interna (70%) | 25,2 |
| IDR-PL-301 | 40 | Impostato (20%) | 8,0 | Calcoli (50%) | 20,0 |
| ANT-RT-401 | 32 | Verificato (85%) | 27,2 | Verificato (85%) | 27,2 |
| **Totale** | **424** | | **242,0** | | **312,0** |

AC = 320 h (291 h di storico + 29 h della settimana W39). In minuti: BAC 25.440,
PV 18.720, EV 14.520, AC 19.200.

- SPI = 14.520 / 18.720 = **0,7756**
- CPI = 14.520 / 19.200 = **0,75625**
- EAC = 25.440 / 0,75625 = 33.639,67 → **33.640 min (560,7 h)**
- ETC = 33.640 − 19.200 = **14.440 min (240,7 h)**
- VAC = 25.440 − 33.640 = **−8.200 min (−136,7 h)**

Divisione per zero: commessa senza ore (AC = 0) → CPI, EAC, ETC, VAC = n.d.;
settimana prima dell'inizio della baseline (PV = 0) → SPI = n.d.

## Last Planner

**PPC** = impegni fatti / impegni promessi, **esclusi** gli impegni aggiunti dopo la promessa
(`aggiunto_dopo_promessa = true`) sia al numeratore sia al denominatore; un impegno non
segnato conta come non fatto; null se non ci sono impegni promessi.
Esempio W39 (dati di esempio): 5 fatti su 7 promessi → **0,714 (71%)**. Se si aggiunge un
ottavo impegno dopo la promessa, il PPC resta 5/7.

**PCR(w)** — **DA CONFERMARE AL GATE 0**

    PCR(w) = vincoli rimossi entro la fine di w
             / vincoli aperti al lunedì di w con data necessaria entro la domenica di w

- aperti al lunedì: identificati entro il lunedì e non rimossi né annullati prima;
- il numeratore conta solo i vincoli del denominatore; gli annullati durante w escono dal conteggio;
- null se il denominatore è 0.

Esempio (dati di esempio): W39 (21–27/09): nessun vincolo aperto scade entro il 27/09 →
PCR = n.d. W40 (28/09–04/10): aperti al 28/09 con scadenza entro il 04/10 sono V-12, V-13,
V-15 (V-17 è stato rimosso il 22/09, prima del lunedì) → denominatore 3; se entro il 04/10
si rimuove solo V-12 → PCR = 1/3 = 0,33.
Nota: il prototipo calcolava "rimossi / identificati" su tutto il registro; questa è la
definizione corretta per settimana.

**TMR / TA** (da `snapshot_lookahead` scattato a **w − 2**)

- Anticipate(w) = attività dello snapshot di w−2 che cadono in w;
- TA(w) = impegni del piano di w collegati ad attività anticipate / impegni del piano di w;
- TMR(w) = attività anticipate entrate nel piano di w / attività anticipate;
- null se il denominatore è 0 o manca lo snapshot di w−2.

**Pareto delle cause**: conteggio degli impegni non fatti per causa, in ordine decrescente.
Dati di esempio W31–W38: Input mancante 9, Approvazione attesa 5, Risorsa non disponibile 4,
Stima troppo ottimista 4, Criteri cambiati 3, Errore o rilavorazione 2, Priorità cambiata 2,
Altro 1 (W39 aggiunge 1 "Input mancante" e 1 "Risorsa non disponibile").

## Flusso (Kanban)

- Si avanza di **uno** stato alla volta; per tornare indietro serve un motivo.
- Superare il limite WIP di una colonna va confermato e finisce nell'audit.
- **Work Item Age** = giorni di calendario (Europe/Rome) da `stato_dal` a oggi; solo per gli
  elaborati non emessi. Esempio: ELE-SC-201 nello stato "Calcoli" dal 09/09/2026 → al
  24/09/2026 età **15 giorni** (oltre la soglia di esempio di 10 → segnalato).
- **Cycle time** = giorni tra l'uscita dallo stato iniziale e l'arrivo allo stato finale.
- **Throughput(w)** = elaborati distinti arrivati allo stato finale nella settimana w.
- **CFD** = numero di elaborati per colonna a fine giornata, ricostruito da `transizioni_elaborato`.

## Semafori (soglie di esempio, tabella `impostazioni`) — DA CONFERMARE AL GATE 0

| Indice | Verde | Giallo | Rosso |
|---|---|---|---|
| SPI, CPI | ≥ 0,95 | ≥ 0,85 | < 0,85 |
| PPC | ≥ 70% | ≥ 55% | < 55% |
| PCR | ≥ 80% | ≥ 60% | < 60% |

Valore null → semaforo grigio "n.d.".
