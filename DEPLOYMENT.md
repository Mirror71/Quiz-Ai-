# QuizAI — Deployment Guide

QuizAI can be deployed two ways. For this project we use **local deployment**
(single process), which is the simplest reproducible setup.

## Prerequisites

- Node.js 18+ (tested on Node 20)
- A Google Gemini API key — get a free one at https://aistudio.google.com/apikey
- Create `.env` in the project root:
  ```
  GEMINI_API_KEY=your-key-here
  GEMINI_MODEL=gemini-2.5-flash
  PORT=5000
  ```

## Option A — Single-unit local deployment (recommended)

In production mode the Express server **serves the built React client**, so the
entire app runs from one process on one port.

```bash
npm run install:all     # installs both server and client dependencies
npm run deploy:local    # builds the client, then starts the server
```

Then open **http://localhost:5000** — the UI and the API are served together.

Equivalent manual steps:
```bash
npm --prefix client run build     # produces client/dist
node server/index.js              # detects client/dist and serves it
```

When `client/dist` exists, the server logs `Serving built client from /client/dist`
and handles SPA routing with a fallback to `index.html`.

## Option B — Development mode (two processes, hot reload)

Use this while editing code. The Vite dev server proxies `/api/*` to Express.

```bash
# terminal 1
npm run dev:server      # http://localhost:5000

# terminal 2
npm run dev:client      # http://localhost:5173  (open this one)
```

## Architecture

```
Browser ──HTTP──> Express (:5000) ──HTTPS──> Google Gemini API
                    │
                    ├── POST /api/upload   (multer → pdf/pptx text extract → Gemini → quiz JSON)
                    └── static /client/dist (production single-unit mode)
```

## Notes on reliability

- The server auto-retries transient Gemini `503` (model overloaded) errors with
  exponential backoff and falls back across models
  (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.5-flash-lite`).
- Quota (`429`) and persistent overload return clear, user-friendly messages.
- No database is used; quiz state is session-only in the browser.
