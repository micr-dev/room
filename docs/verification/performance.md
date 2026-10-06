# Current performance summary

The original GitHub scene.splinecode at f965c41afae28f2925fa1ce932503a05e343c695 is 84,618,899 bytes; the new scene/document bundle is 2,757,102 bytes (96.74% smaller files). These are file sizes, not a measured browser waterfall; the formats contain different encodings. Original Spline hardware/browser FPS and full startup time were not benchmarked.

Across optimization stages of the independent conversion, stored vertices decreased 918,727 → 335,269 (63.51%). Shader programs decreased 302 → 51 (83.11%, measured at an earlier shader optimization stage). Latest paired geometry test: room 379.87 → 228.72 ms (39.8% lower), desktop 16.82 → 15.77 ms (6.2% lower); native Mesa software GPU, same renderer/materials, 480×270, twenty interleaved samples. This is not an end-to-end comparison against Spline. Source: compact-paired-native-performance.json.

The three videos total 9,705,469 bytes and have no src before play; initial posters replace their first frames. The existing 2,942,240-byte easter-egg audio no longer preloads. Model cache hits avoid model network requests. Static 3D rendering stops after 32 settling frames and resumes for input/animation/video; CRT noise still runs.

All document images/posters plus gzip-estimated startup code and bundle total 3,645,206 bytes, excluding HTML/CSS/headers and audio/video playback. Removing the editor and timing UI reduced the gzip-estimated startup code by 13,100 bytes (7.62%); model and image sizes are unchanged. Whole startup is not under 3 MB, nor is a universal three-second first frame established. Full-sequence native visual regression checks cover 32 views; small contour differences remain. Text geometry/document are exact. See compact-size-budget.json and compact-render-comparison.json.

The historical measurements below apply to earlier stages; statements about no quantization, decimation or pixel identity do not describe the current compact meshes.

# Historical performance measurements

These results compare the previous independent renderer with the optimized renderer. They are not browser/device FPS or a speed comparison against the original Spline website.

| Measure | Before | After | Scope |
| --- | ---: | ---: | --- |
| Scene/model requests | 3 in preceding packed revision | 1 | JSON, metadata and model buffers share one bundle |
| Stored model vertices | 918,727 | 884,420 | Full-attribute, bit-exact deduplication |
| Raw geometry storage | 41,158,884 bytes | 37,959,140 bytes | Narrower indices and duplicate/unused vertex removal |
| Compressed transport | 17,222,024 bytes of geometry plus JSON | 14,810,834 bytes total bundle | Lossless byte shuffle and gzip; includes JSON/metadata |
| Compiled shader programs | 302 | 51 | Both pages in native WebGL |
| Custom shader keys | 319 | 45 | 814 instantiated materials; same compiled shader structure shares keys |
| Setup post orchestration | 1.110 ms | 0.799 ms | Mock GPU, actual visible scene and matrix/hook bookkeeping; 28% reduction |
| Desktop post orchestration | 0.679 ms | 0.041 ms | Same CPU fixture; 94% reduction |
| Setup steady native frame | 256.77 ms | 256.49 ms | Mesa software GPU, 480×270; essentially unchanged |
| Desktop steady native frame | 25.14 ms | 18.02 ms | Same software GPU, ten samples; noisy, not a hardware claim |

`performance-before.json`, `performance-optimized.json` and `post-cpu-performance.json` include samples and test conditions. Native cold shader compilation also varied; it is not a network/browser startup measurement.

`verify-geometry-pack.mjs` verifies all 1,230 buffers by their content-addressed hashes, typed-array alignment, document and metadata. The loader restores shuffled bytes in place and uses views into one decoded ArrayBuffer. `test-room-bundle.mjs` verifies native gzip and fallback fflate decode produce identical data. Raw compiled duplicates are omitted; `compile.mjs` regenerates them from retained source resources, repacks and prunes automatically.

`model-triangle-stream-comparison.json` verifies all 237 geometry streams against the prior pack, including all attributes, morph channels, index order, groups and bounds. `model-render-comparison.json` records 32 pixel-identical native captures after model/transport changes. Models are not decimated and textures are not downsampled.

`model-paired-native-performance.json` measures old versus compacted buffers: Setup 231.02 → 235.74 ms; Desktop 18.51 → 18.18 ms. This noisy software-GPU measurement establishes no model-render speedup. The established benefits are reduced vertex/storage counts and transfer size.

`idle-render-results.json` records virtual-RAF tests with GPU rendering mocked. Static scenes render 32 settling frames, then zero further 3D frames. Page changes, edits and pointer movement wake rendering. Playing video renders every RAF; pausing returns to settling. Camera animations explicitly invalidate each frame. The renderer still ticks the event scheduler and updates dirty transforms.

`test-crt-cache.mjs` verifies 90 animated CRT draws with one scene copy/upload, and invalidation on a new scene frame, source size change, toggling and unversioned source fallback. The CRT effect still animates noise each frame; the complete website is not claimed to do zero GPU work while idle.

