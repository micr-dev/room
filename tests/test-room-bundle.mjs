import fs from "node:fs";
import assert from "node:assert/strict";
import { loadGeometryPack, decodeRoomBundle } from "../src/geometry-pack.js";
import { gunzipSync } from "node:zlib";
const encoded = fs.readFileSync(
    new URL("../assets/source/room.bundle.gz", import.meta.url),
  ),
  originalFetch = globalThis.fetch,
  originalStream = globalThis.DecompressionStream;
globalThis.fetch = async () => new Response(encoded);
const native = await loadGeometryPack();
globalThis.DecompressionStream = undefined;
const fallback = await loadGeometryPack();
assert.deepEqual(new Uint8Array(fallback.bytes), new Uint8Array(native.bytes));
assert.deepEqual(fallback.document, native.document);
assert.throws(
  () => decodeRoomBundle(new ArrayBuffer(8)),
  /Invalid room bundle/,
);
const bad = gunzipSync(encoded);
bad.writeUInt32LE(0xffffffff, 8);
assert.throws(
  () =>
    decodeRoomBundle(
      bad.buffer.slice(bad.byteOffset, bad.byteOffset + bad.byteLength),
    ),
  /Invalid room bundle lengths/,
);
globalThis.fetch = originalFetch;
globalThis.DecompressionStream = originalStream;
console.log(
  "Native gzip and bundled JavaScript fallback decode identical scene/model bytes; malformed headers rejected",
);
