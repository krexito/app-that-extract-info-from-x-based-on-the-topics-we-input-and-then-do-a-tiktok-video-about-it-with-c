/**
 * Tests for the business logic that lives inside the API route handlers.
 * We test the pure functions directly — no HTTP server needed.
 *
 * generate-video: buildVideoScript, applyEditsToScript
 * extract-x:      generateMockPosts, extractKeyPoints, extractHashtags, generateSummary
 */

import { describe, it, expect } from "vitest";

// ─── Re-implement / import pure pieces from the route files ──────────────────
// Because the route files use next/server (server-only), we test the shared
// utilities from script-utils.ts and reproduce the pure logic inline here.

import { extractKeyPoints, extractHashtags, generateSummary, type XPostLike } from "../script-utils";

// ── Inline: buildVideoScript (mirrors generate-video/route.ts) ──────────────

interface Caption {
  text: string;
  start_time: number;
  end_time: number;
  style: "title" | "subtitle" | "highlight" | "normal";
}

interface VideoScript {
  title: string;
  hook: string;
  sections: { heading: string; content: string; duration: number }[];
  call_to_action: string;
  captions: Caption[];
  total_duration: number;
  background_style: string;
  music_mood: string;
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

  const captions: Caption[] = [];
  let currentTime = 0;

  captions.push({ text: hook, start_time: 0, end_time: 3, style: "title" });
  currentTime = 3;

  const summaryShort = summary.length > 120 ? summary.substring(0, 120) + "..." : summary;
  captions.push({ text: summaryShort, start_time: currentTime, end_time: currentTime + 5, style: "subtitle" });
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
  captions.push({ text: cta, start_time: currentTime, end_time: currentTime + 4, style: "highlight" });

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

function applyEditsToScript(
  base: VideoScript,
  editedHook?: string,
  editedSections?: { heading: string; content: string; duration: number }[],
  editedCta?: string
): VideoScript {
  const hook = editedHook?.trim() || base.hook;
  const sections = editedSections && editedSections.length > 0 ? editedSections : base.sections;
  const cta = editedCta?.trim() || base.call_to_action;

  const captions: Caption[] = [];
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

  return { ...base, hook, sections, call_to_action: cta, captions, total_duration: currentTime + 4 };
}

// ── Inline: generateMockPosts (mirrors extract-x/route.ts) ──────────────────

function generateMockPosts(topic: string): XPostLike[] {
  return [
    {
      id: "1",
      text: `Breaking: Major developments in ${topic} are reshaping the industry. #${topic.replace(/\s+/g, "")} #trending`,
      author: "techinsider",
      likes: 4521,
      retweets: 1203,
      created_at: new Date().toISOString(),
    },
    {
      id: "2",
      text: `Thread 🧵 Everything you need to know about ${topic}: The landscape has completely shifted.`,
      author: "analyst_pro",
      likes: 8934,
      retweets: 3421,
      created_at: new Date().toISOString(),
    },
    {
      id: "3",
      text: `Hot take: ${topic} is the most underrated topic right now.`,
      author: "futurist_jane",
      likes: 2341,
      retweets: 876,
      created_at: new Date().toISOString(),
    },
  ];
}

// ─── Tests: buildVideoScript ──────────────────────────────────────────────────

describe("buildVideoScript", () => {
  const topic = "AI";
  const summary = "AI is growing fast.";
  const keyPoints = ["AI is changing everything", "New models released weekly", "Adoption is accelerating"];
  const hashtags = ["#AI", "#tech", "#future", "#trending"];

  it("sets the correct title format", () => {
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);
    expect(script.title).toBe(`Everything about ${topic} in 60 seconds`);
  });

  it("hook contains the uppercased topic", () => {
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);
    expect(script.hook).toContain("AI");
    expect(script.hook).toContain("BREAKING");
  });

  it("creates at most 4 sections from key points", () => {
    const manyPoints = Array.from({ length: 10 }, (_, i) => `Point ${i}`);
    const script = buildVideoScript(topic, summary, manyPoints, hashtags);
    expect(script.sections.length).toBeLessThanOrEqual(4);
  });

