# Contribution Guidelines

Contributions are welcome! Please follow these steps to contribute:

- [Legal](#legal)
- [Codestyle and Practices](#codestyle-and-practices)
- [Building](#building)
- [Submitting Issues](#submitting-issues)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Commit messages](#commit-messages)

## Legal

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Codestyle and Practices

Please use the [Editorconfig](https://editorconfig.org/) plugin for your IDE of choice so we don't have arguments over whitespace.

I also recommend a [markdownlint](https://github.com/DavidAnson/markdownlint) plugin. ;)

## Building

```console
# Build once + lint
npm run build

# Build and watch for changes
npm run dev
```

Set an OUTDIR value in a `.env` file to have built artifacts written to the location of your choice, like the markdownlint directory in .obsidian/plugins of a vault. (Install the plugin first)

Example:

```text
OUTDIR=/path/to/vault/.obsidian/plugins/markdownlint
```

## Submitting Issues

If you encounter any issues or have suggestions for improvements, please submit an issue on GitHub. Include the following information:

- A clear and descriptive title
- A detailed description of the issue or suggestion
- Steps to reproduce the issue (if applicable)
- Any relevant screenshots or logs

## Submitting Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Make your changes
4. Commit your changes (`git commit -m '✨ Add new feature'`), see [Commit messages](#commit-messages)
5. Push to the branch (`git push origin feature-branch`)
6. Open a pull request

When you create pull requests, avoid unnecessary changes. If you have code cleanup changes that have no behavioral impact, keep those in a separate commit from those that do (to use an analogy: keep the signal and the noise in separate commits). This makes the PR easier to review overall.

## Commit messages

I use [gitmoji](https://gitmoji.dev/) in my commit messages. And by that, I mean the emoji, not the text description of the emoji. I find emoji to be more concise and descriptive (and fun!). It's also easier to combine them, given that sometimes you have a new feature that also addresses a bug (✨🐛), even if it is a well-scoped change.

Some exceptions to general gitmoji conventions:

- Lipstick (💄) is lame. I don't have UI or style files in this repo, but if I did, I would use the art palatte (🎨) for those.
- The siren (🚨) is also not a great fit for fixing lint errors. Depending on what needs to be fixed, use a bandage (🩹) or a broom (🧹) instead.

Thank you for your interest in contributing!
