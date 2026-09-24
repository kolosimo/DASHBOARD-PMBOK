# Cruscotto commesse Climosfera: guida per Claude

App web multi-utente per le commesse di Climosfera (PMBOK + Lean): Last Planner,
Kanban degli elaborati, ore, EVM in ore, Obeya e portafoglio. Un solo linguaggio
(TypeScript), un solo server aziendale (Windows Server), PostgreSQL, login
Microsoft 365. Piano: `docs/sviluppo/piano.md`. Decisioni: `docs/00-sintesi-e-decisioni.md`.

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
| `npm run screenshot` | pagine × ruoli, tema chiaro e scuro, in `screenshots/` (ignorata da git) |
| `npm run vendorizza` | ricopia HTMX, Alpine e font IBM Plex in `public/` dopo un cambio di versione |

Per agente: `DB_DATABASE=cruscotto_test_<agente> PORT=<porta> npm run verifica`
(E2E: `E2E_DB_DATABASE`, `E2E_PORT`). Login di sviluppo: `/dev/login?come=pm1`
(utenti: admin, direzione, pm1, pm2, mec1, mec2, ele1, ele2, idr1, qualita).

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

Tabella completa: `docs/sviluppo/proprieta-file.md`.

## Convenzioni in breve

Minuti interi per ore e budget; settimane = data del lunedì (Europe/Rome);
`timestamptz`; colonna `version` sulle tabelle modificabili; rapporti come decimali
0–1 (`null` se il divisore è 0). Dettagli: `docs/sviluppo/convenzioni.md`.
