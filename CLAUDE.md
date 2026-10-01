# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cruscotto commesse Climosfera

App web multi-utente per le commesse di Climosfera (PMBOK + Lean): Last Planner,
Kanban degli elaborati, ore, EVM in ore, Obeya e portafoglio. Un solo linguaggio
(TypeScript), un solo server aziendale (Windows Server), PostgreSQL, login
Microsoft 365 (nel pilota di Fase 2: account locali, `AUTH_MODE=locale`). Piano: `docs/sviluppo/piano.md`. Decisioni: `docs/00-sintesi-e-decisioni.md`.

**Tutto il testo per l'utente è in italiano** (interfaccia, messaggi, commit, documenti).

## Fuori ambito (motivo di blocco in revisione)

Non si scrive codice, dato, testo o dipendenza che riguardi:
- BIM, ISO 19650, UNI 11337; stati WIP/Shared/Published, MIDP/TIDP;
- BCF e clash; Revit, ACC, IFC;
- Electron o altri client desktop;
- integrazione con GoodDay (niente import, niente lettura).

## Comandi

Node **24** (`engines >=24`, richiesto da AdonisJS 7). Nel container: `export PATH=/opt/node24/bin:$PATH`
(vedi `docs/sviluppo/ambiente.md`).

| Comando | Cosa fa |
|---|---|
| `npm run db:locale -- init` | PostgreSQL locale: cluster, utente `cruscotto`, DB dev/test/e2e |
| `npm run db:locale -- crea-db cruscotto_test_<agente>` | DB di test del singolo agente |
| `npm run db:ricrea` | ricrea lo schema del DB di `.env` e carica i dati di esempio |
| `npm run dev` | server di sviluppo con HMR (http://localhost:3333, login su `/accesso`) |
| `npm run verifica` | typecheck + lint + dipendenze native + test unit + funzionali (**deve essere verde prima di ogni merge**) |
| `npm run test:unit` / `npm run test:functional` | singole suite Japa |
| `npm run e2e` | smoke Playwright (DB `cruscotto_e2e` ricreato ogni volta) |
| `npm run screenshot` | pagine × ruoli, larghezza PC (1280 px) e telefono (390 px), in `screenshots/` (ignorata da git); da qui si ritagliano le immagini della guida Word (`docs/pilota/guida-word/LEGGIMI.md`) |
| `npm run vendorizza` | ricopia HTMX, Alpine e font Lora in `public/` dopo un cambio di versione |
| `npm run pacchetto` | zip di installazione per Windows Server in `tmp/pacchetto/` |
| `node ace db:inizializza-produzione` | migrazioni + configurazione iniziale (idempotente; rifiuta un DB con i dati di esempio) |
| `node ace utenti:crea-admin --email … --nome "…"` | primo amministratore con password temporanea (account locali) |
| `node ace certificato:scadenza` | giorni alla scadenza del certificato PFX (uscita 1 sotto la soglia) |

Test mirati:
- un file: `node ace test functional --files tests/functional/ore/ore.spec.ts`;
- un test per titolo: `node ace test unit --tests "<titolo esatto del test>"`;
- un solo scenario e2e: `npx playwright test e2e/pilota.smoke.ts`;
- i passi di `verifica` uno per uno: `npm run typecheck`, `npm run lint` (`npm run format` per sistemare).

Per agente: `DB_DATABASE=cruscotto_test_<agente> PORT=<porta> npm run verifica`
(E2E: `E2E_DB_DATABASE`, `E2E_PORT`). Il cluster PostgreSQL locale sta in `/tmp` e si
perde al riavvio del container: se i test falliscono con `ECONNREFUSED`, esegui
`npm run db:locale -- init`.

## Architettura in breve

- **Una richiesta:**
  1. `start/routes.ts` importa i `routes.ts` dei moduli.
  2. Il controller carica la commessa con `commessaCorrente()` (`app/shared/commessa_corrente.ts`, che autorizza `vedeCommessa`) e controlla le altre abilità di `app/abilities/main.ts`.
  3. Legge da `queries.ts` e calcola con le funzioni pure di `app/domain/*`.
  4. Scrive con `aggiornaConVersione` (`app/shared/optimistic.ts`, 409 con il frammento aggiornato) e `registraAudit`.
  5. Chiama `pubblica()` (`app/shared/eventi.ts`), che manda l'evento SSE via Transmit sul canale della commessa.
  6. `resources/js/app.js` fa ricaricare i frammenti HTMX interessati.
- **Pagine:** generate dal server con Edge + HTMX + Alpine (vendorizzati in `public/vendor`). Nessuna SPA. I grafici (curva S, PPC, Pareto, CFD) sono SVG prodotti da funzioni TS pure dentro i moduli.
- **Storico congelato:** i moduli registrano job in-process con `registraJob()` (`app/shared/scheduler.ts`); `start/scheduler.ts` li avvia solo nel processo web. I job scrivono `snapshot_lps`, `snapshot_lookahead` e `snapshot_evm`. Curva S e storico PPC si leggono dagli snapshot e non si ricalcolano. La baseline approvata congela pesi, BAC e PV settimanale.
- **Login (`AUTH_MODE`):**
  - `oidc`: Entra ID con `openid-client` lato server;
  - `locale`: email + password scrypt, cambio obbligatorio al primo accesso, blocco dopo 5 tentativi; è la modalità del pilota;
  - `dev`: `/dev/login?come=pm1`, con utenti admin, direzione, pm1, pm2, mec1, mec2, ele1, ele2, idr1, qualita. È rifiutato in produzione dai controlli di `app/shared/avvio.ts`.
- **Deploy:** `deploy/pacchetto.mjs` crea lo zip. `deploy/windows/*.ps1` e WinSW (`cruscotto.xml`) lo installano su Windows Server 2019 con PostgreSQL 17 e Node 24 in zip. HTTPS è gestito direttamente da Node con un PFX (`HTTPS_PFX_PATH`). I comandi ace di produzione stanno in `commands/`.

## Come si lavora per moduli

- Ogni modulo vive in `app/modules/<modulo>/`: `routes.ts`, controller, `queries.ts`
  (letture), eventuali servizi; viste in `resources/views/modules/<modulo>/`;
  test in `tests/functional/<modulo>/`.
- `start/routes.ts` importa solo i `routes.ts` dei moduli.
- Un modulo **scrive solo sulle proprie tabelle** (vedi `docs/sviluppo/contratti.md`).
  Le letture incrociate passano dalle funzioni di `queries.ts` dell'altro modulo.
- Le formule stanno in `app/domain/*.ts` (TS puro, senza DB). Le firme sono un
  contratto: non si cambiano senza l'orchestratore. I test del verificatore T1
  (`tests/unit/domain/`) non si modificano.
- Ogni modifica a dati condivisi usa `aggiornaConVersione` (409 se la versione è
  cambiata) e `registraAudit`; dopo il commit si chiama `pubblica(commessaId, tipo)`.
- Permessi solo con le abilità Bouncer di `app/abilities/main.ts` (`docs/sviluppo/permessi.md`).
- Nessuna classifica o KPI per persona (art. 4 Statuto dei lavoratori): solo per commessa o team.
- Grafica: Climosfera Design System (`docs/design-system/`). Token in `resources/css/tokens.css`, solo tema chiaro, solo font Lora, niente icone né frecce nel testo, raggi 0, niente ombre; regole e deroghe in `docs/sviluppo/grafica.md`. Non usare `npm run format` su tutto il repo: riformatta anche le viste Edge.
- Formattazione con `formato.*` (it-IT, `n.d.` per i valori non calcolabili),
  semafori solo con `app/domain/soglie.ts`, testi delle sigle da `app/ui/glossario.ts`.
- Nessuna dipendenza nativa (`npm run controlla-dipendenze`); script npm portabili (niente bash).
- A fine lavoro: `docs/sviluppo/handoff/<agente>.md`.

## Proprietà dei file (sintesi)

| File | Proprietario |
|---|---|
| `package.json`, lockfile, `adonisrc.ts`, `start/*`, `config/*` | orchestratore |
| `app/domain/types.ts`, `app/shared/*`, `app/abilities/*`, `app/models/*` | orchestratore |
| `app/ui/*`, `resources/views/layouts/*`, `resources/views/components/*`, `resources/css`, `resources/js` | orchestratore |
| `database/migrations/0001…0007`, `database/seeders/*`, `database/dati_esempio.ts` | orchestratore (dalla Fase 1 solo migrazioni additive con prefisso del modulo) |
| `app/domain/evm.ts` · `lps.ts` · `flusso.ts` · `avvisi.ts` (corpi) | A5 · A2 · A3 · B1 |
| `app/modules/<modulo>/**`, `resources/views/modules/<modulo>/**`, `tests/functional/<modulo>/**` | agente del modulo |
| `tests/unit/domain/**`, `docs/formule/casi-di-prova.md` | T1 |
| `app/modules/accesso/**` (account locali), `commands/utenti_crea_admin.ts` | B6 |
| `app/modules/audit/**` | B3 |
| `deploy/**`, `database/seeders/produzione/**`, altri `commands/*`, parte HTTPS di `bin/server.ts` | B5 |

Tabella completa: `docs/sviluppo/proprieta-file.md`.

## Convenzioni in breve

Minuti interi per ore e budget; settimane = data del lunedì (Europe/Rome);
`timestamptz`; colonna `version` sulle tabelle modificabili; rapporti come decimali
0–1 (`null` se il divisore è 0). Dettagli: `docs/sviluppo/convenzioni.md`.
