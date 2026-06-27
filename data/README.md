# QuizAI Evaluation Dataset

This dataset is the input corpus used to evaluate the QuizAI Generative-AI
pipeline. Each file in `sources/` is a curated, factually-verified educational
passage drawn from standard textbooks and reputable encyclopedic references
(see `manifest.csv` for the source of each document).

## Why this is the dataset

QuizAI is a **Generative AI** system: its task is to read a source document and
generate a multiple-choice quiz. The natural unit of data is therefore a
**source document**. We deliberately use clean, accurate, text-based passages so
that:

1. The *ground truth* (the facts the quiz should test) is known and verifiable,
   which lets us assess factual correctness of generated questions.
2. Results are not confounded by PDF/PPTX extraction noise — extraction is
   tested separately in the application layer.

## Contents

- `sources/` — 10 documents across Biology, Physics, History, Economics, Earth
  Science, and Computer Science (domain diversity ensures the evaluation is not
  biased toward a single subject).
- `manifest.csv` — id, filename, title, domain, reference source, and an
  accuracy-verified flag for every document.

## Accuracy

Every passage was written from and cross-checked against the references listed
in `manifest.csv`. The `accuracy_verified` column records this manual check.
These documents are original prose summarizing established, non-controversial
facts; they contain no copyrighted excerpts.

## How it is used

The notebook `../analysis/quizai_evaluation.ipynb` loads every document, runs the
QuizAI generation pipeline against multiple Gemini models, and computes
processing statistics and evaluation metrics from the generated quizzes.
