import type { EditorView } from "@codemirror/view";

export interface ObsidianCommandInterface {
    commands: {
        "editor:save-file": {
            checkCallback(checking: boolean): boolean | undefined;
        };
    };
}

declare module "obsidian" {
    interface App {
        commands: ObsidianCommandInterface;
    }

    interface Editor {
        cm?: EditorView;
    }
}
