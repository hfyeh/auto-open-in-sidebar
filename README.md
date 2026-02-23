# Auto Open In Sidebar

Obsidian plugin: when you select a Markdown note in Canvas (or a linked note element in Excalidraw), it opens that note in a dedicated tab in the right sidebar.

## Behavior

- Responds to Canvas file-card selections and Excalidraw single-element link selections.
- Only opens links that resolve to `.md` notes.
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
