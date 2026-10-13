#!/usr/bin/env python3
"""Render football_api_reports.md to print-ready HTML."""

import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "football_api_reports.md"
OUT = ROOT / "football_api_reports.html"

CSS = """
:root {
  --ink: #1b2430;
  --muted: #5b6570;
  --line: #d8dee6;
  --paper: #ffffff;
  --band: #f4f7fa;
  --accent: #0f4c5c;
  --accent-soft: #e8f2f4;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: var(--paper);
  color: var(--ink);
  font: 11pt/1.55 "Iowan Old Style", Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif;
}
.page { max-width: 920px; margin: 0 auto; padding: 0; }
h1 {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 26pt;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--accent);
  margin: 0 0 6pt;
  line-height: 1.15;
}
h2 {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 14.5pt;
  font-weight: 700;
  color: var(--accent);
  margin: 28pt 0 10pt;
  padding-bottom: 5pt;
  border-bottom: 1.5pt solid var(--accent);
  page-break-after: avoid;
}
h3 {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 12pt;
  font-weight: 650;
  color: #16333c;
  margin: 18pt 0 8pt;
  page-break-after: avoid;
}
p { margin: 0 0 10pt; }
strong { font-weight: 700; }
a { color: var(--accent); text-decoration: none; }
hr { border: 0; border-top: 1px solid var(--line); margin: 18pt 0; }
.meta {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  color: var(--muted);
  line-height: 1.55;
  margin: 0 0 16pt;
  padding: 12pt 14pt;
  background: var(--accent-soft);
  border-left: 4px solid var(--accent);
}
.meta p { margin: 0 0 3pt; white-space: pre-line; }
.meta p:last-child { margin: 0; }
.meta strong { color: var(--ink); font-weight: 650; }
code, pre {
  font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
code {
  font-size: 8.6pt;
  background: #eef2f5;
  padding: 1px 4px;
  border-radius: 3px;
  word-break: break-word;
}
pre {
  background: #152028;
  color: #e8eef2;
  font-size: 8.5pt;
  line-height: 1.45;
  padding: 12pt 14pt;
  border-radius: 6px;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  page-break-inside: avoid;
}
pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
blockquote {
  margin: 10pt 0 14pt;
  padding: 8pt 12pt;
  border-left: 3px solid var(--accent);
  background: var(--band);
  color: #24303a;
}
ul, ol { margin: 0 0 12pt; padding-left: 22pt; }
li { margin: 0 0 4pt; }
li > p { margin: 0 0 4pt; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 16pt;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 8pt;
  line-height: 1.35;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th {
  text-align: left;
  background: var(--accent);
  color: #fff;
  font-weight: 650;
  padding: 5pt 5pt;
  border: 1px solid #0c3d4a;
  vertical-align: top;
  hyphens: none;
  -webkit-hyphens: none;
}
td {
  padding: 4.5pt 5pt;
  border: 1px solid var(--line);
  vertical-align: top;
  word-break: normal;
  overflow-wrap: anywhere;
  hyphens: none;
  -webkit-hyphens: none;
}
td code { font-size: 7.2pt; }
tbody tr:nth-child(even) td { background: var(--band); }
.cols-2 td:nth-child(1), .cols-2 th:nth-child(1) { width: 28%; }
.cols-3 td:nth-child(1), .cols-3 th:nth-child(1) { width: 32%; }
.cols-4 { font-size: 7.6pt; }
.cols-4 td:nth-child(1), .cols-4 th:nth-child(1) { width: 16%; }
.cols-4 td:nth-child(2), .cols-4 th:nth-child(2) { width: 18%; }
.cols-6 { font-size: 7.2pt; table-layout: fixed; }
.cols-7 { font-size: 6.9pt; table-layout: fixed; }
.cols-7 td:nth-child(1), .cols-7 th:nth-child(1) { width: 18%; }
.cols-7 td:nth-child(2), .cols-7 th:nth-child(2) { width: 11%; }
.cols-7 td:nth-child(3), .cols-7 th:nth-child(3) { width: 10%; }
.cols-7 td:nth-child(4), .cols-7 th:nth-child(4) { width: 12%; }
.cols-7 td:nth-child(5), .cols-7 th:nth-child(5) { width: 13%; }
.cols-7 td:nth-child(6), .cols-7 th:nth-child(6) { width: 18%; }
.cols-7 td:nth-child(7), .cols-7 th:nth-child(7) { width: 18%; }
.toc {
  background: var(--band);
  border: 1px solid var(--line);
  padding: 12pt 18pt 8pt;
  margin: 0 0 22pt;
  page-break-inside: avoid;
}
.toc:before {
  content: "Contents";
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 11pt;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 8pt;
}
.toc ul { margin: 0; padding-left: 18pt; }
.toc li { margin: 0 0 3pt; font-size: 10pt; }
.toc a { color: var(--ink); }
.cover-kicker {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 8.5pt;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
  margin: 0 0 8pt;
}
.footer-note {
  margin-top: 28pt;
  padding-top: 10pt;
  border-top: 1px solid var(--line);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 8.5pt;
  color: var(--muted);
}
@page {
  size: A4;
  margin: 14mm 10mm 16mm 10mm;
}
@media print {
  body { font-size: 10.5pt; }
  a { color: inherit; }
  .page { max-width: none; }
}
"""

