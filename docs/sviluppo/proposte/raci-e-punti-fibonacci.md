# Proposte rimandate: RACI per disciplina e punti Fibonacci

**Stato:** proposta, da riprendere dopo il pilota. Nessun codice scritto.
**Data:** 01/10/2026.

## 1. Matrice RACI per disciplina

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

## 2. Punti Fibonacci

### Decisione aperta

Prima di sviluppare va deciso **dove** si stimano i punti. Sotto c'è la baseline
proposta, con le assunzioni dichiarate.

### Baseline: punti sugli impegni del piano settimanale

- **Dove:** sugli impegni del Last Planner, non sugli elaborati.
  - Gli elaborati hanno già `budget_minuti`, e l'EVM in ore si basa su quello.
  - Una seconda stima sullo stesso oggetto creerebbe due verità.
  - Sugli impegni i punti servono a una cosa sola: non promettere più di quanto il
    team riesce a fare in una settimana.
- **Scala:** 1, 2, 3, 5, 8, 13.
  - Oltre 13 l'impegno va diviso; un avviso lo segnala senza bloccare.
  - "?" vuol dire non stimato.
- **Dati:** colonna additiva `impegni.punti` (smallint, null, CHECK sui valori
  ammessi), con migrazione con prefisso `lps_`.
- **Cosa mostra l'app:**
  - nel piano settimanale: punti promessi e punti fatti, per commessa;
  - una "capacità indicativa": media dei punti fatti nelle ultime 4 settimane chiuse,
    per team o per commessa;
  - il PPC resta il conteggio degli impegni fatti, come da definizione LPS standard;
  - il "PPC pesato in punti" è solo un dato secondario;
  - formule in `app/domain/lps.ts` (corpo di A2), casi di prova in
    `docs/formule/casi-di-prova.md` (T1).
- **Vincoli:**
  - nessuna velocità o classifica per persona (art. 4 Statuto dei lavoratori);
  - i punti non si convertono in ore e non entrano in EVM, curva S o portafoglio;
  - gli snapshot LPS registrano i punti solo da quando la colonna esiste: lo storico
    non si ricalcola.

### Alternativa scartata (per ora)

Punti sugli elaborati come stima di complessità da confrontare con `budget_minuti`.
Si può riprendere se il pilota mostra che i budget in ore sono poco affidabili.

### Rischi

- Doppio lavoro di stima nella riunione settimanale.
- I punti diventano "ore travestite".
- Poco storico all'inizio: la capacità si mostra solo dopo 4 settimane chiuse.
- Da verificare con i 2 PM del pilota se la stima a punti in riunione è accettabile.

### Verifica (quando si sviluppa)

- Test funzionali in `tests/functional/lps/`: valori ammessi, 409 sulla versione.
- Test unit sulle formule di capacità.
- `npm run verifica` verde.
