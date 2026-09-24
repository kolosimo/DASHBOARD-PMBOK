# 02 — Metodi Lean per commesse di progettazione MEP/BIM

> Ricerca web del 24/09/2026. [A] fonte accademica o ufficiale · [S] fonte secondaria · [NV] non verificato.
> Il proxy bloccava iglc.net, leanconstruction.org e PMC. Ho letto per intero solo il *LPS Workbook* dell'LCI e la tesi di Ballard (2000); del resto ho visto abstract e schede.

## 1. Last Planner System: livelli e dati minimi

Fonte [A]: [LPS Workbook LCI](https://lean-construction-gcs.storage.googleapis.com/wp-content/uploads/2022/08/08161441/Last-Planner-System-Workbook.pdf). La logica è SHOULD → CAN → WILL → DID: cosa si dovrebbe fare, cosa si può fare, cosa ci si impegna a fare, cosa si è fatto.

| Livello | Contenuto | Dati minimi |
|---|---|---|
| Master schedule | milestone, logica CPM | ID, data target, fase |
| Pull/phase planning | si pianifica a ritroso dalla milestone; il buffer è esplicito e condiviso | attività, fornitore → cliente interno, durata, predecessori, buffer |
| Lookahead / make-ready | finestra tipica di 5–6 settimane; scomposizione, screening, make-ready | attività nella finestra, stato dei vincoli, responsabile, data di rimozione |
| Registro vincoli | vincolo = "tutto ciò che impedisce a un compito di essere eseguibile (sound)". In progettazione: input da altri, criteri, approvazioni, risorse | descrizione, categoria, attività bloccata, responsabile, data necessaria, data di rimozione, stato |
| Weekly Work Plan | entrano solo assegnazioni che rispettano 5 criteri: definizione, eseguibilità, sequenza, dimensione, apprendimento | assegnazione, last planner, settimana, promesso sì/no, fatto sì/no |
| Daily huddle | riunione breve per riallineare il piano settimanale | nota sui blocchi |
| Learning | causa di ogni mancato completamento, analisi della causa radice | codice causa da lista chiusa, nota, link a 5 Why / A3 |

Cause di non completamento [A]: [LCI Reasons for Variance](https://leanconstruction.org/wp-content/uploads/2022/08/12_LPS_Reasons_For_Variance.pdf).

## 2. LPS in progettazione (letteratura)

- **Ballard (2000)** [A]: LPS è "particolarmente appropriato" per la progettazione, ma il caso di studio sulla progettazione è stato abbandonato ([tesi](https://lean-construction-gcs.storage.googleapis.com/wp-content/uploads/2022/09/08152942/the-last-planner-system-of-production-control-ballard2000-dissertation.pdf)).
- **Koskela, Ballard, Tanhuanpää (1997)**, *Towards Lean Design Management*, IGLC-5 [A] ([IGLC](https://iglc.net/Papers/Details/27)).
- **Hamzeh, Ballard, Tommelein (2009)**, IGLC-17 [A]: master e phase schedule sono pianificazione "deliberativa"; lookahead e WWP sono pianificazione "situata", che si adatta all'incertezza ([IGLC](https://iglc.net/papers/Details/644)).
- **Studi di progettazione in Florida, IGLC-23 (2015)** [A]: il PPC migliora dopo l'introduzione del WWP ([Huddersfield](http://eprints.hud.ac.uk/id/eprint/25688/)).
- **Tillmann (2020)**, CJCE [A]: nel coordinamento MEP con BIM, LPS rafforza ruoli e responsabilità ([CJCE](https://cdnsciencepub.com/doi/10.1139/cjce-2018-0424)).
- **ADePT/DSM** (Austin et al., 2000) [A]: sequenziamento della progettazione iterativa ([CME](https://www.tandfonline.com/doi/abs/10.1080/014461900370807)). In dashboard basta una matrice semplificata delle dipendenze tra discipline.
- **Takt in progettazione**: campo emergente, applicazione "unclear" [A/S]. **Da non implementare subito.**

## 3. Kanban in ingegneria

- **The Kanban Guide 2025** [A] ([kanbanguides.org](https://kanbanguides.org/the-kanban-guide/)). Metriche obbligatorie:
  - **WIP**: lavori iniziati e non finiti;
  - **Throughput**: lavori finiti per unità di tempo;
  - **Work Item Age**: da quanto tempo un lavoro aperto è in corso (indicatore anticipatore);
  - **Cycle Time**: tempo dall'inizio alla fine (indicatore a consuntivo).
- **Lead time** (dalla richiesta alla consegna) e **cycle time** (dall'inizio alla fine del lavoro) [S] ([Businessmap](https://businessmap.io/kanban-resources/kanban-software/kanban-lead-cycle-time)).
- **Cumulative Flow Diagram (CFD)** [S] ([Businessmap](https://businessmap.io/kanban-resources/kanban-analytics/cumulative-flow-diagram)).
- **Classi di servizio** ([djaa.com](https://djaa.com/classes-of-service/)) [S]:
  - Expedite: urgenza dal cantiere;
  - Fixed Date: scadenza VVF o gara;
  - Standard;
  - Intangible.
- **Modrich & Cousins (2017)**, IGLC-25 [A]: Kanban digitale in progettazione e coordinamento 3D, abbinato alle metriche LPS ([IGLC](https://www.iglc.net/Papers/Details/1454)).

## 4. Altri strumenti

| Strumento | In dashboard | In presenza |
|---|---|---|
| Obeya / Big Room | vista unica con milestone, vincoli, PPC e rischi | il lavoro insieme |
| A3 | modulo collegato a una causa ricorrente | il dialogo mentore-problem solver |
| 5 Why | campo strutturato sulla causa di non completamento | facilitazione |
| VSM | archivio della mappa | workshop periodico |
| Target Value Design | costo target vs stima per sistema (HVAC, idrico, elettrico) | cluster di lavoro |
| IPD | — (è un modello contrattuale) | — |

Fonti [A]:
- [LCI Big Room](https://leanconstruction.org/lean-topics/big-room/)
- [LEI A3](https://www.lean.org/lexicon-terms/a3-report/)
- [LEI 5 Whys](https://www.lean.org/lexicon-terms/5-whys/)
- [LCI TVD](https://leanconstruction.org/lean-topics/target-value-delivery/)
- [AIA IPD Guide](https://www.aia.org/sites/default/files/2023-11/ipd_guide.pdf)

## 5. Lean e PMBOK/EVM insieme

- **Critica**: Koskela & Howell (2002) considerano "obsoleta" la teoria implicita del PM tradizionale [A] ([PMI](https://www.pmi.org/learning/library/underlying-theory-project-management-obsolete-8971)).
- **Integrazione**: "Lean project planning – Bridging LPS and EVM", *Heliyon* 2024 [A] ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2405844024138418)).
- **Approccio pratico**:
  - l'**EVM** risponde a "siamo in linea con budget e tempi?";
  - **LPS e metriche di flusso** rispondono a "il piano è affidabile e il lavoro scorre?".
  - Sono domande complementari.

## 6. KPI Lean: formule

Formule dal LPS Workbook LCI [A], salvo dove indicato:

- **PPC** = assegnazioni completate / assegnazioni promesse nella settimana.
- **PPC2** = assegnazioni completate / assegnazioni previste dal piano di due settimane prima.
- **TMR (AMR2)** = assegnazioni presenti sia nel piano della settimana sia in quello di due settimane prima / assegnazioni del piano di due settimane prima. Misura quanto il lookahead rende davvero eseguibili le attività.
- **TA (AA2)** = assegnazioni presenti in entrambi i piani / assegnazioni del piano della settimana.
- **PCR** = vincoli rimossi / vincoli identificati una settimana prima (Jang & Kim, IGLC-15) [A] ([IGLC](https://www.iglc.net/papers/details/497)).
- **Pareto delle cause** di non completamento per settimana e disciplina.

**Limiti del PPC:**
- si può gonfiare promettendo poco;
- va sempre letto insieme allo stato delle milestone ([IGLC 2286](https://www.iglc.net/Papers/Details/2286)).

**Target di PPC:** non esiste un valore validato per la progettazione; i valori 70–90% citati da Ballard si riferiscono soprattutto al cantiere. **Da non promettere.**

## 7. Software LPS

- **Commerciali SaaS** [S]: Touchplan, vPlanner, VisiLean, Outbuild, Nialli ([directory](https://leanconstructionblog.com/Last-Planner-and-Takt-Software-Directory.html)).
- **Open source**: nessuno maturo.

## Nucleo minimo proposto dall'agente

**Da includere:**
- master schedule a milestone;
- lookahead di 6 settimane con registro vincoli e Kanban per disciplina (limiti WIP, classi di servizio);
- WWP con risposta sì/no;
- cause di non completamento da lista chiusa, con 5 Why facoltativo;
- KPI: PPC, TMR/TA, PCR, Work Item Age, throughput, CFD, più EVM.

**Da rimandare:** takt in progettazione, DSM automatica, TVD.
