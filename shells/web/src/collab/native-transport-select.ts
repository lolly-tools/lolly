// SPDX-License-Identifier: MPL-2.0
/**
 * native-transport-select - which transport carries a private collab (plans/110 section 4).
 *
 * A pure decision, no I/O and no crypto: given the local platform, whether WebRTC even
 * exists here, the user's preference, and (when accepting) the invite's declared kind,
 * choose `'rtc'` (WebRTC data channels, the default and the only cross-shell option),
 * `'native'` (the Noise-over-TCP LAN transport of plans/110 section 4, Tauri↔Tauri only), or
 * `'none'` (no viable transport - an honest refusal, e.g. WebRTC-absent Linux with no
 * native invite to accept).
 *
 * This is the design-stable seam of N2: it does not depend on how the Noise handshake,
 * the frame grammar, or the sdp-codec wire variant are finally shaped (those are under
 * security review, see `plans/110-work/n2-design.md`). It is implemented and tested now
 * as the contract N2b's real transport construction will consult; it is deliberately
 * NOT yet wired into the ceremony/transport build.
 *
 * TWO PEERS NEVER GUESS. When accepting, the invite's `inviteKind` is the agreement - 
 * a native invite is accepted natively or not at all, a webrtc invite over WebRTC or not
 * at all. Only when MINTING a fresh invite (no `inviteKind`) does preference + platform
 * decide.
 *
 * NATIVE IS NEARBY-ONLY (security decision, 2026-08-13). The native transport connects a
 * socket, and the socket-open is restricted to a peer found by nearby discovery (an
 * address that came from an mDNS advert, not an attacker-authored token) and further to a
 * private/link-local range (plans/110 section 5). So a native invite can ONLY be MINTED for a
 * nearby pairing (`origin: 'nearby'`); a QR/link pairing (`origin: 'link'`) never yields
 * native, whatever the preference - it uses WebRTC, or refuses when WebRTC is absent.
 * A received `native` invite is by construction nearby-originated (only the nearby
 * invite-exchange frames carry the native kind - there is no native token in the QR codec),
 * so accepting needs no `origin`. Consequence, stated: a Linux/webkitgtk device with no
 * WebRTC can pair via nearby but NOT via a pasted QR link (that link has no viable
 * transport) - the safe trade, and nearby is where those devices are.
 */

/** Where this shell is running. `'web'` can never do the native transport. */
export type TransportPlatform = 'web' | 'tauri';

/** The user's transport preference (a power-user setting; `'auto'` is the default). */
export type TransportPref = 'auto' | 'prefer-lan' | 'prefer-webrtc';

/** The transport an invite declares. Absent when minting a fresh invite. */
export type InviteTransportKind = 'webrtc' | 'native';

/** How a pairing was initiated - the security-relevant input for MINTING. `'nearby'` is a
 *  peer found by discovery (address from an mDNS advert); `'link'` is a QR/link/code to an
 *  arbitrary peer. Only `'nearby'` may mint a native invite. Absent ⇒ treated as `'link'`
 *  (the conservative default: never native). Ignored when accepting (inviteKind decides). */
export type PairingOrigin = 'nearby' | 'link';

export type TransportChoice = 'rtc' | 'native' | 'none';

export interface TransportSelectInput {
  readonly localPlatform: TransportPlatform;
  /** `defaultPeerConnectionCtor() !== null` - WebRTC exists in this webview. */
  readonly webrtcAvailable: boolean;
  readonly pref: TransportPref;
  /** The received invite's declared transport, or absent when we are minting one. */
  readonly inviteKind?: InviteTransportKind;
  /** How this pairing was initiated (minting only). Absent ⇒ `'link'`. */
  readonly origin?: PairingOrigin;
}

/** Whether the native (Noise-over-TCP) transport can run here at all. */
function nativePossible(localPlatform: TransportPlatform): boolean {
  return localPlatform === 'tauri';
}

/**
 * Choose the transport. See the module header for the reasoning; the decision table:
 *
 *  - accepting a `native` invite      → native, or none if we cannot do native
 *  - accepting a `webrtc` invite      → rtc, or none if WebRTC is absent
 *  - minting on web                   → rtc if WebRTC exists, else none
 *  - minting via link (any platform)  → rtc if WebRTC exists, else none  (never native)
 *  - minting via nearby, tauri, prefer-lan    → native
 *  - minting via nearby, tauri, prefer-webrtc → rtc if available, else native
 *  - minting via nearby, tauri, auto          → rtc if available, else native
 */
export function selectTransport(input: TransportSelectInput): TransportChoice {
  const { localPlatform, webrtcAvailable, pref, inviteKind } = input;

  // Accepting: the invite is the agreement, never re-decided by local preference. A native
  // invite only exists nearby-originated, so no origin check is needed here.
  if (inviteKind === 'native') return nativePossible(localPlatform) ? 'native' : 'none';
  if (inviteKind === 'webrtc') return webrtcAvailable ? 'rtc' : 'none';

  // Minting. Web can never run native; a link pairing may never mint native (the socket-
  // open is nearby-only). Both collapse to "WebRTC or refuse".
  const origin = input.origin ?? 'link';
  if (localPlatform === 'web' || origin === 'link') return webrtcAvailable ? 'rtc' : 'none';

  // Minting via nearby on Tauri: native is on the table.
  switch (pref) {
    case 'prefer-lan':
      return 'native';
    case 'prefer-webrtc':
      return webrtcAvailable ? 'rtc' : 'native';
    case 'auto':
      return webrtcAvailable ? 'rtc' : 'native';
  }
}
