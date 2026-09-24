# 01 — PMBOK Guide: base verificata

> Ricerca web del 24/09/2026. Legenda: **[PMI/ISO]** fonte ufficiale · **[SEC]** fonte secondaria · **[NV]** non verificato.
> Nota: il proxy bloccava pmi.org e i PDF PMI, per cui "PMI" indica il testo delle pagine ufficiali restituito dal motore di ricerca, non la lettura del documento intero. Il PMBOK 8 è gratuito per i soci PMI: il dettaglio va verificato lì.

## 1. Edizioni

- Storia [SEC, https://en.wikipedia.org/wiki/Project_Management_Body_of_Knowledge]: 1996, 2000, 2004, 2008, 2013, 2017 (6ª, entrano le pratiche agili), 2021 (7ª: da 10 knowledge areas a 12 principi + 8 performance domains) [PMI, https://www.pmi.org/-/media/pmi/documents/public/pdf/pmbok-standards/pmbok-guide-public-faqs-1-july-2021.pdf].
- **L'8ª edizione esiste ed è la più recente** [PMI, https://www.pmi.org/standards/pmbok]:
  - 6 principi e 7 performance domains;
  - copertura estesa su AI, PMO e procurement;
  - reintroduce una guida ai processi "evoluta e non prescrittiva";
  - è gratuita per i soci.
  - Indice: https://www.pmi.org/-/media/pmi/documents/public/pdf/publications/pmbok-guide-eighth-edition_table-of-contents.pdf
  - Uscita: 13/11/2025 in digitale, 13/01/2026 in cartaceo [SEC, https://milestonetask.com/pmbok-guide-8th-edition-release-date/].
  - Nuovo esame PMP da luglio 2026 [PMI, https://www.pmi.org/certifications/project-management-pmp/new-exam].
- **I 6 principi** [SEC, https://www.brainbok.com/blog/pmp/pmbok-guide-7th-vs-8th-edition-what-has-changed]:
  1. Adopt a Holistic View
  2. Focus on Value
  3. Embed Quality into Processes and Deliverables
  4. Be an Accountable Leader
  5. Integrate Sustainability Within All Project Areas
  6. Build an Empowered Culture
- **I 7 domini**: Governance, Scope, Schedule, Finance, Stakeholders, Resources, Risk [PMI + SEC].
- **5 Focus Areas** (Initiating, Planning, Executing, Monitoring & Controlling, Closing) × 7 domini = **40 processi** non prescrittivi [SEC, https://www.brainbok.com/blog/pmp/focus-areas-vs-process-groups-pmbok-8]. Il numero di processi per singolo dominio o focus area è [NV].

## 2. Tailoring e approccio ibrido

- **Tailoring**: si sceglie l'approccio (predittivo, adattivo o ibrido), poi lo si adatta all'organizzazione e al progetto, poi lo si migliora nel tempo [PMI, https://www.pmi.org/-/media/pmi/documents/public/pdf/pmbok-standards/pmbok-tailoring-explainer-20-oct-2020.pdf].
- **Ibrido**: la ricerca PMI lo indica come approccio "fit-for-purpose" in crescita, ma senza una definizione universale [PMI, https://www.pmi.org/learning/library/consistent-approach-provides-high-performance-9889].
- L'Agile Practice Guide 2ª ed. sostituisce l'etichetta "hybrid" con un **continuum di delivery** [PMI, https://www.pmi.org/blog/agile-practice-guide-second-edition].
- Una posizione PMI specifica su Lean non è stata trovata [NV].

## 3. Artefatti e metriche utili in dashboard

Nella 7ª edizione gli artefatti sono raggruppati in famiglie ("Models, Methods, and Artifacts") [SEC, https://www.brainbok.com/guide/pm-fundamentals/models-methods-artifacts/overview/]:
- Strategy: charter, business case, roadmap;
- Logs & Registers: assumption, change, issue, lessons learned, risk, stakeholder, backlog;
- WBS;
- Baselines: scope, schedule, cost, PMB;
- Visual data: burndown, Gantt, information radiator.

**Contenuto minimo proposto per ogni artefatto** (prassi PMBOK 6/7, [NV] sul testo dell'8ª edizione):

| Artefatto | Campi minimi |
|---|---|
| Project charter | scopo, obiettivi e criteri di successo, deliverable, assunzioni e vincoli, rischi di alto livello, milestone, budget sommario, stakeholder, sponsor e autorità del PM |
| WBS + dizionario | codice, descrizione, responsabile, deliverable, criteri di accettazione |
| Registro stakeholder | ruolo, organizzazione, interesse e influenza, coinvolgimento attuale e desiderato |
| Registro rischi | ID, causa-evento-effetto, probabilità, impatto, punteggio, owner, risposta, trigger, stato |
| Issue log | ID, descrizione, priorità, owner, apertura, scadenza, stato, risoluzione |
| Decision log | data, decisione, alternative, chi ha deciso, impatto |
| Change log | ID, richiedente, descrizione, impatto su scope/tempi/costi, esito, data, approvatore |
| Lessons learned | categoria, evento, impatto, raccomandazione, fase |
| Baseline | versione e data di approvazione per scope, tempi, costi e PMB |

**Formule EVM** [PMI, https://www.pmi.org/learning/library/to-complete-performance-index-tcpi-6009]:
- SV = EV − PV; CV = EV − AC
- SPI = EV/PV; CPI = EV/AC
- EAC = BAC/CPI, oppure AC + (BAC − EV)/CPI, oppure AC + (BAC − EV)/(CPI·SPI)
- ETC = EAC − AC; VAC = BAC − EAC
- TCPI = (BAC − EV)/(BAC − AC)

## 4. Standard collegati (confermati)

- **ANSI/PMI 19-006-2019 Standard for Earned Value Management**: vale anche in contesti agili e ibridi, include l'earned schedule [PMI, https://www.pmi.org/standards/earned-value-management].
- **Agile Practice Guide 2ª ed.** (PMI + Agile Alliance) [PMI, https://www.pmi.org/standards/agile]. Data di uscita incerta: 27/07/2026 secondo il distributore, 02/09/2026 secondo la verifica successiva [SEC].
- **Process Groups: A Practice Guide** (2022): 5 gruppi di processi e 49 processi, per l'approccio predittivo [PMI, https://www.pmi.org/standards/process-groups].
- **ISO 21502:2020** (guida al project management) e **ISO 21500:2021** (contesto e concetti), che sostituiscono la ISO 21500:2012 [ISO, https://www.iso.org/standard/74947.html, https://www.iso.org/standard/75704.html].
- **GPM P5** sostenibilità [PMI, https://www.pmi.org/standards/gpm-p5-standard-for-sustainability-in-project-management].

## 5. Risorse gratuite

- **PMI Lexicon v5.0** (gennaio 2026), richiede un login gratuito: https://www.pmi.org/standards/lexicon. È la base consigliata per il glossario dell'app.
- Outline dell'esame PMP 2026: https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/new-pmp-examination-content-outline-2026.pdf
- Articoli EVM del PMI Learning Library, citati sopra.

## Da verificare prima dello sviluppo

- Nomi esatti dei 40 processi dell'8ª edizione.
- Contenuto minimo degli artefatti secondo il testo dell'8ª edizione.
