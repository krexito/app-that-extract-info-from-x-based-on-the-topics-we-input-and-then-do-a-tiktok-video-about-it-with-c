"use client";

import { useState, useEffect } from "react";
import type { ExtractXResponse } from "./api/extract-x/route";
import type { GenerateVideoResponse } from "./api/generate-video/route";
import type { TikTokUploadResponse } from "./api/upload-tiktok/route";

type Step = "idle" | "extracting" | "extracted" | "generating" | "generated" | "uploading" | "done" | "error";

interface StepStatus {
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  topics: string[];
  xData: ExtractXResponse[];
  videoData: GenerateVideoResponse[];
  uploadData: TikTokUploadResponse | null;
}

export default function Home() {
  const [topics, setTopics] = useState<string[]>(["", "", ""]);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>("");
  const [xData, setXData] = useState<ExtractXResponse[]>([]);
  const [videoData, setVideoData] = useState<GenerateVideoResponse[]>([]);
  const [uploadData, setUploadData] = useState<TikTokUploadResponse | null>(null);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("xtiktok_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const saveToHistory = (
    currentTopics: string[],
    currentXData: ExtractXResponse[],
    currentVideoData: GenerateVideoResponse[],
    currentUploadData: TikTokUploadResponse | null
  ) => {
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      topics: currentTopics,
      xData: currentXData,
      videoData: currentVideoData,
      uploadData: currentUploadData,
    };
    const updated = [entry, ...history].slice(0, 10); // keep last 10
    setHistory(updated);
    try {
      localStorage.setItem("xtiktok_history", JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setTopics(entry.topics);
    setXData(entry.xData);
    setVideoData(entry.videoData);
    setUploadData(entry.uploadData);
    setSelectedTopicIndex(0);
    setSelectedVideoIndex(0);
    setStep("done");
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("xtiktok_history");
  };

  const stepStatuses: StepStatus[] = [
    {
      label: "Extract from X",
      status:
        step === "extracting"
          ? "active"
          : ["extracted", "generating", "generated", "uploading", "done"].includes(step)
          ? "done"
          : step === "error" && xData.length === 0
          ? "error"
          : "pending",
      detail: xData.length > 0 ? `${xData.length} topic(s) extracted` : undefined,
    },
    {
      label: "Generate Videos",
      status:
        step === "generating"
          ? "active"
          : ["generated", "uploading", "done"].includes(step)
          ? "done"
          : step === "error" && xData.length > 0 && videoData.length === 0
          ? "error"
          : "pending",
      detail: videoData.length > 0 ? `${videoData.length} video(s) generated` : undefined,
    },
    {
      label: "Upload to TikTok",
      status:
        step === "uploading"
          ? "active"
          : step === "done"
          ? "done"
          : step === "error" && videoData.length > 0 && !uploadData
          ? "error"
          : "pending",
      detail: uploadData?.status === "uploaded" ? "Live on TikTok! 🎉" : uploadData?.status === "no_credentials" ? "Manual upload needed" : undefined,
    },
  ];

  const addTopic = () => {
    if (topics.length < 5) setTopics([...topics, ""]);
  };

  const removeTopic = (index: number) => {
    if (topics.length > 1) {
      setTopics(topics.filter((_, i) => i !== index));
    }
  };

  const updateTopic = (index: number, value: string) => {
    const updated = [...topics];
    updated[index] = value;
    setTopics(updated);
  };

  const validTopics = topics.filter((t) => t.trim().length > 0);

  const handleCopyScript = async () => {
    const currentVideo = videoData[Math.min(selectedVideoIndex, videoData.length - 1)];
    if (!currentVideo) return;

    const scriptText = [
      `🎬 ${currentVideo.script.title}`,
      ``,
      `🔥 HOOK: ${currentVideo.script.hook}`,
      ``,
      ...currentVideo.script.sections.map((s, i) => `${i + 1}. ${s.content}`),
      ``,
      `📣 CTA: ${currentVideo.script.call_to_action}`,
      ``,
      `⏱️ Duration: ${currentVideo.script.total_duration}s`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(scriptText);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const handleRun = async () => {
    if (validTopics.length === 0) {
      setError("Please enter at least one topic");
      return;
    }

    setError("");
    setXData([]);
    setVideoData([]);
    setUploadData(null);

    // Step 1: Extract from X
    setStep("extracting");
    let extractedData: ExtractXResponse[] = [];
    try {
      const res = await fetch("/api/extract-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: validTopics }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract from X");
      extractedData = data.results;
      setXData(extractedData);
      setStep("extracted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract from X");
      setStep("error");
      return;
    }

    // Step 2: Generate video for ALL topics in parallel
    setStep("generating");
    let generatedVideos: GenerateVideoResponse[] = [];
    try {
      const videoPromises = extractedData.map((topicData) =>
        fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topicData.topic,
            summary: topicData.summary,
            key_points: topicData.key_points,
            hashtags: topicData.hashtags,
          }),
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to generate video");
          return data as GenerateVideoResponse;
        })
      );

      generatedVideos = await Promise.all(videoPromises);
      setVideoData(generatedVideos);
      setSelectedVideoIndex(0);
      setStep("generated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate video");
      setStep("error");
      return;
    }

    // Step 3: Upload primary video to TikTok
    setStep("uploading");
    let finalUploadData: TikTokUploadResponse | null = null;
    try {
      const primaryVideo = generatedVideos[0];
      const primaryTopic = extractedData[0];
      const captionsText = primaryVideo.script.captions
        .map((c) => c.text)
        .join(" | ");

      const res = await fetch("/api/upload-tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: primaryVideo.video_url || "",
          title: primaryVideo.script.title,
          description: primaryTopic.summary,
          hashtags: primaryTopic.hashtags,
          captions_text: captionsText,
        }),
      });
      const data = await res.json();
      finalUploadData = data;
      setUploadData(finalUploadData);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload to TikTok");
      setStep("error");
    }

    // Save to history
    saveToHistory(validTopics, extractedData, generatedVideos, finalUploadData);
  };

  const handleReset = () => {
    setStep("idle");
    setError("");
    setXData([]);
    setVideoData([]);
    setUploadData(null);
    setSelectedTopicIndex(0);
    setSelectedVideoIndex(0);
  };

  const isRunning = ["extracting", "generating", "uploading"].includes(step);

  const currentVideo = videoData.length > 0
    ? videoData[Math.min(selectedVideoIndex, videoData.length - 1)]
    : null;

  const currentXTopic = xData.length > 0
    ? xData[Math.min(selectedTopicIndex, xData.length - 1)]
    : null;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg">
              🎬
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none gradient-text">X → TikTok</h1>
              <p className="text-xs text-white/40 mt-0.5">AI Video Creator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-xs transition-all"
              >
                🕐 History ({history.length})
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-white/30">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              Ready
            </div>
          </div>
        </div>
      </header>

      {/* History Panel */}
      {showHistory && (
        <div className="border-b border-white/5 bg-white/2">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/60">Recent Sessions</h3>
              <button
                onClick={clearHistory}
                className="text-xs text-red-400/60 hover:text-red-400 transition-all"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  className="text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all"
                >
                  <div className="text-xs text-white/60 font-medium truncate">
                    {entry.topics.filter(Boolean).join(", ")}
                  </div>
                  <div className="text-xs text-white/30 mt-1">
                    {new Date(entry.timestamp).toLocaleDateString()} · {entry.videoData.length} video(s)
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel - Input */}
        <div className="lg:col-span-1 space-y-6">
          {/* Topic Input */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white/90 mb-1">Topics</h2>
              <p className="text-xs text-white/40">Enter topics to extract from X and create TikTok videos about</p>
            </div>

            <div className="space-y-2">
              {topics.map((topic, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => updateTopic(i, e.target.value)}
                    placeholder={`Topic ${i + 1}...`}
                    disabled={isRunning}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all disabled:opacity-50"
                    onKeyDown={(e) => e.key === "Enter" && !isRunning && handleRun()}
                  />
                  {topics.length > 1 && (
                    <button
                      onClick={() => removeTopic(i)}
                      disabled={isRunning}
                      className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all flex items-center justify-center text-sm disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {topics.length < 5 && (
              <button
                onClick={addTopic}
                disabled={isRunning}
                className="w-full py-2 rounded-xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 text-sm transition-all disabled:opacity-50"
              >
                + Add topic
              </button>
            )}

            <button
              onClick={isRunning ? undefined : step === "done" || step === "error" ? handleReset : handleRun}
              disabled={isRunning || validTopics.length === 0}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                isRunning
                  ? "bg-indigo-600/50 text-white/60 cursor-not-allowed"
                  : step === "done"
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : step === "error"
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20"
              }`}
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Processing...
                </span>
              ) : step === "done" ? (
                "🔄 Create Another"
              ) : step === "error" ? (
                "↩ Try Again"
              ) : (
                "🚀 Create TikTok Video"
              )}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Pipeline Steps */}
          <div className="glass-card rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Pipeline</h3>
            {stepStatuses.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  s.status === "active"
                    ? "step-active"
                    : s.status === "done"
                    ? "step-done"
                    : s.status === "error"
                    ? "bg-red-500/10 border-red-500/30"
                    : "step-pending"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    s.status === "active"
                      ? "bg-indigo-500 text-white"
                      : s.status === "done"
                      ? "bg-green-500 text-white"
                      : s.status === "error"
                      ? "bg-red-500 text-white"
                      : "bg-white/10 text-white/30"
                  }`}
                >
                  {s.status === "active" ? (
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin block"></span>
                  ) : s.status === "done" ? (
                    "✓"
                  ) : s.status === "error" ? (
                    "!"
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${s.status === "pending" ? "text-white/40" : "text-white/90"}`}>
                    {s.label}
                  </div>
                  {s.detail && (
                    <div className="text-xs text-white/40 truncate">{s.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* API Config Notice */}
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">API Keys (.env.local)</h3>
            <div className="space-y-1.5">
              {[
                { key: "TWITTER_BEARER_TOKEN", label: "X / Twitter", optional: true },
                { key: "DID_API_KEY", label: "D-ID (video gen)", optional: true },
                { key: "RUNWAY_API_KEY", label: "Runway ML (video)", optional: true },
                { key: "TIKTOK_ACCESS_TOKEN", label: "TikTok upload", optional: true },
                { key: "TIKTOK_OPEN_ID", label: "TikTok Open ID", optional: true },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-xs text-white/30 font-mono">{item.key}</span>
                  <span className="text-xs text-white/20">optional</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-2 space-y-6">
          {step === "idle" && (
            <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="text-6xl mb-4">🎬</div>
              <h2 className="text-xl font-bold gradient-text mb-2">Ready to Create</h2>
              <p className="text-white/40 text-sm max-w-sm">
                Enter your topics on the left, then click{" "}
                <span className="text-indigo-400">Create TikTok Video</span> to extract trending content from X and auto-generate TikTok videos with captions.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-sm">
                {["Extract X Data", "Generate Videos", "Upload TikTok"].map((label, i) => (
                  <div key={i} className="glass-card rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">{["🐦", "🎥", "📱"][i]}</div>
                    <div className="text-xs text-white/40">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* X Data Results */}
          {xData.length > 0 && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white/90 flex items-center gap-2">
                  <span>𝕏</span> Extracted Data
                </h2>
                <div className="flex gap-1">
                  {xData.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedTopicIndex(i)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedTopicIndex === i
                          ? "bg-indigo-600 text-white"
                          : "bg-white/5 text-white/40 hover:text-white/70"
                      }`}
                    >
                      {xData[i].topic.substring(0, 12)}
                    </button>
                  ))}
                </div>
              </div>

              {currentXTopic && (
                <div className="space-y-4">
                  {/* Data source badge */}
                  {currentXTopic.data_source && (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        currentXTopic.data_source === "twitter" ? "bg-sky-500/20 text-sky-400" :
                        currentXTopic.data_source === "reddit" ? "bg-orange-500/20 text-orange-400" :
                        "bg-white/10 text-white/40"
                      }`}>
                        {currentXTopic.data_source === "twitter" ? "🐦 Twitter" :
                         currentXTopic.data_source === "reddit" ? "🟠 Reddit" : "🎭 Mock data"}
                      </span>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-white/3 rounded-xl p-4">
                    <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Summary</div>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {currentXTopic.summary}
                    </p>
                  </div>

                  {/* Key Points */}
                  <div>
                    <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Key Points</div>
                    <div className="space-y-2">
                      {currentXTopic.key_points.map((point, i) => (
                        <div key={i} className="flex gap-3 bg-white/3 rounded-xl p-3">
                          <span className="text-indigo-400 font-bold text-sm flex-shrink-0">{i + 1}.</span>
                          <p className="text-sm text-white/70">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hashtags */}
                  <div>
                    <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Hashtags</div>
                    <div className="flex flex-wrap gap-2">
                      {currentXTopic.hashtags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-indigo-500/15 border border-indigo-500/25 rounded-full text-xs text-indigo-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Top Posts */}
                  <div>
                    <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Top Posts</div>
                    <div className="space-y-2">
                      {currentXTopic.posts.slice(0, 3).map((post) => (
                        <div key={post.id} className="bg-white/3 rounded-xl p-3">
                          <p className="text-sm text-white/70 mb-2">{post.text.substring(0, 140)}{post.text.length > 140 ? "..." : ""}</p>
                          <div className="flex items-center gap-4 text-xs text-white/30">
                            <span>@{post.author}</span>
                            <span>❤️ {post.likes.toLocaleString()}</span>
                            <span>🔁 {post.retweets.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Results */}
          {videoData.length > 0 && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white/90 flex items-center gap-2">
                  🎬 Generated Videos
                </h2>
                <div className="flex items-center gap-2">
                  {/* Video selector tabs */}
                  {videoData.length > 1 && (
                    <div className="flex gap-1">
                      {videoData.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedVideoIndex(i)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            selectedVideoIndex === i
                              ? "bg-purple-600 text-white"
                              : "bg-white/5 text-white/40 hover:text-white/70"
                          }`}
                        >
                          {xData[i]?.topic.substring(0, 10) || `Video ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentVideo && (
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      currentVideo.status === "ready" ? "bg-green-500/20 text-green-400" :
                      currentVideo.status === "generating" ? "bg-yellow-500/20 text-yellow-400" :
                      currentVideo.status === "script_ready" ? "bg-indigo-500/20 text-indigo-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {currentVideo.status === "script_ready" ? "Script Ready" :
                       currentVideo.status === "generating" ? "Generating..." :
                       currentVideo.status === "ready" ? "Video Ready ✓" : currentVideo.status}
                    </span>
                  )}
                </div>
              </div>

              {currentVideo && (
                <>
                  {currentVideo.message && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300">
                      ℹ️ {currentVideo.message}
                    </div>
                  )}

                  {/* Video Preview + Script side by side */}
                  <div className="flex gap-4">
                    {/* Video / Thumbnail Preview */}
                    <div className="flex-shrink-0">
                      <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Preview</div>
                      <div className="relative w-28 h-48 rounded-xl overflow-hidden border border-white/10 bg-black">
                        {/* If we have a real video URL (not base64 data URL from HF), show video player */}
                        {currentVideo.video_url && !currentVideo.video_url.startsWith("data:") ? (
                          <video
                            src={currentVideo.video_url}
                            className="w-full h-full object-cover"
                            controls
                            playsInline
                            poster={currentVideo.thumbnail_url}
                          />
                        ) : currentVideo.video_url && currentVideo.video_url.startsWith("data:") ? (
                          /* Hugging Face base64 video */
                          <video
                            src={currentVideo.video_url}
                            className="w-full h-full object-cover"
                            controls
                            playsInline
                          />
                        ) : currentVideo.thumbnail_url ? (
                          /* Fallback: thumbnail only */
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={currentVideo.thumbnail_url}
                              alt="Video thumbnail"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                                <span className="text-white text-lg ml-1">▶</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* No media yet */
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">
                            🎬
                          </div>
                        )}
                        {/* Video source badge */}
                        {currentVideo.video_source && currentVideo.video_source !== "none" && (
                          <div className="absolute bottom-1 left-1 right-1">
                            <span className="block text-center text-xs bg-black/70 rounded px-1 py-0.5 text-white/60">
                              {currentVideo.video_source === "did" ? "D-ID" :
                               currentVideo.video_source === "runway" ? "Runway" :
                               currentVideo.video_source === "huggingface" ? "HuggingFace" :
                               currentVideo.video_source === "pexels" ? "Pexels" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Script info */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Hook */}
                      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-3">
                        <div className="text-xs text-indigo-400 mb-1 uppercase tracking-wider">Hook</div>
                        <p className="text-white font-semibold text-sm">{currentVideo.script.hook}</p>
                      </div>

                      {/* Duration + Copy button */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/30">⏱️ {currentVideo.script.total_duration}s · {currentVideo.script.captions.length} captions</span>
                        <button
                          onClick={handleCopyScript}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            copiedScript
                              ? "bg-green-500/20 text-green-400"
                              : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80"
                          }`}
                        >
                          {copiedScript ? "✓ Copied!" : "📋 Copy Script"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Captions Timeline */}
                  <div>
                    <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Captions Timeline</div>
                    <div className="space-y-2">
                      {currentVideo.script.captions.map((caption, i) => (
                        <div key={i} className={`flex gap-3 rounded-xl p-3 border ${
                          caption.style === "title" ? "bg-purple-500/10 border-purple-500/20" :
                          caption.style === "highlight" ? "bg-indigo-500/10 border-indigo-500/20" :
                          caption.style === "subtitle" ? "bg-blue-500/10 border-blue-500/20" :
                          "bg-white/3 border-white/5"
                        }`}>
                          <div className="text-xs text-white/30 font-mono w-16 flex-shrink-0 pt-0.5">
                            {caption.start_time}s–{caption.end_time}s
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-white/80">{caption.text}</p>
                            <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                              caption.style === "title" ? "bg-purple-500/20 text-purple-400" :
                              caption.style === "highlight" ? "bg-indigo-500/20 text-indigo-400" :
                              caption.style === "subtitle" ? "bg-blue-500/20 text-blue-400" :
                              "bg-white/5 text-white/30"
                            }`}>
                              {caption.style}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TikTok Upload Result */}
          {uploadData && (
            <div className={`glass-card rounded-2xl p-6 space-y-4 ${
              uploadData.status === "uploaded" ? "border-green-500/30" :
              uploadData.status === "no_credentials" ? "border-yellow-500/20" :
              uploadData.status === "failed" ? "border-red-500/20" : ""
            }`}>
              <h2 className="font-semibold text-white/90 flex items-center gap-2">
                📱 TikTok Upload
              </h2>

              <div className={`rounded-xl p-4 ${
                uploadData.status === "uploaded" ? "bg-green-500/10 border border-green-500/20" :
                uploadData.status === "no_credentials" ? "bg-yellow-500/10 border border-yellow-500/20" :
                uploadData.status === "pending" ? "bg-blue-500/10 border border-blue-500/20" :
                "bg-red-500/10 border border-red-500/20"
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {uploadData.status === "uploaded" ? "🎉" :
                     uploadData.status === "no_credentials" ? "⚙️" :
                     uploadData.status === "pending" ? "⏳" : "❌"}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${
                      uploadData.status === "uploaded" ? "text-green-400" :
                      uploadData.status === "no_credentials" ? "text-yellow-400" :
                      uploadData.status === "pending" ? "text-blue-400" :
                      "text-red-400"
                    }`}>
                      {uploadData.status === "uploaded" ? "Successfully Uploaded!" :
                       uploadData.status === "no_credentials" ? "Manual Upload Required" :
                       uploadData.status === "pending" ? "Processing..." : "Upload Failed"}
                    </p>
                    <p className="text-xs text-white/50 mt-1">{uploadData.message}</p>
                  </div>
                </div>
              </div>

              {uploadData.tiktok_url && (
                <a
                  href={uploadData.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#ff0050] hover:bg-[#e0004a] rounded-xl text-white text-sm font-medium transition-all w-fit"
                >
                  <span>📱</span> View on TikTok
                </a>
              )}

              {uploadData.share_url && uploadData.status === "no_credentials" && (
                <div className="space-y-2">
                  <p className="text-xs text-white/40">To enable auto-upload, add these to your <code className="bg-white/10 px-1 rounded">.env.local</code>:</p>
                  <div className="bg-black/40 rounded-xl p-3 font-mono text-xs text-green-400 space-y-1">
                    <div>TIKTOK_ACCESS_TOKEN=your_token_here</div>
                    <div>TIKTOK_OPEN_ID=your_open_id_here</div>
                  </div>
                  <a
                    href={uploadData.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#ff0050]/80 hover:bg-[#ff0050] rounded-xl text-white text-sm font-medium transition-all w-fit"
                  >
                    📤 Upload Manually to TikTok
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
