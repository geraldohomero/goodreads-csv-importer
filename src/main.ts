import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./defaults";
import { GoodreadsPluginSettings } from "./types";
import { GoodreadsImportModal } from "./ui/importModal";
import { GoodreadsSettingTab } from "./ui/settingsTab";

export default class GoodreadsImporterPlugin extends Plugin {
  settings: GoodreadsPluginSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("book-open", "Import Goodreads CSV", () => {
      this.openImportModal();
    });

    this.addCommand({
      id: "import-goodreads-csv",
      name: "Import Goodreads CSV",
      callback: () => {
        this.openImportModal();
      }
    });

    this.addSettingTab(new GoodreadsSettingTab(this.app, this));
  }

  openImportModal(): void {
    new GoodreadsImportModal(this.app, this).open();
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<GoodreadsPluginSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(saved ?? {}),
      frontmatterFields:
        saved?.frontmatterFields && saved.frontmatterFields.length > 0
          ? saved.frontmatterFields.map((f) => ({ ...f }))
          : DEFAULT_SETTINGS.frontmatterFields.map((f) => ({ ...f }))
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
