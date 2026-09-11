// SPDX-License-Identifier: MPL-2.0
/**
 * A calm, one-line console note for an EXPECTED, benign condition: the "de-alarm"
 * path. Unlike console.warn (a real problem, yellow triangle) or console.error, this
 * is a plain styled log, so an expected state (an unsigned local catalog, a shell that
 * cannot decode audio, a feature a build omits) informs a developer without reading as
 * a failure. Keep the message to ONE line; for a genuine problem use console.warn /
 * console.error, which are never dressed down.
 */
export function notice(msg: string): void {
  console.log(`%c🍭 ${msg}`, "color:#8a94a0;font:12px 'SUSE',ui-monospace,system-ui,sans-serif");
}
