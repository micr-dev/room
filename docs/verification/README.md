# Verification evidence

Start with [performance.md](performance.md), [compact-size-budget.json](compact-size-budget.json), [compact-render-comparison.json](compact-render-comparison.json) and [compact-paired-native-performance.json](compact-paired-native-performance.json). These distinguish measured file sizes, native software-GPU timings and unverified browser/device behavior.

Older JSON results are historical optimization records. Paths in those records describe the layout when measured and are retained as provenance. Current executable tests live in `tests/`; build metadata is generated in `.cache/runtime-build.json`. Small outline differences remain; full 1:1 Spline parity and hardware FPS are not established.
