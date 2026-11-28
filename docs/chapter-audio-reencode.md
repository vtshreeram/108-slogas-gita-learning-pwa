# Re-encode the chapter recordings to 32 kbps

The verse recordings in `public/audio/` are 32 kbps mono MP3 (22.05 kHz). The 18 chapter recordings live in
Cloudflare R2 and their masters are only on the maintainer's computer, so this step is run there.

Result: about 396 MB → about 198 MB, same length, so saved resume positions keep working.

## Steps (on the computer that has `audio-src/`)

1. Re-encode all 18 from the masters (needs ffmpeg). This also rewrites `src/data/chapter-audio.json`:

   ```bash
   node scripts/build-chapter-audio.mjs --force
   ```

2. Upload the new files over the old ones, same names, to the `bhagavad-gita-audio` bucket. With Wrangler:

   ```bash
   for f in public/chapter-audio/chapter-*.mp3; do
     npx wrangler r2 object put "bhagavad-gita-audio/$(basename "$f")" --file "$f" --content-type audio/mpeg --remote
   done
   ```

   (Or drag the 18 files into the bucket in the Cloudflare dashboard.)

3. In Cloudflare, purge the cache for `108-imp-slogas-audio.peacockindia.in` (Caching → Configuration → Purge
   Everything, or purge the 18 URLs) so listeners get the new files straight away.

4. Commit `src/data/chapter-audio.json` (the new sizes) and open a PR.

The app does not depend on the sizes in that file, so the order is flexible: uploading first and committing later
(or the other way round) is safe. Durations change by well under a second.
