# AI marking and the EU AI Act

[Article 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50) sets separate transparency duties for providers and deployers of certain AI systems, including output marking for synthetic audio, images, video and text, and disclosure for deep fakes. Its conditions and exceptions need to be assessed for the specific use. [Article 113](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-113) sets the general application date of 2 August 2026.

This page leaves Lolly's legal classification pending deployment-specific counsel review. Lolly combines template rendering with features such as synthetic speech and model-based upscaling. Review the enabled features, intended use and provider or deployer roles against the [Article 3 definitions](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-3) and Article 50 before rollout. The product's template-driven design does not establish an exemption for its generative features.

The mechanics below describe how Lolly preserves incoming declarations, marks its own generative operations and verifies provenance. They support that review without establishing legal compliance. [Our AI stance](/info/ai-stance.html) describes the product policy.

## Preserved: marks that arrive, stay

Generate an image in Gemini, Claude or OpenAI and bring it into Lolly, and its declared AI origin is read from the file's own credential and copied onto Lolly's manifest at the instant of ingest. From then on the declaration is Lolly's to carry: stripping the original's credential later does not remove the flag, and every export that uses the image chains that origin forward as an ingredient. The full mechanics, including what happens to the declaration through crops and resizes, are on [AI features](/info/ai-features.html).

## Declared: what Lolly generates says so

Lolly performs a small number of generative operations itself, and each one marks its output:

- **Synthetic speech.** A text-to-speech clip is saved as an AI-generated asset the moment it is made, on the device. The [GEN AI badge](/info/content-credentials-identity.html) follows it everywhere, a visible line says so on the asset itself, and a video or audiogram built from it declares that it contains AI-generated audio. These declarations support the transparency assessment; counsel must determine the applicable marking and disclosure duties for the deployed speech feature. A badge or credential alone does not establish compliance.
- **Upscaling.** Enlarging a small raster invents detail the original never held, so the result is disclosed as a generative composite (`compositeWithTrainedAlgorithmicMedia`), flagged AI-generated and badged.
- **And nothing else pretends.** The test is mechanical, not a judgement call: did a model invent pixels that were not there? Background removal keeps every original pixel and is disclosed as an edit, not as AI. Pixel-art scaling copies existing pixels and is an edit too. A badge that fired on every AI-adjacent operation would tell a viewer nothing.

## Verified: read any file's marks, on your device

Drop any file on [Verify](/info/verify-yourself.html) and its declarations come back without the file leaving your device: the credential verdict, the provenance history, and a plainly surfaced GEN AI flag when the file declares a machine made its pixels - with a note when a Google model very likely stamped an invisible SynthID watermark too. [Security & Verification](/info/security.html) walks a real generated image through the whole check.

## What this page does not claim

- Lolly cannot mark what arrives unmarked. An AI image whose credential was already stripped reads as an ordinary image, and Lolly does not guess at origins it cannot read.
- Marks travel with the file. A screenshot of the content, or a re-save through a tool that discards metadata, can lose them downstream. That is a property of every metadata-borne mark, C2PA included, and pretending otherwise would be the overclaim this page exists to avoid.
- Deployment compliance requires a classification and process assessment by counsel. Preserving declared provenance is one technical contribution; the applicable duties and sufficiency of the marking and disclosure process remain subject to that review.
