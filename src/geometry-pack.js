import { bundleURL } from "./bundle-version.js";
// The scene document, geometry metadata and byte-exact model buffers share one
// gzip transport. Typed views reference the decoded archive without copying.
export function decodeRoomBundle(bytes) {
  const header = new DataView(bytes);
  if (
    bytes.byteLength < 16 ||
    header.getUint32(0, false) !== 0x524f4f4d ||
    ![2, 3].includes(header.getUint32(4, true))
  )
    throw Error("Invalid room bundle");
  const documentLength = header.getUint32(8, true),
    metadataLength = header.getUint32(12, true),
    metadataOffset = 16 + documentLength,
    dataOffset = Math.ceil((metadataOffset + metadataLength) / 8) * 8;
  if (dataOffset > bytes.byteLength) throw Error("Invalid room bundle lengths");
  const text = new TextDecoder(),
    document = JSON.parse(
      text.decode(new Uint8Array(bytes, 16, documentLength)),
    ),
    manifest = JSON.parse(
      text.decode(new Uint8Array(bytes, metadataOffset, metadataLength)),
    );
  if (bytes.byteLength - dataOffset !== manifest.byteLength)
    throw Error("Geometry archive length mismatch");
  const entries = Object.values(manifest.buffers),
    scratch = new Uint8Array(Math.max(0, ...entries.map((e) => e.byteLength)));
  for (const entry of entries) {
    const width = entry.shuffleWidth ?? 1;
    if (
      ![1, 2, 4, 8].includes(width) ||
      !Number.isSafeInteger(entry.offset) ||
      !Number.isSafeInteger(entry.byteLength) ||
      entry.offset < 0 ||
      entry.byteLength < 0 ||
      entry.offset + entry.byteLength > manifest.byteLength ||
      entry.byteLength % width
    )
      throw Error("Invalid geometry buffer range");
    if (width <= 1) continue;
    const target = new Uint8Array(
        bytes,
        dataOffset + entry.offset,
        entry.byteLength,
      ),
      words = entry.byteLength / width;
    scratch.set(target);
    const predictor = entry.predictor;
    if (
      predictor &&
      (width !== 4 ||
        !["xor", "delta"].includes(predictor.mode) ||
        !Number.isSafeInteger(predictor.stride) ||
        predictor.stride < 1 ||
        predictor.stride > 16)
    )
      throw Error("Invalid buffer predictor");
    if (width === 4) {
      const output = new Uint32Array(bytes, dataOffset + entry.offset, words),
        stride = predictor?.stride ?? words;
      for (let word = 0; word < words; word++) {
        let value =
          scratch[word] |
          (scratch[words + word] << 8) |
          (scratch[2 * words + word] << 16) |
          (scratch[3 * words + word] << 24);
        if (word >= stride)
          value =
            predictor.mode === "xor"
              ? value ^ output[word - stride]
              : value + output[word - stride];
        output[word] = value;
      }
    } else
      for (let lane = 0; lane < width; lane++)
        for (let word = 0; word < words; word++)
          target[word * width + lane] = scratch[lane * words + word];
  }

  return {
    document,
    geometries: manifest.geometries,
    manifest,
    dataOffset,
    bytes,
    array(attribute, Constructor) {
      const entry = manifest.buffers[attribute.file];
      if (!entry) throw Error("Geometry buffer missing: " + attribute.file);
      return new Constructor(
        bytes,
        dataOffset + entry.offset,
        entry.byteLength / Constructor.BYTES_PER_ELEMENT,
      );
    },
  };
}
export async function loadGeometryPack() {
  const response = await fetchBundle();
  if (!response.ok) throw Error("Room bundle download failed");
  let bytes;
  if (typeof DecompressionStream !== "undefined")
    bytes = await new Response(
      response.body.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
  else {
    const { gunzipSync } = await import("./vendor/fflate.js"),
      decoded = gunzipSync(new Uint8Array(await response.arrayBuffer()));
    bytes = decoded.buffer.slice(
      decoded.byteOffset,
      decoded.byteOffset + decoded.byteLength,
    );
  }
  const pack = [0x524d4334, 0x524d4335].includes(
    new DataView(bytes).getUint32(0, false),
  )
    ? await (await import("./compact-pack.js")).decodeCompactPack(bytes)
    : decodeRoomBundle(bytes);
  return pack;
}

async function fetchBundle() {
  let cache;
  try {
    if (globalThis.caches) {
      cache = await caches.open("room-models-v1");
      const hit = await cache.match(bundleURL);
      if (hit) return hit;
    }
  } catch {
    /* Storage may be unavailable. */
  }
  const response = await fetch(bundleURL, {
    cache: "force-cache",
    priority: "high",
  });
  if (response.ok && cache) {
    const copy = response.clone();
    cache
      .put(bundleURL, copy)
      .then(async () => {
        for (const key of await cache.keys())
          if (!key.url.endsWith(bundleURL.slice(1))) await cache.delete(key);
      })
      .catch(() => {});
  }
  return response;
}
