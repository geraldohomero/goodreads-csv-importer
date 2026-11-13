export interface GoodreadsCsvRow {
  bookId: string;
  title: string;
  author: string;
  authorLF: string;
  additionalAuthors: string;
  isbn: string;
  isbn13: string;
  myRating: string;
  publisher: string;
  binding: string;
  numberOfPages: string;
  yearPublished: string;
  originalPublicationYear: string;
  dateRead: string;
  dateAdded: string;
  bookshelves: string;
  bookshelvesWithPositions: string;
  exclusiveShelf: string;
  myReview: string;
  spoiler: string;
  privateNotes: string;
  readCount: string;
  ownedCopies: string;
}

export interface BookVariables {
  id: string;
  rawTitle: string;
  cleanTitle: string;
  shortTitle: string;
  author: string;
  authorLF: string;
  additionalAuthors: string;
  rating: string;
  shelves: string[];
  exclusiveShelf: string;
  isbn: string;
  isbn13: string;
  datePublished: string;
  yearPublished: string;
  originalYear: string;
  dateRead: string;
  dateAdded: string;
  publisher: string;
  binding: string;
  pages: string;
  bookPage: string;
  coverPath: string;
  notesFolder: string;
  coversFolder: string;
  description: string;
  myReview: string;
  spoiler: string;
  privateNotes: string;
  readCount: string;
  ownedCopies: string;
}

export type FrontmatterFieldFormat =
  | "single-quoted"
  | "plain"
  | "list"
  | "block-scalar";

export interface FrontmatterFieldConfig {
  id: string;
  key: string;
  template: string;
  format: FrontmatterFieldFormat;
  enabled: boolean;
}

export type ExistingNoteBehavior =
  | "update-frontmatter"
  | "skip"
  | "overwrite";

export interface GoodreadsPluginSettings {
  notesFolder: string;
  coversFolder: string;
  fileNameTemplate: string;
  defaultShelfFilter: string;
  ignoredShelves: string;
  existingNoteBehavior: ExistingNoteBehavior;
  fetchFromGoodreads: boolean;
  requestDelayMs: number;
  frontmatterFields: FrontmatterFieldConfig[];
  bodyTemplate: string;
}

export interface ScrapedBookMetadata {
  description: string;
  coverUrl: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  title: string;
  status: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  coversDownloaded: number;
  errors: Array<{ bookId: string; title: string; message: string }>;
  cancelled: boolean;
}
