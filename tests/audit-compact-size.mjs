import { loadScene } from "./scene-fixture.mjs";
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { optimizedImages, videoPosters } from "../src/asset-map.js";
const doc = JSON.stringify(loadScene()),
  images = new Set(
    [...doc.matchAll(/assets\/[a-f0-9]+\.(?:png|jpg|jpeg|webp)/g)].map(
      (m) => optimizedImages[m[0]] ?? m[0],
    ),
  );
for (const p of Object.values(videoPosters)) images.add(p);
const imageRows = [...images]
    .map((file) => ({
      file,
      bytes: fs.statSync("assets/runtime/" + file.slice(7)).size,
    }))
    .sort((a, b) => b.bytes - a.bytes),
  meta = JSON.parse(fs.readFileSync(".cache/runtime-build.json")),
  code = Object.entries(meta.outputs)
    .filter(([, v]) => v.entryPoint !== "src/vendor/fflate.js")
    .map(([file]) => ({
      file,
      raw: fs.statSync(file).size,
      gzipEstimate: gzipSync(fs.readFileSync(file)).length,
    })),
  modelBytes = fs.statSync("assets/models/room.compact.gz").size,
  imageBytes = imageRows.reduce((s, r) => s + r.bytes, 0),
  codeGzipEstimate = code.reduce((s, r) => s + r.gzipEstimate, 0),
  geometry = JSON.parse(
    fs.readFileSync("docs/verification/compact-geometry-results.json"),
  );
const report = {
  scope:
    "Decimal bytes. All document images and all posters, not a browser waterfall. Runtime gzip is an estimate dependent on HTTP compression. HTML/CSS/headers excluded. Deferred video/audio/fonts excluded.",
  modelBytes,
  imageBytes,
  codeGzipEstimate,
  initialEstimatedBytes: modelBytes + imageBytes + codeGzipEstimate,
  images: imageRows,
  code,
  largestGeometryByRemainingVertices: geometry.rows
    .toSorted((a, b) => b.afterVertices - a.afterVertices)
    .slice(0, 12),
};
fs.writeFileSync(
  "docs/verification/compact-size-budget.json",
  JSON.stringify(report, null, 2),
);
console.log({
  modelBytes,
  imageBytes,
  codeGzipEstimate,
  initialEstimatedBytes: report.initialEstimatedBytes,
});
