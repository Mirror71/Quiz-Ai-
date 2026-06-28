"""QuizAI — Streamlit version.

A Generative-AI app that turns a PDF or PowerPoint into an interactive
multiple-choice quiz using Google Gemini. Deployable to Streamlit Community Cloud.

Run locally:   streamlit run streamlit_app.py
Secrets:       set GEMINI_API_KEY in .streamlit/secrets.toml (or env var).
"""
import io
import json
import os
import re
import time
import zipfile
from collections import Counter

import requests
import streamlit as st
from pypdf import PdfReader

# --------------------------------------------------------------------------- config
MAX_CHARS = 12000
OPTION_KEYS = ["A", "B", "C", "D"]
MODEL_CHAIN = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]
API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"

LOGO_ICON = "client/public/logo-icon.png"
LOGO_FULL = "client/public/logo-full.png"

st.set_page_config(
    page_title="QuizAI — AI Quiz Generator",
    page_icon=LOGO_ICON if os.path.exists(LOGO_ICON) else "🧠",
    layout="centered",
)


# --------------------------------------------------------------------------- helpers
def get_api_key():
    try:
        if "GEMINI_API_KEY" in st.secrets:
            return st.secrets["GEMINI_API_KEY"]
    except Exception:
        pass
    return os.environ.get("GEMINI_API_KEY")


def extract_pdf(file_bytes):
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def extract_pptx(file_bytes):
    """Pull <a:t> text runs from each slide XML, in slide order."""
    text_parts = []
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
        slides = sorted(
            (n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
            key=lambda n: int(re.search(r"slide(\d+)", n).group(1)),
        )
        for name in slides:
            xml = z.read(name).decode("utf-8", errors="ignore")
            runs = re.findall(r"<a:t>(.*?)</a:t>", xml, flags=re.DOTALL)
            line = " ".join(runs).strip()
            if line:
                text_parts.append(line)
    return "\n\n".join(text_parts).strip()


def extract_text(uploaded):
    name = uploaded.name.lower()
    data = uploaded.getvalue()
    if name.endswith(".pdf"):
        raw = extract_pdf(data)
    elif name.endswith(".pptx"):
        raw = extract_pptx(data)
    else:
        raise ValueError("UNSUPPORTED")
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("EMPTY")
    truncated = len(raw) > MAX_CHARS
    return raw[:MAX_CHARS], truncated


def build_prompt(text):
    return (
        "Based on the following text, generate exactly 10 multiple choice "
        "questions that test understanding of the key concepts.\n\n"
        "Return ONLY valid JSON — no markdown, no code fences, no preamble, no "
        "explanation outside the JSON.\n\n"
        "Use this exact format:\n"
        '[{"question": "What is...?", "options": {"A": "First", "B": "Second", '
        '"C": "Third", "D": "Fourth"}, "answer": "A", '
        '"explanation": "Brief explanation."}]\n\n'
        f"Text:\n{text}"
    )


def strip_fences(raw):
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
    s = re.sub(r"\s*```$", "", s, flags=re.I)
    f, l = s.find("["), s.rfind("]")
    if f != -1 and l != -1 and l > f:
        s = s[f:l + 1]
    return s.strip()


def valid_quiz(parsed):
    if not isinstance(parsed, list) or not parsed:
        return False
    for q in parsed:
        if not (isinstance(q, dict) and isinstance(q.get("question"), str)):
            return False
        opts = q.get("options")
        if not (isinstance(opts, dict) and all(isinstance(opts.get(k), str) for k in OPTION_KEYS)):
            return False
        if q.get("answer") not in OPTION_KEYS or not isinstance(q.get("explanation"), str):
            return False
    return True


def generate_quiz(text, api_key):
    prompt = build_prompt(text)
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json", "maxOutputTokens": 8192},
    }
    saw_rate = False
    last_detail = "unknown error"
    for model in MODEL_CHAIN:
        for attempt in range(3):
            try:
                r = requests.post(
                    f"{API_ROOT}/{model}:generateContent",
                    params={"key": api_key},
                    json=body,
                    timeout=90,
                )
            except requests.RequestException as e:
                last_detail = f"{model}: network error ({e.__class__.__name__})"
                break
            if r.status_code == 200:
                try:
                    parts = r.json()["candidates"][0]["content"]["parts"]
                    raw = "".join(p.get("text", "") for p in parts)
                except Exception:
                    last_detail = f"{model}: 200 but empty/blocked response — {r.text[:200]}"
                    break
                parsed = None
                try:
                    parsed = json.loads(raw)
                except Exception:
                    try:
                        parsed = json.loads(strip_fences(raw))
                    except Exception:
                        parsed = None
                if parsed and valid_quiz(parsed):
                    return parsed
                raise ValueError("MALFORMED")
            # non-200 response — record details for diagnostics
            last_detail = f"{model}: HTTP {r.status_code} — {r.text[:200].strip()}"
            if r.status_code == 503 and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 429:
                saw_rate = True
            break
    if saw_rate:
        raise RuntimeError("RATE_LIMIT")
    raise RuntimeError("FAILED::" + last_detail)


# --------------------------------------------------------------------------- state
ss = st.session_state
ss.setdefault("stage", "upload")
ss.setdefault("quiz", None)
ss.setdefault("answers", [])
ss.setdefault("idx", 0)
ss.setdefault("notice", None)


def reset_to_upload():
    ss.stage = "upload"
    ss.quiz = None
    ss.answers = []
    ss.idx = 0
    ss.notice = None


