# AI marking and the EU AI Act

Since 2 August 2026, Article 50 of the EU AI Act has applied to systems that generate content. In plain language: a system that produces synthetic audio, images, video or text must mark its output so that software can tell the content was artificially generated or manipulated, and a person shown a deep fake must be told that is what it is. The AI Office's transparency Code of Practice (June 2026) points at C2PA Content Credentials as the machine-readable layer it expects.

Two boundaries before anything else. Lolly is not an AI system under the Act: it does not produce images or text from prompts. And nothing on this page is legal advice - what your organisation must do under Article 50 is a question for your counsel. Lolly's honest relevance is narrower and practical: it preserves the marks that arrive on AI content, it declares the few AI operations it performs itself, and it verifies any file you drop on it. [Our AI stance](/info/ai-stance.html) is the doctrine; this page is the mechanics.

## Preserved: marks that arrive, stay

Generate an image in Gemini, Claude or OpenAI and bring it into Lolly, and its declared AI origin is read from the file's own credential and copied onto Lolly's manifest at the instant of ingest. From then on the declaration is Lolly's to carry: stripping the original's credential later does not remove the flag, and every export that uses the image chains that origin forward as an ingredient. The full mechanics, including what happens to the declaration through crops and resizes, are on [AI features](/info/ai-features.html).

## Declared: what Lolly generates says so

Lolly performs a small number of generative operations itself, and each one marks its output:

- **Synthetic speech.** A text-to-speech clip is saved as an AI-generated asset the moment it is made, on the device. The [GEN AI badge](/info/content-credentials-identity.html) follows it everywhere, a visible line says so on the asset itself, and a video or audiogram built from it declares that it contains AI-generated audio. Machine-readable disclosure of synthetic audio is exactly what Article 50 asks of the systems it covers, so the practice is in place here even though the Act does not compel it of Lolly.
- **Upscaling.** Enlarging a small raster invents detail the original never held, so the result is disclosed as a generative composite (`compositeWithTrainedAlgorithmicMedia`), flagged AI-generated and badged.
- **And nothing else pretends.** The test is mechanical, not a judgement call: did a model invent pixels that were not there? Background removal keeps every original pixel and is disclosed as an edit, not as AI. Pixel-art scaling copies existing pixels and is an edit too. A badge that fired on every AI-adjacent operation would tell a viewer nothing.

## Verified: read any file's marks, on your device

Drop any file on [Verify](/info/verify-yourself.html) and its declarations come back without the file leaving your device: the credential verdict, the provenance history, and a plainly surfaced GEN AI flag when the file declares a machine made its pixels - with a note when a Google model very likely stamped an invisible SynthID watermark too. [Security & Verification](/info/security.html) walks a real generated image through the whole check.

## What this page does not claim

- Lolly cannot mark what arrives unmarked. An AI image whose credential was already stripped reads as an ordinary image, and Lolly does not guess at origins it cannot read.
- Marks travel with the file. A screenshot of the content, or a re-save through a tool that discards metadata, can lose them downstream. That is a property of every metadata-borne mark, C2PA included, and pretending otherwise would be the overclaim this page exists to avoid.
- Compliance is a property of your process, not of any one tool. What Lolly gives you is a pipeline in which the marks Article 50 cares about survive by default instead of being silently dropped.
