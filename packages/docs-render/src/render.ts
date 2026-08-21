// The shared docs body renderer: the inline pass and the block loop, plus the two
// fence handlers (::: showcase / ::: figure). Ported verbatim from docs/build.ts, with
// every impure call routed through the injected DocsRenderContext so the static build
// and the in-app docs view emit byte-identical markup. The essential bits - inline()'s
// pass order, mdToHtml's headingOrdinal locality, and the ::: fence depth counter - are
// preserved exactly. See plan this-is-a-very-sparkling-eich, M0b.

import { esc } from './esc.ts';
import { PROV_SEAL, headingId, parseCells, stripAuthoringComments } from './markdown.ts';
import { renderCredential } from './credential.ts';
import { parseFigureFence, figureBlock } from './art.ts';
import type { DocsRenderContext } from './context.ts';

// The "Try it in the app" link that trails a shot wrapper. ctx.tryLink returns the route
// (only when the recipe opted in AND the route is domain-relative), or null.
function shotTry(file: string, ctx: DocsRenderContext): string {
  const link = ctx.tryLink(file);
  return link ? `<a class="shot-try" href="${esc(link.route)}">${esc(ctx.t('Try it in the app'))}</a>` : '';
}

export function inline(text: string, ctx: DocsRenderContext): string {
  let s = esc(text);
  // One fact the recipe carries that the rewritten `src` cannot: the dark twin to pair
  // with. Collected in the recipe pass below and read by the wrapper pass in the same
  // call, so a plain local map is the whole mechanism.
  const darkFor = new Map<string, string>();
  // An inline code span that IS an app route becomes a link to it. Deliberately narrow:
  // the span must be a WHOLE route and nothing else, so placeholder forms stay plain text.
  s = s.replace(/`([^`]+)`/g, (_m: string, code: string) => {
    const route = /^(#\/[\w/?=&%.,+-]*|\/t\/[\w/?=&%.,+-]+)$/.test(code)
      ? (code.startsWith('#') ? `/${code}` : code)
      : null;
    return route ? `<a href="${route}"><code>${code}</code></a>` : `<code>${code}</code>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Screenshot recipes: an image whose URL is a url-shot tool link IS the shot's recipe;
  // the page serves the committed baseline at /info/shots/<filename>.<format>. The param
  // is `recipe`, NOT `src` - a `src` param would shadow the wrapper pass's darkFor key.
  s = s.replace(/(!\[[^\]]*\]\()(\/t\/url-shot\?[^)\s]+)(\))/g, (_m, pre: string, recipe: string, post: string) => {
    // The body is HTML-escaped by now, so the query separators read `&amp;`; restore them.
    const q = new URLSearchParams(recipe.slice(recipe.indexOf('?') + 1).replace(/&amp;/g, '&'));
    const slug = q.get('filename');
    const ext = (q.get('format') || 'svg').toLowerCase();
    if (!slug) return `${pre}${recipe}${post}`;
    const file = ctx.localizedShot(slug, ext) ?? `${slug}.${ext}`;
    const shotSrc = `/info/shots/${file}`;
    const dark = ctx.darkShot(file);
    if (dark) darkFor.set(shotSrc, `/info/shots/${dark}`);
    return `${pre}${shotSrc}${post}`;
  });

  // Provenance pills: `%entity{…}` `%sig{…}` `%act{…}` `%file{…}` `%detail{…}`. Nesting is
  // one level, resolved inner-first by re-running until the text stops changing.
  for (let pass = 0; pass < 4; pass++) {
    const next = s.replace(/%(entity|sig|act|file|detail)\{([^{}]*)\}/g,
      (_m, kind: string, txt: string) => `<span class="prov-pill prov-${kind}">${kind === 'sig' ? PROV_SEAL : ''}${txt}</span>`);
    if (next === s) break;
    s = next;
  }
  const leftover = /%(entity|sig|act|file|detail)\{/.exec(s);
  if (leftover) console.warn(`⚠  unrendered provenance marker "%${leftover[1]}{" - check for an unclosed brace or deeper nesting`);

  // Images before links, or the link regex eats `[alt](url)` and strands the `!`. The alt
  // is STRIPPED of markup first (inline code/emphasis already ran).
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) =>
    `<img src="${src}" alt="${alt.replace(/<[^>]*>/g, '').replace(/"/g, '&quot;')}" loading="lazy">`);
  // A screenshot gets a wrapper: a positioned parent for the settle motion + credential.
  s = s.replace(/<img src="(\/info\/shots\/[^"]+)"([^>]*)>/g, (_m, src: string, rest: string) => {
    const file = src.slice('/info/shots/'.length);
    const size = ctx.shotSize(file);
    const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
    // The dark twin ships as a SECOND <img> (the site's dark mode is a class the reader
    // toggles, so a `prefers-color-scheme` source would ignore that toggle).
    const darkSrc = darkFor.get(src);
    let twin = '';
    if (darkSrc) {
      const dfile = darkSrc.slice('/info/shots/'.length);
      const dsize = ctx.shotSize(dfile);
      // Measured from the DARK file, never reused (the 0x0 deadlock).
      const ddims = dsize ? ` width="${dsize.w}" height="${dsize.h}"` : '';
      // Its OWN credential: the two files are separately signed.
      twin = `<img class="shot-alt" src="${darkSrc}"${ddims}${rest}>`
        + renderCredential(ctx.credential(dfile), { file: dfile, extraClass: 'shot-cred--alt', fromPresent: false }, ctx);
    }
    const cls = `shot${darkSrc ? ' shot--dual' : ''}`;
    return `<span class="${cls}" data-shot="${src}"${darkSrc ? ` data-shot-dark="${darkSrc}"` : ''}>`
      + `<img src="${src}"${dims}${rest}>`
      + renderCredential(ctx.credential(file), { file, extraClass: '', fromPresent: false }, ctx)
      + `${twin}</span>${shotTry(file, ctx)}`;
  });
  // A page ASSET that is not a screenshot (the AI stance hero, say) gets the same wrapper
  // and credential glyph, read from the same served bytes. Assets with no readable
  // credential fall through unchanged.
  s = s.replace(/<img src="(\/info\/(?!shots\/)[^"]+\.(?:webp|png|jpe?g|avif))"([^>]*)>/g, (_m, src: string, rest: string) => {
    const file = src.slice('/info/'.length);
    const cred = renderCredential(ctx.credential(file, { assetSrc: src }), { file, extraClass: 'shot-cred--asset', fromPresent: true }, ctx);
    // Untouched, not re-emitted: an asset with no credential keeps the exact tag the image
    // pass produced, so this rewrite can only ever ADD a wrapper.
    if (!cred) return _m;
    const size = ctx.shotSize(file, src);
    const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
    // NOT `.shot`: that class carries the screenshot settle; page artwork is not a screenshot.
    return `<span class="asset-cred" data-shot="${src}"><img src="${src}"${dims}${rest}>${cred}</span>`;
  });
  // External links (absolute http/https) open in a new tab; internal/relative links stay.
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) =>
    /^https?:\/\//i.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
      : `<a href="${url}">${label}</a>`);
  // Technology marks: `<!--l:helm-->` → the mark, inline. Matched POST-esc
  // (`&lt;!--l:key--&gt;`) and LAST, so the emitted <svg> path `d=` meets no further regex.
  s = s.replace(/&lt;!--l:([a-z0-9-]+)--&gt;/g, (_m, key: string) => ctx.docLogo(key));
  return s;
}

