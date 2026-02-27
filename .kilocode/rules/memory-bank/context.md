# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] X → TikTok AI Video Creator app built
- [x] 5 bugs fixed + free API alternatives (Reddit, HuggingFace, Pexels)
- [x] High-priority UX improvements: video preview player, multi-topic parallel generation, localStorage history, copy script button, data source badge

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Main UI: topic input, pipeline tracker, results | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles + custom animations | ✅ Ready |
| `src/app/api/extract-x/route.ts` | POST: Extract posts/summary/key points from X | ✅ Ready |
| `src/app/api/generate-video/route.ts` | POST: Build video script + captions, call D-ID/Runway | ✅ Ready |
| `src/app/api/upload-tiktok/route.ts` | POST: Upload video to TikTok via Content Posting API | ✅ Ready |
| `.env.local.example` | API key documentation | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

App is fully built. Users need to configure API keys in `.env.local` to unlock full functionality:
- `TWITTER_BEARER_TOKEN` — real X data (mock data used without it)
- `DID_API_KEY` or `RUNWAY_API_KEY` — AI video generation
- `TIKTOK_ACCESS_TOKEN` + `TIKTOK_OPEN_ID` — auto-upload to TikTok

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
