// Video recipe extraction: detect platform, extract video URL, download, upload to Gemini
//
// Supported: TikTok (paste link → extract video URL from page → download → Gemini)
//            YouTube (paste link → pass to Gemini directly or download)
//            Instagram Reels (deferred)

import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";
import { tmpdir } from "os";

export type VideoPlatform = "tiktok" | "youtube" | "instagram";

/**
 * Detect if a URL is a video platform link.
 * Returns the platform name or null for regular URLs.
 */
export function isVideoUrl(url: string): VideoPlatform | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("tiktok.com") || host.includes("vm.tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("instagram.com") && url.includes("/reel")) return "instagram";

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the direct video download URL from a TikTok page.
 * TikTok embeds video data in __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON.
 */
export async function extractTikTokVideoUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Try __UNIVERSAL_DATA_FOR_REHYDRATION__ (primary)
    const universalMatch = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (universalMatch) {
      try {
        const data = JSON.parse(universalMatch[1]);
        // Navigate the nested structure to find video URL
        const defaultScope = data.__DEFAULT_SCOPE__;
        if (defaultScope) {
          const videoDetail = defaultScope["webapp.video-detail"];
          const videoData = videoDetail?.itemInfo?.itemStruct?.video;
          if (videoData?.downloadAddr) return videoData.downloadAddr;
          if (videoData?.playAddr) return videoData.playAddr;
        }
      } catch {
        // JSON parse failed, try fallback
      }
    }

    // Fallback: try SIGI_STATE
    const sigiMatch = html.match(/<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
    if (sigiMatch) {
      try {
        const data = JSON.parse(sigiMatch[1]);
        const items = data.ItemModule;
        if (items) {
          const firstKey = Object.keys(items)[0];
          if (firstKey) {
            const video = items[firstKey].video;
            if (video?.downloadAddr) return video.downloadAddr;
            if (video?.playAddr) return video.playAddr;
          }
        }
      } catch {
        // Fallback failed
      }
    }

    // Final fallback: og:video meta tag
    const ogMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/);
    if (ogMatch) return ogMatch[1];

    return null;
  } catch (error) {
    console.error("[video-parser] TikTok extraction failed:", error);
    return null;
  }
}

/**
 * Get YouTube video ID from a URL.
 */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Download a video to a temp file. Returns the file path.
 */
export async function downloadToTmp(videoUrl: string): Promise<string> {
  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = join(tmpdir(), `food-genie-video-${randomUUID()}.mp4`);
  await writeFile(filePath, buffer);

  return filePath;
}

/**
 * Upload a video file to Gemini's File API and return the file URI.
 */
export async function uploadToGeminiFileApi(filePath: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { readFile, stat } = await import("fs/promises");
  const fileData = await readFile(filePath);
  const fileStats = await stat(filePath);
  const numBytes = fileStats.size;

  // Step 1: Start resumable upload
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(numBytes),
        "X-Goog-Upload-Header-Content-Type": "video/mp4",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { display_name: `recipe-video-${Date.now()}` },
      }),
    }
  );

  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    console.error("[video-parser] Failed to get upload URL from Gemini File API");
    return null;
  }

  // Step 2: Upload the file bytes
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileData,
  });

  const result = await uploadRes.json();
  const fileUri = result.file?.uri;

  if (!fileUri) {
    console.error("[video-parser] No file URI in Gemini upload response:", result);
    return null;
  }

  // Step 3: Wait for processing (Gemini needs time to process video)
  const fileName = result.file?.name;
  if (fileName) {
    let state = result.file?.state;
    let attempts = 0;
    while (state === "PROCESSING" && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
      );
      const statusData = await statusRes.json();
      state = statusData.state;
      attempts++;
    }
    if (state !== "ACTIVE") {
      console.error("[video-parser] Video processing did not complete. State:", state);
      return null;
    }
  }

  return fileUri;
}

/**
 * Clean up a temp file. Best-effort, never throws.
 */
export function cleanupTmpFile(filePath: string): void {
  unlink(filePath).catch(() => {});
}
