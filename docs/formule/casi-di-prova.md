# Casi di prova delle formule

Autore: verificatore T1. Ogni caso è calcolato a mano e ha un test corrispondente in
`tests/unit/domain/` (il nome del test è indicato tra parentesi). Formule: `formule.md`;
firme: `app/domain/{evm,lps,flusso,avvisi}.ts`.

Convenzioni: minuti interi (1 h = 60 min); indici decimali; `null` = "n.d.";
settimane indicate dal lunedì (Europe/Rome); W40 2026 = 28/09–04/10.

## 1. EVM (`evm.spec.ts`)

### 1.1 Pesi cumulativi

Elaborato con budget 600 min (10 h), EV = 600 × peso / 100.

| Ordine | Stato | Peso | EV atteso |
|---|---|---|---|
| 0 | Non iniziato | 0% | 0 |
| 1 | Impostato | 20% | 120 |
| 2 | Calcoli e dimensionamento | 50% | 300 |
| 3 | Emissione interna | 70% | 420 |
| 4 | Verificato | 85% | 510 |
| 5 | Emesso al cliente | 100% | 600 |

### 1.2 BAC, EV, PV, AC

| Caso | Input | Calcolo | Atteso |
|---|---|---|---|
| EV e PV da pesi diversi | budget 1000, peso attuale 20, pianificato 70 | EV = 1000 × 0,20; PV = 1000 × 0,70 | EV 200, PV 700 |
| Arrotondamento sulla somma | 3 elaborati da 1 min al 20% | 0,2 + 0,2 + 0,2 = 0,6 → 1 (per riga: 0 + 0 + 0 = 0) | EV 1, PV 1 |
| Arrotondamento al più vicino | budget 7, attuale 85%, pianificato 20% | 5,95 → 6; 1,4 → 1 | EV 6, PV 1 |
| AC su non iniziati | AC 90 + 45, pesi attuali 0, pianificati 0 e 20 su 600 | AC = 135; EV = 0; PV = 120 | 135 / 0 / 120 |
| Limite: nessun elaborato | `[]` | somme vuote | BAC = EV = PV = AC = 0 |

### 1.3 SPI e CPI

| Caso | Input | Calcolo | Atteso |
|---|---|---|---|
| SPI normale | EV 2400, PV 3000 | 2400 / 3000 | 0,8 |
| SPI > 1 | EV 3300, PV 3000 | 3300 / 3000 | 1,1 |
| SPI con EV = 0 | EV 0, PV 600 | 0 / 600 | 0 |
| **SPI divisione per zero** | PV = 0 (EV 0 o 120) | divisore 0 | **null** |
| CPI normale | EV 2400, AC 3000 / EV 3000, AC 2400 | | 0,8 / 1,25 |
| CPI con EV = 0 | EV 0, AC 600 | 0 / 600 | 0 |
| **CPI divisione per zero** | AC = 0 (EV 0 o 600) | divisore 0 | **null** |

### 1.4 Indicatori derivati (EAC = BAC / CPI arrotondato, ETC = EAC − AC, VAC = BAC − EAC)

| Caso | BAC | PV | EV | AC | Calcolo | SPI | CPI | EAC | ETC | VAC |
|---|---|---|---|---|---|---|---|---|---|---|
| Normale | 6000 | 3000 | 2400 | 3000 | 6000 / 0,8 | 0,8 | 0,8 | 7500 | 4500 | −1500 |
| Efficiente | 6000 | 3000 | 3000 | 2400 | 6000 / 1,25 | 1 | 1,25 | 4800 | 2400 | 1200 |
| Arrotondamento EAC | 1000 | 500 | 300 | 700 | CPI = 0,428571…; 1000 / CPI = 2333,33 → 2333 | 0,6 | 0,4286 | 2333 | 1633 | −1333 |
| AC = 0 | 6000 | 600 | 300 | 0 | CPI null → EAC null | 0,5 | null | null | null | null |
| EV = 0, AC > 0 | 6000 | 600 | 0 | 240 | CPI = 0 → EAC null (niente BAC / 0) | 0 | 0 | null | null | null |
| PV = 0 | 6000 | 0 | 600 | 600 | SPI null; 6000 / 1 | null | 1 | 6000 | 5400 | 0 |
| Tutto a zero | 0 | 0 | 0 | 0 | tutti i divisori 0 | null | null | null | null | null |

ETC e VAC si calcolano dall'EAC **già arrotondato** (così EAC = AC + ETC e BAC = EAC + VAC
tornano esatti in minuti).

### 1.5 CL-2026-031 al 24/09/2026 (dati di esempio)

