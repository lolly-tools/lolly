# AI marking and the EU AI Act

If you deploy Lolly in the EU, the AI Act may ask you to mark synthetic output and disclose deep fakes. Lolly gives that review three technical facts to work with. They support the assessment; they do not establish compliance.

::: cols
## Preserved

AI marks that arrive with a file stay. Its declared AI origin is copied onto Lolly's own manifest at ingest, and every export that uses it carries that origin forward.

## Declared

What Lolly generates says so. Synthetic speech, upscaling, kept rewordings and synthesised singing are each marked in the file's Content Credentials.

## Verified

Drop any file on [Verify](/#/verify) and its declarations come back on your device: the verdict, the history and a GEN AI flag.
:::

How each one works, and why removing a background is not marked while upscaling is, is on [Generated once, rendered the same](/info/ai-features.html).

## The legal frame

[Article 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50) sets separate transparency duties for providers and deployers of certain AI systems, including output marking for synthetic audio, images, video and text, and disclosure for deep fakes. [Article 113](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-113) sets the general application date of 2 August 2026. [Article 111(4)](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-111), added by the Digital Omnibus on AI, gives providers of systems that generate synthetic content and were placed on the market before 2 August 2026 until 2 December 2026 to comply with Article 50(2).

The Commission's voluntary [Code of Practice on Transparency of AI-Generated Content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content), published on 10 June 2026, asks signatories to mark outputs in at least two layers: metadata that is digitally signed and tamper-evident, and an imperceptible watermark. It also asks them to keep existing metadata markings when they transform content. The Code specifies no standard; a C2PA Content Credential is signed metadata of that kind.

Lolly's legal classification depends on how you deploy it, so it needs your counsel's review. Lolly combines template rendering with features such as synthetic speech and model-based upscaling. Review the enabled features, the intended use and the provider or deployer roles against the [Article 3 definitions](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-3) and Article 50 before rollout. The template-driven design does not exempt its generative features. [Our AI Stance](/info/ai-stance.html) describes the product policy.

## What this page does not claim

- Lolly cannot mark what arrives unmarked. An AI image whose credential was already stripped reads as an ordinary image, and Lolly does not guess at origins it cannot read.
- Marks travel with the file. A screenshot, or a re-save through a tool that discards metadata, can lose them downstream. That is true of every mark carried in metadata, C2PA included.
- Compliance needs a classification and process assessment by counsel. Preserving declared provenance is one technical contribution; the applicable duties, and whether the marking and disclosure process is sufficient, remain for that review.
