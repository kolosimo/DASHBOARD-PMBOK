# Dashboard commesse Climosfera: sintesi della ricerca e decisioni aperte

> Stato al 24/09/2026. I rapporti di dettaglio, con tutte le fonti, sono in `docs/ricerca/01…06`.

## 1. Requisiti raccolti

| Voce | Valore | Fonte |
|---|---|---|
| PM | 16 | utente |
| Commesse per PM | ≤ 3, quindi circa 50 commesse attive | utente |
| Risorse per commessa | fino a circa 10, quindi circa 100 utenti potenziali | stima |
| Server | uno solo, probabilmente Windows | utente (da verificare) |
| IT | un referente interno e un'azienda esterna per la sicurezza | utente |
| Identità | Microsoft 365 (Entra ID) | utente |
| Ore consuntive | "Gooday", probabilmente GoodDay (goodday.work), SaaS con API | utente + ricerca 06 |
| Accesso remoto | via VPN | utente |
| MVP | Kanban + Last Planner System; ore e budget (EVM) | utente |
| Vincolo | non eccessivamente complessa | utente |

## 2. Cosa dice la ricerca, in una riga per filone

- **PMBOK**: l'8ª edizione (novembre 2025) ha 6 principi, 7 domini (Governance, Scope, Schedule, Finance, Stakeholders, Resources, Risk) e un tailoring predittivo, adattivo o ibrido. Per la dashboard servono i registri (rischi, issue, change, decisioni) e l'EVM (ANSI/PMI 19-006-2019). → 01
- **Lean**: LPS ha 5 livelli; i dati minimi sono chiari (vedi 02 §1). KPI: PPC, TMR, PCR e Pareto delle cause. In più le metriche Kanban (WIP, Work Item Age, throughput, CFD). Non esiste un target di PPC validato per la progettazione. → 02
- **Tool esistenti**: nessun tool open source self-hosted fa LPS o PPC. OpenProject è il più completo lato PMBOK, ma il login M365 (SSO) richiede Enterprise. → 03
- **Architettura su misura**: consigliati Django + HTMX + PostgreSQL in Docker su una VM Linux, login Entra ID, SSE e optimistic locking. Su Windows Server serve una VM Linux, perché Docker per container Linux non è supportato nativamente. → 04
- **Settore MEP/BIM**: l'EV va legato al cambio di stato dell'elaborato, non alla percentuale dichiarata. Registro elaborati con stati ISO 19650/UNI 11337. Nessun gestionale di mercato unisce elaborati, stati BIM e issue BCF. → 05
- **GoodDay**: l'API Time Reports fornisce il consuntivo ore per progetto, task e utente. GoodDay ha già task e Kanban: bisogna evitare il doppio inserimento. → 06

## 3. Raccomandazione (baseline, da confermare)

**App su misura "sottile", che si affianca a GoodDay e non lo sostituisce.**

**GoodDay** resta la fonte delle ore consuntive. È già in uso e il timesheet non va duplicato.

**App Climosfera** (Django + PostgreSQL, VM Linux sul server aziendale, login M365) fa solo ciò che GoodDay non fa:
1. **Last Planner System**:
   - milestone;
   - lookahead a 6 settimane con registro vincoli;
   - piano settimanale con promessa e completamento;
   - cause di non completamento;
   - PPC, TMR e PCR.
2. **Kanban di commessa** con limiti WIP e classi di servizio, *solo se* GoodDay oggi non è già usato per i task (vedi D2).
3. **EVM**:
   - BAC e budget ore per fase o elaborato, inseriti nell'app;
   - AC dalle ore GoodDay (API);
   - EV dal cambio di stato degli elaborati (milestone ponderate);
   - SPI, CPI ed EAC.

**Da rimandare dopo l'MVP:** registro elaborati completo ISO 19650/UNI, issue BCF, registri PMBOK completi, integrazione SharePoint.

**Perché non OpenProject:**
- duplica GoodDay (task e ore);
- il login M365 è a pagamento;
- non fa LPS: andrebbe comunque personalizzato.

**Perché non low-code:** nelle versioni gratuite mancano permessi per commessa e SSO, e le licenze cambiano (NocoDB, 2026).

## 4. Decisioni aperte (servono per partire)

| # | Domanda | Chi risponde | Impatto |
|---|---|---|---|
| D1 | Il prodotto è davvero GoodDay (goodday.work)? Quale piano? | admin GoodDay | fonte delle ore e SSO |
| D2 | In GoodDay si registrano **solo ore** o anche **task e Kanban**? | PM / admin | se sì, la Kanban si legge da GoodDay invece di duplicarla |
| D3 | Il server: sistema operativo, hypervisor (Hyper-V?), RAM e CPU liberi. Si può creare una VM Linux? | IT interno / esterno | deploy |
| D4 | Dove vivono oggi i budget ore di commessa (offerta, Excel)? | direzione / PM | come si carica il BAC |
| D5 | Chi mantiene l'app nel tempo (competenze Python?) | direzione | rischio persona chiave |
| D6 | Informativa dipendenti / art. 4 Statuto dei lavoratori per dati ore e PPC | consulente del lavoro | GDPR, visibilità per ruolo |

## 5. Rischi principali

1. **Doppio inserimento** GoodDay / app: il rischio numero uno per l'adozione.
2. **PPC usato per valutare le persone**: rischio legale (art. 4) e culturale. Va mostrato per team o commessa.
3. **EV "a opinione"**: se l'avanzamento è una percentuale dichiarata, l'EVM non è affidabile.
4. **Persona chiave** sulla manutenzione del codice.
5. **Crescita dei requisiti** verso un "MS Project 2": l'MVP va tenuto su LPS + EVM.