// `::: showcase` - a vector shot inlined so scroll can drive its real viewBox. Bails to a
// plain <img> screenshot (never drops the shot) when it cannot be inlined.
function buildShowcase(body: string, ctx: DocsRenderContext): string {
  const recipe = /!\[([^\]]*)\]\((\/t\/url-shot\?[^)\s]+)\)/.exec(body);
  const caption = body.replace(recipe?.[0] ?? '', '').trim();
  const bail = (why: string) => {
    console.warn(`⚠  ::: showcase - ${why}; falling back to a plain screenshot`);
    return mdToHtml(body, ctx);
  };
  if (!recipe) return bail('no url-shot recipe line inside the fence');

  const q = new URLSearchParams(recipe[2]!.slice(recipe[2]!.indexOf('?') + 1));
  const slug = q.get('filename');
  const fmt = (q.get('format') || 'svg').toLowerCase();
  if (!slug) return bail('the recipe has no filename= param');
  if (fmt !== 'svg') return bail(`${slug} is captured as ${fmt} - only a vector shot can be inlined`);

  const show = ctx.showcase(slug);
  if (!show) return bail(`docs/shots/${slug}.svg is not captured, or has no usable viewBox`);

  const alt = esc(recipe[1] ?? '');
  const dims = show.width && show.height ? ` width="${show.width}" height="${show.height}"` : '';
  return `<figure class="showcase" data-viewbox="${show.viewBox}" data-shot="${show.src}">
  <div class="showcase-stage"><img src="${show.src}" alt="${alt}"${dims} class="showcase-fallback">${renderCredential(ctx.credential(show.file), { file: show.file, extraClass: '', fromPresent: false }, ctx)}</div>
  ${caption ? `<figcaption>${mdToHtml(caption, ctx)}</figcaption>` : ''}
</figure>`;
}

