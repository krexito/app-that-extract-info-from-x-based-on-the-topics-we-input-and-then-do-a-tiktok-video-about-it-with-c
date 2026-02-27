/**
 * Pure utility functions shared between the API routes and tests.
 * Extracted so they can be unit-tested independently of Next.js.
 */

export interface XPostLike {
  id: string;
  text: string;
  author: string;
  likes: number;
  retweets: number;
  created_at: string;
}

/** Extract key points from a list of posts for a given topic. */
export function extractKeyPoints(posts: XPostLike[], topic: string): string[] {
  const allText = posts.map((p) => p.text).join(" ");
  const sentences = allText
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 200);

  const keyPoints = sentences
    .filter((s) =>
      s.toLowerCase().includes(topic.toLowerCase().split(" ")[0])
    )
    .slice(0, 5);

  if (keyPoints.length < 3) {
    return [
      `${topic} is trending with thousands of discussions happening right now`,
      `Experts and influencers are sharing major insights about ${topic}`,
      `The latest developments in ${topic} are creating significant buzz online`,
      `Community reactions to ${topic} show strong engagement and interest`,
      `Key players in the ${topic} space are making bold predictions`,
    ];
  }

  return keyPoints;
}

/** Extract and rank hashtags from posts, falling back to generated ones. */
export function extractHashtags(posts: XPostLike[], topic: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const hashtagCounts = new Map<string, number>();

  posts.forEach((post) => {
    const matches = post.text.matchAll(hashtagRegex);
    for (const match of matches) {
      const tag = match[1].toLowerCase();
      hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
    }
  });

  const sorted = Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => `#${tag}`)
    .slice(0, 8);

  if (sorted.length < 3) {
    const topicTag = `#${topic.replace(/\s+/g, "")}`;
    return [topicTag, "#trending", "#viral", "#fyp", "#tiktok"];
  }

  return sorted;
}

/** Generate a human-readable summary from posts. */
export function generateSummary(posts: XPostLike[], topic: string): string {
  const totalEngagement = posts.reduce(
    (sum, p) => sum + p.likes + p.retweets,
    0
  );
  const topPost = [...posts].sort((a, b) => b.likes - a.likes)[0];

  return `${topic} is generating massive buzz with ${totalEngagement.toLocaleString()} total engagements. The conversation is dominated by breaking news, expert analysis, and viral takes. Top voices are sharing insights that are reshaping how people think about this topic. The most viral post by @${topPost?.author || "unknown"} captured the community's attention with ${topPost?.likes?.toLocaleString() || 0} likes.`;
}

export interface EditableScript {
  hook: string;
  sections: { heading: string; content: string; duration: number }[];
  call_to_action: string;
}

/** Build an editable script from extracted topic data. */
export function buildEditableScript(
  topic: string,
  summary: string,
  keyPoints: string[],
  hashtags: string[]
): EditableScript {
  void summary; // summary available for future use
  const hook = `🔥 ${topic.toUpperCase()} is BREAKING the internet right now`;
  const sections = keyPoints.slice(0, 4).map((point, i) => ({
    heading: `Point ${i + 1}`,
    content: point.length > 100 ? point.substring(0, 100) + "..." : point,
    duration: 8,
  }));
  const cta = `Follow for more! ${hashtags.slice(0, 4).join(" ")}`;
  return { hook, sections, call_to_action: cta };
}
