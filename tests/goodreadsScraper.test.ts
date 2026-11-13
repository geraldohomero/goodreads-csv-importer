import { describe, expect, it } from "vitest";
import {
  extractMetadataFromGoodreadsHtml,
  htmlToMarkdown
} from "../src/goodreadsScraper";

describe("htmlToMarkdown", () => {
  it("converts bold, italic, br, and paragraphs into markdown", () => {
    const html =
      "<p><b>AS BRUMAS DOMINAM A NOITE.</b></p><p>Certa vez, um <i>herói</i> surgiu.<br />Ele fracassou.</p>";
    expect(htmlToMarkdown(html)).toBe(
      "**AS BRUMAS DOMINAM A NOITE.**\n\nCerta vez, um *herói* surgiu.\nEle fracassou."
    );
  });

  it("decodes HTML entities", () => {
    const html = "Amor &amp; Guerra &mdash; edi&ccedil;&atilde;o &#39;especial&#39;";
    expect(htmlToMarkdown(html)).toBe("Amor & Guerra — edi&ccedil;&atilde;o 'especial'");
  });
});

describe("extractMetadataFromGoodreadsHtml", () => {
  it("extracts description and coverUrl from __NEXT_DATA__ Apollo state", () => {
    const nextData = {
      props: {
        pageProps: {
          apolloState: {
            "Book:kca://book/amzn1.gr.book.v1.abc": {
              legacyId: 233793129,
              description:
                "<b>AS BRUMAS DOMINAM A NOITE.</b><br><br>Certa vez, um herói surgiu.",
              imageUrl:
                "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/12345/233793129.jpg"
            }
          }
        }
      }
    };

    const html = `
      <html>
        <head>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
            nextData
          )}</script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractMetadataFromGoodreadsHtml(html, "233793129");
    expect(result.description).toBe(
      "**AS BRUMAS DOMINAM A NOITE.**\n\nCerta vez, um herói surgiu."
    );
    expect(result.coverUrl).toBe(
      "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/12345/233793129.jpg"
    );
  });

  it("falls back to ld+json and DOM selectors when __NEXT_DATA__ is absent", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/cover.jpg" />
        </head>
        <body>
          <div data-testid="description">
            <div class="TruncatedContent">
              <span class="Formatted">Primeiro parágrafo.<br /><br />Segundo parágrafo com <strong>negrito</strong>.</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = extractMetadataFromGoodreadsHtml(html, "999");
    expect(result.coverUrl).toBe("https://example.com/cover.jpg");
    expect(result.description).toBe(
      "Primeiro parágrafo.\n\nSegundo parágrafo com **negrito**."
    );
  });
});
