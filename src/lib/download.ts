import JSZip from "jszip";

export interface ZipFile {
  name: string;
  blob: Blob;
}

export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  let index = 2;
  let candidate = `${base} (${index})${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base} (${index})${extension}`;
  }

  used.add(candidate);
  return candidate;
}

export async function saveZip(
  files: ZipFile[],
  zipName = "files.zip",
): Promise<void> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const file of files) {
    zip.file(uniqueName(file.name, usedNames), file.blob);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
  });

  saveFile(blob, zipName);
}
