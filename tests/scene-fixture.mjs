import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { decodeRoomBundle } from "../src/geometry-pack.js";
import { unzipSync } from "../src/vendor/fflate.js";

export function loadSourcePack() {
  const bytes = gunzipSync(
    fs.readFileSync(
      new URL("../assets/source/room.bundle.gz", import.meta.url),
    ),
  );
  return decodeRoomBundle(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}
export function loadScene() {
  return loadSourcePack().document;
}
let cachedArchive;
export function loadConversionFile(name) {
  const archive = (cachedArchive ??= unzipSync(
    new Uint8Array(
      fs.readFileSync(
        new URL("../assets/source/conversion-inputs.zip", import.meta.url),
      ),
    ),
  ));
  if (!archive[name]) throw Error("Missing conversion fixture: " + name);
  return archive[name];
}
