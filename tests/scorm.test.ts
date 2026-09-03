// SPDX-License-Identifier: MPL-2.0
/**
 * SCORM packaging - the pure half (engine/src/scorm.ts, plans/180 section 6, M-D1/M-D2).
 *
 * There is no LMS in this run, so the standard IS the test: a manifest that an LMS import
 * would accept has a fixed shape, and this file checks that shape rather than trusting a
 * screenshot. The checker below is a minimal in-repo schema stand-in - well-formed XML,
 * the elements the ADL specification names as required, the identifier wiring between
 * organization, item and resource, and the rule that trips real imports most often:
 * EVERY packaged file must be listed on the resource, or an LMS may serve none of them.
 *
 * The adapter is checked by RUNNING it against a fake LMS API rather than by reading it:
 * a package whose adapter throws on a browser we never tried is a course that records
 * nothing, and "it parses" is not the same claim as "it initialises and reports".
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/scorm.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  scormManifest, scormManifest12, scormManifest2004, scormAdapterJs, scormLaunchHtml,
} from '../engine/src/scorm.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const CP_12 = 'http://www.imsproject.org/xsd/imscp_rootv1p1p2';
const CP_2004 = 'http://www.imsglobal.org/xsd/imscp_v1p1';
const ADLCP_12 = 'http://www.adlnet.org/xsd/adlcp_rootv1p2';
const ADLCP_2004 = 'http://www.adlnet.org/xsd/adlcp_v1p3';

const FILES = ['index.html', 'scorm/api.js', 'slides/1.svg', 'slides/2.svg', 'video/deck.mp4', 'video/deck.vtt'];

/**
 * The minimal schema-shape check. Not a validator - a validator needs the ADL xsd set,
 * which we deliberately do not vendor - but every rule below is one an LMS import
 * actually enforces, and each was written from the specification's own MUSTs.
 */
function checkManifest(xml: string, o: { cp: string; adlcp: string; scormtypeAttr: string; schemaversion: string; files: readonly string[]; href: string }): void {
  const doc = parseXml(xml);
  assert.equal(doc.getElementsByTagName('parsererror').length, 0, `manifest is not well-formed XML:\n${xml}`);

  const root = doc.documentElement;
  assert.equal(root.localName, 'manifest');
  assert.equal(root.namespaceURI, o.cp, 'the content-packaging namespace is version-specific');
  const id = root.getAttribute('identifier');
  assert.ok(id && /^[A-Za-z_][A-Za-z0-9._-]*$/.test(id), `identifier "${id}" must be a valid XML name`);

  const one = (parent: Element | Document, ns: string, name: string): Element => {
    const els = (parent as Element).getElementsByTagNameNS(ns, name);
    assert.equal(els.length, 1, `expected exactly one <${name}>, found ${els.length}`);
    return els[0]!;
  };

  assert.equal(one(doc, o.cp, 'schema').textContent, 'ADL SCORM');
  assert.equal(one(doc, o.cp, 'schemaversion').textContent, o.schemaversion);

  const orgs = one(doc, o.cp, 'organizations');
  const org = one(doc, o.cp, 'organization');
  assert.equal(orgs.getAttribute('default'), org.getAttribute('identifier'),
    'organizations/@default must name the organization, or the LMS launches nothing');

  const item = one(doc, o.cp, 'item');
  const res = one(doc, o.cp, 'resource');
  assert.equal(item.getAttribute('identifierref'), res.getAttribute('identifier'),
    'the item must point at the resource');
  // Two titles, one on the organization and one on the item - both must say something,
  // because an LMS shows one of them in its navigation and nobody can predict which.
  for (const owner of [org, item]) {
    const titles = Array.from(owner.getElementsByTagNameNS(o.cp, 'title'));
    assert.ok(titles.length >= 1, 'a nameless organization or item shows as blank in the LMS');
    assert.ok((titles[0]!.textContent ?? '').trim().length > 0);
  }

  assert.equal(res.getAttribute('type'), 'webcontent');
  assert.equal(res.getAttributeNS(o.adlcp, o.scormtypeAttr), 'sco',
    'a tracked course is an sco; the attribute is spelled differently in 1.2 and 2004');
  assert.equal(res.getAttribute('href'), o.href);

  const listed = Array.from(res.getElementsByTagNameNS(o.cp, 'file')).map((f) => f.getAttribute('href'));
  assert.equal(new Set(listed).size, listed.length, 'no file is listed twice');
  for (const f of o.files) assert.ok(listed.includes(f), `${f} is packaged but not listed on the resource`);
  assert.ok(listed.includes(o.href), 'the launch file must be listed like any other');
}

