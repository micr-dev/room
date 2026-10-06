import { loadSourcePack, loadConversionFile } from "./scene-fixture.mjs";
import { decodeRoomBundle } from "../src/geometry-pack.js";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
const bundle = loadSourcePack(),
  manifest = JSON.parse(
    new TextDecoder().decode(loadConversionFile("dist/geometry-pack.json")),
  ),
  bytes = new Uint8Array(bundle.bytes, bundle.dataOffset);
assert.equal(bytes.length, manifest.byteLength);
assert.deepEqual(bundle.manifest, manifest);
assert.deepEqual(
  bundle.document,
  JSON.parse(new TextDecoder().decode(loadConversionFile("dist/room.json"))),
);
for (const [file, entry] of Object.entries(manifest.buffers)) {
  assert.equal(entry.offset % 8, 0);
  const data = bytes.subarray(entry.offset, entry.offset + entry.byteLength);
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    path.basename(file, ".buffer"),
    file + " packed bytes changed",
  );
}
for (const [file, geometry] of Object.entries(manifest.geometries))
  assert.deepEqual(
    geometry,
    JSON.parse(new TextDecoder().decode(loadConversionFile("dist/" + file))),
    file + " packed metadata changed",
  );
console.log(
  JSON.stringify({
    geometries: Object.keys(manifest.geometries).length,
    buffers: Object.keys(manifest.buffers).length,
    bytes: bytes.length,
    result: "all packed metadata and content hashes verified",
  }),
);
