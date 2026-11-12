#!/usr/bin/env python3
"""Validate translation JSON files against the extracted blocks."""
import json
import os
import sys

BOOK = os.path.dirname(os.path.abspath(__file__))
BLOCKS = os.path.join(BOOK, "_blocks")
TRANS = os.path.join(BOOK, "translations")


def main():
    only = sys.argv[1:] or [f"{i:02d}" for i in range(1, 81)]
    bad = 0
    for n in only:
        bp = os.path.join(BLOCKS, f"{n}.json")
        tp = os.path.join(TRANS, f"{n}.json")
        if not os.path.exists(tp):
            print(f"{n}: MISSING")
            bad += 1
            continue
        blocks = json.load(open(bp, encoding="utf-8"))
        try:
            trans = json.load(open(tp, encoding="utf-8"))
        except Exception as e:
            print(f"{n}: INVALID JSON {e}")
            bad += 1
            continue
        ids = [b["id"] for b in blocks]
        missing = [i for i in ids if not str(trans.get(i, "")).strip()]
        extra = [k for k in trans if k not in ids]
        short = []
        for b in blocks:
            t = str(trans.get(b["id"], ""))
            if t and len(t) < max(6, len(b["source"]) * 0.25):
                short.append((b["id"], len(b["source"]), len(t)))
        status = "OK" if not (missing or extra or short) else "CHECK"
        if status != "OK":
            bad += 1
        print(
            f"{n}: {status} blocks={len(ids)} translated={len(ids)-len(missing)} "
            f"missing={missing[:8]} extra={extra[:5]} suspicious_short={short[:5]}"
        )
    print("chapters_with_problems:", bad)


if __name__ == "__main__":
    main()
