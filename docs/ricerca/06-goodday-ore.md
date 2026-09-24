# 06 — "Gooday": fonte delle ore consuntive

> **Archiviato (rev. 2, 24/09/2026):** Climosfera ha deciso di non leggere dati da GoodDay; la nuova app ha il proprio timesheet. Il documento resta come riferimento.

> Ricerca web del 24/09/2026. Il proxy bloccava goodday.work: le informazioni vengono dagli estratti dei motori di ricerca, **da ricontrollare aprendo i link**.

## Identificazione (ipotesi da confermare in azienda)

Non esiste un software italiano chiamato "Gooday". Il candidato più probabile è **GoodDay – https://www.goodday.work/**: una piattaforma SaaS cloud di work management con progetti, task, Kanban/Gantt, time tracking e un modulo HR per le presenze.

**Come confermare:** guardare l'URL con cui i colleghi accedono. Se è `*.goodday.work`, l'identificazione è confermata.

## Cosa offre (estratti dal sito ufficiale)

- **Time tracking** con timer o inserimento manuale, e timesheet ([help](https://www.goodday.work/help/time-tracking)).
- **API REST v2 pubblica** ([docs](https://www.goodday.work/developers/api-v2)):
  - header `gd-api-token`, base URL `https://api.goodday.work/2.0/` ([connect](https://www.goodday.work/developers/api-v2/connect));
  - **Time Reports**: ore per periodo (`startDate` e `endDate`), filtrabili per `projectIds` e `userIds`. Ogni record contiene progetto, task, data, ore e `isBillable` ([time-reports](https://www.goodday.work/developers/api-v2/time-reports));
  - limiti di chiamate per organizzazione, senza numeri pubblici.
- **Export CSV/Excel** dei report ore ([reporting](https://www.goodday.work/help/time/reporting)).
- **SSO SAML** solo nei piani Enterprise ([features](https://www.goodday.work/features)).
- **Prezzo** da 6 USD per utente al mese (fonte secondaria: [Software Advice](https://www.softwareadvice.it/software/41483/goodday)).

## Implicazioni per il progetto

1. **Il consuntivo ore (AC dell'EVM) è leggibile in automatico** via API con un token in sola lettura. Non serve un nuovo timesheet.
2. **GoodDay ha già task e Kanban.** Se Climosfera li usa già, una seconda Kanban in un'altra app crea doppio inserimento. Va capito come viene usato GoodDay oggi.
3. **Non verificato:** se l'API espone le ore a budget o stimate per progetto e task.

## Domande per l'amministratore di GoodDay

1. Conferma del prodotto e del piano in uso.
2. Token API in sola lettura e perimetro dei progetti leggibili.
3. Limiti di chiamate e paginazione per lo storico.
4. Le ore a budget sono esposte via API? In quali campi?
5. Come si mappa una "commessa" Climosfera: progetto, sotto-progetto o campo personalizzato?
6. Esistono webhook sulle nuove registrazioni di ore, o serve interrogare periodicamente l'API?
7. Residenza dei dati (UE?) e configurazione SAML con Entra ID.
