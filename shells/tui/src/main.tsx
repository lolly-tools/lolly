// SPDX-License-Identifier: MPL-2.0
/**
 * TUI entry - build the Node bridge, load the tool catalog, hand both to the Ink app,
 * and run it FULL-SCREEN: we switch the terminal to its alternate screen buffer (like
 * vim/htop) on start and restore it on exit, so the app owns the whole screen and the
 * scrollback isn't polluted. `npm run tui` (tsx) launches this; it needs a real TTY.
 */
import { render } from 'ink';
import { App } from './App.tsx';
import { createTuiBridge } from './bridge.ts';
import { loadTools } from './catalog.ts';
import { nodeStartSeen } from '@lolly-tools/node-shell/design-systems';

const ENTER_ALT = '\x1b[?1049h\x1b[2J\x1b[H';   // alt buffer + clear + home
const LEAVE_ALT = '\x1b[?1049l';

async function main(): Promise<void> {
  if (!process.stdout.isTTY) {
    process.stderr.write('lolly-tui needs an interactive terminal (TTY). Run it directly, e.g. `npm run tui`.\n');
    process.exit(1);
  }
  const [bridge, tools, startSeen] = await Promise.all([createTuiBridge(), loadTools(), nodeStartSeen()]);

  process.stdout.write(ENTER_ALT);
  let restored = false;
  const restore = (): void => { if (restored) return; restored = true; process.stdout.write(LEAVE_ALT); };
  // Restore the main screen however we leave - clean quit, crash, or signal.
  process.on('exit', restore);
  process.on('SIGINT', () => { restore(); process.exit(0); });
  process.on('SIGTERM', () => { restore(); process.exit(0); });

  const { waitUntilExit } = render(<App tools={tools} bridge={bridge} firstRun={!startSeen} />);
  await waitUntilExit();
  restore();
  // Tear down the browser render tier if it was ever launched (lazy singletons -
  // no-ops when the session never rendered a raster/pdf/URL capture).
  const [{ closeBrowser }, { closeWebShell }] = await Promise.all([
    import('@lolly-tools/node-shell/browsers'), import('@lolly-tools/node-shell/webshell-render'),
  ]);
  await Promise.all([closeBrowser(), closeWebShell()]);
}

main().catch(err => {
  process.stdout.write(LEAVE_ALT);
  process.stderr.write('lolly-tui failed to start: ' + ((err as Error)?.stack ?? String(err)) + '\n');
  process.exit(1);
});
