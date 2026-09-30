# Climosfera S.r.l. — Design System

> **Think. Manage. Do.** — Climosfera official tagline.

## Company Overview

**Climosfera S.r.l.** is an MEP (Mechanical, Electrical, Plumbing) engineering studio based in Italy, with headquarters in Treviso (Villorba) and an operative office in Milan. The studio produces technical reports, engineering documentation, project decks, and client-facing presentations. The visual identity is rigorously minimalist — anchored in a serif typographic system, a precise engineering-blue palette, and strict no-decoration rules. Think Italian technical rigour: no ornament, no flourish, only structure.

**Sources:** Design system defined via brief specification (no Figma link or codebase provided).

### Contacts

| | |
|---|---|
| **Sede Centrale (HQ)** | Via Monte Grappa, 25 — 31020 Villorba (TV) — Italia |
| **Sede Operativa** | Via G. Fiamma, 12 — 20129 Milano (MI) — Italia |
| **Telefono** | +39 0422 608987 |
| **Fax** | +39 0422 241801 |
| **Email** | info@climosfera.it |
| **Web** | www.climosfera.it |
| **Tagline** | Think. Manage. Do. |

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Professional and technical** — Climosfera communicates with precision. No casual language.
- **Italian primary** — Documents default to Italian. Section headers, captions, and labels are in Italian (e.g. "Tabella", "Figura", "Grazie").
- **Formal register** — Third person or institutional "we" (noi). No "tu/Lei" familiarity.
- **No emoji** — Absolutely none. No decorative punctuation or informal markers.
- **Casing:** H1 headings are UPPERCASE. H2/H3 use sentence case. Captions use sentence case.

### Caption Conventions
- Tables: `Tabella N: [Titolo]` — italic, 8pt, centered below table
- Figures: `Figura N: [Descrizione]` — italic, 8pt, centered below figure
- All captions use Lora italic, #7C8392 grey or black depending on context

### Numbering
- All tables and figures are numbered sequentially per document/chapter
- Section references are numeric (e.g. "§ 3.2")

---

## VISUAL FOUNDATIONS

### Color System
| Token | Hex | Usage |
|---|---|---|
| `--color-blue-primary` | `#0084D1` | Structural lines, CTAs, sidebar accent, primary buttons |
| `--color-blue-secondary` | `#0082C2` | Table borders, hover states |
| `--color-black` | `#000000` | All body text, headings, sidebar rotated text |
| `--color-grey-meta` | `#7C8392` | Page numbers, secondary labels, metadata |
| `--color-grey-table` | `#E6E6E6` | Table backgrounds, dividers |
| `--color-white` | `#FFFFFF` | Page background — always |

**Background:** Always white. No tinted backgrounds, no dark mode.

### Typography
**Font family:** Lora variable font — the **only** typeface used.
- **Local file:** `fonts/Lora-VariableFont_wght.ttf` (upright, weight axis 100–900)
- **Missing:** `fonts/Lora-Italic-VariableFont_wght.ttf` — italic glyphs currently synthesised by the browser. Add the italic TTF and register it in `colors_and_type.css` to replace synthesis.
- **Network fallback:** Google Fonts `https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400;1,700` kept in all HTML files for environments without local font access.

| Role | Size | Weight | Style | Transform |
|---|---|---|---|---|
| H1 | 2rem | 700 | normal | UPPERCASE |
| H2 | 1.75rem | 700 | italic | none |
| H3 | 1.375rem | 400 | italic | none; underline |
| Body | 1.125rem | 400 | normal | line-height 1.5 |
| Caption | 0.875rem | 400 | italic | centered |
| Page number | 0.5rem (8pt) | 400 | normal | — |

No sans-serif. No Inter, Roboto, Helvetica, Arial — ever.

### Backgrounds & Surfaces
- **Page background:** White `#FFFFFF` — always, without exception
- **No gradients.** No decorative backgrounds.
- **No shadows** (box-shadow or text-shadow).
- **No rounded corners > 4px.** Prefer 0px (square corners) for all structural elements.
- Tables use `#E6E6E6` fill with double outer border (black) and single inner borders (black).

### Borders & Lines
- **Structural accent:** 2px solid `#0084D1` (sidebar vertical line, section separators)
- **Table outer border:** Double border, black
- **Table inner border:** 1px solid black
- **No decorative borders** — borders only serve structure/data-separation purposes

### Sidebar Brand Element
A persistent vertical sidebar appears on the **right edge** of every slide/page:
- 2px wide vertical blue line (`#0084D1`), full height
- Rotated project name + chapter text: `writing-mode: vertical-rl; transform: rotate(180deg)`; color **black** `#000000` (never grey)
- Page number at bottom: Lora 8pt, `#7C8392`

### Animation & Interaction
- **No decorative animation.** This is a document-first studio.
- Hover states: color darkens to `#0082C2` (secondary blue) on interactive elements
- Press states: slight opacity reduction (0.85)
- No bounces, no fades beyond simple opacity transitions (150ms ease)

### Cards & Containers
- No card shadows
- No rounded corners (0px preferred; max 4px)
- Borders: 1px solid black or blue, structural only
- No background tints on containers — white always

### Imagery
- Technical diagrams, engineering drawings, floor plans
- No lifestyle photography, no decorative illustration
- All images captioned: `Figura N: [description]`
- Colour: neutral technical palette; no warm filters

### Iconography
No icon system. No icon font. No emoji. No SVGs used decoratively. The only visual markers are:
- Horizontal rules (blue `#0084D1`, 2px)
- Table structure
- Sidebar line

