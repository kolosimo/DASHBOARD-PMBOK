# Proprietà dei file

Chi può modificare cosa. I file "condivisi" li cambia **solo l'orchestratore**: un
agente che ne ha bisogno lo scrive nel proprio handoff (`docs/sviluppo/handoff/<agente>.md`)
con la modifica proposta.

| Percorso | Proprietario | Note |
|---|---|---|
| `package.json`, `package-lock.json`, `adonisrc.ts`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts` | orchestratore | nuove dipendenze solo senza script di installazione |
| `start/*` (routes, kernel, env, view, transmit, scheduler) | orchestratore | `start/routes.ts` importa solo i routes dei moduli |
| `config/*` | orchestratore | |
| `app/domain/types.ts`, `app/domain/soglie.ts` | orchestratore | tipi e semaforo unico |
| `app/domain/evm.ts` | A5 (corpi) | firme e JSDoc fissati in Fase 0 |
| `app/domain/lps.ts` | A2 (corpi) | idem |
| `app/domain/flusso.ts` | A3 (corpi) | idem |
| `app/domain/avvisi.ts` | B1 (corpi) | idem |
| `app/shared/*` (audit, optimistic, calendario, impostazioni, eventi, scheduler, appartenenza, commessa_corrente, avvio) | orchestratore | |
| `app/abilities/main.ts`, `app/middleware/*`, `app/exceptions/*` | orchestratore | |
| `app/models/*` | orchestratore | un modulo può chiedere metodi o relazioni in più |
| `app/ui/*` (formato, glossario, nav) | orchestratore | glossario rivisto con T3 |
| `resources/views/layouts/*`, `resources/views/components/*`, `resources/views/pages/*` | orchestratore | |
| `resources/css/app.css`, `resources/js/app.js`, `public/vendor`, `public/fonts` | orchestratore | |
| `database/migrations/0001…0007_*` | orchestratore | **congelate**: dalla Fase 1 solo nuove migrazioni additive `<timestamp>_<modulo>_<descrizione>.ts` |
| `database/seeders/*`, `database/dati_esempio.ts`, `database/colonne_comuni.ts` | orchestratore | |
| `app/modules/accesso/**`, `app/modules/home/**` | orchestratore | login e home |
| `app/modules/anagrafiche/**`, `app/modules/admin/**` | A1 | `commesseVisibili` e l'aggiornamento impostazioni esistono già |
| `app/modules/lps/**` | A2 | |
| `app/modules/flusso/**` | A3 | unico a scrivere `elaborati.stato_id` (CambioStatoService) |
| `app/modules/ore/**` | A4 | |
| `app/modules/evm/**` | A5 | |
| `app/modules/obeya/**`, `app/modules/portafoglio/**` | B1 (Fase 2) | |
| `app/modules/elaborato_dettaglio/**` | B4 (Fase 2) | |
| `resources/views/modules/<modulo>/**`, `tests/functional/<modulo>/**` | agente del modulo | |
| `tests/unit/domain/**`, `docs/formule/casi-di-prova.md` | T1 | gli agenti di modulo non li modificano |
| `tests/helpers/*`, `tests/bootstrap.ts`, `tests/unit/*.spec.ts` e `tests/functional/*.spec.ts` di Fase 0 | orchestratore | |
| `e2e/*`, `playwright*.config.ts` | orchestratore / QA | |
| `scripts/*` | orchestratore | |
| `docs/sviluppo/*`, `CLAUDE.md` | orchestratore | |
| `docs/formule/formule.md` | orchestratore (con T1) | |
| `docs/utente/**`, `docs/manutenzione/**` | T3 | |
| `deploy/windows/**`, `docs/installazione/**` | B5 | |
| `prototipo/`, `docs/ricerca/` | nessuno | congelati |

## Tabelle per modulo (chi scrive)

| Tabelle | Scrive |
|---|---|
| `commesse`, `membri_commessa`, `milestone`, `elaborati` (tranne `stato_id`/`stato_dal`), `limiti_wip_commessa` | A1 |
| `discipline`, `stati_elaborato`, `colonne_kanban`, `cause_non_completamento`, `impostazioni`, `utenti` (ruolo, attivo) | A1 (admin) |
| `utenti` (creazione al primo accesso, ultimo accesso) | accesso (orchestratore) |
| `elaborati.stato_id`, `elaborati.stato_dal`, `transizioni_elaborato` | A3 |
| `attivita_lookahead`, `vincoli`, `vincoli_attivita`, `piani_settimanali`, `impegni`, `snapshot_lookahead`, `snapshot_lps` | A2 |
| `registrazioni_ore` | A4 |
| `baseline`, `baseline_date_stato`, `baseline_pv_settimana`, `snapshot_evm`, `snapshot_evm_elaborato` | A5 |
| `audit_log` | tutti, solo tramite `registraAudit` |
