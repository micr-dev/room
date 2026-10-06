import fs from "node:fs";
import path from "node:path";

fs.rmSync("public", { recursive: true, force: true });
fs.mkdirSync("public");
fs.copyFileSync("src/style.css", "public/style.css");
fs.cpSync("assets/runtime", "public/assets", { recursive: true });
fs.copyFileSync("assets/models/room.compact.gz", "public/room.compact.gz");
if (fs.existsSync("assets/static"))
  fs.cpSync("assets/static", "public", { recursive: true });
for (const name of [
  "tree",
  "wip",
  "about",
  "favicons",
  "fonts",
  ".well-known",
  "robots.txt",
  "sitemap.xml",
  "humans.txt",
]) {
  if (fs.existsSync(name))
    fs.cpSync(name, path.join("public", name), { recursive: true });
}
// The console animation imports fflate at runtime, independently of the application bundle.
fs.copyFileSync("src/run.js", "public/run.js");
fs.mkdirSync("public/vendor", { recursive: true });
fs.copyFileSync("src/vendor/fflate.js", "public/vendor/fflate.js");
console.log("Staged static assets and auxiliary routes in public/");