The shader cache test checks that materials sharing a program key and material type have identical patched shader source. Uniform values stay per material. Reduced hidden-page traversal and reused per-mesh hooks/matrices lower post orchestration allocation; the isolated before/after bookkeeping change produced identical pixels on both pages.

Full browser/media and hardware performance remain unverified. No lower-detail geometry or reduced scene resolution is used for these optimizations.

Editor geometry builders, font parsing and Tess2 are imported only when rebuilding an edited mesh. Normal room startup avoids loading them. This saves their startup requests; browser startup time has not been measured. Replaced editor-owned geometries are disposed, while compiled geometries remain shared.

## Shared outline material and deferred font parser

The current outline pass retains original material sorting and shares one normal material. Native CPU instrumentation counts 382 normal-material instances after Setup and 396 across both pages in the previous revision, versus one shared instance now. Per-draw ID uniforms remain distinct.

An interleaved native GPU benchmark uses the same renderer, five warm-up calls per implementation and twenty samples each, reversing order each pair. Setup measured 230.89 → 229.33 ms; Desktop measured 18.62 → 16.72 ms. These are Mesa software GPU results at 480×270, not browser or hardware FPS. The mock-GPU CPU fixture measured Setup 0.790 → 0.808 ms and Desktop 0.0377 → 0.0397 ms; CPU orchestration did not improve. The benefit established here is fewer material instances and slightly closer pixels, with no broad performance claim. See `shared-normal-paired-native.json` and `shared-normal-cpu-performance.json`.

The 477,325-byte OpenType parser is removed from the blocking startup script list. Text edits import it on demand; ordinary room visits use precompiled text geometry. This is its uncompressed file size, not a measured browser transfer or startup-time improvement. Failed font requests clear their cached promise so later edits can retry.

A tested normal-pass shadow toggle produced no draw-call reduction (Setup 1,283 calls, Desktop 70 calls in both variants) and no reliable timing benefit. It was discarded.

## Cached normal/ID prepass

The cache compares camera identity, projection/world matrix, clipping range and layers; outlined mesh identity, world matrices, layers, ancestor/render order, culling bounds, geometry/index/attribute identities and upload versions, morph inputs, groups/draw range, material draw classification and object colors. Resize and WebGL context restoration invalidate it. Video texture changes do not affect these inputs. Color, velocity and temporal reconstruction continue on every scheduled 3D frame.

| Unchanged scene | Uncached | Cached | Scope |
| --- | ---: | ---: | --- |
| Setup draw calls | 1,283 | 905 | One complete post render |
| Setup submitted triangles | 2,496,430 | 1,796,028 | Includes all passes |
| Setup native frame | 236.81 ms | 198.87 ms | 16% less time |
| Desktop draw calls | 70 | 56 | One complete post render |
| Desktop submitted triangles | 11,030 | 5,706 | Includes all passes |
| Desktop native frame | 22.10 ms | 19.15 ms | 13% less time |

Five alternating warm-up calls and twenty interleaved samples each, reversed order per pair, gl.finish; native Mesa llvmpipe at 480×270. Both implementations remain alive. The run is isolated from full-scene capture. See `normal-cache-paired-native.json`. Moving camera/geometry invalidates this cache; this is not a universal FPS improvement.

`normal-cache-render-comparison.json` records 32 pixel-identical native captures at 1920×1080. `test-normal-cache.mjs` covers 20 changed-input and removal/re-entry cases. The exported source test suite now reads packed UV data directly, so it runs after raw duplicate buffers have been removed.

## Scheduler and real-start idle work

| Measure | Before | After | Scope |
| --- | ---: | ---: | --- |
| 120 scheduler ticks | 82.23 ms | 28.50 ms | 40 authored transition-bearing bindings; paired stress fixture; 65% reduction |
| 600 settled callbacks, CPU | 193.15 ms | 34.60 ms | Actual Start/repeat actions; GPU rendering mocked; 82% reduction |
| Settled 3D submissions | 600 | 0 | Same callbacks; scheduler remains active |
| Settled world-matrix traversals | 600 | 0 | Same callbacks |

Bezier sample tables are bounded to 64 entries; easing is evaluated once per animation tick. Interpolation avoids recursive structuredClone calls before rebuilding the same keys, while preserving array-backed patches. A fixture-specific canonical hash verifies all 120 complete document state ticks against the previous scheduler.

The prior idle test cleared its animations before checking final settling. `started-idle-results.json` now covers actual Start actions with the repeating animation still active, direct transform edits and subsequent settling. Metadata-only name changes update current data without waking GPU work. The application still observes edits, animations, look-at and media. These measurements are CPU fixtures, not browser/device FPS; continuous browser temporal history is unverified.

The shadow audit found no enabled shadow-casting lights, so the proposed cache was discarded. No shadow-cache code is shipped. Shared-material batching found no material arrays to consolidate in this fixture. The existing lossless geometry/asset reductions remain in effect.

## Picking: visibility filtering and triangle bounds

| 96 screen rays | Previous CPU time | Optimized CPU time | Reduction | Triangle tests before → after |
| --- | ---: | ---: | ---: | ---: |
| Setup | 49.83 ms | 16.07 ms | 67.7% | 289,231 → 13,779 |
| Desk camera | 134.79 ms | 21.97 ms | 83.7% | 918,923 → 37,344 |
| Desktop | 7.77 ms | 2.63 ms | 66.1% | 49,076 → 7,027 |

