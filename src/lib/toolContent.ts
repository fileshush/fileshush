export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolContent {
  h1: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  howTo: string[];
  why: { title: string; text: string }[];
  does: string[];
  doesnt: string[];
  faqs: ToolFaq[];
  note?: string;
}

export const toolContent: Record<string, ToolContent> = {
  "remove-exif-data": {
    h1: "Remove EXIF Data from Photos",
    subtitle:
      "Strip hidden camera, date and location data from your photos.",
    metaTitle: "Remove EXIF Data & GPS From Photos",
    metaDescription:
      "Remove EXIF, GPS location and camera data from your photos. No upload, no sign-up — everything runs privately in your browser.",
    howTo: [
      "Drop one or more photos into the box above. JPG, PNG and WebP are supported.",
      "Check what we found: camera model, date taken and any GPS location.",
      "Choose “Remove everything”, or keep just the date and orientation.",
      "Download one cleaned photo, or all of them together as a ZIP.",
      "Run a cleaned file through the tool again to confirm the metadata is gone.",
    ],
    why: [
      {
        title: "Selling or giving away a phone",
        text: "Old photos can still contain the places you lived, worked and visited. Clean them before the phone leaves your hands.",
      },
      {
        title: "Posting on marketplaces and forums",
        text: "A photo of an item for sale can quietly include the GPS coordinates of your home. Remove them before you upload the file.",
      },
      {
        title: "Sending files to clients",
        text: "Camera model, software and edit history are often nobody's business. Strip the extras and keep the picture.",
      },
      {
        title: "Sharing in chats and email",
        text: "Some apps clean photos automatically, but the original file on your phone usually keeps its metadata. Clean it yourself once.",
      },
    ],
    does: [
      "Removes EXIF, GPS, camera make and model, date and orientation tags, plus XMP, IPTC and comment fields.",
      "Keeps the picture data untouched, so removing metadata does not reduce quality.",
      "Cleans many photos in one batch and downloads them as a ZIP.",
      "Shows exactly what was found before anything is removed, then checks the cleaned file again.",
    ],
    doesnt: [
      "It cannot remove metadata that was never there — those files are marked “Already clean”.",
      "It does not open HEIC photos yet; convert them to JPG first.",
      "A photo stored sideways is re-saved once to stay upright, which is the only case where pixels are re-encoded.",
      "Removed metadata cannot be restored, so keep the original file if you might need it.",
    ],
    faqs: [
      {
        q: "What is EXIF data?",
        a: "EXIF is hidden information stored inside a photo file. It can include the camera model, settings, the date and time, and sometimes the GPS coordinates of where the photo was taken.",
      },
      {
        q: "Can people really see my location from a photo?",
        a: "Yes, when the file still contains GPS tags. Many social apps strip metadata on upload, but email attachments, cloud links and chat files often do not.",
      },
      {
        q: "Do WhatsApp, Instagram or Facebook remove EXIF?",
        a: "They usually remove most metadata when you upload. The problem is the original file on your phone still has it, and that is the file you may send or share elsewhere later.",
      },
      {
        q: "Does removing EXIF reduce image quality?",
        a: "No. JPEG, PNG and WebP files are cleaned by removing the metadata blocks and copying the picture data unchanged. The one exception is a photo stored sideways with a rotation flag: it is re-saved once so it stays upright, and the result tells you when that happens.",
      },
      {
        q: "Are my photos uploaded?",
        a: "No. The files are opened and cleaned by code running in your browser. You can confirm this in your browser's Network tab. Offline support is coming.",
      },
      {
        q: "Can I keep the date but remove the location?",
        a: "Yes. Choose the option to keep the date and orientation while removing everything else, including GPS.",
      },
    ],
  },

  "compress-image": {
    h1: "Compress Images Online",
    subtitle:
      "Shrink JPG, PNG and WebP images by quality or exact target size.",
    metaTitle: "Compress Image to KB — No Upload",
    metaDescription:
      "Compress JPG, PNG and WebP images to a smaller size or an exact target in KB. Private, with no upload and no sign-up.",
    howTo: [
      "Drop one or more images into the box above.",
      "Pick a quality level, or switch to target-size mode and enter a limit such as 100 KB.",
      "Optionally set a maximum width or height to resize the image too.",
      "Compare the original and new size, then download one file or a ZIP.",
    ],
    why: [
      {
        title: "Job and exam application forms",
        text: "Many forms reject photos over 50 KB, 100 KB or 200 KB. Target-size mode gets you under the limit without guessing.",
      },
      {
        title: "Email and chat attachments",
        text: "Large phone photos hit attachment limits. A smaller file sends faster and still looks fine on a screen.",
      },
      {
        title: "Faster websites",
        text: "Heavy images are the most common reason a page feels slow. Compressing them improves loading time for every visitor.",
      },
      {
        title: "Freeing up storage",
        text: "Shrink screenshots and photos you need to keep instead of deleting them.",
      },
    ],
    does: [
      "Compresses JPG, PNG and WebP images in your browser.",
      "Supports quality mode and target-size mode, for example under 100 KB.",
      "Can resize images to a maximum width or height.",
      "Shows the size before and after, and downloads batches as a ZIP.",
    ],
    doesnt: [
      "Target-size mode gets close to the limit, but some images stop a little above or below the exact number.",
      "PNG files cannot be made lossy in the browser: a PNG saved as PNG only gets smaller by resizing. Save as JPG or WebP for big savings (JPG turns transparency white).",
      "RAW camera files and HEIC are not supported yet.",
    ],
    faqs: [
      {
        q: "How much can I compress an image without losing quality?",
        a: "Every photo is different. A quality setting around 75 percent usually looks the same on a screen while cutting the file size a lot. Compare the sizes, open the result and judge by eye.",
      },
      {
        q: "Can I compress an image to exactly 100 KB?",
        a: "Target-size mode tries a few quality levels to get as close as possible, usually within a few percent. It cannot hit the exact byte every time, so leave a small safety margin.",
      },
      {
        q: "Will compressing a PNG keep the transparent background?",
        a: "Yes, if you save it as PNG or WebP. JPG has no transparency, so transparent areas turn white. Note that PNG output is lossless, so it only shrinks by resizing.",
      },
      {
        q: "Are my images uploaded to a server?",
        a: "No. Compression runs locally in your browser. Your files never leave your device. Offline support is coming.",
      },
      {
        q: "Can I compress many images at once?",
        a: "Yes. Select several files, adjust the settings once, and download the results together as a ZIP.",
      },
    ],
  },

  "image-to-webp": {
    h1: "Convert JPG & PNG to WebP",
    subtitle:
      "Make modern WebP images for smaller files and faster websites.",
    metaTitle: "Image to WebP Converter — No Upload",
    metaDescription:
      "Convert JPG and PNG to WebP in your browser. Smaller files for faster sites. No upload, no sign-up, batch ZIP download.",
    howTo: [
      "Drop your JPG or PNG images into the box above.",
      "Choose a quality level, or use lossless mode for PNG artwork.",
      "Check how much smaller each WebP file is compared with the original.",
      "Download individual files or all of them as a ZIP.",
    ],
    why: [
      {
        title: "Website owners and bloggers",
        text: "WebP files are usually much smaller than JPG or PNG at the same visible quality, which helps pages load faster.",
      },
      {
        title: "Better Core Web Vitals",
        text: "Google uses page speed as a ranking signal. Lighter images are one of the easiest improvements you can make.",
      },
      {
        title: "Faster mobile visits",
        text: "Visitors on slow connections notice heavy images first. WebP keeps the page usable without a fast connection.",
      },
      {
        title: "Tidier storage",
        text: "Convert a folder of screenshots and photos to WebP and keep the same look with less disk space.",
      },
    ],
    does: [
      "Converts JPG and PNG images to WebP in your browser.",
      "Supports quality levels and a lossless option for PNG artwork.",
      "Handles batches and downloads them as a ZIP.",
      "Shows the size difference before you download.",
    ],
    doesnt: [
      "Animated GIF files are converted from the first frame only.",
      "WebP is well supported today, but very old browsers may not open it; keep the original if you need maximum compatibility.",
      "HEIC photos are not supported yet.",
    ],
    faqs: [
      {
        q: "What is WebP?",
        a: "WebP is an image format made by Google for the web. It usually produces smaller files than JPG or PNG at a similar visible quality.",
      },
      {
        q: "Is WebP supported in every browser?",
        a: "All current major browsers support WebP, including Chrome, Firefox, Safari, Edge and their mobile versions. Only very old browsers cannot open it.",
      },
      {
        q: "Should I use lossless WebP for photos?",
        a: "No. Lossless is best for logos, screenshots and flat artwork. Photos get much smaller with normal lossy compression and still look good.",
      },
      {
        q: "Are my images uploaded?",
        a: "No. The conversion runs in your browser. Nothing is sent to a server. Offline support is coming.",
      },
      {
        q: "Can I convert many images at once?",
        a: "Yes. Drop several JPG or PNG files, convert them together, and download everything as one ZIP.",
      },
    ],
  },

  "split-pdf": {
    h1: "Split PDF Pages Online",
    subtitle:
      "Extract pages or split a PDF into separate files.",
    metaTitle: "Split PDF & Extract Pages — No Upload",
    metaDescription:
      "Split a PDF or extract selected pages. Bank statements and IDs stay on your device. No upload, no sign-up, no server.",
    howTo: [
      "Drop one PDF into the box above and wait for the page thumbnails.",
      "Click the pages you want, or type a range such as 1-3, 5, 8.",
      "Choose to extract the selection, split every page, or split every N pages.",
      "Download the result as a single PDF or a ZIP of separate files.",
    ],
    why: [
      {
        title: "Bank statements and tax forms",
        text: "Send only the page a landlord or accountant asked for, without uploading the whole document to a random website.",
      },
      {
        title: "IDs and personal documents",
        text: "Passport scans, contracts and certificates stay on your device the whole time.",
      },
      {
        title: "Sending one chapter or form",
        text: "Pull a single page out of a long manual, report or application pack.",
      },
      {
        title: "Reorganising paperwork",
        text: "Split a scanned bundle into separate files so each document is easy to find later.",
      },
    ],
    does: [
      "Extracts selected pages into a new PDF.",
      "Splits every page into separate PDFs, or groups of N pages.",
      "Shows page thumbnails so you can pick the right pages visually.",
      "Runs entirely in your browser. Offline support is coming.",
    ],
    doesnt: [
      "Password-protected PDFs must be unlocked first; the tool cannot guess a password.",
      "Scanned pages are images, so this tool does not edit their text.",
      "Very large PDFs can be slow on older phones; a computer is more comfortable.",
    ],
    faqs: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. The PDF is read and rebuilt inside your browser. Nothing is sent anywhere, which is why bank statements and ID documents are safer here.",
      },
      {
        q: "Can I extract just one page?",
        a: "Yes. Click that page thumbnail or type its number, then choose extract selected pages.",
      },
      {
        q: "How do I split a PDF into single pages?",
        a: "Choose the “split every page” option. Each page becomes its own PDF, and you can download them together as a ZIP.",
      },
      {
        q: "Why does the tool say my PDF is password-protected?",
        a: "The file is encrypted. Open it in a PDF reader, enter the password and save an unlocked copy first, then try again.",
      },
      {
        q: "Will the split PDFs still open in Adobe Reader?",
        a: "Yes. The output uses the standard PDF format and opens in Adobe Reader, browsers and other common viewers.",
      },
    ],
  },

  "youtube-thumbnail-safe-zone": {
    h1: "YouTube Thumbnail Safe Zone",
    subtitle:
      "See how your thumbnail looks at real sizes, in light and dark mode.",
    metaTitle: "YouTube Thumbnail Safe Zone Checker",
    metaDescription:
      "Preview your YouTube thumbnail at real sizes, check 1280×720 and see covered safe zones. Private, with no upload.",
    howTo: [
      "Upload a thumbnail image, ideally 1280×720 pixels and 16:9.",
      "Read the size warning if the dimensions or file size are wrong.",
      "Preview the thumbnail in home, search and sidebar layouts, in light and dark mode.",
      "Try your title and channel name to see what gets covered.",
      "Compare two or three versions side by side before you publish.",
    ],
    why: [
      {
        title: "The timestamp box hides text",
        text: "YouTube covers the bottom-right corner with the video length. A title placed there simply disappears.",
      },
      {
        title: "Mobile makes everything smaller",
        text: "Text that looks fine on a big monitor can be unreadable in a phone feed. Preview at real size before publishing.",
      },
      {
        title: "Small details vanish",
        text: "Faces, logos and arrows need to survive being shrunk. The mock layouts show what viewers actually see.",
      },
      {
        title: "Compare versions",
        text: "Put two thumbnails side by side and pick the one that still reads well when it is tiny.",
      },
    ],
    does: [
      "Checks the image size and warns when it is not 1280×720.",
      "Overlays the areas that YouTube covers, including the timestamp box.",
      "Shows generic home, search, sidebar and mobile previews in light and dark mode.",
      "Includes a Shorts preview at 1080×1920 with button and caption areas marked.",
    ],
    doesnt: [
      "It does not upload or publish anything to YouTube.",
      "The mock layouts are simple illustrations, not a copy of YouTube's interface.",
      "It cannot guarantee how every device or experiment will crop the image.",
    ],
    faqs: [
      {
        q: "What size should a YouTube thumbnail be?",
        a: "YouTube recommends 1280×720 pixels, which is a 16:9 shape. The file should be under 2 MB and saved as JPG, PNG or GIF.",
      },
      {
        q: "What is the YouTube thumbnail safe zone?",
        a: "It is the area that stays visible after YouTube adds the timestamp, progress bar and other overlays. Keep important text and faces away from the bottom-right corner especially.",
      },
      {
        q: "Why does my thumbnail look bad on mobile?",
        a: "Phones show the thumbnail very small. Fine text and thin lines disappear. Use large, simple shapes and check the mobile preview before publishing.",
      },
      {
        q: "Is this tool affiliated with YouTube?",
        a: "No. It is an independent preview tool. The mock layouts are generic drawings made for this site, not official YouTube screens.",
      },
      {
        q: "Is my thumbnail uploaded anywhere?",
        a: "No. The image is displayed locally in your browser. It is never sent to a server.",
      },
    ],
    note: "Not affiliated with YouTube. Mock layouts are generic illustrations.",
  },

  "video-to-mp3": {
    h1: "Video to MP3 Converter",
    subtitle:
      "Convert your own MP4, MOV, WAV, M4A and more to MP3.",
    metaTitle: "Video to MP3 Converter — No Upload",
    metaDescription:
      "Convert your own MP4, MOV, WAV or M4A files to MP3 at 128–320 kbps. Private in-browser conversion.",
    howTo: [
      "Drop a video or audio file you own into the box above.",
      "Choose an MP3 bitrate: 128, 192 or 320 kbps.",
      "Optionally trim the start and end before converting.",
      "Wait for the progress bar, then download your MP3.",
    ],
    why: [
      {
        title: "Keep the audio, not the video",
        text: "Save a talk, interview or recording as a small audio file you can listen to anywhere.",
      },
      {
        title: "Podcast and voice clips",
        text: "Pull a short clip from your own recording without opening a video editor.",
      },
      {
        title: "Ringtones and sounds",
        text: "Turn a short piece of audio you recorded into an MP3 you can use on your phone.",
      },
      {
        title: "Smaller files",
        text: "Audio takes far less space than video. Convert once and keep the recording you need.",
      },
    ],
    does: [
      "Converts common video and audio formats to MP3.",
      "Lets you choose 128, 192 or 320 kbps and trim the start and end.",
      "Runs in your browser with a progress bar.",
      "Processes only files you select from your own device.",
    ],
    doesnt: [
      "It cannot download audio from YouTube, TikTok or any link. Converting other people's videos may break copyright rules.",
      "Large videos, especially over 1 GB, may be slow or fail on a phone.",
      "The first conversion downloads about 30 MB of converter code, so it needs an internet connection for that download. Offline support is coming.",
    ],
    faqs: [
      {
        q: "Can I convert a YouTube link to MP3?",
        a: "No. This tool only converts files you already have on your device. Downloading from YouTube or other platforms breaks their terms and copyright rules.",
      },
      {
        q: "Which formats can I convert?",
        a: "Common formats such as MP4, MOV, WEBM, MKV, WAV, M4A, OGG and FLAC. If a file is unusual or damaged, the converter will show an error.",
      },
      {
        q: "Which bitrate should I choose?",
        a: "128 kbps is fine for speech and casual listening. 192 kbps is a good all-round choice. Use 320 kbps only when you need the best quality and file size does not matter.",
      },
      {
        q: "Are my videos uploaded?",
        a: "No. The conversion runs inside your browser. The first visit downloads the converter code, but your files themselves are never sent to a server.",
      },
      {
        q: "Why is the first conversion slow?",
        a: "The browser has to download and start the conversion engine, which is around 30 MB. Later conversions on the same visit are faster.",
      },
      {
        q: "Can I trim the audio?",
        a: "Yes. Set a start and end time before converting to keep only the part you need.",
      },
    ],
  },
};

export function getToolContent(slug: string): ToolContent {
  const content = toolContent[slug];
  if (!content) {
    throw new Error(`Missing tool content for "${slug}"`);
  }
  return content;
}
