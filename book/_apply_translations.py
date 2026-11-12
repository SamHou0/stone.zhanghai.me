#!/usr/bin/env python3
"""Insert the translations into the chapter HTML without touching the novel text.

The script always starts from a pristine copy in /tmp/opencode/hlm-original (or
the current file when that copy is unavailable), so it is safe to run again after
editing a translation JSON file.
"""
import html
import json
import os
import re
import sys

BOOK = os.path.dirname(os.path.abspath(__file__))
ORIG = "/tmp/opencode/hlm-original"
TRANS = os.path.join(BOOK, "translations")

sys.path.insert(0, BOOK)
from _build_blocks import extract_from_src  # noqa: E402

HEAD_LINK = '<link rel="stylesheet" href="translation.css">'
TOOLS = (
    '<div class="reader-tools" id="readerTools">'
    '<a class="tool-link" href="characters.html">人物关系图</a>'
    '<button type="button" class="tool-button" id="toggleTranslations" '
    'aria-pressed="false">隐藏白话文翻译</button>'
    '<span class="tool-hint">点击人名可查看人物关系</span>'
    "</div>"
)
FOOT = (
    '<script src="characters-data.js"></script>{{NL}}'
    '<script src="site.js"></script>'
)


def esc(text):
    return html.escape(text, quote=False).replace("\n", "<br>")


def build(n):
    name = f"{n:02d}.htm"
    orig_path = os.path.join(ORIG, name)
    path = os.path.join(BOOK, name)
    source_path = orig_path if os.path.exists(orig_path) else path
    with open(source_path, encoding="utf-8", newline="") as f:
        src = f.read()

    trans_path = os.path.join(TRANS, f"{n:02d}.json")
    if not os.path.exists(trans_path):
        return 0, 0
    trans = json.load(open(trans_path, encoding="utf-8"))
    blocks = extract_from_src(src)

    nl = "\r\n" if "\r\n" in src else "\n"
    inserts = []
    missing = 0
    for b in blocks:
        text = str(trans.get(b["id"], "")).strip()
        if not text:
            missing += 1
            continue
        cls = "translation-block verse" if b["verse"] else "translation-block"
        block = (
            nl + f'<span class="{cls}" data-block="{b["id"]}">'
            '<span class="translation-label">白话文翻译</span>'
            f'<span class="translation-text">{esc(text)}</span></span>'
        )
        inserts.append((b["end_offset"], block))

    out = src
    for offset, block in sorted(inserts, reverse=True):
        out = out[:offset] + block + out[offset:]

    if HEAD_LINK not in out:
        out = out.replace(
            '<LINK href="honglm.css" rel=stylesheet>',
            '<LINK href="honglm.css" rel=stylesheet>' + HEAD_LINK,
            1,
        )
    if 'id="readerTools"' not in out:
        out = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + nl + TOOLS, out, count=1, flags=re.I)
    if "site.js" not in out:
        out = out.replace("</body>", FOOT.replace("{{NL}}", nl) + nl + "</body>", 1)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(out)
    return len(blocks) - missing, missing


def main():
    nums = [int(x) for x in sys.argv[1:]] or list(range(1, 81))
    total = 0
    for n in nums:
        done, missing = build(n)
        total += done
        print(f"{n:02d}: inserted {done}" + (f", missing {missing}" if missing else ""))
    print("total inserted:", total)


if __name__ == "__main__":
    main()
