import { type Diagnostic, type LintSource, linter } from "@codemirror/lint";
import type { ChangeSpec, Extension } from "@codemirror/state";
import DiffMatchPatch from "diff-match-patch";
import {
    applyFix,
    applyFixes,
    type Configuration,
    getVersion,
    type LintError,
    type Options,
} from "markdownlint";
import { lint } from "markdownlint/sync";
import {
    type App,
    type Editor,
    editorInfoField,
    MarkdownView,
    Plugin,
    PluginSettingTab,
    parseYaml,
    Setting,
} from "obsidian";

interface PluginSettings {
    showDiagnostics: boolean;
    lintOnSave: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
    showDiagnostics: true,
    lintOnSave: false,
};

export class MarkdownlintPlugin extends Plugin {
    public settings: PluginSettings;

    /** CodeMirror 6 extensions. Tracked via array to allow for dynamic updates. */
    private cmExtension: Extension[] = [];

    private configFileNames = [
        ".markdownlint.json",
        ".markdownlint.yaml",
        ".markdownlint.yml",
    ];

    private config: Configuration = {
        default: true,
        "ul-indent": {
            indent: 4,
        },
        "line-length": {
            code_blocks: false,
            line_length: 120,
            tables: false,
        },
        "single-h1": {
            front_matter_title: "",
        },
        "no-inline-html": {
            allowed_elements: [
                "a",
                "br",
                "details",
                "div",
                "img",
                "s",
                "span",
                "summary",
                "sup",
                "table",
                "thead",
                "tbody",
                "td",
                "th",
                "tr",
            ],
        },
        "hr-style": {
            style: "---",
        },
        MD042: false,
    };

    private originalSaveCallback?: (checking: boolean) => boolean | undefined =
        null;

    async onload(): Promise<void> {
        console.info(
            `loading Markdownlint v${this.manifest.version}`,
            `using markdownlint v${getVersion()}`,
        );

        await this.loadSettings();
        this.addSettingTab(new SettingTab(this.app, this));

        this.registerEditorExtension(this.cmExtension);
        this.cmExtension.push(
            linter(this.lintSource, {
                delay: 1500,
            }),
        );

        this.app.workspace.onLayoutReady(async () => {
            await this.findConfig();
        });

        this.addCommand({
            id: "reload-config",
            name: "Reload Configuration",
            icon: "monitor-cog",
            callback: async () => {
                await this.findConfig();
            },
        });

        this.addCommand({
            id: "fix-all-current-file",
            name: "Fix markdown lint issues in the current file",
            icon: "locate-fixed",
            editorCallback: async (_editor, ctx) => {
                this.app.vault.process(ctx.file, (content) => {
                    const results = this.doLint(ctx.file.name, content);
                    return this.doFixes(content, results);
                });
            },
        });

        const saveCommandDefinition =
            this.app.commands?.commands?.["editor:save-file"];

        this.originalSaveCallback = saveCommandDefinition?.checkCallback;

        saveCommandDefinition.checkCallback = (checking: boolean) => {
            if (checking) return this.originalSaveCallback(checking);

            if (this.settings.lintOnSave) {
                const view =
                    this.app.workspace.getActiveViewOfType(MarkdownView);

                const oldContent = view.editor.getValue();
                const results = this.doLint(view.file.name, oldContent);
                const newContent = this.doFixes(oldContent, results);

                this.updateEditor(oldContent, newContent, view.editor);
            }

            return this.originalSaveCallback(checking);
        };

        // TODO: commands:
        // - provide default config file (setting)
    }

