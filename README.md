# 🎬 X → TikTok AI Video Creator

This app converts trending X (Twitter) topics into TikTok-ready videos using AI.  
**It works out of the box with mock data — no API keys required to try it.**

---

## 🚀 Quick Start (No API Keys)

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000), add one or more topics, choose source (**X / Reddit / both**) and destination (**TikTok / YouTube Shorts**), then run the pipeline.  
The full workflow works with realistic mock data when APIs are not configured.

---

## 🔑 API Keys Setup

Create a `.env.local` file in the root of the project:

```bash
cp .env.local.example .env.local
```

Then fill in the keys you want to use (all are optional):

```env
# ── X / Twitter ──────────────────────────────────────────────
TWITTER_BEARER_TOKEN=

# ── Video Generation (choose one or both) ────────────────────
DID_API_KEY=
RUNWAY_API_KEY=

# ── TikTok Auto-Upload ────────────────────────────────────────
TIKTOK_ACCESS_TOKEN=
TIKTOK_OPEN_ID=
```

---

## 📖 How to Get Each API Key

### 1. `TWITTER_BEARER_TOKEN` — X / Twitter API

Used to fetch real trending posts for your topics.  
Without it, the app uses realistic mock posts.

**Steps:**
1. Go to [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app (free tier works)
3. Go to your app → **Keys and Tokens**
4. Copy the **Bearer Token**
5. Paste it as `TWITTER_BEARER_TOKEN`

> ⚠️ The free tier allows up to 500,000 tweet reads/month.

---

### 2. `DID_API_KEY` — D-ID AI Video Generation

Used to generate an AI presenter video from the script.  
Without it, the app returns the script only (no video file).

**Steps:**
1. Go to [studio.d-id.com](https://studio.d-id.com) and create an account
2. Go to **API** section in the dashboard
3. Copy your **API Key**
4. The key format is `email:password` encoded in Base64 — D-ID handles this automatically
5. Paste it as `DID_API_KEY`

> 💡 D-ID offers a free trial with ~20 video credits.

---

### 3. `RUNWAY_API_KEY` — Runway ML Video Generation

Alternative to D-ID for AI video generation.  
The app tries D-ID first, then Runway as fallback.

**Steps:**
1. Go to [runwayml.com](https://runwayml.com) and create an account
2. Go to **Settings → API Keys**
3. Create a new API key
4. Paste it as `RUNWAY_API_KEY`

> 💡 Runway offers free credits on signup. Uses the `gen3a_turbo` model.

---

### 4. `TIKTOK_ACCESS_TOKEN` + `TIKTOK_OPEN_ID` — TikTok Auto-Upload

Used to automatically publish the generated video to your TikTok account.  
Without these, the app shows a manual upload link instead.

**Steps:**
1. Go to [developers.tiktok.com](https://developers.tiktok.com) and log in
2. Create a new app and request access to the **Content Posting API**
3. Complete the OAuth 2.0 flow to get an access token for your account:
   - Redirect URI: `https://your-domain.com/api/auth/tiktok/callback`
   - Scopes needed: `video.upload`, `video.publish`
4. After OAuth, you'll receive:
   - `access_token` → paste as `TIKTOK_ACCESS_TOKEN`
   - `open_id` → paste as `TIKTOK_OPEN_ID`

> ⚠️ TikTok access tokens expire. You'll need to refresh them periodically.  
> ⚠️ The Content Posting API requires app review by TikTok before production use.

---

## 🧪 Testing Each Feature

| Feature | Without API Key | With API Key |
|---------|----------------|--------------|
| Extract from X | Mock posts with realistic data | Real trending tweets |
| Generate Video | Script + captions + timeline | AI-generated video file |
| Upload to TikTok | Manual upload link | Auto-published to TikTok |

### Test the full mock pipeline:
1. Enter any topic (e.g. `"AI"`, `"crypto"`, `"fitness"`)
2. Click **🚀 Create TikTok Video**
3. Watch the 3-step pipeline complete
4. Review the extracted data, video script, and captions

### Test with real X data:
1. Add `TWITTER_BEARER_TOKEN` to `.env.local`
2. Restart the dev server: `bun dev`
3. Run the pipeline — you'll see real tweets

### Test video generation:
1. Add `DID_API_KEY` or `RUNWAY_API_KEY`
2. Run the pipeline — the Generate Video step will call the AI API
3. Status will show `"generating"` while the video renders

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main UI
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Styles
│   └── api/
│       ├── extract-x/route.ts      # POST /api/extract-x
│       ├── generate-video/route.ts # POST /api/generate-video
│       └── upload-tiktok/route.ts  # POST /api/upload-tiktok
```

---

## 🛠️ Development Commands

```bash
bun install       # Install dependencies
bun dev           # Start dev server (http://localhost:3000)
bun build         # Production build
bun typecheck     # TypeScript type check
bun lint          # ESLint check
```

---

## 🔒 Security Notes

- **Never commit `.env.local`** — it's already in `.gitignore`
- Use `.env.local.example` (no real values) for documentation
- Rotate API keys if accidentally exposed
- TikTok tokens should be stored securely and refreshed before expiry


### Test source and destination controls:
1. Select **Data source**: `X + Reddit`, `Only X`, or `Only Reddit`
2. Select **Publish destination**: `TikTok` or `YouTube Shorts`
3. Run the flow and verify extraction + script + generated video
4. For YouTube Shorts, the app currently returns a direct YouTube Studio upload link for manual publishing
