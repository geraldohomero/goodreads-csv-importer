import {
  BookVariables,
  GoodreadsCsvRow,
  GoodreadsPluginSettings,
  ScrapedBookMetadata
} from "./types";
import { extractCleanTitle, extractShortTitle } from "./titleUtils";

const HEADER_MAP: Record<string, keyof GoodreadsCsvRow> = {
  "book id": "bookId",
  "title": "title",
  "author": "author",
  "author l-f": "authorLF",
  "additional authors": "additionalAuthors",
  "isbn": "isbn",
  "isbn13": "isbn13",
  "my rating": "myRating",
  "publisher": "publisher",
  "binding": "binding",
  "number of pages": "numberOfPages",
  "year published": "yearPublished",
  "original publication year": "originalPublicationYear",
  "date read": "dateRead",
  "date added": "dateAdded",
  "bookshelves": "bookshelves",
  "bookshelves with positions": "bookshelvesWithPositions",
  "exclusive shelf": "exclusiveShelf",
  "my review": "myReview",
  "spoiler": "spoiler",
  "private notes": "privateNotes",
  "read count": "readCount",
  "owned copies": "ownedCopies"
};

/**
 * Parses RFC 4180 CSV text into a 2D array of string cells, handling quoted fields,
 * escaped quotes (`""`), commas inside quotes, and multiline quoted values.
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentCell);
      currentCell = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else if (ch === "\n") {
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Strips Excel formula wrappers used by Goodreads exports for ISBNs,
 * e.g. `="6581339180"` -> `"6581339180"` and `=""` -> `""`.
 */
export function cleanExcelWrapper(value: string): string {
  const trimmed = value.trim();
  const match = /^="(.*)"$/.exec(trimmed);
  if (match) {
    return match[1].trim();
  }
  if (trimmed === '=""' || trimmed === "=") {
    return "";
  }
  return trimmed;
}

export function normalizeAuthor(author: string): string {
  return author.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes Goodreads date strings (`YYYY/MM/DD` or `YYYY-MM-DD`) to `YYYY-MM-DD`.
 */
export function normalizeGoodreadsDate(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return "";
  }
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function deriveDatePublished(
  originalYear: string,
  yearPublished: string
): string {
  const year = (originalYear || yearPublished).trim();
  if (!year) {
    return "";
  }
  if (/^\d{4}$/.test(year)) {
    return `${year}-01-01`;
  }
  return year;
}

export function normalizeRating(rating: string): string {
  const trimmed = rating.trim();
  if (!trimmed) {
    return "0";
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return trimmed;
  }
  return String(Math.round(num));
}

export function parseShelves(
  bookshelves: string,
  exclusiveShelf: string,
  ignoredShelves: string | string[] = []
): string[] {
  const ignoredSet = new Set(
    (Array.isArray(ignoredShelves)
      ? ignoredShelves
      : ignoredShelves.split(",")
    )
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const result: string[] = [];
  const seen = new Set<string>();

  const addShelf = (raw: string) => {
    const shelf = raw.trim();
    if (!shelf) return;
    const lower = shelf.toLowerCase();
    if (ignoredSet.has(lower) || seen.has(lower)) return;
    seen.add(lower);
    result.push(shelf);
  };

  for (const raw of bookshelves.split(",")) {
    addShelf(raw);
  }

  addShelf(exclusiveShelf);

  return result.sort((a, b) => a.localeCompare(b));
}

/**
 * Parses a Goodreads CSV export string into typed `GoodreadsCsvRow` objects.
 */
export function parseGoodreadsCsv(csvText: string): GoodreadsCsvRow[] {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return [];
  }

  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const rows: GoodreadsCsvRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const row: GoodreadsCsvRow = {
      bookId: "",
      title: "",
      author: "",
      authorLF: "",
      additionalAuthors: "",
      isbn: "",
      isbn13: "",
      myRating: "",
      publisher: "",
      binding: "",
      numberOfPages: "",
      yearPublished: "",
      originalPublicationYear: "",
      dateRead: "",
      dateAdded: "",
      bookshelves: "",
      bookshelvesWithPositions: "",
      exclusiveShelf: "",
      myReview: "",
      spoiler: "",
      privateNotes: "",
      readCount: "",
      ownedCopies: ""
    };

    for (let c = 0; c < headers.length; c++) {
      const key = HEADER_MAP[headers[c]];
      if (key) {
        row[key] = (cells[c] ?? "").trim();
      }
    }

    if (row.bookId || row.title) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "");
}

/**
 * Converts a parsed CSV row + plugin settings (+ optional scraped metadata)
 * into the `BookVariables` dictionary used for template interpolation.
 */
export function rowToBookVariables(
  row: GoodreadsCsvRow,
  settings: Pick<GoodreadsPluginSettings, "notesFolder" | "coversFolder"> & {
    ignoredShelves?: string;
  },
  scraped?: Partial<ScrapedBookMetadata>
): BookVariables {
  const id = row.bookId.trim();
  const rawTitle = row.title.trim();
  const cleanTitle = extractCleanTitle(rawTitle);
  const shortTitle = extractShortTitle(rawTitle);
  const notesFolder = normalizeFolder(settings.notesFolder);
  const coversFolder = normalizeFolder(settings.coversFolder);
  const coverPath = coversFolder ? `${coversFolder}/${id}.jpg` : `${id}.jpg`;

  return {
    id,
    rawTitle,
    cleanTitle,
    shortTitle,
    author: normalizeAuthor(row.author),
    authorLF: row.authorLF.trim(),
    additionalAuthors: row.additionalAuthors.trim(),
    rating: normalizeRating(row.myRating),
    shelves: parseShelves(
      row.bookshelves,
      row.exclusiveShelf,
      settings.ignoredShelves ?? ""
    ),
    exclusiveShelf: row.exclusiveShelf.trim(),
    isbn: cleanExcelWrapper(row.isbn),
    isbn13: cleanExcelWrapper(row.isbn13),
    datePublished: deriveDatePublished(
      row.originalPublicationYear,
      row.yearPublished
    ),
    yearPublished: row.yearPublished.trim(),
    originalYear: row.originalPublicationYear.trim(),
    dateRead: normalizeGoodreadsDate(row.dateRead),
    dateAdded: normalizeGoodreadsDate(row.dateAdded),
    publisher: row.publisher.trim(),
    binding: row.binding.trim(),
    pages: row.numberOfPages.trim(),
    bookPage: `https://www.goodreads.com/book/show/${id}`,
    coverPath,
    notesFolder,
    coversFolder,
    description: (scraped?.description ?? "").trim(),
    myReview: row.myReview.trim(),
    spoiler: row.spoiler.trim(),
    privateNotes: row.privateNotes.trim(),
    readCount: row.readCount.trim(),
    ownedCopies: row.ownedCopies.trim()
  };
}
