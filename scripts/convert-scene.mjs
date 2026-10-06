import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { unzipSync } from "../src/vendor/fflate.js";

const workspace = ".cache/conversion";
fs.mkdirSync(`${workspace}/qa`, { recursive: true });
const files = unzipSync(
  new Uint8Array(fs.readFileSync("assets/source/conversion-inputs.zip")),
);
for (const [name, bytes] of Object.entries(files)) {
  if (name.startsWith("/") || name.split("/").includes(".."))
    throw Error("Unsafe conversion archive path");
  const file = path.join(workspace, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
fs.cpSync("assets/runtime", `${workspace}/dist/assets`, { recursive: true });
fs.copyFileSync(
  "assets/source/room.bundle.gz",
  `${workspace}/dist/room.bundle.gz`,
);
fs.copyFileSync("src/index.html", `${workspace}/dist/index.html`);
fs.copyFileSync("src/run.js", `${workspace}/dist/run.js`);
const result = spawnSync(process.execPath, ["tools/conversion/compile.mjs"], {
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
fs.copyFileSync(
  `${workspace}/dist/room.bundle.gz`,
  "assets/source/room.bundle.gz",
);
console.log(
  "Rebuilt canonical full-precision bundle; run npm run optimize to update the runtime model.",
);
