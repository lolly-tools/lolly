#!/usr/bin/env python3
"""
Convert Meta's open Pixel Seal / Video Seal (IMAGE-mode) watermark EXTRACTOR to
ONNX, for on-device detection in the web shell's /verify "Deep scan for
watermarks" flow (shells/web/src/lib/contentseal.ts).

ANDY-RUN ONLY. This needs Python + torch + the `videoseal` package + the
downloaded checkpoint, and network access to fetch the weights. It is NEVER
invoked by npm install / postinstall / CI, and it is NOT runnable in the Lolly
dev/agent environment (no torch, no browser, no ONNX runtime there). Nothing in
this repo's automated pipeline calls this file. Run it yourself, once, then test
in a real browser (see the checklist at the bottom).

────────────────────────────────────────────────────────────────────────────
WHY A CONVERSION IS REQUIRED (there is no ONNX to download)
────────────────────────────────────────────────────────────────────────────
facebookresearch/content-seal is only a landing/portal page — it ships no code
or weights and points at facebookresearch/videoseal. The open IMAGE watermark
extractor lives in videoseal, distributed as torch/PyTorch **.pth** checkpoints.
There is NO ONNX anywhere in that repo tree (no *.onnx, no export_onnx.py); the
only "pre-compiled" path is a TorchScript guide (videoseal/docs/torchscript.md),
and TorchScript is NOT ONNX — onnxruntime-web cannot load it. So a torch -> ONNX
export of the extractor is required for on-device web detection. That is this
script.

Model (SOTA image mode, arXiv 2512.16874):
  checkpoint : pixelseal/checkpoint.pth
  url        : https://dl.fbaipublicfiles.com/videoseal/pixelseal/checkpoint.pth
  card       : videoseal/cards/pixelseal.yaml
               (img_size_proc 256, nbits 256, extractor convnext_tiny
                depths [3,3,9,3] dims [96,192,384,768], pixel_decoder embed_dim 768)
A stable fallback is the Video Seal v1.0 image baseline (also 256-bit):
  checkpoint : y_256b_img.pth
  url        : https://dl.fbaipublicfiles.com/videoseal/y_256b_img.pth
  card       : videoseal/cards/videoseal_1.0.yaml

LICENSE: MIT for BOTH code and weights (the content-seal portal states "The code
is licensed under an MIT license"; videoseal's primary license is MIT and the
released checkpoints are distributed under it). MIT is permissive enough to
convert, redistribute, and ship the derived ONNX on-device. BEFORE you ship,
RE-READ the videoseal LICENSE plus any `license:` field / model-card terms AT
DOWNLOAD TIME — Meta sometimes attaches a separate weights/acceptable-use notice
distinct from the code MIT header. As fetched for this spec, none was present.

MUSE CAVEAT (must stay surfaced in the UI — see contentseal.ts / valid.ts):
content-seal states "Content Seal Image is deployed at scale for Muse Image with
a custom proprietary implementation." Meta's production Muse pipeline uses a
PROPRIETARY variant, NOT these open weights. The converted extractor reliably
detects only OPEN Pixel Seal / Video Seal watermarks; it may decode genuine Muse
watermarks as noise. Never claim it detects "Meta Muse" or "Meta AI" generally.

────────────────────────────────────────────────────────────────────────────
THE EXTRACTOR CONTRACT (what the web shell feeds / reads — keep in lockstep)
────────────────────────────────────────────────────────────────────────────
INPUT  'image' : float32 [B, 3, H, W], RGB, range [0, 1] (torchvision ToTensor /
                 divide-by-255). The wrapper below does the resize-to-256 and the
                 [0,1]->[-1,1] scale INSIDE the graph, so the shell feeds raw
                 [0,1] RGB — no ImageNet mean/std. (extractor.py's own
                 self.preprocess is exactly `lambda x: x * 2 - 1`.)
OUTPUT 'preds' : float32 [B, 257] logits = spatial mean over H,W of the
                 extractor's per-pixel [B, 1+nbits, H, W] map. Index 0 is the
                 auxiliary detection bit (dropped by the shell); indices 1..256
                 are the 256 message-bit logits (threshold at 0). The shell runs
                 this graph 4x — once per augmented view (original, JPEG q85,
                 JPEG q60, 5% centre crop) — and applies the message-free
                 consensus rule in engine/src/contentseal.ts.

────────────────────────────────────────────────────────────────────────────
SETUP
────────────────────────────────────────────────────────────────────────────
  python3 -m venv .venv && source .venv/bin/activate
  pip install torch torchvision onnx onnxsim            # + videoseal, e.g.:
  pip install git+https://github.com/facebookresearch/videoseal.git
  # download the checkpoint (or let videoseal.load fetch it):
  #   curl -L -o pixelseal/checkpoint.pth \
  #     https://dl.fbaipublicfiles.com/videoseal/pixelseal/checkpoint.pth

USAGE
  python3 scripts/convert-contentseal-onnx.py                     # pixelseal (default)
  python3 scripts/convert-contentseal-onnx.py --model videoseal_1.0
  python3 scripts/convert-contentseal-onnx.py --out shells/web/public/models/contentseal/content-seal-extractor.onnx
  python3 scripts/convert-contentseal-onnx.py --validate path/to/watermarked.png

ALSO REQUIRED: onnxruntime-web's own WASM runtime, shared with the TrustMark
scanner. After `npm install`, copy it once (see scripts/fetch-trustmark-models.ts):
  mkdir -p shells/web/public/ort
  cp node_modules/onnxruntime-web/dist/*.wasm shells/web/public/ort/
  cp node_modules/onnxruntime-web/dist/*.mjs  shells/web/public/ort/
"""

