# Sorgenti della guida Word

`../Guida_Cruscotto_Commesse.docx` è generata da questi file con il modello aziendale Climosfera (skill `climosfera-template`).

- `contenuto.py`: testo della guida (capitoli, elenchi, tabelle, immagini) → produce `content.json`.
- `gen.js`: copia del generatore Climosfera con in più il supporto alle immagini (`images: [{path, caption}]`).
- `img/`: schermate ritagliate da `npm run screenshot` (dati di esempio).

Per rigenerare: `python3 contenuto.py`, poi `node gen.js --output base.docx --content content.json --logo <logo>` (serve il pacchetto npm `docx`), poi `add_sidebar.py` della skill Climosfera. Quando cambiano le schermate, rigenerare anche le immagini.

Dopo `add_sidebar.py` spostare `<w:updateFields/>` in `word/settings.xml` subito prima di `<w:compat>`, altrimenti il validatore OOXML lo rifiuta. Le schermate in `img/` si ritagliano da `npm run screenshot` (formato `largo`, 1280 px).
