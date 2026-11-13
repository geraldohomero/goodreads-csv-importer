import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem
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

  getControlValue(key: string): unknown {
    const settings = this.plugin.settings;
    switch (key) {
      case "notesFolder":
        return settings.notesFolder;
      case "coversFolder":
        return settings.coversFolder;
      case "fileNameTemplate":
        return settings.fileNameTemplate;
      case "defaultShelfFilter":
        return settings.defaultShelfFilter;
      case "ignoredShelves":
        return settings.ignoredShelves;
      case "existingNoteBehavior":
        return settings.existingNoteBehavior;
      case "fetchFromGoodreads":
        return settings.fetchFromGoodreads;
      case "requestDelayMs":
        return settings.requestDelayMs;
      case "bodyTemplate":
        return settings.bodyTemplate;
      default:
        return undefined;
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings;
    switch (key) {
      case "notesFolder":
        settings.notesFolder = typeof value === "string" ? value.trim() : "";
        break;
      case "coversFolder":
        settings.coversFolder = typeof value === "string" ? value.trim() : "";
        break;
      case "fileNameTemplate":
        settings.fileNameTemplate =
          typeof value === "string" && value ? value : "{{shortTitle}}";
        break;
      case "defaultShelfFilter":
        settings.defaultShelfFilter =
          typeof value === "string" ? value.trim() : "";
        break;
      case "ignoredShelves":
        settings.ignoredShelves =
          typeof value === "string" ? value.trim() : "";
        break;
      case "existingNoteBehavior":
        if (
          value === "update-frontmatter" ||
          value === "skip" ||
          value === "overwrite"
        ) {
          settings.existingNoteBehavior = value;
        }
        break;
      case "fetchFromGoodreads":
        settings.fetchFromGoodreads = Boolean(value);
        break;
      case "requestDelayMs": {
        const parsed = typeof value === "number" ? value : Number(value);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          settings.requestDelayMs = parsed;
        }
        break;
      }
      case "bodyTemplate":
        settings.bodyTemplate = typeof value === "string" ? value : "";
        break;
      default:
        return;
    }

    await this.plugin.saveSettings();
    this.updatePreview();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        cls: "goodreads-settings",
        items: [
          {
            name: "Import Goodreads library",
            desc: "Select a goodreads_library_export.csv file to generate notes and download cover images.",
            render: (setting) => {
              this.renderImportAction(setting);
            }
          }
        ]
      },
      {
        type: "group",
        heading: "Folders and files",
        cls: "goodreads-settings",
        items: [
          {
            name: "Notes folder",
            desc: "Vault path where book notes will be created.",
            control: {
              type: "text",
              key: "notesFolder",
              placeholder: "Books"
            }
          },
          {
            name: "Covers folder",
            desc: "Vault path where cover images (<id>.jpg) will be saved.",
            control: {
              type: "text",
              key: "coversFolder",
              placeholder: "Books/Covers"
            }
          },
          {
            name: "Note filename template",
            desc: "Filename for each generated Markdown note (e.g. {{shortTitle}} or {{cleanTitle}}).",
            control: {
              type: "text",
              key: "fileNameTemplate",
              placeholder: "{{shortTitle}}",
              defaultValue: "{{shortTitle}}"
            }
          },
          {
            name: "Default shelf filter",
            desc: "Shelf pre-selected in the import modal (e.g. literature). Leave blank to include all shelves; each imported book still receives all of its shelves in frontmatter.",
            control: {
              type: "text",
              key: "defaultShelfFilter",
              placeholder: "All shelves"
            }
          },
          {
            name: "Ignored shelves in frontmatter",
            desc: "Comma-separated shelf names to omit from the YAML 'shelves' list (e.g. owned).",
            control: {
              type: "text",
              key: "ignoredShelves",
              placeholder: "None"
            }
          },
          {
            name: "Existing notes",
            desc: "Action to take when a book note already exists in the target folder.",
            control: {
              type: "dropdown",
              key: "existingNoteBehavior",
              options: {
                "update-frontmatter": "Update frontmatter only (preserve body)",
                skip: "Skip existing note",
                overwrite: "Overwrite entire note"
              }
            }
          },
          {
            name: "Fetch synopsis and cover from Goodreads",
            desc: "When enabled, fetches each book's Goodreads page to download its cover (.jpg) and extract its synopsis (description).",
            control: {
              type: "toggle",
              key: "fetchFromGoodreads"
            }
          },
          {
            name: "Request delay (ms)",
            desc: "Pause between Goodreads page requests to avoid rate limiting.",
            control: {
              type: "number",
              key: "requestDelayMs",
              placeholder: "300",
              min: 0,
              step: 50,
              defaultValue: 300,
              validate: (value: number) =>
                Number.isNaN(value) || value < 0
                  ? "Request delay must be 0 or greater."
                  : undefined
            }
          }
        ]
      },
      {
        type: "group",
        heading: "Frontmatter properties",
        cls: "goodreads-settings",
        items: [
          {
            name: "Reset frontmatter defaults",
            desc: "Enable, rename, reorder, or edit property values using CSV variables such as {{author}}, {{cleanTitle}}, {{coverPath}}, {{shelves}}, and {{description}}.",
            render: (setting) => {
              this.renderResetFrontmatterAction(setting);
            }
          },
          {
            name: "Frontmatter properties list",
            searchable: false,
            render: (setting) => {
              setting.settingEl.empty();
              setting.settingEl.addClass("goodreads-block-setting");
              this.fieldsContainerEl = setting.settingEl.createDiv({
                cls: "goodreads-fm-list"
              });
              this.renderFrontmatterFields();
              return () => {
                this.fieldsContainerEl = null;
              };
            }
          },
          {
            name: "Add property",
            desc: "Choose an extra CSV field or create a custom property.",
            render: (setting) => {
              this.renderAddPropertyControls(setting);
            }
          }
        ]
      },
      {
        type: "group",
        heading: "Note body",
        cls: "goodreads-settings",
        items: [
          {
            name: "Note body template",
            desc: "Content inserted below the frontmatter (supports {{...}} variables).",
            control: {
              type: "textarea",
              key: "bodyTemplate",
              placeholder: "> #goodreads",
              rows: 4
            }
          }
        ]
      },
      {
        type: "group",
        heading: "Generated note preview (sample: Mistborn)",
        cls: "goodreads-settings",
        items: [
          {
            name: "Note preview",
            searchable: false,
            render: (setting) => {
              setting.settingEl.empty();
              setting.settingEl.addClass("goodreads-block-setting");
              this.previewEl = setting.settingEl.createEl("pre", {
                cls: "goodreads-preview-code"
              });
              this.updatePreview();
              return () => {
                this.previewEl = null;
              };
            }
          },
          {
            name: "Template variables reference",
            desc: "Show all available template variables ({{...}}).",
            aliases: ["variables", "template"],
            render: (setting) => {
              setting.settingEl.empty();
              setting.settingEl.addClass("goodreads-block-setting");
              this.renderVariablesReference(setting.settingEl);
            }
          }
        ]
      }
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("goodreads-settings");

    const importSetting = new Setting(containerEl)
      .setName("Import Goodreads library")
      .setDesc(
        "Select a goodreads_library_export.csv file to generate notes and download cover images."
      );
    this.renderImportAction(importSetting);

    new Setting(containerEl).setName("Folders and files").setHeading();

    new Setting(containerEl)
      .setName("Notes folder")
      .setDesc("Vault path where book notes will be created.")
      .addText((text) =>
        text
          .setPlaceholder("Books")
          .setValue(this.plugin.settings.notesFolder)
          .onChange((value) => {
            void this.setControlValue("notesFolder", value);
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
          .onChange((value) => {
            void this.setControlValue("coversFolder", value);
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
          .onChange((value) => {
            void this.setControlValue("fileNameTemplate", value);
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
          .onChange((value) => {
            void this.setControlValue("defaultShelfFilter", value);
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
          .onChange((value) => {
            void this.setControlValue("ignoredShelves", value);
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
          .onChange((value) => {
            void this.setControlValue("existingNoteBehavior", value);
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
          .onChange((value) => {
            void this.setControlValue("fetchFromGoodreads", value);
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
          .onChange((value) => {
            void this.setControlValue("requestDelayMs", value);
          })
      );

    // Frontmatter visual builder
    const fmHeaderSetting = new Setting(containerEl)
      .setName("Frontmatter properties")
      .setDesc(
        "Enable, rename, reorder, or edit property values using CSV variables such as {{author}}, {{cleanTitle}}, {{coverPath}}, {{shelves}}, and {{description}}."
      )
      .setHeading();
    this.renderResetFrontmatterAction(fmHeaderSetting);

    this.fieldsContainerEl = containerEl.createDiv({
      cls: "goodreads-fm-list"
    });
    this.renderFrontmatterFields();

    const addPropertySetting = new Setting(containerEl)
      .setName("Add property")
      .setDesc("Choose an extra CSV field or create a custom property.");
    this.renderAddPropertyControls(addPropertySetting);

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
          .onChange((value) => {
            void this.setControlValue("bodyTemplate", value);
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

    this.renderVariablesReference(containerEl);
  }

  private renderImportAction(setting: Setting): void {
    setting.addButton((btn) =>
      btn
        .setButtonText("Import CSV...")
        .setCta()
        .onClick(() => {
          this.plugin.openImportModal();
        })
    );
  }

  private renderResetFrontmatterAction(setting: Setting): void {
    setting.addButton((btn) =>
      btn.setButtonText("Reset defaults").onClick(() => {
        void (async () => {
          this.plugin.settings.frontmatterFields =
            DEFAULT_FRONTMATTER_FIELDS.map((f) => ({ ...f }));
          this.plugin.settings.bodyTemplate = DEFAULT_SETTINGS.bodyTemplate;
          await this.plugin.saveSettings();
          this.renderFrontmatterFields();
          this.updatePreview();
          new Notice("Frontmatter settings reset to defaults.");
        })();
      })
    );
  }

  private renderAddPropertyControls(setting: Setting): void {
    let selectedPresetIndex = 0;
    setting
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
          .onClick(() => {
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
            this.saveAndRefreshPreview(true);
          })
      );
  }

  private renderVariablesReference(hostEl: HTMLElement): void {
    const detailsEl = hostEl.createEl("details", {
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

  private saveAndRefreshPreview(rerenderFields = false): void {
    void (async () => {
      await this.plugin.saveSettings();
      if (rerenderFields) {
        this.renderFrontmatterFields();
      }
      this.updatePreview();
    })();
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
      toggleInput.addEventListener("change", () => {
        field.enabled = toggleInput.checked;
        rowEl.toggleClass("is-disabled", !field.enabled);
        this.saveAndRefreshPreview();
      });

      // Key input
      const keyInput = rowEl.createEl("input", {
        type: "text",
        cls: "goodreads-fm-key",
        value: field.key,
        placeholder: "key"
      });
      keyInput.title = "YAML property name";
      keyInput.addEventListener("input", () => {
        field.key = keyInput.value;
        this.saveAndRefreshPreview();
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
      formatSelect.addEventListener("change", () => {
        field.format = formatSelect.value as FrontmatterFieldFormat;
        this.saveAndRefreshPreview();
      });

      // Template value input
      const templateInput = rowEl.createEl("input", {
        type: "text",
        cls: "goodreads-fm-template",
        value: field.template,
        placeholder: "{{variable}}"
      });
      templateInput.title = "Value template";
      templateInput.addEventListener("input", () => {
        field.template = templateInput.value;
        this.saveAndRefreshPreview();
      });

      // Action buttons: up, down, delete
      const actionsEl = rowEl.createDiv({ cls: "goodreads-fm-actions" });

      const upBtn = actionsEl.createEl("button", {
        text: "↑",
        cls: "goodreads-fm-btn"
      });
      upBtn.title = "Move up";
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", () => {
        if (index === 0) return;
        const temp = fields[index - 1];
        fields[index - 1] = fields[index];
        fields[index] = temp;
        this.saveAndRefreshPreview(true);
      });

      const downBtn = actionsEl.createEl("button", {
        text: "↓",
        cls: "goodreads-fm-btn"
      });
      downBtn.title = "Move down";
      downBtn.disabled = index === fields.length - 1;
      downBtn.addEventListener("click", () => {
        if (index >= fields.length - 1) return;
        const temp = fields[index + 1];
        fields[index + 1] = fields[index];
        fields[index] = temp;
        this.saveAndRefreshPreview(true);
      });

      const delBtn = actionsEl.createEl("button", {
        text: "✕",
        cls: "goodreads-fm-btn is-danger"
      });
      delBtn.title = "Remove property";
      delBtn.addEventListener("click", () => {
        fields.splice(index, 1);
        this.saveAndRefreshPreview(true);
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
