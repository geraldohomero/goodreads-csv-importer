import { App, Modal, Notice, Setting } from "obsidian";
import { parseGoodreadsCsv } from "../csvParser";
import { filterRowsByShelf, importGoodreadsCsv } from "../importer";
import type GoodreadsImporterPlugin from "../main";
import { ImportSummary } from "../types";

export class GoodreadsImportModal extends Modal {
  plugin: GoodreadsImporterPlugin;

  private csvContent = "";
  private csvSourceLabel = "";
  private selectedShelf = "__all__";
  private isImporting = false;
  private abortController: AbortController | null = null;

  private statusInfoEl: HTMLElement | null = null;
  private shelfSelectEl: HTMLSelectElement | null = null;
  private startBtnEl: HTMLButtonElement | null = null;
  private cancelBtnEl: HTMLButtonElement | null = null;
  private progressWrapperEl: HTMLElement | null = null;
  private progressBarEl: HTMLProgressElement | null = null;
  private progressTextEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;

  constructor(app: App, plugin: GoodreadsImporterPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("goodreads-import-modal");
    this.titleEl.setText("Import Goodreads CSV");

    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `Notes will be saved to "${this.plugin.settings.notesFolder || "(vault root)"}" and covers to "${this.plugin.settings.coversFolder || "(vault root)"}".`
    });

    // Pick a .csv file from the computer (real DOM file input + drag-and-drop)
    const localFileSetting = new Setting(contentEl)
      .setName("CSV file from computer")
      .setDesc("Select or drop your goodreads_library_export.csv file.");

    const fileLabel = localFileSetting.controlEl.createEl("label", {
      cls: "goodreads-file-picker-btn mod-cta"
    });
    fileLabel.createSpan({ text: "Choose .csv file" });

    const fileInput = fileLabel.createEl("input", {
      type: "file",
      cls: "goodreads-file-input"
    });
    fileInput.accept = ".csv,text/csv";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const text = await file.text();
          this.loadCsvText(text, file.name);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          new Notice(`Failed to read CSV file: ${message}`);
        } finally {
          fileInput.value = "";
        }
      })();
    });

    const dropZone = contentEl.createDiv({
      cls: "goodreads-dropzone",
      text: "Or drag and drop your .csv file here"
    });
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.addClass("is-dragover");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.removeClass("is-dragover");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.removeClass("is-dragover");
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const text = await file.text();
          this.loadCsvText(text, file.name);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          new Notice(`Failed to read CSV file: ${message}`);
        }
      })();
    });

    this.statusInfoEl = contentEl.createDiv({
      cls: "goodreads-csv-status",
      text: "No CSV file loaded yet."
    });

    // Shelf filter dropdown
    new Setting(contentEl)
      .setName("Filter by shelf (optional)")
      .setDesc("Import all books or only books belonging to a specific shelf.")
      .addDropdown((dropdown) => {
        dropdown.addOption("__all__", "All shelves");
        dropdown.onChange((value) => {
          this.selectedShelf = value;
          this.refreshCsvCountLabel();
        });
        this.shelfSelectEl = dropdown.selectEl;
      });

    // Progress bar section (hidden until start)
    this.progressWrapperEl = contentEl.createDiv({
      cls: "goodreads-progress-wrapper is-hidden"
    });
    this.progressBarEl = this.progressWrapperEl.createEl("progress", {
      cls: "goodreads-progress-bar"
    });
    this.progressTextEl = this.progressWrapperEl.createDiv({
      cls: "goodreads-progress-text"
    });

    // Summary section
    this.summaryEl = contentEl.createDiv({
      cls: "goodreads-import-summary is-hidden"
    });

    // Action buttons
    const footerEl = contentEl.createDiv({ cls: "goodreads-modal-footer" });

    const settingsBtn = footerEl.createEl("button", {
      text: "Settings"
    });
    settingsBtn.addEventListener("click", () => {
      this.close();
      // Open Obsidian settings on our plugin tab
      const settingManager = (
        this.app as unknown as {
          setting?: { open: () => void; openTabById: (id: string) => void };
        }
      ).setting;
      settingManager?.open();
      settingManager?.openTabById(this.plugin.manifest.id);
    });

    this.cancelBtnEl = footerEl.createEl("button", {
      text: "Cancel",
      cls: "is-hidden"
    });
    this.cancelBtnEl.addEventListener("click", () => {
      this.abortController?.abort();
    });

    this.startBtnEl = footerEl.createEl("button", {
      text: "Start import",
      cls: "mod-cta"
    });
    this.startBtnEl.disabled = true;
    this.startBtnEl.addEventListener("click", () => {
      void this.runImport();
    });
  }

  onClose(): void {
    this.abortController?.abort();
    this.contentEl.empty();
  }

  private loadCsvText(text: string, label: string): void {
    const rows = parseGoodreadsCsv(text);
    if (rows.length === 0) {
      new Notice("No valid books found in the selected CSV file.");
      return;
    }

    this.csvContent = text;
    this.csvSourceLabel = label;

    // Populate shelf options from loaded CSV
    const shelfSet = new Set<string>();
    for (const row of rows) {
      row.bookshelves
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => shelfSet.add(s));
      if (row.exclusiveShelf.trim()) {
        shelfSet.add(row.exclusiveShelf.trim());
      }
    }

    if (this.shelfSelectEl) {
      this.shelfSelectEl.empty();
      this.shelfSelectEl.createEl("option", {
        value: "__all__",
        text: "All shelves"
      });
      Array.from(shelfSet)
        .sort()
        .forEach((shelf) => {
          this.shelfSelectEl!.createEl("option", {
            value: shelf,
            text: shelf
          });
        });

      const preferred = this.plugin.settings.defaultShelfFilter.trim();
      if (preferred && shelfSet.has(preferred)) {
        this.selectedShelf = preferred;
        this.shelfSelectEl.value = preferred;
      } else {
        this.selectedShelf = "__all__";
        this.shelfSelectEl.value = "__all__";
      }
    }

    this.refreshCsvCountLabel();
    if (this.startBtnEl) {
      this.startBtnEl.disabled = false;
    }
  }

  private refreshCsvCountLabel(): void {
    if (!this.statusInfoEl || !this.csvContent) {
      return;
    }
    const allRows = parseGoodreadsCsv(this.csvContent);
    const filtered = filterRowsByShelf(allRows, this.selectedShelf);
    this.statusInfoEl.setText(
      `File: ${this.csvSourceLabel} — ${filtered.length} book(s) selected out of ${allRows.length} total.`
    );
  }

  private async runImport(): Promise<void> {
    if (this.isImporting || !this.csvContent) {
      return;
    }

    this.isImporting = true;
    this.abortController = new AbortController();

    if (this.startBtnEl) this.startBtnEl.disabled = true;
    this.cancelBtnEl?.removeClass("is-hidden");
    this.progressWrapperEl?.removeClass("is-hidden");
    this.summaryEl?.addClass("is-hidden");
    this.summaryEl?.empty();

    try {
      const summary = await importGoodreadsCsv(
        this.app,
        this.csvContent,
        this.plugin.settings,
        {
          shelfFilter: this.selectedShelf,
          signal: this.abortController.signal,
          onProgress: (p) => {
            if (this.progressBarEl) {
              this.progressBarEl.max = p.total;
              this.progressBarEl.value = p.current;
            }
            this.progressTextEl?.setText(
              `[${p.current}/${p.total}] ${p.title} — ${p.status}`
            );
          }
        }
      );

      this.renderSummary(summary);
      new Notice(
        summary.cancelled
          ? "Import cancelled."
          : `Import complete: ${summary.created} created, ${summary.updated} updated.`
      );
    } catch (err) {
      new Notice(
        `Import error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      this.isImporting = false;
      this.cancelBtnEl?.addClass("is-hidden");
      if (this.startBtnEl) this.startBtnEl.disabled = false;
    }
  }

  private renderSummary(summary: ImportSummary): void {
    if (!this.summaryEl) {
      return;
    }
    this.summaryEl.empty();
    this.summaryEl.removeClass("is-hidden");

    this.summaryEl.createEl("h4", {
      text: summary.cancelled ? "Import cancelled" : "Import complete"
    });

    const statsList = this.summaryEl.createEl("ul");
    statsList.createEl("li", { text: `Total processed: ${summary.total}` });
    statsList.createEl("li", { text: `Notes created: ${summary.created}` });
    statsList.createEl("li", { text: `Notes updated: ${summary.updated}` });
    statsList.createEl("li", { text: `Notes skipped: ${summary.skipped}` });
    statsList.createEl("li", {
      text: `Covers downloaded: ${summary.coversDownloaded}`
    });

    if (summary.errors.length > 0) {
      this.summaryEl.createEl("p", {
        cls: "goodreads-errors-title",
        text: `Warnings / Errors (${summary.errors.length}):`
      });
      const errList = this.summaryEl.createEl("ul", {
        cls: "goodreads-errors-list"
      });
      for (const err of summary.errors.slice(0, 15)) {
        errList.createEl("li", {
          text: `${err.title} (${err.bookId}): ${err.message}`
        });
      }
      if (summary.errors.length > 15) {
        errList.createEl("li", {
          text: `... and ${summary.errors.length - 15} more error(s).`
        });
      }
    }
  }
}
