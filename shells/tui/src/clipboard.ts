// SPDX-License-Identifier: MPL-2.0
/**
 * System clipboard for the terminal. The CLI bridge deliberately stubs `host.clipboard`
 * (a headless render has nowhere to paste), but an INTERACTIVE session does: when someone
 * copies a colour value or a de-identified map out of a live utility, it should land on
 * the real OS clipboard. Shells out to the platform tool (pbcopy / clip / wl-copy / xclip
 * / xsel) - no dependency, and a clean `false` when none is present rather than a throw.
 */
import { spawn } from 'node:child_process';

interface ClipCmd { cmd: string; args: string[] }

function candidates(): ClipCmd[] {
  if (process.platform === 'darwin') return [{ cmd: 'pbcopy', args: [] }];
  if (process.platform === 'win32') return [{ cmd: 'clip', args: [] }];
  // Linux/BSD: Wayland first, then X11 helpers.
  return [
    { cmd: 'wl-copy', args: [] },
    { cmd: 'xclip', args: ['-selection', 'clipboard'] },
    { cmd: 'xsel', args: ['--clipboard', '--input'] },
  ];
}

/** Pipe `text` into one clipboard command; resolves true on a clean exit. */
function pipeTo({ cmd, args }: ClipCmd, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] }); }
    catch { resolve(false); return; }
    child.on('error', () => resolve(false));               // command not found
    child.on('close', (code) => resolve(code === 0));
    try { child.stdin?.end(text); } catch { resolve(false); }
  });
}

/** Copy text to the OS clipboard. Returns false if no clipboard tool is available. */
export async function copyToClipboard(text: string): Promise<boolean> {
  for (const c of candidates()) {
    if (await pipeTo(c, text)) return true;
  }
  return false;
}
