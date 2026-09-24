# Ambiente di sviluppo

## Requisiti

| Strumento | Versione | Note |
|---|---|---|
| Node.js | **24 LTS** (provato con 24.21.0) | AdonisJS 7 richiede Node ≥ 24 (`engines` in package.json) |
| npm | 11 (incluso in Node 24) | |
| PostgreSQL | 16 (sviluppo); in produzione EDB su Windows Server 2022 | |
| Chromium | quello di Playwright 1.56.1 (revisione 1194) | solo per `npm run e2e` e `npm run screenshot` |

## Container di sviluppo (Linux, Claude Code)

Il container ha Node 22 in `/opt/node22`, non sufficiente per AdonisJS 7. Node 24 è
installato in `/opt/node24` (tarball ufficiale verificato con SHA-256):

```sh
V=$(curl -sS https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt | grep linux-x64.tar.xz | awk '{print $2}')
curl -sSO https://nodejs.org/dist/latest-v24.x/$V
curl -sS https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt | grep " $V" | sha256sum -c
mkdir -p /opt/node24 && tar -xJf $V -C /opt/node24 --strip-components=1 && rm $V
export PATH=/opt/node24/bin:$PATH     # in ogni shell, prima dei comandi npm
```

### PostgreSQL

Binari in `/usr/lib/postgresql/16/bin`. Il cluster di sviluppo sta in `/tmp/pgdata-cruscotto`
(fuori dal repo, di proprietà dell'utente `postgres`, porta 5432, autenticazione `trust`
solo in locale). Con lo script portabile:

```sh
npm run db:locale -- init                         # crea e avvia il cluster, utente e DB
npm run db:locale -- stato | avvia | ferma
npm run db:locale -- crea-db cruscotto_test_a1    # DB di test di un agente
```

Equivalente a mano (da root):

```sh
mkdir -p /tmp/pgdata-cruscotto && chown postgres:postgres /tmp/pgdata-cruscotto
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/pgdata-cruscotto -U postgres --auth=trust -E UTF8 --locale=C.UTF-8"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata-cruscotto -l /tmp/pgdata-cruscotto/log.txt -o '-p 5432 -k /tmp' start"
psql -h 127.0.0.1 -U postgres -c "create user cruscotto with password 'cruscotto' createdb"
psql -h 127.0.0.1 -U postgres -c "create database cruscotto_dev owner cruscotto"
psql -h 127.0.0.1 -U postgres -c "create database cruscotto_test owner cruscotto"
psql -h 127.0.0.1 -U postgres -c "create database cruscotto_e2e owner cruscotto"
```

`/tmp` si svuota al riavvio del container: in quel caso rilanciare `npm run db:locale -- init`
e `npm run db:ricrea`.

### Database per scopo

| DB | Uso | Come si sceglie |
|---|---|---|
| `cruscotto_dev` | `npm run dev` | `DB_DATABASE` in `.env` |
| `cruscotto_test` (o `cruscotto_test_<agente>`) | `npm run verifica`, `node ace test` | `DB_DATABASE` (default in `.env.test`) |
| `cruscotto_e2e` | `npm run e2e`, `npm run screenshot` (ricreato ogni volta) | `E2E_DB_DATABASE` |

Porte: dev 3333 (`.env`), test 3339 (`.env.test`, variabile `PORT`), e2e 3334 (`E2E_PORT`).
Ogni agente usa DB e porte propri, per esempio:

```sh
npm run db:locale -- crea-db cruscotto_test_a2
DB_DATABASE=cruscotto_test_a2 PORT=3402 npm run verifica
E2E_DB_DATABASE=cruscotto_e2e_a2 E2E_PORT=3502 npm run e2e   # dopo crea-db cruscotto_e2e_a2
```

### Playwright

Il Chromium è già in `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`). **Non** eseguire
`npx playwright install`: `@playwright/test` è fissato a 1.56.1 perché usa proprio quella
revisione (1194). Per un altro binario: `PLAYWRIGHT_CHROMIUM_PATH=/percorso/chrome npm run e2e`.

## Primo avvio

```sh
export PATH=/opt/node24/bin:$PATH
npm ci
cp .env.example .env && node ace generate:key     # scrive APP_KEY in .env
npm run db:locale -- init
npm run db:ricrea                                  # schema + dati di esempio in cruscotto_dev
npm run dev                                        # http://localhost:3333/accesso
```

## Windows e macOS (sviluppatori)

Gli script npm sono in Node (niente bash). Su Windows installare Node 24 LTS e PostgreSQL 16
(installer EDB), poi `PG_BIN="C:\Program Files\PostgreSQL\16\bin"` per `npm run db:locale`,
oppure creare utente e DB con pgAdmin. Il deploy su Windows Server (WinSW, TLS, backup) è
compito dell'agente B5 (Fase 2).

## Variabili d'ambiente

Tutte in `.env.example`, validate in `start/env.ts`. Il server **non parte** con
`NODE_ENV=production` e `AUTH_MODE=dev`, né con `AUTH_MODE=oidc` senza `OIDC_ISSUER`,
`OIDC_CLIENT_ID`, `OIDC_REDIRECT_URI`.

Login Microsoft 365 (Entra ID): registrare un'app "Web" con redirect
`https://<server>/auth/callback` (in sviluppo `http://localhost:3333/auth/callback`), creare
un client secret, poi `AUTH_MODE=oidc`,
`OIDC_ISSUER=https://login.microsoftonline.com/<ID-TENANT>/v2.0`, `OIDC_CLIENT_ID`,
`OIDC_CLIENT_SECRET`. `ADMIN_EMAILS` elenca chi diventa admin al primo accesso.
