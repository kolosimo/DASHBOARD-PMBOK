# Permessi (Fase 1)

Le abilità sono in `app/abilities/main.ts` e si usano con
`await bouncer.authorize(abilita, ...)` nei controller e con `@can('abilita', ...)` nei template.
Si basano sul **ruolo globale** dell'utente (`utenti.ruolo`) e sull'**appartenenza alla
commessa** (`commesse.pm_id` oppure `membri_commessa.ruolo_commessa`).
Un utente con `attivo = false` non ha nessun permesso e non può accedere.

Ruoli globali: `admin`, `direzione`, `pm`, `progettista`.
Ruoli di commessa: `pm`, `progettista`, `verificatore`, `osservatore`.

## Matrice

| Abilità | admin | direzione | PM della commessa¹ | membro (progettista, verificatore, osservatore) | non membro |
|---|---|---|---|---|---|
| `vedeCommessa(commessa)` | sì | sì (solo totali²) | sì | sì | no |
| `modificaCommessa(commessa)` | sì | no | sì | no | no |
| `gestisceLps(commessa)` | sì | no | sì | no³ | no |
| `spostaElaborati(commessa)` | sì | **mai** | sì | progettista e verificatore sì, osservatore no | no |
| `registraOre(proprietarioId)` | solo per sé | solo per sé | solo per sé | solo per sé | solo per sé |
| `vedeOrePerPersona(commessa)` | sì, se attivata⁴ | **mai** | sì, se attivata⁴ | no | no |
| `admin()` | sì | no | no | no | no |

1. PM della commessa: `commesse.pm_id = utente` oppure membro con ruolo di commessa `pm`.
   Il ruolo globale `pm` da solo **non** dà diritti su commesse di altri.
2. La direzione vede le commesse ma le viste per la direzione mostrano solo totali per
   commessa (regola da applicare nei moduli Obeya e portafoglio, Fase 2).
3. L'esito di un impegno ("fatto / non fatto" e causa) lo segnano PM e admin su tutte le
   righe e il last planner assegnato sulle proprie (regola del modulo LPS, 403 altrimenti).
4. Impostazione `ore.per_persona_visibili`, **attiva** di default per decisione dell'utente al
   Gate 0 (28/09/2026). Prima del go-live servono informativa ai dipendenti e verifica art. 4
   Statuto dei lavoratori (D4). Restano vietate classifiche e KPI di performance per persona. Le ore proprie sono sempre visibili al diretto interessato.

## Rotte (Fase 0)

| Rotta | Chi | Esito per chi non può |
|---|---|---|
| `/accesso`, `/auth/login`, `/auth/callback` | chiunque (non autenticato) | — |
| `/dev/login` | chiunque, **solo con AUTH_MODE=dev** | 404 in produzione (la rotta non esiste) |
| `POST /auth/logout` | autenticati | redirezione ad `/accesso` |
| `/`, `/portafoglio`, `/ore` | autenticati | redirezione ad `/accesso` |
| `/commesse/:id/**` | `vedeCommessa` | 403 (404 se la commessa non esiste) |
| `/admin`, `POST /admin/impostazioni/:id` | `admin` | 403 |
| `/__transmit/*` (SSE) | autenticati; canale `commesse/:id` con `vedeCommessa` | 401 / iscrizione rifiutata |

## Rotte dei moduli (Fase 1)

| Rotta | Chi | Esito per chi non può |
|---|---|---|
| `GET /commesse/:id/anagrafica` | `vedeCommessa` (in sola lettura senza `modificaCommessa`) | 403 |
| `POST /commesse/:id/anagrafica/**`, `/team`, `/milestone`, `/elaborati/**` (A1) | `modificaCommessa` | 403 |
| `/admin/**` (commesse, utenti e ruoli, discipline, stati e pesi, colonne e WIP, cause) | `admin` | 403 |
| `GET /commesse/:id/lps/**` | `vedeCommessa` | 403 |
| `POST /commesse/:id/lps/**` (lookahead, vincoli, promessa e chiusura del piano) | `gestisceLps` | 403 anche ai POST (niente redirect indietro) |
| `POST` esito di una riga del piano | `gestisceLps` oppure last planner della riga | 403 |
| `GET /commesse/:id/flusso/**` | `vedeCommessa` (board in sola lettura senza `spostaElaborati`) | 403 |
| `POST /commesse/:id/flusso/elaborati/:elaboratoId/stato` | `spostaElaborati` | 403 |
| `/ore`, `POST /ore/celle` | autenticati; `registraOre` solo per sé | 403 |
| `GET /ore/correzione`, `POST /ore/correzione/celle` | `admin`; motivo obbligatorio, anche su settimane chiuse | 403 |
| `GET /commesse/:id/ore` | `vedeCommessa`; dettaglio per persona con `vedeOrePerPersona` | 403 |
| `GET /commesse/:id/evm/**` | `vedeCommessa` | 403 |
| `POST /commesse/:id/evm/baseline/**` (bozza, mancanti, approvazione, scarto) | `modificaCommessa` | 403 |

Le abilità negate da Bouncer sulle scritture (POST, PUT, PATCH, DELETE) rispondono **403**
anche per i form HTML: il gestore degli errori (`app/exceptions/handler.ts`) non fa il
redirect indietro previsto da Bouncer; alle richieste HTMX aggiunge un toast
(`HX-Trigger`) con il messaggio.

Il test completo "rotte × ruoli" è compito dell'agente B3 (Fase 2); in Fase 0 i casi
principali sono in `tests/functional/permessi.spec.ts`.
