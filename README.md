# Fileshush

Private file tools that run entirely in your browser. Your files are never uploaded, and there is no account or sign-up.

Live site: https://fileshush.com

## Tools

| Tool | Path | What it does |
| :-- | :-- | :-- |
| EXIF & GPS Remover | `/remove-exif-data` | Shows hidden camera, date and GPS data in photos, then removes it (JPG, PNG, WebP). |
| Image Compressor | `/compress-image` | Shrinks JPG, PNG and WebP by quality or to a target size in KB. |
| Image to WebP | `/image-to-webp` | Converts JPG, PNG and GIF (first frame) to WebP, lossy or lossless. |
| PDF Splitter | `/split-pdf` | Extracts selected pages, or splits a PDF into single pages or chunks of N pages. |
| Thumbnail Safe-Zone Previewer | `/youtube-thumbnail-safe-zone` | Previews a thumbnail at real sizes, light and dark, with overlay zones and A/B compare. |
| Video to MP3 | `/video-to-mp3` | Converts your own video or audio files to MP3 (128, 192 or 320 kbps) with optional trim. |

## How privacy works

- All processing happens in your browser with JavaScript and WebAssembly.
- Files are never sent to a server. You can confirm this in your browser's Network tab.
- The one outside download is the MP3 converter engine (about 30 MB of code). It loads from jsDelivr after you choose a file. Your file is not part of that request.

## Tech

- [Astro](https://astro.build) (static output) with TypeScript
- `exifr`, `pdf-lib`, `pdfjs-dist`, `@jsquash/webp`, `@ffmpeg/ffmpeg`, `jszip`
- `@vite-pwa/astro` for the service worker
- Fonts: Bricolage Grotesque and Inter, self-hosted via `@fontsource`

## Getting started

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

The dev server runs at http://127.0.0.1:4321.

| Command | Action |
| :-- | :-- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Type-check with `astro check` |
| `npm test` | Run the unit tests |

## Project structure

```text
src/
  components/   UI components and the tool interfaces
  layouts/      Base and tool page layouts
  lib/          Tool list, page text, shared helpers
  pages/        One page per tool, plus About, Privacy, Terms, Contact
  tools/        Tool logic, kept free of UI code
  styles/       global.css (design tokens and styles)
tests/          Unit tests (node --test)
public/         Icons, manifest, robots.txt
brand/          Avatars and logo files
```

## Configuration

Site settings are in `src/config.ts`:

- `SITE_INDEXABLE`: keep `false` until you want search engines to index the site.
- `site.ads`: ads stay off until you fill in the client and slot values.
- `site.analytics.cloudflareToken`: analytics stays off until a token is set.

## Deploy

The site is static. Any static host works, for example Cloudflare:

1. Connect the repository.
2. Build command: `npm run build`.
3. Output directory: `dist`.
4. Node version: 22 or newer.

## Testing

`npm test` covers the pure logic of every tool: metadata stripping, page-range parsing, quality search, ffmpeg arguments and more. The browser interface and the ffmpeg conversion itself are not covered by automated tests, so try each tool by hand before a release.

## Notes

- Fileshush converts files you own. It does not download from links or video sites.
- The thumbnail previewer is not affiliated with YouTube.
