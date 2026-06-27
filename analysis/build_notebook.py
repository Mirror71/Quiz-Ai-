"""Builds analysis/quizai_evaluation.ipynb from code/markdown cell definitions.

Generating the notebook programmatically (via nbformat) avoids hand-writing
fragile JSON. Run:  python analysis/build_notebook.py
Then execute with nbconvert to populate outputs and figures.
"""
import nbformat as nbf
from pathlib import Path

nb = nbf.v4.new_notebook()
cells = []
md = lambda s: cells.append(nbf.v4.new_markdown_cell(s))
code = lambda s: cells.append(nbf.v4.new_code_cell(s))

# ---------------------------------------------------------------- Title
md(r"""# QuizAI — Generative AI Evaluation Notebook

**Project topic:** Generative AI
**System:** QuizAI — generates multiple-choice quizzes from documents using Google Gemini.

This notebook covers two graded stages of the project:

* **Processing & visualization** — loading the dataset, computing text
  pre-processing statistics, and visualizing them.
* **Model evaluation & result analysis** — running the QuizAI generation
  pipeline across multiple Gemini models and measuring quiz quality.

The heavy API calls are performed by `run_eval.py`, which caches its results to
`data/eval_results.json`; this notebook loads that cache, so it is fast and
reproducible.""")

# ---------------------------------------------------------------- Setup
md("## 0. Setup")
code(r"""import json
from pathlib import Path
import csv

import pandas as pd
import matplotlib.pyplot as plt

ROOT = Path.cwd().parent if Path.cwd().name == "analysis" else Path.cwd()
DATA = ROOT / "data"
SOURCES = DATA / "sources"
FIG = ROOT / "analysis" / "figures"
FIG.mkdir(parents=True, exist_ok=True)

plt.rcParams["figure.dpi"] = 110
plt.rcParams["axes.grid"] = True
plt.rcParams["grid.alpha"] = 0.3
print("Root:", ROOT)""")

# ---------------------------------------------------------------- Section 1
md(r"""## 1. The Dataset

The dataset is a corpus of 10 factually-verified educational documents spanning
six domains (Biology, Physics, History, Economics, Earth Science, Computer
Science). Each document is the *input* to the QuizAI pipeline. Sources and an
accuracy-verified flag are recorded in `data/manifest.csv`.""")
code(r"""with open(DATA / "manifest.csv", newline="", encoding="utf-8") as f:
    manifest = list(csv.DictReader(f))

rows = []
for d in manifest:
    text = (SOURCES / d["filename"]).read_text(encoding="utf-8")
    rows.append({
        "id": int(d["id"]),
        "title": d["title"],
        "domain": d["domain"],
        "chars": len(text),
        "words": len(text.split()),
        "est_tokens": round(len(text) / 4),  # ~4 chars/token heuristic
        "verified": d["accuracy_verified"],
    })

docs = pd.DataFrame(rows).sort_values("id").reset_index(drop=True)
docs""")

# ---------------------------------------------------------------- Section 2
md(r"""## 2. Pre-processing & Visualization

Before generation, QuizAI extracts text and **truncates inputs longer than
12,000 characters** to stay within an efficient context window. We visualize the
document sizes and the domain distribution to characterize the dataset.""")

code(r"""MAX_CHARS = 12000
docs["truncated"] = docs["chars"] > MAX_CHARS
print("Documents that would be truncated:", int(docs["truncated"].sum()))
docs[["chars", "words", "est_tokens"]].describe().round(1)""")

md("### 2.1 Document length vs. the 12,000-character truncation limit")
code(r"""fig, ax = plt.subplots(figsize=(9, 4.5))
colors = ["#ef4444" if t else "#6366f1" for t in docs["truncated"]]
ax.bar(docs["title"], docs["chars"], color=colors)
ax.axhline(MAX_CHARS, color="#ef4444", ls="--", lw=1.5, label=f"Truncation limit ({MAX_CHARS:,} chars)")
ax.set_ylabel("Characters")
ax.set_title("Source document length vs. truncation limit")
ax.set_xticklabels(docs["title"], rotation=45, ha="right")
ax.legend()
fig.tight_layout()
fig.savefig(FIG / "01_doc_lengths.png", bbox_inches="tight")
plt.show()""")

