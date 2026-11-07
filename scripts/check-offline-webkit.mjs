// No request interception: exercise WebKit's native service worker and media stack.
const { webkit } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
const upstream = new URL(process.env.GITA_BASE_URL || "http://localhost:3002");
// WebKit offline emulation can reject service-worker navigations before dispatch.
// A disposable proxy lets us simulate a real origin outage instead.
// https://github.com/microsoft/playwright/issues/42775
const proxy = createServer((request, response) => {
  const send = upstream.protocol === "https:" ? httpsRequest : httpRequest;
  const outbound = send(new URL(request.url || "/", upstream), { method: request.method, headers: { ...request.headers, host: upstream.host } }, (incoming) => {
    response.writeHead(incoming.statusCode || 502, incoming.headers); incoming.pipe(response);
  });
  outbound.on("error", () => { response.writeHead(502); response.end(); });
  request.pipe(outbound);
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const testOrigin = `http://127.0.0.1:${proxy.address().port}`;
const disconnect = async () => { if (!proxy.listening) return; proxy.closeAllConnections(); await new Promise((resolve) => proxy.close(resolve)); };
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage(); page.setDefaultTimeout(15_000);
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  await page.goto(testOrigin);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const bytes = await page.evaluate(async () => {
    const response = await fetch("/audio/2.11.mp3", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load audio fixture");
    const data = await response.arrayBuffer();
    await (await caches.open("gita-audio-v3")).put("/audio/2.11.mp3", new Response(data, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(data.byteLength) } }));
    return data.byteLength;
  });
  assert(bytes > 1000, "Empty audio fixture");
  await disconnect();
  await page.reload();
  await page.getByRole("heading", { name: "Bhagavad Gita", exact: true }).waitFor();
  const ranges = await page.evaluate(async () => {
    const result = [];
    for (const range of ["bytes=0-15", "bytes=-8", "bytes=999999999-"]) {
      const response = await fetch("/audio/2.11.mp3", { headers: { Range: range } });
      result.push({ status: response.status, bytes: (await response.arrayBuffer()).byteLength });
    }
    return result;
  });
  assert(ranges[0].status === 206 && ranges[0].bytes === 16, "Closed audio range failed");
  assert(ranges[1].status === 206 && ranges[1].bytes === 8, "Suffix audio range failed");
  assert(ranges[2].status === 416, "Invalid audio range was accepted");
  await page.evaluate(() => {
    const audio = document.createElement("audio"); audio.id = "offline-media-test"; audio.src = "/audio/2.11.mp3"; audio.preload = "auto"; document.body.appendChild(audio);
    const button = document.createElement("button"); button.textContent = "Test offline playback"; button.onclick = () => { void audio.play(); }; document.body.prepend(button);
  });
  await page.getByRole("button", { name: "Test offline playback", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#offline-media-test").currentTime > 0.1);
  await page.evaluate(() => document.querySelector("#offline-media-test").pause());
  assert(errors.length === 0, `Browser errors: ${errors.join(", ")}`);
  console.log("WebKit: production shell reloads offline; closed/suffix ranges, invalid ranges and actual MP3 playback pass.");
} finally { await browser.close(); await disconnect(); }
