The current room requires an 84.62 MB Spline scene and a vendored Spline runtime. This replaces its entry point with the independently decoded, editable Three.js application developed and tested in this session.

Changes:
- Compact scene/document bundle: 2.76 MB; Meshoptimizer compression, attribute-aware reduction, exact text coordinate dictionaries, and deduplicated metadata.
- Preserves authored interactions, vertical camera drag/cats, text/object/material/camera editor, media actions and CRT effect.
- Shared shader programs, cached outlines, idle rendering, less matrix traversal and faster picking.
- Video posters at startup; original videos assigned only on play. Deferred audio/editor/fonts, content-versioned model cache and minified split runtime.
- Builds public/ for both Netlify and Vercel; preserves tree/wip/about routes, favicons, metadata, redirects and security headers. Removes superseded root Spline files. Retains conversion inputs outside published output.

Backup: the remote `legacy` branch points to the exact pre-migration main snapshot f965c41afae28f2925fa1ce932503a05e343c695.

Performance evidence:
- Original Spline scene file 84,618,899 → compact bundle 2,757,102 bytes (96.7% smaller files; not measured wire bytes).
- Initial independent-conversion vertices 918,727 → 335,269 (63.5% fewer); compiled shader programs 302 → 51 in the shader optimization test.
- Latest same-renderer, paired Mesa software-GPU geometry test: Setup 379.87 → 228.72 ms (39.8% lower), Desktop 16.82 → 15.77 ms (6.2% lower), at 480×270. These are not browser/device FPS or original Spline comparisons.
- 9.7 MB of videos deferred until playback; estimated initial bundle/images/gzipped-code payload 3.66 MB before HTML/CSS/headers.

Validation:
- npm ci, npm run build:site and npm test.
- 17 text meshes / 5,341,380 triangle-attribute values exactly preserved; full scene document unchanged.
- 32 native 1920×1080 scripted captures against the previous full-precision conversion; worst 0.354% pixels over 16/255, worst mean RGB delta 0.195/255.
- Native pointer drag/release/cancel/cat-click tests and production-bundle editor/async font tests passed in the prior session.
- Deployment artifact preserves auxiliary routes and all referenced runtime assets, and omits original model conversion inputs.

Limitations: small outline differences remain; full 1:1 Spline/browser/media timing parity and hardware FPS are unverified. Whole initial payload is not under 3 MB. Preview: https://room-threejs-standalone.xmicrock.chatgpt.site (owner-private).
