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
}

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

  // Build captions with timing
  const captions: Caption[] = [];
  let currentTime = 0;

  // Hook caption
  captions.push({
    text: hook,
    start_time: 0,
    end_time: 3,
    style: "title",
  });
  currentTime = 3;

  // Summary caption
  const summaryShort =
    summary.length > 120 ? summary.substring(0, 120) + "..." : summary;
  captions.push({
    text: summaryShort,
    start_time: currentTime,
    end_time: currentTime + 5,
    style: "subtitle",
  });
  currentTime += 5;

  // Key points captions
  sections.forEach((section, i) => {
    captions.push({
      text: `${i + 1}️⃣ ${section.content}`,
      start_time: currentTime,
      end_time: currentTime + section.duration,
      style: i === 0 ? "highlight" : "normal",
    });
    currentTime += section.duration;
  });

  // CTA caption
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

async function generateVideoWithAI(
  script: VideoScript,
  topic: string
): Promise<{ video_url?: string; thumbnail_url?: string; job_id?: string; status: string }> {
  // Try D-ID API for AI video generation
  const didApiKey = process.env.DID_API_KEY;

  if (didApiKey) {
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

      return {
        job_id: response.data.id,
        status: "generating",
      };
    } catch (error) {
      console.error("D-ID API error:", error);
    }
  }

  // Try Runway ML API
  const runwayApiKey = process.env.RUNWAY_API_KEY;
  if (runwayApiKey) {
    try {
      const response = await axios.post(
        "https://api.runwayml.com/v1/image_to_video",
        {
          promptText: `TikTok style video about ${topic}: ${script.hook}`,
          model: "gen3a_turbo",
          duration: Math.min(script.total_duration, 10),
        },
        {
          headers: {
            Authorization: `Bearer ${runwayApiKey}`,
            "Content-Type": "application/json",
            "X-Runway-Version": "2024-11-06",
          },
        }
      );

      return {
        job_id: response.data.id,
        status: "generating",
      };
    } catch (error) {
      console.error("Runway API error:", error);
    }
  }

  // Fallback: return script-ready status (user can use script to create video manually)
  return {
    status: "script_ready",
    thumbnail_url: `https://placehold.co/1080x1920/1a1a2e/6366f1?text=${encodeURIComponent(topic.substring(0, 20))}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, summary, key_points, hashtags } = body as {
      topic: string;
      summary: string;
      key_points: string[];
      hashtags: string[];
    };

    if (!topic || !summary || !key_points) {
      return NextResponse.json(
        { error: "Missing required fields: topic, summary, key_points" },
        { status: 400 }
      );
    }

    // Build the video script
    const script = buildVideoScript(topic, summary, key_points, hashtags || []);

    // Attempt AI video generation
    const videoResult = await generateVideoWithAI(script, topic);

    const response: GenerateVideoResponse = {
      script,
      video_url: videoResult.video_url,
      thumbnail_url: videoResult.thumbnail_url,
      status: videoResult.status as GenerateVideoResponse["status"],
      message:
        videoResult.status === "script_ready"
          ? "Video script generated! Configure DID_API_KEY or RUNWAY_API_KEY to auto-generate videos."
          : videoResult.status === "generating"
          ? "Video is being generated by AI. Check back in a moment."
          : "Video ready!",
      job_id: videoResult.job_id,
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
