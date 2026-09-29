# Installazione su Windows Server 2019

Guida passo passo per installare il Cruscotto commesse sul server aziendale
(**Windows Server 2019 Standard, versione 1809**) per il pilota con 2 PM.
Destinatari: l'IT (checklist) e chi installa (ingegnere o IT).

Documenti collegati: [aggiornamento.md](aggiornamento.md) ·
[backup-e-ripristino.md](backup-e-ripristino.md).

## Come è fatto

```
PC e Mac (VPN) ──https://cruscotto.climosfera.local──▶ porta 443
                                                         │
                              Windows Server 2019        ▼
                              ┌─────────────────────────────────────────┐
                              │ servizio "cruscotto" (WinSW 2.12.0)     │
                              │   └─ C:\app\node\node.exe bin\server.js │
                              │        HTTPS diretto con certificato PFX│
                              │                 │                       │
                              │                 ▼ 127.0.0.1:5432         │
                              │ PostgreSQL 17 (EDB), solo localhost     │
                              └─────────────────────────────────────────┘
```

- Nessun IIS: Node gestisce direttamente HTTPS (TLS 1.2 e 1.3) con il certificato in PFX.
- PostgreSQL ascolta solo su `localhost`; la porta 5432 è bloccata dal firewall.
- Il pilota usa **account locali** (email + password gestiti dall'admin dell'app,
  `AUTH_MODE=locale`). Il login Microsoft 365 si attiva dopo, senza reinstallare
  (vedi [Passare a Microsoft 365](#passare-a-microsoft-365)).
- Il database parte **vuoto**: solo configurazione (discipline, stati e pesi EV, colonne
  Kanban e WIP, cause, impostazioni) e l'amministratore. I PM inseriscono le commesse reali.

### Cartelle sul server

| Cartella | Contenuto |
|---|---|
| `C:\app\node` | Node 24 (distribuzione zip) |
| `C:\app\cruscotto` | app in uso (sostituita a ogni aggiornamento) |
| `C:\app\cruscotto.precedente` | versione precedente (per tornare indietro) |
| `C:\app\config` | `.env`, `certificato.pfx`, `installazione.json`, log di installazione e aggiornamento. **Solo amministratori, SYSTEM e account del servizio** |
| `C:\app\servizio` | `cruscotto.exe` (WinSW), `cruscotto.xml`, `log\` |
| `C:\app\script` | script di gestione (`servizio.ps1`, `backup.ps1`, `aggiorna.ps1`, `ripristino.ps1`, `ace.ps1`) |
| `C:\app\backup` | backup giornalieri del database (`*.dump`) e `backup.log` |
| `C:\app\versioni` | pacchetti estratti (restano gli ultimi 3) |

## Checklist per l'IT

Da completare **prima** dell'installazione. Tutto si può preparare offline.

| # | Cosa | Dettagli | Fatto |
|---|---|---|---|
| 1 | **Aggiornamenti cumulativi** | Windows Server 2019 1809 con l'ultimo aggiornamento cumulativo e .NET Framework 4.7.2 o successivo (già presente in WS2019). Concordare una finestra di riavvio: il servizio riparte da solo | ☐ |
| 2 | **VC++ Redistributable 2015-2022 x64** | Installare `vc_redist.x64.exe` (lo installa anche l'installer di PostgreSQL) | ☐ |
| 3 | **Risorse** | 4 vCPU, 8 GB RAM, 60 GB liberi su C: (o sul disco scelto) | ☐ |
| 4 | **DNS interno** | Record A, per esempio `cruscotto.climosfera.local` → IP del server, risolvibile anche dai client in VPN | ☐ |
| 5 | **Certificato AD CS** | Modello "Server Web", **SAN** con l'FQDN del punto 4 (ed eventuale nome corto), chiave esportabile. Esportato in **PFX con catena completa e cifratura AES256-SHA256** (vedi sotto) | ☐ |
| 6 | **Root CA sui client** | PC Windows del dominio: già attendibile via GPO. **Mac: installazione a mano** (vedi sotto) | ☐ |
| 7 | **Firewall e VPN** | Porta **443** TCP in ingresso sul server (profili Dominio/Privato; lo script crea la regola) e raggiungibile dal pool VPN. Porta **5432 mai esposta** (lo script la blocca) | ☐ |
| 8 | **Account del servizio** | Predefinito `NT AUTHORITY\LocalService` (nessuna password da gestire). In alternativa un account di dominio dedicato con il diritto "Accedi come servizio" | ☐ |
| 9 | **Cartella di backup di rete** (facoltativa) | Condivisione, es. `\\nas01\backup\cruscotto`, con scrittura per l'account computer del server (`DOMINIO\NOMESERVER$`): il backup gira come SYSTEM | ☐ |
| 10 | **Installer offline** | Node 24 LTS zip win-x64 (`node-v24.x.y-win-x64.zip`, **non** l'MSI: problema aperto nodejs/node#64078 su WS2019); PostgreSQL 17 (ultima minor) installer EDB; **WinSW v2.12.0 `WinSW-NET461.exe`** (GitHub winsw/winsw, release v2.12.0; la v3 è pre-release) | ☐ |
| 11 | **Porta 443 libera** | Nessun IIS o altro servizio in ascolto sulla 443 del server | ☐ |
| 12 | **Antivirus** (facoltativo) | Esclusione della cartella dati di PostgreSQL (`C:\Program Files\PostgreSQL\17\data`), come raccomandato da EDB | ☐ |

### Punto 5: esportare il certificato in PFX AES256-SHA256

Node 24 usa OpenSSL 3, che **non legge** i PFX con la vecchia cifratura TripleDES/RC2
(l'avvio fallisce con "cifratura non supportata"). In Windows Server 2019:

**Da interfaccia** (`certlm.msc` → Personale → Certificati → certificato → Tutte le
attività → Esporta):
1. "Sì, esporta la chiave privata";
2. formato PFX: spuntare **"Se possibile, includi tutti i certificati nel percorso
   certificazione"**;
3. protezione: password, **Crittografia: AES256-SHA256** (non TripleDES-SHA1);
4. salvare come `cruscotto.pfx`.

**Da PowerShell** (amministratore):

```powershell
$password = Read-Host -AsSecureString 'Password del PFX'
Get-ChildItem Cert:\LocalMachine\My | Where-Object Subject -like '*cruscotto*'   # annotare l'impronta
Export-PfxCertificate -Cert Cert:\LocalMachine\My\<IMPRONTA> -FilePath C:\app\installer\cruscotto.pfx `
    -Password $password -ChainOption BuildChain -CryptoAlgorithmOption AES256_SHA256
```

Password del PFX: niente apostrofi (`'`) e niente a capo.

**Se il PFX esiste già con cifratura legacy**, si converte con OpenSSL 3 (anche su un altro PC):

```
openssl pkcs12 -in vecchio.pfx -legacy -nodes -out tmp.pem
openssl pkcs12 -export -in tmp.pem -out cruscotto.pfx -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
del tmp.pem
```

Controllo: `openssl pkcs12 -in cruscotto.pfx -info -noout` deve riportare
`PBES2, PBKDF2, AES-256-CBC` e `MAC: sha256`. Dopo l'installazione:
`C:\app\script\ace.ps1 certificato:scadenza` mostra SAN, emittente e giorni alla scadenza.

### Punto 6: root CA sui Mac

1. Esportare la root CA aziendale in `.cer` (Base64 o DER).
2. Sul Mac: doppio clic sul file → Accesso Portachiavi → portachiavi **Sistema**.
3. Doppio clic sul certificato → Attendibilità → "Quando si usa questo certificato":
   **Fidati sempre**. Chiudere e confermare con la password.
4. Safari, Chrome ed Edge usano il portachiavi di sistema. Firefox no: impostare
   `security.enterprise_roots.enabled = true` in `about:config`.

## Installazione passo passo

Tempo stimato: 30–45 minuti. Tutti i comandi in **PowerShell come amministratore**.

### 1. PostgreSQL 17

1. Eseguire l'installer EDB di PostgreSQL 17: componenti *PostgreSQL Server* e
   *Command Line Tools* (Stack Builder e pgAdmin non servono), porta **5432**,
   locale predefinito.
2. Scegliere la password dell'utente `postgres` e **conservarla** nel gestore password
   dell'IT: serve all'installazione e alla prova di ripristino.
3. Non serve altro: lo script imposta l'ascolto solo su `localhost`.

### 2. Node 24 e WinSW

```powershell
New-Item -ItemType Directory -Force C:\app\node, C:\app\installer | Out-Null
Expand-Archive C:\Scaricati\node-v24.x.y-win-x64.zip -DestinationPath C:\app\installer\node
Move-Item C:\app\installer\node\node-v24.x.y-win-x64\* C:\app\node\
C:\app\node\node.exe --version        # deve iniziare con v24.
Copy-Item C:\Scaricati\WinSW-NET461.exe C:\app\installer\
Copy-Item C:\Scaricati\cruscotto.pfx C:\app\installer\
```

### 3. Pacchetto dell'app

Il pacchetto `cruscotto-commesse-<versione>-<data>-<commit>.zip` (con il file `.sha256`)
si prepara sul PC di sviluppo con `npm run pacchetto` (vedi [aggiornamento.md](aggiornamento.md)).

```powershell
Get-FileHash C:\Scaricati\cruscotto-commesse-*.zip -Algorithm SHA256   # confrontare con il .sha256
Unblock-File C:\Scaricati\cruscotto-commesse-*.zip                      # file arrivato da un altro PC
Expand-Archive C:\Scaricati\cruscotto-commesse-*.zip -DestinationPath C:\app\installer
```

L'estrazione crea `C:\app\installer\cruscotto\` (qualche minuto: circa 8.500 file).

### 4. Script di installazione

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\app\installer\cruscotto\deploy\windows
.\installa.ps1 -NomeHost cruscotto.climosfera.local `
    -PercorsoPfx C:\app\installer\cruscotto.pfx `
    -WinSW C:\app\installer\WinSW-NET461.exe `
    -AdminEmail nome.cognome@climosfera.it -AdminNome "Nome Cognome" `
    -CartellaRete \\nas01\backup\cruscotto
```

Parametri facoltativi utili: `-Porta 443`, `-PgBin "C:\Program Files\PostgreSQL\17\bin"`,
`-ServizioPostgres postgresql-x64-17`, `-AccountServizio "DOMINIO\svc-cruscotto"`,
`-GiorniBackup 30`, `-OraBackup 21:30`, `-ReindirizzaHttp` (apre anche la porta 80 che
reindirizza a https). `Get-Help .\installa.ps1 -Full` mostra tutto.

Lo script chiede due password (non vengono salvate nei log):
- quella dell'utente `postgres` (punto 1);
- quella del file PFX.

Cosa fa: controlla i prerequisiti, copia l'app, configura PostgreSQL (solo localhost,
utente e database `cruscotto` con password casuale), crea `C:\app\config\.env` con
`APP_KEY` generata, restringe i permessi, esegue migrazioni e configurazione iniziale
(`db:inizializza-produzione`), crea l'amministratore, installa il servizio WinSW, apre la
443, blocca la 5432, pianifica il backup giornaliero e il controllo settimanale del
certificato, avvia il servizio e verifica che risponda.

**Annotare la password temporanea dell'amministratore** che compare al passo 6: non
viene più mostrata. Se si perde:
`C:\app\script\ace.ps1 utenti:crea-admin --email nome.cognome@climosfera.it --reimposta`.

Lo script si può rilanciare: riconosce ciò che è già fatto e non cancella dati.

### 5. Prova dai client

1. Da un PC in VPN: `https://cruscotto.climosfera.local` → lucchetto senza avvisi.
2. Accesso con l'email dell'amministratore e la password temporanea → scelta della
   nuova password (almeno 12 caratteri).
3. *Admin → Utenti e ruoli*: creare i 2 PM (ruolo `pm`) e consegnare le password
   temporanee di persona.
4. Ripetere la prova da un Mac (Safari e Chrome) dopo aver installato la root CA.
5. Fare subito una prova di backup e ripristino ([backup-e-ripristino.md](backup-e-ripristino.md)).

## Gestione quotidiana

| Operazione | Comando |
|---|---|
| Stato (servizio, porta, risposta, versione, ultimo backup, spazio, certificato) | `C:\app\script\servizio.ps1 stato` |
| Riavvio (dopo una modifica al `.env`) | `C:\app\script\servizio.ps1 restart` |
| Fermare / avviare | `servizio.ps1 stop` / `servizio.ps1 start` |
| Giorni alla scadenza del certificato | `servizio.ps1 certificato` |
| Comandi dell'app | `C:\app\script\ace.ps1 <comando>` (es. `migration:status`) |
| Log dell'app | `C:\app\servizio\log\cruscotto.out.log` e `cruscotto.err.log` (10 MB per file, ultimi 10) |
| Log del servizio (WinSW) | `C:\app\servizio\log\cruscotto.wrapper.log` |
| Eventi | Visualizzatore eventi → Registri di Windows → Applicazione, origine **Cruscotto commesse** |

### Eventi registrati

| ID | Tipo | Significato |
|---|---|---|
| 1000 / 1001 | Info / Errore | installazione completata / app che non risponde dopo l'installazione |
| 2000 / 2001 / 2002 | Info / Errore / Avviso | backup riuscito / non riuscito / copia di rete non riuscita |
| 3000 / 3001 | Info / Errore | ripristino riuscito / non riuscito |
| 4000 / 4001 | Info / Errore | aggiornamento riuscito / non riuscito (versione precedente rimessa) |
| 5001 / 5002 | Avviso / Errore | certificato in scadenza entro 30 giorni / PFX non leggibile |

Il servizio riparte da solo se Node si ferma in modo anomalo (dopo 10 s, 30 s, 2 min;
contatore azzerato dopo un'ora) e parte in automatico, in modo ritardato, dopo PostgreSQL.

### Rinnovo del certificato

1. L'IT emette il nuovo certificato ed esporta il PFX AES256-SHA256 (punto 5).
2. Copiarlo su `C:\app\config\certificato.pfx` (sostituendo il vecchio).
3. Se la password è cambiata, aggiornare `HTTPS_PFX_PASSPHRASE` in `C:\app\config\.env`
   (tra apici singoli; un eventuale `$` va scritto `\$`).
4. `C:\app\script\servizio.ps1 certificato` → nuova scadenza; poi `servizio.ps1 restart`.

### Passare a Microsoft 365

Dopo il pilota, senza reinstallare:
1. l'IT registra l'app su Entra ID con redirect `https://<FQDN>/auth/callback`;
2. in `C:\app\config\.env`: `AUTH_MODE=oidc`, `OIDC_ISSUER=https://login.microsoftonline.com/<ID-TENANT>/v2.0`,
   `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`;
3. `servizio.ps1 restart`. Gli utenti creati nel pilota vengono collegati per email al
   primo accesso Microsoft.

### Disinstallazione

`servizio.ps1 uninstall` rimuove il servizio; poi si possono eliminare le attività
pianificate "Cruscotto commesse - backup" e "Cruscotto commesse - certificato", le regole
firewall "Cruscotto commesse …" e la cartella `C:\app`. Il database resta in PostgreSQL
finché non lo si elimina (`drop database cruscotto`), **dopo** averne fatto un backup.

## Problemi frequenti

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Il servizio si ferma subito, `.err.log` con "cifratura non supportata" | PFX esportato con TripleDES | Riesportare AES256-SHA256 (punto 5) |
| "Password del PFX errata" | `HTTPS_PFX_PASSPHRASE` sbagliata o con `$`/`#` non protetti | Correggere il `.env` (tra apici, `\$`) e riavviare |
| "La porta 443 è già in uso" | IIS o altro servizio | Fermare IIS (`Stop-Service W3SVC`; disattivarlo) o usare `-Porta` |
| Il browser segnala il certificato | Root CA non installata (Mac) o FQDN non nel SAN | Punto 6; controllare il SAN con `servizio.ps1 certificato` |
| La pagina non si apre dalla VPN | DNS o regola VPN | `Resolve-DnsName` dal client; `Test-NetConnection <FQDN> -Port 443` |
| "Avvio rifiutato: AUTH_MODE=dev …" | `.env` modificato a mano | In produzione `AUTH_MODE` è `locale` o `oidc` |
| `db:inizializza-produzione` rifiuta "utenti di esempio" | Il database contiene i dati di esempio dello sviluppo | Usare un database nuovo; il comando non cancella dati |
| Backup di rete non riuscito (evento 2002) | Permessi della condivisione | Scrittura per `DOMINIO\NOMESERVER$` |
