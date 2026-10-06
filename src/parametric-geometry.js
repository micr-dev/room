import * as T from "./vendor/three.module.js";
import { flatRectangle } from "./primitive-geometry.js";
import { normalizeShapeUV } from "./texture-sampling.js";
import Tess2 from "./vendor/tess2.js";
export function rectangleGeometry(g) {
  const corners = Array.isArray(g.cornerRadius)
    ? g.cornerRadius
    : [g.cornerRadius ?? 0];
  const simple =
    !g.shape ||
    (g.shape.points?.length === 4 &&
      g.shape.points.every(
        (p) =>
          JSON.stringify(p.data.position) ===
            JSON.stringify(p.data.controlNext?.position ?? p.data.position) &&
          JSON.stringify(p.data.position) ===
            JSON.stringify(p.data.controlPrevious?.position ?? p.data.position),
      ));
  if (!g.depth && !corners.some((r) => r > 0) && simple)
    return flatRectangle(g.width ?? 100, g.height ?? 100);
  const s = new T.Shape();
  if (g.shape?.points?.length) {
    const ps = [...g.shape.points]
      .sort((a, b) => a.fi - b.fi)
      .map((p) => p.data);
    s.moveTo(...ps[0].position);
    for (let i = 1; i <= ps.length; i++) {
      const a = ps[(i - 1) % ps.length],
        b = ps[i % ps.length];
      s.bezierCurveTo(
        ...(a.controlNext?.position ?? a.position),
        ...(b.controlPrevious?.position ?? b.position),
        ...b.position,
      );
    }
    s.closePath();
  } else {
    const w = g.width ?? 100,
      h = g.height ?? 100,
      rr = Array.isArray(g.cornerRadius)
        ? g.cornerRadius
        : [
            g.cornerRadius ?? 0,
            g.cornerRadius ?? 0,
            g.cornerRadius ?? 0,
            g.cornerRadius ?? 0,
          ];
    const [a, b, c, d] = rr.map((r) => Math.max(0, Math.min(r, w / 2, h / 2)));
    s.moveTo(-w / 2 + a, -h / 2);
    s.lineTo(w / 2 - b, -h / 2);
    g.cornerType === 1
      ? s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + b)
      : s.bezierCurveTo(
          w / 2 - b + b * 0.5522847498307936,
          -h / 2,
          w / 2,
          -h / 2 + b - b * 0.5522847498307936,
          w / 2,
          -h / 2 + b,
        );
    s.lineTo(w / 2, h / 2 - c);
    g.cornerType === 1
      ? s.quadraticCurveTo(w / 2, h / 2, w / 2 - c, h / 2)
      : s.bezierCurveTo(
          w / 2,
          h / 2 - c + c * 0.5522847498307936,
          w / 2 - c + c * 0.5522847498307936,
          h / 2,
          w / 2 - c,
          h / 2,
        );
    s.lineTo(-w / 2 + d, h / 2);
    g.cornerType === 1
      ? s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - d)
      : s.bezierCurveTo(
          -w / 2 + d - d * 0.5522847498307936,
          h / 2,
          -w / 2,
          h / 2 - d + d * 0.5522847498307936,
          -w / 2,
          h / 2 - d,
        );
    s.lineTo(-w / 2, -h / 2 + a);
    g.cornerType === 1
      ? s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + a, -h / 2)
      : s.bezierCurveTo(
          -w / 2,
          -h / 2 + a - a * 0.5522847498307936,
          -w / 2 + a - a * 0.5522847498307936,
          -h / 2,
          -w / 2 + a,
          -h / 2,
        );
  }
  let geo =
    g.depth > 0
      ? new T.ExtrudeGeometry(s, {
          depth: g.depth,
          bevelEnabled: !!g.extrudeBevelSize,
          bevelSize: g.extrudeBevelSize ?? 0,
          bevelThickness: g.extrudeBevelSize ?? 0,
          bevelSegments: g.extrudeBevelSegments ?? 1,
          curveSegments: 40,
        })
      : tessellatedShape(s, 40, Tess2.WINDING_ODD);
  if (g.depth > 0 && !g.extrudeBevelSize) preciseSideNormals(geo, [s], 40);
  normalizeShapeUV(geo, {
    ...shapeUVCoordinates(s, 40),
    extruded: g.depth > 0,
  });
  if (g.depth > 0 && !g.extrudeBevelSize) {
    // Vector extrusion carries the outgoing contour-edge normal across smooth
    // joins, including the long face between two rounded corners.
    const p = geo.attributes.position,
      n = geo.attributes.normal,
      key = (i) => `${p.getX(i)},${p.getY(i)}`;
    for (const group of geo.groups.filter((q) => q.materialIndex === 1)) {
      const incoming = new Map(),
        outgoing = new Map();
      for (let i = group.start; i < group.start + group.count; i += 6) {
        const normal = [n.getX(i), n.getY(i), n.getZ(i)];
        incoming.set(key(i + 1), normal);
        outgoing.set(key(i), normal);
      }
      for (let i = group.start; i < group.start + group.count; i++) {
        const a = incoming.get(key(i)),
          b = outgoing.get(key(i));
        if (a && b && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0.95)
          n.setXYZ(i, ...b);
      }
    }
  }
  if (g.depth > 0 && !g.extrudeBevelSize) {
    geo = tessellatedSurfaces(geo, s, 40, g.depth);
    sourceWallTriangles(geo, s, 40);
  }
  if (g.shape?.points?.length) {
    geo.computeBoundingBox();
    const dims = geo.boundingBox.getSize(new T.Vector3());
    geo.scale(
      dims.x ? (g.width ?? dims.x) / dims.x : 1,
      dims.y ? (g.height ?? dims.y) / dims.y : 1,
      1,
    );
  }
  return geo;
}
export function textGeometry(g, font) {
  let text = g.text?.textValue ?? "";
  if (g.textTransform === 2) text = text.toUpperCase();
  if (g.textTransform === 3) text = text.toLowerCase();
  const size = g.fontSize ?? 12,
    width = g.width ?? Infinity,
    lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (
        line &&
        font.getAdvanceWidth(candidate, size, {
          kerning: true,
          letterSpacing: g.letterSpacing ?? 0,
        }) > width
      ) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  const shapes = [];
  const lineAdvance = size * (g.lineHeight ?? 1.2),
    metric =
      (Math.abs(font.ascender - font.descender) * size) / font.unitsPerEm,
    c = (-font.ascender * size) / font.unitsPerEm - (lineAdvance - metric) / 2,
    textHeight = lines.length * lineAdvance;
  let y =
    g.verticalAlign === 2
      ? -(g.height / 2 - textHeight / 2 - c)
      : g.verticalAlign === 3
        ? -(g.height - textHeight - c)
        : c;
  let previousGlyph;
  for (const line of lines) {
    const advance = font.getAdvanceWidth(line, size, {
        kerning: true,
        letterSpacing: g.letterSpacing ?? 0,
      }),
      align = g.horizontalAlign;
    const x =
      align === 3 ? (width - advance) / 2 : align === 2 ? width - advance : 0;
    let cursor = x;
    const commands = [];
    for (const [i, glyph] of font
      .stringToGlyphs(line, { features: { liga: true, rlig: true } })
      .entries()) {
      const factor = size / font.unitsPerEm,
        kern = previousGlyph
          ? font.getKerningValue(glyph, previousGlyph) * factor
          : 0,
        bearing = i === 0 && align === 2 ? -glyph.leftSideBearing * factor : 0;
      commands.push(
        ...glyph.getPath(cursor + kern + bearing, -y, size).commands,
      );
      cursor += glyph.advanceWidth * factor + size * (g.letterSpacing ?? 0);
      previousGlyph = glyph;
    }
    const sp = new T.ShapePath();
    for (const c of commands) {
      if (c.type === "M") sp.moveTo(c.x, -c.y);
      else if (c.type === "L") sp.lineTo(c.x, -c.y);
      else if (c.type === "C")
        sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
      else if (c.type === "Q") sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === "Z") sp.currentPath.closePath();
    }
    shapes.push(...sp.toShapes());
    y -= lineAdvance;
  }
  const parts = shapes.map((shape) => {
    let part =
      g.depth > 0
        ? new T.ExtrudeGeometry(shape, {
            depth: g.depth,
            bevelEnabled: false,
            curveSegments: 12,
          })
        : tessellatedShape(shape, 12, Tess2.WINDING_NONZERO);
    if (g.depth > 0) {
      preciseSideNormals(part, [shape], 12);
      smoothContourNormals(part, [shape], 12);
    }
    normalizeShapeUV(part, {
      ...shapeUVCoordinates(shape, 12),
      extruded: g.depth > 0,
    });
    if (g.depth > 0) {
      part = tessellatedSurfaces(part, shape, 12, g.depth);
      sourceWallTriangles(part, shape, 12);
    }
    return part;
  });
  const geo = mergeShapeParts(parts);

  geo.translate(-(g.width ?? 0) / 2, (g.height ?? 0) / 2, 0);
  return geo;
}

