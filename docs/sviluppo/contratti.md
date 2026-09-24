# Contratti tra moduli (Fase 0)

I contratti permettono agli agenti della Fase 1 di lavorare in parallelo senza
aspettarsi. Firme e significato sono fissati; i corpi con `throw new Error('non implementato')`
li scrive l'agente proprietario **dopo** i test del verificatore T1.

## Formule di dominio (`app/domain/`, TS puro)

| File | Funzioni | Proprietario |
|---|---|---|
| `types.ts` | tipi condivisi (`Minuti`, `Lunedi`, `Indice`, ruoli, stati, `IndicatoriEvm`, `RisultatoPpc`…) | orchestratore |
| `soglie.ts` | `semaforo`, `classeSemaforo`, `etichettaSemaforo`, `SOGLIE_DEFAULT` (**implementato**) | orchestratore |
| `evm.ts` | `calcolaBac`, `calcolaEv`, `calcolaPv`, `calcolaAc`, `calcolaSpi`, `calcolaCpi`, `calcolaIndicatori`, `evmDaElaborati` | A5 |
| `lps.ts` | `calcolaPpc`, `calcolaPcr`, `calcolaTmrTa`, `paretoCause` | A2 |
| `flusso.ts` | `workItemAge`, `cycleTime`, `throughput`, `cfd`, `controllaPassaggioStato`, `sforaWip` | A3 |
| `avvisi.ts` | `generaAvvisi` | B1 |

Le formule esatte sono nei JSDoc e in `docs/formule/formule.md`.

## Query di lettura (`app/modules/<modulo>/queries.ts`)

| Modulo | Funzione | Stato |
|---|---|---|
| anagrafiche | `commesseVisibili(utente)` | **implementata** (home) |
| anagrafiche | `commessaConTeam(commessaId)`, `milestoneProssime(commessaId, daData, limite)` | firma |
| lps | `riepilogoLps(commessaId, settimana)`, `paretoCause(commessaId, da, a)` | firma |
| flusso | `riepilogoFlusso(commessaId, oggi)` | firma |
| ore | `oreCommessa(commessaId, settimana)` | firma |
| evm | `riepilogoEvm(commessaId, dataStato)`, `serieCurvaS(commessaId)` | firma |
| obeya | `avvisiCommessa(commessaId)` | firma |
| portafoglio | `righePortafoglio(utente)` | firma |
| admin | `elencoImpostazioni()` | **implementata** |
| elaborato_dettaglio | `schedaElaborato(commessaId, elaboratoId)` | firma |

Regola: un modulo **legge** i dati degli altri solo tramite queste funzioni e **scrive**
solo sulle proprie tabelle (`docs/sviluppo/proprieta-file.md`).

## Servizi condivisi (`app/shared/`)

| Servizio | API |
|---|---|
| `optimistic.ts` | `aggiornaConVersione(Modello, id, versioneAttesa, modifiche \| fn, { client?, audit?, rendiFrammento? })`; errore `ConflittoVersione` → 409 (frammento per HTMX, JSON, pagina) |
| `audit.ts` | `registraAudit({ utenteId, azione, entita, entitaId?, commessaId?, prima?, dopo?, ip? }, trx?)`, `istantaneaPerAudit(modello)` |
| `calendario.ts` | `lunediDellaSettimana`, `settimanaIso`, `lunediDaSettimanaIso`, `aggiungiSettimane`, `domenicaDi`, `giorniLavorativi`, `settimaneDa`, `differenzaSettimane`, `differenzaGiorni`, `oggiRoma`, `dataRoma`, `etichettaSettimana`, `settimaneNellAnno` |
| `impostazioni.ts` | `leggiImpostazione(chiave)`, `leggiTutteLeImpostazioni()`, `aggiornaImpostazione(...)`, `IMPOSTAZIONI_DEFAULT` |
| `eventi.ts` | `pubblica(commessaId, tipo, dati?)` sul canale SSE `commesse/<id>`; tipi in `TIPI_EVENTO` |
| `scheduler.ts` | `registraJob({ nome, descrizione, pianificazione, esegui })`, `eseguiOra(nome)`, `prossimaEsecuzione(p)` |
| `appartenenza.ts` | `ruoloNellaCommessa(utenteId, commessaId)`, `ePmDellaCommessa(utente, commessa)` |
| `commessa_corrente.ts` | `commessaCorrente(ctx, schedaAttiva)`: carica `:id`, 404/403, condivide la commessa con il layout |

## Tempo reale

- Server: `pubblica(commessaId, 'elaborato.stato_cambiato', { elaboratoId })` dopo il commit.
- Client: la pagina di una commessa (`<body data-commessa-id>`) si iscrive al canale; ogni
  evento genera l'evento DOM `evento-commessa` sul `body`; se SSE non è disponibile si genera
  `polling-commessa` ogni 30 s. Nei frammenti: `hx-trigger="evento-commessa from:body, polling-commessa from:body"`.

## Job pianificati

I moduli definiscono i job in `app/modules/<modulo>/jobs.ts` (per esempio lo snapshot
settimanale del lookahead e dell'EVM, lunedì alle 06:00 ora di Roma) e l'orchestratore
li importa in `start/scheduler.ts`.
