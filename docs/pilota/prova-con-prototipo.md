# Provare il Cruscotto prima dell'installazione

Finché l'IT non ha installato l'app sul server aziendale, i PM possono provarla con la
**versione di prova**. È un'unica pagina web che segue le stesse schermate, gli stessi
passi e le stesse formule dell'app vera. Serve a capire come funziona e a raccogliere le
osservazioni: non è l'app definitiva e non va usata per le commesse vere.

## Come aprirla

Ci sono due modi, con la stessa pagina.

| Modo | Come | Dati |
|---|---|---|
| **Link claude.ai** | https://claude.ai/artifact/Hau6bbX46GViVFRhGNUykN, dopo che il proprietario l'ha condiviso con te dal menu **Condividi** (livello *Contributor*) | **condivisi**: i 2 PM vedono le stesse commesse e le stesse segnalazioni |
| **File** `prototipo/index.html` | doppio clic, si apre in Edge, Chrome o Safari; niente account | **solo sul tuo PC**, in quel browser |

Se il link non si apre (niente accesso a claude.ai), usa il file.

## Cosa provare (circa un'ora)

Tieni aperta la [guida rapida](guida-rapida-pm.md): i nomi dei pulsanti sono gli stessi.

1. **Entra** come *PM 1* (o *PM 2*). Apri **CL-2026-031 (esempio)** e guarda le schede:
   è una commessa già piena di dati, con SPI e CPI in rosso di proposito.
2. **Nuova commessa**: crea una commessa tua con codice, nome, cliente, inizio e fine.
3. **Anagrafica**: aggiungi il team e una milestone. Poi usa **Importa da Excel** con 3-4
   elaborati copiati da un foglio vero, premi **Anteprima** e **Importa**, infine assegna
   il responsabile.
4. **Avanzamento EVM**: **Prepara la baseline** → **Crea la bozza con date automatiche**
   → correggi una riga e **Salva** → **Approva e congela**.
5. **Lookahead e vincoli**: aggiungi un'attività e un vincolo, poi **Segna rimosso**.
   **Piano settimanale**: **Prepara il piano**, aggiungi gli impegni, **Prometti il piano**,
   segna Sì o No e **Chiudi il piano**.
6. **Kanban** e **Le mie ore**: fai avanzare un elaborato e registra qualche ora. Poi
   guarda come cambiano SPI, CPI e la pagina **Commessa**.

Per vedere passare le settimane usa **Simula settimana successiva** in fondo alla pagina.
**Torna a oggi** la riporta alla data vera.

## Segnalare

In ogni pagina c'è il pulsante **Segnala**, in basso a destra. Scegli il tipo (*Non capisco*,
*Errore*, *Manca qualcosa*, *Suggerimento*) e scrivi una frase. La pagina e il profilo si
registrano da soli.

- Con il **link**, le segnalazioni arrivano direttamente a chi segue la prova.
- Con il **file**, apri **Segnalazioni** in fondo alla pagina e premi **Scarica le
  segnalazioni (.csv)**. Poi manda il file via mail o Teams.

## Cosa è diverso dall'app vera

- **Accesso**: qui si sceglie un profilo senza password. Nell'app vera si entra con email e
  password temporanea e si cambia la password al primo accesso.
- **Permessi**: sono semplificati. Solo il PM modifica l'anagrafica, la baseline e il piano.
  Il blocco delle settimane dopo 7 giorni c'è, ma qui l'amministratore non esiste.
- **Tempo reale e conflitti**: qui vince l'ultimo che salva. L'app vera avvisa con "Qualcun
  altro ha modificato questo dato…".
- **Mancano**: registro attività completo, amministrazione utenti, portafoglio della
  direzione con i filtri, scheda del singolo elaborato. Il sabato e la domenica nelle ore
  non ci sono.
- **Dati**: niente di quello che si inserisce qui passa nell'app installata. Nell'app vera
  si ricomincia da zero.
