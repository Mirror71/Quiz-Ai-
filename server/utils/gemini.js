import { GoogleGenAI } from '@google/genai';

// Free-tier friendly model. Override with GEMINI_MODEL in .env if needed.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let client = null;
function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

function buildPrompt(text) {
  return `Based on the following text, generate exactly 10 multiple choice questions that test understanding of the key concepts.

Return ONLY valid JSON — no markdown, no code fences, no preamble, no explanation outside the JSON.

Use this exact format:
[
  {
    "question": "What is...?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "answer": "A",
    "explanation": "Brief explanation of why A is correct."
  }
]

Text:
${text}`;
}

/**
 * Strips markdown code fences (```json ... ```) that the model sometimes wraps
 * its output in, and trims any stray preamble before the first JSON array.
 */
function stripFences(raw) {
  let s = raw.trim();
  // Remove leading/trailing triple-backtick fences with optional language tag.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // If there's still surrounding prose, grab the outermost JSON array.
  const first = s.indexOf('[');
  const last = s.lastIndexOf(']');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

function validateQuiz(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  return parsed.every(
    (q) =>
      q &&
      typeof q.question === 'string' &&
      q.options &&
      ['A', 'B', 'C', 'D'].every((k) => typeof q.options[k] === 'string') &&
      ['A', 'B', 'C', 'D'].includes(q.answer) &&
      typeof q.explanation === 'string'
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Models to try in order. The configured model first, then fallbacks for when
// the primary is temporarily overloaded (503). Duplicates are removed.
const MODEL_CHAIN = [...new Set([MODEL, 'gemini-2.0-flash', 'gemini-2.5-flash-lite'])];
const MAX_RETRIES = 3; // per model, for transient 503/overload errors

function classifyError(err) {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message || '');
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'RATE_LIMIT';
  if (status === 503 || /UNAVAILABLE|overloaded|high demand/i.test(msg))
    return 'OVERLOADED';
  return 'OTHER';
}

/**
 * Calls the model chain with exponential backoff on transient overload (503).
 * On a 429 (quota) for one model, moves on to the next model immediately.
 */
async function generateRaw(text) {
  let sawRateLimit = false;
  let lastErr = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await getClient().models.generateContent({
          model,
          contents: buildPrompt(text),
          config: {
            // Ask Gemini for raw JSON — avoids markdown fences in the first place.
            responseMimeType: 'application/json',
          },
        });
        return response.text || '';
      } catch (err) {
        lastErr = err;
        const kind = classifyError(err);
        if (kind === 'OVERLOADED' && attempt < MAX_RETRIES) {
          // Transient — back off (1s, 2s, 4s…) and retry the same model.
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        if (kind === 'RATE_LIMIT') {
          sawRateLimit = true; // quota won't recover fast — try the next model
          break;
        }
        // Overloaded after all retries, or some other error: try next model.
        break;
      }
    }
  }

  // Every model failed.
  throw new Error(sawRateLimit ? 'RATE_LIMIT' : 'OVERLOADED');
}

/**
 * Calls Gemini and returns a validated quiz array.
 * @throws {Error} 'MALFORMED_RESPONSE' if the response can't be parsed into a valid quiz.
 * @throws {Error} 'RATE_LIMIT' if quota is exhausted across all models.
 * @throws {Error} 'OVERLOADED' if all models are temporarily unavailable.
 */
export async function generateQuiz(text) {
  const raw = await generateRaw(text);

  // First parse attempt: as-is.
  let parsed = tryParse(raw);
  // Second attempt: strip markdown fences / surrounding prose.
  if (!parsed) {
    parsed = tryParse(stripFences(raw));
  }

  if (!parsed || !validateQuiz(parsed)) {
    throw new Error('MALFORMED_RESPONSE');
  }

  return parsed;
}

function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
