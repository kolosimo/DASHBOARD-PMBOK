/**
 * Copia in public/ le librerie e i font usati dal browser, con la versione
 * nel nome del file (nessun CDN: l'app gira in VPN).
 *
 *   npm run vendorizza
 *
 * Da rilanciare solo dopo aver cambiato la versione di htmx.org, alpinejs o
 * @fontsource/* in package.json. I file generati si committano.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = (...p) => join(radice, 'node_modules', ...p)
const versione = (pkg) => JSON.parse(readFileSync(nm(pkg, 'package.json'), 'utf8')).version

const vendor = join(radice, 'public', 'vendor')
const fonts = join(radice, 'public', 'fonts')
for (const d of [vendor, fonts]) {
  if (existsSync(d)) rmSync(d, { recursive: true, force: true })
  mkdirSync(d, { recursive: true })
}

const htmx = versione('htmx.org')
const alpine = versione('alpinejs')
copyFileSync(nm('htmx.org', 'dist', 'htmx.min.js'), join(vendor, `htmx-${htmx}.min.js`))
copyFileSync(nm('alpinejs', 'dist', 'cdn.min.js'), join(vendor, `alpine-${alpine}.min.js`))
writeFileSync(
  join(vendor, 'VERSIONI.md'),
  `# Librerie vendorizzate\n\nGenerate da \`npm run vendorizza\`. Non modificare a mano.\n\n` +
    `| File | Pacchetto | Versione | Licenza |\n|---|---|---|---|\n` +
    `| htmx-${htmx}.min.js | htmx.org | ${htmx} | 0BSD |\n` +
    `| alpine-${alpine}.min.js | alpinejs | ${alpine} | MIT |\n`
)

// Font IBM Plex (licenza SIL OFL 1.1): solo latin e latin-ext, pesi usati dal CSS
const famiglie = [
  { pkg: '@fontsource/ibm-plex-sans', pesi: [400, 500, 600] },
  { pkg: '@fontsource/ibm-plex-sans-condensed', pesi: [500, 600] },
  { pkg: '@fontsource/ibm-plex-mono', pesi: [400, 500] },
]
let css = `/* IBM Plex, self-hosted. Generato da "npm run vendorizza". Licenza: SIL OFL 1.1 (vedi OFL.txt) */\n`
for (const { pkg, pesi } of famiglie) {
  for (const peso of pesi) {
    // <peso>.css contiene un blocco @font-face per sottoinsieme, con unicode-range
    const sorgente = readFileSync(nm(pkg, `${peso}.css`), 'utf8')
    const blocchi = sorgente.split(/(?=\/\* )/)
    for (const blocco of blocchi) {
      const m = blocco.match(/\/\* [a-z-]+-(latin|latin-ext)-\d+-normal \*\//)
      if (!m) continue
      const nomi = [...blocco.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map((x) => x[1])
      for (const nome of nomi) copyFileSync(nm(pkg, 'files', nome), join(fonts, nome))
      css +=
        blocco
          .replace(
            /url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\), url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g,
            "url(/fonts/$1) format('woff2')"
          )
          .replace(/\/\*.*?\*\//gs, '')
          .trim() + '\n'
    }
  }
}
writeFileSync(join(fonts, 'plex.css'), css)
copyFileSync(nm('@fontsource/ibm-plex-sans', 'LICENSE'), join(fonts, 'OFL.txt'))
console.log(`vendorizzati: htmx ${htmx}, alpine ${alpine}, font IBM Plex in public/fonts`)
