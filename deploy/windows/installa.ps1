#Requires -Version 5.1
<#
.SYNOPSIS
  Prima installazione del Cruscotto commesse su Windows Server 2019.

.DESCRIPTION
  Da eseguire come amministratore, dalla cartella deploy\windows del pacchetto
  estratto (oppure con -Pacchetto <zip>). Prerequisiti già presenti:
    - Node 24 (distribuzione zip) estratto in C:\app\node (node.exe);
    - PostgreSQL 17 installato con l'installer EDB (servizio postgresql-x64-17);
    - WinSW-NET461.exe v2.12.0 (percorso in -WinSW);
    - certificato del server in PFX cifrato AES256-SHA256 (percorso in -PercorsoPfx).

  Cosa fa, nell'ordine:
    1. controlla i prerequisiti;
    2. copia l'app in C:\app\cruscotto e gli script in C:\app\script;
    3. PostgreSQL: ascolto solo su localhost, utente e database dell'app;
    4. crea C:\app\config\.env dal modello (APP_KEY e password generate) e
       copia il certificato in C:\app\config (permessi ristretti);
    5. migrazioni + configurazione iniziale (node ace db:inizializza-produzione);
    6. crea l'amministratore iniziale (node ace utenti:crea-admin);
    7. installa il servizio WinSW, apre la porta nel firewall, blocca la 5432
       da fuori, pianifica il backup giornaliero;
    8. avvia il servizio e verifica che risponda.

  Si può rilanciare: i passi già fatti vengono riconosciuti e saltati
  (il .env esistente non viene riscritto). Non cancella dati.

.EXAMPLE
  .\installa.ps1 -NomeHost cruscotto.climosfera.local -PercorsoPfx D:\certificati\cruscotto.pfx `
      -AdminEmail mario.rossi@climosfera.it -AdminNome "Mario Rossi" `
      -WinSW D:\installer\WinSW-NET461.exe -CartellaRete \\nas01\backup\cruscotto
