import fs from "node:fs";
import { performance } from "node:perf_hooks";
import * as T from "../src/vendor/three.module.js";
import { decodeRoomBundle } from "../src/geometry-pack.js";
import { createGraph } from "../src/graph.js";
import { gunzipSync } from "node:zlib";
const root = new URL("../", import.meta.url).pathname,
  bytes = gunzipSync(fs.readFileSync(root + "assets/source/room.bundle.gz"));
export const pack = decodeRoomBundle(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  ),
  doc = pack.document,
  graph = createGraph(doc),
  cache = new Map();
for (const r of graph.records.values()) {
  const d = r.current;
  if (!d._geometry) continue;
  let g = cache.get(d._geometry);
  if (!g) {
    const s = pack.geometries[d._geometry];
    g = new T.BufferGeometry();
    for (const [k, a] of Object.entries(s.attributes))
      g.setAttribute(
        k,
        new T.BufferAttribute(
          pack.array(a, globalThis[a.type]),
          a.itemSize,
          a.normalized,
        ),
      );
    if (s.index)
      g.setIndex(
        new T.BufferAttribute(pack.array(s.index, globalThis[s.index.type]), 1),
      );
    for (const x of s.groups ?? [])
      g.addGroup(x.start, x.count, x.materialIndex);
    g.boundingBox = new T.Box3(
      new T.Vector3().fromArray(s.bounds[0]),
      new T.Vector3().fromArray(s.bounds[1]),
    );
    g.computeBoundingSphere();
    cache.set(d._geometry, g);
  }
  r.mesh = new T.Mesh(
    g,
    new T.MeshBasicMaterial({
      side:
        d.side === 1 ? T.BackSide : d.side === 2 ? T.DoubleSide : T.FrontSide,
    }),
  );
  r.mesh.userData.record = r;
  r.object.add(r.mesh);
}
export function eligible(r, page) {
  if (r.destroyed || r.templateOnly || r.page !== page) return false;
  for (let o = r.object; o && o !== graph.scene; o = o.parent)
    if (!o.visible || o.userData.record?.current.raycastLock) return false;
  return true;
}
export const ray = new T.Raycaster(),
  points = Array.from(
    { length: 96 },
    (_, i) =>
      new T.Vector2(
        ((i % 12) + 0.5) / 6 - 1,
        1 - (Math.floor(i / 12) + 0.5) / 4,
      ),
  );
export function setup(page) {
  for (const p of graph.pages) p.object.visible = p === page;
  graph.scene.updateMatrixWorld(true);
  return graph.resolve(page.current.publish?.playCamera, page).object;
}
