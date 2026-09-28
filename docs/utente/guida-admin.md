# Guida per l'amministratore (bozza)

> **Bozza di Fase 1.** Oggi la pagina **Amministrazione** contiene solo le
> **impostazioni** (soglie e parametri). La gestione di utenti, stati e pesi, colonne e
> cause è in costruzione (agente A1, Fase 1): le parti segnate **[DA AGGIORNARE]**
> verranno riscritte con le schermate vere. Le sigle sono spiegate nel
> [glossario](glossario.md).

L'amministratore configura il Cruscotto per tutto lo studio. Può vedere tutte le
commesse; sulle singole commesse lavora come un PM solo se serve. La voce
**Amministrazione** in alto compare solo agli amministratori; chi non lo è e apre
`/admin` riceve "accesso negato".

Ogni modifica fatta dall'amministratore finisce nel **registro di audit** (chi, quando,
valore prima e dopo). Se due amministratori modificano la stessa voce insieme, chi salva
per secondo vede un **avviso di conflitto** con il valore aggiornato e deve ripetere la
modifica.

## 1. Utenti e ruoli

### Come nasce un utente

Non si creano utenti a mano: **l'utente nasce al primo accesso** con Microsoft 365.

- Al primo accesso l'utente viene creato con ruolo **progettista**.
- Gli indirizzi email elencati nell'impostazione del server `ADMIN_EMAILS` diventano
  **amministratori** al loro accesso (servono almeno per i primi amministratori; chi è
  già admin non viene mai retrocesso da questa lista). La lista si modifica nel file di
  configurazione del server (vedi la guida di installazione).
- Un utente **disattivato** non può più entrare, ma le sue ore e il suo storico restano.
  Non si cancellano utenti: si disattivano.

### Ruoli globali

| Ruolo | A cosa serve |
|---|---|
| **admin** | configura l'app, vede tutte le commesse |
| **direzione** | vede tutte le commesse, **solo i totali per commessa**; mai ore per persona |
| **pm** | può essere PM di commessa; vede solo le commesse di cui fa parte |
| **progettista** | registra le proprie ore, prende impegni, avanza i propri elaborati |

### Ruoli di commessa

