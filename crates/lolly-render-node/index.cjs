// SPDX-License-Identifier: MPL-2.0
// @lolly-tools/render: loads the lolly-render binding built for this machine, the way
// @resvg/resvg-js loads its own. A binding beside this file (a local build) is used
// first; otherwise the platform package npm installed from the optional dependencies.
// A machine with neither gets an Error naming the package it looked for, which
// packages/node-shell/src/lolly-render.ts reports as `absent`.
'use strict';

const { existsSync } = require('node:fs');
const { join } = require('node:path');

/** glibc or musl, read the way napi-rs reads it; glibc when the report cannot be read. */
function libc() {
  try {
    const header = process.report.getReport().header;
    return header.glibcVersionRuntime ? 'gnu' : 'musl';
  } catch {
    return 'gnu';
  }
}

/** The platform package suffix for this machine, or null where none is built. */
function triple() {
  const key = `${process.platform}-${process.arch}`;
  switch (key) {
    case 'darwin-arm64': return 'darwin-arm64';
    case 'linux-x64': return `linux-x64-${libc()}`;
    case 'linux-arm64': return libc() === 'gnu' ? 'linux-arm64-gnu' : null;
    case 'win32-x64': return 'win32-x64-msvc';
    default: return null;
  }
}

const name = triple();
if (!name) throw new Error(`@lolly-tools/render has no binding for ${process.platform}-${process.arch}`);
const local = join(__dirname, `lolly-render.${name}.node`);
module.exports = existsSync(local) ? require(local) : require(`@lolly-tools/render-${name}`);
