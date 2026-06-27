"""Converts REPORT.md into a self-contained REPORT.html with embedded figures.

Open REPORT.html in a browser and use Print -> Save as PDF to produce the final
report document for submission. Run:  python analysis/build_report_html.py
"""
import base64
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
md_path = ROOT / "REPORT.md"
out_path = ROOT / "REPORT.html"

text = md_path.read_text(encoding="utf-8")

# Embed images as base64 data URIs so the HTML is fully self-contained.
def embed_image(match):
    alt, src = match.group(1), match.group(2)
    img_path = (ROOT / src).resolve()
    if img_path.exists():
        b64 = base64.b64encode(img_path.read_bytes()).decode("ascii")
        return f"![{alt}](data:image/png;base64,{b64})"
    return match.group(0)

text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", embed_image, text)

html_body = markdown.markdown(
    text, extensions=["tables", "fenced_code", "toc", "sane_lists"]
)

CSS = """
body { font-family: Georgia, 'Times New Roman', serif; max-width: 820px;
  margin: 40px auto; padding: 0 24px; line-height: 1.55; color: #1a1a1a; }
h1 { font-size: 1.7em; border-bottom: 3px solid #4338ca; padding-bottom: .3em; }
h1[id^="chapter"], h1 { page-break-before: auto; }
h1 { margin-top: 1.6em; }
h2 { font-size: 1.3em; color: #3730a3; margin-top: 1.4em; }
h3 { font-size: 1.1em; color: #4b5563; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .95em; }
th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
th { background: #eef2ff; }
img { max-width: 100%; height: auto; display: block; margin: 1em auto;
  border: 1px solid #e5e7eb; border-radius: 6px; }
code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px;
  font-family: Consolas, monospace; font-size: .9em; }
pre { background: #1e293b; color: #e2e8f0; padding: 14px; border-radius: 8px;
  overflow-x: auto; font-size: .85em; }
pre code { background: none; color: inherit; }
em { color: #4b5563; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
@media print { body { margin: 0; max-width: none; } h1 { page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; } }
"""

html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>QuizAI — AI Project Report</title>
<style>{CSS}</style></head><body>
{html_body}
</body></html>"""

out_path.write_text(html, encoding="utf-8")
print("Wrote", out_path, f"({len(html)//1024} KB)")