  it("total_duration matches caption timeline", () => {
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);
    const lastCaption = script.captions[script.captions.length - 1];
    expect(script.total_duration).toBe(lastCaption.end_time);
  });

  it("first caption is always the hook with title style", () => {
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);
    expect(script.captions[0].style).toBe("title");
    expect(script.captions[0].text).toBe(script.hook);
    expect(script.captions[0].start_time).toBe(0);
  });

  it("last caption is the CTA with highlight style", () => {
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);
    const last = script.captions[script.captions.length - 1];
    expect(last.style).toBe("highlight");
    expect(last.text).toContain("Follow");
  });

  it("sets background_style and music_mood", () => {
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);
    expect(script.background_style).toBe("dark_gradient");
    expect(script.music_mood).toBe("energetic");
  });

  it("handles empty hashtags without crashing", () => {
    const script = buildVideoScript(topic, summary, keyPoints, []);
    expect(script.call_to_action).toBe("Follow for more! ");
  });
});

// ─── Tests: applyEditsToScript ───────────────────────────────────────────────

describe("applyEditsToScript", () => {
  const base = buildVideoScript(
    "crypto",
    "Crypto is big.",
    ["Bitcoin hit ATH", "Ethereum upgrades", "DeFi growing"],
    ["#crypto", "#bitcoin"]
  );

  it("overrides the hook when editedHook is provided", () => {
    const edited = applyEditsToScript(base, "My custom hook");
    expect(edited.hook).toBe("My custom hook");
    expect(edited.captions[0].text).toBe("My custom hook");
  });

  it("keeps original hook when editedHook is empty string", () => {
    const edited = applyEditsToScript(base, "  ");
    expect(edited.hook).toBe(base.hook);
  });

  it("overrides sections when editedSections is provided", () => {
    const newSections = [{ heading: "New Section", content: "New content", duration: 10 }];
    const edited = applyEditsToScript(base, undefined, newSections);
    expect(edited.sections).toEqual(newSections);
  });

  it("keeps original sections when editedSections is empty array", () => {
    const edited = applyEditsToScript(base, undefined, []);
    expect(edited.sections).toEqual(base.sections);
  });

  it("overrides CTA when editedCta is provided", () => {
    const edited = applyEditsToScript(base, undefined, undefined, "Like and subscribe!");
    expect(edited.call_to_action).toBe("Like and subscribe!");
  });

  it("recalculates total_duration based on new sections", () => {
    const longSections = [
      { heading: "A", content: "Content A", duration: 20 },
      { heading: "B", content: "Content B", duration: 20 },
    ];
    const edited = applyEditsToScript(base, undefined, longSections);
    expect(edited.total_duration).toBeGreaterThan(base.total_duration);
  });

  it("preserves subtitle caption from base", () => {
    const edited = applyEditsToScript(base, "New hook");
    const subtitle = edited.captions.find((c) => c.style === "subtitle");
    expect(subtitle).toBeDefined();
  });
});

// ─── Tests: generateMockPosts ─────────────────────────────────────────────────

describe("generateMockPosts", () => {
  it("returns 3 posts", () => {
    const posts = generateMockPosts("gaming");
    expect(posts.length).toBe(3);
  });

  it("each post has required fields", () => {
    const posts = generateMockPosts("gaming");
    posts.forEach((post) => {
      expect(post.id).toBeDefined();
      expect(post.text).toBeDefined();
      expect(post.author).toBeDefined();
      expect(typeof post.likes).toBe("number");
      expect(typeof post.retweets).toBe("number");
    });
  });

  it("post texts mention the topic", () => {
    const posts = generateMockPosts("gaming");
    const allText = posts.map((p) => p.text).join(" ").toLowerCase();
    expect(allText).toContain("gaming");
  });

  it("does not return duplicate IDs", () => {
    const posts = generateMockPosts("tech");
    const ids = posts.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── Integration: extract pipeline (mock data path) ──────────────────────────

describe("extract pipeline (mock path)", () => {
  it("full pipeline from mock posts to script produces valid output", () => {
    const topic = "blockchain";
    const posts = generateMockPosts(topic);
    const keyPoints = extractKeyPoints(posts, topic);
    const hashtags = extractHashtags(posts, topic);
    const summary = generateSummary(posts, topic);
    const script = buildVideoScript(topic, summary, keyPoints, hashtags);

    expect(script.title).toContain(topic);
    expect(script.captions.length).toBeGreaterThan(0);
    expect(script.total_duration).toBeGreaterThan(0);

    // Ensure captions are in chronological order
    for (let i = 1; i < script.captions.length; i++) {
      expect(script.captions[i].start_time).toBeGreaterThanOrEqual(
        script.captions[i - 1].start_time
      );
    }
  });
});