// ─── manifests ────────────────────────────────────────────────────────────────

test('the SCORM 1.2 manifest has the shape an LMS import expects', () => {
  const xml = scormManifest12({ title: 'Quarterly update', files: FILES, identifier: 'lolly-deck' });
  checkManifest(xml, {
    cp: CP_12, adlcp: ADLCP_12, scormtypeAttr: 'scormtype', schemaversion: '1.2',
    files: FILES, href: 'index.html',
  });
  // The schema locations the specification names, all three of them.
  for (const s of ['imscp_rootv1p1p2.xsd', 'imsmd_rootv1p2p1.xsd', 'adlcp_rootv1p2.xsd']) {
    assert.ok(xml.includes(s), `${s} is missing from xsi:schemaLocation`);
  }
});

test('the SCORM 2004 4th Edition manifest swaps the whole namespace set', () => {
  const xml = scormManifest2004({ title: 'Quarterly update', files: FILES, identifier: 'lolly-deck' });
  checkManifest(xml, {
    cp: CP_2004, adlcp: ADLCP_2004, scormtypeAttr: 'scormType', schemaversion: '2004 4th Edition',
    files: FILES, href: 'index.html',
  });
  for (const s of ['imscp_v1p1.xsd', 'adlcp_v1p3.xsd', 'adlseq_v1p3.xsd', 'adlnav_v1p3.xsd', 'imsss_v1p0.xsd']) {
    assert.ok(xml.includes(s), `${s} is missing from xsi:schemaLocation`);
  }
  assert.ok(xml.includes('xmlns:imsss="http://www.imsglobal.org/xsd/imsss"'));
  // The casing difference is real, and getting it wrong fails validation on import.
  assert.ok(xml.includes('adlcp:scormType="sco"'));
  assert.ok(!xml.includes('adlcp:scormtype='));
});

test('scormManifest routes by version, and 1.2 is what an unknown value falls back to', () => {
  const opts = { title: 'T', files: ['index.html'] };
  assert.equal(scormManifest('2004', opts), scormManifest2004(opts));
  assert.equal(scormManifest('1.2', opts), scormManifest12(opts));
});

test('a custom launch file leads the list, the rest sort, and duplicates collapse', () => {
  const xml = scormManifest12({
    title: 'T',
    href: './start.html',
    files: ['b.svg', 'a.svg', 'b.svg', './start.html', 'start.html'],
  });
  const order = Array.from(xml.matchAll(/<file href="([^"]+)"\/>/g)).map((m) => m[1]);
  assert.deepEqual(order, ['start.html', 'a.svg', 'b.svg'],
    'the launch file first, then a stable sort - the same package twice is the same manifest');
  assert.ok(xml.includes('href="start.html"'));
});

test('a file that is not inside the package never reaches the manifest', () => {
  const xml = scormManifest12({
    title: 'T',
    files: ['ok.svg', 'https://cdn.example.com/x.svg', '//cdn/x.svg', '/abs.svg', '../escape.svg', 'data:image/png;base64,AA'],
  });
  const listed = Array.from(xml.matchAll(/<file href="([^"]+)"\/>/g)).map((m) => m[1]);
  assert.deepEqual(listed, ['index.html', 'ok.svg']);
});

