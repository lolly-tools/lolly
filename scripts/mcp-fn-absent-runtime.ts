// Bundled INTO api/mcp/[...path].js by scripts/build-mcp-fn.ts in place of the
// on-device ML and speech runtimes (onnxruntime-node, @huggingface/transformers,
// @napi-rs/canvas, phonemizer). The serverless MCP function never runs them - no
// model weights, no consent path, a 60 s budget - but the node-shell modules it
// inlines reach them through lazy `import('<package>')` calls, and Vercel's file
// tracer follows those strings into the function's files: on 2026-09-03 that
// pushed the function to 260.7 MB uncompressed, over the 250 MB limit, and every
// git deploy of lolly.tools failed. Importing this module rejects the same way a
// missing runtime does, which is the case node-shell's conditional attach already
// handles (a null API, never a throwing stub on the bridge).
throw new Error('This on-device runtime is not available in the Vercel MCP function.');
