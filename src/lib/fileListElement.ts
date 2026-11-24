import { saveFile, saveZip } from "./download";
import { formatBytes } from "./formatBytes";

export type FileStatus = "waiting" | "processing" | "done" | "error";

export interface FileListEntry {
  id: string;
  name: string;
  originalSize: number;
  newSize?: number;
  status: FileStatus;
  blob?: Blob;
  downloadName?: string;
  error?: string;
}

const STATUS_LABELS: Record<FileStatus, string> = {
  waiting: "Waiting",
  processing: "Working…",
  done: "Done",
  error: "Error",
};

function savedPercent(originalSize: number, newSize: number): number | null {
  if (originalSize <= 0 || newSize >= originalSize) return null;
  return Math.round(((originalSize - newSize) / originalSize) * 100);
}

export class FileListElement extends HTMLElement {
  private entries: FileListEntry[] = [];
  private zipName = "files.zip";

  connectedCallback() {
    this.zipName = this.dataset.zipName || "files.zip";
    this.render();
  }

  addFile(entry: FileListEntry) {
    this.entries.push(entry);
    this.render();
  }

  updateFile(id: string, patch: Partial<FileListEntry>) {
    const entry = this.entries.find((item) => item.id === id);
    if (!entry) return;

    Object.assign(entry, patch);
    this.render();
  }

  setFiles(entries: FileListEntry[]) {
    this.entries = [...entries];
    this.render();
  }

  clear() {
    this.entries = [];
    this.render();
  }

  setZipName(name: string) {
    this.zipName = name;
  }

  getFiles(): FileListEntry[] {
    return [...this.entries];
  }

  private render() {
    if (this.entries.length === 0) {
      this.hidden = true;
      this.replaceChildren();
      return;
    }

    this.hidden = false;

    const ready = this.entries.filter(
      (entry) => entry.status === "done" && entry.blob,
    );

    const head = document.createElement("div");
    head.className = "file-list__head";

    const summary = document.createElement("p");
    summary.className = "file-list__summary";
    summary.textContent =
      ready.length === this.entries.length
        ? `${this.entries.length} ${this.entries.length === 1 ? "file" : "files"} ready`
        : `${ready.length} of ${this.entries.length} ready`;
    head.append(summary);

    if (ready.length >= 2) {
      const zipButton = document.createElement("button");
      zipButton.type = "button";
      zipButton.className = "btn btn--small btn--ghost";
      zipButton.textContent = "Download all as ZIP";
      zipButton.addEventListener("click", () => {
        void this.downloadZip(zipButton, ready);
      });
      head.append(zipButton);
    }

    const list = document.createElement("ul");
    list.className = "file-list__items";

    for (const entry of this.entries) {
      list.append(this.renderRow(entry));
    }

    this.replaceChildren(head, list);
  }

  private renderRow(entry: FileListEntry): HTMLLIElement {
    const row = document.createElement("li");
    row.className = "file-row";
    row.dataset.status = entry.status;

    const info = document.createElement("div");
    info.className = "file-row__info";

    const name = document.createElement("span");
    name.className = "file-row__name";
    name.textContent = entry.name;
    info.append(name);

    const meta = document.createElement("span");
    meta.className = "file-row__meta";

    if (entry.status === "error" && entry.error) {
      meta.textContent = entry.error;
    } else if (entry.status === "done" && entry.newSize) {
      const percent = savedPercent(entry.originalSize, entry.newSize);
      const parts = [
        `${formatBytes(entry.originalSize)} → ${formatBytes(entry.newSize)}`,
      ];
      if (percent !== null) parts.push(`${percent}% smaller`);
      meta.textContent = parts.join(" · ");
    } else {
      meta.textContent = formatBytes(entry.originalSize);
    }

    info.append(meta);

    const status = document.createElement("span");
    status.className = `status status--${entry.status}`;
    status.textContent = STATUS_LABELS[entry.status];

    row.append(info, status);

    if (entry.status === "done" && entry.blob) {
      const download = document.createElement("button");
      download.type = "button";
      download.className = "btn btn--small";
      download.textContent = "Download";
      download.addEventListener("click", () => {
        if (!entry.blob) return;
        saveFile(entry.blob, entry.downloadName ?? entry.name);
      });
      row.append(download);
    }

    return row;
  }

  private async downloadZip(
    button: HTMLButtonElement,
    ready: FileListEntry[],
  ) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Zipping…";

    try {
      await saveZip(
        ready
          .filter((entry): entry is FileListEntry & { blob: Blob } =>
            Boolean(entry.blob),
          )
          .map((entry) => ({
            name: entry.downloadName ?? entry.name,
            blob: entry.blob,
          })),
        this.zipName,
      );
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

if (!customElements.get("file-list")) {
  customElements.define("file-list", FileListElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "file-list": FileListElement;
  }
}
