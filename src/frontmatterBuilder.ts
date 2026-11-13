import {
  BookVariables,
  FrontmatterFieldFormat,
  GoodreadsPluginSettings
} from "./types";

const TEMPLATE_TOKEN_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

/**
 * Replaces `{{variable}}` placeholders in a template string using `BookVariables`.
 */
export function interpolateTemplate(
  template: string,
  vars: BookVariables
): string {
  return template.replace(TEMPLATE_TOKEN_REGEX, (_, token: string) => {
    if (!(token in vars)) {
      return "";
    }
    const val = vars[token as keyof BookVariables];
    if (Array.isArray(val)) {
      return val.join(", ");
    }
    return val ?? "";
  });
}

function wrapTextLine(text: string, maxWidth = 78): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (current.length + 1 + word.length <= maxWidth) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function formatBlockScalar(key: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${key}: ''`;
  }

  const paragraphs = trimmed.split(/\n\s*\n/);
  const outLines: string[] = [`${key}: >-`];

  paragraphs.forEach((paragraph, idx) => {
    const innerLines = paragraph
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const innerLine of innerLines) {
      const wrapped = wrapTextLine(innerLine, 78);
      for (const w of wrapped) {
        outLines.push(`  ${w}`);
      }
    }

    if (idx < paragraphs.length - 1) {
      outLines.push("");
    }
  });

  return outLines.join("\n");
}

function formatListProperty(
  key: string,
  rawValue: string | string[]
): string {
  const items = Array.isArray(rawValue)
    ? rawValue.map((s) => s.trim()).filter(Boolean)
    : rawValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (items.length === 0) {
    return `${key}: []`;
  }

  const formattedItems = items.map((item) => {
    // Quote items that contain YAML special chars
    if (/[:#[\]{}&*!|>'"%@`]/.test(item)) {
      return `  - '${item.replace(/'/g, "''")}'`;
    }
    return `  - ${item}`;
  });

  return `${key}:\n${formattedItems.join("\n")}`;
}

/**
 * Formats a single YAML property line/block according to its configured `FrontmatterFieldFormat`.
 */
export function formatYamlProperty(
  key: string,
  rawValue: string | string[],
  format: FrontmatterFieldFormat
): string {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return "";
  }

  if (format === "list") {
    return formatListProperty(cleanKey, rawValue);
  }

  const strValue = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;

  if (format === "block-scalar") {
    return formatBlockScalar(cleanKey, strValue);
  }

  if (format === "single-quoted") {
    const escaped = strValue.replace(/'/g, "''");
    return `${cleanKey}: '${escaped}'`;
  }

  // plain (quote pure integers/numbers like "1984" so YAML keeps them as text)
  if (!strValue) {
    return `${cleanKey}: ''`;
  }
  if (/^\d+(?:\.\d+)?$/.test(strValue)) {
    return `${cleanKey}: '${strValue}'`;
  }
  return `${cleanKey}: ${strValue}`;
}

/**
 * Resolves a field's template against `BookVariables`, preserving array values for `list` format.
 */
function resolveFieldValue(
  template: string,
  format: FrontmatterFieldFormat,
  vars: BookVariables
): string | string[] {
  if (format === "list" && template.trim() === "{{shelves}}") {
    return vars.shelves;
  }
  return interpolateTemplate(template, vars);
}

/**
 * Builds the complete Markdown note content (frontmatter + body) for a book.
 */
export function buildNoteContent(
  vars: BookVariables,
  settings: GoodreadsPluginSettings
): string {
  const yamlLines: string[] = [];

  for (const field of settings.frontmatterFields) {
    if (!field.enabled || !field.key.trim()) {
      continue;
    }
    const resolved = resolveFieldValue(field.template, field.format, vars);
    const formatted = formatYamlProperty(field.key, resolved, field.format);
    if (formatted) {
      yamlLines.push(formatted);
    }
  }

  const frontmatter = `---\n${yamlLines.join("\n")}\n---`;
  const body = interpolateTemplate(settings.bodyTemplate, vars).trimEnd();

  if (!body) {
    return `${frontmatter}\n`;
  }

  return `${frontmatter}\n\n${body}\n`;
}

/**
 * Replaces only the leading YAML frontmatter block in an existing note,
 * preserving whatever body/notes the user wrote below it.
 */
export function mergeFrontmatterIntoExistingNote(
  existingContent: string,
  newNoteContent: string
): string {
  const newFmMatch = /^---\r?\n[\s\S]*?\r?\n---/.exec(newNoteContent);
  if (!newFmMatch) {
    return newNoteContent;
  }
  const newFrontmatter = newFmMatch[0];

  const existingFmMatch = /^---\r?\n[\s\S]*?\r?\n---(\r?\n)*/.exec(
    existingContent
  );

  if (!existingFmMatch) {
    const trimmedExisting = existingContent.replace(/^\r?\n+/, "");
    return trimmedExisting
      ? `${newFrontmatter}\n\n${trimmedExisting}`
      : `${newFrontmatter}\n`;
  }

  const existingBody = existingContent.slice(existingFmMatch[0].length);
  if (!existingBody.trim()) {
    // If existing note had no body, keep new body if any
    return newNoteContent;
  }

  return `${newFrontmatter}\n\n${existingBody}`;
}
