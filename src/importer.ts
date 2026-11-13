import { App, TFile, TFolder, normalizePath, requestUrl } from "obsidian";
import { parseGoodreadsCsv, rowToBookVariables } from "./csvParser";
import {
  buildNoteContent,
  interpolateTemplate,
  mergeFrontmatterIntoExistingNote
} from "./frontmatterBuilder";
import { extractMetadataFromGoodreadsHtml } from "./goodreadsScraper";
import { sanitizeFileName } from "./titleUtils";
import {
  GoodreadsCsvRow,
  GoodreadsPluginSettings,
  ImportProgress,
  ImportSummary,
  ScrapedBookMetadata
} from "./types";

const GOODREADS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function ensureFolderExists(
  app: App,
  folderPath: string
): Promise<void> {
  const normalized = normalizePath(folderPath.trim());
  if (!normalized || normalized === "/") {
    return;
  }

  const parts = normalized.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      await app.vault.createFolder(current);
    }
  }
}

async function fetchGoodreadsMetadata(
  bookId: string
): Promise<ScrapedBookMetadata> {
  const url = `https://www.goodreads.com/book/show/${encodeURIComponent(bookId)}`;
  const response = await requestUrl({
    url,
    method: "GET",
    headers: GOODREADS_HEADERS,
    throw: false
  });

  if (response.status < 200 || response.status >= 400 || !response.text) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  return extractMetadataFromGoodreadsHtml(response.text, bookId);
}

async function downloadCoverIfMissing(
  app: App,
  coverUrl: string,
  coverPath: string
): Promise<boolean> {
  if (!coverUrl) {
    return false;
  }
  const normalizedCoverPath = normalizePath(coverPath);
  const existing = app.vault.getAbstractFileByPath(normalizedCoverPath);
  if (existing) {
    return false;
  }

  const response = await requestUrl({
    url: coverUrl,
    method: "GET",
    headers: {
      "User-Agent": GOODREADS_HEADERS["User-Agent"]
    },
    throw: false
  });

  if (
    response.status < 200 ||
    response.status >= 400 ||
    !response.arrayBuffer ||
    response.arrayBuffer.byteLength === 0
  ) {
    throw new Error(`Failed to download cover (${response.status})`);
  }

  await app.vault.createBinary(normalizedCoverPath, response.arrayBuffer);
  return true;
}

export interface ImportOptions {
  shelfFilter?: string;
  onProgress?: (progress: ImportProgress) => void;
  signal?: AbortSignal;
}

export function filterRowsByShelf(
  rows: GoodreadsCsvRow[],
  shelfFilter?: string
): GoodreadsCsvRow[] {
  const filter = shelfFilter?.trim();
  if (!filter || filter === "__all__") {
    return rows;
  }
  return rows.filter((row) => {
    const shelves = row.bookshelves
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      shelves.includes(filter) || row.exclusiveShelf.trim() === filter
    );
  });
}

async function buildExistingBookIndex(
  app: App,
  notesFolder: string
): Promise<Map<string, TFile>> {
  const index = new Map<string, TFile>();
  const targetFolder =
    !notesFolder || notesFolder === "/"
      ? app.vault.getRoot()
      : app.vault.getAbstractFileByPath(notesFolder);

  if (!(targetFolder instanceof TFolder)) {
    return index;
  }

  for (const child of targetFolder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") {
      continue;
    }

    const frontmatter = app.metadataCache.getFileCache(child)?.frontmatter as
      | Record<string, unknown>
      | undefined;
    const cachedId = frontmatter?.id;
    if (typeof cachedId === "string" || typeof cachedId === "number") {
      const trimmedId = String(cachedId).trim();
      if (trimmedId) {
        index.set(trimmedId, child);
        continue;
      }
    }

    try {
      const content = await app.vault.cachedRead(child);
      const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      if (fmMatch) {
        const idMatch = /^id:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(fmMatch[1]);
        if (idMatch?.[1]) {
          index.set(idMatch[1].trim(), child);
        }
      }
    } catch {
      // ignore unreadable file
    }
  }

  return index;
}

