# Obsidian Markdownlint Plugin

This plugin uses the [markdownlint](https://github.com/DavidAnson/markdownlint) library to lint files in your vault.

This plugin supports a subset of files supported by [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2). Specifically `.markdownlint.json`, `.markdownlint.yaml`, or `.markdownlint.yml`.[^1]

[^1]: Other formats require interpretation or use parsers that don't work well as an Obsidian plugin, in my experience. If you have a favorite format beyond these few, I welcome your help in making it work. Otherwise, it is what it is.

## Installation

### Preview with Beta Reviewers Auto-update Tester (BRAT)

1. Install BRAT
    1. Open `Settings` -> `Community Plugins`
    2. Disable safe mode
    3. *Browse*, and search for "BRAT"
    4. Install the latest version of **Obsidian 42 - BRAT**
2. Open BRAT settings (`Settings` -> `Obsidian 42 - BRAT`)
    1. Scroll to the `Beta Plugin List` section
    2. `Add Beta Plugin`
    3. Specify this repository: `ebullient/obsidian-markdownlint`
3. Enable the plugin (`Settings` -> `Community Plugins`)

## Using the plugin

If one of the supported config files (listed above) is present, markdown files will be linted with markdownlint following the configured rules.

Issues with your file will be highlighted in the editor for you to fix as you go.
