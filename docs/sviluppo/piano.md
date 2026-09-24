# Piano: Cruscotto commesse Climosfera, costruzione multi-agente

## Contesto

Climosfera vuole un'app per gestire le commesse secondo PMBOK e Lean, **senza BIM**. I contenuti principali sono:
- Last Planner: lookahead, vincoli, piano settimanale, PPC;
- Kanban degli elaborati con limiti WIP;
- timesheet;
- EVM in ore;
- vista Obeya e portafoglio PM.

Vincoli e dimensioni:
- 16 PM, circa 50 commesse, circa 100 utenti che lavorano in contemporanea;
- installabile su Windows e Mac (1–5 Mac);
- un server aziendale, probabilmente Windows Server;
- accesso tramite VPN e login Microsoft 365;
- app autonoma: si parte da zero, niente GoodDay;
- manutenzione a cura dell'utente (ingegnere) con Claude, quindi un solo linguaggio: TypeScript.

Nel repo ci sono oggi solo `docs/` (ricerca rev. 2) e `prototipo/index.html`, un mock con dati finti.

## Esito della verifica profonda (3 agenti, sola lettura)

- **Prototipo** (29 rilievi). Le formule EVM/PPC/PCR sono giuste e i calcoli a mano tornano (BAC 424, PV 312, EV 242, AC 320). Ci sono però difetti reali:
  - la curva S storica si ottiene scalando il valore attuale, quindi riscrive la storia;
  - il Kanban salta dallo stato 1 al 3;
  - il drag&drop non funziona in Firefox;
  - il focus del timesheet si perde a ogni modifica;
  - la dicitura "tempo reale per tutto il team" è falsa;
  - CPI ed EAC dividono per zero;
  - date e soglie sono scritte a mano;
  - EAC ed ETC sono confusi nei testi;
  - V-15 è incoerente con la causa scelta nel piano;
  - TMR/TA, CFD e un vero Work Item Age mancano.
- **Documenti** (18 rilievi):
  - 03 (OpenProject) non è marcato come superato;
  - 04 contiene ancora parti Django dichiarate valide e la riga "timesheet esistente";
  - in 01, "5×7=40" è un errore aritmetico;
  - la PCR del prototipo non corrisponde alla formula di 02;
  - la definizione di TMR è ambigua;
  - Safari è presentato come certo;
  - mancano modello dati, permessi, backup, test e rilascio.
- **Architettura, ricontrollo web**:
  - confermati: "Aggiungi al Dock" di Safari, HTTPS con CA aziendale, MSAL con PKCE, limite SSE, Apple 99 USD;
  - correzioni:
    - il service worker non è più obbligatorio (Chrome 112 e successivi);
    - NSSM e node-windows sono abbandonati: al loro posto **WinSW**;
    - PostgreSQL su Windows Server 2025 non è certificato EDB (preferire 2022);
    - il login dentro la web app del Dock di Safari non è garantito, quindi meglio **OIDC lato server** che MSAL nel browser;
    - AdonisJS è l'unico framework TypeScript con ORM e login ufficiali integrati.

Tutti i rilievi entrano nel **Passo 0** (pulizia) e nel modello dati.

## Stack (decisione)

| Parte | Scelta |
|---|---|
| Server e pagine | **AdonisJS** (TypeScript strict, Node 24 LTS), versione fissata. Pagine generate dal server (Edge) con **HTMX + Alpine**. Grafici in SVG generati sul server, CSS e font IBM Plex ripresi dal prototipo |
| Database | **PostgreSQL**. Ore e budget salvati in **minuti interi**. Colonna `version` su ogni tabella, per l'optimistic locking (409 se due persone modificano insieme) |
| Login | OIDC lato server con `openid-client` verso Entra ID, sessione in cookie httpOnly. Login di sviluppo `AUTH_MODE=dev`, che fa rifiutare l'avvio in produzione |
| Tempo reale | `@adonisjs/transmit` (SSE); se cade, polling ogni 30 s |
| Distribuzione | PWA (manifest + HTTPS da CA aziendale) da Edge/Chrome e Dock di Safari; sul Mac il piano B è Chrome/Edge |
| Server Windows | servizi WinSW (app) + PostgreSQL EDB; script PowerShell di installazione, aggiornamento, backup e ripristino; pacchetto zip senza dipendenze native |
| Test | Japa (unit e funzionali, un DB per agente) e Playwright (e2e) |

## Struttura del repo

Un'unica app Adonis nella radice (niente monorepo), con i moduli in `app/modules/<modulo>/`:

