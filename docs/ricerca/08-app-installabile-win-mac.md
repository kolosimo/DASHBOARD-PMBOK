# 08 — App installabile su Windows e Mac, multi-utente

> Ricerca web del 24/09/2026. Alcuni siti (sqlite.org, learn.microsoft.com, v2.tauri.app) erano bloccati dal proxy: per questi le informazioni vengono dagli estratti dei motori di ricerca. **NV** = non verificato.

## Il principio

Perché più persone lavorino sulla stessa commessa in contemporanea, i dati devono stare **in un solo posto centrale**: un database sul server aziendale. Ogni PC, Windows o Mac, è solo una "finestra" su quei dati.

Tenere un file condiviso su una cartella di rete (SQLite o Access su SMB) è **da scartare**. SQLite stesso avverte che i blocchi dei file sono "buggy" sui filesystem di rete e che le scritture simultanee possono corrompere il database ([sqlite.org/useovernet](https://www.sqlite.org/useovernet.html)). Con la VPN il rischio aumenta.

## Tre modi di "installare" l'app sui PC

| | A. PWA (web app installabile) | B. Client desktop Tauri/Electron | C. File su cartella condivisa |
|---|---|---|---|
| Come si installa | da Edge/Chrome ("Installa app") su Windows e Mac; su Safari "Aggiungi al Dock" da macOS Sonoma 14 ([Apple](https://support.apple.com/en-us/104996)) | installer .exe / .dmg | copia di un file |
| Icona e finestra propria | sì | sì | sì |
| Aggiornamenti | automatici: si aggiorna il server | updater da firmare e gestire | manuali |
| Costi di firma | nessuno | Apple Developer 99 USD/anno ([Apple](https://developer.apple.com/programs/enroll/)); Windows: certificato o Microsoft Artifact Signing, 9,99 USD/mese ([Azure](https://azure.microsoft.com/en-us/products/artifact-signing)) | nessuno |
| Uso simultaneo sicuro | sì (database sul server) | sì (database sul server) | **no** |
| Accesso a file locali, Revit, Excel | limitato | completo | — |
| Requisito | HTTPS con certificato valido per il nome interno e manifest (il service worker non è più obbligatorio da Chrome 112) | — | — |

Fonti PWA: [web.dev](https://web.dev/learn/pwa/installation), [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Server: nativo su Windows, senza Docker

- **PostgreSQL per Windows**: installer ufficiale; testato su Windows Server 2022; il 2025 non risultava certificato EDB (verifica 07): preferire il 2022 ([postgresql.org](https://www.postgresql.org/download/windows/)).
- **Applicazione Node.js** come servizio Windows, tramite **WinSW** o Servy. NSSM (ultimo rilascio 2017) e node-windows (beta) risultano abbandonati (verifica 07).
- **Docker su Windows Server** non è la strada: Docker Desktop non è supportato e LCOW è deprecato ([Docker](https://docs.docker.com/desktop/setup/install/windows-install/)). Servirebbe una VM Linux in più da gestire.

## Tempo reale

Bastano i **Server-Sent Events**: il server avvisa i client che un dato è cambiato ([MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)). In alternativa basta un polling ogni 5–10 secondi. I WebSocket non servono.

## Login Microsoft 365

Scelta rev. 2: **OIDC lato server** (authorization code + PKCE verso Entra ID, sessione in cookie httpOnly), non MSAL.js nel browser: su Safari il rinnovo silenzioso via iframe fallisce spesso per ITP. Il login dentro la web app del Dock va comunque provato (NV); in alternativa sul Mac si usa Edge o Chrome.

## Raccomandazione

**PWA + AdonisJS (Node.js, TypeScript) + PostgreSQL, tutti come servizi nativi sul Windows Server aziendale.**

- Un solo linguaggio (TypeScript) sia per le schermate sia per il server.
- Nessun installer da firmare e nessun costo annuo; gli aggiornamenti si fanno una volta sul server.

## Rischi

1. Certificato HTTPS per il nome interno: va pianificato con l'IT.
2. Backup automatico di PostgreSQL, con prova di ripristino.
3. Un'unica persona che mantiene il sistema: servono repository Git, documentazione e un ambiente di prova.
4. Login su Safari da provare.
5. Senza VPN non si lavora.

## Aggiornamento 28/09/2026: server reale Windows Server 2019 Standard 1809

| Componente | Scelta | Motivo e fonte |
|---|---|---|
| Node.js 24 LTS | distribuzione **zip** | Node 24 supporta Windows Server 2016+ in Tier 1 ([BUILDING.md](https://github.com/nodejs/node/blob/v24.x/BUILDING.md)); l'MSI v24.17 ha un problema aperto su WS2019 ([nodejs/node#64078](https://github.com/nodejs/node/issues/64078)) |
| PostgreSQL | **17** | L'installer EDB di PG 17 è testato su Server 2019 e 2022, quello di PG 18 su 2022 e 2025 ([postgresql.org](https://www.postgresql.org/download/windows/), estratto) |
| Servizio | **WinSW v2.12.0 NET461** | Versione stabile; la v3 è pre-release ([WinSW](https://github.com/winsw/winsw)) |
| HTTPS | diretto da Node, senza IIS | Node usa OpenSSL (TLS 1.3, HTTP/2); Schannel di WS2019 non ha TLS 1.3 |
| Certificato | PFX **AES256-SHA256** | Le PFX con cifratura legacy possono non essere lette da OpenSSL 3 (NV) |

Ciclo di vita: supporto mainstream finito il 09/01/2024, esteso fino al 09/01/2029 ([Microsoft](https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2019), estratto). Serve una migrazione a Server 2022/2025 prima di quella data.
