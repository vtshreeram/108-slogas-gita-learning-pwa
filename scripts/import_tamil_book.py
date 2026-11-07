"""Import the Tamil verse translations (மொழிபெயர்ப்பு) from the OCR'd Tamil book in
docs/Tamil_Bhagavad_Gita/chapters/chapter_NN.html into the app dataset.

Usage:
  python3 scripts/import_tamil_book.py            # extract + report only (writes scripts/data/tamil-book.json + docs report)
  python3 scripts/import_tamil_book.py --apply    # also write `tamil` into src/data/gita/*.json and src/lib/shlokas.ts

Verses whose book text is missing or fails the OCR quality gate keep their previous
Tamil text (Subramania Bharati, edited) and are listed in docs/tamil-book-import-report.md.
Nothing falls back silently. See docs/translation-sources.md.
"""

import html
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "docs" / "Tamil_Bhagavad_Gita" / "chapters"
GITA = ROOT / "src" / "data" / "gita"
SHLOKAS_TS = ROOT / "src" / "lib" / "shlokas.ts"
EXTRACT = ROOT / "scripts" / "data" / "tamil-book.json"
REPORT = ROOT / "docs" / "tamil-book-import-report.md"

TITLE_RE = re.compile(r'<div class="verse-title">(.*?)</div>', re.S)
BOX_RE = re.compile(r'<div class="translation-box">(.*?)</div>', re.S)
LATIN_OR_DIGIT = re.compile(r"[A-Za-z0-9]")
# A Tamil vowel sign / pulli stranded after a space, or a lone consonant before a space+consonant:
BROKEN = re.compile(r"\s[ா-்]|(?<![஀-௿])[க-ஹ] [க-ஹ]்")
FOOTER = re.compile(r"\s*\d+\.\s[^.]*?\d+\s*verses\s*Page\s*\d+|\s*(?:\d+\s*verses\s*)?Page\s*\d+|\s*பகவத் கீதை உண்மையுருவில்.*$|\s*பக்கம் \d+\s*$")
JUNK_CHARS = re.compile(r"[|_\\/{}\[\]<>~^*=#@$%&]")


def clean(raw):
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = unicodedata.normalize("NFC", text).replace("​", "")
    return FOOTER.sub("", re.sub(r"\s+", " ", text)).strip()


def split_ref(ref):
    m = re.fullmatch(r"(\d+)\.(\d+)(?:-(\d+))?", ref)
    return int(m[1]), int(m[2]), int(m[3] or m[2])


TOKEN_RE = re.compile(
    r'<div class="(verse-title|section-label|translation-box|sanskrit-box)">(.*?)</div>|<p>(.*?)</p>', re.S)
TRANSLATION_LABEL = "மொழிபெயர்ப்பு"


def owner_continues(parts, target, cur, owner):
    return False  # a second box for the same verse is never legitimate: flag it


def book_blocks(chapter):
    """Ordered [(title_text, translation_text)] for one chapter, one entry per verse-title block.

    The OCR'd HTML is messy: a translation can continue in plain <p> lines after a page break,
    and a block's translation-box sometimes lands under the NEXT verse-title. So walk the
    elements in order, remember which block opened a மொழிபெயர்ப்பு section, and give that block
    the first box and any <p> continuation up to the next section label.
    """
    src = (BOOK / f"chapter_{chapter:02d}.html").read_text(encoding="utf-8")
    titles, parts, notes, displaced, merged = [], [], [], [], set()
    pending = []  # blocks whose மொழிபெயர்ப்பு label has not received a box yet
    owner, labeled = None, set()  # owner: block receiving <p> continuation lines
    for m in TOKEN_RE.finditer(src):
        kind, body = m[1], clean(m[2] if m[1] else m[3])
        cur = len(titles) - 1
        if kind == "verse-title":
            titles.append(body)
            parts.append([])
            owner = None
        elif kind == "section-label":
            owner = None
            if body == TRANSLATION_LABEL and cur >= 0:
                labeled.add(cur)
                if cur not in pending:
                    pending.append(cur)
        elif kind == "translation-box" and cur >= 0:
            if cur in labeled:
                # Normal case: the box follows its own block's label; older pending labels are lost.
                lost = [titles[i] for i in pending if i != cur]
                if lost:
                    notes.append(f"no text for block(s) {lost} before {titles[cur][:30]}")
                pending.clear()
                target = cur
            elif pending:
                target = pending.pop(0)  # displaced: the box sits before its own block's label
                displaced.append(target)
                notes.append(f"box under '{titles[cur][:30]}' belongs to '{titles[target][:30]}'")
            else:
                target = cur
            if body:
                if parts[target] and not owner_continues(parts, target, cur, owner):
                    notes.append(f"MERGED: block '{titles[target][:30]}' received a second text box")
                    merged.add(target)
                parts[target].append(body)
            # A footer-only box continues in <p> lines on the next page; a displaced box does not.
            owner = target if target == cur else None
        elif kind != "translation-box" and owner is not None and body:
            if re.search(r"[|\u0900-\u097F]", body):
                owner = None  # next verse's Sanskrit / transliteration started
            else:
                parts[owner].append(body)  # continuation after a page break
    book_blocks.notes, book_blocks.displaced, book_blocks.merged = notes, displaced, merged
    return [(t, " ".join(p)) for t, p in zip(titles, parts)]


