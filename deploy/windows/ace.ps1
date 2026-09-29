#Requires -Version 5.1
<#
.SYNOPSIS
  Esegue un comando "node ace" dell'app installata, con la configurazione di produzione.

.DESCRIPTION
  Imposta NODE_ENV=production e ENV_PATH=C:\app\config, poi lancia
  C:\app\node\node.exe ace.js <argomenti> nella cartella dell'app.
  Gli argomenti passano così come sono (niente blocco param: "--email" non
  viene interpretato da PowerShell).

.EXAMPLE
  C:\app\script\ace.ps1 utenti:crea-admin --email mario.rossi@climosfera.it --nome "Mario Rossi"
  C:\app\script\ace.ps1 utenti:crea-admin --email mario.rossi@climosfera.it --reimposta
  C:\app\script\ace.ps1 certificato:scadenza
  C:\app\script\ace.ps1 migration:status
#>

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

if ($args.Count -eq 0) {
    Write-Host 'Uso: ace.ps1 <comando> [opzioni]   (es. ace.ps1 certificato:scadenza)'
    exit 1
}
$config = Get-ConfigInstallazione
$argomenti = @()
foreach ($a in $args) { $argomenti += [string]$a }
$codice = Invoke-Ace -Config $config -Argomenti $argomenti
exit $codice
