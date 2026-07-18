#!/usr/bin/env python3
"""
Convert Adobe TrustMark's PyTorch ENCODER to ONNX for on-device durable-credential
embedding — the embed counterpart to the decoders we already fetch.

ANDY-RUN ONLY (needs torch + the `trustmark` pip package + network for weights).
Never invoked by npm/CI. This is the SAME class of step as
scripts/convert-contentseal-onnx.py: a heavyweight PyTorch→ONNX conversion whose
output is a large, gitignored model loaded lazily in the browser.

── Why this script exists (read before trusting it) ─────────────────────────────
Adobe ships ONNX for DECODE ONLY (js/tm_watermark.js — the two decoder_*.onnx we
fetch in scripts/fetch-trustmark-models.ts). ENCODING lives only in the Python
package's PyTorch weights, so to embed a durable mark on-device we must export the
encoder ourselves. There is no upstream ONNX encoder to download and no upstream
hash to verify against. See plans/durable-content-credentials.md.

── The exact contract this produces (consumed by shells/web/src/lib/trustmark-embed.ts) ──
The runner ports Adobe's own `TrustMark.encode` (python/trustmark/trustmark.py),
so the ONNX graph must expose the encoder's raw forward with NO pre/post-baked
normalization — the runner does the [-1,1] normalization, the per-channel-mean
residual, the bilinear upscale, and the WM_STRENGTH merge itself, exactly as the
Python reference does around the `self.encoder(cover, secret)` call:

  inputs:
    cover  : float32 [1, 3, 256, 256]   sRGB in [-1, 1]   (ToTensor()*2-1)
    secret : float32 [1, 100]           the 100-bit packet as 0.0/1.0
  output:
    stego  : float32 [1, 3, 256, 256]   in [-1, 1] (the runner clamps + diffs)

model_resolution_enc is 256 for every TrustMark variant (confirmed in the
reference), so both Q and P encoders take 256×256. WM_STRENGTH is applied in the
RUNNER (default 1.0; ×1.25 for the P variant), NOT baked into the graph — keep the
graph a pure forward so the runner stays the single source of the merge math.

── Usage ────────────────────────────────────────────────────────────────────────
    pip install trustmark torch onnx
    python scripts/convert-trustmark-encoder-onnx.py            # Q + P encoders
    python scripts/convert-trustmark-encoder-onnx.py --variant Q

Output: shells/web/public/models/trustmark/encoder_<V>.onnx (gitignored, ~tens of
MB each). After running, also complete the /ort/ WASM copy steps documented in
fetch-trustmark-models.ts if you haven't already.

── UNVERIFIED ───────────────────────────────────────────────────────────────────
No torch/trustmark/browser exists in the environment that wrote this. The API
calls below match Adobe's published `TrustMark` class (self.encoder, model_type
Q/P), but CONFIRM against your installed `trustmark` version:
  * that `tm.encoder` is the nn.Module whose forward is `(cover, secret) -> (stego, _)`;
  * that model_type 'Q'/'P' load the same checkpoints as decoder_Q/decoder_P.onnx;
  * that exported input/output names + shapes match the contract above.
If the forward signature differs, fix BOTH this script and trustmark-embed.ts.
"""

import argparse
import os
import sys

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'shells', 'web', 'public', 'models', 'trustmark')
MODEL_RESOLUTION_ENC = 256  # every TrustMark variant, per the reference
PAYLOAD_BITS = 100          # DataLayer(100, ...) — matches engine/src/trustmark.ts


class _StegoOnly(__import__('torch').nn.Module):
    """The TrustMark encoder forward returns `(stego, _)`; ONNX wants a single
    named output. This wrapper drops the second output so the graph emits exactly
    one `stego` tensor (the residual base the runner diffs against the cover)."""
    def __init__(self, enc):
        super().__init__()
        self.enc = enc

    def forward(self, cover, secret):
        out = self.enc(cover, secret)
        return out[0] if isinstance(out, (tuple, list)) else out


