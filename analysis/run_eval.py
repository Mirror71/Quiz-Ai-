"""Runs the QuizAI pipeline over the dataset for several models and caches the
per-(document, model) results to data/eval_results.json.

Safe to re-run: already-successful (document, model) pairs are skipped, so it can
resume after rate limits or interruptions. A short delay between calls respects
the Gemini free-tier rate limits.
"""
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quizai_pipeline import generate_quiz  # noqa: E402

import csv

DATA = ROOT / "data"
SOURCES = DATA / "sources"
RESULTS_FILE = DATA / "eval_results.json"

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]
DELAY_BETWEEN_CALLS = 4  # seconds, to respect free-tier RPM


def load_manifest():
    with open(DATA / "manifest.csv", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_cache():
    if RESULTS_FILE.exists():
        with open(RESULTS_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_cache(records):
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)


def main():
    docs = load_manifest()
    records = load_cache()
    done = {(r["doc_id"], r["model"]) for r in records if r.get("success")}

    print(f"Loaded {len(records)} cached records ({len(done)} successful).")

    for doc in docs:
        doc_id = doc["id"]
        text = (SOURCES / doc["filename"]).read_text(encoding="utf-8")
        for model in MODELS:
            if (doc_id, model) in done:
                print(f"  skip  doc {doc_id} / {model} (cached)")
                continue
            print(f"  call  doc {doc_id} / {model} ...", end=" ", flush=True)
            res = generate_quiz(text, model)
            res["doc_id"] = doc_id
            res["doc_title"] = doc["title"]
            res["domain"] = doc["domain"]
            res["source_chars"] = len(text)
            # Drop any prior record for this pair, then append the fresh one.
            records = [r for r in records if not (r["doc_id"] == doc_id and r["model"] == model)]
            records.append(res)
            save_cache(records)
            status = "OK" if res["success"] else f"FAIL({res['error']})"
            print(f"{status} {res['latency_s']}s")
            time.sleep(DELAY_BETWEEN_CALLS)

    ok = sum(1 for r in records if r.get("success"))
    print(f"\nDone. {ok}/{len(records)} successful records saved to {RESULTS_FILE}")


if __name__ == "__main__":
    main()
