import json, os

D = os.path.dirname(os.path.abspath(__file__))
I = os.path.join(D, "img") + "/"


def im(n, c):
    return {"path": I + n + ".png", "caption": c}


S = []


def sec(h, l=1, body=None, bullets=None, numbered=None, table=None, images=None):
    d = {"heading": h, "level": l}
    for k, v in (("body", body), ("bullets", bullets), ("numbered", numbered), ("table", table), ("images", images)):
        if v:
            d[k] = v
    S.append(d)


# ---------------------------------------------------------------- 1
sec("Introduzione", 1, [
    "Il Cruscotto commesse è l'applicazione di Climosfera per seguire l'andamento delle commesse di progettazione. Riunisce in un solo posto quello che oggi è sparso tra fogli Excel, riunioni e messaggi: cosa bisogna consegnare, chi ci lavora, cosa blocca il lavoro, quante ore sono state spese e se la commessa è in linea con tempi e budget.",
    "Più persone possono usarlo nello stesso momento: il PM, i progettisti e i verificatori della stessa commessa vedono gli stessi dati aggiornati. I dati stanno su un server aziendale; ognuno apre l'applicazione dal proprio computer, Windows o Mac, con il browser o come app installata.",
    "Questa guida spiega come funziona l'applicazione e perché è fatta così. Non serve alcuna competenza informatica. Le immagini sono state prese dall'applicazione con dati di esempio: nel pilota le commesse saranno quelle vere.",
])
sec("A chi serve e cosa fa ognuno", 2,
    ["Ogni persona ha un ruolo nello studio e un ruolo nelle singole commesse. Il ruolo decide cosa si può vedere e modificare."],
    table={"caption": "Ruoli e attività principali", "headers": ["Chi", "Cosa fa nel Cruscotto"], "rows": [
        ["PM", "Apre e prepara la commessa, approva la baseline, guida il piano settimanale, legge l'avanzamento e prepara la riunione"],
        ["Progettista e verificatore", "Registra le proprie ore, prende e chiude i propri impegni settimanali, fa avanzare i propri elaborati sul Kanban"],
        ["Osservatore", "Vede le pagine della commessa senza modificarle"],
        ["Direzione", "Vede il portafoglio di tutte le commesse con i soli totali"],
        ["Amministratore", "Crea gli account; imposta pesi, soglie, colonne e cause; consulta il registro delle attività"],
    ]})
sec("Cosa l'applicazione non fa, per scelta", 2, [
    "Il Cruscotto misura le commesse e il lavoro del team, non le persone. Non ci sono classifiche né punteggi individuali. Il PM vede le ore di ciascuno sulla propria commessa per organizzare il lavoro, non per valutare chi lavora di più o di meno.",
    "Non gestisce modelli BIM, file di progetto o fatturazione: si concentra sulla pianificazione e sul controllo dell'avanzamento.",
])