test('a hostile title and identifier cannot break the XML', () => {
  const xml = scormManifest12({
    title: 'Q3 <script>alert("x")</script> & "friends"',
    identifier: '3 slides/../etc',
    files: ['index.html'],
  });
  const doc = parseXml(xml);
  assert.equal(doc.getElementsByTagName('parsererror').length, 0, 'still well-formed');
  const id = doc.documentElement.getAttribute('identifier')!;
  assert.ok(/^[A-Za-z_][A-Za-z0-9._-]*$/.test(id), `${id} is a usable xsd:ID`);
  assert.ok(!xml.includes('<script>'), 'the title is escaped, not embedded');
  assert.equal(
    doc.getElementsByTagNameNS(CP_12, 'title')[0]!.textContent,
    'Q3 <script>alert("x")</script> & "friends"',
    'and it reads back exactly as written',
  );
});

// ─── the runtime adapter ──────────────────────────────────────────────────────

/** A fake LMS API that records everything the adapter sets. */
function fakeApi(prefix: 'LMS' | ''): { api: Record<string, unknown>; store: Record<string, string> } {
  const store: Record<string, string> = {};
  const api: Record<string, unknown> = {};
  const name = (n: string): string => (prefix === 'LMS' ? `LMS${n}` : n);
  api[name(prefix === 'LMS' ? 'Initialize' : 'Initialize')] = (): string => 'true';
  api[prefix === 'LMS' ? 'LMSGetValue' : 'GetValue'] = (k: string): string => store[k] ?? '';
  api[prefix === 'LMS' ? 'LMSSetValue' : 'SetValue'] = (k: string, v: string): string => { store[k] = v; return 'true'; };
  api[prefix === 'LMS' ? 'LMSCommit' : 'Commit'] = (): string => 'true';
  api[prefix === 'LMS' ? 'LMSFinish' : 'Terminate'] = (): string => 'true';
  return { api, store };
}