// Match indexed vector extrusion: smooth joins share the outgoing edge normal.
function smoothContourNormals(geo, shapes, segments) {
  const smooth = new Set(),
    holes = new Set();
  const keyPoint = (p) => `${Math.fround(p.x)},${Math.fround(p.y)}`;
  const tangent = (c, t) =>
    c
      .getPoint(Math.min(1, t + 0.0001))
      .sub(c.getPoint(Math.max(0, t - 0.0001)))
      .normalize();
  for (const shape of shapes)
    for (const path of [shape, ...shape.holes]) {
      const curves = path.curves.filter(
        (c) => c.getPoint(0).distanceToSquared(c.getPoint(1)) > 1e-16,
      );
      if (path !== shape) {
        // The reference offsets hole vertex IDs into the outer contour. IDs beyond
        // its range use the first join; the first reversed hole vertex uses its seam.
        const continuous =
          tangent(shape.curves[0], 1).dot(tangent(shape.curves[1], 0)) > 0.95;
        for (const c of curves)
          for (const point of c.getPoints(c.isLineCurve ? 1 : segments)) {
            const key = keyPoint(point);
            holes.add(key);
            if (continuous) smooth.add(key);
          }
        if (path === shape.holes[0]) {
          const points = path.getPoints(segments);
          if (points[0].equals(points[points.length - 1])) points.pop();
          const seam = keyPoint(points[points.length - 1]);
          if (
            tangent(shape.curves[shape.curves.length - 1], 1).dot(
              tangent(shape.curves[0], 0),
            ) > 0.95
          )
            smooth.add(seam);
          else smooth.delete(seam);
        }
        continue;
      }
      for (let k = 0; k < curves.length; k++) {
        const c = curves[k],
          previous = curves[(k + curves.length - 1) % curves.length];
        if (tangent(previous, 1).dot(tangent(c, 0)) > 0.95)
          smooth.add(keyPoint(c.getPoint(0)));
        if (!c.isLineCurve)
          for (let i = 1; i < segments; i++)
            smooth.add(keyPoint(c.getPoint(i / segments)));
      }
    }
  const p = geo.attributes.position,
    n = geo.attributes.normal,
    key = (i) => `${p.getX(i)},${p.getY(i)}`;
  for (const group of geo.groups.filter((q) => q.materialIndex === 1)) {
    const outgoing = new Map(),
      incoming = new Map();
    for (let i = group.start; i < group.start + group.count; i += 6) {
      const v = [n.getX(i), n.getY(i), n.getZ(i)];
      outgoing.set(key(i), v);
      incoming.set(key(i + 1), v);
    }
    for (let i = group.start; i < group.start + group.count; i++)
      if (smooth.has(key(i)) && outgoing.has(key(i)))
        n.setXYZ(i, ...(holes.has(key(i)) ? incoming : outgoing).get(key(i)));
  }
}

