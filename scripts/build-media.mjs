import { format } from "prettier";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { createHash } from "node:crypto";
const assetRoot = "assets",
  optimized = {},
  posters = {},
  changes = [];
for (const file of fs.readdirSync(assetRoot + "/runtime")) {
  if (!/\.(png|jpg|jpeg)$/.test(file)) continue;
  const input = fs.readFileSync(assetRoot + "/runtime/" + file),
    output = await sharp(input)
      .webp({ quality: 95, alphaQuality: 100, effort: 6 })
      .toBuffer();
  if (output.length < input.length) {
    const name =
      "assets/" + createHash("sha256").update(output).digest("hex") + ".webp";
    fs.writeFileSync("assets/runtime/" + name.slice(7), output);
    optimized["assets/" + file] = name;
    changes.push({ file, before: input.length, after: output.length });
  }
}
for (const file of fs
  .readdirSync(assetRoot + "/runtime")
  .filter((f) => f.endsWith(".mp4"))) {
  const png = execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        assetRoot + "/runtime/" + file,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-threads",
        "1",
        "-",
      ],
      { maxBuffer: 30e6 },
    ),
    lossless = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer(),
    lossy = await sharp(png)
      .webp({ quality: 95, alphaQuality: 100, effort: 6 })
      .toBuffer(),
    webp = lossless.length < lossy.length ? lossless : lossy,
    name =
      "assets/" + createHash("sha256").update(webp).digest("hex") + ".webp";
  fs.writeFileSync("assets/runtime/" + name.slice(7), webp);
  posters["assets/" + file] = name;
  changes.push({
    file,
    videoBytes: fs.statSync(assetRoot + "/runtime/" + file).size,
    posterBytes: webp.length,
  });
}
fs.writeFileSync(
  "src/asset-map.js",
  await format(
    "export const optimizedImages=" +
      JSON.stringify(optimized) +
      ";\nexport const videoPosters=" +
      JSON.stringify(posters) +
      ";\n",
    { parser: "babel" },
  ),
);
fs.writeFileSync(
  "docs/verification/media-optimization-results.json",
  JSON.stringify(changes, null, 2),
);
console.log(changes);
