# Come chiedere modifiche a Claude

Guida per l'ingegnere che mantiene il Cruscotto con l'aiuto di Claude (Claude Code).
Non serve saper programmare in TypeScript: serve sapere **cosa chiedere**, **dove sta
cosa** e **come controllare** che il risultato sia buono.

Claude legge da solo il file `CLAUDE.md` nella radice del progetto: lì ci sono le regole
del progetto (lingua, moduli, fuori ambito, comandi). Questa guida è la versione per
te di quelle stesse regole.

## 1. Le tre regole da ricordare

1. **Tutto in italiano**: interfaccia, messaggi, documenti, messaggi di commit.
2. **Fuori ambito**: il Cruscotto **non** tratta BIM (ISO 19650, UNI 11337, stati
   WIP/Shared/Published, MIDP/TIDP), BCF e clash, Revit, ACC, IFC, client desktop
   (Electron) né l'integrazione con GoodDay. Se chiedi qualcosa del genere Claude deve
   rifiutare o chiederti conferma di cambiare la decisione: è una scelta di progetto,
   non una dimenticanza. Per cambiarla va aggiornato prima
   `docs/00-sintesi-e-decisioni.md`.
3. **Niente classifiche o KPI per persona** (art. 4 Statuto dei lavoratori): gli
   indicatori sono per commessa o per team. Una richiesta tipo "fammi la classifica dei
   progettisti per ore" va rifiutata.

E prima di accettare qualsiasi modifica: **`npm run verifica` deve essere verde**.

## 2. Dove sta cosa

