# Auto Open In Sidebar

Obsidian plugin: when you select a Markdown note card in Canvas, it opens that note in a dedicated tab in the right sidebar.

## Behavior

- Only responds to Canvas selections.
- Only responds to file cards that resolve to `.md` notes.
- Reuses one dedicated right-sidebar tab globally.
- If the selected note is already shown in that sidebar tab, it does nothing.

## Development

```bash
npm install
npm run build
```

Then copy `manifest.json`, `main.js`, and optionally `styles.css` into:

```text
<Vault>/.obsidian/plugins/auto-open-in-sidebar/
```
