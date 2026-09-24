# Permessi (Fase 0)

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
| `registraOre(proprietarioId)` | solo per sé | solo per sé | solo per sé | solo per sé | solo per sé |
| `vedeOrePerPersona(commessa)` | sì, se attivata⁴ | **mai** | sì, se attivata⁴ | no | no |
| `admin()` | sì | no | no | no | no |

1. PM della commessa: `commesse.pm_id = utente` oppure membro con ruolo di commessa `pm`.
   Il ruolo globale `pm` da solo **non** dà diritti su commesse di altri.
2. La direzione vede le commesse ma le viste per la direzione mostrano solo totali per
   commessa (regola da applicare nei moduli Obeya e portafoglio, Fase 2).
3. Il last planner di un impegno potrà segnare "fatto / non fatto" sulle proprie righe:
   regola aggiuntiva che scrive l'agente A2 nel modulo LPS.
4. Impostazione `ore.per_persona_visibili`, **disattivata** di default (art. 4 Statuto dei
   lavoratori, decisione D4). Le ore proprie sono sempre visibili al diretto interessato.

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

Il test completo "rotte × ruoli" è compito dell'agente B3 (Fase 2); in Fase 0 i casi
principali sono in `tests/functional/permessi.spec.ts`.
