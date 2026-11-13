/**
 * Removes trailing parenthetical series/edition annotations from a Goodreads title,
 * e.g. "Mistborn: O Império Final (Mistborn, #1)" -> "Mistborn: O Império Final".
 */
export function stripSeriesAndEditionParens(rawTitle: string): string {
  let result = rawTitle.trim();
  // Repeatedly strip trailing "(...)" groups such as "(Mistborn, #1)" or "(Portuguese Edition)"
  while (/\s*\([^()]*\)\s*$/.test(result)) {
    const stripped = result.replace(/\s*\([^()]*\)\s*$/, "").trim();
    if (!stripped) {
      break;
    }
    result = stripped;
  }
  return result;
}

/**
 * Produces a clean title suitable for Obsidian filenames and `fullTitle`,
 * stripping trailing series/edition parentheses and invalid filename characters (including `:`).
 * Example: "Mistborn: O Império Final (Mistborn, #1)" -> "Mistborn O Império Final"
 */
export function extractCleanTitle(rawTitle: string): string {
  const withoutParens = stripSeriesAndEditionParens(rawTitle);
  return withoutParens
    .replace(/[:\\/*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the short title (the part before the first `:` after stripping trailing parentheses).
 * Falls back to `extractCleanTitle` when there is no `:`.
 * Example: "Mistborn: O Império Final (Mistborn, #1)" -> "Mistborn"
 */
export function extractShortTitle(rawTitle: string): string {
  const withoutParens = stripSeriesAndEditionParens(rawTitle);
  const colonIndex = withoutParens.indexOf(":");
  const base = colonIndex > 0 ? withoutParens.slice(0, colonIndex) : withoutParens;
  return base
    .replace(/[:\\/*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitizes an arbitrary string so it is a safe Obsidian markdown filename (without extension).
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
}
