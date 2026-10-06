// Spline schema 115: one centered transform, applied to raw geometry UV.
export function centeredTextureUV(uv, spec = {}) {
  const repeat = spec.repeat ?? [1, 1],
    offset = spec.offset ?? [0, 0],
    r = ((spec.rotation ?? 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  const x = (uv[0] * 2 - 1) * repeat[0] + offset[0],
    y = (uv[1] * 2 - 1) * repeat[1] + offset[1];
  return [0.5 + 0.5 * (c * x - s * y), 0.5 + 0.5 * (s * x + c * y)];
}
export function centeredTextureGLSL(rawUV, spec = {}) {
  const repeat = spec.repeat ?? [1, 1],
    offset = spec.offset ?? [0, 0],
    r = ((spec.rotation ?? 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    f = (x) => Number(x).toFixed(12);
  return `(vec2(0.5)+0.5*mat2(${f(c)},${f(s)},${f(-s)},${f(c)})*(((${rawUV})*2.0-1.0)*vec2(${f(repeat[0])},${f(repeat[1])})+vec2(${f(offset[0])},${f(offset[1])})))`;
}
export function normalizeShapeUV(
  geometry,
  { bounds, points, extruded = false } = {},
) {
  geometry.computeBoundingBox();
  const { min, max } = bounds ?? geometry.boundingBox,
    positions = geometry.attributes.position,
    uv = geometry.attributes.uv;
  if (!uv) return geometry;
  const w = max.x - min.x,
    h = max.y - min.y;
  const low = geometry.boundingBox.min.z;
  for (let i = 0; i < positions.count; i++) {
    const point = points?.get(`${positions.getX(i)},${positions.getY(i)}`),
      px = point?.x ?? positions.getX(i),
      py = point?.y ?? positions.getY(i);
    const x = w ? (px - min.x) / w : 0,
      y = h ? (py - min.y) / h : 0;
    if (
      extruded &&
      positions.getZ(i) === low &&
      Math.abs(geometry.attributes.normal.getZ(i)) < 1
    )
      uv.setXY(i, y, x);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  return geometry;
}
