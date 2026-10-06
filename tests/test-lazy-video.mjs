import assert from "node:assert/strict";
import * as T from "../src/vendor/three.module.js";
import { makeMaterial } from "../src/materials.js";
import { videoPosters } from "../src/asset-map.js";
const loads = [],
  videos = [];
T.TextureLoader.prototype.load = (url) => {
  loads.push(url);
  return new T.Texture();
};
globalThis.document = {
  createElement() {
    const el = new EventTarget();
    Object.assign(el, {
      readyState: 0,
      plays: 0,
      play() {
        this.plays++;
        return Promise.resolve();
      },
    });
    videos.push(el);
    return el;
  },
};
for (const [url, poster] of Object.entries(videoPosters)) {
  const map = new Map(),
    m = makeMaterial(
      {
        layers: [{ id: url, data: { type: "video", texture: { video: url } } }],
      },
      {},
      {},
      new T.LoadingManager(),
      map,
      {},
    ),
    el = videos.at(-1),
    initial = m.map;
  assert.equal(el.src, undefined);
  assert.equal(el.preload, "none");
  assert.ok(loads.includes(poster));
  assert.ok(!initial.isVideoTexture);
  await el.play();
  assert.equal(el.src, url);
  assert.equal(el.plays, 1);
  el.readyState = 2;
  el.dispatchEvent(new Event("loadeddata"));
  assert.ok(m.map.isVideoTexture);
  assert.notEqual(m.map, initial);
  m.dispose();
}
console.log(
  "All three videos: no source before play; poster at startup; original URL and video texture activate on play/readiness.",
);