#>
[CmdletBinding()]
param(
    # Nome DNS interno con cui gli utenti raggiungono l'app (deve stare nel SAN del certificato)
    [Parameter(Mandatory = $true)][string]$NomeHost,
    # Certificato del server in PFX (AES256-SHA256, con catena)
    [Parameter(Mandatory = $true)][string]$PercorsoPfx,
    # Primo amministratore dell'app
    [Parameter(Mandatory = $true)][string]$AdminEmail,
    [Parameter(Mandatory = $true)][string]$AdminNome,
    # Eseguibile WinSW v2.12.0 NET461 scaricato dall'IT
    [Parameter(Mandatory = $true)][string]$WinSW,
    # Zip del pacchetto; se omesso si usa il pacchetto che contiene questo script
    [string]$Pacchetto,
    [string]$CartellaBase = 'C:\app',
    [string]$CartellaNode = 'C:\app\node',
    [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
    [string]$ServizioPostgres = 'postgresql-x64-17',
    [int]$PortaPostgres = 5432,
    [string]$PgSuperutente = 'postgres',
    [int]$Porta = 443,
    [string]$DbNome = 'cruscotto',
    [string]$DbUtente = 'cruscotto',
    # Account del servizio: NT AUTHORITY\LocalService (predefinito) o DOMINIO\utente
    [string]$AccountServizio = 'NT AUTHORITY\LocalService',
    [string]$CartellaBackup,
    # Cartella di rete per la copia dei backup (facoltativa), es. \\nas01\backup\cruscotto
    [string]$CartellaRete = '',
    [int]$GiorniBackup = 30,
    [string]$OraBackup = '21:30',
    # Apre anche la porta 80 che reindirizza a https
    [switch]$ReindirizzaHttp
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

Assert-Amministratore
if ($PSVersionTable.PSVersion.Major -lt 5) { throw 'Serve Windows PowerShell 5.1 o successivo.' }
if (-not $CartellaBackup) { $CartellaBackup = Join-Path $CartellaBase 'backup' }

$config = [PSCustomObject]@{
    Versione         = 1
    NomeHost         = $NomeHost
    Porta            = $Porta
    CartellaBase     = $CartellaBase
    CartellaApp      = (Join-Path $CartellaBase 'cruscotto')
    CartellaNode     = $CartellaNode
    CartellaConfig   = (Join-Path $CartellaBase 'config')
    CartellaServizio = (Join-Path $CartellaBase 'servizio')
    CartellaScript   = (Join-Path $CartellaBase 'script')
    CartellaVersioni = (Join-Path $CartellaBase 'versioni')
    CartellaBackup   = $CartellaBackup
    CartellaRete     = $CartellaRete
    GiorniBackup     = $GiorniBackup
    PgBin            = $PgBin
    ServizioPostgres = $ServizioPostgres
    IdServizio       = 'cruscotto'
    AccountServizio  = $AccountServizio
}

New-Item -ItemType Directory -Force -Path $config.CartellaConfig | Out-Null
$script:FileLog = Join-Path $config.CartellaConfig ('installazione-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Write-Log "Installazione avviata da $env:USERNAME su $env:COMPUTERNAME"

# ---------------------------------------------------------------------------
Write-Passo '1. Prerequisiti'
# ---------------------------------------------------------------------------
$os = Get-CimInstance Win32_OperatingSystem
Write-Info ("Sistema: {0} (build {1})" -f $os.Caption, $os.BuildNumber)

$node = Join-Path $CartellaNode 'node.exe'
if (-not (Test-Path -LiteralPath $node)) {
    throw "node.exe non trovato in $CartellaNode. Estrarre lo zip di Node 24 (win-x64) in quella cartella."
}
$versioneNode = (& $node --version).Trim()
if ($versioneNode -notmatch '^v24\.') { throw "Serve Node 24: trovato $versioneNode in $node." }
Write-Ok "Node $versioneNode"

foreach ($exe in 'psql.exe', 'pg_dump.exe', 'pg_restore.exe') {
    if (-not (Test-Path -LiteralPath (Join-Path $PgBin $exe))) {
        throw "$exe non trovato in $PgBin. Installare PostgreSQL 17 (EDB) o indicare -PgBin."
    }
}
$servPg = Get-Service -Name $ServizioPostgres -ErrorAction SilentlyContinue
if (-not $servPg) { throw "Servizio PostgreSQL '$ServizioPostgres' non trovato (parametro -ServizioPostgres)." }
if ($servPg.Status -ne 'Running') {
    Start-Service -Name $ServizioPostgres
    [void](Wait-StatoServizio -Nome $ServizioPostgres -Stato Running -Secondi 60)
}
$versionePg = (& (Join-Path $PgBin 'psql.exe') --version)
Write-Ok "PostgreSQL: $versionePg (servizio $ServizioPostgres attivo)"

if (-not (Test-Path -LiteralPath $WinSW)) { throw "WinSW non trovato: $WinSW" }
$infoWinSW = (Get-Item -LiteralPath $WinSW).VersionInfo
Write-Ok ("WinSW {0}" -f $infoWinSW.FileVersion)
if ($infoWinSW.FileVersion -and -not $infoWinSW.FileVersion.StartsWith('2.')) {
    Write-Avviso 'La versione di WinSW prevista è la 2.12.0 (NET461): verificare il file.'
}

if (-not (Test-Path -LiteralPath $PercorsoPfx)) { throw "Certificato PFX non trovato: $PercorsoPfx" }

$vc = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue
if ($vc -and $vc.PSObject.Properties['Installed'] -and $vc.Installed -eq 1) {
    Write-Ok ("VC++ Redistributable 2015-2022 x64: {0}" -f $vc.PSObject.Properties['Version'].Value)
} else {
    Write-Avviso 'VC++ Redistributable 2015-2022 x64 non rilevato: chiedere all''IT di installarlo.'
}

$occupata = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if ($occupata) {
    $proc = Get-Process -Id ($occupata | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue
    $nomeProc = 'sconosciuto'
    if ($proc) { $nomeProc = $proc.ProcessName }
    $servEsistente = Get-Service -Name $config.IdServizio -ErrorAction SilentlyContinue
    if (-not $servEsistente -or $nomeProc -ne 'node') {
        throw "La porta $Porta è già in uso (processo $nomeProc). Liberarla (IIS?) o scegliere -Porta."
    }
}

# ---------------------------------------------------------------------------
Write-Passo '2. File dell''applicazione'
# ---------------------------------------------------------------------------
foreach ($c in $config.CartellaBase, $config.CartellaServizio, (Join-Path $config.CartellaServizio 'log'),
    $config.CartellaScript, $config.CartellaVersioni, $config.CartellaBackup) {
    New-Item -ItemType Directory -Force -Path $c | Out-Null
}

if ($Pacchetto) {
    if (-not (Test-Path -LiteralPath $Pacchetto)) { throw "Pacchetto non trovato: $Pacchetto" }
    # Cartella dal nome corto: i percorsi di node_modules restano sotto i 260 caratteri
    $destinazione = Join-Path $config.CartellaVersioni (Get-Date -Format 'yyyyMMdd-HHmmss')
    if (Test-Path -LiteralPath $destinazione) { Remove-Item -LiteralPath $destinazione -Recurse -Force }
    Write-Info "Estrazione di $Pacchetto ..."
    Expand-Archive -LiteralPath $Pacchetto -DestinationPath $destinazione
    $trovato = Get-ChildItem -LiteralPath $destinazione -Recurse -Filter 'ace.js' -Depth 1 | Select-Object -First 1
    if (-not $trovato) { throw 'Il pacchetto non contiene ace.js: non è un pacchetto del Cruscotto.' }
    $sorgente = $trovato.DirectoryName
} else {
    $sorgente = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    if (-not (Test-Path -LiteralPath (Join-Path $sorgente 'ace.js'))) {
        throw "ace.js non trovato in $sorgente. Eseguire lo script dal pacchetto estratto o usare -Pacchetto."
    }
}
$fileVersione = Join-Path $sorgente 'versione.json'
if (Test-Path -LiteralPath $fileVersione) {
    $v = [IO.File]::ReadAllText($fileVersione) | ConvertFrom-Json
    Write-Info ("Pacchetto: {0} {1} (commit {2})" -f $v.nome, $v.versione, $v.commit)
}

if (Test-Path -LiteralPath (Join-Path $config.CartellaApp 'ace.js')) {
    Write-Avviso "L'app è già presente in $($config.CartellaApp): non viene sovrascritta (per una nuova versione usare aggiorna.ps1)."
} else {
    New-Item -ItemType Directory -Force -Path $config.CartellaApp | Out-Null
    & robocopy.exe $sorgente $config.CartellaApp /E /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copia dell'app non riuscita (robocopy $LASTEXITCODE)." }
    Write-Ok "App copiata in $($config.CartellaApp)"
}
& robocopy.exe (Join-Path $sorgente 'deploy\windows') $config.CartellaScript /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copia degli script non riuscita (robocopy $LASTEXITCODE)." }
Write-Ok "Script copiati in $($config.CartellaScript)"

# ---------------------------------------------------------------------------
Write-Passo '3. PostgreSQL'
# ---------------------------------------------------------------------------
$fileEnv = Get-FileEnvApp $config
$envEsistente = $null
if (Test-Path -LiteralPath $fileEnv) {
    $envEsistente = Read-FileEnv $fileEnv
    Write-Info "Trovato ${fileEnv}: si riusano utente e password del database già configurati."
    $DbNome = $envEsistente['DB_DATABASE']
    $DbUtente = $envEsistente['DB_USER']
    $dbPassword = $envEsistente['DB_PASSWORD']
} else {
    $dbPassword = New-PasswordCasuale 32
}
if ($DbNome -notmatch '^[a-z_][a-z0-9_]*$' -or $DbUtente -notmatch '^[a-z_][a-z0-9_]*$') {
    throw 'Nome del database e utente: solo lettere minuscole, cifre e trattino basso.'
}

$pwdSuper = Read-Host -AsSecureString "Password dell'utente '$PgSuperutente' di PostgreSQL (scelta all'installazione EDB)"
$psql = Join-Path $PgBin 'psql.exe'
$env:PGPASSWORD = ConvertTo-TestoInChiaro $pwdSuper
function Invoke-SqlSuper {
    # $Descrizione va nei messaggi d'errore al posto dell'SQL (che può contenere password)
    param([string]$Sql, [string]$Descrizione = $Sql)
    $r = & $psql -h 127.0.0.1 -p $PortaPostgres -U $PgSuperutente -d postgres -v ON_ERROR_STOP=1 -tA -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "Comando SQL non riuscito: $Descrizione" }
    return $r
}
try {
    [void](Invoke-SqlSuper 'select 1')
    Write-Ok 'Connessione come superutente riuscita'

    # Solo localhost: ALTER SYSTEM scrive postgresql.auto.conf, serve il riavvio
    $ascolto = (Invoke-SqlSuper 'show listen_addresses' | Out-String).Trim()
    if ($ascolto -ne 'localhost') {
        [void](Invoke-SqlSuper "alter system set listen_addresses = 'localhost'")
        Write-Info "listen_addresses era '$ascolto': impostato 'localhost', riavvio di PostgreSQL..."
        Restart-Service -Name $ServizioPostgres -Force
        [void](Wait-StatoServizio -Nome $ServizioPostgres -Stato Running -Secondi 90)
        Start-Sleep -Seconds 3
    }
    Write-Ok 'PostgreSQL in ascolto solo su localhost'

    $esisteRuolo = (Invoke-SqlSuper "select count(*) from pg_roles where rolname = '$DbUtente'" | Out-String).Trim()
    if ($esisteRuolo -eq '0') {
        [void](Invoke-SqlSuper "create role $DbUtente login password '$dbPassword'" "create role $DbUtente")
        Write-Ok "Creato l'utente $DbUtente"
    } else {
        # allinea la password a quella del .env (nuovo o esistente)
        [void](Invoke-SqlSuper "alter role $DbUtente login password '$dbPassword'" "alter role $DbUtente")
        Write-Ok "Utente $DbUtente già presente: password allineata al .env"
    }
    $esisteDb = (Invoke-SqlSuper "select count(*) from pg_database where datname = '$DbNome'" | Out-String).Trim()
    if ($esisteDb -eq '0') {
        [void](Invoke-SqlSuper "create database $DbNome owner $DbUtente encoding 'UTF8' template template0")
        Write-Ok "Creato il database $DbNome"
    } else {
        Write-Ok "Database $DbNome già presente (i dati restano)"
    }
    [void](Invoke-SqlSuper "revoke all on database $DbNome from public")
    [void](Invoke-SqlSuper "grant connect, temporary on database $DbNome to $DbUtente")
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $pwdSuper = $null
}

# ---------------------------------------------------------------------------
Write-Passo '4. Configurazione (.env) e certificato'
# ---------------------------------------------------------------------------
$pfxDestinazione = Join-Path $config.CartellaConfig 'certificato.pfx'
if ((Resolve-Path -LiteralPath $PercorsoPfx).Path -ne $pfxDestinazione) {
    Copy-Item -LiteralPath $PercorsoPfx -Destination $pfxDestinazione -Force
}
Write-Ok "Certificato copiato in $pfxDestinazione"

$appUrl = "https://$NomeHost"
if ($Porta -ne 443) { $appUrl = "https://${NomeHost}:$Porta" }
$portaRedirect = ''
if ($ReindirizzaHttp) { $portaRedirect = '80' }

if ($envEsistente) {
    Write-Avviso "$fileEnv esiste già: non viene riscritto. Controllare a mano PORT, APP_URL e HTTPS_PFX_*."
} else {
    $pwdPfx = ConvertTo-TestoInChiaro (Read-Host -AsSecureString 'Password del file PFX')
    if ($pwdPfx -match '[\r\n]') { throw 'La password del PFX non può contenere a capo.' }
    $modello = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'env.modello'))
    $sostituzioni = @{
        '{{DATA}}'           = (Get-Date -Format 'dd/MM/yyyy HH:mm')
        '{{PORTA}}'          = [string]$Porta
        '{{APP_KEY}}'        = (New-PasswordCasuale 48)
        '{{APP_URL}}'        = $appUrl
        '{{PFX_PATH}}'       = $pfxDestinazione
        '{{PFX_PASSPHRASE}}' = $pwdPfx
        '{{PORTA_REDIRECT}}' = $portaRedirect
        '{{DB_PORTA}}'       = [string]$PortaPostgres
        '{{DB_UTENTE}}'      = $DbUtente
        '{{DB_PASSWORD}}'    = $dbPassword
        '{{DB_NOME}}'        = $DbNome
    }
    foreach ($k in $sostituzioni.Keys) { $modello = $modello.Replace($k, $sostituzioni[$k]) }
    Write-Utf8SenzaBom -Percorso $fileEnv -Testo $modello
    $pwdPfx = $null
    Write-Ok "Creato $fileEnv"
}

# Permessi: config leggibile solo da Administrators, SYSTEM e account del servizio
$sidAccount = Get-IdentitaAccount $AccountServizio
& icacls.exe $config.CartellaConfig /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "${sidAccount}:(OI)(CI)R" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "icacls non riuscito su $($config.CartellaConfig)" }
Grant-PermessiApp -Config $config
& icacls.exe $CartellaNode /grant "${sidAccount}:(OI)(CI)RX" | Out-Null
& icacls.exe $config.CartellaServizio /grant "${sidAccount}:(OI)(CI)M" | Out-Null
Write-Ok "Permessi impostati (account del servizio: $AccountServizio)"

