// Exercise the actual dev script in an isolated checkout so a running developer's .next stays untouched.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = process.cwd();
const runner = process.env.GITA_PACKAGE_RUNNER || "pnpm";
const inheritedMode = process.env.GITA_TEST_NODE_ENV || "production";
const copy = await mkdtemp(join(tmpdir(), "gita-dev-startup-"));
let server;
let log = "";
try {
  for (const path of ["src", "scripts", "package.json", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "eslint.config.mjs"]) {
    await cp(join(source, path), join(copy, path), { recursive: true });
  }
  await symlink(join(source, "node_modules"), join(copy, "node_modules"), "dir");
  await symlink(join(source, "public"), join(copy, "public"), "dir");
  const portFinder = createServer();
  await new Promise((resolve, reject) => { portFinder.once("error", reject); portFinder.listen(0, "127.0.0.1", resolve); });
  const port = portFinder.address().port;
  await new Promise((resolve) => portFinder.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(runner, ["run", "dev", "--port", String(port)], {
    cwd: copy,
    env: { ...process.env, NODE_ENV: inheritedMode, NEXT_TELEMETRY_DISABLED: "1" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let launchError;
  server.on("error", (error) => { launchError = error; });
  server.stdout.on("data", (chunk) => { log += chunk; });
  server.stderr.on("data", (chunk) => { log += chunk; });
  let response;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error("Development server exited before responding");
    try { response = await fetch(origin, { signal: AbortSignal.timeout(15_000) }); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 150)); }
  }
  assert(response, "Development server did not start");
  console.log(`${runner} run dev with inherited NODE_ENV=${inheritedMode}: GET / ${response.status}`);
  assert.equal(response.status, 200, "Reader returned an HTTP error");
  const html = await response.text();
  const profile = await fetch(`${origin}/profile`);
  assert.equal(profile.status, 200, "Profile returned an HTTP error");
  const stylesheets = [...html.matchAll(/href="([^\"]+\.css(?:\?[^\"]*)?)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  assert(stylesheets.length, "No stylesheet was emitted");
  for (const path of stylesheets) {
    const stylesheet = await fetch(new URL(path, origin));
    assert.equal(stylesheet.status, 200, "Stylesheet returned an HTTP error");
    assert.match(stylesheet.headers.get("content-type") || "", /text\/css/);
    assert.match(await stylesheet.text(), /\.reading-page/, "Application CSS was not compiled");
  }
  assert(!log.includes('non-standard "NODE_ENV"'), "Next warned about the inherited NODE_ENV");
  assert(!log.includes("Module parse failed"), "CSS loader failed");
  assert(!log.includes("required-server-files.json"), "Missing server manifest error");
  console.log("Passed: reader, profile and compiled CSS; no NODE_ENV, CSS-loader or missing-manifest errors.");
} catch (error) {
  // Only print the known diagnostic lines, rather than dumping the process environment or HTML.
  console.error(log.split("\n").filter((line) => /NODE_ENV|Module parse failed|Unexpected character|@import|required-server-files/.test(line)).slice(0, 16).join("\n"));
  throw error;
} finally {
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 200));
  await rm(copy, { recursive: true, force: true });
}
