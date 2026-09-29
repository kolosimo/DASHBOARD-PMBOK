#Requires -Version 5.1
<#
.SYNOPSIS
  Backup del database del Cruscotto commesse (pg_dump, formato custom).

.DESCRIPTION
  Crea <CartellaBackup>\cruscotto_<db>_<aaaammgg>_<hhmmss>[_<etichetta>].dump,
  lo verifica con pg_restore --list, lo copia sulla cartella di rete (se
  configurata) ed elimina i backup più vecchi di N giorni, tenendo comunque
  gli ultimi 7. Il servizio può restare acceso: pg_dump legge una fotografia
  coerente del database.

  Lo esegue ogni giorno l'attività pianificata "Cruscotto commesse - backup"
  creata da installa.ps1 (come SYSTEM); aggiorna.ps1 lo lancia prima di ogni
  aggiornamento. Scrive il log in <CartellaBackup>\backup.log e, se fallisce,
  un errore nel registro eventi Application (sorgente "Cruscotto commesse").

  Restituisce (Write-Output) il percorso del file creato. Codice di uscita:
  0 tutto bene, 1 backup non riuscito, 2 backup locale riuscito ma copia di
  rete non riuscita.

.EXAMPLE
  C:\app\script\backup.ps1
  C:\app\script\backup.ps1 -Etichetta prima-di-prova -CartellaRete \\nas01\backup\cruscotto
#>
[CmdletBinding()]
param(
    [string]$CartellaBackup,
    # Vuoto = quella di installazione.json; '-' = nessuna copia di rete
    [string]$CartellaRete,
    [int]$Giorni = 0,
    [string]$Etichetta = '',
    [string]$FileConfig = 'C:\app\config\installazione.json'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

$config = Get-ConfigInstallazione $FileConfig
if (-not $CartellaBackup) { $CartellaBackup = $config.CartellaBackup }
if (-not $CartellaRete) { $CartellaRete = $config.CartellaRete }
if ($CartellaRete -eq '-') { $CartellaRete = '' }
if ($Giorni -le 0) { $Giorni = [int]$config.GiorniBackup }
if ($Giorni -le 0) { $Giorni = 30 }
$MinimoDaTenere = 7

New-Item -ItemType Directory -Force -Path $CartellaBackup | Out-Null
$script:FileLog = Join-Path $CartellaBackup 'backup.log'

function Remove-BackupVecchi {
    param([string]$Cartella, [int]$GiorniDaTenere, [int]$Minimo)
    $tutti = @(Get-ChildItem -LiteralPath $Cartella -Filter 'cruscotto_*.dump' -File |
            Sort-Object LastWriteTime -Descending)
    $limite = (Get-Date).AddDays(-$GiorniDaTenere)
    $eliminati = 0
    for ($i = $Minimo; $i -lt $tutti.Count; $i++) {
        if ($tutti[$i].LastWriteTime -lt $limite) {
            Remove-Item -LiteralPath $tutti[$i].FullName -Force
            $eliminati++
        }
    }
    return $eliminati
}

$esitoFinale = 0
$file = $null
try {
    Write-Log "Backup avviato (utente $env:USERNAME)"
    $db = Set-VariabiliPg -Config $config
    $pgDump = Join-Path $config.PgBin 'pg_dump.exe'
    $pgRestore = Join-Path $config.PgBin 'pg_restore.exe'

    $suffisso = ''
    if ($Etichetta) { $suffisso = '_' + ($Etichetta -replace '[^A-Za-z0-9-]', '-') }
    $nome = 'cruscotto_{0}_{1}{2}.dump' -f $db, (Get-Date -Format 'yyyyMMdd_HHmmss'), $suffisso
    $file = Join-Path $CartellaBackup $nome

    & $pgDump --format=custom --compress=6 --no-password --file=$file $db | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "pg_dump non riuscito (codice $LASTEXITCODE)." }

    # Verifica: il file deve essere leggibile da pg_restore e contenere le tabelle
    $elenco = & $pgRestore --list $file
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore --list non riesce a leggere il backup appena creato.' }
    $tabelle = @($elenco | Where-Object { $_ -match ' TABLE DATA ' }).Count
    if ($tabelle -lt 1) { throw 'Il backup non contiene dati di tabelle.' }
    $mb = [math]::Round((Get-Item -LiteralPath $file).Length / 1MB, 2)
    Write-Ok "Backup creato: $file ($mb MB, $tabelle tabelle)"

    $eliminati = Remove-BackupVecchi -Cartella $CartellaBackup -GiorniDaTenere $Giorni -Minimo $MinimoDaTenere
    if ($eliminati -gt 0) { Write-Info "Eliminati $eliminati backup locali più vecchi di $Giorni giorni" }
} catch {
    Write-Errore "Backup NON riuscito: $($_.Exception.Message)"
    Write-EventoCruscotto -Messaggio "Backup del Cruscotto commesse NON riuscito: $($_.Exception.Message)" -Tipo Error -Id 2001
    if ($file -and (Test-Path -LiteralPath $file)) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
    Clear-VariabiliPg
    exit 1
} finally {
    Clear-VariabiliPg
}

if ($CartellaRete) {
    try {
        if (-not (Test-Path -LiteralPath $CartellaRete)) {
            New-Item -ItemType Directory -Force -Path $CartellaRete | Out-Null
        }
        Copy-Item -LiteralPath $file -Destination $CartellaRete -Force
        $copia = Join-Path $CartellaRete (Split-Path -Leaf $file)
        if ((Get-Item -LiteralPath $copia).Length -ne (Get-Item -LiteralPath $file).Length) {
            throw 'la copia ha una dimensione diversa dall''originale'
        }
        Write-Ok "Copiato su $copia"
        $eliminati = Remove-BackupVecchi -Cartella $CartellaRete -GiorniDaTenere $Giorni -Minimo $MinimoDaTenere
        if ($eliminati -gt 0) { Write-Info "Eliminati $eliminati backup di rete più vecchi di $Giorni giorni" }
    } catch {
        Write-Errore "Copia su $CartellaRete NON riuscita: $($_.Exception.Message)"
        Write-EventoCruscotto -Messaggio "Backup creato in locale ma copia su $CartellaRete non riuscita: $($_.Exception.Message)" -Tipo Warning -Id 2002
        $esitoFinale = 2
    }
}

if ($esitoFinale -eq 0) {
    Write-EventoCruscotto -Messaggio "Backup del Cruscotto commesse riuscito: $file" -Id 2000
}
Write-Output $file
exit $esitoFinale
