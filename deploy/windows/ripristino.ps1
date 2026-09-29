#Requires -Version 5.1
<#
.SYNOPSIS
  Ripristina un backup (.dump) del Cruscotto commesse.

.DESCRIPTION
  Due usi:
  - ripristino vero (predefinito): ferma il servizio, fa un backup di
    sicurezza dello stato attuale, sostituisce il database dell'app con il
    contenuto del file, riavvia il servizio e controlla che risponda;
  - prova di ripristino (-DbDestinazione <nome>): carica il backup in un
    ALTRO database (creato se manca, serve la password di "postgres") senza
    toccare l'app, e confronta il numero di righe delle tabelle principali.

  Il database viene svuotato (schema public) e ricaricato in un'unica
  transazione, come utente proprietario (quello del .env).
  Chiede di digitare il nome del database per conferma, salvo -Forza.

.EXAMPLE
  C:\app\script\ripristino.ps1 -File C:\app\backup\cruscotto_cruscotto_20261005_213000.dump
  C:\app\script\ripristino.ps1 -File D:\prova.dump -DbDestinazione cruscotto_prova
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$File,
    [string]$DbDestinazione,
    [switch]$Forza,
    [switch]$SenzaBackupDiSicurezza,
    [string]$FileConfig = 'C:\app\config\installazione.json'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

Assert-Amministratore
$config = Get-ConfigInstallazione $FileConfig
$script:FileLog = Join-Path $config.CartellaBackup 'ripristino.log'
if (-not (Test-Path -LiteralPath $File)) { throw "File di backup non trovato: $File" }
$File = (Resolve-Path -LiteralPath $File).Path

$dbApp = Set-VariabiliPg -Config $config
Clear-VariabiliPg
if (-not $DbDestinazione) { $DbDestinazione = $dbApp }
if ($DbDestinazione -notmatch '^[a-z_][a-z0-9_]*$') { throw 'Nome del database non valido.' }
$suDbApp = ($DbDestinazione -eq $dbApp)

Write-Passo "Ripristino di $File in $DbDestinazione"
if ($suDbApp) {
    Write-Avviso "ATTENZIONE: il database dell'app ($dbApp) verrà SOSTITUITO con il contenuto del backup."
    Write-Avviso 'Tutto ciò che è stato inserito dopo quel backup andrà perso (salvo il backup di sicurezza).'
}
if (-not $Forza) {
    $conferma = Read-Host "Per continuare digitare il nome del database ($DbDestinazione)"
    if ($conferma -ne $DbDestinazione) { Write-Info 'Annullato.'; exit 1 }
}

$psql = Join-Path $config.PgBin 'psql.exe'

if (-not $suDbApp) {
    # Prova su un altro database: si crea se manca (serve il superutente)
    [void](Set-VariabiliPg -Config $config)
    $esiste = (& $psql -d postgres -tA -c "select count(*) from pg_database where datname = '$DbDestinazione'" | Out-String).Trim()
    $utenteApp = $env:PGUSER
    Clear-VariabiliPg
    if ($esiste -ne '1') {
        $pwdSuper = ConvertTo-TestoInChiaro (Read-Host -AsSecureString "Il database $DbDestinazione non esiste: password dell'utente postgres per crearlo")
        $env:PGPASSWORD = $pwdSuper
        & $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "create database $DbDestinazione owner $utenteApp encoding 'UTF8' template template0" | Out-Host
        $codice = $LASTEXITCODE
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        $pwdSuper = $null
        if ($codice -ne 0) { throw "Creazione del database $DbDestinazione non riuscita." }
        Write-Ok "Creato il database di prova $DbDestinazione"
    }
    [void](Set-VariabiliPg -Config $config)
    try {
        Restore-DatabaseCruscotto -Config $config -File $File -Database $DbDestinazione
        Write-Ok "Backup caricato in $DbDestinazione"
        $sql = "select 'utenti', count(*) from utenti union all select 'commesse', count(*) from commesse " +
        "union all select 'elaborati', count(*) from elaborati union all select 'registrazioni_ore', count(*) from registrazioni_ore " +
        "union all select 'audit_log', count(*) from audit_log union all select 'migrazioni', count(*) from adonis_schema"
        Write-Info 'Righe nel database di prova (confrontarle con quelle dell''app):'
        & $psql -d $DbDestinazione -c $sql | Out-Host
        Write-Info "A prova finita il database si elimina con: psql -U postgres -c `"drop database $DbDestinazione`""
    } finally {
        Clear-VariabiliPg
    }
    exit 0
}

# Ripristino vero sul database dell'app
$servizioFermato = $false
$sicurezza = $null
$databaseToccato = $false
try {
    Stop-ServizioCruscotto -Config $config
    $servizioFermato = $true
    Write-Ok 'Servizio fermato'

    if (-not $SenzaBackupDiSicurezza) {
        $sicurezza = & (Join-Path $PSScriptRoot 'backup.ps1') -Etichetta 'prima-del-ripristino' -CartellaRete '-' -FileConfig $FileConfig
        if ($LASTEXITCODE -ne 0) { throw 'Backup di sicurezza non riuscito: ripristino annullato.' }
        $sicurezza = @($sicurezza)[-1]
        Write-Ok "Backup di sicurezza dello stato attuale: $sicurezza"
    }

    [void](Set-VariabiliPg -Config $config)
    try {
        $databaseToccato = $true
        Restore-DatabaseCruscotto -Config $config -File $File -Database $dbApp
    } finally {
        Clear-VariabiliPg
    }
    Write-Ok 'Database ripristinato'

    # Se il backup viene da una versione precedente dell'app, mancano migrazioni
    $codice = Invoke-Ace -Config $config -Argomenti @('db:inizializza-produzione', '--solo-migrazioni')
    if ($codice -ne 0) { throw 'migrazioni dopo il ripristino non riuscite.' }
} catch {
    Write-Errore "Ripristino NON riuscito: $($_.Exception.Message)"
    Write-EventoCruscotto -Messaggio "Ripristino NON riuscito: $($_.Exception.Message)" -Tipo Error -Id 3001
    if ($databaseToccato -and $sicurezza) {
        # Si torna allo stato di partenza con il backup di sicurezza
        Write-Avviso "Ricarico lo stato precedente da $sicurezza ..."
        [void](Set-VariabiliPg -Config $config)
        try {
            Restore-DatabaseCruscotto -Config $config -File $sicurezza -Database $dbApp
            Write-Ok 'Stato precedente ripristinato.'
        } catch {
            Write-Errore ("Anche il ritorno allo stato precedente è fallito: $($_.Exception.Message). " +
                "Il backup di sicurezza è $sicurezza.")
            $servizioFermato = $false   # non riavviare l'app su un database incompleto
        } finally {
            Clear-VariabiliPg
        }
    } elseif ($databaseToccato) {
        $servizioFermato = $false   # nessun backup di sicurezza: l'app resta ferma
        Write-Errore 'Il servizio resta fermo: ripristinare un backup valido prima di riavviarlo.'
    }
    exit 1
} finally {
    if ($servizioFermato) {
        try {
            Start-ServizioCruscotto -Config $config
            Write-Ok 'Servizio avviato'
        } catch {
            Write-Errore "Il servizio non riparte: $($_.Exception.Message)"
        }
    }
}

if (Test-SaluteApp -Config $config -Secondi 90) {
    Write-Ok "Ripristino completato: l'app risponde."
    Write-EventoCruscotto -Messaggio "Database ripristinato da $File" -Id 3000
} else {
    Write-Errore "Ripristino completato ma l'app non risponde: vedere i log in $($config.CartellaServizio)\log."
    exit 1
}
