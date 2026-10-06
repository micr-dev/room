import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
for (const file of [
  "index.html",
  "room.compact.gz",
  "tree/index.html",
  "wip/index.html",
  "about/llms.txt",
  "favicons/favicon.ico",
  "robots.txt",
  "sitemap.xml",
  ".well-known/security.txt",
])
  assert.ok(fs.existsSync("public/" + file), file);
for (const file of [
  "room.bundle.gz",
  "room.json",
  "scene.json",
  "geometry-pack.json",
  "scene.splinecode",
  "runtime.js",
])
  assert.ok(!fs.existsSync("public/" + file), file);
const html = fs.readFileSync("public/index.html", "utf8");
assert.ok(!fs.existsSync("public/editor.css"));
for (const id of [
  "edit",
  "editor",
  "page",
  "camera",
  "outlines",
  "search",
  "object-json",
  "apply",
  "download",
  "reset",
  "edit-result",
])
  assert.ok(!html.includes(`id="${id}"`), `editor control ${id} removed`);
for (const m of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))
  assert.ok(fs.existsSync("public/" + m[1]), m[1]);
const outputs = JSON.parse(
  fs.readFileSync(".cache/runtime-build.json"),
).outputs;
for (const [name, item] of Object.entries(outputs)) {
  assert.ok(fs.existsSync("public/" + name.slice(7)));
  for (const i of item.imports)
    if (!i.external)
      assert.ok(fs.existsSync("public/" + i.path.slice(7)), i.path);
}
assert.ok(!html.includes("scene.splinecode"));
assert.ok(!html.includes('id="loader"'));
for (const content of [
  html,
  ...Object.keys(outputs).map((name) => fs.readFileSync(name, "utf8")),
]) {
  assert.ok(!content.includes("load-time"), "public timing overlay removed");
  assert.ok(
    !content.includes("editor.css"),
    "public editor stylesheet removed",
  );
  assert.ok(!content.includes("Edit scene"), "public editor control removed");
  assert.ok(!content.includes('id="editor"'), "public editor panel removed");
  assert.ok(!content.includes("First frame"), "public timing text removed");
  assert.ok(!content.includes("URLSearchParams(location.search)"));
}
assert.ok(!Object.keys(outputs).some((name) => name.includes("edit-geometry")));
assert.ok(!Object.keys(outputs).some((name) => name.includes("opentype")));
const vercel = JSON.parse(fs.readFileSync("vercel.json"));
assert.equal(vercel.outputDirectory, "public");
for (const rule of vercel.redirects.filter((r) =>
  ["/", "/:match*"].includes(r.source),
)) {
  const pattern = new RegExp("^(?:" + rule.has[0].value + ")$");
  assert.ok(pattern.test("micr.dev"));
  assert.ok(pattern.test("www.micr.dev"));
  assert.ok(!pattern.test("room.micr.dev"));
}
console.log(
  "Public entry/modules/model, preserved auxiliary routes, excluded conversion/Spline inputs and apex redirect scope passed.",
);

for (const code of [html, fs.readFileSync("public/run.js", "utf8")]) {
  for (const match of code.matchAll(
    /(?:new Audio\(|ZIP_PATH\s*=\s*)["']([^"']+)["']/g,
  )) {
    const pathname = new URL(match[1], "https://room.test/index.html").pathname;
    assert.ok(fs.existsSync("public" + pathname), match[1]);
  }
}
