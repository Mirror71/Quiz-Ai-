# Deploying QuizAI to Streamlit Community Cloud (free, public URL)

The Streamlit version is `streamlit_app.py` (Python). It has the same features as
the React app: upload PDF/PPTX → Gemini generates a 10-question quiz → take it
interactively → score screen.

## Run locally first (optional)

```bash
pip install -r requirements.txt
# add your key:
#   create .streamlit/secrets.toml  with:  GEMINI_API_KEY = "your-key"
streamlit run streamlit_app.py
```
Opens at http://localhost:8501

## Deploy to the cloud (5 steps)

1. Make sure the repo is pushed to GitHub (it is: `Mirror71/Quiz-Ai-`), including
   `streamlit_app.py` and `requirements.txt`.
2. Go to **https://share.streamlit.io** and sign in **with GitHub**.
3. Click **"Create app" → "Deploy a public app from GitHub"** and choose:
   - **Repository:** `Mirror71/Quiz-Ai-`
   - **Branch:** `main`
   - **Main file path:** `streamlit_app.py`
4. Click **"Advanced settings… → Secrets"** and paste:
   ```
   GEMINI_API_KEY = "your-real-gemini-key"
   ```
5. Click **Deploy**. After ~1–2 minutes you'll get a public URL like
   `https://quiz-ai.streamlit.app` — that's your live program link.

## Notes

- The API key is stored as a **Streamlit secret**, never in the code.
- Free-tier Gemini quotas still apply; if the model is busy, the app retries and
  falls back across models automatically.
- To update the live app, just `git push` — Streamlit redeploys automatically.
