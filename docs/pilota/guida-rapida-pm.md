# Guida rapida per il PM del pilota

Due pagine per partire. La guida completa è in [guida-pm.md](../utente/guida-pm.md);
le sigle (PPC, SPI, CPI…) sono spiegate nel [glossario](../utente/glossario.md).
Se vedi qualcosa di diverso da quanto descritto, annotalo nel
[modulo di feedback](piano-del-pilota.md#6-modulo-di-feedback).

## 1. Primo accesso

1. Apri l'indirizzo che ti ha dato l'amministratore (per esempio
   `https://cruscotto.climosfera.local`) con **Edge** o **Chrome**; sul Mac va bene
   anche **Safari**.
2. Nella pagina di accesso scrivi la tua **Email** e la **Password** temporanea che
   ti ha dato l'amministratore, poi premi **Accedi**.
3. Al primo accesso l'app apre **Cambia password**: scrivi la nuova password in
   **Nuova password (almeno 12 caratteri)** e in **Ripeti la nuova password**, poi
   premi **Salva la nuova password**. Da quel momento vale solo la tua. Una frase di
   più parole è facile da ricordare e difficile da indovinare.
4. Per cambiarla in seguito usa **Cambia password** in alto a destra, accanto a
   **Esci**.
5. Se dimentichi la password, chiedi all'amministratore di reimpostarla: nessuno,
   nemmeno l'amministratore, può leggerla. Dopo troppi tentativi sbagliati l'account
   si blocca per qualche minuto; l'amministratore può sbloccarlo.

Il pulsante **Accedi con Microsoft 365** nel pilota non serve: verrà attivato dopo.

## 2. Installare l'app (facoltativo, consigliato)

Così il Cruscotto si apre dalla barra delle applicazioni o dal Dock, in una finestra sua.

- **Edge (Windows):** menu **…** → **App** → **Installa questo sito come app**.
- **Chrome (Windows o Mac):** menu **⋮** → **Trasmetti, salva e condividi** →
  **Installa pagina come app** (nelle versioni meno recenti: **Crea scorciatoia…** con
  "Apri come finestra").
- **Safari (Mac):** menu **File** → **Aggiungi al Dock**.

I nomi delle voci cambiano un po' tra una versione e l'altra del browser.

## 3. Preparare la commessa (una volta sola)

1. **La commessa la apri tu**: in **Le mie commesse** premi **Nuova commessa**,
   scrivi **Codice** (per esempio `CL-2026-040`), **Nome**, **Cliente** e, se le sai,
   le date, poi premi **Crea commessa**. Ne diventi il PM e si apre la scheda
   **Anagrafica**. (Può aprirla anche l'amministratore, indicando te come PM.)
2. Vai alla scheda **Anagrafica** e controlla **Dati della commessa**: inserisci
   **Inizio** e **Fine prevista** (servono alla baseline) e premi **Salva**.
3. **Team:** in fondo al riquadro scegli la persona in **Aggiungi persona**, il
   **Ruolo** (pm, progettista, verificatore, osservatore) e premi **Aggiungi**. Se una
   persona non è nell'elenco, non ha ancora un account: chiedilo all'amministratore.
4. **Milestone:** aggiungi titolo e data target delle scadenze (contrattuali e interne).
5. **Elaborati:** premi **Importa da Excel**, copia da Excel quattro colonne
   (**codice, titolo, disciplina, budget in ore**) e incollale nel riquadro. Premi
   **Anteprima**: le righe con errori sono segnate "errore" e non si importa nulla finché non
   sono tutte corrette. Poi premi **Importa**. Esempio di riga:
   `E-MEC-10  Centrale termica – schema  MEC  24`.
   In alternativa **Nuovo elaborato** per inserirne uno alla volta.
6. Apri ogni elaborato (clic sul codice) per assegnare **Responsabile** e
   **Milestone**: l'import non li imposta.
7. Se serve, cambia i **limiti WIP** della tua commessa nell'ultimo riquadro.

## 4. Approvare la baseline

Senza baseline approvata PV e SPI restano **n.d.**

1. Scheda **Avanzamento EVM** → **Prepara la baseline** → **Crea la bozza con date
   automatiche**: le date di ogni stato si distribuiscono tra inizio e fine commessa.
2. Correggi le date degli elaborati che non tornano. **Distribuisci tra inizio e
   fine** riempie le date intermedie; poi premi **Salva** sulla riga.
3. Premi **Approva e congela** e conferma. Budget, pesi e valore pianificato di ogni
   settimana restano fissi: se la commessa cambia davvero, si fa una **nuova
   baseline** con il motivo.
4. Un elaborato aggiunto dopo l'approvazione compare come **fuori baseline**: le sue
   ore contano, ma non ha valore pianificato finché non approvi una nuova baseline.

## 5. Lookahead e vincoli (durante la settimana)

1. Scheda **Lookahead e vincoli** → **Nuova attività**: codice, titolo, last planner,
   disciplina, elaborato (facoltativo), settimane da… a…
2. Per ogni attività chiediti "cosa manca per poterla fare?". Ogni risposta è un
   **vincolo**: **Nuovo vincolo**, con chi lo rimuove (del team o esterno), **Serve
   entro** e le attività che blocca.
3. Quando il problema è risolto premi **Segna rimosso** nel registro; se non serve più,
   **Annulla** (esce dal PCR).
4. Un'attività senza vincoli aperti è **pronta**: solo quelle vanno promesse.

## 6. Piano settimanale

**Lunedì**
1. Scheda **Piano settimanale** → **Prepara il piano (bozza)**.
2. Con il team aggiungi gli impegni: attività, elaborato, last planner →
   **Aggiungi impegno**.
3. Quando siete d'accordo premi **Prometti il piano**. Gli impegni aggiunti dopo sono
   segnati "fuori dal PPC".

**Venerdì**
1. Ognuno segna **Sì** o **No** sui propri impegni (tu puoi segnarli tutti).
2. Per ogni **No** scegli la **causa** (i "5 perché" sono facoltativi).
3. Premi **Chiudi il piano**: serve un sì o un no su ogni impegno e la causa per ogni
   no. Il **PPC** e il **Pareto delle cause** si aggiornano subito.

## 7. Ore

- Ognuno registra **le proprie** ore da **Le mie ore**: una riga per elaborato, una
  colonna per giorno; scrivi `1,5` o `1:30`, la cella si salva quando esci dal campo.
- Si può correggere fino a **7 giorni dopo la fine della settimana**; dopo serve
  l'amministratore.
- Nella scheda **Ore** della commessa vedi totali per elaborato e, per organizzare il
  lavoro, per persona. Non ci sono classifiche.

## 8. Leggere EVM e pagina Commessa

**Avanzamento EVM**, in tre passi:
1. **SPI** (siamo nei tempi?) e **CPI** (spendiamo le ore previste?): il quadratino colorato con la
   parola dice verde "in linea", giallo "attenzione", rosso "critico" o **n.d.** se mancano dati. Sotto 1 = in ritardo / servono più ore.
2. **Curva S**: EV sotto PV = ritardo; AC sopra EV = più ore del lavoro prodotto.
3. **Registro per elaborato**: trovi dove nasce lo scarto. L'EV dipende solo dallo
   **stato** sul Kanban: tenete aggiornato il Kanban.

**Commessa (Obeya)**: la pagina per la riunione del lunedì con SPI, CPI, PPC, vincoli,
milestone e l'elenco **Da affrontare in riunione** generato dai dati. Finché la
commessa è nuova, la pagina elenca i **passi mancanti** (elaborati, milestone,
baseline, primo piano, prime ore) con il link alla scheda giusta.

## Se qualcosa non va

- **"Qualcun altro ha modificato questo dato mentre lo stavi modificando"**: un collega
  ha salvato prima di te. Rileggi
  il valore aggiornato e, se serve, ripeti la modifica.
- **"n.d."**: mancano i dati per calcolare (niente baseline, niente ore…).
- Annota tutto nel [modulo di feedback](piano-del-pilota.md#6-modulo-di-feedback).
