import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  cleanExcelWrapper,
  deriveDatePublished,
  normalizeGoodreadsDate,
  parseGoodreadsCsv,
  rowToBookVariables
} from "../src/csvParser";
import { DEFAULT_SETTINGS } from "../src/defaults";
import { extractCleanTitle, extractShortTitle } from "../src/titleUtils";

describe("titleUtils", () => {
  it("extracts cleanTitle and shortTitle for Mistborn example", () => {
    const raw = "Mistborn: O Império Final (Mistborn, #1)";
    expect(extractCleanTitle(raw)).toBe("Mistborn O Império Final");
    expect(extractShortTitle(raw)).toBe("Mistborn");
  });

  it("handles multiple trailing parenthetical annotations", () => {
    const raw = "Solo Leveling, Vol. 4 (novel) (Volume 4)";
    expect(extractCleanTitle(raw)).toBe("Solo Leveling, Vol. 4");
    expect(extractShortTitle(raw)).toBe("Solo Leveling, Vol. 4");
  });

  it("handles titles without colons or series", () => {
    const raw = "O Hobbit";
    expect(extractCleanTitle(raw)).toBe("O Hobbit");
    expect(extractShortTitle(raw)).toBe("O Hobbit");
  });
});

describe("csvParser helpers", () => {
  it("strips Excel formula wrappers from ISBN values", () => {
    expect(cleanExcelWrapper('="6581339180"')).toBe("6581339180");
    expect(cleanExcelWrapper('=""')).toBe("");
    expect(cleanExcelWrapper("9786581339180")).toBe("9786581339180");
  });

  it("normalizes Goodreads dates", () => {
    expect(normalizeGoodreadsDate("2026/09/25")).toBe("2026-09-25");
    expect(normalizeGoodreadsDate("")).toBe("");
  });

  it("derives datePublished preferring originalYear over yearPublished", () => {
    expect(deriveDatePublished("2006", "2025")).toBe("2006-01-01");
    expect(deriveDatePublished("", "2018")).toBe("2018-01-01");
    expect(deriveDatePublished("", "")).toBe("");
  });
});

describe("parseGoodreadsCsv with real export file", () => {
  const csvPath = resolve(__dirname, "../goodreads_library_export.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  const rows = parseGoodreadsCsv(csvContent);

  it("parses all 132 book rows from goodreads_library_export.csv", () => {
    expect(rows.length).toBe(132);
  });

  it("correctly parses and transforms Mistborn (Book Id 233793129)", () => {
    const mistborn = rows.find((r) => r.bookId === "233793129");
    expect(mistborn).toBeDefined();

    const vars = rowToBookVariables(mistborn!, DEFAULT_SETTINGS);
    expect(vars.id).toBe("233793129");
    expect(vars.author).toBe("Brandon Sanderson");
    expect(vars.rating).toBe("0");
    expect(vars.cleanTitle).toBe("Mistborn O Império Final");
    expect(vars.shortTitle).toBe("Mistborn");
    expect(vars.shelves).toEqual(["currently-reading", "literature"]);
    expect(vars.coverPath).toBe("Books/Covers/233793129.jpg");
    expect(vars.isbn).toBe("6581339180");
    expect(vars.isbn13).toBe("9786581339180");
    expect(vars.datePublished).toBe("2006-01-01");
    expect(vars.bookPage).toBe("https://www.goodreads.com/book/show/233793129");
    expect(vars.dateRead).toBe("");
  });

  it("handles empty ISBNs and double spaces in author names", () => {
    const stephenKing = rows.find((r) => r.bookId === "3087521");
    expect(stephenKing).toBeDefined();
    const vars = rowToBookVariables(stephenKing!, DEFAULT_SETTINGS);
    expect(vars.author).toBe("Stephen King");

    const asDuasTorres = rows.find((r) => r.bookId === "50254144");
    expect(asDuasTorres).toBeDefined();
    const vars2 = rowToBookVariables(asDuasTorres!, DEFAULT_SETTINGS);
    expect(vars2.isbn).toBe("");
    expect(vars2.isbn13).toBe("");
  });

  it("includes Exclusive Shelf (e.g. read) together with all Bookshelves, sorted alphabetically and supporting ignored shelves", () => {
    // A Batalha do Apocalipse: Bookshelves = "literature, owned", Exclusive Shelf = "read"
    const batalha = rows.find((r) => r.bookId === "2067912");
    expect(batalha).toBeDefined();
    const varsWithOwned = rowToBookVariables(batalha!, DEFAULT_SETTINGS);
    expect(varsWithOwned.shelves).toEqual(["literature", "owned", "read"]);
    expect(varsWithOwned.rating).toBe("4");

    // Ignoring "owned" via custom settings
    const varsIgnoredOwned = rowToBookVariables(batalha!, {
      ...DEFAULT_SETTINGS,
      ignoredShelves: "owned"
    });
    expect(varsIgnoredOwned.shelves).toEqual(["literature", "read"]);

    // Solo Leveling Vol 1: Bookshelves = "manhwa, literature", Exclusive Shelf = "read"
    const solo1 = rows.find((r) => r.bookId === "54896925");
    expect(solo1).toBeDefined();
    const vars2 = rowToBookVariables(solo1!, DEFAULT_SETTINGS);
    expect(vars2.shelves).toEqual(["literature", "manhwa", "read"]);
    expect(vars2.rating).toBe("4");

    // Fogo & Sangue: Bookshelves = "to-read, literature", Exclusive Shelf = "to-read"
    const fogo = rows.find((r) => r.bookId === "41962180");
    expect(fogo).toBeDefined();
    const vars3 = rowToBookVariables(fogo!, DEFAULT_SETTINGS);
    expect(vars3.shelves).toEqual(["literature", "to-read"]);
  });
});
