// SPDX-License-Identifier: MPL-2.0
/**
 * SCORM packaging - the pure half (plans/180 section 6).
 *
 * A SCORM package is a zip an LMS knows how to open: `imsmanifest.xml` at the ROOT (not
 * in a folder - every LMS looks at `./`), a launch page, the content it references, and
 * a small JavaScript adapter that talks to the LMS's own API object. Everything in this
 * module is a STRING BUILDER: manifests, the adapter source, the launch page. The shell
 * zips them with the parts it renders. That split is why the CLI inherits SCORM export
 * for free, exactly as it inherits `.pptx` and `.penpot`.
 *
 * Two versions are supported and they are NOT interchangeable. SCORM 1.2 is the wide
 * floor (Moodle, SuccessFactors, Cornerstone, Docebo, TalentLMS all take it) and names
 * its API object `API`; SCORM 2004 4th Edition names it `API_1484_11`, uses a different
 * namespace set, a different data model and an ISO 8601 duration instead of 1.2's
 * `HHHH:MM:SS.SS`. One adapter covers both by finding whichever object the LMS provides
 * and speaking that dialect - see {@link scormAdapterJs}.
 *
 * The D1 launch page (the plan's recommendation) is packaged slide IMAGES driven by a
 * plain navigator, plus the narrated video with its caption track. It loses live motion
 * and gains working everywhere, offline, with no font chasing and no bundler. Every URL
 * it writes is relative: an LMS serves the package from a path nobody can predict, and
 * some proxy it, so an absolute origin is a broken package waiting to happen.
 *
 * Provenance: the narration is a synthetic voice, and an LMS shows no credential UI, so
 * the launch page carries a VISIBLE line saying so (plans/180 section 7). It is not
 * decoration - it is the only place a learner can see it.
 */

/** Which SCORM the package targets. */
export type ScormVersion = '1.2' | '2004';

/** What both manifest builders need. */
export interface ScormManifestOpts {
  /** The course title, shown in the LMS's own navigation. */
  title: string;
  /** Every file in the package, as relative paths (`index.html`, `slides/1.svg`, …).
   *  The manifest must list them all: an LMS may serve only what the resource declares. */
  files: readonly string[];
  /** Package identifier. Default `lolly-package`. Non-XML-name characters are replaced. */
  identifier?: string;
  /** The launch file. Default `index.html`. Added to `files` if it is missing. */
  href?: string;
  /** The single item's title. Defaults to `title`. */
  itemTitle?: string;
  /** The package's own version string. Default `1.0`. */
  version?: string;
}