```
app/domain/     TS puro: types, calendario, soglie, evm, lps, flusso, avvisi
app/models/  app/policies/  app/shared/ (audit, optimistic, eventi, impostazioni, scheduler)
app/ui/         charts SVG, formato it-IT ("n.d."), glossario
app/modules/    anagrafiche  admin  lps  flusso  ore  evm  obeya  portafoglio  elaborato_dettaglio
resources/views/{layouts,components,modules/*}   database/{migrations,seeders}
tests/{unit/domain,functional/*}   e2e/   deploy/windows/   docs/{sviluppo,formule,installazione,utente,manutenzione}
prototipo/      congelato come riferimento
```

## Modello dati (sintesi)

Regole comuni:
- ogni riga ha `version`;
- le settimane si indicano con la data del lunedì (Europe/Rome);
- ogni modulo scrive solo sulle proprie tabelle.

Tabelle:
- **Anagrafiche**: `utenti` (ruolo admin/direzione/pm/progettista), `commesse`, `membri_commessa`, `milestone`, `elaborati` (codice, titolo, disciplina, budget_minuti, classe di servizio, responsabile, stato_id, stato_dal).
- **Configurazione**, modificabile da admin e con valori "di esempio":
  - `discipline` (MEC, ELE, IDR, ANT);
  - `stati_elaborato` con peso EV cumulativo 0/20/50/70/85/100;
  - `colonne_kanban`, `limiti_wip_commessa`;
  - `cause_non_completamento` (8);
  - `impostazioni` (soglie, ore massime al giorno, scadenza modifica ore).
- **Flusso**: `transizioni_elaborato`, lo storico da cui si calcolano Work Item Age, cycle time, throughput e CFD.
- **Last Planner**:
  - `attivita_lookahead`;
  - `vincoli` (stati da_analizzare/aperto/rimosso/annullato) collegati alle attività in **molti-a-molti** tramite `vincoli_attivita`;
  - `piani_settimanali` (bozza/promesso/chiuso) e `impegni` (fatto, causa, 5 Why, aggiunto_dopo_promessa);
  - `snapshot_lookahead` e `snapshot_lps`.
- **Ore**: `registrazioni_ore` (utente, elaborato, data, minuti). Si registra solo per sé.
- **EVM**:
  - `baseline` con pesi congelati, `baseline_date_stato`, `baseline_pv_settimana`;
  - `snapshot_evm` (+ per elaborato): **la curva S storica si legge da qui e non si ricalcola**.
- **Trasversale**: `audit_log`, solo inserimenti.

Formule, da fissare in `docs/formule/formule.md` con casi calcolati a mano:
- **EV** = Σ budget × peso dello stato.
- **SPI** = EV/PV, **CPI** = EV/AC. Se il divisore è 0 il risultato è null e si mostra "n.d.".
- **EAC** = BAC/CPI ("stima a completamento"), **ETC** = EAC−AC ("ore ancora necessarie"), **VAC** = BAC−EAC.
- **PPC** = fatti/promessi, esclusi gli impegni aggiunti dopo la promessa.
- **PCR(w)** = vincoli rimossi entro w / vincoli aperti al lunedì di w con scadenza entro w. Da confermare al Gate 0.
- **TMR/TA** da `snapshot_lookahead` di w−2.
- **Kanban**: si avanza di uno stato alla volta; per tornare indietro serve un motivo; lo sforamento WIP va confermato e finisce nell'audit.

## Passo 0: pulizia preliminare (orchestratore, prima della Fase 0)

1. Docs:
   - banner "superato" su 03;
   - in 04 barrare le parti Django e la riga "timesheet esistente";
   - in 01 correggere "5×7=40";
   - in 02 chiarire TMR = lookahead w−2 e segnare [NV] le sigle AMR2/AA2;
   - in 00: Safari [NV] con nuova decisione D7 "prova login su Mac", WinSW al posto di NSSM, OIDC lato server, AdonisJS, **rimozione BIM** (nessun modulo o evoluzione BIM/Revit);
   - in 07 citare "01–08" e aggiungere le verifiche di 08;
   - in 08 aggiornare service worker, NSSM, PostgreSQL 2025 e login Safari.
2. Prototipo:
   - correggere l'etichetta "tempo reale";
   - fare avanzare il Kanban di uno stato alla volta;
   - aggiungere `setData` al drag&drop;
   - mantenere il focus nel timesheet;
   - mostrare "n.d." quando si divide per zero;
   - correggere i testi EAC/ETC;
   - rendere coerente V-15.

   - togliere i riferimenti BIM/IFC (V-16, L6).

   Poi ripubblicare l'artifact (stesso URL). Il prototipo resta comunque un mock.
