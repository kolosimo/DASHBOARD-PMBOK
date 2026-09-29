#Requires -Version 5.1
<#
.SYNOPSIS
  Funzioni comuni agli script di installazione del Cruscotto commesse.

.DESCRIPTION
  Si carica con il "dot sourcing" (. "$PSScriptRoot\comune.ps1") da
  installa.ps1, aggiorna.ps1, servizio.ps1, backup.ps1, ripristino.ps1 e
  ace.ps1. Compatibile con Windows PowerShell 5.1 (Windows Server 2019):
  niente operatori "??" o "?:", niente parametri di PowerShell 7.

  La configurazione dell'installazione sta in C:\app\config\installazione.json
  (scritta da installa.ps1); le variabili dell'app in C:\app\config\.env.
#>

Set-StrictMode -Version 2.0

$script:FileConfigPredefinito = 'C:\app\config\installazione.json'
$script:SorgenteEventi = 'Cruscotto commesse'
$script:FileLog = $null

function Write-Passo {
    param([Parameter(Mandatory = $true)][string]$Testo)
    Write-Host ''
    Write-Host "=== $Testo ===" -ForegroundColor Cyan
    Write-Log "=== $Testo ==="
}

function Write-Log {
    <# Scrive a video (se richiesto) e nel file di log corrente, con data e ora #>
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Messaggio,
        [ValidateSet('INFO', 'OK', 'AVVISO', 'ERRORE')][string]$Livello = 'INFO',
        [switch]$ASchermo
    )
    if ($ASchermo) {
        $colore = 'Gray'
        if ($Livello -eq 'OK') { $colore = 'Green' }
        if ($Livello -eq 'AVVISO') { $colore = 'Yellow' }
        if ($Livello -eq 'ERRORE') { $colore = 'Red' }
        Write-Host $Messaggio -ForegroundColor $colore
    }
    if ($script:FileLog) {
        $riga = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Livello, $Messaggio
        try { Add-Content -LiteralPath $script:FileLog -Value $riga -Encoding UTF8 } catch { }
    }
}

function Write-Ok { param([string]$Testo) Write-Log $Testo -Livello OK -ASchermo }
function Write-Info { param([string]$Testo) Write-Log $Testo -Livello INFO -ASchermo }
function Write-Avviso { param([string]$Testo) Write-Log $Testo -Livello AVVISO -ASchermo }
function Write-Errore { param([string]$Testo) Write-Log $Testo -Livello ERRORE -ASchermo }

