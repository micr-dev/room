# Asset pipeline

`assets/models/room.compact.gz` is the optimized runtime model/document. `assets/source/room.bundle.gz` is the full-precision canonical optimization input. `assets/source/conversion-inputs.zip` contains the independently decoded source scene and raw Spline geometry arrays, retaining original relative paths for optional conversion. None of the source inputs is published.

`assets/runtime/` contains media and fonts. Resource hashes are intentional identifiers from the decoded scene, not object names. Object names remain in the scene document; media sizes and original-to-WebP/poster mappings are recorded in `docs/verification/media-optimization-results.json` and `src/asset-map.js`. Existing auxiliary site assets remain with their pages.

`src/` contains editable browser code and templates. `src/vendor/` is unmodified third-party browser code with licenses. `scripts/` builds/optimizes assets and deployable output. `tools/conversion/` compiles decoded Spline data, while `tools/draco`, `tools/opentype` and `tools/meshoptimizer` hold licensed build dependencies. `tests/` contains executable checks; `docs/verification/` holds historical evidence and current comparison results.

`npm run build:site` generates ignored `public/` and `.cache/` files; generated runtime chunks are never committed. `npm run optimize` rebuilds compact geometry and media from retained inputs. `npm run convert` restores archived conversion inputs to `.cache/conversion` and regenerates the full-precision source bundle. ffmpeg is needed only when optimizing video posters.
