"""Build the full Bhagavad-gita dataset (all verses, Prabhupada's verse grouping).

Usage:
  python3 scripts/build_full_gita.py fetch   # polite crawl of Vedabase (honours robots.txt Crawl-delay: 10), resumable
  python3 scripts/build_full_gita.py build [--partial]   # merge cache + Tamil + the curated 108 -> src/data/gita/chapter-N.json

The curated 108 entries in src/lib/shlokas.ts are copied verbatim (ids, edited text, audio) and
flagged `important: true`. All other verses are scraped. See docs/translation-sources.md.
"""

import html
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_tamil_data import SOURCE as TAMIL_SOURCE, parse_verses as parse_tamil  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "vedabase"
OUT = ROOT / "src" / "data" / "gita"
BASE = "https://vedabase.io/en/library/bg"
CRAWL_DELAY = 10  # seconds, from https://vedabase.io/robots.txt
UA = "gita-learning-pwa personal study build (respecting Crawl-delay)"
PRABHUPADA = "A.C. Bhaktivedanta Swami Prabhupada"


def get(url):
    time.sleep(CRAWL_DELAY)
    with urlopen(Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        return r.read().decode("utf-8")


def text_of(fragment):
    fragment = re.sub(r"<br\s*/?>", "\n", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    lines = [re.sub(r"\s+", " ", l).strip() for l in html.unescape(fragment).split("\n")]
    return unicodedata.normalize("NFC", "\n".join(l for l in lines if l))


def section(page, name):
    m = re.search(rf'<div class="av-{name}">(.*?)(?=<div class="av-[a-z_]+">|<div class="mt-10 flex justify-between"|$)', page, re.S)
    if not m:
        return ""
    body = re.sub(r"<h2[^>]*>.*?</h2>", "", m[1], flags=re.S)
    return text_of(body)


def chapter_refs(chapter):
    page = get(f"{BASE}/{chapter}/")
    refs = re.findall(rf'href="/en/library/bg/{chapter}/(\d+(?:-\d+)?)/"', page)
    return list(dict.fromkeys(refs))


def cmd_fetch():
    CACHE.mkdir(parents=True, exist_ok=True)
    index = CACHE / "index.json"
    if index.exists():
        refs = json.loads(index.read_text())
    else:
        refs = [f"{c}.{r}" for c in range(1, 19) for r in chapter_refs(c)]
        index.write_text(json.dumps(refs))
    print(f"{len(refs)} verse entries in index", flush=True)
    for i, ref in enumerate(refs, 1):
        f = CACHE / f"{ref}.json"
        if f.exists():
            continue
        chapter, verse = ref.split(".")
        page = get(f"{BASE}/{chapter}/{verse}/")
        rec = {k: section(page, k) for k in ("devanagari", "verse_text", "translation")}
        if not all(rec.values()):
            print(f"WARN {ref}: missing {[k for k, v in rec.items() if not v]}", flush=True)
            continue
        f.write_text(json.dumps(rec, ensure_ascii=False))
        print(f"[{i}/{len(refs)}] {ref}", flush=True)


def split_ref(ref):
    m = re.fullmatch(r"(\d+)\.(\d+)(?:-(\d+))?", ref)
    return int(m[1]), int(m[2]), int(m[3] or m[2])


def cmd_build():
    refs = json.loads((CACHE / "index.json").read_text())
    missing = [r for r in refs if not (CACHE / f"{r}.json").exists()]
    existing_src = (ROOT / "src/lib/shlokas.ts").read_text()
    curated = json.loads(existing_src.split("export const SHLOKAS: Shloka[] = ", 1)[1].split("\n];", 1)[0] + "\n]")
    by_ref = {s["reference"]: s for s in curated}
    unknown = [r for r in by_ref if r not in refs]
    if unknown:
        raise SystemExit(f"Curated references absent from the Vedabase index: {unknown}")
    need = [r for r in missing if r not in by_ref]
    partial = "--partial" in sys.argv
    if need and partial:
        print(f"PARTIAL build: skipping {len(need)} verses not fetched yet", flush=True)
    elif need:
        raise SystemExit(f"{len(need)} verses not fetched yet (run `fetch`): {need[:5]}...")

    from urllib.request import urlopen as _u
    tamil = parse_tamil(_u(TAMIL_SOURCE, timeout=30).read().decode("utf-8"))

    OUT.mkdir(parents=True, exist_ok=True)
    chapters = {}
    for ref in refs:
        chapter, start, end = split_ref(ref)
        if partial and ref in need:
            continue
        if ref in by_ref:
            entry = {**by_ref[ref], "important": True}
        else:
            raw = json.loads((CACHE / f"{ref}.json").read_text())
            entry = {
                "id": f"BG-{chapter}.{start}" + (f"-{end}" if end != start else ""),
                "chapter": chapter, "verse": start, "reference": ref,
                "sanskrit": raw["devanagari"], "transliteration": raw["verse_text"],
                "tamil": "\n".join(tamil[f"{chapter}.{v}"] for v in range(start, end + 1) if f"{chapter}.{v}" in tamil),
                "english": raw["translation"], "translationAuthor": PRABHUPADA,
                "important": False,
            }
        chapters.setdefault(chapter, []).append(entry)
    for chapter, entries in chapters.items():
        (OUT / f"chapter-{chapter}.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n")
    total = sum(len(e) for e in chapters.values())
    print(f"Wrote {len(chapters)} chapter files, {total} entries, {sum(e['important'] for v in chapters.values() for e in v)} important")


if __name__ == "__main__":
    {"fetch": cmd_fetch, "build": cmd_build}[sys.argv[1] if len(sys.argv) > 1 else ""]()