Save-ConfigInstallazione -Config $config
Write-Ok "Salvato $script:FileConfigPredefinito"

$codice = Invoke-Ace -Config $config -Argomenti @('certificato:scadenza')
if ($codice -eq 2) { throw 'Il certificato non si legge: vedere il messaggio sopra (PFX legacy o password errata).' }
if ($codice -ne 0) { Write-Avviso 'Il certificato scade a breve: chiedere il rinnovo all''IT.' }

# ---------------------------------------------------------------------------
Write-Passo '5. Database: migrazioni e configurazione iniziale'
# ---------------------------------------------------------------------------
$codice = Invoke-Ace -Config $config -Argomenti @('db:inizializza-produzione')
if ($codice -ne 0) { throw 'db:inizializza-produzione non riuscito: vedere i messaggi sopra.' }

# ---------------------------------------------------------------------------
Write-Passo '6. Amministratore iniziale'
# ---------------------------------------------------------------------------
$codice = Invoke-Ace -Config $config -Argomenti @('utenti:crea-admin', '--email', $AdminEmail, '--nome', $AdminNome)
if ($codice -ne 0) {
    Write-Avviso ('Amministratore non creato (esiste già?). Per una nuova password temporanea: ' +
        "C:\app\script\ace.ps1 utenti:crea-admin --email $AdminEmail --reimposta")
} else {
    Write-Avviso 'Annotare ORA la password temporanea mostrata sopra: non verrà più visualizzata.'
}

