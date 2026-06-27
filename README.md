# 🧠 QuizAI — AI-Powered Quiz Generator from PDFs

Upload a PDF → extract its text → Claude generates a 10-question multiple-choice
quiz → take it interactively with instant feedback and a score screen.

## Tech Stack

- **Frontend:** React + Tailwind CSS (Vite)
- **Backend:** Node.js + Express
- **AI:** Google Gemini API (`gemini-2.5-flash` by default, free tier; set `GEMINI_MODEL` to override)
- **PDF parsing:** `pdf-parse` · **Upload:** `multer`

## Structure

```
/client          React app (Vite + Tailwind)
/server          Express API
  /routes        upload route + multer config
  /controllers   request handling / error mapping
  /utils         pdf.js (text extraction), gemini.js (quiz generation)
.env             GEMINI_API_KEY
```

## Setup

1. **Add your API key.** Get a free key at https://aistudio.google.com/apikey,
   then copy `.env.example` to `.env` and set it:
   ```
   GEMINI_API_KEY=...
   ```

2. **Install dependencies** (run in each folder):
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. **Run both** (two terminals):
   ```bash
   # terminal 1
   cd server && npm run dev      # http://localhost:5000

   # terminal 2
   cd client && npm run dev      # http://localhost:5173
   ```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend.

## How it works

- `POST /api/upload` accepts a single PDF (`multipart/form-data`, field `file`).
- `multer` enforces a 10MB limit and `.pdf`-only filter.
- `pdf-parse` extracts text; empty extraction → clear error. Text over 12,000
  chars is truncated and the user is notified.
- Gemini is prompted for strict JSON (via `responseMimeType: application/json`).
  As a safety net, if output is wrapped in markdown fences the server strips them
  and retries the parse before erroring. Free-tier rate limits (429) return a
  clear "try again in a moment" message.
- Quiz data is session-only — no database, no auth. The API key stays server-side.