export async function importGoodreadsCsv(
  app: App,
  csvText: string,
  settings: GoodreadsPluginSettings,
  options: ImportOptions = {}
): Promise<ImportSummary> {
  const allRows = parseGoodreadsCsv(csvText);
  const rows = filterRowsByShelf(allRows, options.shelfFilter);

  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    coversDownloaded: 0,
    errors: [],
    cancelled: false
  };

  if (rows.length === 0) {
    return summary;
  }

  const notesFolder = normalizePath(settings.notesFolder.trim());
  const coversFolder = normalizePath(settings.coversFolder.trim());

  await ensureFolderExists(app, notesFolder);
  if (settings.fetchFromGoodreads) {
    await ensureFolderExists(app, coversFolder);
  }

  const existingById = await buildExistingBookIndex(app, notesFolder);

  for (let i = 0; i < rows.length; i++) {
    if (options.signal?.aborted) {
      summary.cancelled = true;
      break;
    }

    const row = rows[i];
    const baseVars = rowToBookVariables(row, settings);
    const rawFileName = interpolateTemplate(
      settings.fileNameTemplate || "{{shortTitle}}",
      baseVars
    );
    const safeFileName =
      sanitizeFileName(rawFileName) || `goodreads-${baseVars.id || i + 1}`;
    const notePath = normalizePath(
      notesFolder ? `${notesFolder}/${safeFileName}.md` : `${safeFileName}.md`
    );

    options.onProgress?.({
      current: i + 1,
      total: rows.length,
      title: baseVars.cleanTitle || baseVars.rawTitle,
      status: "Processing..."
    });

    const existingFile =
      (baseVars.id ? existingById.get(baseVars.id) : undefined) ??
      app.vault.getAbstractFileByPath(notePath);
    if (existingFile && settings.existingNoteBehavior === "skip") {
      summary.skipped++;
      continue;
    }

    let scraped: ScrapedBookMetadata = { description: "", coverUrl: "" };
    let didNetworkRequest = false;

    if (settings.fetchFromGoodreads && baseVars.id) {
      try {
        options.onProgress?.({
          current: i + 1,
          total: rows.length,
          title: baseVars.cleanTitle || baseVars.rawTitle,
          status: "Fetching synopsis and cover from Goodreads..."
        });
        scraped = await fetchGoodreadsMetadata(baseVars.id);
        didNetworkRequest = true;

        if (scraped.coverUrl) {
          const downloaded = await downloadCoverIfMissing(
            app,
            scraped.coverUrl,
            baseVars.coverPath
          );
          if (downloaded) {
            summary.coversDownloaded++;
          }
        }
      } catch (err) {
        summary.errors.push({
          bookId: baseVars.id,
          title: baseVars.cleanTitle || baseVars.rawTitle,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }

    try {
      const fullVars = rowToBookVariables(row, settings, scraped);
      const newNoteContent = buildNoteContent(fullVars, settings);

      if (existingFile instanceof TFile) {
        if (settings.existingNoteBehavior === "overwrite") {
          await app.vault.modify(existingFile, newNoteContent);
          summary.updated++;
        } else {
          const currentContent = await app.vault.read(existingFile);
          const merged = mergeFrontmatterIntoExistingNote(
            currentContent,
            newNoteContent
          );
          await app.vault.modify(existingFile, merged);
          summary.updated++;
        }
      } else if (!existingFile) {
        await app.vault.create(notePath, newNoteContent);
        summary.created++;
      } else {
        summary.skipped++;
      }
    } catch (err) {
      summary.errors.push({
        bookId: baseVars.id,
        title: baseVars.cleanTitle || baseVars.rawTitle,
        message: err instanceof Error ? err.message : String(err)
      });
    }

    if (
      didNetworkRequest &&
      settings.requestDelayMs > 0 &&
      i < rows.length - 1 &&
      !options.signal?.aborted
    ) {
      await sleep(settings.requestDelayMs);
    }
  }

  return summary;
}