    async onunload(): Promise<void> {
        this.cmExtension.length = 0;

        const saveCommandDefinition =
            this.app.commands?.commands?.["editor:save-file"];

        if (saveCommandDefinition?.checkCallback && this.originalSaveCallback) {
            saveCommandDefinition.checkCallback = this.originalSaveCallback;
        }
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async findConfig(): Promise<void> {
        for (const name of this.configFileNames) {
            if (await this.app.vault.adapter.exists(name)) {
                return this.loadConfig(name);
            }
        }
        console.log("🤷 markdownlint: no configuration file found");
    }

    async loadConfig(name: string): Promise<void> {
        const content = await this.app.vault.adapter.read(name);
        if (name.endsWith(".json")) {
            this.config = JSON.parse(content);
        } else if (name.endsWith(".yaml") || name.endsWith(".yml")) {
            this.config = parseYaml(content);
        }
        console.log("🛠️ markdownlint:", name, this.config);
    }

    doLint(name: string, content: string): LintError[] {
        const options: Options = {
            strings: {
                [name]: content,
            },
            config: this.config,
            handleRuleFailures: true,
        };
        const lintResult = lint(options);
        return lintResult[name];
    }

    doFixes(content: string, results: LintError[]): string {
        if (results.length !== 0) {
            const patched = applyFixes(content, results);
            if (patched !== content) {
                return patched;
            }
        }
        return content;
    }

    // Hook into CodeMirror lint support
    lintSource: LintSource = async (editorView) => {
        if (!this.config || !this.settings.showDiagnostics) {
            return;
        }
        const info = editorView.state.field(editorInfoField);
        const doc = editorView.state.doc;
        const diagnostics: Diagnostic[] = [];
        const content = doc.toString();
        const lintErrors = this.doLint(info.file.name, content);

        for (const error of lintErrors) {
            const line = doc.line(error.lineNumber);
            const errFrom = error.errorRange
                ? line.from + error.errorRange[0] - 1
                : line.from;
            const errTo = error.errorRange
                ? errFrom + error.errorRange[1]
                : line.to;
            // create a diagnostic / decoration
            const diagnostic: Diagnostic = {
                from: errFrom,
                to: errTo,
                message: `${error.ruleNames.join("/")}: ${error.ruleDescription}${error.errorDetail ? ` [${error.errorDetail}]` : ""}`,
                severity: "error",
                source: "markdownlint",
            };
            if (error.fixInfo) {
                diagnostic.actions = [
                    {
                        name: "Apply fix",
                        apply: (view, from, to) => {
                            // re-calculate the range, as the document may have changed
                            const applyLine = view.state.doc.lineAt(from);
                            const toFix = applyLine.text;
                            const fixedText = applyFix(
                                toFix,
                                error.fixInfo,
                                "\n",
                            );
                            console.log(
                                "🔧 LP Applying fix",
                                from,
                                to,
                                JSON.stringify({
                                    original: toFix,
                                    replaced: fixedText,
                                }),
                                error,
                            );
                            // https://codemirror.net/examples/change/
                            // For insertions, to can be omitted, and for deletions, insert can be omitted.
                            if (typeof fixedText === "string") {
                                view.dispatch({
                                    changes: {
                                        from: applyLine.from,
                                        to: applyLine.to,
                                        insert: fixedText,
                                    },
                                });
                            } else if (fixedText === null) {
                                const deleteStart =
                                    from + error.fixInfo.deleteCount;
                                view.dispatch({
                                    changes: {
                                        from: deleteStart,
                                        to: from,
                                    },
                                });
                            }
                        },
                    },
                ];
            }
            diagnostics.push(diagnostic);
        }

        return diagnostics;
    };

    // Based on https://github.com/platers/obsidian-linter/blob/master/src/main.ts#L857
    //
    // vault.process doesn't work while a requestSave event is being debounced.
    // That's why we apply the changes using cm.dispatch instead.
    //
    // See: https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862
    private updateEditor(
        oldText: string,
        newText: string,
        editor: Editor,
    ): DiffMatchPatch.Diff[] {
        const dmp = new DiffMatchPatch.diff_match_patch();
        const changes = dmp.diff_main(oldText, newText);

        let curText = "";
        changes.forEach((change) => {
            const [type, value] = change;

            if (type === DiffMatchPatch.DIFF_INSERT) {
                editor.cm.dispatch({
                    changes: [
                        {
                            from: editor.posToOffset(
                                this.endOfDocument(curText),
                            ),
                            insert: value,
                        } as ChangeSpec,
                    ],
                    filter: false,
                });
                curText += value;
            } else if (type === DiffMatchPatch.DIFF_DELETE) {
                const start = this.endOfDocument(curText);
                let tempText = curText;
                tempText += value;
                const end = this.endOfDocument(tempText);
                editor.cm.dispatch({
                    changes: [
                        {
                            from: editor.posToOffset(start),
                            to: editor.posToOffset(end),
                            insert: "",
                        } as ChangeSpec,
                    ],
                    filter: false,
                });
            } else {
                curText += value;
            }
        });

        return changes;
    }

    private endOfDocument(doc: string) {
        const lines = doc.split("\n");
        return { line: lines.length - 1, ch: lines[lines.length - 1].length };
    }
}

class SettingTab extends PluginSettingTab {
    plugin: MarkdownlintPlugin;

    constructor(app: App, plugin: MarkdownlintPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl) //
            .setName("Show Diagnostics")
            .addToggle((toggle) =>
                toggle //
                    .setValue(this.plugin.settings.showDiagnostics)
                    .onChange((value) => {
                        this.plugin.settings.showDiagnostics = value;
                        this.plugin.saveSettings();
                        this.display();
                    }),
            );

        new Setting(containerEl) //
            .setName("Lint on Save")
            .addToggle((toggle) =>
                toggle //
                    .setValue(this.plugin.settings.lintOnSave)
                    .onChange((value) => {
                        this.plugin.settings.lintOnSave = value;
                        this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }
}
