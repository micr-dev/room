// Cache the normal/ID prepass only while every draw-affecting input is exact.
export class NormalCache {
  constructor() {
    this.snapshot = [];
    this.valid = false;
  }
  invalidate() {
    this.valid = false;
  }
  changed(scene, camera, entries) {
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate)
      camera.updateMatrixWorld();
    let cursor = 0,
      changed = !this.valid;
    const values = this.snapshot;
    const value = (x) => {
      if (values[cursor] !== x) {
        changed = true;
        values[cursor] = x;
      }
      cursor++;
    };
    const array = (a) => {
      value(a?.length ?? 0);
      if (a) for (const x of a) value(x);
    };
    value(camera);
    value(camera.layers.mask);
    array(camera.matrixWorld.elements);
    array(camera.projectionMatrix.elements);
    value(camera.near);
    value(camera.far);
    value(scene.overrideMaterial);
    for (const entry of entries) {
      const o = entry.object,
        mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.some((m) => m.userData.outline)) continue;
      value(o);
      array(o.matrixWorld.elements);
      value(o.renderOrder);
      value(o.frustumCulled);
      value(o.layers.mask);
      for (let parent = o.parent; parent; parent = parent.parent) {
        value(parent);
        value(parent.renderOrder);
      }
      value(null);
      const g = o.geometry;
      value(g);
      value(g.drawRange.start);
      value(g.drawRange.count);
      value(g.groups.length);
      for (const group of g.groups) {
        value(group.start);
        value(group.count);
        value(group.materialIndex);
      }
      // Identity/version changes cover replacements and BufferAttribute.needsUpdate.
      const attribute = (a) => {
        value(a);
        if (a) {
          value(a.version);
          value(a.data?.version);
          value(a.count);
          value(a.itemSize);
          value(a.normalized);
        }
      };
      attribute(g.index);
      for (const [name, a] of Object.entries(g.attributes)) {
        value(name);
        attribute(a);
      }
      value(null);
      for (const [name, list] of Object.entries(g.morphAttributes)) {
        value(name);
        value(list.length);
        for (const a of list) attribute(a);
      }
      value(null);
      array(o.morphTargetInfluences);
      value(g.morphTargetsRelative);
      const sphere = g.boundingSphere;
      value(sphere);
      if (sphere) {
        value(sphere.center.x);
        value(sphere.center.y);
        value(sphere.center.z);
        value(sphere.radius);
      }
      value(mats.length);
      for (const m of mats) {
        value(m);
        value(m.version);
        value(m.visible);
        value(m.transparent);
        value(m.depthTest);
        value(m.depthWrite);
        value(m.side);
        value(m.blending);
      }
      value(entry.normalColor.x);
      value(entry.normalColor.y);
      value(entry.normalColor.z);
    }
    if (values.length !== cursor) {
      changed = true;
      values.length = cursor;
    }
    this.valid = true;
    return changed;
  }
}
