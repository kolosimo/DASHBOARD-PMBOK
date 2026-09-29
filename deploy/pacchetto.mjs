/**
 * npm run pacchetto: prepara lo zip da installare sul Windows Server.
 *
 *   1. controlla gli script PowerShell (UTF-8 con BOM se hanno accenti) e
 *      l'assenza di dipendenze native nel lockfile;
 *   2. `node ace build` (TypeScript compilato + asset Vite);
 *   3. copia la build in <uscita>/<nome>/ senza test ed e2e, più
 *      deploy/windows e docs/installazione;
 *   4. `npm ci --omit=dev --omit=optional` nella cartella, senza script di
 *      installazione (così restano fuori i binari per piattaforma di rolldown,
 *      lightningcss e ast-grep, usati solo in sviluppo e nella build);
 *   5. ricontrolla che in node_modules non ci siano moduli nativi (.node,
 *      binding.gyp);
 *   6. scrive versione.json e crea <nome>.zip con il relativo .sha256.
 *
 * Nome: cruscotto-commesse-<versione>-<aaaammgg>-<commit>. Uscita di default:
 * tmp/pacchetto (ignorata da git). Opzione: --uscita <cartella>.
 * Dentro lo zip i file stanno sotto una sola cartella corta, "cruscotto/",
 * perché sul server i percorsi di node_modules restino sotto i 260 caratteri.
 *
 * Solo Node, nessuna dipendenza e nessuna shell bash: gira uguale su
 * Windows, macOS e Linux. Lo zip è scritto qui (deflate di node:zlib) ed è
 * leggibile da Expand-Archive di Windows PowerShell 5.1.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(radice, 'package.json'), 'utf8'))

function argomento(nome, predefinito) {
  const i = process.argv.indexOf(nome)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : predefinito
}

function passo(testo) {
  console.log(`\n=== ${testo} ===`)
}

function esci(messaggio) {
  console.error(`\nPACCHETTO NON CREATO: ${messaggio}`)
  process.exit(1)
}

function esegui(comando, argomenti, opzioni = {}) {
  const r = spawnSync(comando, argomenti, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && comando.endsWith('.cmd'),
    ...opzioni,
  })
  if (r.status !== 0) esci(`comando fallito: ${comando} ${argomenti.join(' ')}`)
}

/** Tutti i file sotto `cartella` (percorsi assoluti), cartelle incluse se richiesto */
function elenca(cartella, conCartelle = false) {
  const out = []
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const p = join(cartella, voce.name)
    if (voce.isDirectory()) {
      if (conCartelle) out.push(p + sep)
      out.push(...elenca(p, conCartelle))
    } else if (voce.isFile()) {
      out.push(p)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 1. Controlli preliminari
// ---------------------------------------------------------------------------
passo('controlli preliminari')
const major = Number(process.versions.node.split('.')[0])
if (major < 24) esci(`serve Node 24 o successivo (in uso ${process.versions.node})`)

// Windows PowerShell 5.1 legge gli script senza BOM come ANSI: accenti e
// apostrofi tipografici si rompono. Con caratteri non ASCII serve il BOM.
const cartellaWindows = join(radice, 'deploy', 'windows')
for (const file of elenca(cartellaWindows).filter((f) => /\.(ps1|psm1)$/i.test(f))) {
  const byte = readFileSync(file)
  const bom = byte[0] === 0xef && byte[1] === 0xbb && byte[2] === 0xbf
  if (!bom && byte.some((b) => b > 0x7f)) {
    esci(`${relative(radice, file)} contiene caratteri non ASCII ma non ha il BOM UTF-8`)
  }
}
console.log('script PowerShell: codifica OK')
esegui(process.execPath, [join(radice, 'scripts', 'controlla-dipendenze-native.mjs')], {
  cwd: radice,
})

const data = new Date()
const aaaammgg = [data.getFullYear(), data.getMonth() + 1, data.getDate()]
  .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0'))
  .join('')
const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: radice, encoding: 'utf8' })
const commit = git.status === 0 ? git.stdout.trim() : 'senzagit'
const gitStato = spawnSync('git', ['status', '--porcelain'], { cwd: radice, encoding: 'utf8' })
const modificheLocali = gitStato.status === 0 && gitStato.stdout.trim().length > 0
const nome = `${pkg.name}-${pkg.version}-${aaaammgg}-${commit}${modificheLocali ? '-modificato' : ''}`
const uscita = resolve(radice, argomento('--uscita', join('tmp', 'pacchetto')))
const cartella = join(uscita, nome)
const fileZip = join(uscita, `${nome}.zip`)
if (modificheLocali) {
  console.warn('ATTENZIONE: ci sono modifiche non committate; il nome del pacchetto lo indica.')
}

