import * as T from "./vendor/three.module.js";
import { clone, merge } from "./behavior.js";
export function applyTransform(o, d) {
  o.position.fromArray(d.position ?? [0, 0, 0]);
  o.rotation.set(...(d.rotation ?? [0, 0, 0]).map(T.MathUtils.degToRad));
  o.scale.fromArray(d.scale ?? [1, 1, 1]);
  o.updateMatrix();
  if (d.hiddenMatrix)
    o.matrix.premultiply(new T.Matrix4().fromArray(d.hiddenMatrix));
  o.matrixAutoUpdate = false;
  o.matrixWorldNeedsUpdate = true;
  o.visible = d.visible !== false;
  if (o.isCamera) {
    o.zoom = d.orthographic?.zoom ?? d.perspective?.zoom ?? 1;
    o.updateProjectionMatrix();
  }
}
export function createGraph(doc) {
  const scene = new T.Scene();
  scene.matrixAutoUpdate = false;
  const records = new Map(),
    sourceNodes = new Map(),
    pages = [];
  const pending = [...doc.scene.objects];
  while (pending.length) {
    const n = pending.pop();
    sourceNodes.set(n.id, n);
    pending.push(...n.children);
  }
  const warnings = [];
  function build(raw, parent, page = null, scope = null, overrides = {}) {
    let d = merge(raw.data, overrides),
      children = raw.children ?? [],
      id = scope ? scope.prefix + "/" + raw.id : raw.id;
    if (d.type === "Instance") {
      const component = sourceNodes.get(d.component);
      if (component) {
        children = component.children;
        d.events ??= component.data.events;
        d.physics ??= component.data.physics;
        scope = { prefix: id, map: new Map() };
      } else warnings.push("Missing component " + d.component);
    }
    if (typeof d.material === "string")
      d.material = clone(
        doc.shared.materials?.[d.material] ??
          doc.shared.lib?.materials?.[d.material] ?? { layers: [] },
      );
    if (d.materials)
      d.materials = d.materials.map((m) =>
        typeof m === "string"
          ? clone(
              doc.shared.materials?.[m] ??
                doc.shared.lib?.materials?.[m] ?? { layers: [] },
            )
          : m,
      );
    const isPage = d.type === "Page";
    let o;
    if (d.type === "OrthographicCamera") {
      o = new T.OrthographicCamera(
        -960,
        960,
        540,
        -540,
        d.orthographic?.near ?? -100000,
        d.far ?? 100000,
      );
    } else if (d.type === "PerspectiveCamera") {
      o = new T.PerspectiveCamera(
        d.perspective?.fov ?? 45,
        16 / 9,
        d.perspective?.near ?? 70,
        d.far ?? 100000,
      );
    } else if (d.type === "DirectionalLight") {
      o = new T.DirectionalLight(
        new T.Color(d.color?.r ?? 1, d.color?.g ?? 1, d.color?.b ?? 1),
        (d.intensity ?? 1) * Math.PI,
      );
      o.castShadow = d.shadows ?? false;
    } else o = new T.Group();
    o.name = d.name ?? d.type;
    const record = {
      id,
      renderUUID: scope ? T.MathUtils.generateUUID() : raw.id,
      sourceId: raw.id,
      base: clone(d),
      current: clone(d),
      object: o,
      scope,
      page,
      destroyed: false,
      raw,
    };
    if (isPage) {
      page = record;
      record.page = record;
      pages.push(record);
    }
    record.templateOnly =
      parent.userData.record?.templateOnly ||
      (d.type === "Component" && !scope);
    records.set(id, record);
    if (scope) scope.map.set(raw.id, record);
    o.userData.record = record;
    parent.add(o);
    applyTransform(o, d);
    const descendants = d.overrides?.descendants ?? overrides.descendants ?? {};
    for (const child of children)
      build(child, o, page, scope, descendants[child.id] ?? {});
    return record;
  }
  for (const n of doc.scene.objects) build(n, scene);
  scene.updateMatrixWorld(true);
  return {
    scene,
    records,
    pages,
    warnings,
    resolve: (id, owner) => owner?.scope?.map.get(id) ?? records.get(id),
  };
}
