import * as T from "./vendor/three.module.js";
import { roundedBox } from "./primitive-geometry.js";
import { rectangleGeometry, textGeometry } from "./parametric-geometry.js";
const fontCache = new Map();
let parserPromise;
async function fontParser() {
  if (window.opentype) return window.opentype;
  parserPromise ??= import("./vendor/opentype.cjs")
    .then((module) => window.opentype ?? globalThis.opentype ?? module.default)
    .catch((error) => {
      parserPromise = undefined;
      throw error;
    });
  return parserPromise;
}
export async function rebuildGeometry(g, shared) {
  let geometry;
  if (g.type === "CubeGeometry") geometry = roundedBox(g);
  else if (g.type === "RectangleGeometry") geometry = rectangleGeometry(g);
  else if (g.type === "TextGeometry") {
    const f = shared.fonts[g.font],
      url =
        f?.data?.$asset ??
        (g.font === "Arya_regular" ? "assets/arya.ttf" : f?.url);
    if (!url) throw Error("Font unavailable");
    if (!fontCache.has(url))
      fontCache.set(
        url,
        fetch(url)
          .then((r) => {
            if (!r.ok) throw Error("Font request failed: " + r.status);
            return r.arrayBuffer();
          })
          .then(async (b) => (await fontParser()).parse(b))
          .catch((error) => {
            fontCache.delete(url);
            throw error;
          }),
      );
    geometry = textGeometry(g, await fontCache.get(url));
  } else return null;
  const position = geometry.attributes.position,
    normal = geometry.attributes.normal,
    extrude = new Float32Array(position.count * 3);
  if (g.type === "RectangleGeometry" && !g.depth) {
    for (let i = 0; i < position.count; i++)
      extrude.set(
        new T.Vector3().fromBufferAttribute(position, i).normalize().toArray(),
        i * 3,
      );
  }
  // Source vector extrusions are indexed: repeated triangle corners must not weight a face twice.
  else {
    const groups = new Map();
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)].join(
        ",",
      );
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    for (const indices of groups.values()) {
      const v = new T.Vector3(),
        normals = new Map();
      for (const i of indices) {
        const n = new T.Vector3().fromBufferAttribute(normal, i);
        normals.set(n.toArray().join(","), n);
      }
      const values =
        g.type === "RectangleGeometry" || g.type === "TextGeometry"
          ? [...normals.values()]
          : indices.map((i) => new T.Vector3().fromBufferAttribute(normal, i));
      for (const n of values) v.add(n);
      v.divideScalar(values.length);
      for (const i of indices) extrude.set(v.toArray(), i * 3);
    }
  }
  geometry.setAttribute("extrudeNormal", new T.BufferAttribute(extrude, 3));
  geometry.computeBoundingBox();
  return geometry;
}
