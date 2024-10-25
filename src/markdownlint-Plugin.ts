import { parseYaml, Plugin } from 'obsidian';
import markdownlintLibrary, { Configuration, LintError, Options } from 'markdownlint';
import { applyFixes } from 'markdownlint-rule-helpers';
import { linter, Diagnostic, LintSource, Action } from "@codemirror/lint";
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
        this.cmExtension.push(linter(this.lintSource, {
            "delay": 1500
        }));

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

    doLint(content: string): LintError[] {
        const options: Options = {
            "strings": {
                "content": content
            },
            "config": this.config,
            "handleRuleFailures": true
        };
        const lintResult = markdownlintLibrary.sync(options);
        console.log('👀 LP Lint results', '\n'+lintResult.toString());

        return lintResult.content;
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
    lintSource: LintSource = async (view) => {
        if (!this.config) {
            return;
        }
        const doc = view.state.doc;
        const diagnostics: Diagnostic[] = [];
        const lintErrors = this.doLint(doc.toString());

        for (const error of lintErrors) {
            const diagnostic: Diagnostic = {
                from: doc.line(error.lineNumber).from,
                to: doc.line(error.lineNumber).to,
                message: error.ruleNames.join("/")
                    + ": " + error.ruleDescription
                    + (error.errorDetail ? " [" + error.errorDetail + "]" : ""),
                severity: 'error',
                source: 'markdownlint',
            };
            // if (error.fixInfo) {
            //     if (fixInfo.in)
            //     const action: Action = {
            //         name: 'Fix ' + error.ruleNames.join("/"),
            //         apply: (view, from, to) => {
            //             console.log(from, to);
            //         }
            //     }
            //     diagnostic.actions = [action];
            // }
            diagnostics.push(diagnostic);
        }

        return diagnostics;
    };
}
