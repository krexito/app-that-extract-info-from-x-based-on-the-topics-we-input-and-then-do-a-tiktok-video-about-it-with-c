import { describe, it, expect } from "vitest";
import {
  extractKeyPoints,
  extractHashtags,
  generateSummary,
  buildEditableScript,
  type XPostLike,
} from "../script-utils";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makePosts = (overrides: Partial<XPostLike>[] = []): XPostLike[] => [
  {
    id: "1",
    text: "AI is transforming the software industry at a rapid pace. Developers are adopting new tools",
    author: "techguru",
    likes: 5000,
    retweets: 1200,
    created_at: new Date().toISOString(),
    ...overrides[0],
  },
  {
    id: "2",
    text: "AI models are getting smarter every month. The latest releases shock everyone #AI #trending",
    author: "analyst",
    likes: 3000,
    retweets: 800,
    created_at: new Date().toISOString(),
    ...overrides[1],
  },
  {
    id: "3",
    text: "Hot take: AI is the most important technology of our generation #AI #tech #viral #fyp",
    author: "futurist",
    likes: 1500,
    retweets: 400,
    created_at: new Date().toISOString(),
    ...overrides[2],
  },
];

// ─── extractKeyPoints ─────────────────────────────────────────────────────────

describe("extractKeyPoints", () => {
  it("returns sentences containing the topic keyword", () => {
    const posts = makePosts();
    const result = extractKeyPoints(posts, "AI");
    expect(result.length).toBeGreaterThan(0);
    // Every returned sentence should mention the topic (case-insensitive first word)
    result.forEach((point) =>
      expect(point.toLowerCase()).toContain("ai")
    );
  });

  it("returns fallback points when no matching sentences exist", () => {
    const posts = makePosts();
    // Use a topic that doesn't appear in the fixture texts
    const result = extractKeyPoints(posts, "quantum physics");
    expect(result.length).toBe(5);
    expect(result[0]).toContain("quantum physics");
  });

  it("returns at most 5 points", () => {
    const lotsOfPosts: XPostLike[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      text: `AI news ${i}: this is a long sentence about AI development and the future. AI is great`,
      author: "user",
      likes: i * 100,
      retweets: i * 50,
      created_at: new Date().toISOString(),
    }));
    const result = extractKeyPoints(lotsOfPosts, "AI");
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

// ─── extractHashtags ──────────────────────────────────────────────────────────

describe("extractHashtags", () => {
  it("extracts and ranks hashtags from posts", () => {
    const posts = makePosts();
    const result = extractHashtags(posts, "AI");
    // #ai should be ranked high since it appears in 3 posts
    expect(result.some((t) => t === "#ai")).toBe(true);
  });

  it("returns fallback hashtags when posts have none", () => {
    const posts: XPostLike[] = [
      {
        id: "1",
        text: "No hashtags here at all",
        author: "user",
        likes: 10,
        retweets: 2,
        created_at: new Date().toISOString(),
      },
    ];
    const result = extractHashtags(posts, "crypto");
    expect(result).toContain("#crypto");
    expect(result).toContain("#trending");
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("returns at most 8 hashtags", () => {
    const manyTags = Array.from({ length: 20 }, (_, i) => `#tag${i}`).join(" ");
    const posts: XPostLike[] = [
      {
        id: "1",
        text: manyTags,
        author: "user",
        likes: 100,
        retweets: 10,
        created_at: new Date().toISOString(),
      },
    ];
    const result = extractHashtags(posts, "topic");
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("prefixes each hashtag with #", () => {
    const posts = makePosts();
    const result = extractHashtags(posts, "AI");
    result.forEach((tag) => expect(tag).toMatch(/^#\w+$/));
  });
});

// ─── generateSummary ─────────────────────────────────────────────────────────

describe("generateSummary", () => {
  it("includes the topic name in the summary", () => {
    const posts = makePosts();
    const summary = generateSummary(posts, "AI");
    expect(summary).toContain("AI");
  });

  it("mentions total engagement count", () => {
    const posts = makePosts();
    const totalEngagement = posts.reduce((s, p) => s + p.likes + p.retweets, 0);
    const summary = generateSummary(posts, "AI");
    expect(summary).toContain(totalEngagement.toLocaleString());
  });

  it("mentions the top post author", () => {
    const posts = makePosts();
    // techguru has the most likes (5000)
    const summary = generateSummary(posts, "AI");
    expect(summary).toContain("@techguru");
  });

  it("handles empty posts array without crashing", () => {
    const summary = generateSummary([], "AI");
    expect(summary).toContain("AI");
    expect(summary).toContain("@unknown");
  });
});

// ─── buildEditableScript ─────────────────────────────────────────────────────

describe("buildEditableScript", () => {
  const topic = "crypto";
  const summary = "Crypto is booming.";
  const keyPoints = ["Point A about crypto", "Point B", "Point C", "Point D", "Point E"];
  const hashtags = ["#crypto", "#bitcoin", "#defi", "#web3"];

  it("includes topic in the hook", () => {
    const script = buildEditableScript(topic, summary, keyPoints, hashtags);
    expect(script.hook.toLowerCase()).toContain(topic.toUpperCase().toLowerCase());
  });

  it("returns at most 4 sections", () => {
    const script = buildEditableScript(topic, summary, keyPoints, hashtags);
    expect(script.sections.length).toBeLessThanOrEqual(4);
  });

  it("truncates section content longer than 100 chars", () => {
    const longPoints = ["A".repeat(150)];
    const script = buildEditableScript(topic, summary, longPoints, hashtags);
    script.sections.forEach((s) => {
      expect(s.content.length).toBeLessThanOrEqual(104); // 100 + "..."
    });
  });

  it("includes hashtags in the CTA", () => {
    const script = buildEditableScript(topic, summary, keyPoints, hashtags);
    expect(script.call_to_action).toContain("#crypto");
  });

  it("uses at most 4 hashtags in the CTA", () => {
    const manyHashtags = Array.from({ length: 10 }, (_, i) => `#tag${i}`);
    const script = buildEditableScript(topic, summary, keyPoints, manyHashtags);
    const ctaTags = script.call_to_action.match(/#\w+/g) || [];
    expect(ctaTags.length).toBeLessThanOrEqual(4);
  });

  it("each section has a duration of 8 seconds", () => {
    const script = buildEditableScript(topic, summary, keyPoints, hashtags);
    script.sections.forEach((s) => expect(s.duration).toBe(8));
  });
});
