# Climosfera Report UI Kit

## Overview
A high-fidelity interactive replica of Climosfera S.r.l.'s standard **technical report / document** layout.
Covers the primary document surface: printed A4-style pages with the full brand sidebar, typographic hierarchy, tables, figures, and multi-section navigation.

## Components

| Component | Description |
|---|---|
| `PageShell` | Full A4 page with sidebar, header rule, footer |
| `CoverPage` | Document cover with logo lockup, title block, meta |
| `ContentPage` | Standard content page with H2, body, bullets |
| `TablePage` | Page variant centred on a data table + caption |
| `FigurePage` | Page variant with figure placeholder + caption |
| `SidebarEl` | Right sidebar: blue line, rotated text, page number |
| `DocNav` | Left nav showing document sections; click to jump |

## Usage
Open `index.html` in a browser. The left nav lets you jump between document sections.
All components live in a single file for portability.