3. Commit e push su `claude/clever-darwin-zkmy1f`.

## Esecuzione multi-agente

**Meccanismo.** Uso lo strumento Workflow, che l'utente ha chiesto esplicitamente ("modalità multiagentica"). Ogni fase è un workflow separato, con un massimo di 8 agenti concorrenti.

**Regole:**
- Ogni agente lavora in un proprio **git worktree** (`agente/<nome>`), con porta e database propri (`cruscotto_test_<agente>`).
- Merge `--no-ff` **solo** su `claude/clever-darwin-zkmy1f`, un branch alla volta, a quattro condizioni: rebase fatto, `npm run verifica` verde, approvazione del revisore T2, test T1 verdi.
- La proprietà dei file è scritta in `docs/sviluppo/proprieta-file.md`. I file condivisi (package.json, routes, nav, layout, `types.ts`, `app/shared`, migrazioni) li modifica solo l'orchestratore.
- In Fase 1 e successive sono ammesse solo migrazioni additive, con il prefisso del modulo.
- Ogni agente lascia una consegna in `docs/sviluppo/handoff/<agente>.md`.
- **Nessuna fase parte senza l'OK esplicito dell'utente al gate.**

### Fase 0: fondamenta (1 agente, F0)

- Scaffolding Adonis: TS strict, lint, `.env.example`.
- **Tutte le migrazioni e tutti i modelli.** Seed con i dati del prototipo.
- OIDC testato contro un provider finto (`oauth2-mock-server`), login di sviluppo, creazione dell'utente al primo accesso, admin iniziali da `ADMIN_EMAILS`.
- Bouncer con i permessi base, documentati in `docs/sviluppo/permessi.md`.
- Layout, componenti e CSS dal prototipo.
- Servizi condivisi: audit, optimistic 409, calendario, impostazioni, eventi/Transmit, scheduler.
- **Contratti** delle formule: firme in `app/domain/*`, e firme di `queries.ts` per ogni modulo (per esempio `riepilogoLps`, `riepilogoFlusso`, `riepilogoEvm`, `serieCurvaS`, `oreCommessa`, `commesseVisibili`).
- `npm run verifica` (typecheck, lint, unit, funzionali, controllo dipendenze native), `npm run screenshot`, `CLAUDE.md`.
- **Fuori ambito**, regola da scrivere in `CLAUDE.md` e nelle convenzioni. Il revisore T2 la tratta come motivo di blocco. Sono esclusi:
  - BIM, ISO 19650, UNI 11337;
  - stati WIP/Shared/Published, MIDP/TIDP;
  - BCF e clash;
  - Revit, ACC, IFC;
  - Electron;
  - integrazione con GoodDay.
- Nel seed si sostituiscono i riferimenti BIM del prototipo:
  - V-16 diventa "Tavole strutturali aggiornate dallo strutturista";
  - L6 diventa "Coordinamento impianti / strutture";
  - il responsabile "BIM coordinator" diventa "PM".
- Ruoli di commessa: pm, progettista, verificatore, osservatore.

**Gate 0**:
- criteri: `verifica` verde, login di sviluppo funzionante, OIDC funzionante contro il provider finto, il 409 funziona, screenshot del layout;
- l'utente: conferma stati e pesi, colonne e WIP, cause, definizione PCR e glossario; chiede all'IT le informazioni D1 (server) e D3 (tenant Entra).

### Fase 1: moduli in parallelo (8 agenti)

| Agente | Compito |
|---|---|
| A1 Anagrafiche + admin | CRUD commesse/team/milestone/elaborati, import CSV/incolla da Excel, pannello di configurazione |
| A2 Last Planner | lookahead a 6 settimane, vincoli molti-a-molti, piano bozza→promesso→chiuso (causa obbligatoria per ogni "no"), PPC/PCR/Pareto, job di snapshot |
| A3 Flusso/Kanban | avanzamento di uno stato alla volta, WIP, Work Item Age reale, throughput/cycle time, CFD; `CambioStatoService` è l'unico che scrive lo stato |
| A4 Ore | timesheet settimanale solo per sé (403 per gli altri), blocco dopo la scadenza, vista aggregata per il PM; ore per persona disattivate di default |
| A5 EVM | editor e approvazione della baseline con PV settimanale congelato, calcolo live, `snapshot_evm`, curva S dagli snapshot, nessuna divisione per zero |
| T1 Verificatore formule | test **scritti prima** del codice, con casi calcolati a mano: normali, limite, divisione per zero, W53, ora legale. Gli agenti di modulo non possono modificarli |
| T2 Revisore | per ogni branch controlla: permessi, 409, audit, italiano, nessuna classifica per persona, N+1, dipendenze |
| T3 Documentazione | glossario, bozze delle guide per ruolo, guida "manutenzione con Claude" |

