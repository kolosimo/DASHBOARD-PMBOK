#Requires -Version 5.1
<#
.SYNOPSIS
  Aggiorna il Cruscotto commesse a una nuova versione (pacchetto zip).

.DESCRIPTION
  Passi, con ritorno automatico alla versione precedente se qualcosa va storto:
    1. estrae il pacchetto in C:\app\versioni\<data-ora> e lo controlla;
    2. backup del database (backup.ps1, etichetta "prima-aggiornamento");
    3. ferma il servizio;
    4. sposta l'app attuale in C:\app\cruscotto.precedente e mette al suo
       posto la nuova;
    5. migrazioni + configurazione mancante (db:inizializza-produzione);
    6. avvia il servizio e controlla che l'app risponda.
  Se il passo 5 o 6 fallisce: ferma il servizio, ricarica il backup del
  passo 2 (solo se le migrazioni sono partite), rimette la versione
  precedente e la riavvia.

  Alla fine aggiorna anche gli script in C:\app\script con quelli del
  pacchetto. Il .env e il certificato (C:\app\config) non vengono toccati.

.EXAMPLE
  C:\app\script\aggiorna.ps1 -Pacchetto D:\scaricati\cruscotto-commesse-0.2.0-20261020-ab12cd3.zip
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Pacchetto,
    [string]$FileConfig = 'C:\app\config\installazione.json'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

