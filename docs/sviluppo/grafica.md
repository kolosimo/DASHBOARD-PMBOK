# Grafica dell'app: Climosfera Design System

La veste grafica segue il **Climosfera Design System** in `docs/design-system/`: regole
nel `README.md`, token in `colors_and_type.css`. Nell'app i token stanno in
`resources/css/tokens.css`, con gli stessi nomi del DS. `resources/css/app.css` usa
solo quei token, direttamente o tramite gli alias storici (`--accent`, `--ink`, `--pv`…)
che le viste e i grafici SVG già usano. Il prototipo (`prototipo/index.html`) contiene
una copia degli stessi due file.

## Regole applicate

| Elemento | Regola DS | Nell'app |
|---|---|---|
| Sfondo | sempre bianco, niente tema scuro | tema chiaro soltanto (`color-scheme: light`) |
| Font | solo Lora | Lora variable, dritto e **corsivo vero**, self-hosted in `public/fonts/lora.css` (`npm run vendorizza`, pacchetto `@fontsource-variable/lora`, OFL) |
| Testo | nero `#000` | nero; metadati in grigio `#7C8392` |
| Blu | `#0084D1` per strutture e pulsanti, `#0082C2` per l'hover | riga sotto la testata, piede, scheda attiva, pulsanti, milestone raggiunte, serie EV |
| Titoli | H1 maiuscolo, H2 bold corsivo, H3 corsivo sottolineato | H1 = nome dell'app e "Accedi"; H2 = titolo di pagina; H3 = titolo di pannello |
| Forme | raggi 0 (max 4 px), niente ombre, niente gradienti | ovunque |
| Icone | nessuna, niente emoji né frecce | frecce sostituite da parole ("Avanti", "Indietro", "Precedente · W39") |
| Pulsanti | primario blu pieno bold corsivo; secondario con bordo blu 2 px | `.btn.primary`, `.btn`; `.btn.ghost` = link sottolineato in blu |
| Tabelle | doppio bordo esterno nero, intestazione grigia | come DS (vedi deroga 2 per l'interno) |
| Logo | vettoriale da fornire; per ora riquadro blu "CLIMOSFERA" | `.marchio` nella testata; da sostituire quando arriva l'SVG |

## Deroghe (decise il 30/09/2026)

1. **Colori di stato.** Il DS non ne prevede. SPI, CPI, PPC, WIP e vincoli scaduti hanno
   un quadratino 8×8 accanto a una parola sempre presente ("in linea", "attenzione",
   "critico", "n.d."). I colori sono `--stato-ok` `#1E7B3A`, `--stato-att` `#B26A00` e
   `--stato-crit` `#C62828`. Non si usano mai come fondo. La parola basta da sola: il
   colore è un aiuto, non l'unico segnale.
2. **Densità.** Il DS è pensato per documenti e slide, con testo a 18 px e griglia nera
   completa. Nell'app:
   - testo a 16 px, tabelle di dati a 15 px;
   - titoli ridotti (H2 24 px, H3 18 px);
   - dentro le tabelle, divisori grigi sottili al posto della griglia nera;
   - niente righe alternate.
3. **Niente barra laterale destra.** L'elemento di marca delle pagine e delle slide
   (linea blu verticale con testo ruotato) nell'app toglierebbe spazio. Il blu 2 px resta
   sotto la testata e nel piede.
4. **Password temporanea** (pagine admin): unico testo in carattere a larghezza fissa di
   sistema (`.password-temporanea`), perché si distinguano `l`, `1` e `I`.

## Grafici

- **Curva S:** PV grigio tratteggiato, EV blu, AC nero. Le serie si distinguono anche
  dal tratto, non solo dal colore.
- **PPC:** barra blu per l'ultima settimana, grigio `#E6E6E6` con bordo blu per le
  precedenti.
- **CFD:** blu a opacità decrescente.
- **Testi:** Lora 12 px grigio.
- **Sul telefono:** i grafici hanno larghezza minima 520 px e scorrono dentro il pannello.

## Da verificare / aperto

- **Contrasto:**
  - testo bianco su blu `#0084D1`: 4,0:1;
  - blu su bianco: 4,0:1;
  - grigio `#7C8392` su bianco: 3,8:1.

  Sono sotto il 4,5:1 richiesto da WCAG AA per il testo normale. Per questo i link sono
  neri con la sottolineatura blu, e il grigio si usa solo per i metadati. I pulsanti blu
  con testo bianco restano come da DS: se servisse il livello AA pieno, andrebbe deciso
  con chi cura il DS (per esempio un blu più scuro solo per i pulsanti).
- **Logo SVG:** quando arriva, sostituisce `.marchio` nel layout, nella pagina di
  accesso e nel prototipo.
- **Guida Word:** le schermate della guida utente
  (`docs/pilota/Guida_Cruscotto_Commesse.docx`) mostrano ancora la grafica precedente.
