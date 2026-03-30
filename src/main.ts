import { ItemView, Menu, Plugin, TFile, WorkspaceLeaf, setIcon } from "obsidian";

interface CanvasElementLike {
  file?: TFile;
  getData?: () => { type?: string };
}

interface CanvasLike {
  selection?: Set<CanvasElementLike>;
}

interface CanvasViewLike extends ItemView {
  canvas?: CanvasLike;
}

interface ExcalidrawViewLike extends ItemView {
  excalidrawAPI?: {
    getAppState: () => { selectedElementIds?: Record<string, boolean> };
    getSceneElements: () => Array<{ id: string; link?: string; type?: string }>;
  };
  file?: TFile;
}

export default class AutoOpenInSidebarPlugin extends Plugin {
  private sidebarLeaf: WorkspaceLeaf | null = null;
  private selectionCheckQueued = false;
  private selectionCheckFrameId: number | null = null;

  onload(): void {
    // Auto-update sidebar when it is already open and the user clicks another note.
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleSelectionCheck()));
    this.registerDomEvent(document, "pointerup", () => this.scheduleSelectionCheck());
    this.registerDomEvent(document, "keyup", () => this.scheduleSelectionCheck());

    // Double-click on a note opens it in the sidebar even if the sidebar was closed.
    this.registerDomEvent(document, "dblclick", () => this.handleDoubleClick());

    // Canvas right-click node menu.
    this.registerEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app.workspace as any).on("canvas:node-menu", (menu: Menu, node: CanvasElementLike) => {
        this.addCanvasNodeMenuItem(menu, node);
      })
    );
  }

  onunload(): void {
    if (this.selectionCheckFrameId !== null) {
      window.cancelAnimationFrame(this.selectionCheckFrameId);
      this.selectionCheckFrameId = null;
    }

    this.sidebarLeaf = null;
    this.selectionCheckQueued = false;
  }

  private scheduleSelectionCheck(): void {
    if (this.selectionCheckQueued) {
      return;
    }

    this.selectionCheckQueued = true;
    this.selectionCheckFrameId = window.requestAnimationFrame(() => {
      this.selectionCheckQueued = false;
      this.selectionCheckFrameId = null;
      void this.syncSelectedFileToSidebar();
    });
  }

  private handleDoubleClick(): void {
    const file = this.getSelectedMarkdownFileFromCanvas() ?? this.getSelectedMarkdownFileFromExcalidraw();
    if (file) {
      void this.openFileInSidebar(file);
    }
  }

  private addCanvasNodeMenuItem(menu: Menu, node: CanvasElementLike): void {
    const file = node.file;
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (node.getData?.().type !== "file") return;

    menu.addItem((item) => {
      item
        .setTitle("Open in sidebar")
        .setIcon("panel-right")
        .onClick(() => void this.openFileInSidebar(file));
    });
  }

  private getSelectedMarkdownFileFromCanvas(): TFile | null {
    const activeView = this.app.workspace.getActiveViewOfType(ItemView);
    if (!activeView || activeView.getViewType() !== "canvas") {
      return null;
    }

    const canvasView = activeView as CanvasViewLike;
    const selection = canvasView?.canvas?.selection;

    if (!selection || selection.size !== 1) {
      return null;
    }

    const selectedElement = selection.values().next().value;
    if (!selectedElement || selectedElement.getData?.().type !== "file") {
      return null;
    }

    const file = selectedElement.file;
    if (!(file instanceof TFile) || file.extension !== "md") {
      return null;
    }

    return file;
  }

  private getSelectedMarkdownFileFromExcalidraw(): TFile | null {
    const activeView = this.app.workspace.getActiveViewOfType(ItemView);
    if (!activeView || activeView.getViewType() !== "excalidraw") {
      return null;
    }

    const excalidrawView = activeView as ExcalidrawViewLike;
    const excalidrawAPI = excalidrawView.excalidrawAPI;
    if (!excalidrawAPI) {
      return null;
    }

    const appState = excalidrawAPI.getAppState();
    const selectedElementIds = appState?.selectedElementIds;
    if (!selectedElementIds) {
      return null;
    }

    const selectedIds = Object.keys(selectedElementIds).filter(id => selectedElementIds[id]);
    if (selectedIds.length !== 1) {
      return null;
    }

    const selectedId = selectedIds[0];
    const elements = excalidrawAPI.getSceneElements();
    const selectedElement = elements.find((el) => el.id === selectedId);

    if (!selectedElement || !selectedElement.link) {
      return null;
    }

    const link = selectedElement.link;

    // Handle Obsidian links like [[Filename]], [[Filename#Section]], [[Filename|Alias]]
    const match = link.match(/^\[\[([^\]|#]+)(?:[\]|#|])/);
    const linkpath = match?.[1] || link;

    const file = this.app.metadataCache.getFirstLinkpathDest(linkpath, excalidrawView.file?.path || "");
    if (file instanceof TFile && file.extension === "md") {
      return file;
    }

    return null;
  }

  private isLeafUsable(leaf: WorkspaceLeaf | null): leaf is WorkspaceLeaf {
    return !!leaf && Boolean((leaf as WorkspaceLeaf & { parent?: unknown }).parent);
  }

  private isSidebarLeafAlreadyShowing(file: TFile): boolean {
    if (!this.isLeafUsable(this.sidebarLeaf)) {
      return false;
    }

    const viewWithFile = this.sidebarLeaf.view as ItemView & { file?: TFile };
    return viewWithFile.getViewType() === "markdown" && viewWithFile.file?.path === file.path;
  }

  private ensureSidebarLeaf(): WorkspaceLeaf | null {
    if (this.isLeafUsable(this.sidebarLeaf)) {
      return this.sidebarLeaf;
    }

    // getRightLeaf(false) reuses an existing right sidebar leaf without creating a split.
    // Fall back to getRightLeaf(true) only when the sidebar has no leaves at all.
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getRightLeaf(true);
    this.sidebarLeaf = leaf;
    return leaf;
  }

  private setSidebarLeafIcon(leaf: WorkspaceLeaf): void {
    // Override getIcon so the book icon persists across Obsidian's tab re-renders.
    leaf.view.getIcon = () => "book-open";

    // Also apply directly to the DOM right now.
    const tabHeaderEl = (leaf as WorkspaceLeaf & { tabHeaderEl?: HTMLElement }).tabHeaderEl;
    const iconEl = tabHeaderEl?.querySelector<HTMLElement>(".workspace-tab-header-inner-icon");
    if (iconEl) {
      setIcon(iconEl, "book-open");
    }
  }

  // Auto-update: only runs when the sidebar tab is already open.
  private async syncSelectedFileToSidebar(): Promise<void> {
    if (!this.isLeafUsable(this.sidebarLeaf)) {
      return;
    }

    const selectedFile = this.getSelectedMarkdownFileFromCanvas() ?? this.getSelectedMarkdownFileFromExcalidraw();
    if (!selectedFile || this.isSidebarLeafAlreadyShowing(selectedFile)) {
      return;
    }

    await this.openFileInSidebar(selectedFile);
  }

  private async openFileInSidebar(file: TFile): Promise<void> {
    const leaf = this.ensureSidebarLeaf();
    if (!leaf) return;

    await leaf.openFile(file, { active: false });
    this.app.workspace.revealLeaf(leaf);
    this.setSidebarLeafIcon(leaf);
  }
}
