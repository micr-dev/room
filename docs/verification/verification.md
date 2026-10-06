# Reference verification

This revision is much closer to the supplied room, but full 1:1 parity is not claimed.

## Native rendering

The published source scene and original runtime are compared with the independently converted website using Mesa/llvmpipe and native WebGL. Resolution: 1920×1080, pixel ratio 1. The controlled visual fixture uses 32 rendered frames per page and matching outline IDs for 120 cloned objects. Original UUIDs remain intact; only the fixture's randomColor input attributes are aligned. Production generates clone UUIDs as the original does.

| Page | Mean absolute RGB error, 0–255 | Pixels with any RGB error >16 |
| --- | ---: | ---: |
| Setup | 0.0847 | 0.0646% |
| Desktop | 0.0169 | 0.0008% |

These are close comparisons, not zero-error results. Full resolution reference, conversion and difference PNGs accompany this report in `renders/`.

The reference native shader fixture explicitly sequences generated out-parameter dependencies and promotes outline sampler precision. These adjustments address native GLSL behavior; they mean the test is not an unmodified browser-versus-browser comparison. Video images are frozen at the decoded first frame. The native fixture does not render HTML overlays or play sound.

## Geometry and texture checks

All 693 source meshes compile, producing 237 unique geometry resources. Source vertex-position clouds match 685 of 686 stored meshes independent of vertex ordering (tolerance 0.001 scene units). The exception is initially invisible Text 5: its reference geometry is empty before interaction. Rounded cubes, rounded/custom rectangles and all four visible menu text clouds match.

22 distinct visible image/video sampler cases pass the independent GPU texture comparison, including centered repeat/offset/rotation, wrapping, cropping, spherical UVs and video filtering. Maximum per-channel error is at most one level. `texture-render-results.json` records each case; `texture-cases.mjs` and `verify-textures.py` rerun this test with Node, Python, moderngl, NumPy, Pillow and ffmpeg.

535 nonempty position-plus-normal-plus-UV clouds match within 0.001, with a maximum measured distance of 6.12e-7. Text UVs normalize per glyph shape; lower extrusion walls swap UV axes; rounded boxes use source face/edge UV directions and subdivision grids. Upstream Tess2 triangulates contours, and extrusion walls render before surfaces at equal-depth seams. See `uv-cloud-comparison.json`.

57 independent native GPU views of text, rounded boxes, desk and mat UVs pass within one channel level; 55 are pixel-identical. These compare captured source geometry with rebuilt geometry using the same UV shader, not the complete browser page. See `parametric-uv-render-results.json`.

The isolated TAA comparison is pixel-identical for 16 successive frames using identical captured source color input, black initial history, zero motion and constant depth. Source samplers are explicitly low precision in this native fixture. This does not verify moving inputs or browser rendering. See `isolated-temporal-results.json`.

Native editor-handler regression checks verify partial geometry merges, capturing the selected target during asynchronous rebuilding, newest-edit ownership, disposal of replaced editor-owned geometry, and waking rendering after a delayed font load. GPU drawing is mocked in that test; full browser editor UI remains unverified. See `editor-rebuild-results.json`. `test-parametric-edits.mjs` checks dimension scaling across custom extruded surfaces and walls.

## Timed interactions

43 snapshots compare 783 stored objects after startup and seven hover/click/reverse operations. Snapshots occur at 100, 200, 500, 1000, 2000 and 4000 ms. Positions, Euler rotations, scales, visibility, geometry dimensions, active page and active camera match within 1e-5. See `timed-interaction-comparison.json`.

The sequence includes contact hover/exit, keyboard F13 hover/exit, contact click, Quarzite click and Projects click. It verifies first-RAF tween timing, easing, Euler rotation interpolation, delayed zero-duration transitions and animation of the destination camera. Separate unit tests dispatch all 193 instantiated action bindings; external effects are mocked.

## Expanded sequence and drawing checks

`extended-state-comparison.json` records 32 sequential startup/hover/click/page-return states across all 783 stored objects. All 32 snapshots match position, rotation, scale and visibility within 1e-5, with matching active page and camera. The initial character rotation now uses the original cached default ray before the first pointer event. Active-camera projection and world matrices also match in all 32 states; see `extended-camera-comparison.json`.

At keyboard hover, all 814 drawable world matrices match within 1e-5. Source and conversion each submit 514 material draw calls. The 513 shared stored mesh IDs match front/back side, transparency, depth writes and depth tests; the remaining call is the same generated instance with different UUIDs. See `world-matrix-comparison.json` and `draw-call-comparison.json`. Component geometry is rendered as in the source; template geometry is excluded from interaction selection.

`optimized-render-comparison.json` records the current full 32-view sequence at 16 GPU frames per view. The current shader cache, packed geometry, draw bookkeeping, outline normals, fullscreen triangle and low-precision TAA samplers are included. The default-page 32-frame table above and `extended-render-comparison.json` are retained historical measurements from earlier revisions.

