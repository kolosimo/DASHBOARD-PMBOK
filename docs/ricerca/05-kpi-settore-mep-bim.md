# 05 — KPI e gestione commesse in una società MEP/BIM

> Ricerca web del 24/09/2026. Alcune fonti erano bloccate dal proxy (biblus.acca.it, buildingsmart, edilportale): per queste ho letto solo gli estratti di ricerca, segnalati come tali.

## 1. KPI ricorrenti nel settore AEC

- **Ore a budget vs consuntivo per fase**, con ETC ed EAC ([Monograph](https://monograph.com/features/time-tracking), [BQE](https://www.bqe.com/features/project-management)).
- **Margine e net multiplier** (ricavo netto / costo del lavoro diretto). Il riferimento ≥3 è un benchmark USA, non verificato per l'Italia ([GrowthForce](https://www.growthforce.com/blog/the-number-one-kpi-needed-by-aec-firms)).
- **Utilizzo** (ore fatturabili / ore disponibili). Valore indicativo intorno all'80% secondo BQE ([BQE KPI](https://www.bqe.com/blog/engineering-kpi-formulas-and-benchmarks-for-firms-teams-and-managers)).
- **Backlog** (onorari ancora da produrre / ricavo annuo) ([Monograph](https://monograph.com/blog/financial-kpis-architecture-engineering-firms-2026)).
- **Capacità del team** per le settimane future ([Deltek](https://www.deltek.com/resources/articles/project-management-software-for-engineering-firms/)).
- **SAL e WIP**: lavoro prodotto ma non ancora fatturato.
- **Varianti ed extra**: registro dedicato.
- **Registro elaborati**: codice, disciplina, revisione, stato, data prevista e data effettiva.

## 2. Earned Value applicato alla progettazione

Regole per misurare l'avanzamento ([Gather Insights](https://www.gatherinsights.com/en/earned-value/definitions/earned-value-technique), [Monograph EVM](https://monograph.com/blog/earned-value-management-engineering-firms)):
- **0/100**: attività brevi.
- **50/50**: attività di 2–3 periodi di reporting.
- **Milestone ponderate**: la più adatta alla progettazione. Esempio di pesi per un elaborato MEP (proposta dell'agente, **da tarare internamente**):
  - impostazione 20%;
  - calcoli 30%;
  - emissione interna 20%;
  - verifica 15%;
  - emissione al cliente 15%.
- **% fisica stimata**: soggettiva.

**Critica documentata:** la percentuale autodichiarata tende a restare ferma "al 90%" per settimane ([Humphreys & Associates](https://www.humphreys-assoc.com/earned-value-assessment-and-the-percent-complete-technique/)). Per questo l'EV va legato al **cambio di stato dell'elaborato**, e le ore di rilavorazione vanno tracciate a parte.

## 3. Gestione informativa BIM

- **ISO 19650**
  - Stati dei contenitori informativi: WIP, Shared, Published, Archived ([BibLus EN](https://biblus.accasoftware.com/en/container-information-states-iso-19650-wip-shared-published-archived/)).
  - Piani di consegna: TIDP (per gruppo di lavoro) e MIDP (per commessa) ([Revizto](https://revizto.com/resources/blog/understanding-tidp-midp-for-iso-19650)).
  - I codici di idoneità S0–S7 sono dell'Annesso nazionale UK, non universali.
- **UNI 11337-4**: stati di lavorazione L0–L3 e di approvazione A0–A3 ([BibLus](https://biblus.acca.it/stati-di-approvazione-e-livelli-di-verifica-bim/), solo estratto). Il significato dei singoli codici va verificato sul testo della norma.
- **D.Lgs. 36/2023, art. 43** (fonti secondarie concordanti, testo di legge non letto):
  - obbligo di gestione informativa digitale dal 01/01/2025 per opere di costo presunto **superiore a** 2 milioni di euro (corretto dopo la verifica del 24/09: non "≥"), stimato sul costo presunto dei lavori e non sulla base di gara. Sono escluse la manutenzione ordinaria e straordinaria; per i beni culturali vincolati vale la soglia UE; non c'è obbligo se il DOCFAP è stato approvato entro il 31/12/2024 ([codiceappalti.it art. 43](https://www.codiceappalti.it/DLGS_36_2023/Articolo_43__Metodi_e_strumenti_di_gestione_informativa_digitale_delle_costruzioni_/12649), [ANCE](https://ance.it/wp-content/uploads/allegati/Analisi_decreto_Correttivo_Codice_Contratti.pdf));
  - la soglia è stata portata da 1 a 2 milioni dal D.Lgs. 209/2024;
  - l'Allegato I.9 regola requisiti e figure ([BIM Portale](https://www.bimportale.com/obbligatorieta-bim-2025-la-soglia-minima-si-alza-2-milioni-euro/));
  - Linee guida MIT del 23/02/2026 (Edilportale, solo estratto).

## 4. Coordinamento BIM

- **BCF** è lo standard buildingSMART per le issue ([buildingSMART](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/)). Non ho trovato benchmark pubblici sui tempi di risoluzione.
- **Metriche proposte** (non standard):
  - issue aperte e chiuse per disciplina e per settimana;
  - età media delle issue;
  - issue scadute;
  - issue per coppia di discipline;
  - issue riaperte;
  - issue bloccanti sulla prossima emissione.

## 5. Qualità (ISO 9001, punto 8.3)

- Tre attività distinte: **riesame, verifica e validazione** della progettazione ([Advisera](https://advisera.com/9001academy/knowledgebase/iso9001-design-verification-vs-design-validation/), [Certiquality](https://www.certiquality.it/it/news/verifica-e-validazione-della-progettazione-e-sistemi-di-qualita-iso-9001)).
- Cosa tracciare:
  - redatto / verificato / approvato per ogni revisione;
  - checklist per tipo di elaborato;
  - non conformità;
  - percentuale di elaborati emessi senza verifica (obiettivo 0).

## 6. Gestionali AEC di mercato

| Software | Funzioni verificate |
|---|---|
| Deltek Vantagepoint | budget, risorse per competenze, EVM |
| BQE Core | ETC, % completamento, EV, fatturazione a percentuale |
| Monograph | fasi, MoneyGantt, ore pianificate vs effettive |
| Wethod, TopIngegneria, DamaOffice, iMio (Italia) | commesse, rapportini, marginalità (solo estratti di ricerca) |

**Cosa manca a tutti, per quanto risulta:** il collegamento nativo tra registro elaborati, stati ISO 19650/UNI e issue BCF. È lo spazio di differenziazione per un'app interna.
