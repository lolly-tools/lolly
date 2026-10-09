// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

test('desktop and mobile install the same embedded-response MIME guard', () => {
  for (const shell of ['tauri-desktop', 'tauri-mobile']) {
    const lib = read(`shells/${shell}/src-tauri/src/lib.rs`);
    assert.match(
      lib,
      /#\[path = "\.\.\/\.\.\/\.\.\/tauri-shared\/tauri-embedded-assets\.rs"\]\s+mod embedded_assets;/
    );
  }
  const adapter = read('shells/tauri-shared/tauri-embedded-assets.rs');
  assert.match(adapter, /uri\.scheme_str\(\)/);
  assert.match(adapter, /uri\.authority\(\)/);
  assert.match(adapter, /uri\.path\(\)/);
  assert.match(adapter, /response\.status\(\)\.as_u16\(\)/);
  assert.match(adapter, /response\.body\(\)\.as_ref\(\)/);
  assert.equal((adapter.match(/headers_mut\(\)\.insert\(/g) ?? []).length, 1);
  assert.doesNotMatch(adapter, /body_mut|CONTENT_SECURITY_POLICY|headers_mut\(\)\.remove/);
});

test('every owned desktop window constructor attaches the resource callback', () => {
  const windows = read('shells/tauri-desktop/src-tauri/src/presentation_windows.rs');
  assert.match(
    windows,
    /WebviewWindowBuilder::from_config\(app, config\)\?\s*\.on_web_resource_request\(crate::embedded_assets::correct\)/
  );
  assert.match(
    windows,
    /WebviewWindowBuilder::new\(&handle, CONTROLS, tauri::WebviewUrl::External\(url\)\)\s*\.on_web_resource_request\(crate::embedded_assets::correct\)\s*\.window_features\(features\)/
  );
  assert.equal((windows.match(/WebviewWindowBuilder::(?:new|from_config)\(/g) ?? []).length, 2);
  assert.equal(
    (windows.match(/\.on_web_resource_request\(crate::embedded_assets::correct\)/g) ?? []).length,
    2
  );

  const cli = read('shells/tauri-desktop/src-tauri/src/cli.rs');
  assert.match(
    cli,
    /WebviewWindowBuilder::new\(manager, WINDOW_LABEL, tauri::WebviewUrl::App\(page\.into\(\)\)\)\s*\.on_web_resource_request\(crate::embedded_assets::correct\)/
  );
  assert.equal((cli.match(/WebviewWindowBuilder::(?:new|from_config)\(/g) ?? []).length, 1);
  const server = read('shells/tauri-desktop/src-tauri/src/render_server.rs');
  assert.match(server, /cli::build_offscreen_window\(/);
  assert.doesNotMatch(server, /WebviewWindowBuilder::(?:new|from_config)\(/);
});

test('mobile defers automatic creation and preserves the configured window fields', () => {
  const mobile = read('shells/tauri-mobile/src-tauri/src/lib.rs');
  assert.match(
    mobile,
    /let mut context = tauri::generate_context!\(\);\s*let windows = context\.config\(\)\.app\.windows\.clone\(\);/
  );
  assert.match(
    mobile,
    /for window in &mut context\.config_mut\(\)\.app\.windows \{\s*window\.create = false;/
  );
  assert.match(
    mobile,
    /\.setup\(move \|app\| \{\s*for config in windows\.iter\(\)\.filter\(\|window\| window\.create\) \{\s*tauri::WebviewWindowBuilder::from_config\(app, config\)\?\s*\.on_web_resource_request\(embedded_assets::correct\)\s*\.build\(\)\?;/
  );
  assert.match(mobile, /\.build\(context\)/);
  assert.doesNotMatch(mobile, /WebviewWindowBuilder::new\(/);
});
