// SPDX-License-Identifier: MPL-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {headingId} from '../packages/docs-render/src/index.ts';
import {SECTION_MOVES,movedSectionLinks} from '../docs/section-moves.ts';

// A move can point at any registered page, including a Work guide whose source lives under
// docs/work/, so the destination is read from the page's registered source, not its slug.
const SOURCES = new Map<string,string>((JSON.parse(readFileSync(new URL('../docs/manifest.json',import.meta.url),'utf8')).pages as {slug:string;src:string}[]).map(p => [p.slug,p.src]));

test('every moved section bookmark has a real destination heading and a no-script link', () => {
  for (const [source,moves] of Object.entries(SECTION_MOVES)) {
    const html = movedSectionLinks(source,slug=>`/info/${slug}.html`);
    for (const [anchor,target] of Object.entries(moves)) {
      const md = readFileSync(new URL(`../docs/${SOURCES.get(target.slug) ?? `${target.slug}.md`}`,import.meta.url),'utf8');
      let fenced = false; const headings:string[]=[];
      for (const line of md.split('\n')) {
        if (/^\s*```/.test(line)) fenced=!fenced;
        if (fenced) continue;
        const heading = /^#{1,4} (.*)$/.exec(line);
        if (heading) headings.push(headingId(heading[1]!,headings.length));
      }
      assert.ok(headings.includes(target.anchor),`${source}#${anchor} points to a missing heading in ${target.slug}`);
      assert.ok(html.includes(`id="${anchor}"`),`${source}#${anchor} has no fallback anchor`);
      assert.ok(html.includes(`href="/info/${target.slug}.html#${target.anchor}"`));
    }
    assert.match(html,/Object\.prototype\.hasOwnProperty\.call/);
  }
});
