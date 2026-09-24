# 03 — Tool di project management self-hosted

> **Superato (rev. 2, 24/09/2026):** si sviluppa un'app su misura (vedi `00` §2). OpenProject è scartato: il login M365 è solo Enterprise e non gestisce il Last Planner.

> Ricerca web del 24/09/2026 su repository e feed GitHub. openproject.org, plane.so e redmine.org erano bloccati dal proxy: per questi ho usato la documentazione nei repository. **n.v.** = non verificato.

**Nessuno dei tool valutati supporta nativamente Last Planner System, PPC o un registro vincoli.** Queste funzioni esistono solo in SaaS commerciali per l'edilizia, come [Touchplan](https://touchplan.io/digitize-lean-construction-planning/) e [vPlanner](https://vplannerapp.io/products).

## Tabella comparativa

| Tool | Licenza | Stato | Gantt/baseline | Kanban | Ore | Budget | EVM | Rischi | LDAP/SSO gratis | LPS/PPC |
|---|---|---|---|---|---|---|---|---|---|---|
| [OpenProject](https://github.com/opf/openproject) | GPLv3 | attivo (17.8.0, 09/2026) | sì / baseline limitata a "ieri" | sì | sì | sì | no | workaround | LDAP sì, SSO a pagamento | no |
| [Plane](https://github.com/makeplane/plane) | AGPL | attivo (1.4.2) | timeline n.v. | sì | Pro (n.v.) | no | no | no | a pagamento | no |
| [Redmine](https://github.com/redmine/redmine) | GPLv2 | attivo (7.0.1) | sì / no | plugin | sì | plugin | no | plugin | LDAP sì | no |
| [Leantime](https://github.com/Leantime/leantime) | AGPL | attivo (3.9.8) | sì | sì | sì | n.v. | no | **sì** | LDAP+OIDC sì | no |
| Taiga | MPL | lento | n.v. | sì | n.v. | no | no | no | n.v. | no |
| [Kanboard](https://github.com/kanboard/kanboard) | MIT | solo manutenzione | sì | sì | sì | no | no | no | LDAP sì | no |
| [Vikunja](https://github.com/go-vikunja/vikunja) | AGPL | attivo | sì | sì | Pro | no | no | no | LDAP+OIDC | no |
| Focalboard / MM Boards | — | Focalboard non mantenuto; plugin Boards per Mattermost attivo | no | sì | no | no | no | no | via Mattermost | no |
| Odoo CE | LGPL | attivo | Enterprise | sì | sì | parziale | no | no | n.v. | no |
| [ERPNext](https://github.com/frappe/erpnext) | GPLv3 | attivo | sì | sì | sì | sì | n.v. | no | n.v. | no |
| [Huly](https://github.com/hcengineering/platform) | EPL | attivo, pesante (8–16 GB RAM) | parziale | sì | sì | no | no | no | OIDC | no |
| [WeKan](https://github.com/wekan/wekan) | MIT | attivo | n.v. | sì | sì | no | no | no | LDAP+OIDC | no |

## Note chiave

- **OpenProject**
  - Requisiti minimi: 4 core, 4 GB RAM, PostgreSQL 16, fino a circa 200 utenti ([requisiti](https://github.com/opf/openproject/blob/dev/docs/installation-and-operations/system-requirements/README.md)).
  - Solo Enterprise: SSO OIDC/SAML, sincronizzazione gruppi LDAP, baseline con date libere, portfolio e risorse ([enterprise guide](https://github.com/opf/openproject/blob/dev/docs/enterprise-guide/README.md)).
  - **Implicazione per Climosfera (M365):** il login con account Microsoft in OpenProject richiede Enterprise.
- **Leantime**: registro rischi, Lean Canvas e SWOT nel core, LDAP e OIDC gratuiti. È il più semplice per utenti non tecnici, ma debole su budget e costi.
- **Redmine**: gratuito al 100% e stabile, ma l'interfaccia è datata e servono plugin.

## Raccomandazione dell'agente

1. **OpenProject Community**: la prima scelta se si vuole configurare un tool esistente.
2. **Leantime**: l'alternativa più lean e semplice.
3. **Redmine**: l'opzione conservativa.

LPS va ricostruito sopra il tool scelto, per esempio così:
- tipi di attività "Impegno settimanale" e "Vincolo" con campi personalizzati;
- il PPC calcolato da un'app esterna che legge le API REST.

## Configurare vs sviluppare

| | Configurare un tool esistente | Sviluppare su misura |
|---|---|---|
| Costo licenza | zero nella Community; Enterprise se servono SSO o baseline | zero |
| Tempi | da giorni a qualche settimana | mesi |
| Aderenza a LPS/PPC | bassa, da adattare | alta |
| Parte "commodity" da scrivere (login, permessi, Gantt, audit) | già presente | da scrivere; stima qualitativa 70–80% del lavoro |
| Manutenzione | aggiornamenti del fornitore | perpetua, interna |
| Rischio principale | modello dati del fornitore; funzioni che diventano a pagamento | dipendenza da una persona chiave |

**Proposta dell'agente**: approccio ibrido. Un tool esistente come sistema di riferimento, più una sottile app su misura che aggiunge PPC ed EVM.