// Preserve double precision contour coordinates until the normals are computed.
function preciseSideNormals(geo, shapes, segments) {
  const points = new Map(),
    key = (x, y) => `${Math.fround(x)},${Math.fround(y)}`;
  for (const shape of shapes)
    for (const path of [shape, ...shape.holes])
      for (const point of path.getPoints(segments))
        points.set(key(point.x, point.y), point);
  const p = geo.attributes.position,
    n = geo.attributes.normal;
  for (const group of geo.groups.filter((q) => q.materialIndex === 1))
    for (let i = group.start; i < group.start + group.count; i += 6) {
      const a = points.get(key(p.getX(i), p.getY(i))),
        b = points.get(key(p.getX(i + 1), p.getY(i + 1)));
      if (!a || !b) continue;
      let x = b.y - a.y,
        y = a.x - b.x;
      const length = Math.hypot(x, y);
      if (!length) continue;
      x /= length;
      y /= length;
      if (x * n.getX(i) + y * n.getY(i) < 0) {
        x = -x;
        y = -y;
      }
      for (let j = i; j < i + 6; j++) n.setXYZ(j, x, y, 0);
    }
}

function mergeShapeParts(parts) {
  const geometry = new T.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const size = name === "uv" ? 2 : 3,
      total = parts.reduce(
        (sum, part) => sum + part.attributes[name].array.length,
        0,
      ),
      values = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
      values.set(part.attributes[name].array, offset);
      offset += part.attributes[name].array.length;
    }
    geometry.setAttribute(name, new T.BufferAttribute(values, size));
  }
  if (parts.length && parts.every((part) => part.index)) {
    const indices = [],
      offsets = parts.map((part) => part.attributes.position.count);
    let offset = 0;
    for (const [i, part] of parts.entries()) {
      for (const index of part.index.array) indices.push(index + offset);
      offset += offsets[i];
    }
    geometry.setIndex(indices);
  }
  for (const part of parts) part.dispose();
  return geometry;
}