# ---------------------------------------------------------------------------
Write-Passo '7. Servizio Windows, firewall, backup pianificato'
# ---------------------------------------------------------------------------
$exeServizio = Get-EseguibileServizio $config
$xmlServizio = [IO.Path]::ChangeExtension($exeServizio, '.xml')
$servizio = Get-Service -Name $config.IdServizio -ErrorAction SilentlyContinue
if ($servizio) { Stop-ServizioCruscotto -Config $config }
Copy-Item -LiteralPath $WinSW -Destination $exeServizio -Force
$xml = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'cruscotto.xml'))
$segnaposti = @{
    '{{ID_SERVIZIO}}'       = $config.IdServizio
    '{{PORTA}}'             = [string]$Porta
    '{{CARTELLA_NODE}}'     = $CartellaNode
    '{{CARTELLA_APP}}'      = $config.CartellaApp
    '{{CARTELLA_CONFIG}}'   = $config.CartellaConfig
    '{{CARTELLA_SERVIZIO}}' = $config.CartellaServizio
    '{{SERVIZIO_POSTGRES}}' = $ServizioPostgres
}
foreach ($k in $segnaposti.Keys) { $xml = $xml.Replace($k, [Security.SecurityElement]::Escape($segnaposti[$k])) }
Write-Utf8SenzaBom -Percorso $xmlServizio -Testo $xml

