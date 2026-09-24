# Convenzioni di sviluppo

## Lingua
- Interfaccia, messaggi d'errore, commenti, commit, documenti: **italiano**.
- Nomi di tabelle, colonne, funzioni e variabili del dominio in italiano (`commesse`,
  `aggiornaConVersione`). Le sigle standard restano in inglese (SPI, CPI, PPC…) con la
  spiegazione del glossario (`app/ui/glossario.ts`).
- EAC si mostra come "Stima a completamento", ETC come "Ore ancora necessarie".

## Fuori ambito
BIM (ISO 19650, UNI 11337, stati WIP/Shared/Published, MIDP/TIDP), BCF e clash,
Revit/ACC/IFC, Electron, integrazione GoodDay. Il revisore T2 blocca il merge.

## Dati
| Cosa | Regola |
|---|---|
| Ore, budget, durate | `integer` in **minuti** (`Minuti`); si mostrano in ore con `formato.ore` / `formato.oreEsatte` |
| Settimane | colonna `date` con il **lunedì** (Europe/Rome), vincolo CHECK `isodow = 1`; tipo `Lunedi` |
| Date senza ora | stringa `'YYYY-MM-DD'` (`DataIso`); il driver pg non le converte (type parser 1082) |
| Istanti | `timestamptz`, in TS `DateTime` di luxon; per giorno/settimana si passa da `#shared/calendario` |
| Rapporti (SPI, CPI, PPC, PCR, TMR, TA) | decimali (PPC 0,714 = 71%); `null` se il divisore è 0 → "n.d." |
| Optimistic locking | colonna `version` (default 1) su ogni tabella modificabile; aggiornare solo con `aggiornaConVersione` |
| Storico | `transizioni_elaborato`, `audit_log`, snapshot: solo inserimenti |
| Enumerazioni | testo con vincolo CHECK; costanti in `app/domain/types.ts` |

## Codice
- TypeScript strict, ESLint + Prettier (`npm run lint`, `npm run format`).
- Import con i subpath: `#modules/*`, `#domain/*`, `#shared/*`, `#ui/*`, `#models/*`,
  `#abilities/*`, `#start/*`, `#config/*`, `#database/*`, `#tests/*`.
- `app/domain/*`: TS puro, nessun import da Lucid, HTTP o Edge.
- Letture complesse in `queries.ts` del modulo con una query SQL (niente N+1).
- Scritture: una transazione; `aggiornaConVersione` + `registraAudit`; `pubblica()` dopo il commit.
- Pagine generate dal server (Edge) con HTMX per gli aggiornamenti parziali e Alpine per
  piccole interazioni locali. Niente framework SPA.
- Richieste HTMX: il token CSRF va nell'intestazione `X-CSRF-TOKEN` (automatico in `resources/js/app.js`).
  Le risposte 409 e 422 vengono comunque inserite nella pagina.
- Per mostrare un conflitto: il frammento da sostituire include `components/conflitto` in cima
  (vedi `modules/admin/_impostazione.edge`).
- Componenti Edge condivisi: `kpi`, `pill` (semaforo), `pannello`, `tabella`, `conflitto`,
  `toast`, `segnaposto` in `resources/views/components/`.
- Script npm portabili (Node, niente bash / `rm -rf`). Nessuna dipendenza nativa.

## Test
- Japa: `tests/unit/**` (senza server) e `tests/functional/**` (server HTTP di test su
  `PORT`, DB `DB_DATABASE`). Schema ricreato e dati di esempio caricati all'avvio della
  suite; ogni test funzionale gira in una transazione annullata (`conTransazione(group)`).
- `tests/helpers/browser.ts`: fetch con cookie, `loginSviluppo('pm1')`, `Browser.csrfDa(html)`.
- Playwright: file `e2e/*.smoke.ts` (smoke) e `e2e/*.screenshot.ts`.

## Git
- Commit piccoli, messaggi in italiano. Un branch per agente, merge `--no-ff` solo
  dall'orchestratore dopo `npm run verifica` verde.
- Mai modificare `prototipo/` e `docs/ricerca/`.