| Elaborato | Budget min | Peso attuale | EV min | Peso pianificato | PV min |
|---|---|---|---|---|---|
| MEC-RT-001 | 2400 | 70 | 1680 | 85 | 2040 |
| MEC-CA-002 | 3600 | 100 | 3600 | 100 | 3600 |
| MEC-PL-101 | 2880 | 50 | 1440 | 85 | 2448 |
| MEC-PL-102 | 2880 | 20 | 576 | 70 | 2016 |
| MEC-PL-110 | 3360 | 50 | 1680 | 70 | 2352 |
| ELE-SC-201 | 3840 | 50 | 1920 | 50 | 1920 |
| ELE-PL-210 | 2160 | 70 | 1512 | 70 | 1512 |
| IDR-PL-301 | 2400 | 20 | 480 | 50 | 1200 |
| ANT-RT-401 | 1920 | 85 | 1632 | 85 | 1632 |
| **Totale** | **25.440** (424 h) | | **14.520** (242 h) | | **18.720** (312 h) |

AC = 19.200 min (320 h). Nel test la ripartizione di AC per elaborato è di comodo
(2400, 3900, 2700, 1500, 2700, 2700, 1500, 900, 900): conta solo il totale.

- SPI = 14.520 / 18.720 = 121 / 156 = **0,775641…**
- CPI = 14.520 / 19.200 = **0,75625**
- EAC = 25.440 / 0,75625 = 33.639,67 → **33.640** (560,7 h)
- ETC = 33.640 − 19.200 = **14.440** (240,7 h)
- VAC = 25.440 − 33.640 = **−8.200** (−136,7 h)

`evmDaElaborati` sugli elaborati dà gli stessi valori; su due elaborati (1000 min 50%/70%,
AC 800; 500 min 20%/50%, AC 200) coincide con `calcolaIndicatori({BAC 1500, PV 950, EV 600, AC 1000})`.

## 2. Last Planner (`lps.spec.ts`)

### 2.1 PPC = fatti / promessi (esclusi gli aggiunti dopo la promessa)

| Caso | Impegni | Calcolo | promessi / fatti / PPC |
|---|---|---|---|
| W39 dati di esempio | 5 fatti, 2 non fatti | 5 / 7 | 7 / 5 / **0,714** |
| + 1 aggiunto dopo la promessa (fatto, non fatto o non segnato) | come sopra + 1 aggiunto | escluso da entrambi | 7 / 5 / 0,714 |
| Non segnato | fatto, null, non fatto, fatto | null = non fatto: 2 / 4 | 4 / 2 / 0,5 |
| Tutti fatti / nessuno | 2 fatti / non fatto + null | 2/2; 0/2 | 1 / **0** (non null) |
| **Nessun promesso** | `[]` | divisore 0 | 0 / 0 / **null** |
| **Solo aggiunti dopo** | 2 aggiunti | divisore 0 | 0 / 0 / **null** |

### 2.2 PCR(w) = rimossi entro la domenica di w / aperti al lunedì di w con data necessaria ≤ domenica di w

Regole applicate (JSDoc di `calcolaPcr`): identificato ≤ lunedì; non rimosso prima del lunedì
(rimosso il lunedì stesso = ancora aperto al lunedì); annullato prima o durante w → escluso;
data necessaria null → escluso (nessuna scadenza); un vincolo già scaduto ma ancora aperto
al lunedì conta (data ≤ domenica).

| Caso | w | Vincoli | Denominatore | Numeratore | PCR |
|---|---|---|---|---|---|
| Dati di esempio, V-12 rimosso l'01/10 | 28/09 | V-12, V-13, V-15 (29/09) sì; V-14 (06/10), V-16 (13/10) scadono dopo; V-17 rimosso il 22/09 | 3 | 1 | **1/3** |
| Dati di esempio senza rimozioni | 28/09 | come sopra | 3 | 0 | 0 |
| **W39 dati di esempio** | 21/09 | nessuna scadenza ≤ 27/09 | 0 | 0 | **null** |
| **Nessun vincolo** | 28/09 | — | 0 | 0 | **null** |
| Confini data necessaria | 28/09 | 04/10 (domenica) sì; 05/10 no; null no | 1 | 0 | 0 |
| Scaduto e ancora aperto | 28/09 | necessario 20/09 aperto; necessario 30/09 rimosso 30/09 | 2 | 1 | 0,5 |
| Identificazione | 28/09 | identificato 28/09 sì; identificato 29/09 (poi rimosso) no | 1 | 0 | 0 |
| Da analizzare | 28/09 | stato `da_analizzare`, necessario 01/10 | 1 | 0 | 0 |
| Date di rimozione | 28/09 | rimosso 27/09 escluso; 28/09 e 04/10 rimossi; 05/10 non rimosso entro w | 3 | 2 | 2/3 |
| Annullati | 28/09 | annullato 25/09 e 30/09 esclusi; annullato 06/10 resta (non rimosso); rimosso 02/10 | 2 | 1 | 0,5 |
| **Tutti annullati durante w** | 28/09 | annullato 29/09 | 0 | 0 | **null** |
| W53 → 2027 | 28/12/2026 | domenica 03/01/2027: necessario 02/01 rimosso 03/01 sì; 03/01 sì; 04/01 no | 2 | 1 | 0,5 |
| Ora solare | 19/10/2026 | necessario 25/10 (domenica di 25 h) rimosso 25/10 sì; 26/10 no | 1 | 1 | 1 |