if (-not $servizio) {
    & $exeServizio install | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Installazione del servizio WinSW non riuscita ($LASTEXITCODE)." }
    Write-Ok "Servizio '$($config.IdServizio)' installato"
} else {
    Write-Ok "Servizio '$($config.IdServizio)' già installato: configurazione XML aggiornata"
}

# Account del servizio (Win32_Service.Change: gestisce anche la password vuota di LocalService)
$wmi = Get-CimInstance -ClassName Win32_Service -Filter "Name='$($config.IdServizio)'"
if ($AccountServizio -like 'NT AUTHORITY\*') {
    $esito = Invoke-CimMethod -InputObject $wmi -MethodName Change -Arguments @{ StartName = $AccountServizio; StartPassword = '' }
} else {
    $cred = Get-Credential -UserName $AccountServizio -Message 'Password dell''account del servizio'
    $esito = Invoke-CimMethod -InputObject $wmi -MethodName Change -Arguments @{
        StartName = $AccountServizio; StartPassword = $cred.GetNetworkCredential().Password
    }
    Write-Avviso "All'account $AccountServizio serve il diritto 'Accedi come servizio' (criteri di gruppo)."
}
if ($esito.ReturnValue -ne 0) { throw "Impostazione dell'account del servizio non riuscita (codice $($esito.ReturnValue))." }
Write-Ok "Il servizio gira come $AccountServizio"

