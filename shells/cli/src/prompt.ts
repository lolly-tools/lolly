// SPDX-License-Identifier: MPL-2.0
/**
 * The one interactive prompt this CLI has: a passphrase, read from the terminal
 * with echo off.
 *
 * It exists because the alternatives are worse. A passphrase on the command line is
 * in `ps`, in `~/.zsh_history`, and in the CI log. A passphrase on stdin collides
 * with `--password-stdin` (there is only one stdin) and with a piped render. So an
 * encrypted signing key takes its passphrase from `$LOLLY_SIGN_KEY_PASSWORD` in
 * automation, and from this prompt when a human is sitting there.
 *
 * NOT a fallback: with no TTY it returns undefined immediately rather than hanging a
 * pipeline forever waiting on input that will never arrive. That refusal is the whole
 * reason this is a function and not a bare readline call.
 *
 * Reads and writes /dev/tty-equivalent streams only through process.stdin/stderr - 
 * the prompt goes to STDERR, because stdout carries the payload (contract section 0).
 */

/**
 * Prompt for a passphrase with echo suppressed. Resolves to undefined when there is
 * no interactive terminal, which callers treat as "no passphrase available".
 */
export async function promptPassphrase(label: string): Promise<string | undefined> {
  const stdin = process.stdin;
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return undefined;
  process.stderr.write(`${label}: `);
  return new Promise<string | undefined>((resolvePw) => {
    let buf = '';
    const done = (value: string | undefined): void => {
      stdin.setRawMode!(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stderr.write('\n');
      resolvePw(value);
    };
    const onData = (chunk: Buffer): void => {
      for (const byte of chunk) {
        if (byte === 0x03) { done(undefined); return; }            // ctrl-c
        if (byte === 0x0d || byte === 0x0a) { done(buf || undefined); return; }
        if (byte === 0x7f || byte === 0x08) { buf = buf.slice(0, -1); continue; }
        buf += String.fromCharCode(byte);
      }
    };
    stdin.setRawMode!(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
