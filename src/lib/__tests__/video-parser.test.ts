import { describe, it, expect } from "vitest";
import { isVideoUrl, getYouTubeVideoId } from "../video-parser";

describe("isVideoUrl", () => {
  it("detects TikTok URLs", () => {
    expect(isVideoUrl("https://www.tiktok.com/@user/video/123456")).toBe("tiktok");
    expect(isVideoUrl("https://tiktok.com/@user/video/123456")).toBe("tiktok");
    expect(isVideoUrl("https://vm.tiktok.com/ABC123/")).toBe("tiktok");
  });

  it("detects YouTube URLs", () => {
    expect(isVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(isVideoUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(isVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
  });

  it("detects Instagram Reel URLs", () => {
    expect(isVideoUrl("https://www.instagram.com/reel/ABC123/")).toBe("instagram");
  });

  it("returns null for regular recipe URLs", () => {
    expect(isVideoUrl("https://www.allrecipes.com/recipe/12345/chicken")).toBe(null);
    expect(isVideoUrl("https://food.com/recipe/pasta")).toBe(null);
  });

  it("returns null for invalid URLs", () => {
    expect(isVideoUrl("not a url")).toBe(null);
    expect(isVideoUrl("")).toBe(null);
  });

  it("returns null for Instagram non-reel URLs", () => {
    expect(isVideoUrl("https://www.instagram.com/p/ABC123/")).toBe(null);
    expect(isVideoUrl("https://www.instagram.com/user/")).toBe(null);
  });
});

describe("getYouTubeVideoId", () => {
  it("extracts ID from standard URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from short URL", () => {
    expect(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(getYouTubeVideoId("https://tiktok.com/video/123")).toBe(null);
  });

  it("returns null for YouTube URL without video ID", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/")).toBe(null);
  });

  it("handles invalid URL", () => {
    expect(getYouTubeVideoId("not a url")).toBe(null);
  });
});
