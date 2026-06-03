import {
    type App,
    PluginSettingTab,
    Setting,
    type SettingDefinitionItem,
} from "obsidian";
import type { MarkdownlintPlugin } from "./markdownlint-Plugin";

export interface PluginSettings {
    showDiagnostics: boolean;
    lintOnSave: boolean;
    configFilePath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    showDiagnostics: true,
    lintOnSave: false,
    configFilePath: "",
};

export class MarkdownlintSettingsTab extends PluginSettingTab {
    plugin: MarkdownlintPlugin;

    constructor(app: App, plugin: MarkdownlintPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = "spell-check-2";
    }

    // Obsidian 1.13.0+: framework uses this and skips display().
    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: "Config file path",
                desc: "Path to config file (use visible names like markdownlint-config.json to sync across devices, or leave empty to auto-detect hidden files)",
                render: (setting: Setting) => {
                    setting.addText((text) =>
                        text
                            .setPlaceholder("markdownlint-config.json")
                            .setValue(this.plugin.settings.configFilePath)
                            .onChange(async (value) => {
                                this.plugin.settings.configFilePath = value;
                                await this.plugin.saveSettings();
                                await this.plugin.findConfig();
                            }),
                    );
                },
            },
            {
                name: "Show diagnostics",
                desc: "Display markdownlint issues inline in the editor",
                control: { type: "toggle", key: "showDiagnostics" },
            },
            {
                name: "Lint on save",
                desc: "Automatically fix markdownlint issues when saving files",
                control: { type: "toggle", key: "lintOnSave" },
            },
            {
                name: "",
                render: (setting: Setting) => {
                    setting.descEl.addClass("markdownlint-coffee");
                    setting.descEl
                        .createEl("a", {
                            href: "https://www.buymeacoffee.com/ebullient",
                        })
                        .createEl("img", {
                            attr: {
                                src: "https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=ebullient&button_colour=8e6787&font_colour=ebebeb&font_family=Inter&outline_colour=392a37&coffee_colour=ecc986",
                                height: "30px",
                            },
                        });
                },
            },
        ];
    }

    // Obsidian < 1.13.0 fallback.
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Config file path")
            .setDesc(
                "Path to config file (use visible names like markdownlint-config.json to sync across devices, or leave empty to auto-detect hidden files)",
            )
            .addText((text) =>
                text
                    .setPlaceholder("markdownlint-config.json")
                    .setValue(this.plugin.settings.configFilePath)
                    .onChange(async (value) => {
                        this.plugin.settings.configFilePath = value;
                        await this.plugin.saveSettings();
                        await this.plugin.findConfig();
                    }),
            );

        new Setting(containerEl)
            .setName("Show diagnostics")
            .setDesc("Display markdownlint issues inline in the editor")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showDiagnostics)
                    .onChange(async (value) => {
                        this.plugin.settings.showDiagnostics = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Lint on save")
            .setDesc("Automatically fix markdownlint issues when saving files")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.lintOnSave)
                    .onChange(async (value) => {
                        this.plugin.settings.lintOnSave = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
