import fs from "node:fs";
import { performance } from "node:perf_hooks";
import * as T from "../src/vendor/three.module.js";
import { graph, ray, points, setup, eligible } from "./picking-fixture.mjs";
import {
  ScenePicker,
  acceleratePicking,
  pickingBoundsBytes,
} from "../src/picking.js";
import { applyTransform } from "../src/graph.js";
import { merge } from "../src/behavior.js";
import { RoomOrbit } from "../src/orbit.js";
const native = T.Mesh.prototype._computeIntersections,
  picker = new ScenePicker(),
  meshes = [...graph.records.values()].map((r) => r.mesh).filter(Boolean),
  geometries = new Set(meshes.map((m) => m.geometry));
function mode(fast) {
  for (const m of meshes)
    if (fast) acceleratePicking(m);
    else m._computeIntersections = native;
}
const results = [];
for (const page of graph.pages) {
  const camera = setup(page),
    r = camera.userData.record;
  for (const state of page.current.name === "Setup"
    ? [
        null,
        r.current.states.find(
          (s) => s.id === "8b53715a-47c1-41df-938f-326c290b6327",
        ),
      ]
    : [null]) {
    applyTransform(camera, state ? merge(r.base, state.data) : r.base);
    graph.scene.updateMatrixWorld(true);
    const label = page.current.name + (state ? " / " + state.data.name : ""),
      query = (fast) => {
        for (const p of points) {
          ray.setFromCamera(p, camera);
          if (fast)
            picker.intersect(page.object, ray, (o) => eligible(o, page));
          else
            ray
              .intersectObjects(page.object.children, true)
              .filter((h) => eligible(h.object.userData.record, page));
        }
      };
    mode(true);
    const coldStart = performance.now();
    query(true);
    const firstAcceleratedBatchMs = performance.now() - coldStart;
    for (let i = 0; i < 4; i++) {
      mode(false);
      query(false);
      mode(true);
      query(true);
    }
    const samples = { native: [], optimized: [] };
    for (let i = 0; i < 20; i++)
      for (const fast of i % 2 ? [true, false] : [false, true]) {
        mode(fast);
        const start = performance.now();
        query(fast);
        samples[fast ? "optimized" : "native"].push(performance.now() - start);
      }
    const counts = {};
    const getVertex = T.Mesh.prototype.getVertexPosition;
    for (const fast of [false, true]) {
      let count = 0;
      T.Mesh.prototype.getVertexPosition = function (...args) {
        count++;
        return getVertex.apply(this, args);
      };
      mode(fast);
      query(fast);
      counts[fast ? "optimized" : "native"] = count / 3;
      T.Mesh.prototype.getVertexPosition = getVertex;
    }
    const mean = (x) => x.reduce((a, b) => a + b) / x.length;
    results.push({
      label,
      raysPerBatch: points.length,
      firstAcceleratedBatchMs,
      nativeMeanBatchMs: mean(samples.native),
      optimizedMeanBatchMs: mean(samples.optimized),
      triangleTests: counts,
      samples,
    });
    console.log({ ...results.at(-1), samples: undefined });
  }
}
const result = {
  scope:
    "CPU-only Three.js raycasting; original full-resolution room geometry, 96 screen rays per batch, 4 warmup batches and 20 interleaved samples each. Basic material sides match the renderer. No GPU/browser FPS claim. First accelerated batch includes lazily building any uncached triangle-range bounds; indices/render buffers are unchanged.",
  boundsBytes: [...geometries].reduce((a, g) => a + pickingBoundsBytes(g), 0),
  results,
};
fs.writeFileSync(
  new URL("../docs/verification/picking-performance.json", import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log("bounds bytes", result.boundsBytes);