Assert-Amministratore
$config = Get-ConfigInstallazione $FileConfig
$script:FileLog = Join-Path $config.CartellaConfig ('aggiornamento-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$precedente = $config.CartellaApp + '.precedente'
# La cartella corrente non deve stare dentro l'app, che verrà rinominata
Set-Location -LiteralPath $config.CartellaBase

function Get-VersioneApp {
    param([string]$Cartella)
    $f = Join-Path $Cartella 'versione.json'
    if (-not (Test-Path -LiteralPath $f)) { return 'sconosciuta' }
    $v = [IO.File]::ReadAllText($f) | ConvertFrom-Json
    return ('{0} (commit {1}, {2})' -f $v.versione, $v.commit, $v.creatoIl)
}

# ---------------------------------------------------------------------------
Write-Passo '1. Pacchetto'
# ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $Pacchetto)) { throw "Pacchetto non trovato: $Pacchetto" }
$fileHash = "$Pacchetto.sha256"
if (Test-Path -LiteralPath $fileHash) {
    $atteso = ([IO.File]::ReadAllText($fileHash).Trim() -split '\s+')[0].ToLower()
    $calcolato = (Get-FileHash -LiteralPath $Pacchetto -Algorithm SHA256).Hash.ToLower()
    if ($atteso -ne $calcolato) { throw 'SHA-256 del pacchetto diverso da quello del file .sha256: copia corrotta?' }
    Write-Ok 'SHA-256 del pacchetto verificato'
}
New-Item -ItemType Directory -Force -Path $config.CartellaVersioni | Out-Null
$estratto = Join-Path $config.CartellaVersioni (Get-Date -Format 'yyyyMMdd-HHmmss')
Write-Info "Estrazione in $estratto ..."
Expand-Archive -LiteralPath $Pacchetto -DestinationPath $estratto
$ace = Get-ChildItem -LiteralPath $estratto -Recurse -Filter 'ace.js' -Depth 1 | Select-Object -First 1
if (-not $ace) { throw 'Il pacchetto non contiene ace.js: non è un pacchetto del Cruscotto.' }
$nuova = $ace.DirectoryName
foreach ($necessario in 'bin\server.js', 'node_modules\@adonisjs\core\package.json', 'deploy\windows\comune.ps1') {
    if (-not (Test-Path -LiteralPath (Join-Path $nuova $necessario))) { throw "Pacchetto incompleto: manca $necessario" }
}
Write-Info ("Versione installata: {0}" -f (Get-VersioneApp $config.CartellaApp))
Write-Info ("Nuova versione:      {0}" -f (Get-VersioneApp $nuova))

# ---------------------------------------------------------------------------
Write-Passo '2. Backup del database'
# ---------------------------------------------------------------------------
$backup = & (Join-Path $PSScriptRoot 'backup.ps1') -Etichetta 'prima-aggiornamento' -FileConfig $FileConfig
$codiceBackup = $LASTEXITCODE
if ($codiceBackup -eq 1) { throw 'Backup non riuscito: aggiornamento annullato (nulla è stato modificato).' }
$backup = @($backup)[-1]
if ($codiceBackup -eq 2) { Write-Avviso 'Copia di rete del backup non riuscita: si prosegue con il backup locale.' }
Write-Ok "Backup: $backup"

# ---------------------------------------------------------------------------
Write-Passo '3-6. Sostituzione, migrazioni, avvio'
# ---------------------------------------------------------------------------
$spostata = $false
$sostituita = $false
$migrazioniAvviate = $false
try {
    Stop-ServizioCruscotto -Config $config
    Write-Ok 'Servizio fermato'

    if (Test-Path -LiteralPath $precedente) { Remove-Item -LiteralPath $precedente -Recurse -Force }
    Rename-Item -LiteralPath $config.CartellaApp -NewName (Split-Path -Leaf $precedente)
    $spostata = $true
    Move-Item -LiteralPath $nuova -Destination $config.CartellaApp
    $sostituita = $true
    Grant-PermessiApp -Config $config
    Write-Ok "Nuova versione in $($config.CartellaApp) (precedente in $precedente)"

    $migrazioniAvviate = $true
    $codice = Invoke-Ace -Config $config -Argomenti @('db:inizializza-produzione')
    if ($codice -ne 0) { throw 'migrazioni non riuscite.' }
    Write-Ok 'Database aggiornato'

    Start-ServizioCruscotto -Config $config
    if (-not (Test-SaluteApp -Config $config -Secondi 90)) { throw 'la nuova versione non risponde entro 90 secondi.' }
    Write-Ok "La nuova versione risponde"
} catch {
    $motivo = $_.Exception.Message
    Write-Errore "Aggiornamento NON riuscito: $motivo"
    Write-Passo 'Ritorno alla versione precedente'
    try {
        Stop-ServizioCruscotto -Config $config
        if ($migrazioniAvviate) {
            Write-Info "Ricarico il database da $backup ..."
            [void](Set-VariabiliPg -Config $config)
            try {
                Restore-DatabaseCruscotto -Config $config -File $backup -Database $env:PGDATABASE
            } finally {
                Clear-VariabiliPg
            }
            Write-Ok 'Database riportato allo stato prima dell''aggiornamento'
        }
        if ($spostata) {
            if ($sostituita -and (Test-Path -LiteralPath $config.CartellaApp)) {
                $fallita = $config.CartellaApp + '.fallita-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
                Rename-Item -LiteralPath $config.CartellaApp -NewName (Split-Path -Leaf $fallita)
                Write-Info "La nuova versione è stata spostata in $fallita"
            }
            Rename-Item -LiteralPath $precedente -NewName (Split-Path -Leaf $config.CartellaApp)
            Write-Ok 'Versione precedente rimessa al suo posto'
        }
        Start-ServizioCruscotto -Config $config
        if (Test-SaluteApp -Config $config -Secondi 90) {
            Write-Ok 'La versione precedente è di nuovo attiva e risponde.'
        } else {
            Write-Errore "La versione precedente non risponde: log in $($config.CartellaServizio)\log"
        }
    } catch {
        Write-Errore "Ritorno alla versione precedente NON riuscito: $($_.Exception.Message)"
        Write-Errore "Backup del database: $backup. Versione precedente: $precedente."
    }
    Write-EventoCruscotto -Messaggio "Aggiornamento non riuscito ($motivo): ripristinata la versione precedente." -Tipo Error -Id 4001
    Write-Info "Log dell'aggiornamento: $script:FileLog"
    exit 1
}

# Script di gestione aggiornati con quelli del pacchetto (dopo il successo)
& robocopy.exe (Join-Path $config.CartellaApp 'deploy\windows') $config.CartellaScript /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Avviso "Script in $($config.CartellaScript) non aggiornati (robocopy $LASTEXITCODE)." }

$vecchieEstrazioni = Get-ChildItem -LiteralPath $config.CartellaVersioni -Directory | Sort-Object Name -Descending | Select-Object -Skip 3
foreach ($d in $vecchieEstrazioni) { Remove-Item -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host ''
Write-Ok ("=== Aggiornamento completato: {0} ===" -f (Get-VersioneApp $config.CartellaApp))
Write-Info "Per tornare indietro a mano: versione precedente in $precedente, backup del database $backup"
Write-EventoCruscotto -Messaggio ("Cruscotto commesse aggiornato a {0}" -f (Get-VersioneApp $config.CartellaApp)) -Id 4000