---

## ICONOGRAPHY

Climosfera does **not** use icons. The brand aesthetic is rooted in engineering documentation where clarity of text and data structures replaces iconographic communication.

- No icon font (FontAwesome, Material Icons, etc.)
- No SVG icon sprites
- No emoji
- No Unicode character icons (→ ✓ etc.) in primary body copy
- Bullet lists use standard typographic bullets (·) or numbered lists only

---

## SLIDE LAYOUT SYSTEM (16:9 · 1920×1080)

**Safe margins:** 80px all sides

### Cover Slide
- Logo: top center
- H1 title: centered, uppercase
- Subtitle: H2 italic
- Sidebar: right edge (blue line + project/chapter text rotated + page number)

### Content Slide
- H2: top-left, in safe margin
- Body: max 5 bullet points OR 1 figure + caption
- Sidebar: right (always)
- Page number: bottom-right (sidebar element)

### Closing Slide
- "Grazie" H1 centered, uppercase
- Contact information below in Body style

---

## Slide decks

I deck risiedono in `slides/`. Ogni file è autonomo: carica `deck-stage.js`, il font locale Lora con fallback Google Fonts, e gli stili inline coerenti con i token del DS (`--blue`, `--black`, `--grey-meta`, `--grey-table`, `--white`). Tema **light** su tutte le slide — sfondo bianco fisso, blu `#0084D1` solo come accento strutturale.

| File | Slide | Descrizione |
|---|---|---|
| `slides/index.html` | 6 | **Template di riferimento.** Sei tipi di slide: Cover, Bullets, Table, Figure, Section divider, Closing. Light theme, Lora, sidebar destra blu 2px. Usare come punto di partenza per nuovi deck. |
| `slides/Presentazione NotebookLM DS v1.html` | 17 | **Prima presentazione generata dal DS.** Light theme. Contenuto: *NotebookLM e l'utilizzo intelligente dell'IA* — 7 principi per l'uso degli strumenti di AI. Autore: Simone Rizzo (AI Engineer & Ricercatore). Data: Maggio 2026. |
| `slides/Presentazione NotebookLM DS v1 - BACKUP 2026-09-08.html` | 19 | **Backup congelato al 08/09/2026.** Copia identica del deck attivo, congela lo stato a 19 slide dopo la riscrittura delle slide 04 (Trovare le fonti che non hai) e 05 (Verifica delle Fonti). Non modificare: usare solo come punto di ripristino. |
| `slides/Presentazione NotebookLM DS v1 - ESTESA 2026-09-18.html` | 19 | **Versione estesa (18/09/2026).** Copia del deck attivo destinata alla lettura autonoma e all'archivio sul server aziendale: testo più lungo e slide aggiuntive consentite. Il deck attivo non va più modificato. |
| `slides/Presentazione NotebookLM DS v1 - BACKUP 2026-09-10 pre-05-06.html` | 19 | **Backup congelato al 10/09/2026.** Copia identica byte per byte del deck attivo, stato precedente alla riscrittura delle slide 05 e 06. Non modificare: usare solo come punto di ripristino. |
| `slides/Presentazione NotebookLM v4 BACKUP.html` | — | **Backup della versione precedente** (dark/navy theme, pre-DS). Conservato come riferimento storico; non riflette l'attuale identità Climosfera e non deve essere usato come base per nuovi deck. |

**Come crearne uno nuovo:** copiare `slides/index.html`, mantenere la struttura `<deck-stage>` + `<section class="slide">` per ogni slide, e riutilizzare i token CSS dichiarati in `:root`. Ogni slide deve avere `.sidebar` destra e `data-screen-label` univoco.

---

## Asset pendenti

Elementi non ancora forniti al DS. Sono attualmente sostituiti da placeholder; aggiornare appena disponibili.

- **Logo vettoriale (SVG / AI)** — da fornire e caricare in `uploads/`. Attualmente il logo è reso come testo nel badge `CLIMOSFERA` (riquadro blu con etichetta tipografica in Lora 700, lettera-spacing 0.20em). Una volta caricato il file vettoriale, sostituire il markup `.logo-box` in `slides/`, `ui_kits/report/` e nelle card di preview.
- **Lora Italic Variable Font** (`Lora-Italic-VariableFont_wght.ttf`) — file mancante. L'italic è attualmente **sintetizzato dal browser** dall'upright variable font. Da aggiungere in `fonts/` e referenziare in `colors_and_type.css` aggiornando la seconda regola `@font-face` (cambiare `src` dal file upright al file italic dedicato). Stessa modifica da propagare ai blocchi `@font-face` inline nelle 10 HTML del progetto.

---

## FILE INDEX

```
README.md                                         ← This file
SKILL.md                                          ← Agent skill descriptor
colors_and_type.css                               ← All CSS custom properties + type styles
fonts/
  Lora-VariableFont_wght.ttf                      ← Lora upright (weight axis 100–900)
  (Lora-Italic-VariableFont_wght.ttf)             ← PENDING — see "Asset pendenti"
preview/                                          ← Design system cards (Design System tab)
  colors-primary.html
  colors-neutral.html
  type-headings.html
  type-body.html
  spacing-borders.html
  components-buttons.html
  components-tables.html
  components-sidebar.html
slides/                                           ← See "Slide decks" section
  deck-stage.js
  index.html
  Presentazione NotebookLM DS v1.html
  Presentazione NotebookLM v4 BACKUP.html
ui_kits/
  report/
    index.html                                    ← Technical report / document UI kit
    README.md
```