// `::: figure <id>` - a banked figure inlined into the prose it supports. Unknown
// id / unreadable art → a loud warning and nothing rendered (the prose still stands alone).
function buildFigure(id: string, body: string, ctx: DocsRenderContext): string {
  const art = ctx.art('figures', id);
  if (!art) {
    console.warn(`⚠  ::: figure ${id} - no docs/figures/${id}.svg or .html (or it did not inline); nothing rendered`);
    return '';
  }
  const caption = body.trim();
  const cred = renderCredential(ctx.credential(art.file, { assetSrc: art.src, art: true }), { file: art.file, extraClass: 'shot-cred--figure', fromPresent: true }, ctx);
  if (!cred) console.warn(`⚠  ::: figure ${id} - ${art.file} carries no readable Content Credential; run 'node scripts/sign-docs-art.ts'`);
  return figureBlock({
    art: art.html,
    caption: caption ? mdToHtml(caption, ctx) : '',
    credential: cred,
    src: art.src,
  });
}

export function mdToHtml(md: string, ctx: DocsRenderContext): string {
  const lines = stripAuthoringComments(md).split('\n');
  const out: string[] = [];
  let headingOrdinal = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // `::: cols` … `:::` puts the sections inside side by side, splitting at each `## `
    // heading. Falls back to normal stacked rendering on narrow screens via CSS alone.
    if (line.trim().startsWith(':::')) {
      const label = line.trim().slice(3).trim();
      i++;
      const inner: string[] = [];
      // Depth-aware so a fence can hold another one (a timeline inside a column).
      let depth = 1;
      while (i < lines.length) {
        const t = lines[i]!.trim();
        if (t.startsWith(':::') && t.length > 3) depth++;
        else if (t === ':::') { depth--; if (!depth) break; }
        inner.push(lines[i]!); i++;
      }
      i++; // the closing fence
      const body = inner.join('\n');
      if (label === 'cols') {
        const parts = body.split(/\n(?=## )/).filter(p => p.trim());
        out.push(`<div class="md-cols">${parts.map(part => `<div class="md-col">${mdToHtml(part, ctx)}</div>`).join('')}</div>`);
      } else if (label === 'timeline') {
        out.push(`<div class="md-timeline">${mdToHtml(body, ctx)}</div>`);
      } else if (label === 'showcase') {
        out.push(buildShowcase(body, ctx));
      } else if (parseFigureFence(label)) {
        out.push(buildFigure(parseFigureFence(label)!, body, ctx));
      } else {
        out.push(mdToHtml(body, ctx));
      }
      continue;
    }

    // A whole-line `<!--lb:kubernetes helm-->` is a block of its own.
    const lb = /^<!--lb:([a-z0-9 -]+)-->$/.exec(line.trim());
    if (lb) {
      out.push(ctx.docLogoBlock(lb[1]!.trim().split(/\s+/)));
      i++; continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) { code.push(lines[i]!); i++; }
      i++;
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    const hm = line.match(/^(#{1,4}) (.+)/);
    if (hm) {
      const lvl = hm[1]!.length, text = hm[2]!;
      const id = headingId(text, ++headingOrdinal);
      out.push(`<h${lvl} id="${id}">${inline(text, ctx)}</h${lvl}>`);
      i++; continue;
    }

    if (line.startsWith('> ')) {
      // Join hard-wrapped quote lines into real paragraphs (a bare `>` line separates).
      const ql: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) { ql.push(lines[i]!.replace(/^>\s?/, '')); i++; }
      const paras = ql.join('\n').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      out.push(`<blockquote>${paras.map(p => `<p>${inline(p, ctx)}</p>`).join('')}</blockquote>`);
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

    // A standalone self-closing <img …/> line (the README hero icon). All other raw HTML
    // stays escaped by design; a whitelisted attribute set is re-emitted, re-escaped.
    const im = line.trim().match(/^<img\s+([^<>]*?)\/?>$/i);
    if (im) {
      const attrs: Record<string, string> = {};
      for (const m of im[1]!.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]!.toLowerCase()] = m[2]!;
      const rawSrc = attrs['src'] ?? '';
      const isHttp = /^https?:\/\//i.test(rawSrc);
      const isSchemeless = !/^[a-z][a-z+.-]*:/i.test(rawSrc); // no javascript:/data:/etc.
      if (rawSrc && (isHttp || isSchemeless)) {
        const src = isSchemeless && !rawSrc.startsWith('/') ? `/info/${rawSrc}` : rawSrc;
        const extra = (['alt', 'width', 'height'] as const)
          .filter(k => attrs[k] != null).map(k => ` ${k}="${esc(attrs[k]!)}"`).join('');
        out.push(`<p class="md-img"><img src="${esc(src)}"${extra} loading="lazy" decoding="async"></p>`);
        i++; continue;
      }
    }

    // A standalone <audio> line: a closed attribute whitelist, re-emitted re-escaped.
    // `captions` becomes a <track> (spoken words a deaf reader cannot reach are not published).
    const au = line.trim().match(/^<audio\s+([^<>]*?)\s*(?:\/>|><\/audio>)$/i);
    if (au) {
      const attrs: Record<string, string> = {};
      for (const m of au[1]!.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]!.toLowerCase()] = m[2]!;
      const rawSrc = attrs['src'] ?? '';
      const rooted = (s2: string) => (!/^[a-z][a-z+.-]*:/i.test(s2) && !s2.startsWith('/') ? `/info/${s2}` : s2);
      if (rawSrc && !/^(?!https?:)[a-z][a-z+.-]*:/i.test(rawSrc)) {
        const cap = attrs['captions'] ? rooted(attrs['captions']) : '';
        const track = cap
          ? `<track kind="captions" src="${esc(cap)}" srclang="en" label="${esc(attrs['label'] ?? 'Captions')}" default>`
          : '';
        out.push(
          `<figure class="doc-audio"><audio controls preload="none" src="${esc(rooted(rawSrc))}">${track}</audio></figure>`,
        );
        i++; continue;
      }
    }

    // A standalone <video> line: the same closed-whitelist treatment as <audio>. This is
    // how a credentialed audiogram MP4 lands on a page (audio containers can't carry C2PA).
    const vid = line.trim().match(/^<video\s+([^<>]*?)\s*(?:\/>|><\/video>)$/i);
    if (vid) {
      const attrs: Record<string, string> = {};
      for (const m of vid[1]!.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]!.toLowerCase()] = m[2]!;
      const rawSrc = attrs['src'] ?? '';
      const rooted = (s2: string) => (!/^[a-z][a-z+.-]*:/i.test(s2) && !s2.startsWith('/') ? `/info/${s2}` : s2);
      if (rawSrc && !/^(?!https?:)[a-z][a-z+.-]*:/i.test(rawSrc)) {
        const cap = attrs['captions'] ? rooted(attrs['captions']) : '';
        const track = cap
          ? `<track kind="captions" src="${esc(cap)}" srclang="en" label="${esc(attrs['label'] ?? 'Captions')}" default>`
          : '';
        const poster = attrs['poster'] ? ` poster="${esc(rooted(attrs['poster']))}"` : '';
        const dims = (['width', 'height'] as const)
          .filter(k => /^\d+$/.test(attrs[k] ?? '')).map(k => ` ${k}="${esc(attrs[k]!)}"`).join('');
        out.push(
          `<figure class="doc-audio doc-video"><video controls playsinline preload="none"${poster}${dims} src="${esc(rooted(rawSrc))}">${track}</video></figure>`,
        );
        i++; continue;
      }
    }

    if (line.includes('|') && i + 1 < lines.length && /^\|?[-|: ]+\|/.test(lines[i + 1]!)) {
      const headers = parseCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) { rows.push(parseCells(lines[i]!)); i++; }
      out.push('<div class="table-wrap"><table>');
      out.push('<thead><tr>' + headers.map(c => `<th>${inline(c, ctx)}</th>`).join('') + '</tr></thead>');
      out.push('<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${inline(c, ctx)}</td>`).join('') + '</tr>').join('') + '</tbody>');
      out.push('</table></div>');
      continue;
    }

    // A hard-wrapped list item continues on indented follow-up lines (lazy continuation).
    const itemContinues = () =>
      i < lines.length && /^\s+\S/.test(lines[i]!) &&
      !/^\s*[-*] /.test(lines[i]!) && !/^\s*\d+\. /.test(lines[i]!) &&
      !lines[i]!.trim().startsWith('```');

    if (/^\s*[-*] /.test(line)) {
      // Buffered so the <ul> can learn whether any item carried an icon marker.
      const items: string[] = [];
      let anyIcon = false;
      while (i < lines.length && /^\s*[-*] /.test(lines[i]!)) {
        const item = [lines[i]!.replace(/^\s*[-*] /, '')]; i++;
        while (itemContinues()) { item.push(lines[i]!.trim()); i++; }
        let text = item.join(' ');
        // `<!--i:key-->` opens the bullet with a doc icon (invisible on GitHub).
        const im2 = /^<!--i:([a-z-]+)-->\s*/.exec(text);
        const iconSvg = im2 ? ctx.docIcon(im2[1]!) : '';
        if (im2) text = text.slice(im2[0].length);
        if (iconSvg) {
          anyIcon = true;
          items.push(`<li class="ic"><span class="li-icon">${iconSvg}</span><span>${inline(text, ctx)}</span></li>`);
        } else items.push(`<li>${inline(text, ctx)}</li>`);
      }
      out.push(`<ul${anyIcon ? ' class="icon-list"' : ''}>`, ...items, '</ul>'); continue;
    }

    if (/^\d+\. /.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\. /.test(lines[i]!)) {
        const item = [lines[i]!.replace(/^\d+\. /, '')]; i++;
        while (itemContinues()) { item.push(lines[i]!.trim()); i++; }
        out.push(`<li>${inline(item.join(' '), ctx)}</li>`);
      }
      out.push('</ol>'); continue;
    }

    if (line.trim() === '') { i++; continue; }

    const para: string[] = [];
    while (
      i < lines.length && lines[i]!.trim() !== '' &&
      !lines[i]!.startsWith('#') && !lines[i]!.startsWith('```') &&
      !lines[i]!.startsWith('> ') && !/^\s*[-*] /.test(lines[i]!) &&
      !/^\d+\. /.test(lines[i]!) && !/^-{3,}$/.test(lines[i]!.trim()) &&
      !(lines[i]!.includes('|') && i + 1 < lines.length && /^\|?[-|: ]+\|/.test(lines[i + 1]!))
    ) { para.push(lines[i]!); i++; }
    if (para.length) out.push(`<p>${inline(para.join(' '), ctx)}</p>`);
    else i++;
  }

  return out.join('\n');
}
