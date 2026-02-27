import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export interface XPost {
  id: string;
  text: string;
  author: string;
  likes: number;
  retweets: number;
  created_at: string;
}

export interface ExtractXResponse {
  topic: string;
  posts: XPost[];
  summary: string;
  key_points: string[];
  hashtags: string[];
}

async function fetchFromTwitterAPI(topic: string): Promise<XPost[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!bearerToken) {
    // Return mock data when no API key is configured
    return generateMockPosts(topic);
  }

  try {
    const response = await axios.get(
      "https://api.twitter.com/2/tweets/search/recent",
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
        params: {
          query: `${topic} -is:retweet lang:en`,
          max_results: 10,
          "tweet.fields": "created_at,public_metrics,author_id",
          expansions: "author_id",
          "user.fields": "name,username",
        },
      }
    );

    const tweets = response.data.data || [];
    const users = response.data.includes?.users || [];
    const userMap = new Map(users.map((u: { id: string; username: string }) => [u.id, u]));

    return tweets.map((tweet: {
      id: string;
      text: string;
      author_id: string;
      created_at: string;
      public_metrics?: { like_count: number; retweet_count: number };
    }) => ({
      id: tweet.id,
      text: tweet.text,
      author: (userMap.get(tweet.author_id) as { username?: string } | undefined)?.username || "unknown",
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      created_at: tweet.created_at,
    }));
  } catch (error) {
    console.error("Twitter API error:", error);
    return generateMockPosts(topic);
  }
}

function generateMockPosts(topic: string): XPost[] {
  const mockData: Record<string, XPost[]> = {
    default: [
      {
        id: "1",
        text: `Breaking: Major developments in ${topic} are reshaping the industry. Experts say this could change everything we know about the field. #${topic.replace(/\s+/g, "")} #trending`,
        author: "techinsider",
        likes: 4521,
        retweets: 1203,
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        text: `Thread 🧵 Everything you need to know about ${topic} in 2025: 1/ The landscape has completely shifted in the past 6 months...`,
        author: "analyst_pro",
        likes: 8934,
        retweets: 3421,
        created_at: new Date().toISOString(),
      },
      {
        id: "3",
        text: `Hot take: ${topic} is the most underrated topic right now. Here's why everyone should be paying attention 👇`,
        author: "futurist_jane",
        likes: 2341,
        retweets: 876,
        created_at: new Date().toISOString(),
      },
      {
        id: "4",
        text: `New study reveals surprising facts about ${topic}. The results will shock you. Link in bio for full report.`,
        author: "research_daily",
        likes: 1567,
        retweets: 432,
        created_at: new Date().toISOString(),
      },
      {
        id: "5",
        text: `${topic} update: Things are moving faster than anyone predicted. Here are the 3 key things happening right now that you need to know about.`,
        author: "news_flash_x",
        likes: 3210,
        retweets: 987,
        created_at: new Date().toISOString(),
      },
    ],
  };

  return mockData.default;
}

function extractKeyPoints(posts: XPost[], topic: string): string[] {
  // Extract meaningful sentences from posts
  const allText = posts.map((p) => p.text).join(" ");
  const sentences = allText
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 200);

  // Pick top 5 most relevant sentences
  const keyPoints = sentences
    .filter((s) => s.toLowerCase().includes(topic.toLowerCase().split(" ")[0]))
    .slice(0, 5);

  if (keyPoints.length < 3) {
    // Fallback key points
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

function extractHashtags(posts: XPost[], topic: string): string[] {
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

function generateSummary(posts: XPost[], topic: string): string {
  const totalEngagement = posts.reduce(
    (sum, p) => sum + p.likes + p.retweets,
    0
  );
  const topPost = [...posts].sort((a, b) => b.likes - a.likes)[0];

  return `${topic} is generating massive buzz on X with ${totalEngagement.toLocaleString()} total engagements. The conversation is dominated by breaking news, expert analysis, and viral takes. Top voices are sharing insights that are reshaping how people think about this topic. The most viral post by @${topPost?.author || "unknown"} captured the community's attention with ${topPost?.likes?.toLocaleString() || 0} likes.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topics } = body as { topics: string[] };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: "Please provide at least one topic" },
        { status: 400 }
      );
    }

    const results: ExtractXResponse[] = [];

    for (const topic of topics.slice(0, 3)) {
      // Limit to 3 topics
      const posts = await fetchFromTwitterAPI(topic);
      const keyPoints = extractKeyPoints(posts, topic);
      const hashtags = extractHashtags(posts, topic);
      const summary = generateSummary(posts, topic);

      results.push({
        topic,
        posts,
        summary,
        key_points: keyPoints,
        hashtags,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Extract X error:", error);
    return NextResponse.json(
      { error: "Failed to extract data from X" },
      { status: 500 }
    );
  }
}