def export_variant(variant: str) -> None:
    import torch
    from trustmark import TrustMark

    print(f'[{variant}] loading TrustMark (model_type={variant}) …')
    # We only need the encoder module — skip the watermark-remover and bbox-detector
    # downloads (loadRemover/loadBBoxDetector) so init only fetches the encoder (+
    # decoder) checkpoints. encoding_type is irrelevant to the encoder graph.
    tm = TrustMark(verbose=True, model_type=variant, loadRemover=False, loadBBoxDetector=False)

    # model_resolution_enc is 256 for every published variant; read it off the
    # instance rather than trusting the constant, and fail loudly on a surprise
    # (the runner hard-codes 256 — a mismatch must be caught, not silently shipped).
    res = int(getattr(tm, 'model_resolution_enc', MODEL_RESOLUTION_ENC))
    if res != MODEL_RESOLUTION_ENC:
        raise SystemExit(
            f'[{variant}] model_resolution_enc={res} != {MODEL_RESOLUTION_ENC}; update '
            f'MODEL_RESOLUTION in shells/web/src/lib/trustmark-embed.ts to match, then retry.')

    encoder = _StegoOnly(tm.encoder).eval()
    device = next(tm.encoder.parameters()).device

    # Dummy inputs matching the runtime contract EXACTLY (see header).
    cover = torch.zeros(1, 3, res, res, dtype=torch.float32, device=device)
    secret = torch.zeros(1, PAYLOAD_BITS, dtype=torch.float32, device=device)

    # Sanity: the wrapped forward must return stego[1,3,res,res].
    with torch.no_grad():
        stego = encoder(cover, secret)
    if tuple(stego.shape) != (1, 3, res, res):
        raise SystemExit(
            f'[{variant}] unexpected stego shape {tuple(stego.shape)} — the encoder forward '
            f'is not (cover,secret)->stego[1,3,{res},{res}]. Fix this script AND trustmark-embed.ts.')

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f'encoder_{variant}.onnx')
    print(f'[{variant}] exporting ONNX → {out_path} …')
    torch.onnx.export(
        encoder,
        (cover, secret),
        out_path,
        input_names=['cover', 'secret'],
        output_names=['stego'],
        opset_version=17,
        dynamic_axes=None,   # fixed 256×256 / 100-bit — the runner always feeds this shape
        do_constant_folding=True,
        # Legacy TorchScript exporter: needs no `onnxscript` dep AND honours the
        # input/output names verbatim (the dynamo exporter, torch 2.9+ default, can
        # rename them — which would break the runner's { cover, secret } → stego contract).
        dynamo=False,
    )
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f'[{variant}] saved encoder_{variant}.onnx ({size_mb:.1f} MB)')


def main() -> int:
    ap = argparse.ArgumentParser(description='Export TrustMark PyTorch encoder(s) to ONNX.')
    ap.add_argument('--variant', choices=['Q', 'P'], help='only this variant (default: both)')
    args = ap.parse_args()
    variants = [args.variant] if args.variant else ['Q', 'P']

    try:
        for v in variants:
            export_variant(v)
    except ImportError as e:
        print(f'\nMissing dependency: {e}\n  pip install trustmark torch onnx', file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001 — surface any conversion failure verbatim
        print(f'\nConversion failed: {e}', file=sys.stderr)
        print('Confirm tm.encoder / model_type against your installed trustmark version (see header).', file=sys.stderr)
        return 1

    print(
        '\nDone. These .onnx files are gitignored — never commit them.\n'
        'The browser fetches them lazily from /models/trustmark/encoder_<V>.onnx the first\n'
        'time a durable export runs (see shells/web/src/lib/trustmark-embed.ts). Verify by\n'
        'exporting an image with ?durable=1, then deep-scanning it in /#/valid: the\n'
        '"Lolly durable mark" pip should appear (recognition is already wired).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
