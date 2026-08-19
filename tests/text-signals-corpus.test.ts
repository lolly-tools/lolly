// SPDX-License-Identifier: MPL-2.0
//
// The text-signals EVAL CORPUS - the false-positive contract (plans/126 WP-D).
//
// Known-HUMAN samples are pinned to band none/weak; known-AI-shaped samples to
// notable/strong. Every lexicon or detector change must keep this suite green:
// a human sample crossing to 'notable' is a regression no matter how much new
// AI text the change catches. Grow it with real samples per model family; keep
// the human side covering the documented false-positive traps (formal register,
// non-native-flavoured English, technical documentation, ordinary email).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTextSignals } from '../engine/src/text-signals.ts';

const bandAtMost = (band: string, ceiling: 'none' | 'weak'): boolean =>
  ceiling === 'weak' ? ['none', 'weak'].includes(band) : band === 'none';

// ── Human samples ────────────────────────────────────────────────────────────

test('CORPUS human: formal academic register stays none/weak', () => {
  const text =
    'The survey ran for eleven weeks across four sites. Respondents were asked to rank ' +
    'each option and to explain their first choice in a sentence or two. Participation ' +
    'was lower than in the previous round, which we attribute mainly to the timing of ' +
    'the school holidays. The results suggest a modest preference for the second design, ' +
    'though the difference falls within the margin of error. We repeated the analysis ' +
    'with the late responses excluded and the ordering did not change. A longer study ' +
    'would be needed before drawing firmer conclusions.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(bandAtMost(r.band, 'weak'), `academic prose must not read as AI, got ${r.band} (${r.score})`);
});

test('CORPUS human: non-native-flavoured English stays none/weak', () => {
  const text =
    'I am writing for ask about the delivery of my order. The package was suppose to ' +
    'arrive on Tuesday but it did not come yet. I checked the tracking page many times. ' +
    'It says still processing. Can you please tell me when it will be send? This is ' +
    'important because I need the parts for repair my bicycle before the weekend trip. ' +
    'Thank you very much for the help and sorry for my English.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(bandAtMost(r.band, 'weak'), `non-native English must not read as AI, got ${r.band} (${r.score})`);
});

test('CORPUS human: technical README prose stays none/weak', () => {
  const text =
    'Install the package with npm, then copy the sample config into your project root. ' +
    'The watcher rebuilds on save. If the port is taken, pass another one with the -p ' +
    'flag. Logs go to stderr by default. We test on the last two LTS releases of Node. ' +
    'Known issue: on some Linux distros the file watcher needs a higher inotify limit, ' +
    'see the troubleshooting page for the sysctl line to add. Pull requests are welcome, ' +
    'please run the linter first.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(bandAtMost(r.band, 'weak'), `README prose must not read as AI, got ${r.band} (${r.score})`);
});

test('CORPUS human: an ordinary email with one polite close stays at most weak', () => {
  // Humans really do write "I hope this helps" - one occurrence must never push
  // past 'weak' on its own. This pins the single-phrase tolerance.
  const text =
    'Hi Sam, the venue is booked for the 14th from six until late. Parking is round the ' +
    'back, the code for the gate is on the sheet I sent last week. If the caterers call ' +
    'again just forward them to me. I hope this helps. See you Thursday, Priya.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(bandAtMost(r.band, 'weak'), `one polite close must stay weak at most, got ${r.band} (${r.score})`);
});

test('CORPUS human: legal/contract register stays none/weak', () => {
  const text =
    'The tenant shall keep the premises in good repair, fair wear and tear excepted, and ' +
    'shall not make structural alterations without prior written consent. Rent is payable ' +
    'monthly in advance on the first business day. Either party may terminate on two ' +
    'months notice after the initial term. Deposits are held under the scheme described ' +
    'in schedule two, and any deductions must be itemised in writing within ten days of ' +
    'the tenancy ending.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(bandAtMost(r.band, 'weak'), `legal register must not read as AI, got ${r.band} (${r.score})`);
});

// ── AI-shaped samples ────────────────────────────────────────────────────────

test('CORPUS ai: an assistant-style answer reads notable or stronger', () => {
  const text =
    "Great question! Let's explore the key considerations. It's important to note that " +
    'choosing the right framework is a pivotal decision in today\'s ever-evolving landscape. ' +
    'A comprehensive, holistic approach will help you leverage the strengths of each option ' +
    'and foster a seamless developer experience. Additionally, a robust testing strategy ' +
    'underscores the importance of maintainability. I hope this helps! Let me know if you ' +
    'have any questions.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(r.band === 'notable' || r.band === 'strong', `assistant answer should flag, got ${r.band} (${r.score})`);
});

test('CORPUS ai: a bold-label markdown listicle reads notable or stronger', () => {
  const text = [
    '# Five Ways To Improve Your Workflow',
    '',
    '- **Streamline Your Process:** Delve into your daily routine and identify bottlenecks.',
    '- **Leverage Automation:** Harness cutting-edge tools to eliminate repetitive tasks.',
    '- **Foster Collaboration:** A vibrant team culture is a testament to good leadership.',
    '- **Embrace Feedback:** Meticulous review cycles ensure a seamless final product.',
    '- **Stay Adaptable:** Navigating the complexities of change is paramount.',
    '',
    'In conclusion, these strategies showcase how small changes unlock transformative results.',
  ].join('\n');
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(r.band === 'notable' || r.band === 'strong', `listicle should flag, got ${r.band} (${r.score})`);
});

test('CORPUS ai: wikipedia-style puffery reads notable or stronger', () => {
  const text =
    'The festival stands as a testament to the rich tapestry of the region\'s cultural ' +
    'heritage. Nestled in the heart of the valley, the renowned event continues to captivate ' +
    'visitors, showcasing groundbreaking performances that underscore its importance and ' +
    'leave a lasting impression, reflecting the vibrant traditions that are deeply rooted ' +
    'in the community and highlighting the pivotal role the festival plays in the cultural ' +
    'landscape of the area.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(r.band === 'notable' || r.band === 'strong', `puffery should flag, got ${r.band} (${r.score})`);
});

test('CORPUS ai: chatbot residue in a document reads strong', () => {
  const text =
    'Certainly! Here is a draft of the announcement. As an AI language model, I do not ' +
    'have access to real-time information, so please verify the dates. My knowledge cutoff ' +
    'means recent changes may be missing. Would you like me to adjust the tone? Feel free ' +
    'to customize the closing. I hope this helps!';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.equal(r.band, 'strong', `stacked residue should read strong, got ${r.band} (${r.score})`);
});