# ---------------------------------------------------------------- 2
sec("Le idee alla base, in parole semplici", 1, [
    "Il Cruscotto combina due modi di gestire un progetto che si completano a vicenda: il controllo di tempi e costi del PMBOK e l'affidabilità del piano del metodo Lean. Conoscerli aiuta a capire perché le schermate sono organizzate così.",
])
sec("Il controllo di tempi e costi (PMBOK ed Earned Value)", 2, [
    "Il PMBOK è la guida internazionale di riferimento per la gestione dei progetti. Tra i suoi strumenti c'è l'Earned Value, in italiano valore guadagnato: un metodo per capire con pochi numeri se una commessa è in ritardo o sta costando più del previsto.",
    "L'idea è semplice. Ogni elaborato ha un budget in ore. Man mano che l'elaborato avanza, una parte di quel budget si considera guadagnata. Confrontando il lavoro guadagnato con quello che era previsto a oggi si capisce se si è in ritardo; confrontandolo con le ore spese si capisce se si sta lavorando in modo efficiente.",
    "Nel Cruscotto l'avanzamento non è una percentuale dichiarata a occhio: dipende solo dallo stato dell'elaborato sul Kanban. Un elaborato impostato vale il 20% del suo budget, uno in calcolo il 50%, uno in emissione interna il 70%, uno verificato l'85%, uno emesso al cliente il 100%. Così i numeri sono oggettivi e nessun elaborato resta fermo al 90% per settimane.",
])
sec("L'affidabilità del piano (Lean e Last Planner)", 2, [
    "Il Last Planner è un metodo nato nel mondo Lean delle costruzioni. Parte da un'osservazione pratica: i piani falliscono soprattutto perché si promettono lavori che non si possono fare, perché manca un'informazione, un'approvazione o una persona.",
    "Per questo il metodo lavora su tre livelli. Il lookahead guarda le prossime sei settimane e fa emergere in anticipo gli ostacoli, chiamati vincoli. Il piano settimanale raccoglie solo gli impegni che il team può davvero mantenere. A fine settimana si verifica cosa è stato fatto e, per ciò che non è stato fatto, si annota la causa.",
    "Il numero chiave è il PPC, la percentuale di impegni mantenuti. Non misura la bravura delle persone ma quanto il piano del team è affidabile. Le cause di mancato completamento, raccolte settimana dopo settimana, mostrano dove intervenire.",
])
sec("Il flusso degli elaborati (Kanban)", 2, [
    "Il Kanban è una bacheca a colonne: Da fare, In corso, In verifica, Emesso. Ogni elaborato è una scheda che si sposta da sinistra a destra man mano che avanza.",
    "Ogni colonna ha un limite, detto WIP (lavoro in corso): per esempio non più di 4 elaborati in corso contemporaneamente sulla stessa commessa. Il principio è che conviene finire quello che è aperto prima di aprire altro. Quando il limite viene superato l'applicazione lo segnala e chiede conferma.",
])
sec("Come si collegano le parti", 2,
    ["Le parti dell'applicazione si alimentano a vicenda: nessun dato va inserito due volte."],
    table={"caption": "Collegamenti tra le parti dell'applicazione", "headers": ["Quando fai questo", "Si aggiorna questo"], "rows": [
        ["Sposti un elaborato sul Kanban", "Il valore guadagnato (EV) e quindi SPI e CPI"],
        ["Registri le ore", "Le ore spese (AC), il CPI e la stima a completamento"],
        ["Segni rimosso un vincolo", "L'attività collegata diventa pronta e il PCR sale"],
        ["Chiudi il piano settimanale", "Il PPC e il grafico delle cause"],
        ["Approvi la baseline", "Il valore pianificato (PV) di ogni settimana"],
    ]})
sec("Le sigle principali", 2,
    ["Le sigle compaiono nelle schermate insieme al nome per esteso. Quando un valore non si può calcolare perché mancano dati, per esempio nessuna ora registrata, l'applicazione mostra n.d., cioè non disponibile."],
    table={"caption": "Glossario essenziale", "headers": ["Sigla", "Significato", "Domanda a cui risponde"], "rows": [
        ["BAC", "Budget in ore della commessa", "Quante ore abbiamo a disposizione?"],
        ["PV", "Valore pianificato", "Quanto lavoro doveva essere fatto a oggi?"],
        ["EV", "Valore guadagnato", "Quanto lavoro è stato fatto davvero?"],
        ["AC", "Ore registrate", "Quante ore abbiamo speso?"],
        ["SPI", "Indice di avanzamento (EV / PV)", "Siamo nei tempi? Sotto 1 siamo in ritardo"],
        ["CPI", "Indice di efficienza (EV / AC)", "Stiamo usando le ore previste? Sotto 1 servono più ore"],
        ["EAC", "Stima a completamento", "Quante ore costerà in totale la commessa?"],
        ["ETC", "Ore ancora necessarie", "Quante ore servono ancora da oggi?"],
        ["PPC", "Impegni mantenuti / promessi", "Quanto è affidabile il nostro piano?"],
        ["PCR", "Vincoli rimossi / in scadenza", "Stiamo togliendo gli ostacoli in tempo?"],
        ["WIP", "Lavoro in corso", "Quanti elaborati sono aperti insieme?"],
    ]})
sec("I colori dei semafori", 2, [
    "Accanto agli indicatori compare un semaforo: un piccolo quadrato colorato seguito sempre da una parola. Verde vuol dire in linea, giallo (tono ambra) attenzione, rosso critico, grigio n.d. quando mancano i dati. La parola basta da sola: il colore aiuta a trovare subito i punti critici. Le soglie di partenza sono: SPI e CPI verdi da 0,95 e gialli da 0,85; PPC verde dal 70% e giallo dal 55%; PCR verde dall'80% e giallo dal 60%. Sono valori di partenza che verranno tarati con i PM durante il pilota.",
])

