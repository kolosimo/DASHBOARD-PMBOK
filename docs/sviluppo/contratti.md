# Contratti tra moduli (Fase 0, aggiornati alla Fase 2)

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
| anagrafiche | `commessaConTeam(commessaId)`, `milestoneProssime(commessaId, daData, limite)` | **implementata** (Fase 1, A1) |
| lps | `riepilogoLps(commessaId, settimana)`, `paretoCause(commessaId, da, a)` | **implementata** (Fase 1, A2) |
| flusso | `riepilogoFlusso(commessaId, oggi)` | **implementata** (Fase 1, A3) |
| ore | `oreCommessa(commessaId, settimana)` | **implementata** (Fase 1, A4)⁵ |
| evm | `riepilogoEvm(commessaId, dataStato)`, `serieCurvaS(commessaId, oggi?)` | **implementata** (Fase 1, A5)⁶ |
| obeya | `avvisiCommessa(commessaId)`, `datiObeya(...)` | **implementata** (Fase 2, B1) |
| portafoglio | `righePortafoglio(utente)`, `totaliPortafoglio(righe)` | **implementata** (Fase 2, B1)⁷ |
| admin | `elencoImpostazioni()` | **implementata** |
| elaborato_dettaglio | `schedaElaborato(commessaId, elaboratoId, oggi)` (null se l'elaborato non è della commessa → 404) | **implementata** (Fase 2, B4)⁸ |
| flusso | `statiAllIstante`, `posizioneNelFlusso`, `storicoElaborato`; servizio `CambioStatoService.registraCreazione`, `statoInizialeSeConfigurato` | **implementata** (Fase 2, B4) |
| evm | `elaboratoInBaselineApprovata(elaboratoId)` | **implementata** (Fase 2, B4) |
| ore | `minutiPerElaborato`, `orePerPersonaElaborato`, `oreSettimanaliElaborato` | **implementata** (Fase 2, B4) |
| lps | `collegamentiElaborato(elaboratoId)` | **implementata** (Fase 2, B4) |
| audit | `vociRegistro(filtri)`, `utentiPerFiltro()`, `entitaPresenti()` | **implementata** (Fase 2, B3) |

5. `oreCommessa`: `perElaborato[].minutiTotali` e `totaleCommessaMinuti` sono il **cumulato
   fino alla domenica della settimana** indicata (utilizzabile dall'EVM come AC a quella
   data). Campo additivo `perElaborato[].titolo`.
6. Campi additivi e compatibili: `RiepilogoEvm` estende gli indicatori con `commessaId`,
   `baselineId`, `baselineNumero` e altri dati della baseline; `PuntoCurvaSEvm` estende
   `PuntoCurvaS` con `rettificato` e `acRettificatoMinuti` (snapshot rettificati dopo lo
   scatto). `serieCurvaS` ha il parametro facoltativo `oggi` (default: oggi a Roma).

7. Il PPC delle ultime 4 settimane del portafoglio legge ancora direttamente
   `piani_settimanali` e `impegni` (sola lettura, una query): da sostituire con una
   lettura del modulo LPS per più commesse (richiesta aperta ad A2).
8. Terzo parametro `oggi` (data di Roma) aggiunto rispetto alla firma di Fase 0.

Scritture di Fase 2 fuori dal proprio modulo, concordate:
- colonne `utenti.password_hash`, `deve_cambiare_password`, `tentativi_falliti`,
  `bloccato_fino`: le scrive **solo il modulo accesso** (`account_locali.ts`), anche
  quando l'azione parte dal pannello admin (creazione, reimpostazione, sblocco);
- `commesse` e `membri_commessa` alla creazione di una commessa: `app/modules/admin/crea_commessa.ts`,
  usato da `/admin/commesse` e da `/commesse/nuova` (PM).

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
li importa in `start/scheduler.ts`. Registrati in Fase 1:

| Job | Modulo | Quando |
|---|---|---|
| `lps.snapshot_settimanali` | lps | ogni giorno alle 06:10 (Roma), idempotente |
| `evm.snapshot` | evm | ogni giorno alle 06:10 (Roma), idempotente; segna le rettifiche |
