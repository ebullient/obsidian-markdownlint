import { type Diagnostic, type LintSource, linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import {
    type Configuration,
    type LintError,
    type Options,
    applyFix,
    applyFixes,
    getVersion,
} from "markdownlint";
import { lint } from "markdownlint/sync";
import { Plugin, editorInfoField, parseYaml } from "obsidian";

export class MarkdownlintPlugin extends Plugin {
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

    async onload(): Promise<void> {
        console.info(
            `loading Markdownlint v${this.manifest.version}`,
            `using markdownlint v${getVersion()}`,
        );

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
            editorCallback: async (editor, ctx) => {
                this.app.vault.process(ctx.file, (content) => {
                    const results = this.doLint(ctx.file.name, content);
                    return this.doFixes(content, results);
                });
            },
        });

        // TODO: commands:
        // - provide default config file (setting)
    }

    async onunload(): Promise<void> {
        this.cmExtension.length = 0;
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
        console.log("👀 LP Lint results", `\n${lintResult.toString()}`);
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
        if (!this.config) {
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
}
