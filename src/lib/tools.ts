export type ToolCategory =
  | "Privacy"
  | "Images"
  | "PDF"
  | "Creator"
  | "Video & Audio";

export type ToolIcon =
  | "image"
  | "compress"
  | "webp"
  | "pdf"
  | "crop"
  | "audio";

export type ToolStatus = "ready" | "in-progress";

export interface Tool {
  slug: string;
  name: string;
  url: string;
  description: string;
  short: string;
  /** Flip to "ready" when the tool ships. Badges and wording follow. */
  status: ToolStatus;
  category: ToolCategory;
  icon: ToolIcon;
}

export const tools: Tool[] = [
  {
    slug: "remove-exif-data",
    name: "EXIF & GPS Remover",
    url: "/remove-exif-data",
    description:
      "See and remove hidden camera, date and GPS data from your photos before you share them.",
    short: "Find and remove GPS, camera and date data",
    status: "ready",
    category: "Privacy",
    icon: "image",
  },
  {
    slug: "compress-image",
    name: "Image Compressor",
    url: "/compress-image",
    description:
      "Shrink JPG, PNG and WebP images by quality or exact target size — perfect for forms and email.",
    short: "Shrink photos to a quality or target size",
    status: "ready",
    category: "Images",
    icon: "compress",
  },
  {
    slug: "image-to-webp",
    name: "Image to WebP",
    url: "/image-to-webp",
    description:
      "Convert JPG and PNG images to modern WebP for smaller files and faster websites.",
    short: "Convert JPG and PNG to smaller WebP",
    status: "ready",
    category: "Images",
    icon: "webp",
  },
  {
    slug: "split-pdf",
    name: "PDF Splitter",
    url: "/split-pdf",
    description:
      "Extract selected pages or split a PDF into separate files, right in your browser.",
    short: "Pull pages out of a PDF or split it up",
    status: "ready",
    category: "PDF",
    icon: "pdf",
  },
  {
    slug: "youtube-thumbnail-safe-zone",
    name: "Thumbnail Safe-Zone Previewer",
    url: "/youtube-thumbnail-safe-zone",
    description:
      "Preview your YouTube thumbnail at real sizes and see which areas get covered.",
    short: "See your thumbnail at real sizes",
    status: "ready",
    category: "Creator",
    icon: "crop",
  },
  {
    slug: "video-to-mp3",
    name: "Video to MP3",
    url: "/video-to-mp3",
    description:
      "Turn your own video or audio files into MP3 at 128, 192 or 320 kbps.",
    short: "Turn your own video or audio into MP3",
    status: "ready",
    category: "Video & Audio",
    icon: "audio",
  },
];

export const toolCategories: ToolCategory[] = [
  "Privacy",
  "Images",
  "PDF",
  "Creator",
  "Video & Audio",
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export function getRelatedTools(slug: string, count = 3): Tool[] {
  const current = getTool(slug);
  if (!current) return tools.slice(0, count);

  const sameCategory = tools.filter(
    (tool) => tool.slug !== slug && tool.category === current.category,
  );
  const otherCategories = tools.filter(
    (tool) => tool.slug !== slug && tool.category !== current.category,
  );

  return [...sameCategory, ...otherCategories].slice(0, count);
}
