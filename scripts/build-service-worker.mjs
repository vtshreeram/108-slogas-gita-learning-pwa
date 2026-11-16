import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
// Emergency switch: ship a worker that unregisters itself (docs/incident-runbook.md). Unset it on the next normal deploy.
if (process.env.SW_KILL_SWITCH === "1") {
  await writeFile("public/offline-worker.js", await readFile("scripts/service-worker-kill.js", "utf8"));
  console.warn("SW_KILL_SWITCH=1: built the self-removing service worker. Offline support is OFF for this release.");
  process.exit(0);
}

const inputs = [...await files("src"), ...await files("public"), "next.config.ts", "package.json", "scripts/service-worker-template.js"]
  // Recordings are cached separately by name and never part of the app shell, so they must not invalidate it (or slow the build).
  .filter((path) => path !== "public/offline-worker.js" && !path.startsWith("public/audio/") && !path.startsWith("public/chapter-audio/")).sort();
const hash = createHash("sha256");
for (const path of inputs) { hash.update(path); hash.update(await readFile(path)); }
const release = hash.digest("hex").slice(0, 16);
const template = await readFile("scripts/service-worker-template.js", "utf8");
await writeFile("public/offline-worker.js", template.replaceAll("__RELEASE__", release));
console.log(`Prepared offline worker for app release ${release}`);
