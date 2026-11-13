import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { parseGoodreadsCsv, rowToBookVariables } from "../src/csvParser";
import { DEFAULT_SETTINGS } from "../src/defaults";
import {
  buildNoteContent,
  mergeFrontmatterIntoExistingNote
} from "../src/frontmatterBuilder";

describe("frontmatterBuilder", () => {
  it("builds Mistborn note matching user specification structure and values", () => {
    const csvPath = resolve(__dirname, "../goodreads_library_export.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    const rows = parseGoodreadsCsv(csvContent);
    const mistborn = rows.find((r) => r.bookId === "233793129")!;

    const vars = rowToBookVariables(mistborn, DEFAULT_SETTINGS, {
      description: [
        "**AS BRUMAS DOMINAM A NOITE. O SENHOR SOBERANO DOMINA O MUNDO.**",
        "",
        "Certa vez, um herói surgiu para salvar o mundo. Ele fracassou.",
        "",
        "Desde então, o mundo tem sido um deserto de cinzas e névoa, governado pelo imortal conhecido como Senhor Soberano.",
        "",
        "A esperança, porém, persiste. Uma nova revolta está se formando por meio de um grande golpe, um brilhante gênio do crime e a coragem de uma heroína improvável: uma jovem das ruas que precisa aprender a dominar o poder de uma Nascida da Bruma."
      ].join("\n")
    });

    const output = buildNoteContent(vars, DEFAULT_SETTINGS);

    expect(output).toContain("author: '[[Brandon Sanderson]]'");
    expect(output).toContain("rating: '0'");
    expect(output).toContain("fullTitle: Mistborn O Império Final");
    expect(output).toContain("id: '233793129'");
    expect(output).toContain("shelves:\n  - currently-reading\n  - literature");
    expect(output).toContain(
      "coverImage: '[[Books/Covers/233793129.jpg]]'"
    );
    expect(output).toContain("isbn: '6581339180'");
    expect(output).toContain("datePublished: '2006-01-01'");
    expect(output).toContain("title: 'Mistborn'");
    expect(output).toContain(
      "bookPage: https://www.goodreads.com/book/show/233793129"
    );
    expect(output).toContain(
      "description: >-\n  **AS BRUMAS DOMINAM A NOITE. O SENHOR SOBERANO DOMINA O MUNDO.**"
    );
    expect(output).toContain("dateRead: ''");
    expect(output.trimEnd().endsWith("---\n\n> #goodreads")).toBe(true);
  });

  it("supports customized folder paths and title wikilink templates", () => {
    const csvPath = resolve(__dirname, "../goodreads_library_export.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    const rows = parseGoodreadsCsv(csvContent);
    const mistborn = rows.find((r) => r.bookId === "233793129")!;

    const customSettings = {
      ...DEFAULT_SETTINGS,
      notesFolder: "3.Resources/Literatura",
      coversFolder: "3.Resources/Literatura/Capas",
      frontmatterFields: DEFAULT_SETTINGS.frontmatterFields.map((f) =>
        f.id === "field-title"
          ? { ...f, template: "[[{{notesFolder}}/Notas/{{shortTitle}} - Nota|Nota]]" }
          : { ...f }
      )
    };

    const vars = rowToBookVariables(mistborn, customSettings);
    const output = buildNoteContent(vars, customSettings);
    expect(output).toContain(
      "coverImage: '[[3.Resources/Literatura/Capas/233793129.jpg]]'"
    );
    expect(output).toContain(
      "title: '[[3.Resources/Literatura/Notas/Mistborn - Nota|Nota]]'"
    );
  });

  it("quotes pure numeric plain properties such as 1984", () => {
    const csvPath = resolve(__dirname, "../goodreads_library_export.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    const rows = parseGoodreadsCsv(csvContent);
    const book1984 = rows.find((r) => r.bookId === "2747979")!;
    const vars = rowToBookVariables(book1984, DEFAULT_SETTINGS);

    const output = buildNoteContent(vars, DEFAULT_SETTINGS);
    expect(output).toContain("fullTitle: '1984'");
    expect(output).toContain("rating: '4'");
    expect(output).toContain("shelves:\n  - literature\n  - owned\n  - read");
  });

  it("escapes single quotes in single-quoted YAML values", () => {
    const csvPath = resolve(__dirname, "../goodreads_library_export.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    const rows = parseGoodreadsCsv(csvContent);
    const first = rows[0];
    const vars = rowToBookVariables(first, DEFAULT_SETTINGS);
    vars.author = "O'Connor";

    const output = buildNoteContent(vars, DEFAULT_SETTINGS);
    expect(output).toContain("author: '[[O''Connor]]'");
  });

  it("updates only frontmatter while preserving existing body content", () => {
    const existingNote = [
      "---",
      "author: '[[Antigo]]'",
      "rating: '0'",
      "---",
      "",
      "> #goodreads",
      "",
      "## Minhas anotações de leitura",
      "Capítulo 1 muito bom!"
    ].join("\n");

    const newNote = [
      "---",
      "author: '[[Brandon Sanderson]]'",
      "rating: '5.0'",
      "---",
      "",
      "> #goodreads",
      ""
    ].join("\n");

    const merged = mergeFrontmatterIntoExistingNote(existingNote, newNote);
    expect(merged).toContain("author: '[[Brandon Sanderson]]'");
    expect(merged).toContain("rating: '5.0'");
    expect(merged).toContain("## Minhas anotações de leitura");
    expect(merged).toContain("Capítulo 1 muito bom!");
    expect(merged).not.toContain("Antigo");
  });
});
