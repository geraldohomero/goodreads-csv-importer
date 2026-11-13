# Goodreads CSV Importer

**AI:W** - Based on the [0rwx](https://0rwx.com/) Framework

Import Goodreads library exports (`.csv`) directly into your Obsidian vault as Markdown notes with customizable YAML frontmatter, book synopses, and local cover images.

> The end of the Goodreads RSS feed made me do this plugin. Also, [Booksidian](https://github.com/MichaBrugger/booksidian_plugin) was a great inspiration for the frontmatter builder and the workflow itself. I used to use Booksidian, but the end of the RSS feed made it impossible to keep my reading notes in sync with Goodreads. This plugin is a replacement for my workflow, and I hope it helps you too in some way. 

## Features

- **CSV Export Import:** Select a `.csv` file from your vault, pick one from your computer, or drag and drop `goodreads_library_export.csv` into the import modal.
- **Cover & Synopsis Fetching:** Optionally fetches the book's Goodreads page (`https://www.goodreads.com/book/show/{id}`) to download the cover image (`<id>.jpg`) and convert the synopsis into clean Markdown.
- **Customizable Frontmatter Builder:** Configure which YAML properties are generated, rename keys, reorder fields, pick YAML formatting (`'single-quoted'`, `plain`, `list`, `block-scalar`), edit value templates with `{{variables}}`, and preview the generated note live in plugin settings.
- **Body Template & Safe Updates:** Define a custom body template (default: `> #goodreads`) and choose whether existing notes should be skipped, completely overwritten, or have **only their frontmatter updated** (matching by Goodreads `id` or filename while preserving your reading notes).
- **Shelf Filtering & Exclusion:** Filter which shelf to import (or import all shelves), combine `Bookshelves` and `Exclusive Shelf` (`read`, `currently-reading`, `to-read`) alphabetically, and optionally ignore specific shelves from frontmatter.

## Available Template Variables

| Variable | Description |
| --- | --- |
| `{{id}}` | Goodreads Book Id |
| `{{rawTitle}}` | Original title from CSV |
| `{{cleanTitle}}` | Clean title without trailing series/edition parentheses or `:` |
| `{{shortTitle}}` | Short title before `:` (falls back to `{{cleanTitle}}`) |
| `{{author}}` | Primary author |
| `{{authorLF}}` | Author (`Last, First`) |
| `{{additionalAuthors}}` | Additional authors / translators |
| `{{rating}}` | Rounded rating (`0`–`5`) |
| `{{shelves}}` | Sorted list of shelves (`Bookshelves` + `Exclusive Shelf`) |
| `{{exclusiveShelf}}` | Exclusive shelf (`read`, `currently-reading`, `to-read`, etc.) |
| `{{isbn}}` / `{{isbn13}}` | Cleaned ISBN-10 / ISBN-13 |
| `{{datePublished}}` | Original publication year formatted as `YYYY-01-01` |
| `{{yearPublished}}` / `{{originalYear}}` | Edition year / Original publication year |
| `{{dateRead}}` / `{{dateAdded}}` | Dates normalized to `YYYY-MM-DD` |
| `{{publisher}}` / `{{binding}}` / `{{pages}}` | Edition details |
| `{{bookPage}}` | `https://www.goodreads.com/book/show/{{id}}` |
| `{{coverPath}}` | Vault path to the downloaded cover (`<coversFolder>/<id>.jpg`) |
| `{{notesFolder}}` / `{{coversFolder}}` | Configured destination folders |
| `{{description}}` | Book synopsis in Markdown |
| `{{myReview}}` / `{{privateNotes}}` | User review and private notes from CSV |
| `{{readCount}}` / `{{ownedCopies}}` | Read count and owned copies |

## Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them into `<your-vault>/.obsidian/plugins/goodreads-csv-importer/`.
3. Enable **Goodreads CSV Importer** in Obsidian **Settings → Community plugins**.

### Development
```bash
npm install
npm test
npm run build
```

Import Goodreads library exports (`.csv`) directly into your Obsidian vault as Markdown notes with customizable YAML frontmatter, book synopses, and local cover images.

## Features

- **CSV Export Import:** Select a `.csv` file from your vault, pick one from your computer, or drag and drop `goodreads_library_export.csv` into the import modal.
- **Cover & Synopsis Fetching:** Optionally fetches the book's Goodreads page (`https://www.goodreads.com/book/show/{id}`) to download the cover image (`<id>.jpg`) and convert the synopsis into clean Markdown.
- **Customizable Frontmatter Builder:** Configure which YAML properties are generated, rename keys, reorder fields, pick YAML formatting (`'single-quoted'`, `plain`, `list`, `block-scalar`), edit value templates with `{{variables}}`, and preview the generated note live in plugin settings.
- **Body Template & Safe Updates:** Define a custom body template (default: `> #goodreads`) and choose whether existing notes should be skipped, completely overwritten, or have **only their frontmatter updated** (matching by Goodreads `id` or filename while preserving your reading notes).
- **Shelf Filtering & Exclusion:** Filter which shelf to import (or import all shelves), combine `Bookshelves` and `Exclusive Shelf` (`read`, `currently-reading`, `to-read`) alphabetically, and optionally ignore specific shelves from frontmatter.

## Available Template Variables

| Variable | Description |
| --- | --- |
| `{{id}}` | Goodreads Book Id |
| `{{rawTitle}}` | Original title from CSV |
| `{{cleanTitle}}` | Clean title without trailing series/edition parentheses or `:` |
| `{{shortTitle}}` | Short title before `:` (falls back to `{{cleanTitle}}`) |
| `{{author}}` | Primary author |
| `{{authorLF}}` | Author (`Last, First`) |
| `{{additionalAuthors}}` | Additional authors / translators |
| `{{rating}}` | Rounded rating (`0`–`5`) |
| `{{shelves}}` | Sorted list of shelves (`Bookshelves` + `Exclusive Shelf`) |
| `{{exclusiveShelf}}` | Exclusive shelf (`read`, `currently-reading`, `to-read`, etc.) |
| `{{isbn}}` / `{{isbn13}}` | Cleaned ISBN-10 / ISBN-13 |
| `{{datePublished}}` | Original publication year formatted as `YYYY-01-01` |
| `{{yearPublished}}` / `{{originalYear}}` | Edition year / Original publication year |
| `{{dateRead}}` / `{{dateAdded}}` | Dates normalized to `YYYY-MM-DD` |
| `{{publisher}}` / `{{binding}}` / `{{pages}}` | Edition details |
| `{{bookPage}}` | `https://www.goodreads.com/book/show/{{id}}` |
| `{{coverPath}}` | Vault path to the downloaded cover (`<coversFolder>/<id>.jpg`) |
| `{{notesFolder}}` / `{{coversFolder}}` | Configured destination folders |
| `{{description}}` | Book synopsis in Markdown |
| `{{myReview}}` / `{{privateNotes}}` | User review and private notes from CSV |
| `{{readCount}}` / `{{ownedCopies}}` | Read count and owned copies |

## Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them into `<your-vault>/.obsidian/plugins/goodreads-csv-importer/`.
3. Enable **Goodreads CSV Importer** in Obsidian **Settings → Community plugins**.

### Development
```bash
npm install
npm test
npm run build
```