// ---------------------------------------------------------------------------
// 2. Build
// ---------------------------------------------------------------------------
passo('build AdonisJS (node ace build)')
esegui(process.execPath, ['ace', 'build'], { cwd: radice })
const build = join(radice, 'build')
if (!existsSync(join(build, 'bin', 'server.js'))) esci('build/bin/server.js non trovato')

// ---------------------------------------------------------------------------
// 3. Copia
// ---------------------------------------------------------------------------
passo(`copia in ${relative(radice, cartella)}`)
rmSync(cartella, { recursive: true, force: true })
rmSync(fileZip, { force: true })
mkdirSync(cartella, { recursive: true })

/** Parti della build che non servono sul server */
const ESCLUSI = [/^tests([\\/]|$)/, /^e2e([\\/]|$)/, /^playwright[^\\/]*$/, /^vite\.config\./]
cpSync(build, cartella, {
  recursive: true,
  filter: (sorgente) => {
    const rel = relative(build, sorgente)
    return rel === '' || !ESCLUSI.some((re) => re.test(rel))
  },
})
cpSync(cartellaWindows, join(cartella, 'deploy', 'windows'), { recursive: true })
const docInstallazione = join(radice, 'docs', 'installazione')
if (existsSync(docInstallazione)) {
  cpSync(docInstallazione, join(cartella, 'docs', 'installazione'), { recursive: true })
}
mkdirSync(join(cartella, 'tmp'), { recursive: true })
writeFileSync(join(cartella, 'tmp', '.gitkeep'), '')

// ---------------------------------------------------------------------------
// 4. Dipendenze di produzione
// ---------------------------------------------------------------------------
passo('npm ci --omit=dev --omit=optional')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
esegui(npm, ['ci', '--omit=dev', '--omit=optional', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: cartella,
  env: { ...process.env, NODE_ENV: 'production' },
})

// ---------------------------------------------------------------------------
// 5. Nessun modulo nativo
// ---------------------------------------------------------------------------
passo('controllo moduli nativi in node_modules')
const nativi = elenca(join(cartella, 'node_modules')).filter(
  (f) => f.endsWith('.node') || basename(f) === 'binding.gyp'
)
if (nativi.length > 0) {
  esci(`moduli nativi nel pacchetto:\n  ${nativi.map((f) => relative(cartella, f)).join('\n  ')}`)
}
console.log('nessun modulo nativo')

// ---------------------------------------------------------------------------
// 6. versione.json e zip
// ---------------------------------------------------------------------------
writeFileSync(
  join(cartella, 'versione.json'),
  JSON.stringify(
    {
      nome: pkg.name,
      versione: pkg.version,
      commit,
      modificheLocali,
      creatoIl: data.toISOString(),
      node: process.versions.node,
      pacchetto: `${nome}.zip`,
    },
    null,
    2
  ) + '\n'
)

passo(`zip ${relative(radice, fileZip)}`)

