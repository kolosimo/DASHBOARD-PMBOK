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

// Font Lora variable (Design System Climosfera, licenza SIL OFL 1.1): dritto e
// corsivo veri, solo latin e latin-ext
const lora = '@fontsource-variable/lora'
let css = `/* Lora (Design System Climosfera), self-hosted. Generato da "npm run vendorizza". Licenza: SIL OFL 1.1 (vedi OFL.txt) */\n`
for (const stile of ['wght', 'wght-italic']) {
  // <stile>.css contiene un blocco @font-face per sottoinsieme, con unicode-range
  const sorgente = readFileSync(nm(lora, `${stile}.css`), 'utf8')
  for (const blocco of sorgente.split(/(?=\/\* )/)) {
    if (!/\/\* lora-(latin|latin-ext)-wght-(normal|italic) \*\//.test(blocco)) continue
    const nomi = [...blocco.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map((x) => x[1])
    for (const nome of nomi) copyFileSync(nm(lora, 'files', nome), join(fonts, nome))
    css +=
      blocco
        .replace("font-family: 'Lora Variable'", "font-family: 'Lora'")
        .replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, 'url(/fonts/$1)')
        .replace(/\/\*.*?\*\//gs, '')
        .trim() + '\n'
  }
}
writeFileSync(join(fonts, 'lora.css'), css)
copyFileSync(nm(lora, 'LICENSE'), join(fonts, 'OFL.txt'))
console.log(`vendorizzati: htmx ${htmx}, alpine ${alpine}, font Lora in public/fonts`)