Dentro ogni commessa, il team ha un ruolo proprio (lo assegna il PM o l'admin
nell'anagrafica della commessa): **pm**, **progettista**, **verificatore**,
**osservatore** (solo lettura). Il ruolo globale "pm" da solo non dà diritti sulle
commesse di altri: contano il PM indicato nella commessa e il ruolo di commessa.

### Cambiare ruolo o disattivare

**[DA AGGIORNARE]** — schermata in costruzione (agente A1, Fase 1).

Da **Amministrazione → Utenti** si cambierà il ruolo globale e si potrà attivare o
disattivare un utente.

## 2. Stati degli elaborati e pesi

**[DA AGGIORNARE]** — schermata in costruzione (agente A1, Fase 1).

Gli stati di un elaborato e il loro **peso** determinano il valore guadagnato (EV).
Valori confermati al Gate 0 (28/09/2026) come punto di partenza:

| Ordine | Stato | Peso EV (cumulativo) | Colonna Kanban |
|---|---|---|---|
| 0 | Non iniziato | 0% | Da fare |
| 1 | Impostato | 20% | In corso |
| 2 | Calcoli e dimensionamento | 50% | In corso |
| 3 | Emissione interna | 70% | In verifica |
| 4 | Verificato | 85% | In verifica |
| 5 | Emesso al cliente | 100% | Emesso |

Cose da sapere prima di cambiarli:

- I pesi sono **cumulativi**: un elaborato "Verificato" vale l'85% del suo budget, non
  il 15%.
- Devono **crescere** da uno stato al successivo, partire da 0% e finire a 100%.
- Ogni baseline approvata **congela** i pesi in vigore quel giorno: cambiare i pesi
  vale solo per le baseline approvate dopo. La storia delle commesse non cambia.
- Esempio dell'effetto: un elaborato da 40 h in "Emissione interna" vale 28 h di EV con
  peso 70%; con peso 60% varrebbe 24 h.

## 3. Colonne del Kanban e limiti WIP

**[DA AGGIORNARE]** — schermata in costruzione (agente A1, Fase 1).

Colonne di partenza: **Da fare**, **In corso** (limite WIP 4), **In verifica** (limite
WIP 3), **Emesso**. L'amministratore imposta i limiti di partenza; il PM li può
cambiare per la sua commessa.

## 4. Cause di mancato completamento e discipline

**[DA AGGIORNARE]** — schermata in costruzione (agente A1, Fase 1).

Le 8 cause tra cui si sceglie per ogni impegno "non fatto": Input mancante da altri,
Criteri o requisiti cambiati, Approvazione cliente/ente attesa, Risorsa non disponibile,
Stima troppo ottimista, Errore o rilavorazione, Priorità cambiata dal PM, Altro.
Discipline: MEC, ELE, IDR, ANT. Meglio non rinominare una causa già usata cambiandone il
significato: i Pareto delle settimane passate diventerebbero fuorvianti.

## 5. Impostazioni e soglie dei semafori

Questa parte **esiste già**: **Amministrazione → Impostazioni**.

Ogni riquadro mostra la descrizione, il nome tecnico, la versione e l'etichetta
**"valore di esempio"** finché nessuno lo ha modificato. Si cambia il valore e si preme
**Salva**; dopo il salvataggio compare "salvata".

| Impostazione | Valore di esempio | Effetto |
|---|---|---|
| Semaforo SPI | verde da 0,95, giallo da 0,85 | colore di SPI in tutte le pagine |
| Semaforo CPI | verde da 0,95, giallo da 0,85 | colore di CPI |
| Semaforo PPC | verde da 0,70, giallo da 0,55 | colore del PPC (si scrive come rapporto: 0,70 = 70%) |
| Semaforo PCR | verde da 0,80, giallo da 0,60 | colore del PCR (rapporto) |
| Minuti massimi al giorno | 720 (12 h) | ore massime registrabili da una persona in un giorno |
| Giorni per modificare le ore | 7 | dopo quanti giorni dalla fine della settimana le ore si bloccano |
| Ore per persona visibili al PM | attivo | il PM vede le ore per persona della sua commessa |
| Giorni elaborato fermo | 10 | oltre questa età nello stato l'elaborato è segnalato |
| Settimane di lookahead | 6 | settimane mostrate nel lookahead |
| Giorni di preavviso vincoli | 7 | quanto prima avvisare dei vincoli in scadenza |

Come si leggono le soglie: un valore **uguale o sopra "verde da"** è verde; uguale o
sopra "giallo da" è giallo; sotto è rosso. Un valore non calcolabile è sempre grigio
"n.d.". Esempio: con le soglie di esempio lo SPI 0,78 di CL-2026-031 è rosso; se si
abbassasse "giallo da" a 0,75 diventerebbe giallo. Le soglie valgono per tutte le
pagine (portafoglio, commessa, EVM, piano settimanale): non ci sono soglie diverse da
una pagina all'altra.

Scrivi i numeri **sempre con la virgola** (0,95). **Non usare il punto**: il punto
viene letto come separatore delle migliaia, quindi "0.95" diventerebbe 95.
Un valore non valido (per esempio una lettera) viene rifiutato con il messaggio
"Valore non valido: controlla i numeri inseriti.". Controlla anche che "giallo da" sia
più basso di "verde da": oggi l'app non lo verifica.

### Ore per persona: attenzione

L'impostazione "ore per persona visibili al PM" è **attiva** per decisione dell'utente
al Gate 0 (28/09/2026). **Prima dell'avvio in produzione** servono l'informativa ai
dipendenti e la verifica con il consulente del lavoro (art. 4 Statuto dei lavoratori).
Anche con l'impostazione attiva:

- la direzione non vede **mai** le ore per persona;
- nessuna pagina mostra classifiche o indicatori di rendimento per persona.

## 6. Registro di audit

**[DA AGGIORNARE]** — pagina di consultazione in costruzione (agente B3, Fase 2).

Ogni modifica (impostazioni, stati, vincoli, piani, ore, baseline, sforamenti WIP) viene
registrata con autore, data e valori prima e dopo. Il registro non si può modificare né
cancellare.
