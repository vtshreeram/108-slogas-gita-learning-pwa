#!/usr/bin/env python3
"""Fetch and convert verse audio files from a links manifest.

Input format (default: requested-youtube-links.txt):
  <chapter.verse> <youtube-url>

Outputs MP3 files to public/audio/<chapter.verse>.mp3 using yt-dlp.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REF_RE = re.compile(r"^\d+\.\d+$")


def parse_links(path: Path) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(maxsplit=1)
        if len(parts) != 2:
            continue
        ref, url = parts
        if not REF_RE.fullmatch(ref) or not url.startswith("http"):
            continue
        pairs.append((ref, url))
    return pairs


def get_ffmpeg_path() -> str | None:
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def run_cmd(cmd: list[str]) -> tuple[int, str]:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return proc.returncode, proc.stdout


def main() -> int:
    parser = argparse.ArgumentParser(description="Download and convert verse audio from YouTube links")
    parser.add_argument("--links", default="requested-youtube-links.txt", help="Path to links file")
    parser.add_argument("--out-dir", default="public/audio", help="Destination directory")
    parser.add_argument("--missing-only", action="store_true", help="Skip files that already exist")
    parser.add_argument("--verify", action="store_true", help="Only verify expected files exist")
    args = parser.parse_args()

    links_path = Path(args.links)
    out_dir = Path(args.out_dir)

    if not links_path.exists():
        print(f"error: links file not found: {links_path}")
        return 2

    pairs = parse_links(links_path)
    if not pairs:
        print(f"error: no valid entries found in {links_path}")
        return 2

    out_dir.mkdir(parents=True, exist_ok=True)

    missing = []
    for ref, _ in pairs:
        mp3 = out_dir / f"{ref}.mp3"
        if not mp3.exists() or mp3.stat().st_size == 0:
            missing.append(ref)

    if args.verify:
        if missing:
            print(f"missing files: {len(missing)}")
            print(",".join(missing))
            return 1
        print(f"ok: all {len(pairs)} files exist in {out_dir}")
        return 0

    ffmpeg_path = get_ffmpeg_path()
    if not ffmpeg_path:
        print("error: ffmpeg not found. Install imageio-ffmpeg: python3 -m pip install --user imageio-ffmpeg")
        return 2

    downloaded = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    for ref, url in pairs:
        dest = out_dir / f"{ref}.mp3"
        if args.missing_only and dest.exists() and dest.stat().st_size > 0:
            skipped += 1
            continue

        cmd = [
            sys.executable,
            "-m",
            "yt_dlp",
            "--ffmpeg-location",
            ffmpeg_path,
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "--no-playlist",
            "-o",
            str(out_dir / f"{ref}.%(ext)s"),
            url,
        ]
        code, output = run_cmd(cmd)
        if code == 0:
            downloaded += 1
        else:
            failed.append((ref, output[-500:]))

    print(f"entries={len(pairs)} downloaded={downloaded} skipped={skipped} failed={len(failed)}")
    if failed:
        for ref, tail in failed:
            print(f"--- fail {ref} ---")
            print(tail)
        return 1

    verify_missing = []
    for ref, _ in pairs:
        mp3 = out_dir / f"{ref}.mp3"
        if not mp3.exists() or mp3.stat().st_size == 0:
            verify_missing.append(ref)

    if verify_missing:
        print(f"post-verify missing: {','.join(verify_missing)}")
        return 1

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
