import {
  BookVariables,
  FrontmatterFieldConfig,
  GoodreadsPluginSettings
} from "./types";

export const DEFAULT_FRONTMATTER_FIELDS: FrontmatterFieldConfig[] = [
  {
    id: "field-author",
    key: "author",
    template: "[[{{author}}]]",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-rating",
    key: "rating",
    template: "{{rating}}",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-fullTitle",
    key: "fullTitle",
    template: "{{cleanTitle}}",
    format: "plain",
    enabled: true
  },
  {
    id: "field-id",
    key: "id",
    template: "{{id}}",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-shelves",
    key: "shelves",
    template: "{{shelves}}",
    format: "list",
    enabled: true
  },
  {
    id: "field-coverImage",
    key: "coverImage",
    template: "[[{{coverPath}}]]",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-isbn",
    key: "isbn",
    template: "{{isbn}}",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-datePublished",
    key: "datePublished",
    template: "{{datePublished}}",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-title",
    key: "title",
    template: "{{shortTitle}}",
    format: "single-quoted",
    enabled: true
  },
  {
    id: "field-bookPage",
    key: "bookPage",
    template: "https://www.goodreads.com/book/show/{{id}}",
    format: "plain",
    enabled: true
  },
  {
    id: "field-description",
    key: "description",
    template: "{{description}}",
    format: "block-scalar",
    enabled: true
  },
  {
    id: "field-dateRead",
    key: "dateRead",
    template: "{{dateRead}}",
    format: "single-quoted",
    enabled: true
  }
];

export const DEFAULT_SETTINGS: GoodreadsPluginSettings = {
  notesFolder: "Books",
  coversFolder: "Books/Covers",
  fileNameTemplate: "{{shortTitle}}",
  defaultShelfFilter: "",
  ignoredShelves: "",
  existingNoteBehavior: "update-frontmatter",
  fetchFromGoodreads: true,
  requestDelayMs: 300,
  frontmatterFields: DEFAULT_FRONTMATTER_FIELDS.map((field) => ({ ...field })),
  bodyTemplate: "> #goodreads"
};

export interface VariablePresetOption {
  label: string;
  key: string;
  template: string;
  format: FrontmatterFieldConfig["format"];
}

export const VARIABLE_PRESETS: VariablePresetOption[] = [
  { label: "ISBN-13", key: "isbn13", template: "{{isbn13}}", format: "single-quoted" },
  { label: "Publisher", key: "publisher", template: "{{publisher}}", format: "single-quoted" },
  { label: "Pages", key: "pages", template: "{{pages}}", format: "plain" },
  { label: "Binding", key: "binding", template: "{{binding}}", format: "single-quoted" },
  { label: "Additional authors", key: "additionalAuthors", template: "{{additionalAuthors}}", format: "single-quoted" },
  { label: "Date added", key: "dateAdded", template: "{{dateAdded}}", format: "single-quoted" },
  { label: "Exclusive shelf", key: "exclusiveShelf", template: "{{exclusiveShelf}}", format: "single-quoted" },
  { label: "My review", key: "myReview", template: "{{myReview}}", format: "block-scalar" },
  { label: "Private notes", key: "privateNotes", template: "{{privateNotes}}", format: "block-scalar" },
  { label: "Read count", key: "readCount", template: "{{readCount}}", format: "plain" },
  { label: "Owned copies", key: "ownedCopies", template: "{{ownedCopies}}", format: "plain" },
  { label: "Custom field", key: "customField", template: "", format: "single-quoted" }
];

export const AVAILABLE_VARIABLES_HELP: Array<{ token: string; description: string }> = [
  { token: "{{id}}", description: "Goodreads Book Id" },
  { token: "{{rawTitle}}", description: "Original full title from CSV" },
  { token: "{{cleanTitle}}", description: "Clean title without series/edition parentheses or ':'" },
  { token: "{{shortTitle}}", description: "Short title before ':' (e.g. Mistborn)" },
  { token: "{{author}}", description: "Primary author" },
  { token: "{{authorLF}}", description: "Author (Last, First)" },
  { token: "{{additionalAuthors}}", description: "Additional authors / translators" },
  { token: "{{rating}}", description: "Rounded user rating (My Rating)" },
  { token: "{{shelves}}", description: "Sorted list of shelves (Bookshelves + Exclusive Shelf)" },
  { token: "{{exclusiveShelf}}", description: "Exclusive shelf (read, currently-reading, to-read)" },
  { token: "{{isbn}}", description: "Cleaned ISBN" },
  { token: "{{isbn13}}", description: "Cleaned ISBN-13" },
  { token: "{{datePublished}}", description: "Original publication year formatted as YYYY-01-01" },
  { token: "{{yearPublished}}", description: "Edition year (Year Published)" },
  { token: "{{originalYear}}", description: "Original publication year (Original Publication Year)" },
  { token: "{{dateRead}}", description: "Date read (YYYY-MM-DD)" },
  { token: "{{dateAdded}}", description: "Date added (YYYY-MM-DD)" },
  { token: "{{publisher}}", description: "Publisher" },
  { token: "{{binding}}", description: "Format / binding (Paperback, Kindle, etc.)" },
  { token: "{{pages}}", description: "Number of pages" },
  { token: "{{bookPage}}", description: "Goodreads book page URL" },
  { token: "{{coverPath}}", description: "Full vault path to the cover image (<folder>/<id>.jpg)" },
  { token: "{{notesFolder}}", description: "Configured notes folder" },
  { token: "{{coversFolder}}", description: "Configured covers folder" },
  { token: "{{description}}", description: "Synopsis fetched from Goodreads" },
  { token: "{{myReview}}", description: "User review from CSV" },
  { token: "{{privateNotes}}", description: "Private notes from CSV" },
  { token: "{{readCount}}", description: "Read count" },
  { token: "{{ownedCopies}}", description: "Owned copies" }
];

export function createSampleVariables(
  notesFolder: string,
  coversFolder: string
): BookVariables {
  const cleanNotes = notesFolder.replace(/^\/+|\/+$/g, "");
  const cleanCovers = coversFolder.replace(/^\/+|\/+$/g, "");
  return {
    id: "233793129",
    rawTitle: "Mistborn: The Final Empire (Mistborn, #1)",
    cleanTitle: "Mistborn The Final Empire",
    shortTitle: "Mistborn",
    author: "Brandon Sanderson",
    authorLF: "Sanderson, Brandon",
    additionalAuthors: "",
    rating: "0",
    shelves: ["currently-reading", "fantasy"],
    exclusiveShelf: "currently-reading",
    isbn: "076531178X",
    isbn13: "9780765311788",
    datePublished: "2006-01-01",
    yearPublished: "2006",
    originalYear: "2006",
    dateRead: "",
    dateAdded: "2026-09-27",
    publisher: "Tor Books",
    binding: "Hardcover",
    pages: "541",
    bookPage: "https://www.goodreads.com/book/show/233793129",
    coverPath: cleanCovers ? `${cleanCovers}/233793129.jpg` : "233793129.jpg",
    notesFolder: cleanNotes,
    coversFolder: cleanCovers,
    description: [
      "**ASH FELL FROM THE SKY.**",
      "",
      "For a thousand years the ash fell and no flowers bloomed. For a thousand years the Skaa slaved in misery and lived in fear.",
      "",
      "Hope persists through a daring heist led by a brilliant crew and an unlikely street urchin discovering the power of a Mistborn."
    ].join("\n"),
    myReview: "",
    spoiler: "",
    privateNotes: "",
    readCount: "1",
    ownedCopies: "0"
  };
}