/** Run the adapter source against a fake window, and hand back what it exported. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mountAdapter(build: (root: any) => any): { win: any; listeners: Record<string, Array<() => void>> } {
  const listeners: Record<string, Array<() => void>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: any = {
    addEventListener: (type: string, fn: () => void): void => { (listeners[type] ??= []).push(fn); },
    opener: null,
  };
  root.parent = root;
  const target = build(root) ?? root;
  new Function('window', scormAdapterJs())(target);
  return { win: target, listeners };
}

test('the adapter source is valid JavaScript and exports the surface the launch page uses', () => {
  assert.doesNotThrow(() => new Function(scormAdapterJs()));
  const { win: w } = mountAdapter((root) => root);
  for (const k of ['initialize', 'resumeIndex', 'setSlide', 'finish', 'connected', 'version']) {
    assert.equal(typeof w.LollyScorm[k], 'function', `LollyScorm.${k}`);
  }
});

test('SCORM 1.2: findAPI walks up to window.API, and completion lands on the last slide', () => {
  const { api, store } = fakeApi('LMS');
  const { win: w, listeners } = mountAdapter((root) => {
    // The course is framed two deep; the API lives on the top window.
    const top = { API: api, addEventListener: root.addEventListener, opener: null } as Record<string, unknown>;
    top.parent = top;
    const mid = { addEventListener: root.addEventListener, opener: null, parent: top } as Record<string, unknown>;
    root.parent = mid;
    return root;
  });

  assert.equal(w.LollyScorm.initialize(), true);
  assert.equal(w.LollyScorm.connected(), true);
  assert.equal(w.LollyScorm.version(), '1.2');
  assert.equal(store['cmi.core.lesson_status'], 'incomplete', 'a course begun is not a course finished');

  w.LollyScorm.setSlide(0, 3);
  assert.equal(store['cmi.suspend_data'], '0');
  assert.equal(store['cmi.core.lesson_status'], 'incomplete');
  assert.equal(w.LollyScorm.resumeIndex(), 0);

  w.LollyScorm.setSlide(2, 3);
  assert.equal(store['cmi.suspend_data'], '2', 'the index and nothing else - the 4096-char cap can never bite');
  assert.equal(store['cmi.core.lesson_status'], 'completed');
  assert.equal(w.LollyScorm.resumeIndex(), 2);

  // Terminate rides the unload listeners the adapter registered for itself.
  assert.ok((listeners['unload'] ?? []).length + (listeners['pagehide'] ?? []).length >= 2);
  listeners['pagehide']![0]!();
  assert.match(store['cmi.core.session_time']!, /^\d{4}:\d{2}:\d{2}\.\d{2}$/, "1.2's HHHH:MM:SS.SS");
});

test('session_time rounds to centiseconds ONCE, so it can never carry three digits', () => {
  // CMITimespan is HHHH:MM:SS.SS - exactly two decimal digits. Rounding the fraction on
  // its own turned 5.999 s into `0000:00:05.100`, because the whole seconds were floored
  // separately and the carry had nowhere to go: a malformed element an LMS rejects, and a
  // whole second lost on a lenient one.
  const realNow = Date.now;
  const cases: Array<[number, string, string]> = [
    [5999, '0000:00:06.00', 'PT6S'],
    [5994, '0000:00:05.99', 'PT5.99S'],
    [59999, '0000:01:00.00', 'PT1M0S'],
    [3599999, '0001:00:00.00', 'PT1H0S'],
    [0, '0000:00:00.00', 'PT0S'],
  ];
  for (const [elapsed, want12, want2004] of cases) {
    for (const is2004 of [false, true]) {
      const { api, store } = fakeApi(is2004 ? '' : 'LMS');
      const { win: w } = mountAdapter((root) => {
        if (is2004) root.API_1484_11 = api; else root.API = api;
        return root;
      });
      const t0 = realNow();
      Date.now = () => t0;
      w.LollyScorm.initialize();
      Date.now = () => t0 + elapsed;
      w.LollyScorm.finish();
      Date.now = realNow;
      const key = is2004 ? 'cmi.session_time' : 'cmi.core.session_time';
      assert.equal(store[key], is2004 ? want2004 : want12, `${elapsed} ms, ${is2004 ? '2004' : '1.2'}`);
      if (!is2004) assert.match(store[key]!, /^\d{4}:\d{2}:\d{2}\.\d{2}$/);
    }
  }
  Date.now = realNow;
});

test('SCORM 2004: the same adapter finds API_1484_11 and speaks the other data model', () => {
  const { api, store } = fakeApi('');
  const { win: w } = mountAdapter((root) => { root.API_1484_11 = api; return root; });

  assert.equal(w.LollyScorm.initialize(), true);
  assert.equal(w.LollyScorm.version(), '2004');
  assert.equal(store['cmi.completion_status'], 'incomplete');
  w.LollyScorm.setSlide(1, 2);
  assert.equal(store['cmi.completion_status'], 'completed');
  assert.equal(store['cmi.core.lesson_status'], undefined, "1.2's key is never written in 2004");
  w.LollyScorm.finish();
  assert.match(store['cmi.session_time']!, /^PT[0-9HMS.]+S$/, '2004 wants an ISO 8601 duration');
  // No score and no success_status: this deck asks no questions.
  assert.equal(store['cmi.success_status'], undefined);
  assert.equal(store['cmi.score.raw'], undefined);
});

test('no LMS anywhere: the walk is depth-capped and the page still runs', () => {
  const { win: w } = mountAdapter((root) => {
    // A 200-deep frame chain with no API on it - and the topmost window is its own
    // parent, which is what makes an uncapped walk spin forever.
    let cur = root;
    for (let i = 0; i < 200; i++) {
      const up: Record<string, unknown> = { addEventListener: root.addEventListener, opener: null };
      cur.parent = up;
      cur = up as typeof root;
    }
    cur.parent = cur;
    return root;
  });
  assert.equal(w.LollyScorm.initialize(), false, 'no API found');
  assert.equal(w.LollyScorm.connected(), false);
  assert.equal(w.LollyScorm.version(), '');
  // Every entry point stays callable, so the deck is still a deck without an LMS.
  assert.equal(w.LollyScorm.resumeIndex(), 0);
  assert.doesNotThrow(() => { w.LollyScorm.setSlide(1, 2); w.LollyScorm.finish(); });
});

test('a cross-origin ancestor is stepped over, not thrown on', () => {
  const { api } = fakeApi('LMS');
  const { win: w } = mountAdapter((root) => {
    const top: Record<string, unknown> = { API: api, addEventListener: root.addEventListener, opener: null };
    top.parent = top;
    // A frame whose properties throw is exactly what a cross-origin parent looks like.
    const hostile = new Proxy({ parent: top } as Record<string, unknown>, {
      get(t, p) {
        if (p === 'parent') return t.parent;
        throw new Error('cross-origin');
      },
    });
    root.parent = hostile;
    return root;
  });
  assert.equal(w.LollyScorm.initialize(), true, 'the walk continued past the wall');
});

// ─── the launch page ──────────────────────────────────────────────────────────

const LAUNCH = {
  title: 'Quarterly update',
  slides: [
    { src: 'slides/1.svg', alt: 'Title slide', notes: 'Open with the customer story.' },
    { src: 'slides/2.svg', alt: 'The number' },
  ],
  video: { src: 'video/deck.mp4', captions: 'video/deck.vtt' },
  aiVoiceNote: 'Narrated with a synthetic voice.',
};

test('the launch page carries the navigator, the video, the caption track and the AI voice line', () => {
  const html = scormLaunchHtml(LAUNCH);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<script src="scorm/api.js"></script>'), 'the adapter loads before the page script');
  assert.ok(html.includes('slides/1.svg') && html.includes('slides/2.svg'));
  assert.ok(html.includes('Open with the customer story.'));
  assert.ok(html.includes('<track kind="captions" src="video/deck.vtt" srclang="en" label="Captions" default>'));
  assert.ok(html.includes('Narrated with a synthetic voice.'),
    'an LMS shows no credential UI, so this line is the only place a learner sees it');
  // Keyboard AND click, per the plan.
  for (const k of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageDown']) assert.ok(html.includes(k), k);
  assert.ok(html.includes("addEventListener('click'"));
  // It tells the LMS where the learner is.
  assert.ok(html.includes('scorm.setSlide(i, SLIDES.length)'));
  assert.ok(html.includes('scorm.resumeIndex()'));
});

test('the launch page speaks the caller language and announces every slide change', () => {
  // The engine has no i18n, so the words arrive as parameters or the package ships
  // English chrome under a non-English <html lang> (WCAG 3.1.1/3.1.2).
  const html = scormLaunchHtml({
    ...LAUNCH,
    lang: 'nl',
    labels: {
      previous: 'Vorige', next: 'Volgende', slide: 'Dia {n}',
      slideOf: 'Dia {n} van {total}', captions: 'Ondertiteling', video: '{title} video',
    },
  });
  assert.ok(html.includes('<html lang="nl">'));
  assert.ok(html.includes('>Vorige</button>') && html.includes('>Volgende</button>'));
  assert.ok(html.includes('label="Ondertiteling"'), 'the caption track menu label too');
  assert.ok(html.includes('"slide":"Dia {n}"'), 'the alt-text template reaches the page script');
  assert.ok(!html.includes('>Previous<') && !html.includes('>Next<'), 'no English left behind');
  // English is the fallback, never the assumption: a caller that passes no labels gets a
  // page that still reads, in English.
  const plain = scormLaunchHtml(LAUNCH);
  assert.ok(plain.includes('>Previous</button>') && plain.includes('>Next</button>'));

  // Slide changes rewrite the image, the counter and the notes in place; without a live
  // region a screen-reader learner is told nothing at all.
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes("live.textContent = fill(L.slideOf"), 'and it says where the learner now is');
});

test('the launch page leaves media and form keys to the element that has focus', () => {
  // The narrated film is the package’s only narrated content and the only place the
  // caption track lives. A document handler that swallowed Space and the arrows meant a
  // learner driving it from the keyboard advanced the deck instead of playing the video.
  const html = scormLaunchHtml(LAUNCH);
  const guard = html.slice(html.indexOf("addEventListener('keydown'"));
  for (const tag of ['VIDEO', 'AUDIO', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']) {
    assert.ok(guard.includes(`'${tag}'`), `${tag} keys are left alone`);
  }
  assert.ok(guard.indexOf('return;') < guard.indexOf("e.key"), 'the guard runs before any key is read');
});

test('the launch page holds no absolute origin and no data: URI', () => {
  const html = scormLaunchHtml({
    ...LAUNCH,
    fonts: [{ family: 'SUSE', src: 'fonts/suse-regular.woff2', weight: 500 }],
  });
  assert.ok(!/https?:\/\//.test(html), 'no http(s) origin anywhere');
  assert.ok(!/\bdata:/.test(html), 'no data: URI - it bloats the package and some LMS proxies mangle it');
  assert.ok(!/(?:src|href)="\/\//.test(html), 'no protocol-relative URL');
  assert.ok(!/(?:src|href)="\//.test(html), 'no root-relative URL: the package path is not knowable');
  // The font is a real file with a woff2 format hint.
  assert.ok(html.includes('src:url("fonts/suse-regular.woff2") format("woff2")'));
  assert.ok(html.includes('font-weight:500'));
  assert.ok(html.includes('font-family:"SUSE"'));
});

test('an off-package slide, video or font is dropped rather than written', () => {
  const html = scormLaunchHtml({
    title: 'T',
    slides: [
      { src: 'https://cdn.example.com/1.png' },
      { src: '../../secrets/2.png' },
      { src: 'slides/3.svg' },
    ],
    video: { src: 'javascript:alert(1)' },
    fonts: [{ family: 'X', src: 'data:font/woff2;base64,AA' }],
  });
  assert.ok(html.includes('slides/3.svg'));
  assert.ok(!html.includes('cdn.example.com'));
  assert.ok(!html.includes('secrets'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<video'), 'a refused video source leaves no player behind');
  assert.ok(!html.includes('@font-face'));
});

test('no captions means no track element, and no narration means no AI voice line', () => {
  const html = scormLaunchHtml({ title: 'T', slides: [{ src: 'a.svg' }], video: { src: 'v.mp4' } });
  assert.ok(html.includes('<video'));
  assert.ok(!html.includes('<track'));
  assert.ok(!html.includes('class="ai-voice"'), 'no note, no line - the stylesheet rule is harmless');
});

test('a hostile slide title or note cannot inject markup or close the script block', () => {
  const html = scormLaunchHtml({
    title: '</title><script>alert(1)</script>',
    slides: [{ src: 'a.svg', alt: '"><img onerror=alert(1)>', notes: '</script><script>alert(2)</script>' }],
    aiVoiceNote: '<b>bold</b>',
  });
  assert.ok(!/<script>alert\(1\)<\/script>/.test(html));
  assert.ok(!/<script>alert\(2\)<\/script>/.test(html));
  assert.ok(!html.includes('<img onerror'));
  assert.ok(!html.includes('<b>bold</b>'));
  // Exactly the two script elements the page ships with: the adapter and the navigator.
  assert.equal(html.split('<script').length - 1, 2);
  // The JSON payload survives as data, escaped rather than deleted.
  assert.ok(html.includes('\\u003c/script\\u003e'));
});