CPU-only Node/Three.js fixture, actual full-resolution geometry and authored camera poses; four warmup batches and twenty interleaved samples per implementation, reversed order each pair. Basic material sides match the renderer. This measures picking, not GPU rendering or browser/device FPS. See `picking-performance.json`; reproduce with `node qa/benchmark-picking.mjs`.

The picker filters hidden and raycast-locked meshes before intersection and reuses candidate/result arrays. For dense undeformed meshes, shared geometry bounds reject contiguous triangle ranges before calling the original Three.js intersection routine. Bounds preserve triangle order, index buffers, face IDs, winding and interpolation. Position/index replacement or upload-version changes rebuild bounds; deforming/custom meshes, material arrays and misaligned draw ranges use the native path.

Bounds are built only when a dense mesh reaches triangle picking. The first optimized batches, including any new bounds, were 63.02 ms (Setup), 23.77 ms (Desk), and 3.05 ms (Desktop). The measured workload retained 686,464 bytes of typed bound/range arrays; this excludes general JavaScript object overhead. No additional geometry transport is needed. First-use browser latency and hardware FPS remain unmeasured.

`test-picking.mjs` verifies 1,683 complete intersection lists against the previous native picker across both pages, authored camera states, transforms, sidedness, near/far limits, layers, index/position edits, geometry replacement, nonindexed meshes, custom vertex readers, morphs and grouped materials. A whole-bundle hash confirms picking leaves every packed render-buffer byte unchanged. Native DOM checks also confirm persistent dragging, cancellation, and clicking the cats after the initial desk trigger.

## World-transform synchronization

The static scene root and mesh wrappers stop recomposing identity/local transforms on every pass. Geometry scaling and editor rebuilds explicitly update the affected mesh. `Post.render` synchronizes the world matrices once, suppresses duplicate renderer traversal during its passes, then restores the caller's update flag in `finally`.

| CPU orchestration fixture | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Setup, stationary | 2.097 ms | 1.261 ms | 39.9% |
| Setup, moving camera | 2.697 ms | 1.374 ms | 49.0% |
| Desktop, stationary | 0.866 ms | 0.124 ms | 85.6% |
| Desktop, moving camera | 1.264 ms | 0.128 ms | 89.9% |

`transform-cpu-performance.json` uses the full room graph and authored outline materials with a mock renderer that performs automatic world updates, visible-mesh model-view/normal calculations and render hooks. It excludes WebGL driver/GPU work and the application's outer RAF. Four paired warmup batches of 25 precede twenty alternating paired batches of 100 renders. Reproduce with `node qa/benchmark-transforms.mjs`.

A moving Setup frame performs one main-scene synchronization instead of three, 7 local matrix compositions instead of 2,452, and 1,139 matrix multiplications instead of 6,292 in this fixture. Geometry and ancestor edits remain visible to both the normal and color passes.

| Native software-GPU frame | Before | After |
| --- | ---: | ---: |
| Setup, stationary | 196.06 ms | 197.57 ms |
| Setup, moving camera | 235.33 ms | 232.86 ms |
| Desktop, stationary | 18.64 ms | 16.08 ms |
| Desktop, moving camera | 19.15 ms | 16.61 ms |

`transform-native-performance.json` uses actual shaders and geometry, Mesa llvmpipe WebGL2 at 480×270, five paired warmups and twenty interleaved samples each, alternating order, `gl.finish`. Setup is effectively unchanged within this run's variation; Desktop frame time falls roughly 13–14%. These are software-GPU measurements, not browser/hardware FPS.

`transform-render-comparison.json` records 32 pixel-identical captures at 1920×1080, 16 temporal frames per event state, controlled clone IDs and frozen video. `test-transform-passes.mjs` covers synchronization, parent/local scale edits and restoring caller flags after render exceptions. `transform-editor-results.json` records real editor callbacks, geometry preview scaling, asynchronous rebuilds, font retry and idle wake-up checks.

## Startup transport and repeat visits

The bundle is now **13,177,707 bytes**, down 11.03% from 14,810,834. Integer XOR/delta predictors are selected per buffer before byte shuffle/gzip; all 1,230 original buffer hashes, all 237 geometry metadata records and the full document still match. No quantization or decimation was introduced.

`startup-transport-performance.json` measures local Node inflate/parse/restore: 168.82 → 152.65 ms mean over six warm samples (9.58% lower). These timings exclude network, browser, shader compilation and GPU rendering.

`test-startup-loading.mjs` verifies a cold network request followed by a byte-identical cache hit with no model network request, old cache eviction, blocked storage fallback, and conditional HTML preload that skips cached bundles. The cache key contains the model content hash; regeneration updates the key. Renderer modules preload early. Both copies of the easter-egg audio use `preload=none`, avoiding that 2.9 MB audio preload. Texture/video requests and GPU initialization still have costs.

The in-page timing overlay and its milestone instrumentation have been removed. Browser startup speed remains unverified on representative hardware.
