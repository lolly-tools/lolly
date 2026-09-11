// SPDX-License-Identifier: MPL-2.0
/**
 * Terminal logging for the long-running maintainer scripts (scripts/gate.ts,
 * scripts/ship.ts).
 *
 * Ported from the colour and logging helpers in scripts/subrepo/config.sh, which
 * the subrepo collapse (plan 244) removed along with the rest of the bash toolkit.
 * The gate and the ship script print for minutes at a time, so a run has to be
 * readable at a glance: a banner per command, a phase per section, and one line
 * per step with a mark that says how it went.
 *
 * Colour degrades to plain text when stdout is not a TTY or when NO_COLOR is set
 * (https://no-color.org), so `pnpm run gate > gate.log` stays clean.
 */

const plain = !process.stdout.isTTY || !!process.env.NO_COLOR;

const c = (code: string) => (plain ? '' : `\u001b[${code}m`);

const reset = c('0');
const bold = c('1');
const dim = c('2');
const ital = c('3');
const grn = c('38;5;42');
const teal = c('38;5;44');
const cyan = c('38;5;51');
const yel = c('38;5;220');
const red = c('38;5;203');
const purple = c('38;5;177');
const gray = c('38;5;245');

/** Width for the decorative rules: terminal columns, capped, with a fallback. */
function ruleWidth(): number {
  const cols = process.stdout.columns;
  const w = Number.isFinite(cols) && (cols as number) > 0 ? (cols as number) : 60;
  return Math.min(w, 64);
}

/** A thin full-width divider. */
export function rule(): void {
  console.log(`${dim}${teal}${'─'.repeat(ruleWidth())}${reset}`);
}

/** The spaced header block for a top-level command. */
export function banner(emoji: string, title: string, subtitle?: string): void {
  console.log('');
  console.log(`  ${emoji}  ${bold}${grn}${title}${reset}`);
  if (subtitle) console.log(`     ${gray}${ital}${subtitle}${reset}`);
  rule();
}

/** A section divider with breathing room above it. */
export function phase(emoji: string, title: string): void {
  console.log('');
  console.log(`${bold}${purple}${emoji}  ${title}${reset}`);
}

/** An in-progress action line. */
export function step(text: string): void {
  console.log(`  ${teal}▸${reset} ${dim}${text}…${reset}`);
}

export function info(text: string): void {
  console.log(`  ${gray}${text}${reset}`);
}

export function ok(text: string): void {
  console.log(`  ${grn}✓${reset} ${text}`);
}

export function warn(text: string): void {
  console.log(`  ${yel}▲${reset} ${yel}${text}${reset}`);
}

export function err(text: string): void {
  console.error(`  ${red}✗${reset} ${red}${text}${reset}`);
}

/** One live site in a ship summary. */
export function site(text: string): void {
  console.log(`     ${cyan}🌐  ${text}${reset}`);
}

/** The headline line of an end-of-run tally. */
export function tally(good: boolean, text: string): void {
  console.log(`  ${bold}${good ? grn : red}${text}${reset}`);
}