function Write-EventoCruscotto {
    <# Scrive nel registro eventi "Application" (sorgente creata da installa.ps1) #>
    param(
        [Parameter(Mandatory = $true)][string]$Messaggio,
        [ValidateSet('Information', 'Warning', 'Error')][string]$Tipo = 'Information',
        [int]$Id = 1000
    )
    try {
        if ([System.Diagnostics.EventLog]::SourceExists($script:SorgenteEventi)) {
            Write-EventLog -LogName Application -Source $script:SorgenteEventi -EventId $Id `
                -EntryType $Tipo -Message $Messaggio
        }
    } catch { }
}

function Assert-Amministratore {
    $identita = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principale = New-Object Security.Principal.WindowsPrincipal($identita)
    if (-not $principale.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Questo script va eseguito da una finestra PowerShell aperta "come amministratore".'
    }
}

function Write-Utf8SenzaBom {
    <# Scrive un file di testo UTF-8 senza BOM (il .env di Node non vuole il BOM) #>
    param(
        [Parameter(Mandatory = $true)][string]$Percorso,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Testo
    )
    $codifica = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Percorso, $Testo, $codifica)
}

function Read-FileEnv {
    <# Legge un file .env (CHIAVE=valore) in una hashtable; ignora commenti e righe vuote #>
    param([Parameter(Mandatory = $true)][string]$Percorso)
    if (-not (Test-Path -LiteralPath $Percorso)) {
        throw "File di configurazione non trovato: $Percorso"
    }
    $valori = @{}
    foreach ($riga in [System.IO.File]::ReadAllLines($Percorso)) {
        $r = $riga.Trim()
        if ($r.Length -eq 0 -or $r.StartsWith('#')) { continue }
        $i = $r.IndexOf('=')
        if ($i -lt 1) { continue }
        $chiave = $r.Substring(0, $i).Trim()
        $valore = $r.Substring($i + 1).Trim()
        if ($valore.Length -ge 2 -and (($valore.StartsWith('"') -and $valore.EndsWith('"')) -or
                ($valore.StartsWith("'") -and $valore.EndsWith("'")))) {
            $valore = $valore.Substring(1, $valore.Length - 2)
        }
        $valori[$chiave] = $valore
    }
    return $valori
}

function New-PasswordCasuale {
    <# Password casuale di lettere e cifre (niente simboli: nessun problema di quoting in SQL o .env) #>
    param([int]$Lunghezza = 32)
    $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $byte = New-Object byte[] ($Lunghezza * 2)
    $rng.GetBytes($byte)
    $rng.Dispose()
    $sb = New-Object System.Text.StringBuilder
    foreach ($b in $byte) {
        # scarta i valori che darebbero una distribuzione non uniforme
        if ($b -lt (256 - (256 % $alfabeto.Length))) {
            [void]$sb.Append($alfabeto[$b % $alfabeto.Length])
            if ($sb.Length -ge $Lunghezza) { break }
        }
    }
    if ($sb.Length -lt $Lunghezza) { return New-PasswordCasuale -Lunghezza $Lunghezza }
    return $sb.ToString()
}

function ConvertTo-TestoInChiaro {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Sicura)
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Sicura)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Get-ConfigInstallazione {
    <# Legge installazione.json; errore chiaro se l'installazione non è stata fatta #>
    param([string]$Percorso = $script:FileConfigPredefinito)
    if (-not (Test-Path -LiteralPath $Percorso)) {
        throw "Configurazione non trovata ($Percorso). Eseguire prima installa.ps1."
    }
    $testo = [System.IO.File]::ReadAllText($Percorso)
    return ($testo | ConvertFrom-Json)
}

function Save-ConfigInstallazione {
    param(
        [Parameter(Mandatory = $true)]$Config,
        [string]$Percorso = $script:FileConfigPredefinito
    )
    Write-Utf8SenzaBom -Percorso $Percorso -Testo ($Config | ConvertTo-Json -Depth 4)
}

function Get-FileEnvApp {
    param([Parameter(Mandatory = $true)]$Config)
    return (Join-Path $Config.CartellaConfig '.env')
}

function Invoke-Ace {
    <#
      Esegue "node ace <argomenti>" nella cartella dell'app con NODE_ENV=production e
      ENV_PATH sulla cartella di configurazione. Restituisce il codice di uscita.
    #>
    param(
        [Parameter(Mandatory = $true)]$Config,
        [Parameter(Mandatory = $true)][string[]]$Argomenti,
        [string]$CartellaApp
    )
    if (-not $CartellaApp) { $CartellaApp = $Config.CartellaApp }
    $node = Join-Path $Config.CartellaNode 'node.exe'
    $vecchioEnv = $env:NODE_ENV
    $vecchioPath = $env:ENV_PATH
    $env:NODE_ENV = 'production'
    $env:ENV_PATH = $Config.CartellaConfig
    Push-Location -LiteralPath $CartellaApp
    try {
        # Out-Host: l'output di node va a video e non diventa il valore restituito
        & $node 'ace.js' @Argomenti | Out-Host
        return $LASTEXITCODE
    } finally {
        Pop-Location
        $env:NODE_ENV = $vecchioEnv
        $env:ENV_PATH = $vecchioPath
    }
}

function Get-IdentitaAccount {
    <# Account del servizio nel formato di icacls (SID per gli account predefiniti, nomi non localizzati) #>
    param([Parameter(Mandatory = $true)][string]$Account)
    if ($Account -eq 'NT AUTHORITY\LocalService') { return '*S-1-5-19' }
    if ($Account -eq 'NT AUTHORITY\NetworkService') { return '*S-1-5-20' }
    if ($Account -eq 'NT AUTHORITY\SYSTEM' -or $Account -eq 'LocalSystem') { return '*S-1-5-18' }
    return $Account
}

function Grant-PermessiApp {
    <# Lettura ed esecuzione sull'app, modifica su tmp, per l'account del servizio #>
    param(
        [Parameter(Mandatory = $true)]$Config,
        [string]$Cartella
    )
    if (-not $Cartella) { $Cartella = $Config.CartellaApp }
    $idAccount = Get-IdentitaAccount $Config.AccountServizio
    & icacls.exe $Cartella /grant "${idAccount}:(OI)(CI)RX" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls non riuscito su $Cartella" }
    $tmp = Join-Path $Cartella 'tmp'
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    & icacls.exe $tmp /grant "${idAccount}:(OI)(CI)M" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls non riuscito su $tmp" }
}

function Get-EseguibileServizio {
    param([Parameter(Mandatory = $true)]$Config)
    return (Join-Path $Config.CartellaServizio ($Config.IdServizio + '.exe'))
}

function Wait-StatoServizio {
    param(
        [Parameter(Mandatory = $true)][string]$Nome,
        [Parameter(Mandatory = $true)][ValidateSet('Running', 'Stopped')][string]$Stato,
        [int]$Secondi = 60
    )
    $limite = (Get-Date).AddSeconds($Secondi)
    while ((Get-Date) -lt $limite) {
        $s = Get-Service -Name $Nome -ErrorAction SilentlyContinue
        if ($s -and $s.Status.ToString() -eq $Stato) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Stop-ServizioCruscotto {
    param([Parameter(Mandatory = $true)]$Config)
    $s = Get-Service -Name $Config.IdServizio -ErrorAction SilentlyContinue
    if (-not $s) { return }
    if ($s.Status -ne 'Stopped') {
        Stop-Service -Name $Config.IdServizio -Force
        if (-not (Wait-StatoServizio -Nome $Config.IdServizio -Stato Stopped -Secondi 60)) {
            throw "Il servizio $($Config.IdServizio) non si è fermato entro 60 secondi."
        }
    }
}

function Start-ServizioCruscotto {
    param([Parameter(Mandatory = $true)]$Config)
    Start-Service -Name $Config.IdServizio
    if (-not (Wait-StatoServizio -Nome $Config.IdServizio -Stato Running -Secondi 60)) {
        throw "Il servizio $($Config.IdServizio) non è partito entro 60 secondi."
    }
}

function Get-UrlLocale {
    <# URL per interrogare l'app dal server stesso (https se c'è il PFX) #>
    param([Parameter(Mandatory = $true)]$Config)
    $envApp = Read-FileEnv (Get-FileEnvApp $Config)
    $porta = $envApp['PORT']
    $schema = 'http'
    if ($envApp['HTTPS_PFX_PATH']) { $schema = 'https' }
    return ('{0}://localhost:{1}' -f $schema, $porta)
}

function Test-SaluteApp {
    <#
      GET /accesso sul server stesso finché risponde 200 (o scade il tempo).
      Il certificato non si verifica qui: il nome "localhost" non è nel SAN.
    #>
    param(
        [Parameter(Mandatory = $true)]$Config,
        [int]$Secondi = 90
    )
    $url = (Get-UrlLocale $Config) + '/accesso'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    # Callback compilata in C#: un blocco di script PowerShell come callback TLS
    # può fallire in Windows PowerShell 5.1 ("no Runspace available").
    if (-not ('CruscottoCertificati' -as [type])) {
        Add-Type -TypeDefinition @'
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
public static class CruscottoCertificati {
    public static bool AccettaTutti(object s, X509Certificate c, X509Chain ch, SslPolicyErrors e) { return true; }
    public static RemoteCertificateValidationCallback Callback() { return new RemoteCertificateValidationCallback(AccettaTutti); }
}
'@
    }
    $precedente = [Net.ServicePointManager]::ServerCertificateValidationCallback
    [Net.ServicePointManager]::ServerCertificateValidationCallback = [CruscottoCertificati]::Callback()
    try {
        $limite = (Get-Date).AddSeconds($Secondi)
        while ((Get-Date) -lt $limite) {
            try {
                $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 0
                if ($r.StatusCode -eq 200) { return $true }
            } catch {
                Start-Sleep -Seconds 3
            }
        }
        return $false
    } finally {
        [Net.ServicePointManager]::ServerCertificateValidationCallback = $precedente
    }
}

function Set-VariabiliPg {
    <# Imposta PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE dal .env dell'app (solo per questo processo) #>
    param([Parameter(Mandatory = $true)]$Config)
    $envApp = Read-FileEnv (Get-FileEnvApp $Config)
    $env:PGHOST = $envApp['DB_HOST']
    $env:PGPORT = $envApp['DB_PORT']
    $env:PGUSER = $envApp['DB_USER']
    $env:PGPASSWORD = $envApp['DB_PASSWORD']
    $env:PGDATABASE = $envApp['DB_DATABASE']
    return $envApp['DB_DATABASE']
}

function Clear-VariabiliPg {
    foreach ($n in 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE') {
        Remove-Item -Path "Env:$n" -ErrorAction SilentlyContinue
    }
}

function Restore-DatabaseCruscotto {
    <#
      Ripristina un dump (formato custom) nel database indicato, come utente
      proprietario del database (quello del .env): svuota lo schema "public" e
      ricarica tutto in un'unica transazione. Richiede Set-VariabiliPg.
    #>
    param(
        [Parameter(Mandatory = $true)]$Config,
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(Mandatory = $true)][string]$Database
    )
    $psql = Join-Path $Config.PgBin 'psql.exe'
    $pgRestore = Join-Path $Config.PgBin 'pg_restore.exe'
    & $pgRestore --list $File | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Il file $File non è un backup leggibile da pg_restore." }

    & $psql -d $Database -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Impossibile svuotare lo schema public di $Database." }

    & $pgRestore -d $Database --no-owner --no-privileges --single-transaction --exit-on-error $File | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "pg_restore non riuscito su $Database (codice $LASTEXITCODE)." }
}
