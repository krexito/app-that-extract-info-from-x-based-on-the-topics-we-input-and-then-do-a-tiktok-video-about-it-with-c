import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export interface TikTokUploadRequest {
  video_url: string;
  title: string;
  description: string;
  hashtags: string[];
  captions_text: string;
  platform?: "tiktok" | "youtube_shorts";
}

export interface TikTokUploadResponse {
  status: "uploaded" | "pending" | "failed" | "no_credentials";
  platform: "tiktok" | "youtube_shorts";
  tiktok_url?: string;
  youtube_url?: string;
  post_id?: string;
  message: string;
  share_url?: string;
}

async function uploadToTikTok(
  videoUrl: string,
  title: string,
  description: string,
  hashtags: string[]
): Promise<TikTokUploadResponse> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const openId = process.env.TIKTOK_OPEN_ID;

  if (!accessToken || !openId) {
    return {
      status: "no_credentials",
      platform: "tiktok",
      message:
        "TikTok credentials not configured. Add TIKTOK_ACCESS_TOKEN and TIKTOK_OPEN_ID to your .env.local file to enable auto-upload.",
      share_url: `https://www.tiktok.com/upload?title=${encodeURIComponent(title)}`,
    };
  }

  try {
    // Step 1: Initialize upload
    const initResponse = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        post_info: {
          title: `${title} ${hashtags.slice(0, 5).join(" ")}`.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    );

    const publishId = initResponse.data?.data?.publish_id;

    if (!publishId) {
      throw new Error("No publish_id returned from TikTok");
    }

    // Step 2: Check status
    const statusResponse = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      { publish_id: publishId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    );

    const uploadStatus = statusResponse.data?.data?.status;

    return {
      status: uploadStatus === "PUBLISH_COMPLETE" ? "uploaded" : "pending",
      platform: "tiktok",
      post_id: publishId,
      message:
        uploadStatus === "PUBLISH_COMPLETE"
          ? "Successfully uploaded to TikTok! 🎉"
          : "Video is being processed by TikTok. It will appear on your profile shortly.",
      tiktok_url: `https://www.tiktok.com/@me`,
    };
  } catch (error) {
    console.error("TikTok upload error:", error);

    if (axios.isAxiosError(error)) {
      const errorMsg =
        error.response?.data?.error?.message || error.message;
      return {
        status: "failed",
        platform: "tiktok",
        message: `TikTok upload failed: ${errorMsg}. Please check your credentials and try again.`,
      };
    }

    return {
      status: "failed",
      platform: "tiktok",
      message: "Failed to upload to TikTok. Please try again.",
    };
  }
}

function buildYouTubeShortsResponse(title: string): TikTokUploadResponse {
  const shareUrl = `https://www.youtube.com/upload?title=${encodeURIComponent(title)}`;
  return {
    status: "no_credentials",
    platform: "youtube_shorts",
    message:
      "YouTube Shorts auto-upload is not configured in this template yet. Use the provided YouTube Studio upload link to publish manually.",
    share_url: shareUrl,
    youtube_url: "https://www.youtube.com/shorts",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TikTokUploadRequest;
    const { video_url, title, description, hashtags, captions_text, platform } = body;
    const targetPlatform = platform === "youtube_shorts" ? "youtube_shorts" : "tiktok";

    if (!title) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }

    // If no video URL, we can't upload but can provide instructions
    if (!video_url) {
      return NextResponse.json({
        status: "pending",
        platform: targetPlatform,
        message:
          targetPlatform === "tiktok"
            ? "No video URL provided. Generate a video first using a video API (D-ID or Runway), then upload to TikTok."
            : "No video URL provided. Generate a video first, then upload to YouTube Shorts.",
        share_url: targetPlatform === "tiktok" ? "https://www.tiktok.com/upload" : "https://studio.youtube.com",
      } as TikTokUploadResponse);
    }

    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
    const fullDescription = `${description}\n\n${captions_text || ""}\n\n${safeHashtags.join(" ")}`.substring(0, 2200);

    if (targetPlatform === "youtube_shorts") {
      return NextResponse.json(buildYouTubeShortsResponse(title));
    }

    const result = await uploadToTikTok(
      video_url,
      title,
      fullDescription,
      safeHashtags
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload TikTok error:", error);
    return NextResponse.json(
      { error: "Failed to process upload request" },
      { status: 500 }
    );
  }
}