from __future__ import annotations

import argparse
import os
import sys

# Repo root = one level up from scripts/.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, "shells", "web", "public", "models", "contentseal", "content-seal-extractor.onnx")

# The processing resolution the extractor was trained at (pixelseal.yaml
# img_size_proc). The web shell also resizes each view to this; the graph
# interpolates internally too, so native-resolution input is valid as well.
PROC_SIZE = 256
NBITS = 256
OPSET = 17  # native LayerNormalization + GELU, well supported by onnxruntime-web

MODELS = {
    # name -> (videoseal.load key, human note)
    "pixelseal": "pixelseal",
    "videoseal_1.0": "videoseal_1.0",
}


def build_wrapper(extractor, torch, F):
    """Wrap the extractor so the ONNX graph does the whole single-image
    detect-preprocess: interpolate to 256x256, scale [0,1]->[-1,1] (mirrors
    extractor.py's self.preprocess), run the ConvNeXt/pixel-decoder extractor,
    then spatially average the [B, 1+nbits, H, W] logit map to [B, 1+nbits]."""

    class ContentSealExtractor(torch.nn.Module):
        def __init__(self, extractor):
            super().__init__()
            self.extractor = extractor

        def forward(self, image):  # image: [B, 3, H, W] float32 in [0, 1]
            x = F.interpolate(image, size=(PROC_SIZE, PROC_SIZE), mode="bilinear", align_corners=False)
            x = x * 2 - 1                       # extractor.py self.preprocess
            masks = self.extractor(x)           # [B, 1+nbits, PROC_SIZE, PROC_SIZE]
            preds = masks.mean(dim=(2, 3))      # [B, 1+nbits] logits (index 0 = detection bit)
            return preds

    return ContentSealExtractor(extractor).eval()


