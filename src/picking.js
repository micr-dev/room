import * as T from "./vendor/three.module.js";
const nativeIntersections = T.Mesh.prototype._computeIntersections,
  trees = new WeakMap(),
  states = new WeakMap(),
  box = new T.Box3();
// Contiguous triangle ranges preserve native face IDs, winding, attributes and
// equal-distance ordering. Bounds affect picking only; render buffers stay intact.
function treeFor(g) {
  const p = g.attributes.position,
    index = g.index,
    n = (index?.count ?? p.count) / 3;
  const signature = [
    p,
    p.version,
    p.data?.version,
    p.array,
    p.data?.array,
    p.itemSize,
    p.normalized,
    p.data?.stride,
    p.offset,
    index,
    index?.version,
    index?.data?.version,
    index?.array,
    index?.data?.array,
    n,
  ];
  let tree = trees.get(g);
  if (tree && signature.every((v, i) => Object.is(v, tree.signature[i])))
    return tree;
  const bounds = [],
    ranges = [],
    children = [];
  let nodes = 0;
  function build(start, end) {
    const node = nodes++,
      at = node * 6;
    bounds.push(0, 0, 0, 0, 0, 0);
    ranges[node * 2] = start * 3;
    ranges[node * 2 + 1] = (end - start) * 3;
    if (end - start > 32) {
      const mid = (start + end) >> 1,
        a = build(start, mid),
        b = build(mid, end);
      children[node * 2] = a;
      children[node * 2 + 1] = b;
      for (let axis = 0; axis < 3; axis++) {
        bounds[at + axis] = Math.min(
          bounds[a * 6 + axis],
          bounds[b * 6 + axis],
        );
        bounds[at + axis + 3] = Math.max(
          bounds[a * 6 + axis + 3],
          bounds[b * 6 + axis + 3],
        );
      }
    } else {
      children[node * 2] = -1;
      children[node * 2 + 1] = -1;
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      for (let i = start * 3; i < end * 3; i++) {
        const v = index ? index.getX(i) : i,
          x = p.getX(v),
          y = p.getY(v),
          z = p.getZ(v);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
      }
      bounds[at] = minX;
      bounds[at + 1] = minY;
      bounds[at + 2] = minZ;
      bounds[at + 3] = maxX;
      bounds[at + 4] = maxY;
      bounds[at + 5] = maxZ;
    }
    return node;
  }
  build(0, n);
  tree = {
    signature,
    bounds: new Float64Array(bounds),
    ranges: new Uint32Array(ranges),
    children: new Int32Array(children),
    byteLength: nodes * 64,
  };
  trees.set(g, tree);
  return tree;
}
function acceleratedIntersections(raycaster, intersects, ray) {
  const g = this.geometry,
    p = g.attributes.position,
    n = g.index?.count ?? p?.count ?? 0;
  // Native fallback for deforming/custom meshes, material groups, malformed or
  // non-triangle-aligned ranges. Edits to attributes invalidate shared bounds.
  if (
    n < 768 ||
    n % 3 ||
    this.isSkinnedMesh ||
    this.isInstancedMesh ||
    Array.isArray(this.material) ||
    g.morphAttributes.position?.length ||
    this.getVertexPosition !== T.Mesh.prototype.getVertexPosition ||
    g.drawRange.start % 3
  )
    return nativeIntersections.call(this, raycaster, intersects, ray);
  const tree = treeFor(g);
  let state = states.get(this);
  if (!state) {
    state = { mesh: Object.create(this), stack: [], hits: [] };
    states.set(this, state);
  }
  if (state.geometry !== g) {
    state.geometry = g;
    state.mesh.geometry = Object.create(g);
    state.mesh.geometry.drawRange = { start: 0, count: 0 };
  }
  const range = state.mesh.geometry.drawRange,
    stack = state.stack,
    hits = state.hits;
  stack.length = 0;
  hits.length = 0;
  stack.push(0);
  const end = Math.min(n, g.drawRange.start + g.drawRange.count);
  while (stack.length) {
    const node = stack.pop(),
      start = tree.ranges[node * 2],
      count = tree.ranges[node * 2 + 1];
    if (start >= end || start + count <= g.drawRange.start) continue;
    const at = node * 6,
      b = tree.bounds;
    for (let axis = 0; axis < 3; axis++) {
      const min = b[at + axis],
        max = b[at + axis + 3],
        pad = Number.EPSILON * 16 * Math.max(1, Math.abs(min), Math.abs(max));
      box.min.setComponent(axis, min - pad);
      box.max.setComponent(axis, max + pad);
    }
    if (!ray.intersectsBox(box)) continue;
    const left = tree.children[node * 2];
    if (left >= 0) {
      stack.push(tree.children[node * 2 + 1], left);
      continue;
    }
    range.start = Math.max(start, g.drawRange.start);
    range.count = Math.min(start + count, end) - range.start;
    nativeIntersections.call(state.mesh, raycaster, hits, ray);
  }
  for (const hit of hits) {
    hit.object = this;
    intersects.push(hit);
  }
  hits.length = 0;
}
export function acceleratePicking(mesh) {
  if (mesh.isMesh && mesh._computeIntersections === nativeIntersections)
    mesh._computeIntersections = acceleratedIntersections;
  return mesh;
}
export function pickingBoundsBytes(geometry) {
  return trees.get(geometry)?.byteLength ?? 0;
}
export class ScenePicker {
  constructor() {
    this.candidates = [];
    this.intersections = [];
  }
  intersect(root, raycaster, eligible) {
    const candidates = this.candidates;
    candidates.length = 0;
    root.traverseVisible((o) => {
      const r = o.userData.record;
      if (o.isMesh && r && eligible(r)) candidates.push(o);
    });
    this.intersections.length = 0;
    return raycaster.intersectObjects(candidates, false, this.intersections);
  }
}
