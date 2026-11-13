import { ScrapedBookMetadata } from "./types";

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "..."
};

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(
      /&(?:amp|lt|gt|quot|#39|#x27|apos|nbsp|mdash|ndash|hellip);/g,
      (entity) => ENTITY_MAP[entity] ?? entity
    );
}

/**
 * Converts Goodreads HTML synopsis markup into clean Markdown text.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) {
    return "";
  }

  let md = html
    .replace(/\r\n/g, "\n")
    // Line breaks and paragraph boundaries
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n\n")
    .replace(/<\/?div[^>]*>/gi, "\n")
    // Bold / Strong
    .replace(/<(strong|b)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
      const trimmed = inner.trim();
      return trimmed ? `**${trimmed}**` : "";
    })
    // Italic / Emphasis
    .replace(/<(em|i)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
      const trimmed = inner.trim();
      return trimmed ? `*${trimmed}*` : "";
    })
    // Strip remaining tags
    .replace(/<[^>]+>/g, "");

  md = decodeHtmlEntities(md);

  const lines = md
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  // Collapse 3+ consecutive blank lines into a single blank line
  const normalized: string[] = [];
  let previousBlank = true;
  for (const line of lines) {
    if (line === "") {
      if (!previousBlank) {
        normalized.push("");
        previousBlank = true;
      }
    } else {
      normalized.push(line);
      previousBlank = false;
    }
  }

  while (normalized.length > 0 && normalized[normalized.length - 1] === "") {
    normalized.pop();
  }

  return normalized.join("\n");
}

function findBookObjectInApolloState(
  apolloState: Record<string, unknown>,
  bookId?: string
): { description?: string; imageUrl?: string } | null {
  const entries = Object.entries(apolloState);
  let fallbackBook: { description?: string; imageUrl?: string } | null = null;

  for (const [key, value] of entries) {
    if (!key.startsWith("Book:") || typeof value !== "object" || value === null) {
      continue;
    }
    const candidate = value as Record<string, unknown>;
    const description =
      typeof candidate.description === "string" ? candidate.description : undefined;
    const imageUrl =
      typeof candidate.imageUrl === "string" ? candidate.imageUrl : undefined;

    if (!description && !imageUrl) {
      continue;
    }

    const legacyId = candidate.legacyId != null ? String(candidate.legacyId) : "";
    if (bookId && (legacyId === bookId || key.includes(bookId))) {
      return { description, imageUrl };
    }

    if (!fallbackBook) {
      fallbackBook = { description, imageUrl };
    } else {
      fallbackBook = {
        description: fallbackBook.description || description,
        imageUrl: fallbackBook.imageUrl || imageUrl
      };
    }
  }

  return fallbackBook;
}

function extractFromNextData(
  html: string,
  bookId?: string
): Partial<ScrapedBookMetadata> {
  const scriptRegex =
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
  const match = scriptRegex.exec(html);
  if (!match) {
    return {};
  }

  try {
    const parsed = JSON.parse(match[1]) as {
      props?: { pageProps?: { apolloState?: Record<string, unknown> } };
    };
    const apolloState = parsed?.props?.pageProps?.apolloState;
    if (!apolloState || typeof apolloState !== "object") {
      return {};
    }

    const bookObj = findBookObjectInApolloState(apolloState, bookId);
    if (!bookObj) {
      return {};
    }

    return {
      description: bookObj.description ? htmlToMarkdown(bookObj.description) : "",
      coverUrl: bookObj.imageUrl ?? ""
    };
  } catch {
    return {};
  }
}

function extractFromLdJson(html: string): Partial<ScrapedBookMetadata> {
  const ldRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      if (parsed["@type"] === "Book" || typeof parsed.image === "string") {
        return {
          coverUrl: typeof parsed.image === "string" ? parsed.image : "",
          description:
            typeof parsed.description === "string"
              ? htmlToMarkdown(parsed.description)
              : ""
        };
      }
    } catch {
      // ignore malformed ld+json block
    }
  }

  return {};
}

function extractBalancedTagContent(html: string, startRegex: RegExp): string {
  const startMatch = startRegex.exec(html);
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }
  const tagMatch = /^<([a-zA-Z0-9]+)/.exec(startMatch[0]);
  const tagName = tagMatch ? tagMatch[1].toLowerCase() : "div";
  const contentStart = startMatch.index + startMatch[0].length;
  const tagPattern = new RegExp(`<(/?)${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = contentStart;

  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(html)) !== null) {
    if (m[1] === "/") {
      depth--;
      if (depth === 0) {
        return html.slice(contentStart, m.index);
      }
    } else {
      depth++;
    }
  }
  return "";
}

function extractFromDomFallback(html: string): Partial<ScrapedBookMetadata> {
  let coverUrl = "";
  let description = "";

  const ogImageMatch =
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(
      html
    ) ||
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i.exec(
      html
    );

  if (ogImageMatch) {
    coverUrl = decodeHtmlEntities(ogImageMatch[1]);
  }

  if (!coverUrl) {
    const coverImgMatch =
      /<img[^>]*class=["'][^"']*ResponsiveImage[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/i.exec(
        html
      );
    if (coverImgMatch) {
      coverUrl = decodeHtmlEntities(coverImgMatch[1]);
    }
  }

  // Try description container via balanced tag extraction
  const descRaw =
    extractBalancedTagContent(
      html,
      /<div[^>]*data-testid=["']description["'][^>]*>/i
    ) ||
    extractBalancedTagContent(
      html,
      /<div[^>]*class=["'][^"']*BookPageMetadataSection__description[^"']*["'][^>]*>/i
    ) ||
    extractBalancedTagContent(
      html,
      /<span[^>]*class=["'][^"']*Formatted[^"']*["'][^>]*>/i
    );

  if (descRaw) {
    description = htmlToMarkdown(descRaw);
  }

  return { description, coverUrl };
}

/**
 * Extracts book synopsis (as Markdown) and cover image URL from a Goodreads book HTML page.
 * Layer 1: `__NEXT_DATA__` Apollo state JSON.
 * Layer 2: `application/ld+json` and HTML DOM selectors fallback.
 */
export function extractMetadataFromGoodreadsHtml(
  html: string,
  bookId?: string
): ScrapedBookMetadata {
  const nextData = extractFromNextData(html, bookId);
  const ldJson =
    !nextData.description || !nextData.coverUrl ? extractFromLdJson(html) : {};
  const dom =
    !nextData.description && !ldJson.description
      ? extractFromDomFallback(html)
      : !nextData.coverUrl && !ldJson.coverUrl
      ? extractFromDomFallback(html)
      : {};

  return {
    description:
      nextData.description || dom.description || ldJson.description || "",
    coverUrl: nextData.coverUrl || ldJson.coverUrl || dom.coverUrl || ""
  };
}
