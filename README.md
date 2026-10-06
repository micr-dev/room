# room.micr.dev
![portfolio](https://github.com/user-attachments/assets/1ec0295e-3ea7-4a8c-961d-9bcf9ca4d1eb)

an interactive 3d portfolio site built with a standalone Three.js renderer.

The site preserves the original room, interactions, media, and auxiliary routes while replacing the Spline runtime with a standalone optimized renderer. See [`docs/verification/performance.md`](docs/verification/performance.md) for measured results and their limits.

Build and test with `npm ci`, `npm run build:site`, and `npm test`.

## License

**© room.micr.dev 2025 ∷ all rights reserved.**

All code, design, writing, and media assets in this repository are fully owned by me.
Nothing in this repo may be copied, reused, modified, or distributed without explicit written permission.

## Development

```sh
npm ci
npm run build:site
npm test
python -m http.server 8080 --directory public
```

| Folder | Purpose |
| --- | --- |
| `src/` | Editable browser code, styles and HTML template |
| `assets/models/` | Optimized runtime scene |
| `assets/runtime/` | Referenced images, videos, audio and fonts |
| `assets/source/` | Full-precision model and archived conversion inputs |
| `scripts/` | Build, optimization and restoration commands |
| `tools/conversion/` | Independent Spline conversion and geometry packing |
| `tests/` | Executable behavior, loading, geometry and deployment checks |
| `docs/verification/` | Performance evidence and comparison results |
| `public/`, `.cache/` | Generated output; excluded from Git |

`npm run optimize` rebuilds compact geometry/media; ffmpeg is required for video posters. `npm run convert` restores the raw input archive and regenerates the full-precision bundle. `npm run format:check` checks authored code formatting. See [asset pipeline](docs/asset-pipeline.md) for resource identifiers, third-party code and rebuild details.

The original Spline site is preserved on [`legacy`](https://github.com/micr-dev/room/tree/legacy). Netlify and Vercel serve `public/`; existing auxiliary routes remain available.