/** Data e ora in formato MS-DOS (ora locale, risoluzione 2 s) */
function dataDos(d) {
  const anno = Math.max(d.getFullYear(), 1980)
  return {
    ora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    giorno: ((anno - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** Cartella radice dentro lo zip: corta per i percorsi lunghi di Windows */
const RADICE_ZIP = 'cruscotto'
/**
 * Sul server l'estrazione avviene in C:\app\versioni\aaaammgg-hhmmss\ (32
 * caratteri): con MAX_PATH = 260 restano circa 220 caratteri per il resto.
 */
const LUNGHEZZA_MASSIMA = 215

const voci = elenca(cartella, true)
const troppoLunghi = voci
  .map((v) => `${RADICE_ZIP}/${relative(cartella, v)}`)
  .filter((r) => r.length > LUNGHEZZA_MASSIMA)
if (troppoLunghi.length > 0) {
  esci(`percorsi troppo lunghi per Windows (> ${LUNGHEZZA_MASSIMA}):\n  ${troppoLunghi.join('\n  ')}`)
}
if (voci.length > 65535) {
  esci(`troppi file per uno zip senza ZIP64 (${voci.length}); ridurre il contenuto`)
}
const fd = openSync(fileZip, 'w')
let posizione = 0
const centrale = []
const scrivi = (buf) => {
  writeSync(fd, buf)
  posizione += buf.length
}
for (const assoluto of voci) {
  const cartellaVoce = assoluto.endsWith(sep)
  let rel = relative(cartella, assoluto).split(sep).join('/')
  rel = `${RADICE_ZIP}/${rel}${cartellaVoce ? '/' : ''}`
  const nomeBuf = Buffer.from(rel, 'utf8')
  const { ora, giorno } = dataDos(statSync(assoluto).mtime)
  let dati = Buffer.alloc(0)
  let metodo = 0
  let crc = 0
  let dimensione = 0
  if (!cartellaVoce) {
    const contenuto = readFileSync(assoluto)
    dimensione = contenuto.length
    crc = zlib.crc32(contenuto)
    const compresso = zlib.deflateRawSync(contenuto, { level: 9 })
    if (compresso.length < contenuto.length) {
      dati = compresso
      metodo = 8
    } else {
      dati = contenuto
    }
  }
  if (posizione + dati.length > 0xffffffff) esci('pacchetto oltre 4 GB: serve ZIP64')
  const locale = Buffer.alloc(30)
  locale.writeUInt32LE(0x04034b50, 0)
  locale.writeUInt16LE(20, 4) // versione necessaria 2.0
  locale.writeUInt16LE(0x0800, 6) // nomi in UTF-8
  locale.writeUInt16LE(metodo, 8)
  locale.writeUInt16LE(ora, 10)
  locale.writeUInt16LE(giorno, 12)
  locale.writeUInt32LE(crc >>> 0, 14)
  locale.writeUInt32LE(dati.length, 18)
  locale.writeUInt32LE(dimensione, 22)
  locale.writeUInt16LE(nomeBuf.length, 26)
  locale.writeUInt16LE(0, 28)
  const offset = posizione
  scrivi(locale)
  scrivi(nomeBuf)
  if (dati.length > 0) scrivi(dati)

  const c = Buffer.alloc(46)
  c.writeUInt32LE(0x02014b50, 0)
  c.writeUInt16LE(20, 4) // creato da: MS-DOS/FAT, 2.0
  c.writeUInt16LE(20, 6)
  c.writeUInt16LE(0x0800, 8)
  c.writeUInt16LE(metodo, 10)
  c.writeUInt16LE(ora, 12)
  c.writeUInt16LE(giorno, 14)
  c.writeUInt32LE(crc >>> 0, 16)
  c.writeUInt32LE(dati.length, 20)
  c.writeUInt32LE(dimensione, 24)
  c.writeUInt16LE(nomeBuf.length, 28)
  c.writeUInt16LE(0, 30) // extra
  c.writeUInt16LE(0, 32) // commento
  c.writeUInt16LE(0, 34) // disco
  c.writeUInt16LE(0, 36) // attributi interni
  c.writeUInt32LE(cartellaVoce ? 0x10 : 0x20, 38) // attributi DOS: cartella / archivio
  c.writeUInt32LE(offset, 42)
  centrale.push(Buffer.concat([c, nomeBuf]))
}
const inizioCentrale = posizione
for (const c of centrale) scrivi(c)
const fine = Buffer.alloc(22)
fine.writeUInt32LE(0x06054b50, 0)
fine.writeUInt16LE(0, 4)
fine.writeUInt16LE(0, 6)
fine.writeUInt16LE(centrale.length, 8)
fine.writeUInt16LE(centrale.length, 10)
fine.writeUInt32LE(posizione - inizioCentrale, 12)
fine.writeUInt32LE(inizioCentrale, 16)
fine.writeUInt16LE(0, 20)
scrivi(fine)
closeSync(fd)

const hash = createHash('sha256').update(readFileSync(fileZip)).digest('hex')
writeFileSync(`${fileZip}.sha256`, `${hash}  ${basename(fileZip)}\n`)

const mb = (statSync(fileZip).size / 1024 / 1024).toFixed(1)
console.log(`\nPacchetto creato: ${fileZip}`)
console.log(`  ${voci.length} voci, ${mb} MB, SHA-256 ${hash}`)
console.log(`  cartella non compressa: ${cartella}`)