def title_numbers(title):
    head = re.split(r"[-–—]\s*(?=\D)", title, 1)[0]  # number prefix before the Sanskrit start
    return re.findall(r"\d+", head)


def align(chapter, refs, blocks):
    """Map each app reference to its block index (and borrowed translation), checking verse numbers."""
    out, i = {}, 0
    skipped = []
    for bi, (title, _text) in enumerate(blocks):
        if i >= len(refs):
            skipped.append(title[:40])
            continue
        _, start, end = split_ref(refs[i])
        # OCR drops separators/chapter numbers ("414", "67", "16-18"), so accept those spellings too.
        wanted = {str(start), f"{chapter}{start}", f"{start}{end}", f"{chapter}{start}{end}"}
        wanted |= {str(n) for n in range(start, end + 1)} | {f"{chapter}{n}" for n in range(start, end + 1)}
        if wanted & set(title_numbers(title)):
            out[refs[i]] = bi
            i += 1
        else:
            skipped.append(title[:40])
    if i != len(refs):
        raise SystemExit(f"Chapter {chapter}: aligned {i}/{len(refs)} entries; unaligned from {refs[i]}")
    return out, skipped


def translations_for(chapter, refs, blocks):
    mapping, skipped = align(chapter, refs, blocks)
    found = {ref: blocks[bi][1] for ref, bi in mapping.items() if blocks[bi][1]}
    block_ref = {bi: ref for ref, bi in mapping.items()}
    displaced = {block_ref[bi] for bi in book_blocks.displaced if bi in block_ref}
    displaced |= {block_ref[bi] for bi in book_blocks.merged if bi in block_ref}  # never trusted
    return found, skipped, displaced


# Displaced boxes (a translation that the book prints under a later verse's heading) are only
# trusted for verses whose Tamil was read against the English by hand. Any other displaced
# assignment is treated as unverified and keeps the previous Tamil.
DISPLACED_VERIFIED = {
    "1.6", "1.27", "2.65", "11.9", "11.17", "11.24", "11.25", "11.30", "16.13-15", "17.8", "18.41",
}
MARKER = re.compile(r"\|\|\s*(\d+)\s*[-.]\s*(\d+)")


def belongs_to_previous(raw, ref):
    """True if tail debris names this verse itself, so the kept prefix is the PREVIOUS verse's text."""
    chapter, start, end = split_ref(ref)
    return any(int(c) == chapter and start <= int(v) <= end for c, v in MARKER.findall(raw))


def quality(text, old):
    """Return a list of reasons the OCR text is not trustworthy (empty list = passes)."""
    why = []
    if LATIN_OR_DIGIT.search(text):
        why.append("latin/digit characters")
    if JUNK_CHARS.search(text):
        why.append("junk symbols")
    if BROKEN.search(text):
        why.append("broken Tamil spacing")
    if text.count("!") > 1 + len(text) // 140:
        why.append("'!' used as punctuation")
    letters = sum(1 for c in text if "஀" <= c <= "௿")
    if letters < 0.85 * len(text.replace(" ", "")):
        why.append("non-Tamil content")
    if len(text) < 20:
        why.append("too short")
    if old and not (0.45 <= len(text) / len(old) <= 4.5):
        why.append(f"length ratio {len(text) / len(old):.1f} vs Bharati")
    if not re.search(r"[.?!:;’”]$", text):
        why.append("no sentence end")
    return why


