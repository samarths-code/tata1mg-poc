/* Writes public/pubsub-worker.js from the installed SDK.
 *
 * The SDK inlines the pubsub worker and loads it from a blob: URL. Under a CSP
 * without `worker-src blob:` that is refused, so we self-host the file and point
 * `pubsubWorkerUrl` at it (see App.js).
 *
 * Extracted from node_modules rather than downloaded, so the worker always
 * matches the installed SDK version. Runs automatically via `prebuild`.
 */
const fs = require("fs");
const path = require("path");

const SDK = require.resolve("@videosdk.live/js-sdk/videosdk.js");
const OUT = path.join(__dirname, "..", "public", "pubsub-worker.js");

const src = fs.readFileSync(SDK, "utf8");
const marker = /pubsub_worker_namespaceObject\s*=\s*/.exec(src);
if (!marker) {
  console.error("extract-pubsub-worker: inlined worker not found — did the SDK change?");
  process.exit(1);
}

// Walk the string literal, honouring escapes.
let i = marker.index + marker[0].length;
if (src[i] !== '"') {
  console.error("extract-pubsub-worker: expected a string literal at the marker");
  process.exit(1);
}
const start = i;
i += 1;
for (;;) {
  const c = src[i];
  if (c === "\\") { i += 2; continue; }
  if (c === '"') break;
  if (i >= src.length) {
    console.error("extract-pubsub-worker: unterminated literal");
    process.exit(1);
  }
  i += 1;
}

const code = JSON.parse(src.slice(start, i + 1));
const version = require("@videosdk.live/js-sdk/package.json").version;
fs.writeFileSync(OUT, code);
console.log(`extract-pubsub-worker: wrote ${OUT} (${code.length} bytes, js-sdk ${version})`);
