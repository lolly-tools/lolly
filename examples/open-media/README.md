# Open media and sonic identity study

This is the first production exercise toward sonic branding in Lolly Design System Setup. The fixtures are **candidates**, not an approved Lolly identity or an enforced brand policy. The exercise precedes the public sonic-profile contract and the Sound room.

The editorial promise is one useful idea about visual communication, demonstrated with an editable example. Three original stories explore chart scale, purposeful motion and sonic expression. Explain, Demonstrate and Play apply different musical choices while retaining proposed identity anchors. The sound story keeps its picture and words fixed for comparison. Synthetic values are identified as demonstration data; nothing claims to be a live feed.

## Run locally

Install the workspace dependencies and the browser used by the repository's browser tests. The runner uses already staged Kokoro models. It does not download models, create accounts, send analytics or publish content.

```sh
pnpm install --frozen-lockfile
node scripts/media-study.ts --help
node scripts/media-study.ts --out=plans/artifacts/358/my-first-run
```

If the models live elsewhere, add `--models=/absolute/path/to/models`. Missing models produce a recorded failure and the existing speech API's installation guidance. For video, the default `--video=representative` makes chart/Explain, motion/Demonstrate and sound/Play. `--video=all` renders all nine intersections; `--video=none` records an audio and still study with no video qualification.

Each run needs a **new directory**. A retry retains the old evidence and uses the same authored seeds. Open its `index.html` locally to compare music, narrated mixes and videos. The page can download your listening observations; it sends no notes anywhere and does not retain them after reload. An HTTP static server may be needed for caption tracks in browsers that restrict local files.

## What the runner produces

- Three retained narration WAV files and their actual timing granularity. Sentence timing stays sentence timing; no invented word alignment.
- Nine music excerpts and nine narrated mixes, using the shipped generator and sequence mixer. Exact settings, seeds, ducking and measured integrated loudness travel with each candidate.
- Nine stills through the existing Design tool, authored Design inputs and the selected sequence videos. Video checks read the encoded dimensions, duration and audio/video codecs.
- An editable `.lolly` project with retained mixed audio, read back through the normal project reader. Music links open the exact settings in the public generator; still links open the worked example in Lolly Design.
- Source snapshots, font licence files, renderer dependencies, file digests, attempts, cost coverage and a blank review record.

These are **local renderer intermediates without export credentials**. They qualify a production seam; they do not qualify the complete web/CLI export, credential, publication or platform-transcode path. Use the normal export workflow for a release master and verify the resulting credentials and source descriptions. Procedural music and model-generated speech remain different source types. A mixed file must not claim that every ingredient was made without a trained model.

The proposed musical endings currently use a measured excerpt and a fade. They are not newly composed cadences. The music generator's own audible Lolly tag is explicitly off while the sonic signature remains undecided. Personal favourites and blocks never enter these retained recipes.

## Read the evidence honestly

The ledger begins before rendering. It records failures alongside successful attempts, elapsed runtime, first use in the process versus warm use, and retained artifact digests. A first use in a process does not prove a cold filesystem or machine. A successful render does not approve an asset. Review decisions bind exact artifact bytes and require a reviewer, date and evidence. Publication needs its own observed destination receipt.

Active labour is unknown until a person records active minutes. Machine time is measured but its allocation rate is unknown. Creative authoring, implementation, provisioning and review setup costs are explicitly unmeasured. No API bill is inferred from local runtime. The cost summary separates cash from allocation, actual from assumed rates, currencies and tax treatment; failures remain in the numerator. Undefined denominators remain null. The report's known subtotals are not a complete production cost.

Use the same source, delivery requirements and quality bar for a later manual comparison. Include repairs and review on both paths, counterbalance order where possible and retain all attempts. No speed advantage, audience effect, returning-creator metric or channel revenue is established by this exercise.

## Decisions before the Sound room

1. **Listen and demonstrate.** Review candidate and counterexample choices, intelligibility, pronunciation, identity coherence and context fit. Compare at comfortable listening levels, on more than one playback setup. Record disagreements and changes; do not infer approval from the technical checks.
2. **Encode what proved useful.** Keep identity intent, context, examples, executable settings and subjective guidance distinct. Prove profile storage, import/export and revision round trips before freezing a public contract. Required unsupported settings must be visible conflicts. Personal listening preferences must not alter saved work.
3. **Guide authoring.** Start from purpose and listening examples. Make the always-held identity anchors, permitted variation and narration relationship understandable. Offer detailed musical settings when needed. Resolve one exact recipe and seed, preview it, preserve it with the work, and explain unsupported requests. Keep older design systems working without a sound profile.
4. **Prove repeated production.** Qualify the full export path with retained scripts, captions, music, source descriptions and file checks. Keep a corrected edition separate from the original. Then connect bounded campaign jobs, data snapshots and explicit refresh choices to those recipes.
5. **Open the media programme.** Publish selected permitted examples with exact edit links, source explanations, costs, failures and corrections. Start with an owned page and one topic-led video series, with a curated instrumental companion. A public URL is not a reuse licence.
6. **Qualify delivery and learning.** Prepare destination-specific metadata and source permissions, then test an authorised destination. Observe processing and playback before recording publication. Keep music-store releases separate from spoken programmes. Add consent-respecting participation measurement only when implemented; distinguish visits, edits, exports and people.
7. **Extend composition where evidence supports the cost.** Motifs, exact musical endings, semantic live-data adaptation, recognition research and autonomous destination policies remain separate work. A seed or a genre name alone does not create a sonic identity.

The route to `/start` includes these foundations. The UI should make a well-defined decision easy while preserving the examples, reasoning, constraints and advanced controls behind it. This directory does not introduce a competing personality taxonomy or a general publishing scheduler.

## Checks

```sh
node --test tests/media-study.test.ts
pnpm exec tsc -p scripts
```

The fixtures and runner follow the repository's MPL-2.0 licence. Supplied fonts retain their own OFL notices. Review model and output terms separately before distributing selected media; this study does not grant rights to unrelated brand materials or a voice identity.