# ---------------------------------------------------------------- 3
sec("Primi passi", 1, ["In questo capitolo: come entrare, come installare l'app sul proprio computer e come orientarsi nella pagina iniziale."])
sec("Entrare nell'applicazione", 2,
    ["Apri l'indirizzo che ti ha comunicato l'amministratore con Edge o Chrome; sul Mac va bene anche Safari. L'applicazione funziona sulla rete dell'ufficio e da fuori ufficio attraverso la VPN aziendale."],
    numbered=[
        "Scrivi la tua email e la password temporanea ricevuta dall'amministratore e premi Accedi.",
        "Al primo accesso l'applicazione chiede una nuova password di almeno 12 caratteri. Una frase di più parole è facile da ricordare e difficile da indovinare.",
        "Per cambiarla in seguito usa Cambia password in alto a destra.",
        "Se dimentichi la password chiedi all'amministratore di reimpostarla. Dopo 5 tentativi sbagliati l'account si blocca per 15 minuti.",
    ],
    images=[im("accesso", "pagina di accesso"), im("cambia-password", "cambio della password al primo accesso")])
sec("Installare l'app sul computer", 2,
    ["Non è obbligatorio, ma è comodo: il Cruscotto si apre dalla barra delle applicazioni o dal Dock, in una finestra propria, come un normale programma. Gli aggiornamenti arrivano da soli: non c'è nulla da reinstallare."],
    bullets=[
        "Edge su Windows: menu con i tre puntini, poi App, poi Installa questo sito come app.",
        "Chrome su Windows o Mac: menu con i tre puntini, poi Trasmetti, salva e condividi, poi Installa pagina come app.",
        "Safari su Mac: menu File poi Aggiungi al Dock.",
    ])
sec("La pagina iniziale", 2,
    ["Dopo l'accesso si apre Le mie commesse: l'elenco delle commesse di cui fai parte, con il tuo ruolo, il numero di elaborati e la prossima scadenza. In alto trovi anche Portafoglio e Le mie ore. Cliccando sul codice di una commessa si entra nelle sue schede: Commessa, Piano settimanale, Lookahead e vincoli, Kanban, Ore, Avanzamento EVM, Anagrafica."],
    images=[im("home", "pagina Le mie commesse")])

# ---------------------------------------------------------------- 4
sec("Preparare una nuova commessa", 1, [
    "Questa parte si fa una volta sola, all'avvio della commessa, ed è compito del PM. Richiede circa mezz'ora se l'elenco degli elaborati è già pronto in Excel.",
])
sec("Aprire la commessa", 2,
    ["In Le mie commesse premi Nuova commessa, scrivi codice, nome, cliente e date, poi premi Crea commessa. Chi la apre ne diventa il PM. Può aprirla anche l'amministratore, indicando il PM."],
    images=[im("nuova-commessa", "apertura di una nuova commessa")])
sec("Anagrafica: dati, team, milestone, elaborati", 2,
    ["Nella scheda Anagrafica ogni riquadro ha il proprio pulsante di salvataggio."],
    numbered=[
        "Dati della commessa: inserisci inizio e fine prevista, che servono alla baseline.",
        "Team: scegli la persona, il ruolo (pm, progettista, verificatore, osservatore) e premi Aggiungi. Se una persona non compare, non ha ancora un account: chiedilo all'amministratore.",
        "Milestone: le scadenze contrattuali e interne, con titolo e data.",
        "Elaborati: con Importa da Excel copia quattro colonne (codice, titolo, disciplina, budget in ore) e incollale; premi Anteprima, controlla le righe segnate come errore (finché ce n'è una non si importa nulla), poi Importa. In alternativa usa Nuovo elaborato per inserirne uno alla volta.",
        "Apri ogni elaborato per assegnare responsabile e milestone.",
        "Se serve, adatta i limiti WIP del Kanban alla tua commessa.",
    ],
    images=[im("anagrafica", "scheda Anagrafica")])
sec("Approvare la baseline", 2,
    ["La baseline è la fotografia del piano: per ogni elaborato stabilisce quando si prevede che raggiunga ogni stato. Da lì l'applicazione calcola il valore pianificato di ogni settimana. Senza baseline approvata PV e SPI restano n.d.",
     "Un elaborato aggiunto dopo l'approvazione compare come fuori baseline: le sue ore contano, ma non ha valore pianificato finché non si approva una nuova baseline."],
    numbered=[
        "Scheda Avanzamento EVM, poi Prepara la baseline, poi Crea la bozza con date automatiche: le date si distribuiscono tra inizio e fine della commessa.",
        "Correggi le date che non tornano e premi Salva sulla riga.",
        "Premi Approva e congela. Da quel momento budget, pesi e valori pianificati non cambiano più.",
        "Se la commessa cambia davvero, per esempio per una variante concordata, crea una Nuova baseline indicando il motivo. La precedente resta valida finché non approvi la nuova.",
    ])

