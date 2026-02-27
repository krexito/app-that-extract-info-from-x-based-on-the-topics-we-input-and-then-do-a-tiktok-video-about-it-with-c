import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron Job — Auto-generate TikTok videos from trending topics
 *
 * Schedule: every hour (configured in vercel.json)
 * Endpoint: GET /api/cron/auto-generate
 *
 * Security: protected by CRON_SECRET env var.
 * Vercel automatically sends the Authorization header when invoking cron routes.
 *
 * Required env vars:
 *   CRON_SECRET          — random secret, set in Vercel dashboard
 *   AUTO_TOPICS          — comma-separated list of topics to track (optional)
 *                          e.g. "AI,crypto,gaming,tech"
 *
 * Optional env vars (same as the main app):
 *   TWITTER_BEARER_TOKEN — real X data
 *   DID_API_KEY / RUNWAY_API_KEY / HUGGINGFACE_API_TOKEN / PEXELS_API_KEY
 *   TIKTOK_ACCESS_TOKEN + TIKTOK_OPEN_ID — auto-upload
 */

const DEFAULT_TOPICS = ["AI", "crypto", "gaming", "tech", "science"];

export async function GET(request: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  console.log(`[cron] auto-generate started at ${startedAt}`);

  // ── Resolve topics ──────────────────────────────────────────────────────────
  const rawTopics = process.env.AUTO_TOPICS;
  const topics = rawTopics
    ? rawTopics.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3)
    : DEFAULT_TOPICS.slice(0, 3);

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const results: {
    topic: string;
    status: "success" | "error";
    videoStatus?: string;
    uploadStatus?: string;
    error?: string;
  }[] = [];

  try {
    // ── Step 1: Extract data for all topics ─────────────────────────────────
    const extractRes = await fetch(`${baseUrl}/api/extract-x`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics }),
    });

    if (!extractRes.ok) {
      const err = await extractRes.json();
      throw new Error(`Extract failed: ${err.error || extractRes.statusText}`);
    }

    const { results: extractedData } = await extractRes.json();

    // ── Step 2: Generate videos in parallel ──────────────────────────────────
    const videoPromises = extractedData.map(
      async (topicData: {
        topic: string;
        summary: string;
        key_points: string[];
        hashtags: string[];
      }) => {
        try {
          const videoRes = await fetch(`${baseUrl}/api/generate-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: topicData.topic,
              summary: topicData.summary,
              key_points: topicData.key_points,
              hashtags: topicData.hashtags,
            }),
          });

          if (!videoRes.ok) {
            const err = await videoRes.json();
            results.push({ topic: topicData.topic, status: "error", error: err.error });
            return null;
          }

          const videoData = await videoRes.json();

          // ── Step 3: Upload to TikTok ───────────────────────────────────────
          const captionsText = videoData.script.captions
            .map((c: { text: string }) => c.text)
            .join(" | ");

          const uploadRes = await fetch(`${baseUrl}/api/upload-tiktok`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              video_url: videoData.video_url || "",
              title: videoData.script.title,
              description: topicData.summary,
              hashtags: topicData.hashtags,
              captions_text: captionsText,
            }),
          });

          const uploadData = await uploadRes.json();

          results.push({
            topic: topicData.topic,
            status: "success",
            videoStatus: videoData.status,
            uploadStatus: uploadData.status,
          });

          return videoData;
        } catch (err) {
          results.push({
            topic: topicData.topic,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
          return null;
        }
      }
    );

    await Promise.all(videoPromises);
  } catch (err) {
    console.error("[cron] auto-generate error:", err);
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        error: err instanceof Error ? err.message : "Cron job failed",
        results,
      },
      { status: 500 }
    );
  }

  const successCount = results.filter((r) => r.status === "success").length;
  console.log(`[cron] auto-generate done: ${successCount}/${results.length} succeeded`);

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    topics,
    results,
    summary: `${successCount}/${results.length} videos generated successfully`,
  });
}