# --------------------------------------------------------------------------- header
col1, col2 = st.columns([1, 6])
with col1:
    if os.path.exists(LOGO_ICON):
        st.image(LOGO_ICON, width=64)
    else:
        st.markdown("# 🧠")
with col2:
    st.title("QuizAI")
    st.caption("Turn any PDF or PowerPoint into a quiz — powered by Google Gemini")
st.divider()


# --------------------------------------------------------------------------- screens
def screen_upload():
    st.subheader("Upload a document")
    st.write("Upload a text-based **PDF** or **PowerPoint (.pptx)** and we'll generate 10 questions.")
    uploaded = st.file_uploader("Choose a file", type=["pdf", "pptx"], label_visibility="collapsed")

    if uploaded is not None:
        size_mb = len(uploaded.getvalue()) / (1024 * 1024)
        st.info(f"📎 **{uploaded.name}** — {size_mb:.2f} MB")
        if size_mb > 10:
            st.error("File exceeds 10MB limit.")
            return

        if st.button("Generate Quiz", type="primary", use_container_width=True):
            api_key = get_api_key()
            if not api_key:
                st.error("No GEMINI_API_KEY configured. Add it in the app secrets.")
                return
            try:
                with st.spinner("Reading your document…"):
                    text, truncated = extract_text(uploaded)
            except ValueError as e:
                msg = str(e)
                if msg == "EMPTY":
                    st.error("This file contains no extractable text (it may be scanned/image-only).")
                elif msg == "UNSUPPORTED":
                    st.error("Please upload a PDF or PowerPoint (.pptx) file.")
                else:
                    st.error("Could not read the file. Please try another.")
                return

            try:
                with st.spinner("Generating your quiz with Gemini… (5–15s)"):
                    quiz = generate_quiz(text, api_key)
            except RuntimeError as e:
                msg = str(e)
                if msg == "RATE_LIMIT":
                    st.error("The AI is rate-limited right now (free-tier quota). Please wait and try again.")
                else:
                    st.error("Failed to generate quiz. Please try again.")
                    with st.expander("🔧 Technical details (for debugging)"):
                        st.code(msg.replace("FAILED::", ""))
                return
            except ValueError:
                st.error("AI returned an unexpected format. Please try again.")
                return

            ss.quiz = quiz
            ss.answers = [None] * len(quiz)
            ss.idx = 0
            ss.notice = (
                "Your document was long, so the quiz covers the first portion."
                if truncated else None
            )
            ss.stage = "quiz"
            st.rerun()


def screen_quiz():
    quiz = ss.quiz
    i = ss.idx
    q = quiz[i]
    total = len(quiz)

    if ss.notice:
        st.warning(ss.notice)

    st.progress((i + 1) / total, text=f"Question {i + 1} of {total}")
    st.subheader(q["question"])

    selected = ss.answers[i]
    answered = selected is not None

    if not answered:
        for letter in OPTION_KEYS:
            if st.button(f"**{letter}.**  {q['options'][letter]}", key=f"opt_{i}_{letter}",
                         use_container_width=True):
                ss.answers[i] = letter
                st.rerun()
    else:
        for letter in OPTION_KEYS:
            text = f"**{letter}.**  {q['options'][letter]}"
            if letter == q["answer"]:
                st.success(f"✅ {text}")
            elif letter == selected:
                st.error(f"❌ {text}")
            else:
                st.markdown(f"&nbsp;&nbsp;&nbsp;&nbsp;{text}", unsafe_allow_html=True)

        if selected == q["answer"]:
            st.markdown(f"**Correct!** {q['explanation']}")
        else:
            st.markdown(f"**Incorrect — the answer is {q['answer']}.** {q['explanation']}")

        label = "See Results" if i == total - 1 else "Next Question →"
        if st.button(label, type="primary", use_container_width=True):
            if i == total - 1:
                ss.stage = "score"
            else:
                ss.idx += 1
            st.rerun()


def screen_score():
    quiz = ss.quiz
    correct = sum(1 for j, q in enumerate(quiz) if ss.answers[j] == q["answer"])
    total = len(quiz)
    pct = round(100 * correct / total)
    emoji = "🎉" if pct >= 80 else "👍" if pct >= 60 else "📚" if pct >= 40 else "💪"

    st.markdown(f"<h1 style='text-align:center'>{emoji}</h1>", unsafe_allow_html=True)
    st.markdown(f"<h2 style='text-align:center'>{correct} / {total} — {pct}%</h2>",
                unsafe_allow_html=True)

    c1, c2 = st.columns(2)
    with c1:
        if st.button("🔄 Retake Quiz", use_container_width=True):
            ss.answers = [None] * total
            ss.idx = 0
            ss.stage = "quiz"
            st.rerun()
    with c2:
        if st.button("📄 Upload New Document", use_container_width=True):
            reset_to_upload()
            st.rerun()

    st.divider()
    st.subheader("Review")
    for j, q in enumerate(quiz):
        ok = ss.answers[j] == q["answer"]
        with st.expander(f"{'✅' if ok else '❌'}  Q{j + 1}. {q['question']}"):
            st.write(f"**Correct answer:** {q['answer']}. {q['options'][q['answer']]}")
            if not ok:
                ua = ss.answers[j]
                st.write(f"**Your answer:** {ua}. {q['options'][ua]}" if ua else "**Your answer:** none")
            st.caption(q["explanation"])


if ss.stage == "upload":
    screen_upload()
elif ss.stage == "quiz":
    screen_quiz()
else:
    screen_score()
