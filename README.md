# PDF Exporter

<!-- tags:start -->
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Obsidian](https://img.shields.io/badge/Obsidian-7C3AED?logo=obsidian&logoColor=white) ![Obsidian Plugin](https://img.shields.io/badge/Obsidian%20Plugin-2F6F8F) ![PDF Export](https://img.shields.io/badge/PDF%20Export-2F6F8F)
<!-- tags:end -->

An Obsidian plugin that exports the note you're viewing as a clean, print-ready A4 PDF. I built it to turn CV notes into PDFs without leaving Obsidian.

## Features

- **Renders the note properly:** Markdown, embeds and transclusions are rendered the way Obsidian shows them, and the plugin waits for embeds to load before exporting
- **Cleans up the output:** frontmatter and `%% comments %%` are stripped
- **Print layout:** A4 pages with print styles, sensible heading and section breaks, and support for manual page breaks
- **Preview first:** opens a print preview in a sandboxed window, so you can check the layout before saving
- Ribbon button and a command: **Export active note to PDF**

## Installation

1. Download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases), or build the plugin yourself (below).
2. Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/pdf-exporter/`.
3. Enable **PDF Exporter** under **Settings → Community plugins**.

Desktop only.

## Usage

Open a note and click the **file-down** ribbon icon, or run **PDF Exporter: Export active note to PDF** from the command palette. Check the preview, then print to PDF.

## Development

```bash
npm install
npm run build   # bundles main.ts into main.js with esbuild
```

Built with TypeScript, the Obsidian plugin API and esbuild.

## Credits

Made by Alex Dickinson.

## Licence

[MIT](LICENSE)
