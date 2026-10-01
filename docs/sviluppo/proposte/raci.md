# Proposta rimandata: matrice RACI per disciplina

**Stato:** proposta, da riprendere dopo il pilota. Nessun codice scritto.
**Data:** 01/10/2026.

I punti Fibonacci, prima in questa proposta, sono stati integrati nell'app il
01/10/2026: vedi `docs/formule/formule.md` (Punti Fibonacci e capacità indicativa) e la
guida del PM.

## Matrice RACI per disciplina

### Cosa esiste già (verificato nel codice)

- **R (chi esegue):**
  - `elaborati.responsabile_id`: un responsabile per elaborato;
  - `impegni.last_planner_id` e `attivita_lookahead.responsabile_id`;
  - `vincoli.responsabile_id`: chi rimuove il vincolo.
- **A (chi risponde):** implicito, il PM della commessa (`membri_commessa.ruolo_commessa = 'pm'`).
- **Verifica:** il ruolo `verificatore` vale per tutta la commessa, non per elaborato.
- **C e I** (architetto, strutturista, committente, VVF): non esistono. Le parti esterne
  compaiono solo come testo libero in `vincoli.responsabile_esterno`.

### Proposta

Una RACI completa per elaborato e per persona duplicherebbe dati già presenti e
andrebbe tenuta a mano: decadrebbe in fretta. Si propone una RACI **per disciplina o
area**. R e A si **ricavano** dai dati; si aggiungono solo i soggetti **C/I esterni**,
che oggi mancano davvero.

1. **Migrazione additiva `anagrafiche_…_raci`.** Tabella `raci_commessa` con
   `commessa_id`, `ambito` (MEC, ELE, IDR, ANT o "Generale"), `soggetto`,
   `tipo_soggetto` (persona del team o esterno), `ruolo` (R, A, C, I) e `version`.
   Vincoli:
   - una sola A per ambito;
   - R e A solo per persone del team;
   - gli esterni solo C o I.
2. **Pannello "Responsabilità (RACI)"** nella scheda Anagrafica
   (`app/modules/anagrafiche/**`):
   - griglia con gli ambiti in riga e i soggetti in colonna;
   - R e A precompilati dai dati;
   - C/I esterni modificabili dal PM;
   - scrittura con `aggiornaConVersione`, `registraAudit` e `pubblica()`.
3. **Avvisi di coerenza**, che non bloccano:
   - ambito senza A;
   - responsabile di un elaborato fuori dagli R della sua disciplina;
   - vincolo assegnato a un esterno che non è C nell'ambito.

   Gli avvisi entrano in "Da affrontare in riunione" (Obeya) tramite
   `app/domain/avvisi.ts`, da coordinare con B1.
4. **Permessi:** nuova abilità `gestisceRaci` (PM e admin) in `app/abilities/main.ts`;
   lettura per tutto il team.

**Fuori ambito:** RACI per singolo elaborato, export, notifiche agli esterni.

**Verifica:**
- test in `tests/functional/anagrafiche/raci.spec.ts`: unicità della A, R e A solo
  per il team, 409 sulla versione vecchia, permessi;
- `npm run verifica` ed e2e verdi;
- guide utente aggiornate.