| View | Mean absolute RGB error, 0–255 | Pixels with any RGB error >16 |
| --- | ---: | ---: |
| Startup | 0.01258 | 0.01215% |
| Quarzite | 0.03856 | 0.00405% |
| Watch | 0.03267 | 0.00039% |
| Keyboard | 0.03737 | 0.00000% |
| iPod | 0.03475 | 0.00077% |
| Desktop | 0.00580 | 0.00019% |
| Final Setup return | 0.01292 | 0.01215% |

The largest current mean RGB error is Quarzite: 0.03856. Across the 32 captures, at most 0.02431% of pixels differ by more than 16 levels. Keyboard now has no pixels above that threshold. Those errors remain nonzero. Current PNGs are `renders/converted-*` and `renders/initialized-reference-*`; older raw/native fixture captures are retained separately.

TAA now matches the original sampler precision and reconstruction expression ordering. The fullscreen passes use the same oversized triangle. Outline compensation averages unique per-face vector extrusion normals rather than weighting repeated nonindexed triangle corners. Rounded rectangle normals and extruded title normals follow the source contour rules, including its outer-contour lookup for letter-hole vertex IDs. All 685 nonempty position-plus-normal clouds now match within 0.001; the largest measured error is 6.12e-7. All 505 exported nonempty outline-normal clouds also match within 0.001; the desk outline normals match exactly. See `normal-cloud-comparison.json` and `extrude-normal-comparison.json`.

`optimized-state-comparison.json` adds a 32-state sequence without pointer movement. All 783 stored objects match within 1e-5, with matching page and camera. This catches the look-at pause state retained across page re-entry; pointer motion resumes it. The separate explicit pointer comparisons also remain within 1e-6.

The native source physical shader declares `PhysicalMaterial material` but does not initialize `material.specularF90` before using it. Mesa renders the iPod as a black silhouette. A diagnostic explicitly initializing this field to zero removes that silhouette; initializing it to one produces nearly the same diagnostic image. Both the raw-reference and initialized-reference metrics are retained. This is a reference-fixture adjustment, not evidence of the original browser's appearance. The conversion has no black-silhouette workaround. The native original also raises a caught outline-color error at the CRT click; these results are not a proof of error-free browser execution.

The outline prepass now uses one shared normal material and preserves the original materials for sorting through the renderer's override path. Per-draw ID uniforms preserve mesh identity. All 32 native captures were rerun: mean error is unchanged or slightly reduced in every view; Desktop error decreased from 0.00596 to 0.00580 and its pixels above 16 levels decreased from 12 to 4.

`interrupted-interaction-comparison.json` adds 11 snapshots of rapid hover reversal/re-entry, overlapping hover, clicks during hover and a popup return. All 783 stored objects, dimensions, visibility, active page and active camera match at each snapshot within 1e-5. This does not cover every cross-event interruption.

`editor-lazy-font-results.json` exercises delayed text edits without a preloaded font parser. The actual bundled parser loads on demand in the Node fixture. A simulated failed font request clears its cache; the following edit retries successfully. Native tests do not establish browser module loading or browser editor behavior.

A diagnostic isolated five large Quarzite normal-buffer discrepancies at mesh intersections. The meshes' world matrices match, but their model-view uniforms differ slightly (at most 2.98e-7 among the four inspected meshes). Forcing the captured camera pose reduced the five pixels to four; it did not eliminate all differences. That diagnostic pose is not shipped. The exact cause of the remaining discrepancies is unresolved.

## Pointer look-at

Real pointer events after the Projects transition compare the character's world matrix at three screen positions and after pointer exit. All four cases match within 1e-6; the largest observed difference is 2.2e-8. This includes world-space aiming, removal of parent/hidden rotation, reset damping and the immediate first reset update. See `lookat-comparison.json`.

## Viewport sizing

At 1920×1080, 1280×720 and 390×844, the source and conversion both retain a 1920×1080 scene raster, and their active-camera projection matrices match exactly. The original CRT layer scales that raster to the viewport. This verifies camera/raster sizing, not a browser screenshot at each viewport. See `viewport-comparison.json`.

## Corrections

- Exact centered texture transforms, spherical derivative LOD and source rectangle/text UVs.
- UV-based gradient projection and all color/alpha stops.
- Source hemisphere lighting, face-aware matcap sampling and missing-image fallbacks.
- Source material transparency classification and component draw calls.
- Page re-entry resets objects, camera state and event toggle state.
- Video linear filtering and original orientation.
- Original layer blending, toon color stops and toon lighting with specular response.
- Transparent fragments no longer occlude the keyboard through depth writes.
- Outline color fallback, compensation, normal/depth prepass and clone-ID inputs.
- Motion buffers, temporal reconstruction and identity-initialized previous matrices, updated only when the mesh is drawn.
- Default cached pointer ray before the first pointer event.
- Source material dithering and exact normal/Sobel expression grouping.
- Original canvas context options and display-P3 drawing-buffer tag when supported.
- Fixed 1920×1080 scene raster at the original pixel ratio, with viewport scaling in the unchanged CRT layer.
- Rounded cube corners, quadratic rectangle corners, text outlines and morph buffers.
- Media delay units, first-frame timing, easing, Euler interpolation and camera animation.
- Live geometry dimension edits retain their original baked dimensions for scaling.