md("### 2.2 Domain distribution and word-count spread")
code(r"""fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
domain_counts = docs["domain"].value_counts()
axes[0].pie(domain_counts, labels=domain_counts.index, autopct="%1.0f%%", startangle=90,
            colors=plt.cm.Set3.colors)
axes[0].set_title("Documents by domain")

axes[1].hist(docs["words"], bins=8, color="#6366f1", edgecolor="white")
axes[1].set_xlabel("Words per document")
axes[1].set_ylabel("Count")
axes[1].set_title("Word-count distribution")
fig.tight_layout()
fig.savefig(FIG / "02_domain_words.png", bbox_inches="tight")
plt.show()""")

# ---------------------------------------------------------------- Section 3
md(r"""## 3. The Generation Pipeline

For each document we prompt Gemini to return **exactly 10** multiple-choice
questions as strict JSON (`response_mime_type=application/json`). The pipeline
(`quizai_pipeline.py`) mirrors the production server: it repairs markdown-fenced
output and validates the schema (each item must have a question, four options
A–D, a valid answer key, and an explanation).

We evaluate three models so we can compare them. Results are produced by
`run_eval.py` and cached here.""")
code(r"""results_path = DATA / "eval_results.json"
records = json.loads(results_path.read_text(encoding="utf-8")) if results_path.exists() else []
ev = pd.DataFrame(records)
print(f"Loaded {len(ev)} evaluation records across models: {sorted(ev['model'].unique()) if len(ev) else 'NONE'}")
ev[["doc_id", "doc_title", "model", "success", "latency_s", "needed_fence_fix", "error"]].head(12)""")

# ---------------------------------------------------------------- Section 4
md(r"""## 4. Model Evaluation Metrics

We derive quality metrics from the generated quizzes:

| Metric | What it measures |
|--------|------------------|
| **Success rate** | % of documents that yielded a valid, schema-correct quiz |
| **Avg. latency** | Mean wall-clock generation time |
| **Avg. #questions** | Compliance with the "exactly 10" instruction |
| **First-pass JSON** | % of valid quizzes that parsed *without* fence-repair |
| **Answer balance** | How uniformly answers spread over A/B/C/D (position-bias check) |""")

code(r"""from collections import Counter

def quiz_stats(quiz):
    if not quiz:
        return None
    answers = Counter(q["answer"] for q in quiz)
    q_lens = [len(q["question"]) for q in quiz]
    return {
        "n_questions": len(quiz),
        "answers": {k: answers.get(k, 0) for k in ["A", "B", "C", "D"]},
        "avg_q_len": sum(q_lens) / len(q_lens),
    }

per_model = []
answer_totals = {}
all_q_lengths = []
for model, grp in ev.groupby("model"):
    succ = grp[grp["success"]]
    stats = [quiz_stats(q) for q in succ["quiz"] if q]
    ans = Counter()
    nqs = []
    for s in stats:
        if s:
            ans.update(s["answers"])
            nqs.append(s["n_questions"])
    for q in succ["quiz"]:
        if q:
            all_q_lengths.extend(len(x["question"]) for x in q)
    answer_totals[model] = {k: ans.get(k, 0) for k in ["A", "B", "C", "D"]}
    total_ans = sum(ans.values()) or 1
    # Position-bias score: mean abs deviation from a perfectly uniform 25%.
    bias = sum(abs(ans.get(k, 0) / total_ans - 0.25) for k in ["A", "B", "C", "D"]) / 4
    per_model.append({
        "model": model,
        "n_docs": len(grp),
        "success_rate_%": round(100 * succ.shape[0] / max(len(grp), 1), 1),
        "avg_latency_s": round(succ["latency_s"].mean(), 2) if len(succ) else None,
        "avg_questions": round(sum(nqs) / len(nqs), 2) if nqs else None,
        "first_pass_json_%": round(100 * (succ["needed_fence_fix"] == False).mean(), 1) if len(succ) else None,
        "answer_bias": round(bias, 3),
    })

metrics = pd.DataFrame(per_model).sort_values("model").reset_index(drop=True)
metrics.to_csv(ROOT / "analysis" / "metrics_summary.csv", index=False)
metrics""")