# ---------------------------------------------------------------- 5
sec("Il lavoro di ogni settimana", 1,
    ["Una volta preparata la commessa, il Cruscotto segue un ritmo settimanale. La tabella riassume chi fa cosa e quando."],
    table={"caption": "La settimana tipo", "headers": ["Quando", "Cosa", "Dove"], "rows": [
        ["Lunedì mattina", "Riunione di team: stato, avvisi, vincoli in scadenza", "Commessa"],
        ["Lunedì", "Si prepara e si promette il piano della settimana", "Piano settimanale"],
        ["Durante la settimana", "Si rimuovono i vincoli, gli elaborati avanzano, ognuno registra le ore", "Lookahead, Kanban, Le mie ore"],
        ["Venerdì", "Si segna sì o no su ogni impegno e si chiude il piano", "Piano settimanale"],
        ["Venerdì", "Si aggiorna il lookahead delle settimane successive", "Lookahead e vincoli"],
    ]})
sec("Lookahead e vincoli", 2, [
    "Il lookahead mostra le attività delle prossime sei settimane, una colonna per settimana. Ogni attività è pronta oppure vincolata.",
    "Per ogni attività la domanda da porsi è: cosa manca per poterla fare? Ogni risposta è un vincolo, per esempio la planimetria aggiornata dall'architetto, l'approvazione del committente o una persona disponibile. Il vincolo si registra indicando chi deve rimuoverlo ed entro quando; un vincolo può bloccare più attività.",
    "Quando l'ostacolo è risolto si preme Segna rimosso: se l'attività non ha altri vincoli aperti diventa pronta. Solo le attività pronte vanno promesse nel piano settimanale. Il PCR misura quanti vincoli in scadenza nella settimana sono stati rimossi in tempo.",
], images=[im("lookahead", "lookahead a sei settimane e registro dei vincoli")])
sec("Il piano settimanale", 2,
    ["Il lunedì il team decide cosa promette di finire entro la settimana; il venerdì verifica cosa ha mantenuto. Esempio: 5 impegni fatti su 7 promessi danno un PPC del 71%."],
    numbered=[
        "Lunedì: Prepara il piano (bozza), aggiungi gli impegni scegliendo attività, elaborato e responsabile (last planner), poi Prometti il piano.",
        "Gli impegni aggiunti dopo la promessa sono segnati e non entrano nel PPC: così il PPC resta onesto.",
        "Venerdì: ognuno segna Sì o No sui propri impegni; il PM può segnarli tutti. Sì vuol dire finito davvero, non quasi.",
        "Per ogni No va scelta la causa: input mancante da altri, criteri cambiati, approvazione attesa, risorsa non disponibile, stima troppo ottimista, errore o rilavorazione, priorità cambiata, altro. Per i casi importanti c'è l'analisi dei 5 perché.",
        "Premi Chiudi il piano: il PPC e il grafico delle cause si aggiornano subito.",
    ],
    images=[im("settimana", "piano settimanale con PPC e cause di mancato completamento")])
S[-1]["body"].append("Il grafico delle cause ordina le cause dalla più frequente: la prima è il primo punto da affrontare nella riunione. La causa non serve a trovare un colpevole, ma a capire cosa blocca il lavoro.")
sec("Il Kanban degli elaborati", 2,
    ["Ogni scheda è un elaborato. Le colonne raggruppano gli stati: Da fare (non iniziato), In corso (impostato, calcoli e dimensionamento), In verifica (emissione interna, verificato), Emesso (emesso al cliente).",
     "Tenere aggiornato il Kanban è importante: è lo stato dell'elaborato che determina il valore guadagnato. Se una scheda resta indietro rispetto alla realtà, la commessa sembra più in ritardo di quanto sia."],
    bullets=[
        "Un elaborato avanza di uno stato alla volta, con i pulsanti Avanti e Indietro sulla scheda oppure trascinandola nella colonna accanto. Non si saltano stati.",
        "Per tornare indietro, per esempio dopo i commenti del verificatore, l'applicazione chiede il motivo.",
        "Se la colonna di arrivo è al limite WIP l'applicazione chiede conferma e un motivo, che resta registrato.",
        "Su ogni scheda si vedono i giorni passati nello stato attuale e le ore spese sul budget. Oltre 10 giorni nello stesso stato l'elaborato è segnalato come fermo: di solito c'è un vincolo da far emergere.",
        "In basso ci sono gli elaborati emessi per settimana, il tempo medio di attraversamento e il diagramma di flusso cumulativo, che mostra dove il lavoro si accumula.",
    ],
    images=[im("kanban", "Kanban della commessa, con il limite WIP superato nella colonna In corso")])
