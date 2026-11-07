"""Import Prabhupada's English purports for every verse from the ISKCON Press books archive.

One shallow clone is the whole source (no per-verse crawling):

  git clone --depth 1 --filter=blob:none --sparse https://github.com/iskconpress/books /tmp/iskcon-books
  git -C /tmp/iskcon-books sparse-checkout set bg
  python3 scripts/import_english_purports.py /tmp/iskcon-books

Each verse file is bg/<chapter>/<verse or range>.txt. The importer checks that the file's
translation matches the app's English translation before accepting its purport, writes the
`en` paragraphs into src/data/purports/chapter-N.json (keeping any existing `ta`), and lists
verses with no purport or a translation mismatch in docs/purport-import-report.md.
See docs/translation-sources.md for credit and copyright notes.
"""

import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GITA = ROOT / "src" / "data" / "gita"
OUT = ROOT / "src" / "data" / "purports"
REPORT = ROOT / "docs" / "purport-import-report.md"


def plain(text):
    """DokuWiki-ish markup -> plain text."""
    text = re.sub(r"\{\{.*?\}\}", "", text, flags=re.S)
    text = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]*)\]\]", lambda m: m[1].split(":")[-1], text)
    text = re.sub(r"</?[a-zA-Z][^>]*>", "", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.S)
    text = re.sub(r"//(.+?)//", r"\1", text, flags=re.S)
    text = text.replace("\\\\", " ")
    return re.sub(r"[ \t]+", " ", text).strip()


def norm(text):
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", text.lower().replace("’", "'"))).strip()


def devanagari(text):
    """Only the Devanagari letters, so punctuation, verse numbers and spacing don't matter."""
    return "".join(c for c in text if "\u0900" <= c <= "\u097F" and not ("\u0966" <= c <= "\u096F") and c not in "।॥")


def section(source, name):
    m = re.search(rf"^=====\s*{name}\s*=====\s*$", source, re.M)
    if not m:
        return None
    rest = source[m.end():]
    end = re.search(r"^=====\s*[^=]+?\s*=====\s*$|^======\s*[^=]+?\s*======\s*$", rest, re.M)
    return rest[: end.start()] if end else rest


def paragraphs(block):
    out = []
    for chunk in re.split(r"\n\s*\n", block.strip()):
        lines = [re.sub(r"^\s*(?:>\s?|[-*]\s+)", "", l) for l in chunk.splitlines()]
        text = plain(" ".join(l.strip() for l in lines if l.strip()))
        if text:
            out.append(text)
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1]) / "bg"
    OUT.mkdir(exist_ok=True)
    report, stats = [], dict(ok=0, none=0, mismatch=0, missing_file=0)
    for chapter in range(1, 19):
        entries = json.loads((GITA / f"chapter-{chapter}.json").read_text())
        path = OUT / f"chapter-{chapter}.json"
        data = json.loads(path.read_text()) if path.exists() else {}
        for e in entries:
            ref = e["reference"]
            f = src / str(chapter) / f"{ref.split('.', 1)[1]}.txt"
            shared = None
            if not f.exists():
                # The archive groups some verses the app splits (e.g. 17.8-10): use the file whose range covers this verse.
                verse = int(ref.split(".", 1)[1].split("-")[0])
                for cand in (src / str(chapter)).glob("*-*.txt"):
                    a, b = (int(x) for x in cand.stem.split("-"))
                    if a <= verse <= b:
                        f, shared = cand, cand.stem
                        break
            if not f.exists():
                stats["missing_file"] += 1
                report.append(f"- **{ref}**: no source file")
                continue
            text = f.read_text(encoding="utf-8")
            tr = section(text, "Translation")
            pur = section(text, "Purport")
            if tr is None:
                stats["missing_file"] += 1
                report.append(f"- **{ref}**: no translation section in source")
                continue
            # Same verse? The Sanskrit is identical across editions; the English wording is not
            # (1972 original vs the app's Vedabase wording), so it is only a fallback check.
            sa = difflib.SequenceMatcher(None, devanagari(re.split(r"^=====\s*Text\s*=====", text, 1, flags=re.M)[0]), devanagari(e["sanskrit"])).ratio()
            ratio = difflib.SequenceMatcher(None, norm(plain(tr)), norm(e["english"])).ratio()
            if shared:
                report.append(f"- **{ref}**: purport shared from the archive's grouped file {chapter}.{shared}")
            elif sa < 0.85 and ratio < 0.6:
                stats["mismatch"] += 1
                report.append(f"- **{ref}**: source does not match this verse (Sanskrit similarity {sa:.2f}, translation {ratio:.2f}); purport not imported")
                continue
            paras = paragraphs(pur) if pur else []
            if not paras:
                stats["none"] += 1
                data.get(ref, {}).pop("en", None)
                continue
            data.setdefault(ref, {})["en"] = paras
            stats["ok"] += 1
        data = {k: v for k, v in data.items() if v}
        if data:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    lines = ["# English purport import report", "",
             "Generated by `python3 scripts/import_english_purports.py`.", "",
             f"- Purports imported: **{stats['ok']}**",
             f"- Verses with no purport in the book (translation only): **{stats['none']}**",
             f"- Translation mismatch (skipped): **{stats['mismatch']}**",
             f"- No source file: **{stats['missing_file']}**", "", "## Problems", ""] + (report or ["- none"])
    REPORT.write_text("\n".join(lines) + "\n")
    print(stats)


if __name__ == "__main__":
    main()