| Voglio cambiare… | Dove si trova |
|---|---|
| Una formula (SPI, CPI, PPC, PCR, età nello stato…) | `app/domain/evm.ts`, `lps.ts`, `flusso.ts`, `avvisi.ts`; descrizione in `docs/formule/formule.md` |
| I colori dei semafori (logica) | `app/domain/soglie.ts` (i **valori** delle soglie si cambiano dall'app, in Amministrazione) |
| Il testo di spiegazione di una sigla | `app/ui/glossario.ts` (nell'app) e `docs/utente/glossario.md` (per gli utenti) |
| Come si mostrano numeri, ore, date, "n.d." | `app/ui/formato.ts` |
| Le voci di menu e le schede della commessa | `app/ui/nav.ts` |
| Una pagina (testi, colonne di una tabella) | `resources/views/modules/<modulo>/*.edge` |
| Cosa fa una pagina (dati letti, salvataggi) | `app/modules/<modulo>/` (`routes.ts`, controller, `queries.ts`) |
| Chi può fare cosa (permessi) | `app/abilities/main.ts`, spiegati in `docs/sviluppo/permessi.md` |
| Aspetto grafico (colori, font, spaziature) | `resources/css/app.css`, componenti in `resources/views/components/` |
| Struttura del database | `database/migrations/` (le prime 7 sono congelate: si aggiungono solo migrazioni nuove) |
| Dati di esempio | `database/dati_esempio.ts` |
| Valori di partenza delle impostazioni | `app/shared/impostazioni.ts` |
| Guide per gli utenti | `docs/utente/` |
| Regole di sviluppo | `CLAUDE.md`, `docs/sviluppo/` |

I moduli sono: `anagrafiche` e `admin` (commesse, team, configurazione), `lps` (Last
Planner: lookahead, vincoli, piano settimanale), `flusso` (Kanban), `ore` (timesheet),
`evm` (avanzamento in ore), `obeya` (pagina Commessa), `portafoglio`,
`elaborato_dettaglio` (scheda elaborato), più `accesso` e `home`.

Regola importante: **ogni modulo scrive solo sulle proprie tabelle** e legge quelle
degli altri solo attraverso le loro funzioni `queries.ts`. Se una modifica ne tocca più
d'uno, Claude deve dirtelo.

## 3. I comandi

Si lanciano dal terminale nella cartella del progetto. Sul server di sviluppo Linux
serve prima `export PATH=/opt/node24/bin:$PATH` (Node 24).

| Comando | A cosa serve | Quando |
|---|---|---|
| `npm run dev` | avvia l'app in locale su http://localhost:3333 | per provare a mano |
| `npm run verifica` | controllo completo: tipi, stile, dipendenze, test | **prima di ogni modifica accettata** |
| `npm run test:unit` / `npm run test:functional` | solo una parte dei test | per andare più veloci mentre si lavora |
| `npm run e2e` | prova nel browser dei percorsi principali | prima di un rilascio |
| `npm run screenshot` | foto di tutte le pagine per ogni ruolo, tema chiaro e scuro, nella cartella `screenshots/` | per vedere le modifiche all'interfaccia |
| `npm run db:ricrea` | ricrea il database di sviluppo con i dati di esempio | se i dati di prova sono "sporchi" (**cancella tutto il DB di sviluppo**) |
| `npm run db:locale -- init` | prepara PostgreSQL nel container di sviluppo | dopo un riavvio del container |

In sviluppo si entra senza Microsoft 365 con `/dev/login?come=pm1` (utenti: admin,
direzione, pm1, pm2, mec1, mec2, ele1, ele2, idr1, qualita). Questo accesso **non esiste
in produzione**.

### Cosa controlla `npm run verifica`

Tipi TypeScript, regole di stile (lint), assenza di dipendenze "native" (che non si
installerebbero sul server Windows), test unitari (formule) e test funzionali (pagine e
permessi). Se è **verde** la modifica non ha rotto nulla di ciò che è coperto dai test.
Se è **rossa**, non accettare la modifica: chiedi a Claude di correggere.

Attenzione ai test delle formule in `tests/unit/domain/`: sono calcolati a mano
(`docs/formule/casi-di-prova.md`). Claude **non deve modificarli** per farli passare. Se
cambia una formula per tua decisione, prima si aggiornano `docs/formule/formule.md` e i
casi di prova, poi il codice.

## 4. Come fare una buona richiesta

Una buona richiesta dice **cosa**, **dove**, **per chi** e **come verificare**.

Schema:

> **Cosa voglio**: …
> **Dove**: pagina / modulo / file, se lo sai.
> **Chi lo vede o lo usa**: ruoli (admin, direzione, PM, progettista).
> **Esempio con i dati di esempio**: con CL-2026-031 mi aspetto …
> **Vincoli**: niente classifiche per persona, testi in italiano, …
> **Alla fine**: `npm run verifica` verde, screenshot della pagina, commit.

### Esempi ben fatti

**Cambiare un testo.**
> Nella scheda Kanban, sotto il titolo, sostituisci la frase iniziale con: "Sposta un
> elaborato di uno stato alla volta; per tornare indietro serve un motivo." File:
> `resources/views/modules/flusso/`. Poi `npm run verifica` e `npm run screenshot` e
> mandami lo screenshot della pagina per pm1.

**Aggiungere una colonna.**
> Nel portafoglio aggiungi la colonna "Stima a completamento (h)" dopo CPI, formattata
> con `formato.ore` e "n.d." se manca. Deve comparire anche alla direzione (è un totale
> di commessa). Con i dati di esempio per CL-2026-031 mi aspetto 561 h circa. Aggiungi
> un test funzionale e fai verifica.

**Cambiare una regola di calcolo (formula).**
> Voglio che il PPC conti anche gli impegni aggiunti dopo la promessa, ma solo se sono
> fatti. Prima aggiorna `docs/formule/formule.md` e i casi in
> `docs/formule/casi-di-prova.md` con un esempio calcolato a mano (W39: 5 fatti su 7 +
> 1 aggiunto fatto → ?), fammeli vedere e **aspetta il mio ok**; poi cambia il codice e
> i test.

**Segnalare un errore** (caso inventato, solo per mostrare lo schema).
> Accedendo come ele1, nella pagina "Le mie ore" della settimana W39, se scrivo 2,5 nella
> cella di martedì per ELE-SC-201 e salvo, il totale mostra 25. Mi aspetto 2,5. Trova la
> causa, aggiungi un test che riproduce l'errore, correggi, `npm run verifica`.

**Cambiare un permesso.**
> Voglio che il verificatore di una commessa possa segnare fatto/non fatto anche sugli
> impegni degli altri. Dimmi quali file cambi (`app/abilities/main.ts`,
> `docs/sviluppo/permessi.md`), aggiungi i test per verificatore e progettista e fai
> verifica.

### Richieste da evitare (o da riformulare)

| Richiesta | Problema | Meglio |
|---|---|---|
| "Sistema il portafoglio" | non dice cosa | "Nel portafoglio la colonna PPC mostra 0% invece di n.d. per CL-2025-077" |
| "Fai la classifica dei progettisti per ore registrate" | vietato (art. 4) | "Mostra le ore totali per disciplina della commessa" |
| "Importa le ore da GoodDay" | fuori ambito | inserimento o import da Excel dentro il Cruscotto, se deciso |
| "Collega i modelli Revit" | fuori ambito (BIM) | — |
| "Fai passare i test" | rischia di far cambiare i test invece del codice | "Il test X fallisce: trova la causa nel codice; i test delle formule non si toccano" |
| "Cambia il peso di Verificato a 80%" | è un dato, non codice | si cambia dall'app, Amministrazione (quando la schermata sarà pronta) |

## 5. Controllare il lavoro di Claude

Prima di dire "va bene":

1. **`npm run verifica` è verde?** Chiedi a Claude di mostrarti l'ultima riga.
2. **Lo vedi funzionare?** `npm run dev` e prova con l'utente giusto
   (`/dev/login?come=pm1`), oppure chiedi gli screenshot.
3. **I numeri tornano con i dati di esempio?** Per CL-2026-031 al 24/09/2026: SPI 0,78,
   CPI 0,76, stima a completamento 560,7 h, PPC W39 71% (vedi
   `docs/utente/glossario.md`).
4. **Il testo è in italiano e comprensibile?** I valori mancanti devono comparire come
   "n.d.", non come 0, "NaN" o vuoto.
5. **Sono cambiati solo i file attesi?** Chiedi "quali file hai modificato e perché".
6. **Il commit ha un messaggio in italiano** che spiega cosa cambia.

## 6. Se qualcosa va storto

- **La verifica è rossa e non capisci perché**: copia l'errore e chiedi "spiegami in
  italiano semplice cosa non va e proponi la correzione, senza toccare i test delle
  formule".
- **Il database di sviluppo è in uno stato strano**: `npm run db:ricrea` (solo in
  sviluppo: cancella tutti i dati di quel DB).
- **Dopo un riavvio del container il database non risponde**: `npm run db:locale -- init`
  e poi `npm run db:ricrea`.
- **Una modifica è andata in produzione e crea problemi**: non correggere al volo sul
  server. Chiedi a Claude di annullare il commit (`git revert`) e di rilasciare di nuovo
  con gli script di aggiornamento (vedi `docs/installazione/`, in preparazione).
