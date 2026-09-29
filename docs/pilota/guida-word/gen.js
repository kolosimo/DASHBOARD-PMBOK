#!/usr/bin/env node
/**
 * generate_climosfera_docx.js
 *
 * Genera un documento .docx conforme al template aziendale Climosfera.
 *
 * Uso:
 *   node generate_climosfera_docx.js --output relazione.docx --content content.json [--logo path/to/logo.jpg]
 *
 * Il file content.json deve avere questa struttura:
 * {
 *   "titolo": "Titolo documento",
 *   "commessa": "I-2024-042",
 *   "sezioni": [
 *     {
 *       "heading": "Titolo capitolo",
 *       "level": 1,           // 1-4
 *       "body": ["Paragrafo 1", "Paragrafo 2"],
 *       "bullets": ["Punto 1", "Punto 2"],      // opzionale
 *       "numbered": ["Primo", "Secondo"],        // opzionale
 *       "table": {                                // opzionale
 *         "headers": ["Col1", "Col2"],
 *         "rows": [["a","b"], ["c","d"]]
 *       }
 *     }
 *   ],
 *   "includeToc": true        // opzionale, default true
 * }
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, LevelFormat,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, TabStopType, Bookmark, LevelSuffix
} = require("docx");

// --- Costanti Climosfera ---
const COLORS = {
  BLU_PRIMARIO: "0084D1",
  BLU_SECONDARIO: "0082C2",
  GRIGIO_SIDEBAR: "7C8392",
  NERO: "000000",
  GRIGIO_CELLA: "E6E6E6"
};

const FONT = "Lora";

// Margini A4 in DXA (1 cm = 566.93 DXA)
const PAGE_MARGINS = {
  top: 1134,     // 2.0 cm
  bottom: 680,   // 1.199 cm
  left: 1418,    // 2.501 cm
  right: 1418,   // 2.501 cm
  footer: 680,   // 1.199 cm
  gutter: 0
};

const CONTENT_WIDTH_DXA = 11906 - PAGE_MARGINS.left - PAGE_MARGINS.right; // ~9070

// --- Stili paragrafo ---
function buildStyles() {
  return {
    default: {
      document: {
        run: { font: FONT, size: 20 }
      }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1",
        basedOn: "Normal", next: "TextBodyIndent", quickFormat: true,
        run: { font: FONT, size: 24, bold: true, allCaps: true },
        paragraph: {
          spacing: { line: 360, before: 119, after: 119 },
          indent: { left: 0, right: 0, firstLine: 0 },
          keepNext: true,
          pageBreakBefore: true,                 // Nuova pagina prima di ogni H1 (fix: mancava)
          outlineLevel: 0
        }
      },
      {
        id: "Heading2", name: "Heading 2",
        basedOn: "Normal", next: "TextBodyIndent", quickFormat: true,
        run: { font: FONT, size: 22, bold: true, italics: true },
        paragraph: {
          spacing: { before: 119, after: 119 },
          indent: { left: 0, right: 0, firstLine: 0 },
          keepNext: true,
          outlineLevel: 1
        }
      },
      {
        id: "Heading3", name: "Heading 3",
        basedOn: "Normal", next: "TextBodyIndent", quickFormat: true,
        run: { font: FONT, size: 20, bold: false, italics: true, underline: { type: "single" } },
        paragraph: {
          spacing: { before: 119, after: 119 },
          keepNext: true,
          outlineLevel: 2
        }
      },
      {
        id: "Heading4", name: "Heading 4",
        basedOn: "Normal", next: "TextBodyIndent", quickFormat: true,
        run: { font: FONT, size: 20, bold: false, italics: true },
        paragraph: {
          spacing: { before: 0, after: 0 },
          indent: { left: 0, right: 0, firstLine: 0 },
          keepNext: true,
          outlineLevel: 3
        }
      }
    ]
  };
}

// --- Numbering ---
function buildNumbering() {
  return {
    config: [
      {
        reference: "climosfera-bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 396, hanging: 283 } },
            run: { font: FONT, size: 20 }
          }
        }]
      },
      {
        // Numerazione automatica capitoli (Revisione Stefania 06/2026):
        // heading numerati 1 / 1.1 / 1.1.1 / 1.1.1.1, separati da spazio (come ODT originale)
        reference: "climosfera-headings",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1", suffix: LevelSuffix.SPACE,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 0, hanging: 0 } } } },
          { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2", suffix: LevelSuffix.SPACE,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 0, hanging: 0 } } } },
          { level: 2, format: LevelFormat.DECIMAL, text: "%1.%2.%3", suffix: LevelSuffix.SPACE,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 0, hanging: 0 } } } },
          { level: 3, format: LevelFormat.DECIMAL, text: "%1.%2.%3.%4", suffix: LevelSuffix.SPACE,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 0, hanging: 0 } } } }
        ]
      },
      {
        reference: "climosfera-numbers",
        levels: [
          {
            level: 0, format: LevelFormat.DECIMAL, text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 396, hanging: 283 } } }
          },
          {
            level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 679, hanging: 283 } } }
          },
          {
            level: 2, format: LevelFormat.LOWER_LETTER, text: "%3)",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 962, hanging: 283 } } }
          }
        ]
      }
    ]
  };
}

// --- Footer ---
function buildFooter(logoPath) {
  // Footer minimale: solo linea separatrice orizzontale blu.
  // Tutti gli altri elementi (logo, "climosfera", numerazione) sono nella sidebar
  // e vengono aggiunti dallo script add_sidebar.py come elementi posizionati nel header.
  return new Footer({
    children: [
      new Paragraph({
        children: [],
        spacing: { before: 0, after: 0 }
      })
    ]
  });
}

// --- Generatori contenuto ---
function makeBodyParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, before: 0, after: 57 },
    indent: { firstLine: 284 },
    children: [new TextRun({ text, font: FONT, size: 20 })]
  });
}

function makeHeading(text, level) {
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4
  };
  const lvl = Math.min(Math.max(level || 1, 1), 4);
  return new Paragraph({
    heading: headingMap[lvl],
    numbering: { reference: "climosfera-headings", level: lvl - 1 },
    children: [new TextRun({ text, font: FONT })]
  });
}

function makeBulletItem(text) {
  return new Paragraph({
    numbering: { reference: "climosfera-bullets", level: 0 },
    spacing: { line: 360, before: 0, after: 0 },
    children: [new TextRun({ text, font: FONT, size: 20 })]
  });
}

function makeNumberedItem(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "climosfera-numbers", level },
    spacing: { line: 360, before: 0, after: 0 },
    children: [new TextRun({ text, font: FONT, size: 20 })]
  });
}

// Contatore globale tabelle per didascalie automatiche
let tableCounter = 0;

function makeDataTable(tableData) {
  const colCount = tableData.headers.length;
  const colWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);
  const columnWidths = Array(colCount).fill(colWidth);

  // Bordi a LINEA SINGOLA ovunque (Revisione Stefania 06/2026 — niente bordo doppio)
  const outerBorder = { style: BorderStyle.SINGLE, size: 4, color: COLORS.NERO };
  const innerBorder = { style: BorderStyle.SINGLE, size: 4, color: COLORS.NERO };
  const cellMargins = { top: 55, bottom: 55, left: 55, right: 55 };

  const rows = [];

  // Title row: riga superiore con titolo tabella (CONTENUTO TABELLA)
  // Se tableData ha un "title", creiamo una riga che lo contiene spanning tutte le colonne
  if (tableData.title) {
    const titleRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: colCount,
          borders: {
            top: outerBorder, bottom: innerBorder,
            left: outerBorder, right: outerBorder
          },
          width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
          shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: tableData.title,
              font: FONT, size: 20, bold: true
            })]
          })]
        })
      ]
    });
    rows.push(titleRow);
  }

  // Header row con nomi colonne (bold + italic, come da template Table Heading)
  const headerRow = new TableRow({
    children: tableData.headers.map((h, i) => {
      const isFirst = i === 0;
      const isLast = i === colCount - 1;
      return new TableCell({
        borders: {
          top: rows.length === 0 ? outerBorder : innerBorder,
          bottom: innerBorder,
          left: isFirst ? outerBorder : innerBorder,
          right: isLast ? outerBorder : innerBorder
        },
        width: { size: colWidth, type: WidthType.DXA },
        shading: { fill: COLORS.GRIGIO_CELLA, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: h, font: FONT, size: 20, bold: true, italics: true })]
        })]
      });
    })
  });
  rows.push(headerRow);

  // Data rows
  tableData.rows.forEach((row, rowIdx) => {
    const isLastRow = rowIdx === tableData.rows.length - 1;
    rows.push(new TableRow({
      children: row.map((cell, i) => {
        const isFirst = i === 0;
        const isLast = i === colCount - 1;
        return new TableCell({
          borders: {
            top: innerBorder,
            bottom: isLastRow ? outerBorder : innerBorder,
            left: isFirst ? outerBorder : innerBorder,
            right: isLast ? outerBorder : innerBorder
          },
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: "FFFFFF", type: ShadingType.CLEAR },  // corpo BIANCO (Rev. Stefania)
          margins: cellMargins,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(cell), font: FONT, size: 20 })]
          })]
        });
      })
    }));
  });

  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths,
    rows
  });
}

function makeTableCaption(captionText) {
  tableCounter++;
  const label = captionText || `Tabella ${tableCounter}`;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      // Rev. Stefania 06/2026: NO grassetto, due punti dopo il numero
      new TextRun({ text: `Tabella ${tableCounter}: ${label}`, font: FONT, size: 16, italics: true })
    ]
  });
}

function makeImageCaption(captionText, imageNum) {
  const num = imageNum || 1;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({ text: `Immagine ${num}: ${captionText || ''}`, font: FONT, size: 16, italics: true })
    ]
  });
}

// --- Main ---
async function generateDocument(content, outputPath, logoPath) {
  // ARCHITETTURA A DUE SEZIONI (Rev. Stefania 06/2026):
  //  - Sezione 1: pagina indice + pagina bianca — header VUOTI (nessuna sidebar),
  //    escluse dal conteggio pagine.
  //  - Sezione 2: contenuto — numerazione pagine che PARTE DA 1 (pgNumType start),
  //    header in cui add_sidebar.py inietta la sidebar.
  const tocChildren = [];
  const children = [];

  // TOC (se richiesto) — vive nella sezione 1
  if (content.includeToc !== false) {
    tocChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "Indice generale", font: FONT, size: 32, bold: true })],
        spacing: { before: 0, after: 200 }
      }),
      new TableOfContents("", { hyperlink: true, headingStyleRange: "1-4" }),
      // Pagina bianca dopo l'indice (anch'essa senza sidebar)
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ children: [] })
    );
  }

  let imageCounter = 0;
  // Sezioni
  for (const sezione of (content.sezioni || content.capitoli || [])) {
    // Heading
    if (sezione.heading) {
      children.push(makeHeading(sezione.heading, sezione.level || 1));
    }

    // Body paragraphs
    if (sezione.body) {
      for (const p of sezione.body) {
        children.push(makeBodyParagraph(p));
      }
    }

    // Bullets
    if (sezione.bullets) {
      for (const b of sezione.bullets) {
        children.push(makeBulletItem(b));
      }
    }

    // Numbered list
    if (sezione.numbered) {
      for (const n of sezione.numbered) {
        children.push(makeNumberedItem(n));
      }
    }

    // Immagini + didascalia (aggiunta per la guida utente)
    if (sezione.images) {
      for (const im of sezione.images) {
        const buf = fs.readFileSync(im.path);
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        const larghezzaPx = Math.round((im.widthCm || 15.5) / 2.54 * 96);
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 0 },
          keepNext: true,
          children: [new ImageRun({ type: "png", data: buf,
            transformation: { width: larghezzaPx, height: Math.round(larghezzaPx * h / w) } })]
        }));
        imageCounter += 1;
        children.push(makeImageCaption(im.caption, imageCounter));
      }
    }

    // Table + didascalia
    if (sezione.table) {
      children.push(makeDataTable(sezione.table));
      children.push(makeTableCaption(sezione.table.caption || sezione.heading || ""));
    }
  }

  // Bookmark di fine documento: replica il "riferimento incrociato" del template ODT.
  // add_sidebar.py lo usa con un campo PAGEREF per mostrare il numero TOTALE di pagine
  // di contenuto (la numerazione riparte da 1 al primo capitolo).
  children.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new Bookmark({ id: "fine_documento", children: [new TextRun({ text: "", font: FONT, size: 2 })] })]
  }));

  const pageProps = {
    size: { width: 11906, height: 16838 },
    margin: PAGE_MARGINS
    // La linea blu verticale della sidebar è gestita da add_sidebar.py
    // come shape posizionato, per avere controllo preciso sulla posizione.
  };

  const sections = [];

  // Sezione 1 — indice + pagina bianca, header e footer VUOTI (mai sidebar qui)
  if (tocChildren.length > 0) {
    sections.push({
      properties: { page: pageProps },
      headers: {
        default: new Header({ children: [new Paragraph({ children: [] })] }),
        even: new Header({ children: [new Paragraph({ children: [] })] })
      },
      footers: { default: new Footer({ children: [new Paragraph({ children: [] })] }) },
      children: tocChildren
    });
  }

  // Sezione 2 — contenuto: numerazione pagine da 1 (esclude indice e bianca)
  sections.push({
    properties: {
      page: { ...pageProps, pageNumbers: { start: 1 } }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ children: [] })] })
    },
    footers: { default: buildFooter(logoPath) },
    children
  });

  const doc = new Document({
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Documento generato: ${outputPath}`);
}

// --- CLI ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const outputPath = getArg("--output") || "relazione_climosfera.docx";
  const contentPath = getArg("--content");
  const logoPath = getArg("--logo");

  if (!contentPath) {
    console.error("Uso: node generate_climosfera_docx.js --output file.docx --content content.json [--logo logo.jpg]");
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  generateDocument(content, outputPath, logoPath).catch(err => {
    console.error("Errore:", err);
    process.exit(1);
  });
}

module.exports = { generateDocument, makeBodyParagraph, makeHeading, makeBulletItem, makeNumberedItem, makeDataTable, makeTableCaption, makeImageCaption, buildStyles, buildNumbering, buildFooter, COLORS, FONT, PAGE_MARGINS };
