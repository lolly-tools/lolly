// SPDX-License-Identifier: MPL-2.0
/**
 * Node module-load hook that turns `import './thing.css'` into a no-op.
 *
 * Vite treats a stylesheet import as a side effect that injects the sheet; Node
 * has no idea what a `.css` file is and throws ERR_UNKNOWN_FILE_EXTENSION. That
 * one gap made every web-shell module that imports its own stylesheet - which is
 * every view and most components - completely untestable under `node --test`,
 * and it is why the coverage that exists is all in extracted `*-geom` / helper
 * modules rather than in the modules that actually run.
 *
 * Stubbing the sheet is sound because nothing under test asserts on CSS: jsdom
 * applies no stylesheet layout anyway, so a real sheet and an empty one produce
 * identical behaviour. What the tests do assert on is structure and wiring,
 * which the stub leaves untouched.
 */

const STYLE_EXT = /\.(css|scss|sass|less)(\?.*)?$/;

export async function load(url, context, nextLoad) {
  if (STYLE_EXT.test(url)) {
    // An empty ES module: the import succeeds and contributes nothing.
    return { format: 'module', shortCircuit: true, source: 'export default undefined;' };
  }
  return nextLoad(url, context);
}
