// SPDX-License-Identifier: MPL-2.0
/** Up to two Unicode letter initials; punctuation and emoji do not become initials. */
export function collabInitials(name: string): string {
  let out = '', count = 0;
  for (const word of name.trim().split(/\s+/)) {
    const letter = /\p{L}/u.exec(word)?.[0];
    if (!letter) continue;
    out += letter.toUpperCase(); if (++count === 2) break;
  }
  return out;
}
