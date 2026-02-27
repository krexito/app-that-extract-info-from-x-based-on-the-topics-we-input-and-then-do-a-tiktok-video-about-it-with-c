import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export interface Caption {
  text: string;
  start_time: number;
  end_time: number;
  style: "title" | "subtitle" | "highlight" | "normal";
}

export interface VideoScript {
  title: string;
  hook: string;
  sections: {
    heading: string;
    content: string;
    duration: number;
  }[];
  call_to_action: string;
  captions: Caption[];
  total_duration: number;
  background_style: string;
  music_mood: string;
}

export interface GenerateVideoResponse {
  script: VideoScript;
  video_url?: string;
  thumbnail_url?: string;
  status: "script_ready" | "generating" | "ready" | "error";
  message: string;
  job_id?: string;
  video_source?: "did" | "runway" | "huggingface" | "pexels" | "none";
}

// ─── Script builder ───────────────────────────────────────────────────────────

function buildVideoScript(
  topic: string,
  summary: string,
  keyPoints: string[],
  hashtags: string[]
): VideoScript {
  const hook = `🔥 ${topic.toUpperCase()} is BREAKING the internet right now`;
  const title = `Everything about ${topic} in 60 seconds`;

  const sections = keyPoints.slice(0, 4).map((point, i) => ({
    heading: `Point ${i + 1}`,
    content: point.length > 100 ? point.substring(0, 100) + "..." : point,
    duration: 8,
  }));

  const captions: Caption[] = [];
  let currentTime = 0;

  captions.push({
    text: hook,
    start_time: 0,
    end_time: 3,
    style: "title",
  });
  currentTime = 3;

  const summaryShort =
    summary.length > 120 ? summary.substring(0, 120) + "..." : summary;
  captions.push({
    text: summaryShort,
    start_time: currentTime,
    end_time: currentTime + 5,
    style: "subtitle",
  });
  currentTime += 5;

  sections.forEach((section, i) => {
    captions.push({
      text: `${i + 1}️⃣ ${section.content}`,
      start_time: currentTime,
      end_time: currentTime + section.duration,
      style: i === 0 ? "highlight" : "normal",
    });
    currentTime += section.duration;
  });

  const cta = `Follow for more! ${hashtags.slice(0, 4).join(" ")}`;
  captions.push({
    text: cta,
    start_time: currentTime,
    end_time: currentTime + 4,
    style: "highlight",
  });

  const totalDuration = currentTime + 4;

  return {
    title,
    hook,
    sections,
    call_to_action: cta,
    captions,
    total_duration: totalDuration,
    background_style: "dark_gradient",
    music_mood: "energetic",
  };
}

// ─── Apply user edits to a generated script ──────────────────────────────────

function applyEditsToScript(
  base: VideoScript,
  editedHook?: string,
  editedSections?: { heading: string; content: string; duration: number }[],
  editedCta?: string
): VideoScript {
  const hook = editedHook?.trim() || base.hook;
  const sections = editedSections && editedSections.length > 0 ? editedSections : base.sections;
  const cta = editedCta?.trim() || base.call_to_action;

  // Rebuild captions from edited content
  const captions: VideoScript["captions"] = [];
  let currentTime = 0;

  captions.push({ text: hook, start_time: 0, end_time: 3, style: "title" });
  currentTime = 3;

  const summaryShort = base.captions.find((c) => c.style === "subtitle")?.text || "";
  if (summaryShort) {
    captions.push({ text: summaryShort, start_time: currentTime, end_time: currentTime + 5, style: "subtitle" });
    currentTime += 5;
  }

  sections.forEach((section, i) => {
    captions.push({
      text: `${i + 1}️⃣ ${section.content}`,
      start_time: currentTime,
      end_time: currentTime + section.duration,
      style: i === 0 ? "highlight" : "normal",
    });
    currentTime += section.duration;
  });

  captions.push({ text: cta, start_time: currentTime, end_time: currentTime + 4, style: "highlight" });

  return {
    ...base,
    hook,
    sections,
    call_to_action: cta,
    captions,
    total_duration: currentTime + 4,
  };
}

// ─── D-ID API (trial: 20 free credits) ───────────────────────────────────────

