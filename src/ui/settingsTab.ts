import {
  App,
  Notice,
  PluginSettingTab,
  Setting
} from "obsidian";
import {
  AVAILABLE_VARIABLES_HELP,
  DEFAULT_FRONTMATTER_FIELDS,
  DEFAULT_SETTINGS,
  VARIABLE_PRESETS,
  createSampleVariables
} from "../defaults";
import { buildNoteContent } from "../frontmatterBuilder";
import type GoodreadsImporterPlugin from "../main";
import {
  ExistingNoteBehavior,
  FrontmatterFieldConfig,
  FrontmatterFieldFormat
} from "../types";

export class GoodreadsSettingTab extends PluginSettingTab {
  plugin: GoodreadsImporterPlugin;
  private previewEl: HTMLElement | null = null;
  private fieldsContainerEl: HTMLElement | null = null;

  constructor(app: App, plugin: GoodreadsImporterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("goodreads-settings");

    new Setting(containerEl)
      .setName("Import Goodreads library")
      .setDesc(
        "Select a goodreads_library_export.csv file to generate notes and download cover images."
      )
      .addButton((btn) =>
        btn
          .setButtonText("Import CSV...")
          .setCta()
          .onClick(() => {
            this.plugin.openImportModal();
          })
      );

    new Setting(containerEl).setName("Folders and files").setHeading();

    new Setting(containerEl)
      .setName("Notes folder")
      .setDesc("Vault path where book notes will be created.")
      .addText((text) =>
        text
          .setPlaceholder("Books")
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value.trim();
            await this.plugin.saveSettings();
            this.updatePreview();
          })
      );

    new Setting(containerEl)
      .setName("Covers folder")
      .setDesc(
        "Vault path where cover images (<id>.jpg) will be saved."
      )
      .addText((text) =>
        text
          .setPlaceholder("Books/Covers")
          .setValue(this.plugin.settings.coversFolder)
          .onChange(async (value) => {
            this.plugin.settings.coversFolder = value.trim();
            await this.plugin.saveSettings();
            this.updatePreview();
          })
      );

    new Setting(containerEl)
      .setName("Note filename template")
      .setDesc(
        "Filename for each generated Markdown note (e.g. {{shortTitle}} or {{cleanTitle}})."
      )
      .addText((text) =>
        text
          .setPlaceholder("{{shortTitle}}")
          .setValue(this.plugin.settings.fileNameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.fileNameTemplate = value || "{{shortTitle}}";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default shelf filter")
      .setDesc(
        "Shelf pre-selected in the import modal (e.g. literature). Leave blank to include all shelves; each imported book still receives all of its shelves in frontmatter."
      )
      .addText((text) =>
        text
          .setPlaceholder("All shelves")
          .setValue(this.plugin.settings.defaultShelfFilter)
          .onChange(async (value) => {
            this.plugin.settings.defaultShelfFilter = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Ignored shelves in frontmatter")
      .setDesc(
        "Comma-separated shelf names to omit from the YAML 'shelves' list (e.g. owned)."
      )
      .addText((text) =>
        text
          .setPlaceholder("None")
          .setValue(this.plugin.settings.ignoredShelves)
          .onChange(async (value) => {
            this.plugin.settings.ignoredShelves = value.trim();
            await this.plugin.saveSettings();
            this.updatePreview();
          })
      );

    new Setting(containerEl)
      .setName("Existing notes")
      .setDesc("Action to take when a book note already exists in the target folder.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(
            "update-frontmatter",
            "Update frontmatter only (preserve body)"
          )
          .addOption("skip", "Skip existing note")
          .addOption("overwrite", "Overwrite entire note")
          .setValue(this.plugin.settings.existingNoteBehavior)
          .onChange(async (value) => {
            this.plugin.settings.existingNoteBehavior =
              value as ExistingNoteBehavior;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Fetch synopsis and cover from Goodreads")
      .setDesc(
        "When enabled, fetches each book's Goodreads page to download its cover (.jpg) and extract its synopsis (description)."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fetchFromGoodreads)
          .onChange(async (value) => {
            this.plugin.settings.fetchFromGoodreads = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Request delay (ms)")
      .setDesc(
        "Pause between Goodreads page requests to avoid rate limiting."
      )
      .addText((text) =>
        text
          .setPlaceholder("300")
          .setValue(String(this.plugin.settings.requestDelayMs))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              this.plugin.settings.requestDelayMs = parsed;
              await this.plugin.saveSettings();
            }
          })
      );

    // Frontmatter visual builder
    new Setting(containerEl)
      .setName("Frontmatter properties")
      .setDesc(
        "Enable, rename, reorder, or edit property values using CSV variables such as {{author}}, {{cleanTitle}}, {{coverPath}}, {{shelves}}, and {{description}}."
      )
      .setHeading()
      .addButton((btn) =>
        btn.setButtonText("Reset defaults").onClick(async () => {
          this.plugin.settings.frontmatterFields =
            DEFAULT_FRONTMATTER_FIELDS.map((f) => ({ ...f }));
          this.plugin.settings.bodyTemplate = DEFAULT_SETTINGS.bodyTemplate;
          await this.plugin.saveSettings();
          this.renderFrontmatterFields();
          this.updatePreview();
          new Notice("Frontmatter settings reset to defaults.");
        })
      );

    this.fieldsContainerEl = containerEl.createDiv({
      cls: "goodreads-fm-list"
    });
    this.renderFrontmatterFields();

    // Add property row with preset selector
    let selectedPresetIndex = 0;
    new Setting(containerEl)
      .setName("Add property")
      .setDesc("Choose an extra CSV field or create a custom property.")
      .addDropdown((dropdown) => {
        VARIABLE_PRESETS.forEach((preset, idx) => {
          dropdown.addOption(String(idx), preset.label);
        });
        dropdown.onChange((val) => {
          selectedPresetIndex = Number(val) || 0;
        });
      })
      .addButton((btn) =>
        btn
          .setButtonText("+ Add")
          .setCta()
          .onClick(async () => {
            const preset =
              VARIABLE_PRESETS[selectedPresetIndex] ?? VARIABLE_PRESETS[0];
            const newField: FrontmatterFieldConfig = {
              id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              key: preset.key,
              template: preset.template,
              format: preset.format,
              enabled: true
            };
            this.plugin.settings.frontmatterFields.push(newField);
            await this.plugin.saveSettings();
            this.renderFrontmatterFields();
            this.updatePreview();
          })
      );

    new Setting(containerEl).setName("Note body").setHeading();
    new Setting(containerEl)
      .setName("Note body template")
      .setDesc(
        "Content inserted below the frontmatter (supports {{...}} variables)."
      )
      .addTextArea((area) => {
        area
          .setPlaceholder("> #goodreads")
          .setValue(this.plugin.settings.bodyTemplate)
          .onChange(async (value) => {
            this.plugin.settings.bodyTemplate = value;
            await this.plugin.saveSettings();
            this.updatePreview();
          });
        area.inputEl.rows = 4;
        area.inputEl.addClass("goodreads-body-textarea");
      });

    // Live Preview
    new Setting(containerEl)
      .setName("Generated note preview (sample: Mistborn)")
      .setHeading();
    this.previewEl = containerEl.createEl("pre", {
      cls: "goodreads-preview-code"
    });
    this.updatePreview();

    // Reference table of variables
    const detailsEl = containerEl.createEl("details", {
      cls: "goodreads-vars-details"
    });
    detailsEl.createEl("summary", {
      text: "Show all available template variables ({{...}})"
    });
    const listEl = detailsEl.createEl("ul", { cls: "goodreads-vars-list" });
    for (const item of AVAILABLE_VARIABLES_HELP) {
      const li = listEl.createEl("li");
      li.createEl("code", { text: item.token });
      li.appendText(` — ${item.description}`);
    }
  }

  private renderFrontmatterFields(): void {
    const container = this.fieldsContainerEl;
    if (!container) {
      return;
    }
    container.empty();

    const fields = this.plugin.settings.frontmatterFields;

    fields.forEach((field, index) => {
      const rowEl = container.createDiv({
        cls: `goodreads-fm-row ${field.enabled ? "" : "is-disabled"}`
      });

      // Enable toggle
      const toggleInput = rowEl.createEl("input", {
        type: "checkbox",
        cls: "goodreads-fm-toggle"
      });
      toggleInput.checked = field.enabled;
      toggleInput.title = "Enable / disable property";
      toggleInput.addEventListener("change", async () => {
        field.enabled = toggleInput.checked;
        rowEl.toggleClass("is-disabled", !field.enabled);
        await this.plugin.saveSettings();
        this.updatePreview();
      });

      // Key input
      const keyInput = rowEl.createEl("input", {
        type: "text",
        cls: "goodreads-fm-key",
        value: field.key,
        placeholder: "key"
      });
      keyInput.title = "YAML property name";
      keyInput.addEventListener("input", async () => {
        field.key = keyInput.value;
        await this.plugin.saveSettings();
        this.updatePreview();
      });

      // Format dropdown
      const formatSelect = rowEl.createEl("select", {
        cls: "goodreads-fm-format dropdown"
      });
      const formatOptions: Array<{
        value: FrontmatterFieldFormat;
        label: string;
      }> = [
        { value: "single-quoted", label: "Quoted ('...')" },
        { value: "plain", label: "Plain text" },
        { value: "list", label: "YAML list" },
        { value: "block-scalar", label: "Block (>-)" }
      ];
      for (const opt of formatOptions) {
        const optEl = formatSelect.createEl("option", {
          value: opt.value,
          text: opt.label
        });
        if (opt.value === field.format) {
          optEl.selected = true;
        }
      }
      formatSelect.addEventListener("change", async () => {
        field.format = formatSelect.value as FrontmatterFieldFormat;
        await this.plugin.saveSettings();
        this.updatePreview();
      });

      // Template value input
      const templateInput = rowEl.createEl("input", {
        type: "text",
        cls: "goodreads-fm-template",
        value: field.template,
        placeholder: "{{variable}}"
      });
      templateInput.title = "Value template";
      templateInput.addEventListener("input", async () => {
        field.template = templateInput.value;
        await this.plugin.saveSettings();
        this.updatePreview();
      });

      // Action buttons: up, down, delete
      const actionsEl = rowEl.createDiv({ cls: "goodreads-fm-actions" });

      const upBtn = actionsEl.createEl("button", {
        text: "↑",
        cls: "goodreads-fm-btn"
      });
      upBtn.title = "Move up";
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", async () => {
        if (index === 0) return;
        const temp = fields[index - 1];
        fields[index - 1] = fields[index];
        fields[index] = temp;
        await this.plugin.saveSettings();
        this.renderFrontmatterFields();
        this.updatePreview();
      });

      const downBtn = actionsEl.createEl("button", {
        text: "↓",
        cls: "goodreads-fm-btn"
      });
      downBtn.title = "Move down";
      downBtn.disabled = index === fields.length - 1;
      downBtn.addEventListener("click", async () => {
        if (index >= fields.length - 1) return;
        const temp = fields[index + 1];
        fields[index + 1] = fields[index];
        fields[index] = temp;
        await this.plugin.saveSettings();
        this.renderFrontmatterFields();
        this.updatePreview();
      });

      const delBtn = actionsEl.createEl("button", {
        text: "✕",
        cls: "goodreads-fm-btn is-danger"
      });
      delBtn.title = "Remove property";
      delBtn.addEventListener("click", async () => {
        fields.splice(index, 1);
        await this.plugin.saveSettings();
        this.renderFrontmatterFields();
        this.updatePreview();
      });
    });
  }

  private updatePreview(): void {
    if (!this.previewEl) {
      return;
    }
    const sample = createSampleVariables(
      this.plugin.settings.notesFolder,
      this.plugin.settings.coversFolder
    );
    this.previewEl.setText(buildNoteContent(sample, this.plugin.settings));
  }
}