sec("Registrare le ore", 2,
    ["Da Le mie ore ognuno registra le proprie ore: una riga per elaborato, una colonna per giorno. Si scrive 1,5 oppure 1:30 e la cella si salva da sola quando si esce dal campo."],
    bullets=[
        "Si registrano solo le proprie ore: nessuno può farlo al posto di un altro, nemmeno il PM.",
        "Con Precedente e Successiva, sopra la griglia, ti sposti tra le settimane; Mostra sabato e domenica aggiunge il fine settimana.",
        "Al massimo 12 ore al giorno (valore di partenza).",
        "Una settimana si può correggere fino a 7 giorni dopo la sua fine; poi serve l'amministratore, che registra la correzione con il motivo.",
        "Le ore diventano subito il costo effettivo della commessa: registrarle con puntualità rende affidabili i numeri di tutti.",
        "Nella scheda Ore della commessa il PM vede i totali per elaborato e le ore per persona, senza classifiche. La direzione vede solo i totali.",
    ],
    images=[im("ore", "Le mie ore")])

# ---------------------------------------------------------------- 6
sec("Leggere l'andamento della commessa", 1, ["Quattro pagine aiutano a capire come sta andando una commessa: l'avanzamento in ore, la pagina Commessa per la riunione, la scheda del singolo elaborato e il portafoglio."])
sec("Avanzamento in ore (EVM)", 2,
    ["La scheda Avanzamento EVM risponde a due domande: siamo nei tempi? stiamo usando le ore previste? Si legge in tre passi.",
     "Esempio con i dati dimostrativi: budget 424 h, valore guadagnato 242 h, ore spese 320 h. Il CPI è 242 / 320 = 0,76: ogni ora spesa ha prodotto 0,76 ore di lavoro previsto. Con questo andamento la stima a completamento è 424 / 0,76, circa 561 h, cioè 137 h oltre il budget, e servono ancora circa 241 h.",
     "Lo storico settimanale mostra i valori congelati a fine settimana, dopo la scadenza per correggere le ore. Le settimane passate non cambiano più: se qualcuno corregge ore in ritardo, la riga viene segnata come rettificata."],
    numbered=[
        "Guarda SPI e CPI con il loro semaforo. Sotto 1 lo SPI indica ritardo; il CPI indica che servono più ore del previsto per il lavoro fatto.",
        "Guarda la curva S: se la linea del valore guadagnato sta sotto quella pianificata sei in ritardo; se la linea delle ore spese sta sopra quella del valore guadagnato stai spendendo più ore del lavoro prodotto.",
        "Scendi nel registro per elaborato per capire dove nasce lo scarto.",
    ],
    images=[im("evm", "indicatori e curva S dell'avanzamento in ore")])
sec("La pagina Commessa per la riunione (Obeya)", 2, [
    "Obeya in giapponese vuol dire grande stanza: è la parete dove il team vede tutto insieme. Nel Cruscotto è la scheda Commessa, pensata per la riunione del lunedì.",
    "Riunisce SPI, CPI, stima a completamento, PPC, vincoli aperti, milestone e l'andamento del piano. L'elenco Da affrontare in riunione è generato automaticamente dai dati: ritardi, vincoli in scadenza, limiti WIP superati, elaborati fermi.",
    "Su una commessa appena aperta la pagina elenca invece i passi mancanti (elaborati, milestone, baseline, primo piano, prime ore) con il collegamento alla scheda dove farli.",
], images=[im("obeya", "pagina Commessa (Obeya)")])
sec("La scheda dell'elaborato", 2,
    ["Cliccando sul codice di un elaborato si apre la sua scheda: dati, stato attuale e storico degli spostamenti, ore spese, vincoli e impegni collegati, con i collegamenti a Kanban ed EVM."],
    images=[im("scheda", "scheda di un elaborato")])
