// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('shells/tauri-desktop/src-tauri/tauri.conf.json', 'utf8'));
const cli = readFileSync('shells/tauri-desktop/src-tauri/src/cli.rs', 'utf8');
const desktop = readFileSync('shells/tauri-desktop/src-tauri/src/desktop_integration.rs', 'utf8');
const rootExport = readFileSync('shells/tauri-desktop/src-tauri/src/root_export.rs', 'utf8');
const renderServer = readFileSync('shells/tauri-desktop/src-tauri/src/render_server.rs', 'utf8');
const lib = readFileSync('shells/tauri-desktop/src-tauri/src/lib.rs', 'utf8');

test('desktop bundle declares the CLI SEA and package resource without duplicating content', () => {
  assert.deepEqual(config.bundle.externalBin, ['bin/lolly-cli']);
  assert.equal(config.bundle.resources['cli-lib'], 'cli-lib');
  assert.equal(config.bundle.resources['../../../tools'], undefined);
  assert.equal(config.bundle.resources['../../../catalog'], undefined);
  assert.match(rootExport, /const INCLUDED: \[&str; 2\] = \["\/tools\/", "\/catalog\/"\]/);
  assert.match(rootExport, /catalog\/tools\/index\.json/);
  assert.match(cli, /root_export::ensure_root/);
  assert.match(cli, /command\.env\("LOLLY_ROOT", root\)/);
  assert.match(config.build.beforeBuildCommand, /build:cli-sidecar/);
});

test('desktop classifier forwards full verbs but reserves native run for rendering', () => {
  for (const verb of ['list', 'describe', 'batch', 'validate', 'completion', 'tui']) {
    assert.match(cli, new RegExp(`\\| \\"${verb}\\"`));
  }
  assert.match(cli, /first == "run"/);
  assert.match(cli, /Mode::Sidecar\(args\.to_vec\(\)\)/);
  assert.match(cli, /LOLLY_DESKTOP_BIN/);
});

test('Linux D-Bus Render writes a real file instead of opening a route', () => {
  const renderBody = desktop.slice(desktop.indexOf('fn render(&self'), desktop.indexOf('/// Own both bus names'));
  assert.match(renderBody, /render_server::render_via_child/, 'one definition of "render by running myself"');
  assert.match(renderBody, /written:/);
  assert.doesNotMatch(renderBody, /events\.push|opened:/);
  // The helper it calls is the thing that has to actually render, so pin that too.
  const child = renderServer.slice(renderServer.indexOf('pub fn render_via_child'));
  assert.match(child, /std::process::Command::new/);
  assert.match(child, /--output=/);
  assert.match(child, /try_wait/, 'a stuck render must not hold the bus handler open forever');
});

test('the render endpoint is a hidden mode on a loopback socket with a per-launch token', () => {
  // A leading flag the classifier does not know falls through to the GUI, so this
  // one has to be named or `--render-server` opens a window on someone's screen.
  assert.match(cli, /"--render-server" => return Mode::RenderServer/);
  assert.match(lib, /Mode::RenderServer => render_server::run\(context\)/);
  // Loopback only, on a port the operating system picks.
  assert.match(renderServer, /TcpListener::bind\(\("127\.0\.0\.1", 0\)\)/);
  assert.doesNotMatch(renderServer, /bind\(\("0\.0\.0\.0"/);
  assert.match(renderServer, /pub fn peer_allowed\(ip: IpAddr\) -> bool \{\n\s+ip\.is_loopback\(\)/);
  // The advert the Node side reads: address, credential, liveness, version.
  for (const field of ['"port"', '"token"', '"pid"', '"version"']) {
    assert.match(renderServer, new RegExp(field), `render.json must carry ${field}`);
  }
  assert.match(renderServer, /OsRng/, 'the token comes from the operating system, not a clock');
  assert.match(renderServer, /fn clear_advert/, 'a dead server must not leave an address behind');
});

test('the render endpoint and `Lolly run` open the identical off-screen window', () => {
  assert.match(cli, /pub\(crate\) fn build_offscreen_window/);
  assert.match(renderServer, /crate::cli::build_offscreen_window/);
  // And they parse a job the same way: the endpoint builds argv and hands it to the
  // one classifier, so a tool link cannot mean two things depending on the door.
  assert.match(renderServer, /crate::cli::classify\(&argv\)/);
});
