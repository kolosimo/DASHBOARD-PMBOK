# Backup e ripristino

Installazione iniziale: [guida-it-windows-server-2019.md](guida-it-windows-server-2019.md).

## Cosa si salva

| Cosa | Come | Dove |
|---|---|---|
| **Database** (tutti i dati dell'app) | `backup.ps1`: `pg_dump` in formato custom, compresso | `C:\app\backup\cruscotto_<db>_<aaaammgg>_<hhmmss>[_etichetta].dump` e, se configurata, la cartella di rete |
| Configurazione (`C:\app\config\.env`, `certificato.pfx`) | **a mano, una volta** e dopo ogni modifica | gestore password / cassaforte dell'IT (contiene segreti: non sulla condivisione dei backup) |
| App (`C:\app\cruscotto`) | non serve: si reinstalla dal pacchetto zip | — |

Senza il `.env` si può comunque ripartire: `installa.ps1` ne genera uno nuovo (nuove
password del database e `APP_KEY`; gli utenti devono solo rifare l'accesso).

## Backup automatico

`installa.ps1` crea l'attività pianificata **"Cruscotto commesse - backup"**: ogni giorno
alle 21:30, come SYSTEM, esegue `C:\app\script\backup.ps1`, che:
1. esegue `pg_dump --format=custom` con l'utente dell'app (credenziali lette dal `.env`);
   il servizio può restare acceso: il dump è una fotografia coerente;
2. controlla il file con `pg_restore --list` (deve contenere i dati delle tabelle);
3. lo copia sulla cartella di rete, se configurata, e ne verifica la dimensione;
4. elimina i backup più vecchi di **30 giorni** (in locale e in rete), tenendo comunque
   gli ultimi 7;
5. scrive `C:\app\backup\backup.log` e un evento: 2000 (riuscito), 2001 (non riuscito),
   2002 (copia di rete non riuscita).

Codice di uscita: 0 ok, 1 backup non riuscito, 2 solo la copia di rete non è riuscita.

Controllo rapido: `C:\app\script\servizio.ps1 stato` mostra l'ultimo backup e segnala se
ha più di 26 ore. Conviene che l'IT monitori gli eventi 2001 e 2002.

### Impostazioni

Stanno in `C:\app\config\installazione.json` (`CartellaBackup`, `CartellaRete`,
`GiorniBackup`), scritto da `installa.ps1`. Si possono cambiare lì oppure per una singola
esecuzione:

```powershell
C:\app\script\backup.ps1 -Etichetta prima-di-modifiche          # backup a mano
C:\app\script\backup.ps1 -CartellaRete \\nas01\backup\cruscotto -Giorni 60
C:\app\script\backup.ps1 -CartellaRete -                        # senza copia di rete
```

Orario diverso: Utilità di pianificazione → "Cruscotto commesse - backup" → Trigger.

La copia di rete gira come SYSTEM: sulla condivisione serve la scrittura per l'account
computer del server (`DOMINIO\NOMESERVER$`).

## Ripristino

**Sempre come amministratore.** Lo script chiede di digitare il nome del database per
conferma (`-Forza` per saltare la domanda).

### Prova di ripristino (senza toccare l'app)

Da fare **all'installazione** e poi periodicamente (es. ogni mese), ed è il requisito del
Gate 3 ("ripristino provato con l'IT"):

```powershell
C:\app\script\backup.ps1 -Etichetta prova-ripristino
C:\app\script\ripristino.ps1 -File C:\app\backup\cruscotto_cruscotto_<data>_prova-ripristino.dump `
    -DbDestinazione cruscotto_prova
```

- Se `cruscotto_prova` non esiste lo script lo crea (chiede la password di `postgres`).
- Carica il backup e mostra, affiancati, i conteggi di utenti, commesse, elaborati,
  registrazioni ore, audit e migrazioni nel database di prova e in quello dell'app: con
  un backup appena fatto **devono coincidere**.
- A prova finita:
  `& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U postgres -c "drop database cruscotto_prova"`.

### Ripristino vero (sostituisce i dati dell'app)

```powershell
C:\app\script\ripristino.ps1 -File C:\app\backup\cruscotto_cruscotto_20261005_213000.dump
```

Passi:
1. ferma il servizio;
2. fa un **backup di sicurezza** dello stato attuale (`..._prima-del-ripristino.dump`;
   `-SenzaBackupDiSicurezza` per saltarlo, sconsigliato);
3. svuota lo schema del database e carica il backup **in un'unica transazione**;
4. applica le migrazioni mancanti, se il backup viene da una versione precedente dell'app;
5. riavvia il servizio e controlla che l'app risponda (eventi 3000/3001).

Se il passo 3 o 4 fallisce, lo script ricarica da solo il backup di sicurezza e riavvia
l'app sullo stato di partenza. Se anche questo fallisce il servizio **resta fermo** (per
non lavorare su un database incompleto) e il messaggio indica il file da ripristinare.

Tutto ciò che è stato inserito dopo il backup scelto va perso: avvisare i PM prima.

### Ripristino su un server nuovo

Per un guasto del server o la migrazione a Windows Server 2022/2025:
1. preparare il nuovo server con la checklist IT e installare con `installa.ps1`
   (stesso FQDN, database vuoto con la sola configurazione);
2. copiare l'ultimo backup dalla cartella di rete;
3. `C:\app\script\ripristino.ps1 -File <backup>`;
4. se si era conservato il vecchio `.env`, si possono riportare `APP_KEY` e le
   impostazioni personalizzate (non la password del database, che è quella nuova).

## Dettagli tecnici

- Il ripristino gira come **proprietario del database** (l'utente del `.env`): esegue
  `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` e poi
  `pg_restore --no-owner --no-privileges --single-transaction --exit-on-error`. Non serve la
  password di `postgres`, salvo per creare il database di prova.
- `pg_restore --list <file>` mostra il contenuto di un backup senza caricarlo.
- Formato custom: si ripristina solo con `pg_restore` della stessa major o successiva (17+).
- Provato nel container di sviluppo: dump, doppio ripristino su un altro database e
  confronto tabella per tabella (MD5 del contenuto) identico, trigger compresi.
