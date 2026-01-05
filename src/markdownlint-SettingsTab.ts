import { type App, PluginSettingTab, Setting } from "obsidian";
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
    newSettings!: PluginSettings;

    constructor(app: App, plugin: MarkdownlintPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = "spell-check-2";
    }

    async save() {
        this.plugin.settings = this.newSettings;
        await this.plugin.saveSettings();
    }

    private cloneSettings(): PluginSettings {
        return JSON.parse(
            JSON.stringify(this.plugin.settings),
        ) as PluginSettings;
    }

    reset() {
        this.newSettings = this.cloneSettings();
        this.display();
    }

    display(): void {
        if (!this.newSettings) {
            this.newSettings = this.cloneSettings();
        }

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
                    .setValue(this.newSettings.configFilePath)
                    .onChange(async (value) => {
                        this.newSettings.configFilePath = value;
                        await this.save();
                        await this.plugin.findConfig();
                    }),
            );

        new Setting(containerEl)
            .setName("Show diagnostics")
            .setDesc("Display markdownlint issues inline in the editor")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.newSettings.showDiagnostics)
                    .onChange((value) => {
                        this.newSettings.showDiagnostics = value;
                    }),
            );

        new Setting(containerEl)
            .setName("Lint on save")
            .setDesc("Automatically fix markdownlint issues when saving files")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.newSettings.lintOnSave)
                    .onChange((value) => {
                        this.newSettings.lintOnSave = value;
                    }),
            );
    }

    /** Save on exit */
    hide(): void {
        void this.save();
    }
}