GARBAGE_TAIL = re.compile(r"\s+rw(?:\s.*)?$|\s*\|.*$")


def salvage(text):
    """Cut trailing OCR debris (e.g. the next verse's Sanskrit pasted after the translation)."""
    cut = GARBAGE_TAIL.sub("", text).strip()
    return cut if cut and cut != text and re.search(r"[.?!:;\u2019\u201d]$", cut) else text


def tidy(text):
    """Conservative OCR punctuation fixes only (no word substitutions)."""
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    text = re.sub(r"!(?=\s+[஀-௿])", ",", text) if text.count("!") > 1 else text
    return text


def main():
    apply = "--apply" in sys.argv
    result, report, totals = {}, [], dict(ok=0, flagged=0, missing=0)
    for chapter in range(1, 19):
        entries = json.loads((GITA / f"chapter-{chapter}.json").read_text())
        refs = [e["reference"] for e in entries]
        blocks = book_blocks(chapter)
        found, skipped, displaced = translations_for(chapter, refs, blocks)
        notes = list(book_blocks.notes)
        if skipped:
            report.append(f"- Chapter {chapter}: ignored {len(skipped)} unmatched block(s): {skipped}")
        for n in notes:
            report.append(f"- Chapter {chapter}: {n}")
        for e in entries:
            ref, old = e["reference"], e.get("tamil", "")
            text = tidy(salvage(found[ref])) if ref in found else ""
            if not text:
                totals["missing"] += 1
                result[ref] = dict(status="missing", text=old, why=["no translation in book"])
                continue
            why = quality(text, old)
            if ref in found and salvage(found[ref]) != found[ref] and belongs_to_previous(found[ref], ref):
                why.append("book text belongs to the previous verse")
            if ref in displaced and ref not in DISPLACED_VERIFIED:
                why.append("unverified displaced translation box")
            if why:
                totals["flagged"] += 1
                result[ref] = dict(status="flagged", text=old, bookText=text, why=why)
            else:
                totals["ok"] += 1
                result[ref] = dict(status="ok", text=text)
    EXTRACT.parent.mkdir(exist_ok=True)
    EXTRACT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")

    lines = ["# Tamil book import report", "",
             "Generated by `python3 scripts/import_tamil_book.py`. Verses below kept their previous Tamil (Bharati, edited) because the book text was missing or failed the OCR quality gate.", "",
             f"- Taken from the book: **{totals['ok']}**", f"- Kept previous Tamil, book text flagged: **{totals['flagged']}**",
             f"- Kept previous Tamil, no translation in book: **{totals['missing']}**", "", "## Alignment notes", ""] + (report or ["- none"])
    lines += ["", "## Flagged / missing verses", ""]
    for ref, r in result.items():
        if r["status"] != "ok":
            lines.append(f"- **{ref}** ({r['status']}): {', '.join(r['why'])}")
    REPORT.write_text("\n".join(lines) + "\n")
    print(totals, "->", EXTRACT.relative_to(ROOT), REPORT.relative_to(ROOT))

    if apply:
        for chapter in range(1, 19):
            path = GITA / f"chapter-{chapter}.json"
            entries = json.loads(path.read_text())
            for e in entries:
                e["tamil"] = result[e["reference"]]["text"]
                e["tamilSource"] = "book" if result[e["reference"]]["status"] == "ok" else "bharati"
            path.write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n")
        before, data = SHLOKAS_TS.read_text().split("export const SHLOKAS: Shloka[] = ", 1)
        array, after = data.split("\n];", 1)
        shlokas = json.loads(array + "\n]")
        for s in shlokas:
            s["tamil"] = result[s["reference"]]["text"]
            s["tamilSource"] = "book" if result[s["reference"]]["status"] == "ok" else "bharati"
        SHLOKAS_TS.write_text(before + "export const SHLOKAS: Shloka[] = " + json.dumps(shlokas, ensure_ascii=False, indent=2) + ";" + after)
        print("Applied Tamil text to chapter JSON and shlokas.ts")


if __name__ == "__main__":
    main()
