import * as T from "./vendor/three.module.js";
import { Behavior, clone, easing, equalJSON } from "./behavior.js";
import { createGraph, applyTransform } from "./graph.js";
import { makeMaterial, color, resolveAsset } from "./materials.js";
import { Post } from "./post.js";
import { objectColor } from "./outline.js";
import { loadGeometryPack } from "./geometry-pack.js";
import { RoomOrbit } from "./orbit.js";
import { ScenePicker, acceleratePicking } from "./picking.js";

let renderVersion = 0,
  remainingFrames = 32;
function invalidate() {
  remainingFrames = 32;
}
const $ = (s) => document.querySelector(s),
  status = $("#status"),
  canvas = $("#canvas3d") ?? $("canvas"),
  warningList = [];
const warn = (text) => {
  if (!warningList.includes(text)) warningList.push(text);
  console.warn(text);
};
const packedGeometry = await loadGeometryPack(),
  doc = window.__ROOM_DOCUMENT__ ?? packedGeometry.document;
const graph = createGraph(doc),
  { scene, records, pages, resolve } = graph;
graph.warnings.forEach(warn);
const renderer = new T.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: true,
  stencil: false,
  depth: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(devicePixelRatio);
renderer.outputColorSpace = T.LinearSRGBColorSpace;
renderer.toneMapping = T.NoToneMapping;
if ("drawingBufferColorSpace" in renderer.getContext()) {
  try {
    renderer.getContext().drawingBufferColorSpace = "display-p3";
  } catch {}
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const post = new Post(renderer),
  geometryCache = new Map(),
  videoMap = new Map(),
  audioMap = new Map(),
  manager = new T.LoadingManager();
manager.onLoad = () => {
  invalidate();
};
manager.onError = (url) => warn("Could not load " + url);
const CTORS = {
  Float32Array,
  Float64Array,
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
};
async function attributeArray(a) {
  return packedGeometry.array(a, CTORS[a.type] ?? Float32Array);
}
async function geometry(file) {
  if (!geometryCache.has(file))
    geometryCache.set(
      file,
      (async () => {
        const spec = packedGeometry.geometries[file];
        if (!spec) throw Error("Geometry is missing from the bundle: " + file);
        const g = new T.BufferGeometry();
        await Promise.all(
          Object.entries(spec.attributes).map(async ([name, a]) => {
            g.setAttribute(
              name,
              new T.BufferAttribute(
                await attributeArray(a),
                a.itemSize,
                a.normalized,
              ),
            );
          }),
        );
        g.morphTargetsRelative = spec.morphTargetsRelative ?? false;
        await Promise.all(
          Object.entries(spec.morphAttributes ?? {}).map(
            async ([name, list]) => {
              g.morphAttributes[name] = await Promise.all(
                list.map(async (a) => {
                  const attr = new T.BufferAttribute(
                    await attributeArray(a),
                    a.itemSize,
                    a.normalized,
                  );
                  attr.name = a.name ?? "";
                  return attr;
                }),
              );
            },
          ),
        );
        if (spec.index)
          g.setIndex(
            new T.BufferAttribute(await attributeArray(spec.index), 1),
          );
        for (const group of spec.groups ?? [])
          g.addGroup(group.start, group.count, group.materialIndex);
        g.boundingBox = new T.Box3(
          new T.Vector3().fromArray(spec.bounds[0]),
          new T.Vector3().fromArray(spec.bounds[1]),
        );
        if (spec.sphere)
          g.boundingSphere = new T.Sphere(
            new T.Vector3().fromArray(spec.sphere[0]),
            spec.sphere[1],
          );
        else g.computeBoundingSphere();
        return g;
      })(),
    );
  return geometryCache.get(file);
}
function materials(record) {
  const d = record.current;
  return (d.materials ?? [d.material ?? { layers: [] }]).map((source) => {
    const m = makeMaterial(source, d, doc.shared, manager, videoMap, post);
    m.userData.roomObjectID = {
      value: objectColor(record.renderUUID ?? record.id).x,
    };
    return m;
  });
}
let loaded = 0;
await Promise.all(
  [...records.values()]
    .filter((r) => r.current._geometry)
    .map((r) => geometry(r.current._geometry)),
);
for (const record of records.values()) {
  const d = record.current;
  if (d._geometry) {
    const g = await geometry(d._geometry),
      m = materials(record);
    for (const material of m)
      material.userData.roomObjectID = {
        value: objectColor(record.renderUUID ?? record.id).x,
      };
    const mesh = new T.Mesh(g, m.length === 1 ? m[0] : m);
    mesh.name = record.object.name;
    mesh.matrixAutoUpdate = false;
    mesh.visible = true;
    mesh.castShadow = d.castShadow ?? true;
    mesh.receiveShadow = d.receiveShadow ?? true;
    mesh.userData.record = record;
    mesh.userData.geometryDimensions = clone(d.geometry);
    record.object.add(mesh);
    record.mesh = acceleratePicking(mesh);
  }
  if (record.object.isDirectionalLight) {
    const target = new T.Object3D();
    target.position.set(0, 0, 0);
    scene.add(target);
    record.object.target = target;
    const shadow = record.object.shadow;
    shadow.mapSize.set(d.shadowResolution ?? 1024, d.shadowResolution ?? 1024);
    const size = d.size ?? 2500;
    shadow.camera.left = -size / 2;
    shadow.camera.right = size / 2;
    shadow.camera.top = size / 2;
    shadow.camera.bottom = -size / 2;
    shadow.camera.near = -10000;
    shadow.camera.far = d.depth ?? 2500;
    shadow.radius = d.shadowRadius ?? 1;
  }
  loaded++;
  status.textContent = `Preparing room · ${Math.round((loaded / records.size) * 100)}%`;
}
let activePage = null,
  camera = null,
  engine,
  started = false,
  cameraAnimation = null,
  orbit = null,
  orbitControl = null;
const ambient = new T.HemisphereLight(
  new T.Color(1, 1, 1),
  new T.Color().setHex(0x828282, T.LinearSRGBColorSpace),
  1,
);
scene.add(ambient);
function isVisible(record) {
  if (record.destroyed || record.templateOnly || record.page !== activePage)
    return false;
  let o = record.object;
  while (o && o !== scene) {
    if (!o.visible || o.userData.record?.current.raycastLock) return false;
    o = o.parent;
  }
  return true;
}
function transformSignature(o) {
  return [
    ...o.matrix.elements,
    o.position.x,
    o.position.y,
    o.position.z,
    o.quaternion.x,
    o.quaternion.y,
    o.quaternion.z,
    o.quaternion.w,
    o.scale.x,
    o.scale.y,
    o.scale.z,
    o.visible,
    o.isCamera ? o.zoom : null,
  ];
}
function apply(record, data, anim) {
  // Repeated authored states can keep ticking without restarting GPU settling.
  // Direct edits to the object transform defeat this check and are reapplied.
  if (
    anim &&
    record.lastAppliedTransform &&
    equalJSON(
      data.name === record.current.name
        ? data
        : { ...data, name: record.current.name },
      record.current,
    )
  ) {
    const signature = transformSignature(record.object);
    if (
      signature.every((v, i) => Object.is(v, record.lastAppliedTransform[i]))
    ) {
      if (data.name !== record.current.name) record.current = clone(data);
      return;
    }
  }
  invalidate();
  if (record.object === camera) orbitControl = null;
  const old = record.current;
  record.current = clone(data);
  applyTransform(record.object, data);
  record.lastAppliedTransform = transformSignature(record.object);

  if (record.mesh) {
    if (
      JSON.stringify(data.material ?? data.materials) !==
      JSON.stringify(old.material ?? old.materials)
    ) {
      const m = materials(record),
        oldm = Array.isArray(record.mesh.material)
          ? record.mesh.material
          : [record.mesh.material];
      record.mesh.material = m.length === 1 ? m[0] : m;
      oldm.forEach((m) => m.dispose());
    }
    if (data.geometry && old.geometry) {
      const original =
        record.mesh.userData.geometryDimensions ?? record.base.geometry;
      const scale = ["width", "height", "depth"].map((k) =>
        original[k] ? (data.geometry[k] ?? original[k]) / original[k] : 1,
      );
      if (
        record.mesh.scale.x !== scale[0] ||
        record.mesh.scale.y !== scale[1] ||
        record.mesh.scale.z !== scale[2]
      ) {
        record.mesh.scale.fromArray(scale);
        record.mesh.updateMatrix();
      }
    }
  }
}
function setCamera(record) {
  invalidate();
  if (!record?.object.isCamera) {
    warn("Camera unavailable");
    return;
  }
  camera = record.object;
  cameraAnimation = null;
  orbitControl = null;
}
function startEvents() {
  for (const r of records.values())
    if (isVisible(r))
      for (const e of r.current.events ?? [])
        if (e.data.type === "Start") engine.event(r, e);
}
function selectPage(id) {
  invalidate();
  const page = records.get(id);
  if (!page || page.current.type !== "Page") {
    warn("Missing page " + id);
    return;
  }
  if (page !== activePage) {
    for (const r of records.values())
      if (r.page === page) {
        r.destroyed = false;
        apply(r, r.base);
      }
    if (engine)
      for (const key of engine.flags.keys()) {
        const owner = records.get(key.split(":")[0]);
        if (owner?.page === page) engine.flags.delete(key);
      }
  }
  if (activePage && engine) engine.cancelPage(activePage);
  activePage = page;
  for (const p of pages) p.object.visible = p === page;
  const d = page.current;
  scene.background = color(d.backgroundColor, doc.shared, 0x222222);
  ambient.color.copy(color(d.ambient?.color, doc.shared));
  ambient.intensity = d.ambient?.enabled
    ? (d.ambient.intensity ?? 1) * Math.PI
    : 0;
  if (d.fog?.enabled)
    scene.fog = new T.Fog(
      color(
        d.fog.useBackgroundColor ? d.backgroundColor : d.fog.color,
        doc.shared,
      ),
      d.fog.near,
      d.fog.far,
    );
  else scene.fog = null;
  let cam = resolve(d.publish?.playCamera, page);
  if (!cam) {
    const fallback = {
      ...d.camera,
      type: d.camera?.type ?? "OrthographicCamera",
    };
    const obj = new T.OrthographicCamera(
      -960,
      960,
      540,
      -540,
      fallback.orthographic?.near ?? -100000,
      fallback.far ?? 100000,
    );
    applyTransform(obj, fallback);
    page.object.add(obj);
    cam = { object: obj };
  }
  setCamera(cam);
  if (started) startEvents();
}
const host = {
  resolve,
  warn,
  pageOf: (r) => r.page,
  isDestroyed: (r) => r.destroyed,
  apply,
  selectPage,
  destroy: (r) => {
    if (r) {
      invalidate();
      r.destroyed = true;
      r.object.visible = false;
    }
  },
  link: (a) => {
    if (!a.url) return;
    if (/^(javascript|data):/i.test(a.url)) {
      warn("Unsupported link scheme");
      return;
    }
    if (a.context === "tab") window.open(a.url, "_blank", "noopener");
    else window.location.assign(a.url);
  },
  media: (a, owner) => {
    let el;
    if (a.type === "Audio") {
      const url = resolveAsset(a.audio, doc.shared);
      if (!url) {
        warn("Missing audio");
        return;
      }
      if (!audioMap.has(url)) {
        const audio = new Audio(url);
        audio.preload = "auto";
        audioMap.set(url, audio);
      }
      el = audioMap.get(url);
    } else el = videoMap.get(a.layerId);
    if (!el) {
      warn("Missing " + a.type + " resource " + (a.layerId ?? ""));
      return;
    }
    el.volume = Math.max(0, Math.min(1, a.volume ?? 1));
    el.loop = a.loop === -1 || a.loop === true;
    const operation = a.interaction ?? "play";
    if (operation === "pause") el.pause();
    else if (operation === "stop") {
      el.pause();
      el.currentTime = 0;
    } else if (operation === "toggle") {
      if (el.paused)
        el.play().catch(() => warn("Playback requires a browser gesture"));
      else el.pause();
    } else {
      el.currentTime = 0;
      el.play().catch(() => warn("Playback requires a browser gesture"));
    }
  },
  switchCamera: (a, owner) => {
    const target = resolve(a.targetCamera, owner);
    if (!target?.object.isCamera) {
      warn("Missing camera " + a.targetCamera);
      return;
    }
    if (!a.animate) {
      setCamera(target);
      return;
    }
    const from = {
        position: camera.position.clone(),
        rotation: camera.quaternion.clone(),
        zoom: camera.zoom,
      },
      dest = {
        position: target.object.position.clone(),
        rotation: target.object.quaternion.clone(),
        zoom: target.object.zoom,
      };
    camera = target.object;
    cameraAnimation = {
      from,
      dest,
      target,
      start: null,
      duration: a.duration ?? 1000,
      spec: a,
    };
  },
};
engine = new Behavior(host);
selectPage(doc.scene.publish.playPage);
scene.updateMatrixWorld(true);
const picker = new ScenePicker(),
  raycaster = new T.Raycaster(),
  pointer = new T.Vector2(),
  hovered = new Set();
let lastPointer = {};
function hits(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    (-(event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);
  const intersects = picker.intersect(activePage.object, raycaster, isVisible);
  const set = new Set();
  for (const hit of doc.scene.publish.stopRaycast
    ? intersects.slice(0, 1)
    : intersects) {
    let o = hit.object;
    while (o && o !== scene) {
      const r = o.userData.record;
      if (r) set.add(r);
      o = o.parent;
    }
  }
  return set;
}
canvas.addEventListener("pointermove", (event) => {
  invalidate();
  lastPointer = event;
  for (const r of lookAtRecords) r.lookAtResetPaused = false;
  const set = hits(event);
  for (const r of set)
    if (!hovered.has(r))
      for (const e of r.current.events ?? [])
        if (e.data.type === "MouseHover") engine.event(r, e, true);
  for (const r of hovered)
    if (!set.has(r))
      for (const e of r.current.events ?? [])
        if (e.data.type === "MouseHover") engine.event(r, e, false);
  hovered.clear();
  set.forEach((r) => hovered.add(r));
  canvas.style.cursor = [...set].some((r) =>
    (r.current.events ?? []).some((e) => e.data.type === "MouseDown"),
  )
    ? "pointer"
    : "default";
  if (orbit && event.pointerId === orbit.pointerId) {
    const dx = event.clientX - orbit.x,
      dy = event.clientY - orbit.y;
    orbit.x = event.clientX;
    orbit.y = event.clientY;
    if (
      !orbit.moved &&
      Math.hypot(event.clientX - orbit.startX, event.clientY - orbit.startY) > 4
    ) {
      orbit.moved = true;
      cameraAnimation = null;
      engine.animations.delete(camera.userData.record?.id);
      orbit.control = orbitControl ??= new RoomOrbit(
        camera,
        doc.scene.publish.orbitControls,
      );
    }
    if (orbit.moved) {
      orbit.control.move(dx, dy, canvas.getBoundingClientRect().height);
      event.preventDefault();
    }
  }
});
canvas.addEventListener("pointerleave", () => {
  invalidate();
  lastPointer = null;
  for (const r of lookAtRecords) r.lookAtResetPaused = false;
  if (started) {
    scene.updateMatrixWorld(true);
    updateLookAt();
  }
  for (const r of hovered)
    for (const e of r.current.events ?? [])
      if (e.data.type === "MouseHover") engine.event(r, e, false);
  hovered.clear();
});
function clickScene(set) {
  for (const r of records.values())
    if (isVisible(r))
      for (const e of r.current.events ?? [])
        if (
          e.data.type === "MouseDown" &&
          (e.data.mode === "Canvas" || set.has(r))
        )
          engine.event(r, e);
}
canvas.addEventListener("pointerdown", (event) => {
  if (!started || orbit || event.button > 0) return;
  invalidate();
  lastPointer = event;
  for (const r of lookAtRecords) r.lookAtResetPaused = false;
  const set = hits(event);
  if (doc.scene.publish.orbitControls.enableRotate) {
    orbit = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      set,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
  } else clickScene(set);
});
function endDrag(event, cancel = false) {
  if (!orbit || event.pointerId !== orbit.pointerId) return;
  const gesture = orbit;
  orbit = null;
  if (canvas.hasPointerCapture?.(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  if (!cancel && !gesture.moved) clickScene(gesture.set);
}
canvas.addEventListener("pointerup", (event) => endDrag(event));
canvas.addEventListener("pointercancel", (event) => endDrag(event, true));
canvas.addEventListener("lostpointercapture", (event) => endDrag(event, true));
canvas.style.touchAction = "none";
const lookAtRecords = [...records.values()].filter((r) =>
  (r.current.events ?? []).some((e) => e.data.type === "LookAt"),
);
for (const r of lookAtRecords)
  r.initialQuaternion = r.object.getWorldQuaternion(new T.Quaternion());
function polarRotation(matrix) {
  const r = new T.Matrix3().setFromMatrix4(matrix);
  for (let i = 0; i < 32; i++) {
    const inverse = r.clone().invert().transpose();
    let difference = 0;
    for (let j = 0; j < 9; j++) {
      const value = 0.5 * (r.elements[j] + inverse.elements[j]);
      difference = Math.max(difference, Math.abs(value - r.elements[j]));
      r.elements[j] = value;
    }
    if (difference < 1e-12) break;
  }
  const e = r.elements;
  return new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().set(
      e[0],
      e[3],
      e[6],
      0,
      e[1],
      e[4],
      e[7],
      0,
      e[2],
      e[5],
      e[8],
      0,
      0,
      0,
      0,
      1,
    ),
  );
}
function updateLookAt() {
  for (const r of lookAtRecords) {
    if (!isVisible(r) || r.lookAtResetPaused) continue;
    const spec = r.current.events.find((e) => e.data.type === "LookAt").data;
    if (spec.disabled || (!lastPointer && spec.resetOnPointerLeave === false))
      continue;
    let desired = r.initialQuaternion;
    if (lastPointer) {
      const p = r.object.getWorldPosition(new T.Vector3()),
        normal = camera.getWorldDirection(new T.Vector3()).negate(),
        plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, p),
        point = raycaster.ray.intersectPlane(plane, new T.Vector3());
      if (point) {
        if ((spec.distance ?? 1000) > 0)
          point.addScaledVector(normal, spec.distance ?? 1000);
        const matrix = new T.Matrix4().lookAt(point, p, new T.Vector3(0, 1, 0));
        desired = new T.Quaternion().setFromRotationMatrix(matrix);
      }
    }
    const before = r.object.quaternion.clone(),
      current = polarRotation(r.object.matrixWorld),
      world = current.slerp(
        desired,
        1 /
          (lastPointer
            ? (spec.dampingFactor ?? 1)
            : 80 / (spec.resetSpeed ?? 5) + 1),
      );
    r.lookAtResetPaused = 8 * (1 - world.dot(desired)) < 1e-6;
    const parent = r.object.parent.matrixWorld.clone();
    if (r.current.hiddenMatrix)
      parent.multiply(new T.Matrix4().fromArray(r.current.hiddenMatrix));
    r.object.quaternion.copy(polarRotation(parent).invert().multiply(world));
    r.object.updateMatrix();
    if (r.current.hiddenMatrix)
      r.object.matrix.premultiply(
        new T.Matrix4().fromArray(r.current.hiddenMatrix),
      );
    r.object.matrixWorldNeedsUpdate = true;
    if (8 * (1 - Math.abs(before.dot(r.object.quaternion))) > 1e-12)
      invalidate();
  }
}

function resize() {
  invalidate();
  const w = innerWidth,
    h = innerHeight,
    frame = Object.values(doc.frames ?? {})[0];
  const [renderWidth, renderHeight] =
    frame && frame.preset !== "fullscreen" ? frame.size : [w, h];
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  renderer.setSize(renderWidth, renderHeight, false);
  for (const r of records.values()) {
    const o = r.object;
    if (o.isOrthographicCamera) {
      o.left = -renderWidth / 2;
      o.right = renderWidth / 2;
      o.top = renderHeight / 2;
      o.bottom = -renderHeight / 2;
      o.updateProjectionMatrix();
    } else if (o.isPerspectiveCamera) {
      o.aspect = renderWidth / renderHeight;
      o.updateProjectionMatrix();
    }
  }
  const ratio = renderer.getPixelRatio();
  post.resize(
    Math.round(renderWidth * ratio),
    Math.round(renderHeight * ratio),
  );
}
addEventListener("resize", resize);
resize();
let origin = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (started) engine.tick(now - origin);
  const playingVideo = [...videoMap.values()].some(
      (el) => !el.paused && !el.ended,
    ),
    lookAtActive =
      started &&
      lookAtRecords.some((r) => isVisible(r) && !r.lookAtResetPaused);
  if (remainingFrames > 0 || playingVideo || cameraAnimation || lookAtActive)
    scene.updateMatrixWorld();
  if (lookAtActive) updateLookAt();
  if (cameraAnimation) {
    invalidate();
    const a = cameraAnimation;
    a.start ??= engine.now;
    const t = Math.min(1, (engine.now - a.start) / Math.max(1, a.duration)),
      u = easing(t, a.spec);
    camera.position.lerpVectors(a.from.position, a.dest.position, u);
    camera.quaternion.slerpQuaternions(a.from.rotation, a.dest.rotation, u);
    camera.zoom = a.from.zoom + (a.dest.zoom - a.from.zoom) * u;
    camera.updateProjectionMatrix();
    camera.updateMatrix();
    if (a.target.current.hiddenMatrix)
      camera.matrix.premultiply(
        new T.Matrix4().fromArray(a.target.current.hiddenMatrix),
      );
    camera.matrixWorldNeedsUpdate = true;
    camera.updateMatrixWorld();
    if (t === 1) setCamera(a.target);
  }
  if (remainingFrames > 0 || playingVideo) {
    post.render(scene, camera, activePage?.current);
    renderVersion++;
    remainingFrames = Math.max(0, remainingFrames - 1);
  }
}
canvas.addEventListener("webglcontextrestored", invalidate);
for (const video of videoMap.values())
  for (const event of ["loadeddata", "seeked", "play", "pause", "ended"])
    video.addEventListener(event, invalidate);
requestAnimationFrame(frame);
$("#enter").disabled = false;
$("#enter").textContent = "Enter room";
status.textContent = "Room ready";
function start() {
  if (started) return;
  started = true;
  origin = performance.now();
  $("#cover").hidden = true;
  startEvents();
}
$("#enter").onclick = start;
window.room = {
  start,
  post,
  doc,
  graph,
  engine,
  renderer,
  invalidate,
  get renderVersion() {
    return renderVersion;
  },
  get camera() {
    return camera;
  },
  get page() {
    return activePage;
  },
  warnings: warningList,
  selectPage,
  apply,
  setCamera,
  coverage: {
    storedNodes: 783,
    instantiatedNodes: records.size,
    geometries: loaded,
  },
};
