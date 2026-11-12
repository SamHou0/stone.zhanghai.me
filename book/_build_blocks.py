#!/usr/bin/env python3
"""Extract translatable paragraphs from each chapter without altering the source.

Paragraphs are delimited by <br> tags (not physical lines), because a few
chapters wrap one paragraph across several source lines.  The output records the
character offset just after the closing <br>, so translations can be inserted
without touching a single byte of the novel text.

Output:
  _blocks/NN.txt   numbered paragraphs for translators
  _blocks/NN.json  [{id, source, verse, end_offset}]
"""
import html
import json
import os
import re

BOOK = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BOOK, "_blocks")
ORIG = "/tmp/opencode/hlm-original"

RED_SPAN = re.compile(r'<span class="red">.*?</span>', re.S)
TAG = re.compile(r"<[^>]+>")
BR = re.compile(r"<br\s*/?>", re.I)
ANNOTATION = re.compile(r"【.*?】", re.S)
PAREN_NOTE = re.compile(r"（(?:校者注|按|编者注|整理者注)[^）]*）", re.S)
COMMENTARY_START = re.compile(
    r"^(?:甲戌|庚辰|蒙|戚|靖|己卯|列藏|王府|舒序|程甲|程乙|梦稿|脂砚|畸笏|阁隐|校者|"
    r"甲夹批|蒙侧批|蒙双行夹批|甲戌侧批|甲戌眉批|庚辰侧批|庚辰眉批|庚辰双行夹批)"
)
COMMENTARY_WORD = re.compile(r"(?:回前批|回末总批|回末总评|总评|总批|侧批|眉批|夹批|批语|批注)")


def visible_text(raw):
    """Text outside all commentary and markup, entities decoded."""
    raw = ANNOTATION.sub("", raw)
    raw = re.sub(r"【[^】]*$", "", raw)
    raw = re.sub(r"^\s*】", "", raw)
    raw = PAREN_NOTE.sub("", raw)
    raw = RED_SPAN.sub("", raw)
    raw = BR.sub("", raw)
    raw = TAG.sub("", raw)
    raw = html.unescape(raw)
    raw = raw.replace("\u3000", " ").replace("\xa0", " ")
    raw = raw.replace("】", "").replace("【", "")
    raw = re.sub(r"\s+", " ", raw).strip()
    raw = re.sub(r"^[\s:：;；,，。.、]+", "", raw)
    return raw


def should_skip(text, raw):
    if not text:
        return True
    if text.startswith("[") and text.endswith("]"):
        return True
    if re.match(r"^第[一二三四五六七八九十百零〇\d]+回", text) and len(text) < 40:
        return True
    if text.startswith("诗云") and len(text) < 8:
        return True
    if "———" in text:
        return True
    if len(text) <= 2:
        return True
    if text in {"正是：", "诗云：", "有诗为证：", "打一物。", "其二", "其三", "其四", "其五"}:
        return True
    if (
        len(text) <= 12
        and not re.search(r"[，。！？；：“”‘’]", text)
        and not text.endswith("——")
    ):
        return True
    if "图式" in text or "音注云" in text or text.startswith("璎珞"):
        return True
    if (COMMENTARY_START.match(text) or COMMENTARY_WORD.search(text[:30])) and (
        "：" in text[:30] or ":" in text[:30]
    ):
        return True
    if "<img" in raw.lower():
        return True
    return False


def extend_br(src, offset):
    """Place the insertion after a run of consecutive <br> tags."""
    while True:
        m = re.match(r"[ \t\r\n]*<br\s*/?>", src[offset:], re.I)
        if not m:
            return offset
        offset += m.end()


def safe_offset(src, offset):
    """Move an insertion point out of an unclosed red-commentary span."""
    depth = 0
    last_open = None
    for m in re.finditer(r"<[^>]+>", src[:offset]):
        tag = m.group(0)
        if re.match(r"<span\b[^>]*class\s*=\s*[\"']?[^\"'>]*red", tag, re.I):
            depth += 1
            last_open = m.start()
        elif re.match(r"</span\s*>", tag, re.I) and depth:
            depth -= 1
    return last_open if depth and last_open is not None else offset


def extract(path):
    with open(path, encoding="utf-8", newline="") as f:
        return extract_from_src(f.read())


def extract_from_src(src):
    start = src.find('<hr><p align="left">')
    end = src.find("<center>——————————红楼梦")
    if start < 0:
        start = src.find("<body")
    if end < 0:
        end = len(src)
    body = src[start:end]

    blocks = []
    pending = []

    def flush():
        nonlocal pending
        if pending:
            blocks.append(
                {
                    "source": " ".join(t for t, _, _, _ in pending),
                    "verse": True,
                    "end_offset": safe_offset(src, extend_br(src, pending[-1][3])),
                }
            )
            pending = []

    prev = 0
    for m in BR.finditer(body):
        raw = body[prev : m.start()]
        end_offset = start + m.end()
        prev = m.end()
        text = visible_text(raw)
        if should_skip(text, raw):
            flush()
            continue
        stripped = text.replace(" ", "")
        # Consecutive short lines are poems, song lyrics or couplets.  Group at
        # most four lines so a translation box covers one stanza rather than a
        # single verse line.  Colons/quotation marks indicate dialogue rather
        # than verse, so those lines stay on their own.
        short_verse = (
            len(stripped) <= 40
            and not re.search(r"[：：“”‘’]", text)
            and not text.endswith("——")
        )
        if short_verse:
            pending.append((stripped, raw, start + m.start(), end_offset))
            if len(pending) >= 4:
                flush()
            continue
        flush()
        blocks.append(
            {
                "source": text,
                "verse": False,
                "start_offset": start + m.start(),
                "end_offset": safe_offset(src, extend_br(src, end_offset)),
            }
        )
    flush()

    for i, b in enumerate(blocks, 1):
        b["id"] = f"{i:03d}"
    return blocks


def main():
    os.makedirs(OUT, exist_ok=True)
    summary = []
    for n in range(1, 81):
        name = f"{n:02d}.htm"
        source_path = os.path.join(ORIG, name)
        if not os.path.exists(source_path):
            source_path = os.path.join(BOOK, name)
        blocks = extract(source_path)
        with open(os.path.join(OUT, f"{n:02d}.txt"), "w", encoding="utf-8") as f:
            for b in blocks:
                f.write(f"### {b['id']}{' [诗]' if b['verse'] else ''}\n{b['source']}\n\n")
        with open(os.path.join(OUT, f"{n:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(blocks, f, ensure_ascii=False, indent=1)
        summary.append((n, len(blocks), sum(len(b["source"]) for b in blocks)))
    with open(os.path.join(OUT, "_summary.txt"), "w", encoding="utf-8") as f:
        for n, c, t in summary:
            f.write(f"{n:02d}\t{c}\t{t}\n")
        f.write(f"TOTAL\t{sum(c for _, c, _ in summary)}\t{sum(t for _, _, t in summary)}\n")
    print("TOTAL", sum(c for _, c, _ in summary), sum(t for _, _, t in summary))


if __name__ == "__main__":
    main()
