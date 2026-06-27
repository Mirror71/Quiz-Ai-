// Node evaluation runner for QuizAI.
// Iterates the dataset (../../data) over several Gemini models, measures quiz
// quality, and writes ../../data/eval_results.json (schema consumed by the
// Python analysis notebook). Run from the server folder:  node eval/run_eval.mjs
//
// Safe to re-run: already-successful (doc, model) pairs are skipped.
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const DATA = path.join(ROOT, 'data');
const SOURCES = path.join(DATA, 'sources');
const RESULTS = path.join(DATA, 'eval_results.json');

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
const DELAY_MS = 4000;
const MAX_RETRIES = 4;
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildPrompt(text) {
  return `Based on the following text, generate exactly 10 multiple choice questions that test understanding of the key concepts.

Return ONLY valid JSON — no markdown, no code fences, no preamble, no explanation outside the JSON.

Use this exact format:
[
  {
    "question": "What is...?",
    "options": { "A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option" },
    "answer": "A",
    "explanation": "Brief explanation of why A is correct."
  }
]

Text:
${text}`;
}

function stripFences(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const f = s.indexOf('['), l = s.lastIndexOf(']');
  if (f !== -1 && l !== -1 && l > f) s = s.slice(f, l + 1);
  return s.trim();
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function validateQuiz(p) {
  if (!Array.isArray(p) || !p.length) return false;
  return p.every(
    (q) => q && typeof q.question === 'string' && q.options &&
      OPTION_KEYS.every((k) => typeof q.options[k] === 'string') &&
      OPTION_KEYS.includes(q.answer) && typeof q.explanation === 'string'
  );
}

async function generateForModel(text, model) {
  const prompt = buildPrompt(text);
  const res = { model, success: false, error: null, latency_s: null, needed_fence_fix: false, raw_len: 0, quiz: null };
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const resp = await ai.models.generateContent({
        model, contents: prompt, config: { responseMimeType: 'application/json' },
      });
      res.latency_s = +((Date.now() - start) / 1000).toFixed(2);
      const raw = resp.text || '';
      res.raw_len = raw.length;
      let parsed = tryParse(raw);
      if (parsed === null) { parsed = tryParse(stripFences(raw)); if (parsed !== null) res.needed_fence_fix = true; }
      if (parsed !== null && validateQuiz(parsed)) { res.success = true; res.quiz = parsed; }
      else res.error = 'MALFORMED_RESPONSE';
      return res;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const status = e?.status ?? e?.code;
      const transient = status === 503 || /UNAVAILABLE|overloaded|high demand/i.test(msg);
      const rate = status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg);
      if (transient && attempt < MAX_RETRIES) { await sleep(1000 * 2 ** (attempt - 1)); continue; }
      res.latency_s = +((Date.now() - start) / 1000).toFixed(2);
      res.error = rate ? 'RATE_LIMIT' : (transient ? 'OVERLOADED' : `ERROR: ${msg.slice(0, 120)}`);
      return res;
    }
  }
  res.error = `ERROR: ${String(lastErr).slice(0, 120)}`;
  return res;
}

function loadManifest() {
  const csv = fs.readFileSync(path.join(DATA, 'manifest.csv'), 'utf-8').trim().split('\n');
  const header = csv[0].split(',');
  return csv.slice(1).map((line) => {
    // simple CSV (quoted fields may contain commas) — split respecting quotes
    const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    const o = {}; header.forEach((h, i) => (o[h] = cols[i]));
    return o;
  });
}

async function main() {
  const docs = loadManifest();
  let records = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf-8')) : [];
  const done = new Set(records.filter((r) => r.success).map((r) => `${r.doc_id}::${r.model}`));
  console.log(`Loaded ${records.length} cached records (${done.size} successful).`);

  for (const doc of docs) {
    const text = fs.readFileSync(path.join(SOURCES, doc.filename), 'utf-8');
    for (const model of MODELS) {
      if (done.has(`${doc.id}::${model}`)) { console.log(`  skip doc ${doc.id} / ${model}`); continue; }
      process.stdout.write(`  call doc ${doc.id} / ${model} ... `);
      const r = await generateForModel(text, model);
      Object.assign(r, { doc_id: doc.id, doc_title: doc.title, domain: doc.domain, source_chars: text.length });
      records = records.filter((x) => !(x.doc_id === doc.id && x.model === model));
      records.push(r);
      fs.writeFileSync(RESULTS, JSON.stringify(records, null, 2));
      console.log(r.success ? `OK ${r.latency_s}s` : `FAIL(${r.error}) ${r.latency_s}s`);
      await sleep(DELAY_MS);
    }
  }
  const ok = records.filter((r) => r.success).length;
  console.log(`\nDone. ${ok}/${records.length} successful records -> ${RESULTS}`);
}

main();