sec("Il portafoglio", 2,
    ["Il Portafoglio mostra più commesse in una tabella, con i semafori di SPI, CPI e PPC, i vincoli aperti e la prossima milestone. Il PM vede le proprie commesse; la direzione le vede tutte, con i soli totali di commessa."],
    images=[im("portafoglio", "portafoglio visto dalla direzione")])

# ---------------------------------------------------------------- 7
sec("Lavorare insieme sugli stessi dati", 1, [
    "Più persone possono lavorare sulla stessa commessa nello stesso momento. Le pagine si aggiornano da sole quando un collega modifica qualcosa.",
    "Se due persone modificano lo stesso dato quasi insieme, chi salva per secondo vede l'avviso \"Qualcun altro ha modificato questo dato mentre lo stavi modificando\", con il valore aggiornato. Basta rileggere e, se serve, ripetere la modifica: nessun dato viene sovrascritto di nascosto.",
    "Ogni modifica importante resta nel registro delle attività, che l'amministratore può consultare.",
])
sec("Chi può fare cosa", 2,
    ["La tabella riassume i permessi principali."],
    table={"caption": "Permessi principali", "headers": ["Azione", "Chi può farla"], "rows": [
        ["Aprire una commessa", "PM e amministratore"],
        ["Modificare anagrafica, team, milestone, baseline", "PM della commessa e amministratore"],
        ["Preparare e chiudere il piano settimanale", "PM della commessa; ognuno segna i propri impegni"],
        ["Spostare gli elaborati sul Kanban", "PM, progettisti e verificatori della commessa"],
        ["Registrare ore", "Ognuno solo per sé"],
        ["Vedere le ore per persona", "PM della commessa e amministratore"],
        ["Pesi, soglie, account, registro attività", "Amministratore"],
    ]})

# ---------------------------------------------------------------- 8
sec("Il pilota", 1,
    ["Il pilota dura due settimane e coinvolge 2 PM, ciascuno con una o due commesse reali. Si parte da zero: nessun dato viene importato da altri strumenti."],
    bullets=[
        "Lunedì: riunione sulla pagina Commessa e piano della settimana. Venerdì: chiusura del piano e aggiornamento del lookahead.",
        "Per le commesse del pilota le ore si registrano solo nel Cruscotto, per non avere dati doppi.",
        "Annotate problemi e suggerimenti nel modulo di feedback del piano del pilota: servono a tarare soglie e pesi e a correggere le schermate.",
        "Prima di estendere l'uso a tutto lo studio servono l'informativa ai dipendenti sul trattamento delle ore e la verifica dell'art. 4 dello Statuto dei lavoratori.",
        "Dopo il pilota l'accesso passerà agli account Microsoft 365, gli stessi di Outlook e Teams.",
    ])
sec("Domande frequenti", 1,
    ["Le risposte alle domande più comuni."],
    table={"caption": "Domande frequenti", "headers": ["Domanda", "Risposta"], "rows": [
        ["Perché vedo n.d.?", "Mancano i dati per calcolare: per esempio nessuna baseline approvata (SPI) o nessuna ora registrata (CPI)."],
        ["Non trovo una persona da aggiungere al team", "Non ha ancora un account: chiedilo all'amministratore."],
        ["Non trovo un elaborato nelle mie ore", "Guarda tra gli altri elaborati delle tue commesse; se manca, chiedi al PM di aggiungerti al team."],
        ["Ho sbagliato le ore di due settimane fa", "Se la settimana è bloccata, chiedi all'amministratore di correggerla."],
        ["Posso cambiare i pesi solo per la mia commessa?", "No: i pesi sono unici per lo studio; ogni baseline congela quelli in vigore al momento dell'approvazione."],
        ["Un PPC basso è colpa di qualcuno?", "No: misura l'affidabilità del piano del team. Le cause indicano cosa migliorare."],
        ["Ho dimenticato la password", "Chiedi all'amministratore di reimpostarla."],
    ]})

json.dump({"titolo": "Guida all'uso del Cruscotto commesse", "commessa": "CRUSCOTTO COMMESSE",
           "sezioni": S, "includeToc": True},
          open(os.path.join(D, "content.json"), "w"), ensure_ascii=False, indent=1)
print(len(S), "sezioni")
