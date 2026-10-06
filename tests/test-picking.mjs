import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as T from "../src/vendor/three.module.js";
import {
  pack,
  graph,
  ray,
  points,
  setup,
  eligible,
} from "./picking-fixture.mjs";
import { applyTransform } from "../src/graph.js";
import { merge } from "../src/behavior.js";
import { ScenePicker, acceleratePicking } from "../src/picking.js";
const picker = new ScenePicker(),
  native = T.Mesh.prototype._computeIntersections,
  meshes = [...graph.records.values()].map((r) => r.mesh).filter(Boolean);
function mode(fast) {
  for (const m of meshes)
    if (fast) acceleratePicking(m);
    else m._computeIntersections = native;
}
const capture = (h) =>
  h.map((x) => ({
    id: x.object.userData.record.id,
    distance: x.distance,
    point: x.point.toArray(),
    faceIndex: x.faceIndex,
    face: { ...x.face, normal: x.face.normal.toArray() },
    uv: x.uv?.toArray(),
    uv1: x.uv1?.toArray(),
    normal: x.normal?.toArray(),
    barycoord: x.barycoord?.toArray(),
  }));
const bufferHash = () =>
    createHash("sha256").update(new Uint8Array(pack.bytes)).digest("hex"),
  originalBuffers = bufferHash();
let comparisons = 0;
for (const page of graph.pages) {
  const camera = setup(page),
    r = camera.userData.record;
  for (const state of [null, ...r.current.states]) {
    applyTransform(camera, state ? merge(r.base, state.data) : r.base);
    graph.scene.updateMatrixWorld(true);
    for (const p of points) {
      ray.setFromCamera(p, camera);
      mode(false);
      const expected = capture(
        ray
          .intersectObjects(page.object.children, true)
          .filter((h) => eligible(h.object.userData.record, page)),
      );
      mode(true);
      assert.deepEqual(
        capture(picker.intersect(page.object, ray, (r) => eligible(r, page))),
        expected,
      );
      comparisons++;
    }
  }
  applyTransform(camera, r.base);
}
// Dynamic changes must invalidate geometry bounds or retain native fallback.
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(60, 1, 0.01, 100);
camera.position.z = 4;
camera.updateMatrixWorld();
const mesh = new T.Mesh(
  new T.SphereGeometry(1, 40, 30),
  new T.MeshBasicMaterial({ side: T.DoubleSide }),
);
scene.add(mesh);
const localRay = new T.Raycaster();
function compare() {
  scene.updateMatrixWorld(true);
  for (const p of [
    new T.Vector2(0, 0),
    new T.Vector2(0.2, 0.2),
    new T.Vector2(-0.3, 0.1),
  ]) {
    localRay.setFromCamera(p, camera);
    mesh._computeIntersections = native;
    const a = localRay.intersectObject(mesh);
    acceleratePicking(mesh);
    const b = localRay.intersectObject(mesh);
    assert.deepEqual(b, a);
    comparisons++;
  }
}
compare();
mesh.position.x = 0.3;
mesh.scale.set(-1, 2, 0.5);
mesh.rotation.y = 0.6;
compare();
mesh.material.side = T.BackSide;
compare();
mesh.geometry.attributes.position.array[0] += 2;
mesh.geometry.attributes.position.needsUpdate = true;
mesh.geometry.computeBoundingBox();
mesh.geometry.computeBoundingSphere();
compare();
mesh.geometry.setAttribute(
  "position",
  mesh.geometry.attributes.position.clone(),
);
compare();
mesh.geometry.index.needsUpdate = true;
compare();
mesh.geometry.setIndex(mesh.geometry.index.clone());
compare();
mesh.geometry.setDrawRange(3, 300);
compare();
mesh.geometry.setDrawRange(1, 300);
compare();
mesh.geometry = new T.TorusGeometry(0.8, 0.2, 24, 48);
compare();
mesh.geometry = mesh.geometry.toNonIndexed();
compare();
mesh.material = [new T.MeshBasicMaterial({ side: T.DoubleSide })];
mesh.geometry.clearGroups();
mesh.geometry.addGroup(0, mesh.geometry.attributes.position.count, 0);
compare();
mesh.material = mesh.material[0];
localRay.near = 3.5;
localRay.far = 4.1;
compare();
localRay.near = 0;
localRay.far = Infinity;
mesh.layers.set(1);
compare();
localRay.layers.set(1);
compare();
mesh.layers.set(0);
localRay.layers.set(0);
const getVertex = mesh.getVertexPosition;
mesh.getVertexPosition = function (i, v) {
  getVertex.call(this, i, v);
  v.x *= 1.1;
  return v;
};
compare();
delete mesh.getVertexPosition;
mesh.geometry.morphAttributes.position = [
  mesh.geometry.attributes.position.clone(),
];
mesh.updateMorphTargets();
mesh.morphTargetInfluences[0] = 0.4;
compare();
assert.equal(bufferHash(), originalBuffers);
console.log(
  `${comparisons} complete intersection-list comparisons match native picking exactly; scene filtering and dynamic edits covered`,
);
