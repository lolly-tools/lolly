// SPDX-License-Identifier: MPL-2.0
// The .lolly file's type, on its own so a view can offer the file (a Share button, a
// Send probe) without loading the packer. lib/lolly-pack.ts re-exports both.
/** The `+zip` structured suffix (RFC 6839) advertises the container to OS/tooling. */
export const LOLLY_MIME = 'application/vnd.lolly+zip';
export const LOLLY_EXT = '.lolly';