### 2.3 TMR / TA (snapshot del lookahead di w − 2)

Anticipata(w) ⇔ settimanaInizio ≤ w ≤ settimanaFine. w = 28/09, snapshot di W38 (14/09):
L1 (21/09–28/09) sì, L2 (28/09–12/10) sì, L3 (05/10–12/10) no, L4 (14/09–21/09) no,
L5 (14/09–05/10) sì → Anticipate = {L1, L2, L5} = 3.

| Caso | Attività nel piano | Impegni | TMR | TA |
|---|---|---|---|---|
| Normale | L1, L2, L3, X9 | 5 | L1, L2 → **2/3** | 2 impegni su anticipate / 5 = **0,4** |
| Tutto anticipato | L1, L2, L5 | 3 | 1 | 1 |
| Niente anticipato nel piano | L3, L4 | 2 | 0 | 0 |
| **Snapshot w−2 mancante** | L1, L2 | 2 | **null** | **null** |
| **Piano vuoto** | — | 0 | 0 | **null** |
| **Nessuna anticipata** (snapshot solo L3, L4) | L3 | 2 | **null** | 0 |
| Cambio d'anno: w = W1 2027 (04/01), snapshot W52 2026 | A1 (28/12–04/01) sì, A2 (28/12) no, A3 (04/01–11/01) sì; piano A1, A2 | 4 | 1/2 | 1/4 |

### 2.4 Pareto delle cause

Dati di esempio W31–W38 (cause con ordine 1…8, passate in ordine sparso):
Input mancante 9, Approvazione attesa 5, **Risorsa non disponibile 4 (ordine 4) prima di
Stima troppo ottimista 4 (ordine 5)**, Criteri cambiati 3, **Errore o rilavorazione 2
(ordine 6) prima di Priorità cambiata 2 (ordine 7)**, Altro 1. Gli impegni fatti non contano.

| Caso | Input | Atteso |
|---|---|---|
| Solo `fatto = false` | risorsa ×2 non fatti, criteri ×1 non fatto, input mancante su un non segnato e su un fatto | [risorsa 2, criteri 1] |
| Nessun non fatto | `[]` o fatti/non segnati | `[]` |

## 3. Flusso (`flusso.spec.ts`)

Giorni = differenza tra le **date di calendario di Roma**, non ore / 24.

### 3.1 Work Item Age

| Caso | statoDal | adesso | Atteso |
|---|---|---|---|
| ELE-SC-201 | 09/09 08:00 CEST | 24/09 17:00 CEST | **15** |
| Stesso giorno | 24/09 08:00 | 24/09 23:59 | 0 |
| Mezzanotte | 09/09 23:30 | 10/09 00:10 | 1 |
| UTC → Roma | 27/09 22:30 Z (= 28/09 00:30) | 28/09 10:00 CEST | 0 |
| UTC → Roma | 09/09 06:00 Z | 24/09 21:30 Z (= 23:30 Roma) | 15 |
| Ora legale (29/03, 23 h) | 28/03 23:00 CET | 29/03 23:30 CEST | 1 (23,5 h trascorse) |
| Ora solare (25/10, 25 h) | 25/10 00:10 CEST | 26/10 00:05 CET | 1 (24 h 55 min) |
| Cambio d'anno | 28/12/2026 10:00 | 04/01/2027 09:00 | 7 |

### 3.2 Cycle time (prima uscita dallo stato 0 → primo arrivo allo stato finale 5)

| Caso | Transizioni | Atteso |
|---|---|---|
| Normale | 0→1 01/09 … 4→5 15/09 | 14 |
| Non emesso | fino a 3→4 | **null** |
| Nessuna transizione | `[]` | **null** |
| Ritorni indietro | 0→1 01/09, 1→0, 0→1 04/09, …, 4→5 10/09, 5→4, 4→5 20/09 | 9 (01/09 → 10/09) |
| Ordine sparso | come "Normale" in ordine inverso | 14 |
| Data di Roma | 0→1 01/09 22:30 Z (= 02/09), 4→5 09/09 08:00 | 7 |
| Stesso giorno | tutto il 01/09 | 0 |
| Ora solare | 24/10 23:30 CEST → 26/10 00:30 CET | 2 |
| Cambio d'anno | 28/12/2026 → 04/01/2027 | 7 |

### 3.3 Throughput(w) (elaborati distinti arrivati allo stato finale lun–dom, ora di Roma)

