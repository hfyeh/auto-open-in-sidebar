import { ItemView, Plugin, TFile, WorkspaceLeaf } from "obsidian";

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
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleSelectionCheck()));
    this.registerDomEvent(document, "pointerup", () => this.scheduleSelectionCheck());
    this.registerDomEvent(document, "keyup", () => this.scheduleSelectionCheck());
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
    if (!link) {
      return null;
    }

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

    const leaf = this.app.workspace.getRightLeaf(true);
    this.sidebarLeaf = leaf;
    return leaf;
  }

  private async syncSelectedFileToSidebar(): Promise<void> {
    const selectedFile = this.getSelectedMarkdownFileFromCanvas() || this.getSelectedMarkdownFileFromExcalidraw();
    if (!selectedFile) {
      return;
    }

    if (this.isSidebarLeafAlreadyShowing(selectedFile)) {
      return;
    }

    const leaf = this.ensureSidebarLeaf();
    if (!leaf) {
      return;
    }

    await leaf.openFile(selectedFile, { active: false });
  }
}
