import fs from "node:fs";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/startup.js"],
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  target: "es2022",
  external: ["fs"],
  outdir: "public/runtime",
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  metafile: true,
});
fs.mkdirSync(".cache", { recursive: true });
fs.writeFileSync(
  ".cache/runtime-build.json",
  JSON.stringify(result.metafile, null, 2),
);
const outputs = Object.entries(result.metafile.outputs);
const entry = outputs.find(
  ([, item]) => item.entryPoint === "src/startup.js",
)[0];
const app = outputs.find(([, item]) => item.entryPoint === "src/app.js")[0];
let html = fs.readFileSync("src/index.html", "utf8");
html = html.replace(
  /<script type="module" src="\.\/(?:startup\.js|runtime\/startup-[^"]+)"><\/script>/,
  `<script type="module" src="./${entry.slice(7)}"></script>`,
);
html = html.replace(
  /<link rel="modulepreload" href="\.\/(?:app\.js|runtime\/chunk-[^"]+)"\s*\/?>/g,
  "",
);
html = html.replace(
  "</head>",
  `<link rel="modulepreload" href="./${app.slice(7)}"></head>`,
);
fs.writeFileSync("public/index.html", html);
console.log("Bundled", entry);
