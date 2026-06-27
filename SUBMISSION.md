# QuizAI — Submission Guide

This file maps every grading criterion to the deliverable that satisfies it, and
describes how to package everything into the single Google Drive folder.

## Project topic

**Generative AI** — QuizAI generates multiple-choice quizzes from documents using
Google Gemini large language models.

---

## Part 1 — Project criteria (50 pts)

| # | Criterion | Pts | Deliverable |
|---|-----------|-----|-------------|
| a | Collecting accurate dataset | 5 | `data/` — 10 verified documents in `data/sources/`, documented in `data/manifest.csv` and `data/README.md` |
| b | Selection of AI topic | 5 | Generative AI — justified in `REPORT.md` Ch. 1–2 |
| c | Processing & visualization | 15 | `analysis/quizai_evaluation.ipynb` (Sections 1–2) + figures `analysis/figures/01–02` |
| d | Model evaluation & result analysis | 15 | `analysis/quizai_evaluation.ipynb` (Sections 3–5), `analysis/metrics_summary.csv`, figures `03–05` |
| e | Deployment | 10 | Working app + `DEPLOYMENT.md` (single-unit local deployment); program link in repo |

## Part 2 — Report criteria (50 pts)

| Criterion | Pts | Deliverable |
|-----------|-----|-------------|
| Title suitability to topic | 10 | `REPORT.md` / `REPORT.pdf` — title matches Generative AI topic |
| Neatness of writing | 10 | `REPORT.html` → print to PDF (clean, formatted) |
| Systematic report (title, Ch. 1–5, bibliography) | 20 | `REPORT.md` — Abstract, Ch. 1 Introduction, Ch. 2 Literature Review, Ch. 3 Methodology, Ch. 4 Results & Discussion, Ch. 5 Conclusion, References |
| Up-to-date bibliography (Mendeley) | 10 | References section (APA 7th, 2017–2023 sources); import the `.bib`/RIS into Mendeley |

---

## Key results (for quick reference)

- `gemini-2.5-flash`: **100% success**, 12.4 s avg latency, exactly 10 questions
  every time, **100% first-pass JSON validity**.
- Finding: a clear **answer-position bias** — correct answer was C 56%, B 36%,
  D 8%, A 0% of the time (reproduces Zhao et al., 2021).
- `gemini-2.0-flash`: 0% (no free-tier quota on the test key);
  `gemini-2.5-flash-lite`: 40% (transient overload / rate limits).

---

## How to produce the report PDF

1. Open `REPORT.html` in a web browser (Chrome/Edge).
2. Press **Ctrl+P** → Destination **Save as PDF** → Save as `REPORT.pdf`.
   (Images are embedded, so the PDF is self-contained.)

## Recommended Google Drive folder structure

```
QuizAI_Project/
├── REPORT.pdf                      ← the report (from REPORT.html)
├── program_link.txt               ← GitHub repo URL + how to run
├── code/                          ← full source (client/ + server/)
├── dataset/                       ← copy of data/ (sources + manifest)
├── notebook/
│   ├── quizai_evaluation.ipynb    ← executed, with outputs
│   ├── quizai_evaluation.html     ← read-only view
│   └── figures/                   ← all charts
└── screenshots/                   ← app screenshots (upload, quiz, score)
```

> Note (from the assignment): points a–e go in **one** Google Drive file/folder,
> and the program link must be included (`program_link.txt` or in the report).

## Final checklist

- [ ] Fill in your name/NIM in `REPORT.md` header, then rebuild `REPORT.html`
      (`python analysis/build_report_html.py`) and export `REPORT.pdf`.
- [ ] Add the GitHub repository link to `program_link.txt` and the report header.
- [ ] Capture 2–3 app screenshots into `screenshots/`.
- [ ] Upload everything to the Google Drive folder and share the link.
- [ ] (Optional) Import the references into Mendeley to confirm formatting.
```