- Tutti partono dal seed, quindi nessuna attesa reciproca.
- Ordine di merge: A1 → A3 → A4 → A2 → A5.
- **Gate 1**:
  - criteri: tutto verde, screenshot per ogni vista e ruolo;
  - l'utente: controlla a mano i casi di prova delle formule; facoltativamente prova il login M365 in locale.

### Fase 2: integrazione (7 agenti)

| Agente | Compito |
|---|---|
| B1 | Obeya e portafoglio (avvisi e semafori con soglie uniche; la direzione vede solo i totali) |
| B2 | tempo reale SSE ed e2e con due browser: la modifica compare in meno di 3 s, messaggio di conflitto in caso di 409 |
| B3 | matrice permessi rotte × ruoli come test, pagina audit, controllo art. 4 |
| B4 | scheda elaborato e collegamenti tra moduli |
| B5 | script PowerShell di deploy, TLS da PFX, backup/ripristino, pacchetto zip |
| QA | e2e per ruolo |
| T2 + T3 | continuano |

- **Gate 2**: istanza di staging installata sul Windows Server con gli script. L'utente prova:
  - il login M365 su Edge in Windows;
  - su Mac, sia il Dock di Safari sia Chrome/Edge;
  - l'installazione della PWA;
  - una modifica contemporanea con un collega.

### Fase 3: hardening (6 agenti)

| Agente | Compito |
|---|---|
| H1 | sicurezza (CSP, limiti di frequenza, sessione, audit npm) e PWA (manifest, icone) |
| H2 | volumi e prestazioni: 50 commesse × 60 elaborati, 100 utenti, p95 < 500 ms; prova di ripristino |
| B5 | deploy finale |
| QA | regressione completa e accessibilità da tastiera |
| T3 | guide finali |
| T2 | revisione di sicurezza finale |

- **Gate 3 (go-live)**: ripristino provato con l'IT, test di carico superato, D4 (consulente del lavoro) e D6 (data di passaggio da GoodDay) chiusi, pilota di 2 settimane su 1–2 commesse.

## Dipendenze dall'IT dell'utente

| Quando | Cosa |
|---|---|
| Entro il Gate 0 | versione di Windows Server (meglio 2022), risorse, permesso di installare servizi, chi amministra il tenant Entra |
| Entro il Gate 1 (facoltativo) | registrazione dell'app su Entra con redirect localhost |
| Entro il Gate 2 | nome DNS interno, certificato AD CS in PFX, root CA distribuita via GPO e **installata a mano sui Mac**, porta 443 sulla VPN, account di servizio, installer offline di Node/PostgreSQL/WinSW |
| Entro il Gate 3 | cartella per i backup, finestra di manutenzione |

## Rischi principali

| Rischio | Mitigazione |
|---|---|
| Login su Safari (Dock) | si prova al Gate 2; piano B Chrome/Edge sul Mac |
| Conflitti tra agenti | schema e contratti fissati in Fase 0, proprietà dei file, merge in serie |
| Storia EVM riscritta | snapshot e pesi congelati nella baseline, test T1 |
| Differenze Linux/Windows | script portabili, nessuna dipendenza nativa, staging Windows al Gate 2 |
| Art. 4 Statuto dei lavoratori | solo KPI per commessa o team, ore per persona disattivate, test B3 |
| Crescita dei requisiti | solo l'MVP; BIM escluso per decisione dell'utente |

## Verifica end-to-end

- A ogni merge: `npm run verifica` (typecheck, lint, Japa unit + funzionali).
- A ogni gate: suite Playwright per ruolo; `npm run screenshot` inviato all'utente; controllo a mano dei casi in `docs/formule/casi-di-prova.md`.
- Gate 2 e 3 su Windows Server reale:
  - `installa.ps1` → servizio attivo → login M365 → PWA installata su Windows e su Mac;
  - modifica concorrente → 409;
  - SSE entro 3 s;
  - `backup.ps1` seguito da `ripristino.ps1` su un database vuoto con dati identici.
