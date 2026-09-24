# 04 — Architettura di un'app su misura on-premise

> **Superato in parte (rev. 2):** la raccomandazione Django + Docker su VM Linux è sostituita da PWA + Node.js + PostgreSQL nativi su Windows Server, vedi `08`. Le sezioni su tempo reale, backup e GDPR restano valide.

> Ricerca web del 24/09/2026. **[NV]** = non verificato su fonte primaria.

## A) Piattaforme low-code self-hosted

| Piattaforma | Licenza | Permessi e SSO nella versione gratuita |
|---|---|---|
| NocoDB | da gennaio 2026 Sustainable Use License, non più open source ([licenza](https://nocodb.com/docs/self-hosting/license)) | permessi su campi e righe e SSO solo nei piani a pagamento |
| Baserow | free self-hosted | nel Free tutti gli utenti hanno ruolo "Member"; ruoli solo Advanced/Enterprise ([permessi](https://baserow.io/user-docs/permissions-overview)) |
| Appsmith CE | open source | controllo accessi granulare e SSO a pagamento ([GAC](https://docs.appsmith.com/advanced-concepts/granular-access-control)) |
| Budibase | free fino a 20 utenti ([annuncio](https://budibase.com/blog/updates/pricing-v3/)) | SSO a pagamento [NV] |
| Directus | BSL 1.1, gratuito sotto i 5 milioni di dollari di fatturato ([prezzi](https://directus.io/pricing/self-hosted)) | RBAC, OIDC e LDAP inclusi [NV] |
| ToolJet CE | AGPL | SSO e permessi granulari a pagamento ([pricing](https://tooljet.com/pricing)) |

**Sintesi:** nelle versioni gratuite quasi tutte escludono proprio SSO e permessi per commessa, e le licenze cambiano (NocoDB, 2026).

## B) Stack classici

- **Django + HTMX + PostgreSQL**
  - Include di serie login, permessi, ORM, migrazioni e admin.
  - Un solo linguaggio (Python).
  - Aggiornamenti dal server con l'estensione SSE di HTMX ([htmx SSE](https://htmx.org/extensions/sse/)).
- **FastAPI + React**: due codebase e autenticazione da costruire a mano.
- **Next.js**: ecosistema che cambia rapidamente [NV].
- **Supabase self-hosted**: molti container, backup e aggiornamenti tutti a carico di chi lo installa ([analisi](https://queryglow.com/blog/supabase-self-hosted)).
- **PocketBase**: gli autori lo sconsigliano per applicazioni critiche prima della v1.0 ([GitHub](https://github.com/pocketbase/pocketbase)).

## C) Tempo reale

- Non serve un editing stile Google Docs. Servono due cose:
  1. **Optimistic locking**: un campo versione impedisce le sovrascritture silenziose. Libreria [django-concurrency](https://django-concurrency.readthedocs.io/).
  2. **Aggiornamenti live via SSE** alimentati da PostgreSQL LISTEN/NOTIFY ([esempio](https://valberg.dk/django-sse-postgresql-listen-notify.html)), oppure un polling ogni 10–30 secondi.
- WebSocket (Django Channels) solo in una fase successiva, se diventa necessario.

## D) Deploy

- **VM Linux** (Ubuntu LTS) con Docker Compose.
  - Su Windows Server Docker Desktop non è supportato e i container Linux (LCOW) sono deprecati ([Microsoft](https://learn.microsoft.com/en-us/troubleshoot/windows-server/containers/support-for-windows-containers-docker-on-premises-scenarios)).
  - Soluzione pratica: una VM Linux su Hyper-V [NV: consiglio operativo].
- **HTTPS interno** con Caddy: CA locale oppure certificato della CA aziendale ([Caddy tls](https://caddyserver.com/docs/caddyfile/directives/tls)).
- **Backup**: `pg_dump` notturno cifrato, copiato fuori dal server, con **prova di ripristino periodica** ([PostgreSQL backup](https://www.postgresql.org/docs/current/backup.html)).
- **Login**
  - Microsoft Entra ID via OIDC con [django-allauth](https://docs.allauth.org/en/latest/socialaccount/providers/microsoft.html): consigliato con M365, perché aggiunge MFA e gestisce in modo centralizzato l'uscita dei dipendenti.
  - In alternativa AD via LDAPS con [django-auth-ldap](https://github.com/django-auth-ldap/django-auth-ldap).
- **Accesso remoto**: VPN aziendale; non esporre l'app su Internet.

## E) Integrazioni, in ordine di valore e costo

1. **Import/export Excel** (openpyxl).
2. **Email** di notifica tramite SMTP di M365.
3. **Calendario**: file .ics, oppure Microsoft Graph ([Graph calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0)).
4. **SharePoint**: all'inizio solo link alle cartelle di commessa.
5. **Issue BIM**: prima import di file BCF-XML ([BCF-XML](https://github.com/buildingSMART/BCF-XML)), poi eventualmente le API [BCF 3.0](https://github.com/buildingSMART/BCF-API) o [ACC Issues](https://aps.autodesk.com/en/docs/acc/v1/overview/field-guide/issues).
6. **Timesheet**: leggere quello esistente, senza duplicarlo.

## F) GDPR e dati del personale

- Le ore si raccolgono per controllo di commessa e fatturazione, **non per valutare le persone**. La PPC va mostrata per team o commessa, non per individuo.
- **Art. 4 dello Statuto dei lavoratori** (controllo a distanza): serve un accordo sindacale o l'autorizzazione dell'Ispettorato, oppure l'inquadramento come "strumento di lavoro" con informativa. Da verificare con un consulente del lavoro ([Agenda Digitale](https://www.agendadigitale.eu/sicurezza/privacy/controlli-a-distanza-sui-lavoratori-come-farli-legalmente/)).
- **DPIA** prudente: il Garante include questi trattamenti nel suo elenco ([doc. 9058979](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979)).
- Visibilità per ruolo, log degli accessi, tempi di conservazione definiti.

## Raccomandazione dell'agente

**Stack consigliato:** Django (LTS) + HTMX + PostgreSQL, su Docker Compose in una VM Linux, dietro Caddy, con login Entra ID, aggiornamenti via SSE e optimistic locking. Tre container in tutto.

**Librerie JavaScript circoscritte** [NV, scelte indicative]:
- SortableJS per il Kanban;
- ECharts o Chart.js per i grafici;
- Frappe Gantt per il lookahead.

**Rischi principali:**
- dipendenza da una persona chiave;
- crescita incontrollata dei requisiti (rifare MS Project);
- manutenzione trascurata (backup, certificati);
- conformità HR;
- API esterne che cambiano;
- adozione (Excel usato in parallelo).
