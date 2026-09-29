#Requires -Version 5.1
<#
.SYNOPSIS
  Gestione del servizio Windows del Cruscotto commesse (WinSW).

.DESCRIPTION
  Azioni:
    install     installa il servizio da C:\app\servizio\cruscotto.xml
    uninstall   ferma e rimuove il servizio (i dati restano)
    start       avvia e controlla che l'app risponda
    stop        ferma
    restart     riavvia (dopo una modifica al .env)
    stato       stato del servizio, porta, risposta dell'app, certificato,
                ultimo backup, spazio su disco
    certificato giorni alla scadenza del certificato HTTPS

.EXAMPLE
  C:\app\script\servizio.ps1 -Azione stato
  C:\app\script\servizio.ps1 restart
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'stato', 'certificato')]
    [string]$Azione,
    [string]$FileConfig = 'C:\app\config\installazione.json'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comune.ps1')

$config = Get-ConfigInstallazione $FileConfig
$exe = Get-EseguibileServizio $config
$id = $config.IdServizio

switch ($Azione) {
    'install' {
        Assert-Amministratore
        if (-not (Test-Path -LiteralPath $exe)) { throw "WinSW non trovato: $exe (vedi installa.ps1)." }
        & $exe install | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Installazione del servizio non riuscita ($LASTEXITCODE)." }
        $wmi = Get-CimInstance -ClassName Win32_Service -Filter "Name='$id'"
        if ($config.AccountServizio -like 'NT AUTHORITY\*') {
            [void](Invoke-CimMethod -InputObject $wmi -MethodName Change -Arguments @{
                    StartName = $config.AccountServizio; StartPassword = ''
                })
        } else {
            $cred = Get-Credential -UserName $config.AccountServizio -Message 'Password dell''account del servizio'
            [void](Invoke-CimMethod -InputObject $wmi -MethodName Change -Arguments @{
                    StartName = $config.AccountServizio; StartPassword = $cred.GetNetworkCredential().Password
                })
        }
        Write-Ok "Servizio $id installato (account $($config.AccountServizio))"
    }
    'uninstall' {
        Assert-Amministratore
        Stop-ServizioCruscotto -Config $config
        & $exe uninstall | Out-Host
        Write-Ok "Servizio $id rimosso. App, configurazione e backup restano in $($config.CartellaBase)."
    }
    'start' {
        Assert-Amministratore
        Start-ServizioCruscotto -Config $config
        if (Test-SaluteApp -Config $config -Secondi 90) { Write-Ok "Servizio avviato: l'app risponde." }
        else { Write-Errore "Servizio avviato ma l'app non risponde: log in $($config.CartellaServizio)\log"; exit 1 }
    }
    'stop' {
        Assert-Amministratore
        Stop-ServizioCruscotto -Config $config
        Write-Ok 'Servizio fermato'
    }
    'restart' {
        Assert-Amministratore
        Stop-ServizioCruscotto -Config $config
        Start-ServizioCruscotto -Config $config
        if (Test-SaluteApp -Config $config -Secondi 90) { Write-Ok "Servizio riavviato: l'app risponde." }
        else { Write-Errore "Servizio riavviato ma l'app non risponde: log in $($config.CartellaServizio)\log"; exit 1 }
    }
    'certificato' {
        $codice = Invoke-Ace -Config $config -Argomenti @('certificato:scadenza')
        if ($codice -eq 1) {
            Write-EventoCruscotto -Messaggio 'Il certificato HTTPS del Cruscotto commesse scade entro 30 giorni (o è scaduto): chiedere il rinnovo all''IT.' -Tipo Warning -Id 5001
        } elseif ($codice -ne 0) {
            Write-EventoCruscotto -Messaggio 'Il certificato HTTPS del Cruscotto commesse non si legge (PFX o password).' -Tipo Error -Id 5002
        }
        exit $codice
    }
    'stato' {
        $s = Get-Service -Name $id -ErrorAction SilentlyContinue
        if (-not $s) { Write-Errore "Servizio $id non installato"; exit 1 }
        $wmi = Get-CimInstance -ClassName Win32_Service -Filter "Name='$id'"
        Write-Info ("Servizio:       {0} ({1}, avvio {2}, account {3})" -f $s.Status, $id, $wmi.StartMode, $wmi.StartName)
        $envApp = Read-FileEnv (Get-FileEnvApp $config)
        $porta = [int]$envApp['PORT']
        $ascolto = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
        if ($ascolto) { Write-Ok "Porta ${porta}:     in ascolto" } else { Write-Avviso "Porta ${porta}:     NON in ascolto" }
        if ($s.Status -eq 'Running') {
            if (Test-SaluteApp -Config $config -Secondi 10) { Write-Ok "Risposta app:   OK ($(Get-UrlLocale $config)/accesso)" }
            else { Write-Errore 'Risposta app:   nessuna risposta' }
        }
        $fileVersione = Join-Path $config.CartellaApp 'versione.json'
        if (Test-Path -LiteralPath $fileVersione) {
            $v = [IO.File]::ReadAllText($fileVersione) | ConvertFrom-Json
            Write-Info ("Versione:       {0} (commit {1}, pacchetto del {2})" -f $v.versione, $v.commit, $v.creatoIl)
        }
        $ultimo = Get-ChildItem -LiteralPath $config.CartellaBackup -Filter 'cruscotto_*.dump' -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($ultimo) {
            $ore = [math]::Round(((Get-Date) - $ultimo.LastWriteTime).TotalHours, 1)
            $testo = "Ultimo backup:  $($ultimo.Name) ($ore ore fa)"
            if ($ore -gt 26) { Write-Avviso $testo } else { Write-Ok $testo }
        } else {
            Write-Avviso "Ultimo backup:  nessun backup in $($config.CartellaBackup)"
        }
        $lettera = (Split-Path -Qualifier $config.CartellaBase).TrimEnd(':')
        $disco = Get-PSDrive -Name $lettera -ErrorAction SilentlyContinue
        if ($disco) {
            $gb = [math]::Round($disco.Free / 1GB, 1)
            $testo = "Spazio libero:  $gb GB su ${lettera}:"
            if ($gb -lt 5) { Write-Avviso $testo } else { Write-Ok $testo }
        }
        Write-Host ''
        [void](Invoke-Ace -Config $config -Argomenti @('certificato:scadenza'))
    }
}
