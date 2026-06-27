"""QuizAI generation pipeline (Python port of server/utils/gemini.js).

Used by the evaluation notebook/runner to call Gemini over the dataset and
measure quiz quality. Mirrors the production prompt, JSON-repair, and validation
logic so the evaluation reflects the real application behaviour.
"""
import json
import re
import time
import os

from google import genai

OPTION_KEYS = ["A", "B", "C", "D"]


def build_prompt(text: str) -> str:
    return (
        "Based on the following text, generate exactly 10 multiple choice "
        "questions that test understanding of the key concepts.\n\n"
        "Return ONLY valid JSON — no markdown, no code fences, no preamble, "
        "no explanation outside the JSON.\n\n"
        "Use this exact format:\n"
        "[\n"
        "  {\n"
        '    "question": "What is...?",\n'
        '    "options": {\n'
        '      "A": "First option",\n'
        '      "B": "Second option",\n'
        '      "C": "Third option",\n'
        '      "D": "Fourth option"\n'
        "    },\n"
        '    "answer": "A",\n'
        '    "explanation": "Brief explanation of why A is correct."\n'
        "  }\n"
        "]\n\n"
        f"Text:\n{text}"
    )


def strip_fences(raw: str) -> str:
    """Remove ```json ... ``` fences and any prose around the JSON array."""
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```$", "", s, flags=re.IGNORECASE)
    first, last = s.find("["), s.rfind("]")
    if first != -1 and last != -1 and last > first:
        s = s[first:last + 1]
    return s.strip()


def try_parse(s: str):
    try:
        return json.loads(s)
    except Exception:
        return None


def validate_quiz(parsed) -> bool:
    if not isinstance(parsed, list) or not parsed:
        return False
    for q in parsed:
        if not isinstance(q, dict):
            return False
        if not isinstance(q.get("question"), str):
            return False
        opts = q.get("options")
        if not isinstance(opts, dict):
            return False
        if not all(isinstance(opts.get(k), str) for k in OPTION_KEYS):
            return False
        if q.get("answer") not in OPTION_KEYS:
            return False
        if not isinstance(q.get("explanation"), str):
            return False
    return True


def _client():
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def generate_quiz(text: str, model: str, max_retries: int = 4):
    """Call a single model and return a result dict with metrics.

    No model-fallback here (unlike production) so each model is measured fairly.
    Retries only on transient 503/overload errors with exponential backoff.
    """
    prompt = build_prompt(text)
    result = {
        "model": model,
        "success": False,
        "error": None,
        "latency_s": None,
        "needed_fence_fix": False,
        "raw_len": 0,
        "quiz": None,
    }

    last_err = None
    for attempt in range(1, max_retries + 1):
        start = time.time()
        try:
            resp = _client().models.generate_content(
                model=model,
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            result["latency_s"] = round(time.time() - start, 2)
            raw = resp.text or ""
            result["raw_len"] = len(raw)

            parsed = try_parse(raw)
            if parsed is None:
                parsed = try_parse(strip_fences(raw))
                if parsed is not None:
                    result["needed_fence_fix"] = True

            if parsed is not None and validate_quiz(parsed):
                result["success"] = True
                result["quiz"] = parsed
            else:
                result["error"] = "MALFORMED_RESPONSE"
            return result
        except Exception as e:
            last_err = e
            msg = str(e)
            transient = "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower()
            rate = "429" in msg or "RESOURCE_EXHAUSTED" in msg
            if transient and attempt < max_retries:
                time.sleep(2 ** (attempt - 1))  # 1s, 2s, 4s
                continue
            result["error"] = "RATE_LIMIT" if rate else ("OVERLOADED" if transient else "ERROR")
            result["latency_s"] = round(time.time() - start, 2)
            return result

    result["error"] = str(last_err)
    return result
