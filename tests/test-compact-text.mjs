import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { decodeRoomBundle } from "../src/geometry-pack.js";
import { decodeCompactPack } from "../src/compact-pack.js";
import { createGraph } from "../src/graph.js";
import assert from "node:assert/strict";
const load = (f) => {
    const b = gunzipSync(fs.readFileSync(new URL(f, import.meta.url)));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  },
  original = decodeRoomBundle(load("../assets/source/room.bundle.gz")),
  compact = await decodeCompactPack(load("../assets/models/room.compact.gz")),
  graph = createGraph(original.document);
assert.deepEqual(compact.document, original.document);
let meshes = 0,
  values = 0;
for (const r of graph.records.values()) {
  if (r.current.geometry?.type !== "TextGeometry") continue;
  const a = original.geometries[r.current._geometry],
    b = compact.geometries[r.current._geometry],
    ai = original.array(a.index, globalThis[a.index.type]),
    bi = compact.array(b.index, globalThis[b.index.type]);
  assert.equal(ai.length, bi.length);
  for (const k of Object.keys(a.attributes)) {
    const x = original.array(a.attributes[k], globalThis[a.attributes[k].type]),
      y = compact.array(b.attributes[k], globalThis[b.attributes[k].type]),
      n = a.attributes[k].itemSize;
    for (let i = 0; i < ai.length; i++)
      for (let j = 0; j < n; j++) {
        assert.ok(
          x[ai[i] * n + j] === y[bi[i] * n + j],
          r.current.name + " " + k + " " + i,
        );
        values++;
      }
  }
  meshes++;
}
console.log({
  meshes,
  values,
  result:
    "Every text triangle attribute is numerically identical; full document unchanged",
});