// A swapped UV on the lower wall makes the quad diagonal observable.
function sourceWallTriangles(geometry, shape, segments) {
  const holes = new Set(
      shape.holes
        .flatMap((hole) => hole.getPoints(segments))
        .map((p) => `${Math.fround(p.x)},${Math.fround(p.y)}`),
    ),
    p = geometry.attributes.position;
  const indices = Array.from(
    { length: geometry.attributes.position.count },
    (_, i) => i,
  );
  for (const group of geometry.groups.filter((q) => q.materialIndex === 1))
    for (let i = group.start; i < group.start + group.count; i += 6)
      if (!holes.has(`${p.getX(i)},${p.getY(i)}`)) {
        const corners = [i + 4, i + 2, i, i + 4, i, i + 1];
        for (let j = 0; j < 6; j++) indices[i + j] = corners[j];
      }
  const walls = [],
    surfaces = [];
  for (const group of geometry.groups)
    for (let i = group.start; i < group.start + group.count; i++)
      (group.materialIndex === 1 ? walls : surfaces).push(indices[i]);
  // The reference draws walls first; the bottom surface wins equal-depth seams.
  geometry.setIndex([...walls, ...surfaces]);
  geometry.clearGroups();
}

function shapeUVCoordinates(shape, segments) {
  const contour = shape.getPoints(segments),
    points = new Map();
  for (const point of [
    ...contour,
    ...shape.holes.flatMap((hole) => hole.getPoints(segments)),
  ])
    points.set(`${Math.fround(point.x)},${Math.fround(point.y)}`, point);
  return { bounds: new T.Box2().setFromPoints(contour), points };
}