## Remaining verification

Small full-frame differences remain. Native GPU tests do not certify full browser UI, continuous video/audio, every pointer path, other devices, cross-event interruption or features outside this room fixture. The original native reference includes the stated shader adjustments, so the test is not an unmodified browser comparison. Full 1:1 parity is not established.

## Performance

See [performance.md](performance.md) for measured results and scope. The scene document and geometry transport are losslessly packed into one request, shader programs are shared by compiled shader structure, render bookkeeping skips hidden pages, and the 3D scene stops drawing after 32 settling frames when static. Animation, video, edits and pointer changes resume it. The CRT effect continues its animated noise but uploads unchanged scene pixels only once. These checks do not establish hardware/browser FPS.

## Lossless model and transport regression checks

The optimizer preserves complete vertex tuples, including morph channels and signed-zero bits; UV/normal discontinuities remain separate. Indices are narrowed only when safe. Original bounding boxes and spheres are retained. All 237 expanded triangle attribute streams match the previous compiled models byte-for-byte. All 32 1920×1080 native renders remain pixel-identical after these optimizations and the one-request bundle. Reference parity limitations above remain unchanged.

The bundle decoder passes native gzip and fflate fallback equivalence tests. Recompilation retains original referenced source models, images, fonts and hidden-state assets; pruning also protects the console animation and audio. See `model-triangle-stream-comparison.json`, `model-render-comparison.json`, `geometry-optimization.json` and `asset-pruning.json`.

## Normal/ID cache regression

All 32 native 1920×1080 captures remain pixel-identical with the unchanged normal/ID pass reused across temporal settling frames. Twenty invalidation cases cover transforms, camera/projection/layers, geometry/index/attribute upload versions, draw range/groups, ordering, material classification, bounds, colors, explicit invalidation and mesh removal/re-entry. Idle and delayed editor/font tests pass with this cache. Color/velocity/temporal draws continue; moving input invalidates the normal pass. These checks preserve prior reference errors and do not establish full browser/media parity.

The native original camera's complete authored state data matches the independently decoded camera state data exactly (`camera-authored-comparison.json`). Its final Quarzite pose still differs by at most 3.52e-9 radians and 1.82e-10 position units. The residual discrepancy is beyond authored state decoding; its precise execution cause remains unresolved.

## Scheduler/idle regression

`cpu-idle-render-comparison.json` records 32 pixel-identical native captures following easing/interpolation and idle apply/traversal changes. Captures manually render 16 temporal frames per state; they do not verify continuously running browser temporal history. `cpu-timed-interaction-comparison.json` and `cpu-interrupted-interaction-comparison.json` verify 43 and 11 snapshots respectively across all 783 authored objects. `test-behavior-regression.mjs` validates a canonical hash of every whole-document state across 120 scheduler ticks using the supplied room fixture.

The real Start/repeat action remains active during `started-idle-results.json` tests. Settled 3D submissions and world traversals are zero; direct transform edits are reapplied and wake drawing. Pointer/media/camera wake-up cases continue passing. Source/browser parity limits above remain unchanged.

## Camera drag repair

The previous adapter rotated in place with a hard 3-degree clamp, and repeating startup states restored the authored camera every tick. The independent orbit now translates and rotates around the camera target, preserves roll, implements the authored vertical-only quartic soft limit, and cancels the repeating camera transition on an actual drag. Subsequent gestures reuse the target and limit baseline. Clicks dispatch on release, while completed/cancelled drags do not activate objects. Seven incremental movements match the original runtime world matrices within 6.83e-12 (`orbit-reference-results.json`, reproducible with `node qa/test-orbit.mjs`). Native pointer and GPU capture checks are recorded separately; browser input remains uncertified.

## Picking optimization

`node qa/test-picking.mjs` verifies 1,683 complete hit lists against native picking, including all authored camera states, edits and fallback cases. Hit distances, points, triangle IDs, face/vertex normals, UVs and barycentric coordinates are exact. A whole-bundle SHA-256 confirms render buffers are unchanged. The native DOM drag/cancel/cats tests still pass. No browser FPS or new full-browser parity claim follows from these checks. See `picking-performance.json` for paired CPU measurements and first-use costs.

## Static transforms and shared pass synchronization

The 32 native 1920×1080 captures in `transform-render-comparison.json` match the preceding conversion exactly (zero changed pixels). Explicit geometry scale updates and rebuilt mesh matrices pass native editor checks. The focused pass test covers changing parent/local matrices and update-flag restoration after an exception. Existing data/shader, 1,683 picking-comparison and seven source-orbit-matrix tests pass. CPU and native software-GPU measurements are in the separate transform performance reports; browser/hardware FPS and full browser/Spline parity remain unverified.
