# Guida per la direzione

> **Versione per il pilota (Fase 2).** Le sigle sono spiegate nel [glossario](glossario.md).
>
> **Durante il pilota** (2 PM, 2 settimane, vedi il
> [piano del pilota](../pilota/piano-del-pilota.md)) il Cruscotto contiene solo le 1–2
> commesse reali di ciascun PM: il portafoglio sarà quasi vuoto e diversi indicatori
> saranno **n.d.** finché non ci sono baseline e ore registrate.

## Cosa vede la direzione

La direzione vede **tutte le commesse dello studio**, ma **solo i totali per commessa**:

- sì: indicatori di commessa (SPI, CPI, stima a completamento, PPC, vincoli aperti,
  milestone), ore totali per commessa;
- no: ore per persona, dettaglio di chi ha fatto cosa, classifiche o punteggi di
  persone. Questa regola non si può cambiare dalle impostazioni: deriva dall'art. 4
  dello Statuto dei lavoratori e dalla scelta di misurare il lavoro del team, non dei
  singoli.

La direzione **legge** e non modifica: piani, vincoli, Kanban e baseline li gestiscono
i PM.

## Entrare

1. Apri il Cruscotto dal browser. **Nel pilota** si entra con **Email** e **Password**
   dati dall'amministratore (al primo accesso la pagina **Cambia password** chiede una
   password nuova di almeno 12 caratteri); dopo il pilota con **Accedi con Microsoft 365**.
2. **Le mie commesse** mostra l'elenco di tutte le commesse dello studio con PM, numero
   di elaborati, prossima milestone e stato (attiva o altro).
3. Dalla voce **Portafoglio** in alto si apre la vista d'insieme.

## Il portafoglio

Una riga per commessa attiva, con:

| Colonna | Cosa dice |
|---|---|
| SPI | Se la commessa è nei tempi (sotto 1 = in ritardo) |
| CPI | Se consuma le ore previste (sotto 1 = servono più ore del previsto) |
| PPC ultime 4 settimane | Quanto il team mantiene gli impegni presi |
| Vincoli aperti | Quanti ostacoli sono ancora da rimuovere |
| Prossima milestone | La prossima scadenza importante |

Ogni indicatore ha un semaforo, cioè un quadratino colorato seguito dalla parola: **verde** (in linea), **giallo** (attenzione), **rosso**
(critico), **grigio n.d.** (dati mancanti). Le soglie sono quelle di partenza e verranno
tarate con i PM durante il pilota:

| Indicatore | Verde | Giallo | Rosso |
|---|---|---|---|
| SPI, CPI | da 0,95 | da 0,85 | sotto 0,85 |
| PPC | da 70% | da 55% | sotto 55% |
| PCR | da 80% | da 60% | sotto 60% |

## Come leggerlo in cinque minuti

1. **Cerca il rosso.** Una commessa con SPI e CPI rossi è in ritardo e sta consumando
   più ore del previsto. Esempio (dati dimostrativi): SPI 0,78 e CPI 0,76, stima a
   completamento 560,7 h contro 424 h di budget (circa 137 h in più).
2. **Guarda il PPC.** Un PPC basso e stabile (sotto 55%) indica un piano poco
   affidabile: spesso la causa è a monte (input da altri, approvazioni), non nel team.
3. **Guarda i vincoli aperti** e la prossima milestone: molti vincoli aperti a ridosso
   di una milestone sono il segnale più precoce di ritardo.
4. **Apri la commessa** (clic sul codice) per la pagina **Commessa** con curva S,
   andamento del PPC e l'elenco "Da affrontare in riunione".
   Le schede di dettaglio (EVM, Kanban, piano
   settimanale) si possono aprire in sola lettura; la scheda Ore mostra solo i totali.
5. Per chiarimenti parla con il PM della commessa: i numeri servono a fare le domande
   giuste, non a dare giudizi.

## Cosa vuol dire "n.d."

Che l'indicatore non si può calcolare perché mancano i dati: per esempio una commessa
appena avviata senza ore registrate (CPI n.d.) o senza baseline approvata (SPI n.d.).