function contourPoints(path, segments) {
  const points = path
    .getPoints(segments)
    .filter(
      (p, i, list) => i === 0 || p.distanceToSquared(list[i - 1]) > 1e-18,
    );
  if (
    points.length > 1 &&
    points[0].distanceToSquared(points[points.length - 1]) < 1e-18
  )
    points.pop();
  return points;
}
function tessellatedShape(shape, segments, windingRule) {
  const contours = [shape, ...shape.holes].map((path) =>
    contourPoints(path, segments).flatMap((p) => [p.x, p.y]),
  );
  const result = Tess2.tesselate({
    contours,
    windingRule,
    elementType: Tess2.POLYGONS,
    polySize: 3,
    vertexSize: 2,
  });
  const positions = [],
    normals = [],
    uv = [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < result.vertices.length; i += 2) {
    const x = result.vertices[i],
      y = result.vertices[i + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
  }
  for (let i = 0; i < result.vertices.length; i += 2)
    uv.push(
      (result.vertices[i] - minX) / (maxX - minX) || 0,
      (result.vertices[i + 1] - minY) / (maxY - minY) || 0,
    );
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(result.elements);
  return geometry;
}

function tessellatedSurfaces(geometry, shape, segments, depth) {
  const options = {
    windingRule: Tess2.WINDING_ODD,
    elementType: Tess2.BOUNDARY_CONTOURS,
    polySize: 3,
    vertexSize: 2,
  };
  const outer = Tess2.tesselate({
    ...options,
    contours: [contourPoints(shape, segments).flatMap((p) => [p.x, p.y])],
  });
  const holeInputs = shape.holes.map((path) =>
    contourPoints(path, segments)
      .reverse()
      .flatMap((p) => [p.x, p.y]),
  );
  const holes = holeInputs.length
      ? Tess2.tesselate({ ...options, contours: holeInputs })
      : null,
    holeContours = [];
  if (holes)
    for (let i = holes.elementCount - 1; i >= 0; i--) {
      const start = holes.elements[i * 2],
        count = holes.elements[i * 2 + 1],
        contour = [];
      for (let j = start + count - 1; j >= start; j--)
        contour.push(holes.vertices[j * 2], holes.vertices[j * 2 + 1]);
      holeContours.push(contour);
    }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < outer.vertices.length; i += 2) {
    minX = Math.min(minX, outer.vertices[i]);
    maxX = Math.max(maxX, outer.vertices[i]);
    minY = Math.min(minY, outer.vertices[i + 1]);
    maxY = Math.max(maxY, outer.vertices[i + 1]);
  }
  const values = { position: [], normal: [], uv: [] };
  const vertex = (result, index, z) => {
    const x = result.vertices[index * 2],
      y = result.vertices[index * 2 + 1];
    values.position.push(x, y, z);
    values.normal.push(0, 0, z ? 1 : -1);
    values.uv.push(
      (x - minX) / (maxX - minX) || 0,
      (y - minY) / (maxY - minY) || 0,
    );
  };
  for (let i = outer.elementCount - 1; i >= 0; i--) {
    const start = outer.elements[i * 2],
      count = outer.elements[i * 2 + 1],
      contour = outer.vertices.slice(start * 2, (start + count) * 2),
      result = Tess2.tesselate({
        ...options,
        elementType: Tess2.POLYGONS,
        contours: [contour, ...holeContours],
      });
    for (let j = 0; j < result.elements.length; j += 3) {
      for (let k = 0; k < 3; k++) vertex(result, result.elements[j + k], depth);
      for (let k = 2; k >= 0; k--) vertex(result, result.elements[j + k], 0);
    }
  }
  const surfaceCount = values.position.length / 3;
  for (const group of geometry.groups.filter((q) => q.materialIndex === 1))
    for (const name of Object.keys(values)) {
      const attr = geometry.attributes[name];
      for (
        let i = group.start * attr.itemSize;
        i < (group.start + group.count) * attr.itemSize;
        i++
      )
        values[name].push(attr.array[i]);
    }
  const result = new T.BufferGeometry();
  for (const [name, array] of Object.entries(values))
    result.setAttribute(
      name,
      new T.Float32BufferAttribute(array, name === "uv" ? 2 : 3),
    );
  result.addGroup(0, surfaceCount, 0);
  result.addGroup(
    surfaceCount,
    result.attributes.position.count - surfaceCount,
    1,
  );
  geometry.dispose();
  return result;
}
