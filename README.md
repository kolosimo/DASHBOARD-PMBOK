# DASHBOARD-PMBOK

Cruscotto multi-utente per le commesse Climosfera, secondo PMBOK (8ª ed.) e Lean (Last Planner System, Kanban). Si usa da PC Windows e Mac; i dati stanno su un unico server aziendale.

**Stato:** **Fase 2 completata, pronta per il pilota** con 2 PM sul server aziendale (Windows Server 2019). L'app AdonisJS 7 + PostgreSQL copre Last Planner, Kanban degli elaborati, ore, EVM in ore, Obeya, portafoglio, scheda elaborato, registro attività e accesso con account locali (Microsoft 365 attivabile dopo il pilota). `npm run verifica` è verde (unit 130, funzionali 384) e gli e2e comprendono lo scenario del pilota.

- Pilota: [piano del pilota](docs/pilota/piano-del-pilota.md) · [provare prima dell'installazione](docs/pilota/prova-con-prototipo.md) · [guida rapida per i PM](docs/pilota/guida-rapida-pm.md) · guide per [PM](docs/utente/guida-pm.md), [progettista](docs/utente/guida-progettista.md), [direzione](docs/utente/guida-direzione.md), [amministratore](docs/utente/guida-admin.md)
- Installazione (IT): [guida per Windows Server 2019](docs/installazione/guida-it-windows-server-2019.md) · [aggiornamento](docs/installazione/aggiornamento.md) · [backup e ripristino](docs/installazione/backup-e-ripristino.md)
- Per sviluppare: [CLAUDE.md](CLAUDE.md) e [ambiente](docs/sviluppo/ambiente.md). [Versione di prova](prototipo/index.html) (prototipo v4 per i PM: commesse nuove, baseline, Last Planner, segnalazioni; link: https://claude.ai/artifact/Hau6bbX46GViVFRhGNUykN).
- [Sintesi e decisioni (rev. 3)](docs/00-sintesi-e-decisioni.md) · [Piano di costruzione multi-agente](docs/sviluppo/piano.md)
- Ricerca: [PMBOK](docs/ricerca/01-pmbok.md) · [Lean](docs/ricerca/02-lean-progettazione.md) · [Tool open source (superato)](docs/ricerca/03-tool-open-source.md) · [Architettura rev. 1](docs/ricerca/04-architettura.md) · [KPI MEP/BIM](docs/ricerca/05-kpi-settore-mep-bim.md) · [GoodDay (archiviato)](docs/ricerca/06-goodday-ore.md) · [Verifica affermazioni](docs/ricerca/07-verifica-affermazioni.md) · [App Windows/Mac](docs/ricerca/08-app-installabile-win-mac.md)
