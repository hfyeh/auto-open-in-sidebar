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
      void this.syncSelectedCanvasFileToSidebar();
    });
  }

  private getActiveCanvasView(): CanvasViewLike | null {
    const activeView = this.app.workspace.getActiveViewOfType(ItemView);
    if (!activeView || activeView.getViewType() !== "canvas") {
      return null;
    }

    return activeView as CanvasViewLike;
  }

  private getSelectedMarkdownFileFromCanvas(): TFile | null {
    const canvasView = this.getActiveCanvasView();
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

  private async syncSelectedCanvasFileToSidebar(): Promise<void> {
    const selectedFile = this.getSelectedMarkdownFileFromCanvas();
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
