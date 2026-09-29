# Piano del pilota

Il Cruscotto commesse viene provato da **2 PM** per **2 settimane** su commesse vere,
prima di decidere se estenderlo a tutto lo studio. Questo documento dice come si
svolge il pilota, cosa annotare e quando lo si considera riuscito.

Per l'uso dell'app: [guida rapida per il PM](guida-rapida-pm.md).

## 1. In breve

| Voce | Scelta |
|---|---|
| Chi | 2 PM, con i progettisti del loro team; 1 amministratore dell'app |
| Durata | 2 settimane piene, da lunedì a venerdì della settimana successiva |
| Commesse | 1–2 commesse **reali** per PM, già avviate o in partenza |
| Dove | server aziendale (Windows Server 2019), da Edge o Chrome; sul Mac anche Safari |
| Accesso | account locale (nome utente e password dati dall'amministratore) |
| Dati di partenza | **nessuna commessa**: solo configurazione (stati e pesi, colonne e limiti WIP, cause, discipline, soglie) e utenti |

## 2. Prima di partire (settimana 0)

Amministratore:
1. installa il Cruscotto sul server e controlla che la configurazione di partenza sia
   quella confermata al Gate 0 (pesi 20/50/70/85/100, WIP 4 in corso e 3 in verifica);
2. crea gli **account locali** dei 2 PM e delle persone dei loro team e consegna a
   ognuno nome utente e password temporanea, di persona o per telefono (non nella
   stessa email dell'indirizzo del Cruscotto);
3. apre le commesse del pilota (Amministrazione → Commesse) indicando il PM;
4. verifica che il server resti acceso di notte: ogni mattina alle 06:10 l'app scatta
   le "fotografie" settimanali di PPC, lookahead ed EVM.

PM (circa un'ora per commessa):
1. completa l'anagrafica: date di inizio e fine, team, milestone, elaborati
   (importandoli da Excel);
2. prepara e **approva la baseline**;
3. inserisce le attività delle prossime settimane nel lookahead e i vincoli già noti;
4. spiega al team in 10 minuti come registrare le ore e segnare gli impegni
   (le sezioni 6 e 7 della guida rapida bastano).

Prima del via, l'amministratore consegna ai partecipanti l'**informativa** sul
trattamento dei dati (vedi la sezione 8).

## 3. Routine settimanale

| Quando | Chi | Cosa | Durata indicativa |
|---|---|---|---|
| Lunedì mattina | PM + team | Riunione davanti alla pagina **Commessa**: indicatori, vincoli in scadenza, cause della settimana prima | 20–30 min |
| Lunedì | PM + team | **Piano settimanale**: impegni solo su attività pronte, poi **Prometti il piano** | 15 min |
| Ogni giorno | tutti | **Le mie ore**; avanzamento degli elaborati sul **Kanban** | 5 min |
| Durante la settimana | PM | Aggiorna vincoli (rimossi, nuovi) nel **Lookahead e vincoli** | 10 min |
| Venerdì | ognuno + PM | Sì/No sugli impegni, causa per ogni No, poi **Chiudi il piano** | 10 min |
| Venerdì | PM | Aggiorna il lookahead delle prossime settimane; 5 minuti per il modulo di feedback | 15 min |

Cosa aspettarsi in 2 settimane:
- **PPC e Pareto delle cause** sono disponibili dalla prima settimana chiusa.
- **TMR e TA** confrontano il piano con il lookahead di due settimane prima: nel
  pilota restano **n.d.** È normale.
- La **curva S** avrà pochi punti: la settimana corrente è calcolata al momento,
  quelle passate vengono fissate solo quando scade il termine per correggere le ore
  (7 giorni dopo la fine della settimana).

## 4. Regole del pilota: cosa NON fare

- **Non registrare le stesse ore in due posti.** Per le commesse del pilota le ore si
  registrano **solo** nel Cruscotto, non anche in un altro strumento o foglio Excel.
  Se l'ufficio ha bisogno di quelle ore anche altrove, si concorda prima con
  l'amministratore come riportarle: una doppia registrazione a mano rende
  inaffidabili sia il CPI sia il confronto finale.
- Non tenere un secondo piano settimanale su carta o su Excel per le stesse commesse:
  il PPC va calcolato su un solo piano.
- Non usare il Cruscotto per commesse fuori dal pilota.
- Non usare gli indicatori per valutare le persone: misurano la commessa e il team.
- Non condividere il proprio account: ogni modifica è registrata a nome di chi la fa.
- Non caricare nel Cruscotto documenti o dati personali oltre a nome e ore.

## 5. Cosa annotare

Durante le due settimane ognuno annota, appena succede (non a memoria il venerdì):

- **Problemi**: errori, pagine lente, pulsanti che non fanno quello che ci si aspetta,
  messaggi poco chiari, dati che non tornano. Con giorno e ora, pagina e cosa si
  stava facendo; se possibile uno screenshot.
- **Suggerimenti**: cosa manca, cosa è in più, cosa si farebbe in un altro modo.
- **Tempo**: quanto tempo prende davvero la routine settimanale rispetto a prima.
- **Soglie dei semafori**: se un colore (verde, giallo, rosso) sembra sbagliato
  rispetto alla situazione reale della commessa. Servono a tararle.
- **Numeri**: se SPI, CPI o PPC non corrispondono alla percezione del PM, con il
  valore letto e quello atteso.

## 6. Modulo di feedback

Una riga per osservazione. Si compila in un foglio condiviso (lo prepara
l'amministratore con queste colonne) oppure stampato.

| N. | Data | Chi (ruolo) | Commessa | Pagina | Tipo | Cosa è successo / proposta | Gravità | Stato |
|---|---|---|---|---|---|---|---|---|
| 1 | 05/10 | PM | CL-2026-… | Piano settimanale | problema | Esempio: "Chiudi il piano" non si attiva, un impegno era senza causa ma non si vedeva | media | aperto |
| 2 | | | | | suggerimento | | | |
| 3 | | | | | | | | |

Legenda:
- **Tipo**: problema · suggerimento · domanda · numero che non torna.
- **Gravità**: **bloccante** (non si può lavorare) · **alta** (si lavora con
  un'alternativa scomoda) · **media** · **bassa** (estetica, testi).
- **Stato**: aperto · risolto · rinviato (dopo il pilota).

I problemi **bloccanti** si segnalano subito all'amministratore, senza aspettare il
venerdì.

Alla fine di ogni settimana, 15 minuti di confronto tra i 2 PM e l'amministratore
per riguardare il modulo. A fine pilota, un'ora di sintesi con le domande:
1. Il Cruscotto ha fatto emergere prima un ritardo o un vincolo?
2. La riunione del lunedì è stata più breve o più utile?
3. Quanto tempo in più o in meno rispetto a prima, a settimana?
4. Cosa va cambiato prima di usarlo con tutti?
5. Le soglie dei semafori vanno spostate? Quali valori?

## 7. Criteri per passare al go-live

Si passa all'uso con tutto lo studio se **tutti** questi punti sono veri:

| # | Criterio | Come si verifica |
|---|---|---|
| 1 | Nessun problema **bloccante** aperto | modulo di feedback |
| 2 | Problemi di gravità **alta** risolti o con una soluzione concordata e una data | modulo di feedback |
| 3 | Entrambi i PM hanno **chiuso il piano** in tutte e 2 le settimane, per ogni commessa | pagina Piano settimanale |
| 4 | Le ore del team sono registrate per **almeno il 90%** dei giorni lavorati | confronto con le presenze, a cura del PM |
| 5 | Baseline approvata su tutte le commesse del pilota; SPI e CPI giudicati **credibili** dal PM | sintesi finale |
| 6 | Routine settimanale del PM sotto **1 ora** a commessa, riunione compresa | sezione "Tempo" del modulo |
| 7 | Soglie dei semafori confermate o corrette dai PM | Amministrazione → Impostazioni |
| 8 | Informativa consegnata e **verifica art. 4** chiusa con il consulente del lavoro (decisione D4) | sezione 8 |
| 9 | Backup e ripristino provati con l'IT | checklist di installazione |
| 10 | I 2 PM dicono sì all'estensione | sintesi finale |

Se uno dei punti 1–7 non è soddisfatto si corregge e si fa **un'altra settimana** di
pilota. I punti 8 e 9 sono condizioni obbligatorie: senza, non si estende.

## 8. Informativa e art. 4 dello Statuto dei lavoratori

Il Cruscotto registra le ore per persona e, per decisione del 28/09/2026, il PM vede
le ore per persona della propria commessa. È uno strumento di lavoro che può
consentire un controllo a distanza dell'attività: per questo, **prima di estenderlo
oltre il pilota**:

1. i dipendenti ricevono l'**informativa** scritta: quali dati si raccolgono (nome,
   ore per elaborato e per giorno, impegni presi e mantenuti), perché (organizzare
   il lavoro delle commesse), chi li vede (la persona, il PM della commessa,
   l'amministratore; la direzione **solo i totali per commessa**), per quanto tempo si
   conservano;
2. il **consulente del lavoro** verifica l'applicazione dell'art. 4 (eventuale accordo
   sindacale o autorizzazione) e l'esito si annota nella decisione D4;
3. resta fermo che il Cruscotto **non** produce classifiche né indicatori per
   persona.

Anche per il pilota, i partecipanti vanno informati prima di iniziare. Se la
verifica non è chiusa a fine pilota, l'amministratore può disattivare le ore per
persona visibili al PM (Amministrazione → Impostazioni) finché non lo è.

## 9. Dopo il pilota

- Le commesse del pilota **restano** nel Cruscotto e si continua a usarle.
- Le correzioni emerse si pianificano con l'orchestratore dello sviluppo.
- Il login con Microsoft 365 si attiva al go-live; gli account locali del pilota si
  disattivano o si collegano all'account aziendale. **[DA VERIFICARE]** con
  l'amministratore come avviene il passaggio.