md_text = SRC.read_text(encoding="utf-8")
html_body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "sane_lists", "smarty", "toc"],
    extension_configs={"toc": {"permalink": False, "toc_depth": "2-3"}},
)


def classify_tables(html: str) -> str:
    def repl(match: re.Match) -> str:
        table = match.group(0)
        header = table.split("</thead>", 1)[0] if "</thead>" in table else table
        cols = len(re.findall(r"<th\b", header, flags=re.I))
        return table.replace("<table>", f'<table class="cols-{cols}">', 1)

    return re.sub(r"<table>.*?</table>", repl, html, flags=re.S)


html_body = classify_tables(html_body)

if "</h1>" in html_body:
    title, rest = html_body.split("</h1>", 1)
    title = title + "</h1>"
else:
    title, rest = "<h1>Football API Report</h1>", html_body

remaining = rest.lstrip()
meta_paras = []
while remaining.startswith("<p>"):
    match = re.match(r"<p>(.*?)</p>", remaining, flags=re.S)
    if not match:
        break
    inner = match.group(1).strip()
    lowered = inner.lower()
    if lowered.startswith("<strong>api:") or lowered.startswith("<strong>product:") or lowered.startswith(
        "<strong>scope:"
    ):
        meta_paras.append(f"<p>{inner}</p>")
        remaining = remaining[match.end() :].lstrip()
        continue
    break

h2s = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', remaining)
if h2s:
    items = []
    for hid, title_html in h2s:
        plain = re.sub(r"<[^>]+>", "", title_html)
        items.append(f'<li><a href="#{hid}">{plain}</a></li>')
    toc_html = '<nav class="toc"><ul>' + "".join(items) + "</ul></nav>"
else:
    h2_plain = re.findall(r"<h2>(.*?)</h2>", remaining)
    items = [f"<li>{re.sub(r'<[^>]+>', '', t)}</li>" for t in h2_plain]
    toc_html = '<nav class="toc"><ul>' + "".join(items) + "</ul></nav>" if items else ""

meta_html = f'<div class="meta">{"".join(meta_paras)}</div>' if meta_paras else ""

doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Football API Report — SportsAPI365</title>
  <style>{CSS}</style>
</head>
<body>
  <article class="page">
    <div class="cover-kicker">SportsAPI365 · Football REST catalogue</div>
    {title}
    {meta_html}
    {toc_html}
    {remaining}
    <p class="footer-note">Product assessment from live REST calls against the Football catalogue and a working Football Lab product.</p>
  </article>
</body>
</html>
"""

OUT.write_text(doc, encoding="utf-8")
print(f"Wrote {OUT}")
