// SPDX-License-Identifier: MPL-2.0
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [shell, ...args] = process.argv.slice(2);
if (shell !== 'mobile' && shell !== 'desktop') throw new Error('Choose mobile or desktop.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = shell === 'desktop' && args[0] === 'build' || shell === 'mobile' && ['android', 'ios'].includes(args[0] ?? '') && args[1] === 'build';
const forwarded = build
  ? [join(root, 'scripts/build-native.ts'), shell, shell === 'desktop' ? 'build' : args[0]!, ...args.slice(shell === 'desktop' ? 1 : 2)]
  : [join(root, `shells/tauri-${shell}/node_modules/@tauri-apps/cli/tauri.js`), ...args];
const child = spawn(process.execPath, forwarded, { cwd: join(root, `shells/tauri-${shell}`), stdio: 'inherit' });
const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
process.exitCode = await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