def load_extractor(model_name, torch):
    """Load the videoseal model for `model_name` and return its extractor
    submodule in eval mode. videoseal's public API has shifted across releases,
    so try the common shapes and fail loudly with guidance if none match."""
    import videoseal  # noqa: F401  (import here so --help works without it installed)

    key = MODELS[model_name]
    model = None
    # Newer API: videoseal.load("pixelseal")
    if hasattr(videoseal, "load"):
        model = videoseal.load(key)
    else:
        raise SystemExit(
            "Could not find videoseal.load(). Check the installed videoseal version and adapt "
            "load_extractor() to its setup-from-card API (videoseal/cards/%s.yaml)." % key
        )

    # The extractor/detector submodule name has varied: .detector, .extractor, .msg_extractor.
    for attr in ("detector", "extractor", "msg_extractor"):
        sub = getattr(model, attr, None)
        if sub is not None:
            return sub.eval()
    # Some builds expose the whole model as the extractor.
    if callable(model):
        return model.eval()
    raise SystemExit(
        "Loaded the videoseal model but couldn't locate its extractor submodule "
        "(tried .detector/.extractor/.msg_extractor). Inspect the model and adapt load_extractor()."
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Convert Pixel Seal / Video Seal image extractor to ONNX.")
    ap.add_argument("--model", choices=list(MODELS), default="pixelseal",
                    help="Which open image model to convert (default: pixelseal, the SOTA arXiv 2512.16874 model).")
    ap.add_argument("--out", default=DEFAULT_OUT, help="Output .onnx path (default: web shell /models/contentseal/).")
    ap.add_argument("--no-simplify", action="store_true", help="Skip onnx-simplifier even if installed.")
    ap.add_argument("--validate", metavar="IMAGE",
                    help="After export, decode this image with BOTH the torch model and the ONNX graph and compare the 256 thresholded message bits (they should match).")
    args = ap.parse_args()

    try:
        import torch
        import torch.nn.functional as F
    except ImportError:
        raise SystemExit("torch is required. `pip install torch torchvision` (and the videoseal package).")

    print(f"Loading videoseal model '{args.model}' ...")
    extractor = load_extractor(args.model, torch)
    wrapper = build_wrapper(extractor, torch, F)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    dummy = torch.rand(1, 3, PROC_SIZE, PROC_SIZE)  # [0,1] RGB, canonical processing size

    print(f"Exporting ONNX (opset {OPSET}) -> {args.out}")
    torch.onnx.export(
        wrapper,
        dummy,
        args.out,
        input_names=["image"],
        output_names=["preds"],
        # ConvNeXt is fully convolutional, so allow any H,W (multiples of 32);
        # the wrapper interpolates to 256 regardless. Batch is dynamic too.
        dynamic_axes={"image": {0: "batch", 2: "height", 3: "width"}, "preds": {0: "batch"}},
        opset_version=OPSET,
        do_constant_folding=True,
    )

    # Optional graph simplification (ConvNeXt-V2 GRN + stochastic-depth are plain
    # elementwise / inference-noops and export cleanly; simplify just tidies).
    if not args.no_simplify:
        try:
            import onnx
            from onnxsim import simplify
            model = onnx.load(args.out)
            model_simp, ok = simplify(model)
            if ok:
                onnx.save(model_simp, args.out)
                print("onnx-simplifier: simplified graph saved.")
            else:
                print("onnx-simplifier: simplify() reported failure; keeping the un-simplified graph.")
        except ImportError:
            print("onnx-simplifier not installed — skipping (pip install onnx onnxsim to enable).")

    size_mb = os.path.getsize(args.out) / (1024 * 1024)
    print(f"Done. Wrote {args.out} ({size_mb:.1f} MB).")

    if args.validate:
        validate_parity(args, torch, F, wrapper)

    print(
        "\nNext:\n"
        "  1. Copy onnxruntime-web's WASM runtime into shells/web/public/ort/ (see this script's header).\n"
        "  2. npm run dev:web, open /#/valid, drop a Pixel Seal / Video Seal watermarked image, click\n"
        "     'Deep scan for watermarks'. Enable diagnostics first in DevTools:\n"
        "       localStorage.setItem('lolly:contentseal:debug','1')\n"
        "  3. Confirm a green 'Meta Content Seal' pip on a watermarked sample, and NO pip on an ordinary photo.\n"
        "  4. Reload offline and re-scan — should still work from the IndexedDB cache.\n"
        "\nThese files are gitignored (shells/web/.gitignore) — never commit them. If you re-convert with\n"
        "different weights, bump MODEL_CACHE_VERSION in shells/web/src/lib/contentseal.ts.\n"
    )
    return 0


def validate_parity(args, torch, F, wrapper) -> None:
    """Compare the 256 thresholded message bits from the torch wrapper vs the
    exported ONNX graph on a real image. Parity here is the ONLY evidence the
    conversion is faithful — do it against a genuinely watermarked sample before
    trusting the on-device detector."""
    try:
        import numpy as np
        import onnxruntime as ort
        from PIL import Image
    except ImportError:
        print("--validate needs numpy, onnxruntime and pillow — skipping parity check.")
        return

    img = Image.open(args.validate).convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0          # HWC [0,1]
    chw = np.transpose(arr, (2, 0, 1))[None, ...]            # [1,3,H,W]

    with torch.no_grad():
        torch_preds = wrapper(torch.from_numpy(chw)).numpy()[0]
    sess = ort.InferenceSession(args.out, providers=["CPUExecutionProvider"])
    onnx_preds = sess.run(["preds"], {"image": chw})[0][0]

    torch_bits = (torch_preds[1:1 + NBITS] > 0).astype(int)
    onnx_bits = (onnx_preds[1:1 + NBITS] > 0).astype(int)
    mismatches = int((torch_bits != onnx_bits).sum())
    print(f"Parity check: {NBITS - mismatches}/{NBITS} message bits match between torch and ONNX "
          f"({mismatches} mismatch{'es' if mismatches != 1 else ''}).")
    if mismatches:
        print("  WARNING: non-zero mismatch — do NOT ship until the export is faithful (check opset/ops).")


if __name__ == "__main__":
    sys.exit(main())