| Caso | w | Transizioni verso 5 | Atteso |
|---|---|---|---|
| Confini | 21/09 | E1 lun 00:30 sì; E2 27/09 21:30 Z (dom 23:30) sì; E3 27/09 22:30 Z (lun 28/09) no; E4 due volte in w → 1; E5 dom 20/09 no; E6 3→4 no | 3 |
| Vuoto | 21/09 | — | 0 |
| Nessun arrivo in w | 21/09 | 0→1 in w; 4→5 il 14/09 | 0 |
| W53 / W1 | 28/12/2026 e 04/01/2027 | 28/12, 03/01/2027 12:00, 04/01/2027 00:10 | 2 e 1 |
| Ora solare | 19/10/2026 | 25/10 22:30 Z (dom 23:30 CET) sì; 25/10 23:30 Z (lun 26/10) no; 18/10 22:30 Z (lun 19/10 00:30 CEST) sì | 2 |

### 3.4 CFD (conteggi a fine giornata, ora di Roma)

Colonne: 0 Da fare; 1–2 In corso; 3–4 In verifica; 5 Emesso. Il contratto non dice se le
colonne a zero compaiono: il test confronta solo i conteggi diversi da zero.

| Giorno | E1 | E2 | E3 | E4 | E5 | Atteso |
|---|---|---|---|---|---|---|
| 01/09 | 0 | 0 | — | — | 4 (dalle 12:00) | Da fare 2, In verifica 1 |
| 02/09 | 1 (10:00) | 0 | 0 (creato 12:00; 0→1 alle 22:30 Z = 03/09) | — | 5 (15:00) | Da fare 2, In corso 1, Emesso 1 |
| 03/09 | 2 | 1 (21:30 Z = 23:30) | 1 | — (creato il 04/09) | 5 | In corso 3, Emesso 1 |

Altri casi: dal = al → un punto; nessuna transizione → un punto per giorno, colonne vuote;
24–26/10 (giorno di 25 h) → 3 punti, 0→1 del 25/10 23:30 Z conta il 26/10; 28–30/03
(giorno di 23 h) → 3 punti; 31/12/2026–01/01/2027 → 2 punti.

### 3.5 Avanzamento di uno stato alla volta e WIP

| Caso | da → a | Motivo | Atteso |
|---|---|---|---|
| Avanti di uno | 0→1, 2→3, 4→5 | null / "" | null (ammesso) |
| Avanti di più | 1→3, 0→5, 3→5 | qualsiasi | messaggio d'errore |
| Indietro con motivo | 2→1, 5→1 | testo | null |
| Indietro senza motivo | 3→2 | null, "", "   " | messaggio d'errore |

`sforaWip(n, limite)` = n + 1 > limite: (3, 4) false; (4, 4) true; (5, 4) true; (0, 0) true;
(0 o 50, null) false.

## 4. Avvisi (`avvisi.spec.ts`)

Soglie: `SOGLIE_DEFAULT` di `soglie.ts` (SPI/CPI rosso sotto 0,85), preavviso vincoli
7 giorni, elaborato fermo da ≥ 10 giorni. Le ore nei messaggi sono ore intere (`formato.ore`).

CL-2026-031 al 24/09/2026:

| # | Gravità | Condizione | Contenuto verificato |
|---|---|---|---|
| 1 | critico | SPI 0,7756 < 0,85 | "SPI …", "in ritardo di 70 h" (18.720 − 14.520 = 4.200 min), "rispetto al piano" |
| 2 | critico | CPI 0,75625 < 0,85 | "CPI …", EAC 561 h (33.640 min), BAC 424 h, ETC 241 h (14.440 min) |
| 3–5 | attenzione | V-12, V-13, V-15 (29/09 ≤ 01/10) | codici; V-14 (06/10) e V-16 (13/10) assenti |
| 6 | attenzione | In corso 5 su WIP 4 | "In corso"; In verifica 3 su 3 assente |
| 7–8 | attenzione | ELE-SC-201 15 gg, MEC-PL-102 10 gg | codici e "15"; IDR-PL-301 (9 gg) assente |

Altri casi: nessuna condizione → `[]`; indici null → nessun avviso; SPI/CPI 0,90 (giallo) e
0,85 (confine del giallo) → nessun avviso; SPI 0,8499 → critico "in ritardo di 15 h"
((6000 − 5100) / 60); soglie dal parametro (con verde 0,7 nessun critico, con giallo 1,1 due
critici a indice 1); vincoli: scaduto (20/09), oggi, oggi + 7 sì, oggi + 8 e senza data no;
preavviso a cavallo d'anno (28/12/2026 + 7 = 04/01/2027 sì, 05/01 no); WIP: 4 su 4 no, 4 su 3
sì, senza limite mai; fermi: 9 no, 10 sì.