const XML_ESC = /[&<>"']/g;
const XML_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
/** Escape for XML text and attribute values, after stripping the chars XML 1.0 forbids. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(XML_ESC, (c) => XML_MAP[c] ?? c);
}

/** Escape for an HTML text node or a double-quoted attribute. */
function hesc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * A safe XML identifier: an LMS keys its whole content tree off these, and a manifest
 * whose identifier is not a valid xsd:ID fails validation on import. Letters, digits,
 * `-`, `_` and `.` survive; everything else becomes `-`, and a leading non-letter gets a
 * prefix, because an XML name may not start with a digit.
 */
function xmlId(raw: string | undefined, fallback: string): string {
  const cleaned = String(raw ?? '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const base = cleaned || fallback;
  return /^[A-Za-z_]/.test(base) ? base.slice(0, 120) : `id-${base}`.slice(0, 120);
}

/**
 * A relative, package-internal path. A manifest may only name files inside the package,
 * so an absolute URL, a protocol-relative one, a root-relative one or anything climbing
 * out with `..` is refused rather than written into the file list.
 */
function relPath(p: unknown): string | null {
  const s = String(p ?? '').trim().replace(/^\.\//, '');
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null; // http:, https:, data:, javascript:
  if (s.startsWith('/') || s.startsWith('\\')) return null;
  if (s.split('/').some((seg) => seg === '..')) return null;
  return s;
}

/** The launch href plus every listed file, deduped, relative, in a stable order. */
function fileList(opts: ScormManifestOpts): { href: string; files: string[] } {
  const href = relPath(opts.href) ?? 'index.html';
  const seen = new Set<string>([href]);
  for (const f of opts.files ?? []) {
    const rel = relPath(f);
    if (rel) seen.add(rel);
  }
  // The launch file first (an LMS reads the list top-down when it prefetches), then the
  // rest sorted, so the same package built twice produces the same manifest.
  const rest = [...seen].filter((f) => f !== href).sort();
  return { href, files: [href, ...rest] };
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';

/**
 * The `imsmanifest.xml` for SCORM 1.2.
 *
 * The schema set is fixed by the ADL specification: the IMS content-packaging namespace
 * (`imscp_rootv1p1p2`), the ADL content-packaging extension (`adlcp_rootv1p2`) that
 * carries `scormtype`, and the IMS metadata schema that the `<metadata>` element's
 * `<schema>ADL SCORM</schema>` / `<schemaversion>1.2</schemaversion>` pair lives under.
 * One organization, one item, one `webcontent` resource of scormtype `sco` - the smallest
 * shape that is a trackable course rather than a pile of files.
 *
 * `scormtype` is LOWERCASE here and camelCase in 2004. That is not a typo on either side:
 * the two ADL schemas genuinely spell the attribute differently, and an LMS validating
 * against the schema rejects the other spelling.
 */
export function scormManifest12(opts: ScormManifestOpts): string {
  const id = xmlId(opts.identifier, 'lolly-package');
  const { href, files } = fileList(opts);
  const title = esc(opts.title || 'Presentation');
  const itemTitle = esc(opts.itemTitle || opts.title || 'Presentation');
  const version = esc(opts.version || '1.0');
  const fileTags = files.map((f) => `\n      <file href="${esc(f)}"/>`).join('');
  return (
    XML_DECL +
    `<manifest identifier="${id}" version="${version}"\n` +
    `  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"\n` +
    `  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"\n` +
    `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n` +
    `  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd` +
    ` http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd` +
    ` http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">\n` +
    `  <metadata>\n` +
    `    <schema>ADL SCORM</schema>\n` +
    `    <schemaversion>1.2</schemaversion>\n` +
    `  </metadata>\n` +
    `  <organizations default="${id}-org">\n` +
    `    <organization identifier="${id}-org">\n` +
    `      <title>${title}</title>\n` +
    `      <item identifier="${id}-item" identifierref="${id}-res" isvisible="true">\n` +
    `        <title>${itemTitle}</title>\n` +
    `      </item>\n` +
    `    </organization>\n` +
    `  </organizations>\n` +
    `  <resources>\n` +
    `    <resource identifier="${id}-res" type="webcontent" adlcp:scormtype="sco" href="${esc(href)}">${fileTags}\n` +
    `    </resource>\n` +
    `  </resources>\n` +
    `</manifest>\n`
  );
}

/**
 * The `imsmanifest.xml` for SCORM 2004 4th Edition.
 *
 * Same skeleton, different world: `imscp_v1p1` replaces `imscp_rootv1p1p2`, the ADL
 * extensions become `adlcp_v1p3` / `adlseq_v1p3` / `adlnav_v1p3`, sequencing arrives as
 * `imsss`, the schemaversion string is the literal "2004 4th Edition", and the scormType
 * attribute is camelCase. All five namespaces are declared even though this package
 * sequences nothing: an LMS that validates strictly wants the declarations its schema
 * set expects, and an unused one costs nothing.
 */
export function scormManifest2004(opts: ScormManifestOpts): string {
  const id = xmlId(opts.identifier, 'lolly-package');
  const { href, files } = fileList(opts);
  const title = esc(opts.title || 'Presentation');
  const itemTitle = esc(opts.itemTitle || opts.title || 'Presentation');
  const version = esc(opts.version || '1.0');
  const fileTags = files.map((f) => `\n      <file href="${esc(f)}"/>`).join('');
  return (
    XML_DECL +
    `<manifest identifier="${id}" version="${version}"\n` +
    `  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"\n` +
    `  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"\n` +
    `  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"\n` +
    `  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"\n` +
    `  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"\n` +
    `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n` +
    `  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd` +
    ` http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd` +
    ` http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd` +
    ` http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd` +
    ` http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">\n` +
    `  <metadata>\n` +
    `    <schema>ADL SCORM</schema>\n` +
    `    <schemaversion>2004 4th Edition</schemaversion>\n` +
    `  </metadata>\n` +
    `  <organizations default="${id}-org">\n` +
    `    <organization identifier="${id}-org">\n` +
    `      <title>${title}</title>\n` +
    `      <item identifier="${id}-item" identifierref="${id}-res">\n` +
    `        <title>${itemTitle}</title>\n` +
    `      </item>\n` +
    `    </organization>\n` +
    `  </organizations>\n` +
    `  <resources>\n` +
    `    <resource identifier="${id}-res" type="webcontent" adlcp:scormType="sco" href="${esc(href)}">${fileTags}\n` +
    `    </resource>\n` +
    `  </resources>\n` +
    `</manifest>\n`
  );
}

/** The manifest for `version`, so a caller can pass the choice through. */
export function scormManifest(version: ScormVersion, opts: ScormManifestOpts): string {
  return version === '2004' ? scormManifest2004(opts) : scormManifest12(opts);
}

/**
 * The runtime adapter, as JavaScript source (`scorm/api.js` in the package).
 *
 * ONE source for both SCORM versions, because the LMS decides which one is in play: the
 * adapter looks for `API_1484_11` (2004) and `API` (1.2) and speaks whichever dialect it
 * found. That is also why it is written by hand rather than pulled from a library - it is
 * about 2 KB, it must run in whatever ancient browser an LMS frames it in, and a package
 * that reaches for a CDN is a package that fails behind a corporate proxy.
 *
 * The API-discovery algorithm is ADL's own: walk `window.parent` upward to a depth cap,
 * then try `window.opener` and walk that. The cap matters - an LMS that frames a course
 * inside a frameset inside a portal will otherwise spin, and a self-referencing `parent`
 * (the top window's parent is itself) is an infinite loop without one.
 *
 * What it reports is deliberately small. Completion on the last slide, session time on
 * exit, and the slide index in `suspend_data` (and in the bookmark field,
 * `cmi.core.lesson_location`, which is what an LMS report shows an administrator) so a
 * learner resumes where they stopped. Only the index: 1.2 caps `suspend_data` at 4096
 * characters and 2004 at 64000, and a package that stores nothing but a number can never
 * meet either ceiling. On the way out the adapter says WHY it left: `cmi.core.exit` is
 * `suspend` for a deck left mid-way (so the LMS opens the next launch as a resume and
 * keeps the bookmark) and empty for one that was finished - a SCO that terminates
 * without saying so is, to a strict LMS, an attempt that simply ended.
 *
 * No score and no `success_status`: this deck asks no questions, and claiming a pass the
 * learner never earned would be a lie told to their training record.
 */
export function scormAdapterJs(): string {
  return `/* SCORM runtime adapter - SCORM 1.2 (API) and 2004 4th Edition (API_1484_11). */
(function (global) {
  'use strict';

  var MAX_DEPTH = 10;
  var api = null;
  var is2004 = false;
  var started = false;
  var finished = false;
  var completed = false;
  var startedAt = 0;

  function scanWindow(win) {
    var depth = 0;
    var w = win;
    while (w && depth < MAX_DEPTH) {
      try {
        if (w.API_1484_11) { is2004 = true; return w.API_1484_11; }
        if (w.API) { is2004 = false; return w.API; }
      } catch (e) { /* a cross-origin ancestor is not ours to read */ }
      if (!w.parent || w.parent === w) break;
      w = w.parent;
      depth++;
    }
    return null;
  }

  function findAPI() {
    var found = scanWindow(global);
    if (found) return found;
    try {
      if (global.opener && !global.opener.closed) found = scanWindow(global.opener);
    } catch (e) { /* an opener from another origin */ }
    return found || null;
  }

  /* args is passed through as-is: some LMS adapters check arguments.length, so a
     one-argument call must arrive as one argument. */
  function call(name12, name2004, args) {
    if (!api) return '';
    var fn = api[is2004 ? name2004 : name12];
    if (typeof fn !== 'function') return '';
    try { return fn.apply(api, args || ['']); }
    catch (e) { return ''; }
  }

  function get(key) { return call('LMSGetValue', 'GetValue', [key]); }
  function set(key, value) { return call('LMSSetValue', 'SetValue', [key, String(value)]); }
  function commit() { return call('LMSCommit', 'Commit', ['']); }

  /* 1.2 wants HHHH:MM:SS.SS; 2004 wants an ISO 8601 duration.

     ONE rounding, to centiseconds, and every field derived from it. Rounding the
     fraction on its own let 5.999 s come out as 0000:00:05.100 - three decimal digits
     where CMITimespan allows exactly two, and a whole second lost - because the seconds
     were floored separately so the carry had nowhere to go. */
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function sessionTime(secs) {
    var cs = Math.max(0, Math.round((Number(secs) || 0) * 100));
    var h = Math.floor(cs / 360000);
    var m = Math.floor((cs % 360000) / 6000);
    var s = Math.floor((cs % 6000) / 100);
    var rest = cs % 100;
    if (is2004) {
      return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + s +
        (rest ? '.' + pad(rest, 2) : '') + 'S';
    }
    /* HHHH caps at four digits; a session that long is a stuck tab, not a learner. */
    return pad(Math.min(h, 9999), 4) + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(rest, 2);
  }

  function initialize() {
    if (started) return !!api;
    api = findAPI();
    started = true;
    startedAt = Date.now();
    if (!api) return false;
    call('LMSInitialize', 'Initialize', ['']);
    /* Anything but 'completed'/'passed' may be overwritten; an LMS that already has one
       keeps it, which is why this only ever moves 'not attempted' forward. */
    var status = get(is2004 ? 'cmi.completion_status' : 'cmi.core.lesson_status');
    completed = status === 'completed' || status === 'passed';
    if (!is2004 && (!status || status === 'not attempted')) set('cmi.core.lesson_status', 'incomplete');
    if (is2004 && (!status || status === 'unknown')) set('cmi.completion_status', 'incomplete');
    commit();
    return true;
  }

  function resumeIndex() {
    var raw = get('cmi.suspend_data');
    var n = parseInt(raw, 10);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function setSlide(index, count) {
    if (!api) return;
    set('cmi.suspend_data', String(index));
    /* The bookmark, in the field an LMS shows for it. The same number as suspend_data,
       so the two can never disagree about where the learner is. */
    set(is2004 ? 'cmi.location' : 'cmi.core.lesson_location', String(index));
    if (count > 0 && index >= count - 1) {
      completed = true;
      set(is2004 ? 'cmi.completion_status' : 'cmi.core.lesson_status', 'completed');
    }
    commit();
  }

  function finish() {
    if (!api || finished) return;
    finished = true;
    var secs = Math.max(0, (Date.now() - startedAt) / 1000);
    set(is2004 ? 'cmi.session_time' : 'cmi.core.session_time', sessionTime(secs));
    /* Left mid-deck: 'suspend', so the LMS opens the next launch as a resume and keeps the
       bookmark. Finished: the normal exit ('' in 1.2, 'normal' in 2004). */
    set(is2004 ? 'cmi.exit' : 'cmi.core.exit', completed ? (is2004 ? 'normal' : '') : 'suspend');
    commit();
    call('LMSFinish', 'Terminate', ['']);
  }

  global.addEventListener('pagehide', finish, false);
  global.addEventListener('unload', finish, false);

  global.LollyScorm = {
    initialize: initialize,
    resumeIndex: resumeIndex,
    setSlide: setSlide,
    finish: finish,
    connected: function () { return !!api; },
    version: function () { return api ? (is2004 ? '2004' : '1.2') : ''; }
  };
})(window);
`;
}

/** One packaged slide image. `src` is a package-relative path. */
export interface ScormSlide {
  src: string;
  /** Alternative text - a screen reader's only access to the slide. */
  alt?: string;
  /** The speaker notes, shown under the slide. Also what was narrated. */
  notes?: string;
}

/** The narrated video and its caption sidecar, both package-relative. */
export interface ScormVideo {
  src: string;
  /** A WebVTT file, mounted as `<track kind="captions">`. */
  captions?: string;
  /** The caption track's language tag. Default `en`. */
  lang?: string;
  poster?: string;
}

/** A font the page serves itself, as a real file - never a data: URI. */
export interface ScormFont {
  family: string;
  /** A package-relative `.woff2` path. */
  src: string;
  weight?: string | number;
  style?: string;
}

/**
 * The launch page's own chrome, in the reader's language.
 *
 * The engine has no i18n by design, so every visible word arrives as a parameter or
 * falls back to English. `lang` on its own is a lie without these: a package stamped
 * `<html lang="nl">` whose buttons read "Previous"/"Next" is pronounced with Dutch
 * phonetics by a Dutch screen reader (WCAG 3.1.1/3.1.2).
 *
 * `{n}`, `{total}` and `{title}` are replaced verbatim where each label names them.
 */
export interface ScormLaunchLabels {
  /** The back button. Default `Previous`. */
  previous?: string;
  /** The forward button. Default `Next`. */
  next?: string;
  /** Alt text for a slide with none of its own. `{n}` is the slide number. */
  slide?: string;
  /** What the live region says on every slide change. `{n}` and `{total}`. */
  slideOf?: string;
  /** The caption track's menu label. Default `Captions`. */
  captions?: string;
  /** The video region's accessible name. `{title}`. */
  video?: string;
}

export interface ScormLaunchOpts {
  title: string;
  slides: readonly ScormSlide[];
  video?: ScormVideo;
  /** The page's visible words. English where a label is not given. */
  labels?: ScormLaunchLabels;
  /** The visible synthetic-voice line. Omit ONLY when there is no narration. */
  aiVoiceNote?: string;
  /** Where the adapter lives in the package. Default `scorm/api.js`. */
  adapterSrc?: string;
  /** Faces to serve with `@font-face`. woff2 FILES: a data: URI bloats the package and
   *  some LMS proxies mangle it. */
  fonts?: readonly ScormFont[];
  /** The page's language tag. Default `en`. */
  lang?: string;
}

/**
 * The D1 launch page: packaged slide images, a plain navigator, and the narrated video.
 *
 * Deliberately small and dependency-free. It is one `<img>` swapped by an index, keyboard
 * (arrows, page keys, space, home/end) and click, plus the adapter call that tells the LMS
 * where the learner is. There is no framework here because an LMS iframe is the least
 * predictable runtime we ship into: no bundler, no module loader, no network.
 *
 * Every URL is package-relative - {@link relPath} refuses anything else - because the
 * package is served from a path nobody can know in advance.
 */
export function scormLaunchHtml(opts: ScormLaunchOpts): string {
  const lang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(opts.lang ?? '')) ? String(opts.lang) : 'en';
  const title = hesc(opts.title || 'Presentation');
  const adapter = relPath(opts.adapterSrc) ?? 'scorm/api.js';
  const slides = (opts.slides ?? [])
    .map((s) => ({ src: relPath(s?.src), alt: s?.alt ?? '', notes: s?.notes ?? '' }))
    .filter((s): s is { src: string; alt: string; notes: string } => !!s.src);

  const video = opts.video && relPath(opts.video.src)
    ? {
        src: relPath(opts.video.src)!,
        captions: relPath(opts.video.captions),
        poster: relPath(opts.video.poster),
        lang: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(opts.video.lang ?? '')) ? String(opts.video.lang) : 'en',
      }
    : null;

  // The page's words. English is the fallback, never the assumption: a caller that
  // passes `lang` and no labels gets a page that says so in the wrong language, which is
  // exactly the mismatch this table exists to close.
  const lb = opts.labels ?? {};
  const word = (v: unknown, dflt: string): string => {
    const s = String(v ?? '').trim();
    return s || dflt;
  };
  const labels = {
    previous: word(lb.previous, 'Previous'),
    next: word(lb.next, 'Next'),
    slide: word(lb.slide, 'Slide {n}'),
    slideOf: word(lb.slideOf, 'Slide {n} of {total}'),
    captions: word(lb.captions, 'Captions'),
    video: word(lb.video, '{title} video'),
  };

  const fonts: Array<{ family: string; src: string; weight: string; style: string }> = [];
  for (const f of opts.fonts ?? []) {
    const family = String(f?.family ?? '').trim();
    const src = relPath(f?.src);
    if (!family || !src) continue;
    fonts.push({ family, src, weight: String(f?.weight ?? '400'), style: String(f?.style ?? 'normal') });
  }
  const faces = fonts.map((f) =>
    `@font-face{font-family:"${hesc(f.family)}";src:url("${hesc(f.src)}") format("woff2");` +
    `font-weight:${hesc(f.weight)};font-style:${hesc(f.style)};font-display:swap}`,
  ).join('\n');

  const stack = fonts.length
    ? `"${hesc(fonts[0]!.family)}", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
    : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  const slideJson = JSON.stringify(slides.map((s) => ({ src: s.src, alt: s.alt, notes: s.notes })))
    // `</script>` inside a JSON string would close the block early; `<!--` opens a
    // legacy HTML comment inside it. Both are escaped, not stripped.
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  const videoBlock = video
    ? `\n  <section class="film" aria-label="${hesc(labels.video.replace('{title}', opts.title || 'Presentation'))}">\n` +
      `    <video controls preload="metadata" src="${hesc(video.src)}"${video.poster ? ` poster="${hesc(video.poster)}"` : ''}>\n` +
      (video.captions
        ? `      <track kind="captions" src="${hesc(video.captions)}" srclang="${hesc(video.lang)}" label="${hesc(labels.captions)}" default>\n`
        : '') +
      `    </video>\n  </section>`
    : '';

  const aiNote = opts.aiVoiceNote
    ? `\n  <p class="ai-voice" role="note">${hesc(opts.aiVoiceNote)}</p>`
    : '';

  return `<!doctype html>
<html lang="${hesc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${faces}
:root { color-scheme: light dark; --ink: #16211f; --ground: #ffffff; --muted: #5b6b68; --line: #d9e0de; }
@media (prefers-color-scheme: dark) { :root { --ink: #eef3f1; --ground: #0d1614; --muted: #9fb0ac; --line: #29403b; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: var(--ground); color: var(--ink); font: 16px/1.5 ${stack}; }
h1 { font-size: 1.25rem; margin: 0 0 12px; }
.stage { position: relative; background: #000; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.stage img { display: block; width: 100%; height: auto; }
.bar { display: flex; align-items: center; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
button { font: inherit; padding: 8px 14px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
button[disabled] { opacity: .45; cursor: default; }
.count { color: var(--muted); }
.notes { white-space: pre-wrap; color: var(--muted); border-top: 1px solid var(--line); padding-top: 12px; }
/* The slide-change announcement. Off screen, never display:none - a hidden live region
   is one no screen reader reads. */
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
.ai-voice { color: var(--muted); font-size: .9rem; border-left: 3px solid var(--line); padding-left: 10px; }
.film video { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="stage"><img id="slide" alt="" tabindex="-1"></div>
<div class="bar">
  <button id="prev" type="button">${hesc(labels.previous)}</button>
  <button id="next" type="button">${hesc(labels.next)}</button>
  <span class="count"><span id="at">1</span> / <span id="of">1</span></span>
</div>
<p class="sr-only" id="live" role="status" aria-live="polite"></p>
<p class="notes" id="notes"></p>${aiNote}${videoBlock}
<script src="${hesc(adapter)}"></script>
<script>
(function () {
  'use strict';
  var SLIDES = ${slideJson};
  var L = ${JSON.stringify(labels).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')};
  var img = document.getElementById('slide');
  var at = document.getElementById('at');
  var of = document.getElementById('of');
  var live = document.getElementById('live');
  var notes = document.getElementById('notes');
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var scorm = window.LollyScorm || null;
  var i = 0;
  if (scorm) { scorm.initialize(); i = Math.min(scorm.resumeIndex(), SLIDES.length - 1); }
  if (!(i >= 0)) i = 0;

  function fill(s, n, total) {
    return String(s).replace('{n}', String(n)).replace('{total}', String(total));
  }

  function show(n) {
    if (!SLIDES.length) return;
    i = Math.max(0, Math.min(n, SLIDES.length - 1));
    var s = SLIDES[i];
    img.src = s.src;
    img.alt = s.alt || fill(L.slide, i + 1, SLIDES.length);
    notes.textContent = s.notes || '';
    at.textContent = String(i + 1);
    of.textContent = String(SLIDES.length);
    prev.disabled = i === 0;
    next.disabled = i === SLIDES.length - 1;
    /* Nothing about a slide change is visible to a screen reader otherwise: the image,
       the counter and the notes are all rewritten in place, in silence. The live region
       says where the learner now is and what is on the slide. */
    if (live) live.textContent = fill(L.slideOf, i + 1, SLIDES.length) + '. ' + img.alt;
    if (scorm) scorm.setSlide(i, SLIDES.length);
  }

  prev.addEventListener('click', function () { show(i - 1); });
  next.addEventListener('click', function () { show(i + 1); });
  img.addEventListener('click', function () { show(i + 1); });
  document.addEventListener('keydown', function (e) {
    /* The narrated film is a real media element with controls in this same document, and
       Space is its play toggle while the arrows seek it. A document-level handler that
       cancels both takes the only narrated content in the package away from anyone
       driving it from the keyboard - so a key aimed at a media element, a form control
       or a button is left entirely alone. */
    var el = e.target;
    var tag = el && el.tagName ? String(el.tagName).toUpperCase() : '';
    if (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'INPUT' || tag === 'TEXTAREA' ||
        tag === 'SELECT' || tag === 'BUTTON' || (el && el.isContentEditable)) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { show(i + 1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { show(i - 1); e.preventDefault(); }
    else if (k === 'Home') { show(0); e.preventDefault(); }
    else if (k === 'End') { show(SLIDES.length - 1); e.preventDefault(); }
  });
  show(i);
})();
</script>
</body>
</html>
`;
}
