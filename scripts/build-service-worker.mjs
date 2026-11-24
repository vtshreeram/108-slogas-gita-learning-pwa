import { createHash } from "node:crypto";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
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

async function writeWorker(source) {
  const target = "public/offline-worker.js";
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, source);
  await rename(temporary, target);
}
// Emergency switch: ship a worker that unregisters itself (docs/incident-runbook.md). Unset it on the next normal deploy.
if (process.env.SW_KILL_SWITCH === "1") {
  await writeWorker(await readFile("scripts/service-worker-kill.js", "utf8"));
  console.warn("SW_KILL_SWITCH=1: built the self-removing service worker. Offline support is OFF for this release.");
  process.exit(0);
}

// Match the production distDir in next.config.ts. These lazy entry points are part of offline learning.
const distDir = process.env.VERCEL ? ".next" : ".next-build";
const buildId = (await readFile(join(distDir, "BUILD_ID"), "utf8")).trim();
const lazyManifest = JSON.parse(await readFile(join(distDir, "react-loadable-manifest.json"), "utf8"));
const { config } = JSON.parse(await readFile(join(distDir, "required-server-files.json"), "utf8"));
// Next's webpack runtime appends the deployment ID to chunk requests when skew protection uses query parameters.
const assetQuery = config.deploymentId && !config.experimental?.useSkewCookie ? `?dpl=${config.deploymentId}` : "";
const requiredModules = [
  "app/profile/page.tsx -> @/components/profile-content",
  "app/chapters/page.tsx -> @/components/chapter-audios",
  "components/guided-practice.tsx -> @/components/guided-practice-content",
  "components/reader.tsx -> @/components/study-panels",
];
const lazyAssets = new Set();
for (const entry of requiredModules) {
  const assets = lazyManifest[entry]?.files;
  if (!assets?.length) throw new Error(`Missing offline learning assets for ${entry}`);
  for (const asset of assets) lazyAssets.add(`/_next/${asset}${assetQuery}`);
}

const inputs = [...await files("src"), ...await files("public"), "next.config.ts", "package.json", "scripts/service-worker-template.js"]
  // Recordings are cached separately by name and never part of the app shell, so they must not invalidate it (or slow the build).
  .filter((path) => path !== "public/offline-worker.js" && !path.startsWith("public/audio/") && !path.startsWith("public/chapter-audio/")).sort();
const hash = createHash("sha256");
hash.update(buildId);
for (const path of inputs) { hash.update(path); hash.update(await readFile(path)); }
const release = hash.digest("hex").slice(0, 16);
const template = await readFile("scripts/service-worker-template.js", "utf8");
await writeWorker(template
  .replaceAll("__RELEASE__", release)
  .replaceAll("__NEXT_BUILD_ID__", JSON.stringify(buildId))
  .replaceAll("__REQUIRED_LAZY_ASSETS__", JSON.stringify([...lazyAssets].sort())));
console.log(`Prepared offline worker for app release ${release}`);
