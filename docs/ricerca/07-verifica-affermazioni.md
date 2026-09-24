# 07 — Verifica delle affermazioni chiave (24/09/2026)

Undici affermazioni dei rapporti 01–08 ricontrollate da un secondo agente, indipendente dal primo. Esito: **9 confermate, 2 parziali, nessuna smentita**.

| # | Affermazione | Esito | Correzione |
|---|---|---|---|
| 1 | PMBOK 8: 6 principi, 7 domini, 5 focus areas, 40 processi, uscita 13/11/2025 | Confermata, data parziale | Data e "40 processi" solo da fonti secondarie concordi |
| 2 | Agile Practice Guide 2ª ed. uscita nel 2026 | Confermata | Data esatta discordante (27/07 o 02/09/2026) |
| 3 | ANSI/PMI 19-006-2019 = standard EVM | Confermata | — |
| 4 | PPC, TMR/TA, PCR (Jang & Kim, IGLC 2007) | Confermata | Il PPC nasce dal lavoro di Ballard. TMR e TA sono due metriche distinte, non un rapporto tra loro |
| 5 | Kanban Guide 2025: WIP, Throughput, Work Item Age, Cycle Time | Confermata | — |
| 6 | Obbligo BIM art. 43 D.Lgs. 36/2023 ≥ 2 mln € | **Parziale** | È "superiore a" 2 mln €, calcolato sul costo presunto dei lavori. Esclusa la manutenzione; regime transitorio per DOCFAP approvati entro il 31/12/2024. Corretto nel rapporto 05 |
| 7 | Docker Desktop non supportato su Windows Server; LCOW deprecato | Confermata | "Deprecato" è più preciso di "non supportato" |
| 8 | NocoDB non più open source dal 2026 | Confermata | Resta consentito l'uso interno self-hosted |
| 9 | OpenProject: SSO OIDC/SAML solo Enterprise | Confermata | — |
| 10 | Art. 4 Statuto dei lavoratori | Confermata | Il comma 3 richiede anche informativa e rispetto del GDPR. Presenze e accessi rientrano nell'eccezione del comma 2 |
| 11 | SQLite sconsigliato su cartella di rete condivisa | Confermata | Per più client serve un database client/server |

Fonti principali: pmi.org, webstore.ansi.org, iglc.net, kanbanguides.org, codiceappalti.it, docs.docker.com, learn.microsoft.com, nocodb.com, openproject.org, brocardi.it, sqlite.org.
Alcuni siti erano bloccati dal proxy di rete; per quelli la verifica si basa sui testi mostrati dal motore di ricerca.

## Seconda verifica (architettura, rapporto 08)

| Affermazione | Esito | Correzione |
|---|---|---|
| "Aggiungi al Dock" di Safari da macOS 14, cookie separati | Confermata | — |
| PWA installabile da Edge/Chrome su Windows e Mac | Parziale | Il service worker non è più obbligatorio da Chrome 112: bastano manifest e HTTPS |
| HTTPS obbligatorio anche su rete interna | Confermata | Sui Mac la CA aziendale va installata a mano o via MDM |
| PostgreSQL su Windows Server 2022/2025 | Parziale | Il 2022 è testato; il 2025 non risultava certificato EDB |
| Node come servizio con NSSM/node-windows | Parziale | NSSM (2017) e node-windows (beta) sono abbandonati: usare **WinSW** o Servy |
| MSAL.js con PKCE per SPA | Confermata | Su Safari il rinnovo silenzioso via iframe fallisce spesso (ITP): meglio **OIDC lato server** con cookie di sessione |
| SSE: 6 connessioni per dominio in HTTP/1.1 | Confermata | Una connessione per scheda o HTTP/2 |
| Apple Developer 99 USD/anno | Confermata | Non serve con una PWA |
| Framework TypeScript con ORM e login ufficiali | — | AdonisJS è l'unico tra quelli considerati |
