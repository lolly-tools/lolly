# What Verify checks

Drop a file on [Verify](/#/verify) and the [Content Credential](/info/content-credentials-identity.html) is only the first thing it reads. It also looks for an AI declaration, Lolly's own invisible Imprint, other makers' watermarks, signatures from outside C2PA and data a file is quietly carrying. Each finding shows as a pip in the row under the verdict, "Verification checks at a glance", and is explained in full further down.

Every check runs on your device. Two network touches can happen, and neither sends the file:

- the opt-in deep scan downloads its detector models once, from the web app's own origin or, in the desktop and mobile apps, from Lolly's model host `lolli.li`, never a third party;
- on a build configured for a managed CA, Verify fetches that CA's revocation list.

## The Lolly Imprint

Alongside its Content Credential, Lolly seals an invisible watermark into the pixels themselves: the Lolly Imprint. The credential travels in metadata and is lost to a re-save, a screenshot or a metadata strip. The Imprint rides in the image and survives recompression, so it remains a hint that an image came from Lolly after the credential is gone.

It is a supporting signal, not a cryptographic guarantee. Its key ships in public source, so a determined person can remove it; the [Threat Model](/info/threat-model.html#residual-risk-register) lists that as an accepted risk.

When Verify finds it, a green **Lolly Imprint** pip joins the row, marked *detected*, or *in an image* when the mark sits in a picture embedded inside a PDF or PPTX. The Imprint is on by default for raster exports; see [Exporting](/info/exporting.html#provenance-watermark) for the switch.

![The Lolly Imprint switch in the export panel, already on, with the question mark opening what it does and does not promise](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26options%26c2pa%3D90%26imprint%3D1&width=1440&height=900&dpi=192&waitMs=2200&format=svg&css=%23tool-inputs%2C%23sidebar-utils%7Bdisplay%3Anone%7D&cropSelector=.export-imprint&walker=1&dark=1&filename=cc-export-imprint)

## AI-generated content

When a file declares that its pixels came from a trained model, Verify raises an **AI-generated content** flag, or **Contains AI-generated content** when only part of it did. The declaration comes from one of two places, and Verify says which:

- a signed **C2PA assertion** inside the credential;
- a bare **IPTC "digital source type"** tag in the file's metadata, the flag Gemini, Imagen, Midjourney and Meta AI write beside their output.

![The GEN AI flag Verify raises for a generated storm image - a labelled badge reading that the image was AI-generated, with the SynthID note](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=820&height=900&dpi=192&waitMs=6000&waitSelector=.valid-ai-flag&walker=1&format=svg&cropSelector=.valid-ai-flag&dark=1&filename=cc-verify-genai)

The metadata tag is genuine when present but easy to strip, so its absence never proves a file is not AI-made. It rides in an XMP packet, so the flag fires wherever Lolly reads one: JPEG, PNG, WebP and SVG stills, and MP4 or QuickTime video. GIF and TIFF carry no XMP packet that Lolly reads, so a bare tag in one of those is missed. A signed C2PA assertion in the same file is still read.

[AI evidence in Verify](/info/verify-ai-evidence.html) covers the separate question of whether text or a layout looks machine-written.

## Text reworded by Lolly

Lolly's on-device reword model leaves a public statistical watermark in its choice of words. On a build that ships that model, Verify checks pasted or extracted text for the mark and shows a **Reworded with Lolly** note when it finds one, with the score and how rarely unmarked text matches that strongly. When nothing is found, nothing is shown: most AI-written text was not reworded by Lolly, so "not found" says nothing.

## A maker's own watermark, likely present

The large generators stamp their own invisible watermark into the pixels: Google's **SynthID** (also adopted by OpenAI) and Meta's **Video Seal**. Only the maker's own detector can read those, and Lolly cannot. So when a file's declared maker is one of them, Verify says the file *very likely carries* that watermark. This is a likelihood inferred from the declaration, never a claim that Lolly read the watermark.

## Deep scan: TrustMark and Content Seal

For a real read of two open pixel watermarks, Verify offers an opt-in deep scan. A banner asks *"Scan for invisible watermarks?"*, and one click downloads the detector models once (about 90 MB). After that, every image in the batch is scanned automatically, on the device.

- **Adobe TrustMark** is a genuine decode, checked by error correction. When the recovered payload passes that check, Verify shows **Adobe TrustMark detected** with the recovered bytes. It is a real read, so it earns a green pip. The scan also recognises Lolly's own durable mark.
- **Meta Content Seal** is a read of Meta's *open* Pixel Seal and Video Seal watermark. It has no error-correcting check, so a decode that stays consistent across several re-encodings is reported as an amber **Meta Content Seal likely**: a statistical match, not a certainty. A flat or low-detail image can read as a false positive. Meta's production "Muse" image pipeline uses a separate proprietary variant that Lolly cannot read, so a hit never means "Meta AI", and absence rules nothing out.

Lolly can also write a TrustMark durable mark into its own exports. That switch sits in the export panel's Content protection card and is off by default, for the same reason the scan is opt-in: a neural pass plus a one-time model download.

## SEAL signatures

Verify also checks for a [SEAL](https://github.com/hackerfactor/SEAL) record. Despite the name, SEAL has nothing to do with Meta's Content Seal. It is a cryptographic signature over the file's bytes, designed to have its public key published in DNS.

Verify makes no network request for SEAL, and no Lolly app looks a SEAL key up in DNS today. In a browser that lookup would show a third-party DNS service the domain and your IP address. The desktop and mobile apps run the same Verify view, and `lolly validate` does not check SEAL.

So the result depends on where the record keeps its key:

- **Key inside the file.** Checked fully offline. When the signature verifies against that key, Verify reports **SEAL signature is internally consistent**: the bytes match, but the domain is unconfirmed, because the key never came from DNS.
- **Key only in DNS.** Reported as **SEAL signature did not verify**, with the reason "no key resolver and no inline key".

A **Signed by \<domain\> (SEAL)** result needs a key confirmed in DNS, so no Lolly app shows one yet. That result would prove control of the domain, not a CA-verified legal identity, and nothing about the visual content.

## Hidden data

Two reads look for data a file is quietly carrying.

- **Appended payloads.** Bytes added *after* a container legitimately ends (after a PNG's `IEND`, a JPEG's `EOI` or a GIF trailer) are flagged as **Appended data found**. **Raw bytes** shows them as a safe hex or text preview, and **Download** saves them; neither runs or parses them. A declared append, such as a motion photo's video or a gain map, is recognised and shown as **Appended image or video data** with no warning.
- **LSB steganalysis.** A chi-square test on the image's least significant bits looks for the statistical fingerprint of hidden data. A match raises an amber **LSB steganography likely** pip. It is a hint, not proof: careful embedding can evade the test, and a smooth synthetic gradient can raise a false alarm.

Every file's embedded metadata (EXIF, GPS, IPTC and XMP) is also read out in full and grouped, with values that could identify a person, place or device marked. Beside it, **Cleaned copy** downloads a copy without them, **Hidden Data** opens the tool that strips them and, for JPEG, PNG, WebP, SVG and PDF, **Redact** opens the redaction tool.

## Where each check runs

| Check | Verify (web, desktop, mobile) | `lolly validate` | MCP `lolly_verify` |
|---|---|---|---|
| Content Credential verdict | Yes | Yes | Yes |
| Metadata, AI declaration, appended data | Yes | With `--metadata` | Yes |
| Deep scan (TrustMark, Content Seal) | Opt-in | With `--deep`, which drives the same Verify view in a local browser | No |
| Lolly Imprint, LSB steganalysis, SEAL | Yes | No | No |

Every check runs on your machine, except over MCP, where the MCP server reads the file you send to that server. How the checks are built, module by module, is in [Content Credentials engineering](/info/content-credentials-engineering.html#beyond-c2pa-pixel-and-byte-level-verify-reads).
