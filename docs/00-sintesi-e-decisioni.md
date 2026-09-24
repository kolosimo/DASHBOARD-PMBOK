# Cruscotto commesse Climosfera: sintesi e decisioni

> Stato al 24/09/2026, revisione 3 (dopo verifica profonda). Piano di costruzione: `docs/sviluppo/piano.md`. I rapporti di dettaglio con le fonti sono in `docs/ricerca/01…08`. La verifica delle affermazioni chiave è in `07`.

## 1. Requisiti

| Voce | Valore | Fonte |
|---|---|---|
| PM | 16, ciascuno con al massimo 3 commesse: circa 50 commesse attive | utente |
| Utenti | fino a circa 10 per commessa, circa 100 in tutto | stima |
| Dati | **app autonoma, si parte da zero sulle nuove commesse**. Nessuna migrazione né lettura da GoodDay | utente, rev. 2 |
| Ore | registrate **solo nella nuova app** (timesheet interno) | utente, rev. 2 |
| Client | **installabile su Windows e su Mac** (su Mac 1–5 utenti) | utente, rev. 2 |
| Server | uno solo, probabilmente Windows Server | utente (da verificare) |
| Identità | Microsoft 365 (Entra ID) | utente |
| Accesso remoto | VPN | utente |
| MVP | Kanban + Last Planner System; ore e budget (EVM) | utente |
| Vincolo | non eccessivamente complessa | utente |
| Manutenzione | l'utente con Claude, codice su GitHub | utente |

## 2. Architettura consigliata (rev. 2)

L'uso simultaneo richiede **un database unico sul server**. I PC Windows e Mac sono solo finestre sui dati. Un file condiviso su cartella di rete è scartato perché si corrompe con le scritture simultanee (vedi 08, 07 #11).

```
PC Windows / Mac ── app installata (PWA da Edge/Chrome; Dock di Safari da provare [NV])
        │ HTTPS, dentro la VPN
Windows Server aziendale
  ├── servizio "Cruscotto" (AdonisJS, Node.js + TypeScript, avviato da WinSW): schermate, calcoli, login M365 lato server (OIDC)
  └── servizio PostgreSQL: il database, con backup notturno
```

**Perché questa soluzione:**
- un solo linguaggio (TypeScript);
- niente Docker e niente VM Linux;
- niente installer da firmare e niente costi annui;
- per aggiornare si aggiorna solo il server.

**Fuori ambito (decisione utente):** BIM (ISO 19650, UNI 11337, BCF, Revit/IFC), client Electron, integrazione GoodDay.

**Cosa cambia rispetto alla rev. 1:** Django + Docker su VM Linux è abbandonato. Era pensato per un server Linux e avrebbe richiesto Python per il server e JavaScript per le schermate, cioè due linguaggi.

## 3. Moduli dell'MVP

1. **Commesse e team**: anagrafica, milestone contrattuali, elaborati con budget ore.
2. **Last Planner**:
   - lookahead a 6 settimane con registro vincoli;
   - piano settimanale (promesso / fatto / causa);
   - PPC, PCR e Pareto delle cause.
3. **Kanban degli elaborati** con limiti WIP. Lo stato dell'elaborato determina l'EV, con pesi 20/50/70/85/100 da tarare.
4. **Ore**: timesheet settimanale per elaborato. Fornisce il consuntivo AC all'EVM.
5. **EVM in ore**: PV, EV, AC, SPI, CPI, EAC e curva S.
6. **Vista di commessa (Obeya)** e **portafoglio del PM**.

**Rimandati:**
- issue BCF;
- registri PMBOK completi (rischi, change, decisioni);
- export Excel.

## 4. Cosa dice la ricerca (sintesi)

- **PMBOK 8** (2025): 6 principi, 7 domini, tailoring predittivo/adattivo/ibrido. L'EVM segue lo standard ANSI/PMI 19-006-2019. → 01, verificato in 07
- **Lean**: il Last Planner ha 5 livelli, con dati minimi e formule PPC/TMR/TA/PCR documentati. Non esiste un target di PPC validato per la progettazione. → 02
- **Tool esistenti**: nessun tool open source fa il Last Planner. OpenProject ha il login M365 a pagamento. → 03
- **Settore progettazione impiantistica**: l'EV va legato allo stato dell'elaborato, non alla percentuale dichiarata. → 05
- **GoodDay** (06): *archiviato*, non più rilevante dopo la decisione della rev. 2.

## 5. Decisioni aperte

| # | Domanda | Chi | Impatto |
|---|---|---|---|
| D1 | Server: versione di Windows Server, RAM, CPU e disco liberi; si possono installare servizi (Node, PostgreSQL)? | IT interno / esterno | installazione |
| D2 | Certificato HTTPS per il nome interno del server (CA aziendale?) | IT / sicurezza esterna | PWA e login M365 |
| D3 | Registrazione dell'app su Entra ID: chi è amministratore del tenant M365? | IT | login |
| D4 | Informativa ai dipendenti e verifica art. 4 Statuto dei lavoratori per ore e PPC | consulente del lavoro | GDPR, visibilità per ruolo |
| D5 | Pesi degli stati per l'EV e soglie dei semafori | PM (con il prototipo) | EVM affidabile |
| D7 | Login M365 nella web app del Dock di Safari: prova su un Mac vero | utente al Gate 2 | piano B: Chrome/Edge su Mac |
| D6 | GoodDay resta attivo per le vecchie commesse? Serve una data di passaggio chiara | direzione | evita il doppio inserimento |

## 6. Rischi principali

1. **Doppio inserimento** se qualcuno continua a segnare le ore anche su GoodDay per le nuove commesse: serve una regola chiara (D6).
2. **PPC e ore usati per valutare le persone**: rischio legale (art. 4, commi 1–3) e culturale. I dati vanno mostrati per team o commessa.
3. **EV "a opinione"**: evitato legando l'EV agli stati dell'elaborato.
4. **Persona chiave**: servono codice su GitHub, documentazione e un ambiente di prova.
5. **Crescita dei requisiti**: l'MVP resta su Last Planner + EVM.
6. **Operatività del server**: certificato HTTPS, backup di PostgreSQL con prova di ripristino, aggiornamenti.
