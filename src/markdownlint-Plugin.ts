import { parseYaml, Plugin, TFile } from 'obsidian';
import markdownlintLibrary, { Configuration, LintError, Options } from 'markdownlint';
import { applyFixes } from 'markdownlint-rule-helpers';
import { linter, Diagnostic, LintSource } from "@codemirror/lint";
import { Extension } from '@codemirror/state';

export class MarkdownlintPlugin extends Plugin {
    /** CodeMirror 6 extensions. Tracked via array to allow for dynamic updates. */
    private cmExtension: Extension[] = [];

    private configFileGlob = /\.markdownlint.(json|yaml|yml)/;
    private configFileNames = [
        ".markdownlint.json",
        ".markdownlint.yaml",
        ".markdownlint.yml",
    ];

    private config: Configuration = {
        "default": true,
        "ul-indent": {
            "indent": 4
        },
        "line-length": {
            "code_blocks": false,
            "line_length": 120,
            "tables": false
        },
        "single-h1": {
            "front_matter_title": ""
        },
        "no-inline-html": {
            "allowed_elements": [
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
            ]
        },
        "hr-style": {
            style: "---"
        },
        "MD042": false,
    };

    async onload(): Promise<void> {
        console.info("loading Markdownlint v" + this.manifest.version,
            "using markdownlint v" + markdownlintLibrary.getVersion());

        this.registerEditorExtension(this.cmExtension);
        this.cmExtension.push(linter(this.lintSource));

        this.app.workspace.onLayoutReady(async () => {
            await this.findConfig();
        });

        this.addCommand({
            id: "reload-config",
            name: "Reload Configuration",
            icon: "monitor-cog",
            callback: async () => {
                await this.findConfig();
            }
        });

        // TODO: commands:
        // - provide default config file (setting)
        // - reload configuration file
        // - lint current file
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
        console.log('🤷 markdownlint: no configuration file found');
    }

    async loadConfig(name: string): Promise<void> {
        const content = await this.app.vault.adapter.read(name);
        if (name.endsWith('.json')) {
            this.config = JSON.parse(content);
        } else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
            this.config = parseYaml(content);
        }
        console.log('🛠️ markdownlint:', name, this.config);
    }

    doLint(content: string): { fixable: LintError[], unfixable: LintError[] } {
        const options: Options = {
            "strings": {
                "content": content
            },
            "config": this.config,
            "handleRuleFailures": true
        };
        const results = markdownlintLibrary.sync(options);
        const fixable: LintError[] = [];
        const unfixable: LintError[] = [];
        results.content.forEach((e) => {
            if (e.fixInfo) {
                fixable.push(e);
            } else {
                unfixable.push(e);
            }
        });
        return {
            fixable,
            unfixable
        }
    }

    doFixes(f: TFile, content: string, results: LintError[]): string {
        if (results.length !== 0) {
            const patched = applyFixes(content, results);
            if (patched !== content) {
                console.log('🔧 Fixed', f.path);
                return patched;
            }
        }
        return content;
    }

    // Hook into CodeMirror lint support
    lintSource: LintSource = async (view) => {
        if (!this.config) {
            return;
        }
        const activeFile = this.app.workspace.getActiveFile();
        const doc = view.state.doc;

        const { fixable, unfixable } = this.doLint(doc.toString());
        console.log('👀 LP Lint results', 'fixable', fixable, 'unfixable', unfixable);

        const diagnostics: Diagnostic[] = [];
        for (const result of unfixable) {
            const diagnostic: Diagnostic = {
                from: doc.line(result.lineNumber).from,
                to: doc.line(result.lineNumber).to,
                message: result.ruleNames.join("/")
                    + ": " + result.ruleDescription
                    + " (" + result.ruleInformation + ")"
                    + (result.errorDetail ? " [" + result.errorDetail + "]" : ""),
                severity: 'error',
                source: 'markdownlint',
            };
            diagnostics.push(diagnostic);
        }

        await this.app.vault.process(activeFile, (content) => {
            return this.doFixes(activeFile, content, fixable);
        });
        return diagnostics;
    };
}
