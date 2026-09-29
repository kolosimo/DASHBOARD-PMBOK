# Aggiornamento

Come portare sul server una nuova versione del Cruscotto commesse, e come aggiornare
Node, PostgreSQL e Windows. Installazione iniziale: [guida-it-windows-server-2019.md](guida-it-windows-server-2019.md).

## 1. Preparare il pacchetto (PC di sviluppo)

Sul branch da rilasciare, con `npm run verifica` verde e nessuna modifica non committata:

```
npm run pacchetto
```

(Finché lo script npm non è registrato: `node deploy/pacchetto.mjs`.)

Il comando, scritto in Node e uguale su Windows, macOS e Linux:
1. controlla gli script PowerShell e che non ci siano dipendenze native;
2. esegue `node ace build`;
3. copia la build senza test ed e2e, più `deploy/windows` e `docs/installazione`;
4. esegue `npm ci --omit=dev --omit=optional` (niente script di installazione, niente
   binari per piattaforma degli strumenti di build);
5. ricontrolla che in `node_modules` non ci siano moduli nativi (`.node`, `binding.gyp`)
   e che nessun percorso superi il limite di Windows;
6. crea in `tmp/pacchetto/`:
   - `cruscotto-commesse-<versione>-<aaaammgg>-<commit>.zip`
   - lo stesso nome con `.sha256`.

Se ci sono modifiche non committate il nome finisce con `-modificato`: non installarlo
sul server. La versione è quella di `package.json` (da aumentare a ogni rilascio); il
commit identifica esattamente il codice. Dentro lo zip tutto sta sotto `cruscotto/`, con
`versione.json` (versione, commit, data, Node usato).

## 2. Aggiornare il server

Copiare zip e `.sha256` sul server (es. `C:\app\installer`), poi in PowerShell come
amministratore:

```powershell
Unblock-File C:\app\installer\cruscotto-commesse-0.2.0-20261020-ab12cd3.zip
Set-ExecutionPolicy -Scope Process Bypass -Force
C:\app\script\aggiorna.ps1 -Pacchetto C:\app\installer\cruscotto-commesse-0.2.0-20261020-ab12cd3.zip
```

Avvisare prima i PM: l'app resta ferma per 1–3 minuti.

Cosa fa `aggiorna.ps1`:

| Passo | Dettagli |
|---|---|
| 1. Pacchetto | verifica lo SHA-256 (se c'è il `.sha256`), estrae in `C:\app\versioni\<data-ora>`, controlla che sia completo, mostra versione attuale e nuova |
| 2. Backup | `backup.ps1 -Etichetta prima-aggiornamento`. Se fallisce, si ferma **senza toccare nulla** |
| 3. Arresto | ferma il servizio |
| 4. Sostituzione | `C:\app\cruscotto` → `C:\app\cruscotto.precedente`; la nuova versione prende il suo posto (con i permessi per l'account del servizio) |
| 5. Database | `db:inizializza-produzione`: migrazioni mancanti e configurazione nuova. Non cancella dati |
| 6. Avvio | avvia il servizio e aspetta che `/accesso` risponda (90 s) |
| Fine | aggiorna gli script in `C:\app\script`, tiene le ultime 3 estrazioni |

`.env` e certificato (`C:\app\config`) non vengono toccati.

### Se qualcosa va storto

Se il passo 5 o 6 fallisce, lo script **torna indietro da solo**:
1. ferma il servizio;
2. ricarica il database dal backup del passo 2 (solo se le migrazioni erano partite);
3. rimette `C:\app\cruscotto.precedente` al suo posto (la versione nuova finisce in
   `C:\app\cruscotto.fallita-<data-ora>` per l'analisi);
4. riavvia e controlla che risponda; scrive l'evento 4001.

Il dettaglio è in `C:\app\config\aggiornamento-<data-ora>.log` e nei log del servizio.

### Tornare indietro a mano (dopo un aggiornamento riuscito)

Se un problema emerge più tardi:

```powershell
C:\app\script\servizio.ps1 stop
Rename-Item C:\app\cruscotto cruscotto.scartata
Rename-Item C:\app\cruscotto.precedente cruscotto
C:\app\script\ripristino.ps1 -File C:\app\backup\cruscotto_cruscotto_<data>_prima-aggiornamento.dump
```

Il ripristino riavvia il servizio. Attenzione: si perde quanto inserito dopo
l'aggiornamento (resta nel backup di sicurezza "prima-del-ripristino").

## Node, PostgreSQL e Windows

### Node 24 (nuova versione minor o patch)

Solo la distribuzione **zip** (non l'MSI).

```powershell
C:\app\script\servizio.ps1 stop
Rename-Item C:\app\node node.precedente
Expand-Archive C:\Scaricati\node-v24.x.y-win-x64.zip -DestinationPath C:\app\installer\node-nuovo
Move-Item C:\app\installer\node-nuovo\node-v24.x.y-win-x64 C:\app\node
icacls C:\app\node /grant "*S-1-5-19:(OI)(CI)RX"      # LocalService; altro account: il suo nome
C:\app\node\node.exe --version
C:\app\script\servizio.ps1 start
```

Se l'app non parte, si rimette `node.precedente`. Il passaggio a Node 26 va provato prima
in sviluppo (AdonisJS e dipendenze).

### PostgreSQL 17 (minor, es. 17.6 → 17.7)

1. `backup.ps1` (a mano) e `servizio.ps1 stop`.
2. Eseguire l'installer EDB della nuova minor: aggiorna i binari mantenendo i dati.
3. `servizio.ps1 start` e `servizio.ps1 stato`.

Il passaggio a una major (18) richiede `pg_upgrade` o backup/ripristino: da pianificare
con l'IT, verificando prima che EDB supporti Windows Server 2019 per quella versione.

### Aggiornamenti di Windows

Nessuna azione: dopo il riavvio il servizio parte da solo (avvio automatico ritardato,
dopo PostgreSQL). Conviene programmarli fuori dall'orario del backup (21:30 predefinito)
e controllare dopo con `servizio.ps1 stato`.

**Ciclo di vita:** il supporto esteso di Windows Server 2019 termina il **09/01/2029**.
La migrazione a Windows Server 2022/2025 si fa con una nuova installazione
(`installa.ps1`) e il ripristino dell'ultimo backup ([backup-e-ripristino.md](backup-e-ripristino.md#ripristino-su-un-server-nuovo)).