async function generateWithDID(
  script: VideoScript
): Promise<{ video_url?: string; job_id?: string; status: string } | null> {
  const didApiKey = process.env.DID_API_KEY;
  if (!didApiKey) return null;

  try {
    const scriptText = [
      script.hook,
      ...script.sections.map((s) => s.content),
      script.call_to_action,
    ].join(". ");

    const response = await axios.post(
      "https://api.d-id.com/talks",
      {
        script: {
          type: "text",
          input: scriptText,
          provider: {
            type: "microsoft",
            voice_id: "en-US-JennyNeural",
          },
        },
        config: {
          fluent: true,
          pad_audio: 0,
        },
        source_url:
          "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg",
      },
      {
        headers: {
          Authorization: `Basic ${didApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return { job_id: response.data.id, status: "generating" };
  } catch (error) {
    console.error("D-ID API error:", error);
    return null;
  }
}

// ─── Runway ML API (paid, ~$0.05/sec) ────────────────────────────────────────

async function generateWithRunway(
  script: VideoScript,
  topic: string
): Promise<{ video_url?: string; job_id?: string; status: string } | null> {
  const runwayApiKey = process.env.RUNWAY_API_KEY;
  if (!runwayApiKey) return null;

  try {
    const response = await axios.post(
      "https://api.runwayml.com/v1/tasks",
      {
        taskType: "text_to_video",
        model: "gen3a_turbo",
        textPrompt: `TikTok style video about ${topic}: ${script.hook}`,
        duration: Math.min(script.total_duration, 10),
        ratio: "768:1280",
      },
      {
        headers: {
          Authorization: `Bearer ${runwayApiKey}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
      }
    );

    return { job_id: response.data.id, status: "generating" };
  } catch (error) {
    console.error("Runway API error:", error);
    return null;
  }
}

// ─── Hugging Face Inference API (FREE tier available) ────────────────────────
// Sign up at https://huggingface.co → Settings → Access Tokens → New token (free)
// Model: damo-vilab/text-to-video-ms-1.7b (generates short clips)

async function generateWithHuggingFace(
  script: VideoScript,
  topic: string
): Promise<{ video_url?: string; job_id?: string; status: string } | null> {
  const hfToken = process.env.HUGGINGFACE_API_TOKEN;
  if (!hfToken) return null;

  try {
    const prompt = `${topic}: ${script.hook}. ${script.sections[0]?.content || ""}`;

    const response = await axios.post(
      "https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b",
      { inputs: prompt.substring(0, 200) },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 60000, // HF cold starts can be slow
      }
    );

    // HF returns raw video bytes — convert to base64 data URL
    const videoBuffer = Buffer.from(response.data as ArrayBuffer);
    const base64 = videoBuffer.toString("base64");
    const videoDataUrl = `data:video/mp4;base64,${base64}`;

    return {
      video_url: videoDataUrl,
      status: "ready",
    };
  } catch (error) {
    console.error("Hugging Face API error:", error);
    return null;
  }
}

// ─── Pexels API (FREE — 200 req/hour, no credit card) ────────────────────────
// Sign up at https://www.pexels.com/api/ → free API key instantly
// Returns a relevant stock video URL to use as background

async function fetchPexelsVideo(
  topic: string
): Promise<{ video_url?: string; thumbnail_url?: string; status: string } | null> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return null;

  try {
    const response = await axios.get("https://api.pexels.com/videos/search", {
      headers: {
        Authorization: pexelsKey,
      },
      params: {
        query: topic,
        per_page: 5,
        orientation: "portrait", // vertical for TikTok
        size: "medium",
      },
    });

    const videos = response.data?.videos || [];
    if (videos.length === 0) return null;

    // Pick the first video with a usable file
    const video = videos[0];
    const videoFile = video.video_files?.find(
      (f: { quality: string; width: number }) =>
        f.quality === "hd" || f.width <= 1080
    ) || video.video_files?.[0];

    if (!videoFile?.link) return null;

    return {
      video_url: videoFile.link,
      thumbnail_url: video.image,
      status: "ready",
    };
  } catch (error) {
    console.error("Pexels API error:", error);
    return null;
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

async function generateVideoWithAI(
  script: VideoScript,
  topic: string
): Promise<{
  video_url?: string;
  thumbnail_url?: string;
  job_id?: string;
  status: string;
  video_source: GenerateVideoResponse["video_source"];
}> {
  // Priority 1: D-ID (AI avatar, trial free)
  const didResult = await generateWithDID(script);
  if (didResult) {
    return { ...didResult, video_source: "did" };
  }

  // Priority 2: Runway ML (paid but high quality)
  const runwayResult = await generateWithRunway(script, topic);
  if (runwayResult) {
    return { ...runwayResult, video_source: "runway" };
  }

  // Priority 3: Hugging Face (free tier, lower quality)
  const hfResult = await generateWithHuggingFace(script, topic);
  if (hfResult) {
    return { ...hfResult, video_source: "huggingface" };
  }

  // Priority 4: Pexels stock video (free, no AI generation)
  const pexelsResult = await fetchPexelsVideo(topic);
  if (pexelsResult) {
    return { ...pexelsResult, video_source: "pexels" };
  }

  // Fallback: script only
  return {
    status: "script_ready",
    thumbnail_url: `https://placehold.co/1080x1920/1a1a2e/6366f1?text=${encodeURIComponent(
      topic.substring(0, 20)
    )}`,
    video_source: "none",
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, summary, key_points, hashtags, edited_hook, edited_sections, edited_cta } = body as {
      topic: string;
      summary: string;
      key_points: string[];
      hashtags: string[];
      edited_hook?: string;
      edited_sections?: { heading: string; content: string; duration: number }[];
      edited_cta?: string;
    };

    if (!topic || !summary || !key_points || !Array.isArray(key_points)) {
      return NextResponse.json(
        { error: "Missing required fields: topic, summary, key_points (array)" },
        { status: 400 }
      );
    }

    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];

    // Build base script, then override with user edits if provided
    let script = buildVideoScript(topic, summary, key_points, safeHashtags);
    if (edited_hook || edited_sections || edited_cta) {
      script = applyEditsToScript(script, edited_hook, edited_sections, edited_cta);
    }
    const videoResult = await generateVideoWithAI(script, topic);

    const statusMessages: Record<string, string> = {
      script_ready:
        "Video script generated! Add a free API key to auto-generate videos: HUGGINGFACE_API_TOKEN (free) or PEXELS_API_KEY (free stock videos).",
      generating:
        "Video is being generated by AI. Check back in a moment.",
      ready: "Video ready! 🎬",
    };

    const response: GenerateVideoResponse = {
      script,
      video_url: videoResult.video_url,
      thumbnail_url: videoResult.thumbnail_url,
      status: videoResult.status as GenerateVideoResponse["status"],
      message:
        statusMessages[videoResult.status] ||
        "Video processing complete.",
      job_id: videoResult.job_id,
      video_source: videoResult.video_source,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generate video error:", error);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 }
    );
  }
}