# Firewall: porta dell'app aperta, PostgreSQL mai raggiungibile da fuori
$regola = "Cruscotto commesse HTTPS ($Porta)"
if (-not (Get-NetFirewallRule -DisplayName $regola -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $regola -Direction Inbound -Protocol TCP -LocalPort $Porta `
        -Action Allow -Profile Domain, Private | Out-Null
}
Write-Ok "Firewall: porta $Porta aperta (profili Dominio e Privato)"
if ($ReindirizzaHttp) {
    $regola80 = 'Cruscotto commesse HTTP (80, reindirizzamento)'
    if (-not (Get-NetFirewallRule -DisplayName $regola80 -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $regola80 -Direction Inbound -Protocol TCP -LocalPort 80 `
            -Action Allow -Profile Domain, Private | Out-Null
    }
    Write-Ok 'Firewall: porta 80 aperta per il reindirizzamento a https'
}
$regolePg = Get-NetFirewallPortFilter -Protocol TCP -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq [string]$PortaPostgres } | Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' -and $_.Enabled -eq 'True' }
foreach ($r in @($regolePg)) {
    if ($r) {
        Disable-NetFirewallRule -Name $r.Name
        Write-Info "Disattivata la regola firewall '$($r.DisplayName)' che apriva la porta $PortaPostgres"
    }
}
$regolaBlocco = "PostgreSQL $PortaPostgres bloccato (solo localhost)"
if (-not (Get-NetFirewallRule -DisplayName $regolaBlocco -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $regolaBlocco -Direction Inbound -Protocol TCP -LocalPort $PortaPostgres `
        -Action Block -Profile Any | Out-Null
}
Write-Ok "Firewall: porta $PortaPostgres bloccata da fuori"

# Registro eventi e backup giornaliero (attività pianificata come SYSTEM)
if (-not [System.Diagnostics.EventLog]::SourceExists($script:SorgenteEventi)) {
    New-EventLog -LogName Application -Source $script:SorgenteEventi
}
$argomenti = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $config.CartellaScript 'backup.ps1')
$azione = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argomenti
$trigger = New-ScheduledTaskTrigger -Daily -At $OraBackup
$principale = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$impostazioni = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName 'Cruscotto commesse - backup' -Action $azione -Trigger $trigger `
    -Principal $principale -Settings $impostazioni -Force | Out-Null
Write-Ok "Backup pianificato ogni giorno alle $OraBackup in $($config.CartellaBackup) (conservati $GiorniBackup giorni)"
if ($CartellaRete) {
    Write-Info "Copia su ${CartellaRete}: l'attività gira come SYSTEM, quindi sulla condivisione serve il permesso di scrittura per l'account computer $env:COMPUTERNAME`$."
}

# ---------------------------------------------------------------------------
Write-Passo '8. Avvio e verifica'
# ---------------------------------------------------------------------------
Start-ServizioCruscotto -Config $config
if (Test-SaluteApp -Config $config -Secondi 90) {
    Write-Ok "L'app risponde su $(Get-UrlLocale $config)/accesso"
} else {
    Write-Errore "L'app non risponde. Log in $($config.CartellaServizio)\log (file $($config.IdServizio).out.log e .err.log)."
    Write-EventoCruscotto -Messaggio 'Installazione completata ma l''app non risponde.' -Tipo Error -Id 1001
    exit 1
}

Write-Host ''
Write-Ok '=== Installazione completata ==='
Write-Host "  Indirizzo per gli utenti:  $appUrl"
Write-Host "  Configurazione:            $fileEnv"
Write-Host "  Script di gestione:        $($config.CartellaScript)  (servizio.ps1, backup.ps1, aggiorna.ps1, ripristino.ps1, ace.ps1)"
Write-Host "  Log dell'installazione:    $script:FileLog"
Write-Host ''
Write-Host "Prossimi passi: accedere come $AdminEmail con la password temporanea, sceglierne una nuova,"
Write-Host 'creare i PM da Admin > Utenti e ruoli. Provare subito backup e ripristino (docs\installazione).'
Write-EventoCruscotto -Messaggio "Cruscotto commesse installato su $appUrl" -Id 1000
