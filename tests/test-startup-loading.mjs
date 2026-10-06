import vm from "node:vm";
import fs from "node:fs";
import assert from "node:assert/strict";
import { loadGeometryPack } from "../src/geometry-pack.js";
import { bundleURL } from "../src/bundle-version.js";
const encoded = fs.readFileSync(
    new URL("../assets/models/room.compact.gz", import.meta.url),
  ),
  savedFetch = globalThis.fetch,
  savedCaches = globalThis.caches;
let network = 0,
  writes = [];
const values = new Map([["./room.bundle.gz?v=old", new Response("old")]]);
const cache = {
  async match(url) {
    return values.get(url)?.clone();
  },
  put(url, response) {
    const write = response
      .arrayBuffer()
      .then((bytes) => values.set(url, new Response(bytes)));
    writes.push(write);
    return write;
  },
  async keys() {
    return [...values.keys()].map((url) => ({
      url: new URL(url, "https://room.test/").href,
    }));
  },
  async delete(key) {
    return (
      values.delete(
        typeof key === "string"
          ? key
          : new URL(key.url).pathname.slice(1) + new URL(key.url).search,
      ) ||
      values.delete(
        "./" + new URL(key.url).pathname.slice(1) + new URL(key.url).search,
      )
    );
  },
};
globalThis.caches = {
  async open(name) {
    assert.equal(name, "room-models-v1");
    return cache;
  },
};
globalThis.fetch = async (url, options) => {
  network++;
  assert.equal(url, bundleURL);
  assert.equal(options.cache, "force-cache");
  assert.equal(options.priority, "high");
  return new Response(encoded);
};
const first = await loadGeometryPack();
await Promise.all(writes);
await new Promise((resolve) => setImmediate(resolve));
const second = await loadGeometryPack();
assert.equal(network, 1);
assert.deepEqual(new Uint8Array(first.bytes), new Uint8Array(second.bytes));
assert.equal(values.size, 1);
globalThis.caches = {
  async open() {
    throw Error("Storage disabled");
  },
};
await loadGeometryPack();
assert.equal(network, 2);
const html = fs.readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
assert.ok(html.includes(`const url = "${bundleURL}"`));
assert.match(html, /rel="modulepreload" href=".\/runtime\/chunk-/);
assert.ok(html.includes('eggAudio.preload = "none"'));
const code = html.match(
  /<!-- room bundle preload -->\s*<script>([\s\S]*?)<\/script>/,
)[1];
for (const mode of ["hit", "miss", "blocked"]) {
  const appended = [],
    scope = {
      document: {
        createElement: () => ({}),
        head: { appendChild: (link) => appended.push(link) },
      },
      caches: {
        async open() {
          if (mode === "blocked") throw Error("Blocked");
          return {
            async match() {
              return mode === "hit" ? {} : undefined;
            },
          };
        },
      },
    };
  vm.runInNewContext(code, scope);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(appended.length, mode === "hit" ? 0 : 1);
  if (appended.length) assert.equal(appended[0].href, bundleURL);
}
globalThis.fetch = savedFetch;
if (savedCaches === undefined) delete globalThis.caches;
else globalThis.caches = savedCaches;
console.log(
  "Cold fetch, byte-identical cache hit without network, old-version eviction, blocked-storage fallback, early preloads and deferred egg audio passed.",
);
