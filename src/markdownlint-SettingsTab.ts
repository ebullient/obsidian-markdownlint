import { type App, PluginSettingTab, Setting } from "obsidian";
import type { MarkdownlintPlugin } from "./markdownlint-Plugin";

export interface PluginSettings {
    showDiagnostics: boolean;
    lintOnSave: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    showDiagnostics: true,
    lintOnSave: false,
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
            .setName("Show diagnostics")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.newSettings.showDiagnostics)
                    .onChange((value) => {
                        this.newSettings.showDiagnostics = value;
                    }),
            );

        new Setting(containerEl).setName("Lint on save").addToggle((toggle) =>
            toggle.setValue(this.newSettings.lintOnSave).onChange((value) => {
                this.newSettings.lintOnSave = value;
            }),
        );
    }

    /** Save on exit */
    hide(): void {
        void this.save();
    }
}
