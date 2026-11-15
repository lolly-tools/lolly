// SPDX-License-Identifier: MPL-2.0

import { costSummary, type StudyLedger } from './records.ts';
import { corpus } from './specimens.ts';

const e = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
export interface SpecimenResult {
  id: string;
  storyId: string;
  modeId: string;
  musicLink: string;
  designLink?: string;
  bed: string;
  mix: string;
  still: string;
  video?: string;
  facts: Record<string, unknown>;
}

export function reviewPage(ledger: StudyLedger, results: SpecimenResult[]): string {
  const costs = costSummary(ledger);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lolly sonic study</title>
<style>body{margin:0;background:#f5f5ef;color:#132b26;font:17px/1.55 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:32px 22px}h1{font-size:clamp(2rem,5vw,3.6rem);line-height:1.08;max-width:850px}h2{margin-top:48px}h3{margin-top:0}.lead{max-width:800px}.badge{font-size:13px;letter-spacing:.08em;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{background:white;border:1px solid #c9d7cd;border-radius:16px;padding:22px}img,video{width:100%;border-radius:6px}audio{width:100%}a{color:#00654d}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}summary{cursor:pointer;font-weight:600}label{display:block;margin:16px 0 6px}textarea,input{box-sizing:border-box;width:100%;padding:10px;font:inherit}button{padding:12px 20px;background:#033633;color:white;border:0;border-radius:6px;font:inherit;cursor:pointer}.note{padding:18px;border-left:4px solid #008657;background:#e6eee7}small{display:block}footer{margin:40px 0}*:focus-visible{outline:3px solid #b06200;outline-offset:3px}</style>
<main><p class="badge">LOLLY / OPEN MEDIA STUDY / CANDIDATES</p><h1>One identity. Room for different kinds of sound.</h1>
<p class="lead">Hear three candidate expressions, alone and under narration. Compare the stories before choosing what should stay fixed.</p><nav aria-label="Stories"><a href="#sound">Compare the sound</a> · <a href="#chart">Chart example</a> · <a href="#motion">Motion example</a></nav><details><summary>About the candidates and evidence</summary>
<p class="note">Local development specimens, not release masters. Audio and video here are renderer intermediates without export credentials. A public release still needs listening, editorial, rights and delivery review through the normal export and publication paths. Nothing has been published.</p>
<p><a href="corpus.json">Briefs and full recipes</a> · <a href="ledger.json">Attempts and costs</a> · <a href="manifest.json">Environment and file digests</a> · <a href="review-template.json">Review form as JSON</a>${ledger.attempts.some((a) => a.outputId === 'editable-project' && a.outcome === 'succeeded') ? ' · <a href="candidates.lolly">Editable project with retained audio</a>' : ''}</p>
<p>Identity anchors: ${e(corpus.identity.anchors.join('; '))}. ${e(corpus.identity.guidance)} ${e(corpus.identity.signature)}</p></details>
${corpus.stories
  .map(
    (story) =>
      `<section id="${e(story.id)}"><h2>${e(story.title)}</h2><p>${e(story.source)}</p><details><summary>Read the narration</summary><p>${e(story.script)}</p></details><div class="grid">${corpus.modes
        .map((mode) => {
          const sample = results.find((r) => r.storyId === story.id && r.modeId === mode.id);
          return `<article><h3>${e(mode.label)}</h3><p>${e(mode.purpose)}</p><p>${e(mode.direction)}</p>${sample ? `<img src="${e(sample.still)}" alt="${e(story.title)}: ${e(story.keyPoint)}"><p>Music on its own</p><audio controls preload="none" src="${e(sample.bed)}"></audio><p>With narration</p><audio controls preload="none" src="${e(sample.mix)}"></audio>${sample.video ? `<p>Sequence specimen</p><video controls preload="metadata" src="${e(sample.video)}"><track kind="captions" src="${e(story.id)}.vtt" srclang="en" label="English" default></video>` : ''}<p><a href="${e(sample.musicLink)}" target="_blank" rel="noopener">Open this exact music recipe in Lolly</a> · <a href="${e(sample.id)}.lofi.json">Download the tune</a> · <a href="${e(sample.id)}.design.json">Design inputs</a>${sample.designLink ? ` · <a href="${e(sample.designLink)}" target="_blank" rel="noopener">Edit this still in Lolly</a>` : ''}</p><details><summary>Settings and technical measurements</summary><pre>${e(JSON.stringify(sample.facts, null, 2))}</pre></details>` : '<p>Rendering did not finish. Read the attempt ledger for the failure.</p>'}
<details><summary>Listening guidance and counterexample</summary><ul>${mode.listenFor.map((q) => `<li>${e(q)}</li>`).join('')}</ul><p>${e(mode.counterexample)}</p><p>${e(mode.visual)}</p></details><label for="review-${e(story.id)}-${e(mode.id)}">Listening notes</label><textarea id="review-${e(story.id)}-${e(mode.id)}" data-review="${e(story.id)}-${e(mode.id)}" rows="3" placeholder="Fit, intelligibility, family resemblance, changes needed"></textarea></article>`;
        })
        .join('')}</div></section>`
  )
  .join('')}
<h2>What the run establishes</h2><p>${costs.successfulOperations} successful operations; ${costs.failedAttempts} failed attempts. ${costs.approvedAssets} approved outputs; ${costs.publishedEditions} published editions. A successful operation may produce several files; these counts are not audience results or cost denominators.</p><p>Runtime is measured. Active human labour and allocation rates remain unknown. There is no complete cost total or claimed speed advantage. No platform, audience or reuse experiment has run.</p><details><summary>Cost coverage</summary><pre>${e(JSON.stringify(costs, null, 2))}</pre></details>
<h2>Listening before the contract</h2><p>${e(corpus.review.method)}</p><ul>${corpus.review.questions.map((q) => `<li>${e(q)}</li>`).join('')}</ul><label for="reviewer">Reviewer name or role</label><input id="reviewer" autocomplete="off"><p>Your notes stay on this page until you download them. They are not sent anywhere and are not saved on reload. Downloading records observations; it does not approve the identity.</p><button id="download-review">Download observations</button><p id="status" role="status"></p>
<footer>Run ${e(ledger.runId)}. Reuse the repository's maintained study runner and fixtures. Retain these audio masters: a recipe link does not pin future synthesis. External Lolly links use the public site's current runtime and may sound different from this recorded revision.</footer></main>
<script>document.querySelector('#download-review').addEventListener('click',()=>{const reviewer=document.querySelector('#reviewer').value.trim();if(!reviewer){document.querySelector('#status').textContent='Add a reviewer name or role first.';return}const review={version:1,runId:${JSON.stringify(ledger.runId).replace(/</g, '\\u003c')},state:'observations',reviewer,at:new Date().toISOString(),notes:Array.from(document.querySelectorAll('[data-review]'),el=>({specimen:el.dataset.review,note:el.value}))};const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='listening-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#status').textContent='Observations downloaded. Approval is a separate recorded decision.'})</script></html>`;
}