md("### 4.1 Success rate and latency by model")
code(r"""if len(metrics):
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
    axes[0].bar(metrics["model"], metrics["success_rate_%"], color="#22c55e")
    axes[0].set_title("Success rate by model")
    axes[0].set_ylabel("% valid quizzes")
    axes[0].set_ylim(0, 105)
    for i, v in enumerate(metrics["success_rate_%"]):
        axes[0].text(i, v + 1, f"{v}%", ha="center")
    axes[0].set_xticklabels(metrics["model"], rotation=20, ha="right")

    axes[1].bar(metrics["model"], metrics["avg_latency_s"], color="#3b82f6")
    axes[1].set_title("Average generation latency by model")
    axes[1].set_ylabel("Seconds")
    axes[1].set_xticklabels(metrics["model"], rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(FIG / "03_success_latency.png", bbox_inches="tight")
    plt.show()
else:
    print("No evaluation data yet.")""")

md("""### 4.2 Answer-position distribution (bias check)

A well-formed quiz should spread correct answers roughly evenly across A/B/C/D.
A strong skew indicates the model has a position bias.""")
code(r"""if answer_totals:
    fig, ax = plt.subplots(figsize=(9, 4.5))
    keys = ["A", "B", "C", "D"]
    models = list(answer_totals.keys())
    x = range(len(keys))
    w = 0.8 / max(len(models), 1)
    for i, m in enumerate(models):
        vals = [answer_totals[m][k] for k in keys]
        ax.bar([xi + i * w for xi in x], vals, width=w, label=m)
    ax.set_xticks([xi + w * (len(models) - 1) / 2 for xi in x])
    ax.set_xticklabels(keys)
    ax.set_xlabel("Correct-answer option")
    ax.set_ylabel("Count across all quizzes")
    ax.set_title("Distribution of correct-answer positions by model")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIG / "04_answer_bias.png", bbox_inches="tight")
    plt.show()""")

md("### 4.3 Question-length distribution")
code(r"""if all_q_lengths:
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(all_q_lengths, bins=20, color="#a855f7", edgecolor="white")
    ax.set_xlabel("Question length (characters)")
    ax.set_ylabel("Number of questions")
    ax.set_title(f"Generated question-length distribution (n={len(all_q_lengths)})")
    fig.tight_layout()
    fig.savefig(FIG / "05_question_lengths.png", bbox_inches="tight")
    plt.show()
    print("Mean question length:", round(sum(all_q_lengths)/len(all_q_lengths), 1), "chars")""")

# ---------------------------------------------------------------- Section 5
md(r"""## 5. Results Analysis

*(The narrative below is finalized from the metrics table and figures above.)*

- **Reliability.** The success-rate chart shows how dependably each model
  returns a schema-valid 10-question quiz. Because the pipeline enforces
  `response_mime_type=application/json` and validates every field, "success"
  means the output is directly usable by the application with no manual fixing.
- **Latency vs. quality trade-off.** Faster/lighter models reduce latency; the
  table lets us judge whether that costs reliability or question quality.
- **Instruction compliance.** `avg_questions` near 10.0 indicates the model
  reliably follows the "exactly 10" instruction.
- **JSON robustness.** `first_pass_json_%` shows how often the JSON-mode output
  was already clean; the fence-repair step is a safety net for the remainder.
- **Answer-position bias.** The bias score and distribution chart reveal whether
  correct answers cluster on particular letters — important for fair quizzes.

See the report (Chapter 4) for the full written discussion of these results.""")

md("""## 6. Conclusion

The QuizAI Generative-AI pipeline was evaluated on a 10-document, six-domain
dataset across multiple Gemini models. The metrics and visualizations above
quantify reliability, speed, instruction-following, and answer balance, and
identify the best model configuration for deployment.""")

nb["cells"] = cells
out = Path(__file__).resolve().parent / "quizai_evaluation.ipynb"
nbf.write(nb, out)
print("Wrote", out)
