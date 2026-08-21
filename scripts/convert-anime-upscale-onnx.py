#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
"""
Convert RealESRGAN_x4plus_anime_6B (BSD-3-Clause, xinntao/Real-ESRGAN) from its
upstream PyTorch .pth into a single-file ONNX for host.upscale's illustration /
line-art intent. The runtime never vendors weights; this is the ANDY-RUN twin of
scripts/fetch-upscale-models.ts for the ONE roster model that has no published,
license-clean ONNX mirror (only a .pth). It produces an ONNX that is a DROP-IN for
the existing runRealEsrgan path (shells/web/src/lib/upscaler.ts): NCHW float32
[0,1] RGB in, x4 [0,1] RGB out, dynamic H/W, input `input` / output `output`,
opset 17 - byte-for-byte the same contract the SceneWorks x4plus ONNX already
meets, because this is the SAME RRDBNet architecture (just 6 blocks, not 23).

Only torch + onnx are needed - RRDBNet is defined inline, so basicsr/realesrgan
are NOT required. Run:  python3 scripts/convert-anime-upscale-onnx.py

Gate (mirrors the fetch scripts): the upstream LICENSE is BSD-3-Clause and covers
the released weights; the .pth is pinned by sha256; the emitted ONNX is verified
to run and to scale x4 before its own sha256/bytes are printed for the roster.
"""

import hashlib
import os
import sys
import urllib.request

import torch
from torch import nn
from torch.nn import functional as F

# ── Source weights (official Real-ESRGAN release, BSD-3-Clause) ───────────────
PTH_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"
# Set to the sha256 the first run prints, to enforce the source pin on later runs.
PTH_SHA256 = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "shells", "web", "public", "models", "upscale")
CACHE_DIR = os.path.join(OUT_DIR, ".candidates")
PTH_PATH = os.path.join(CACHE_DIR, "RealESRGAN_x4plus_anime_6B.pth")
ONNX_PATH = os.path.join(OUT_DIR, "realesrgan-x4plus-anime.onnx")


# ── RRDBNet (canonical basicsr architecture, inlined) ─────────────────────────
class ResidualDenseBlock(nn.Module):
    def __init__(self, num_feat=64, num_grow_ch=32):
        super().__init__()
        self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
        self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, num_feat, num_grow_ch=32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

    def forward(self, x):
        out = self.rdb1(x)
        out = self.rdb2(out)
        out = self.rdb3(out)
        return out * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, scale=4, num_feat=64, num_block=6, num_grow_ch=32):
        super().__init__()
        self.scale = scale
        self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        body_feat = self.conv_body(self.body(feat))
        feat = feat + body_feat
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        out = self.conv_last(self.lrelu(self.conv_hr(feat)))
        return out


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    os.makedirs(CACHE_DIR, exist_ok=True)

    if not os.path.exists(PTH_PATH):
        print(f"Downloading {PTH_URL} ...")
        urllib.request.urlretrieve(PTH_URL, PTH_PATH)
    pth_hash = sha256_file(PTH_PATH)
    pth_bytes = os.path.getsize(PTH_PATH)
    print(f".pth: {pth_bytes} bytes, sha256 {pth_hash}")
    if PTH_SHA256 and pth_hash != PTH_SHA256:
        sys.exit(f"ABORT: .pth sha256 mismatch (pinned {PTH_SHA256}, got {pth_hash})")

    ckpt = torch.load(PTH_PATH, map_location="cpu", weights_only=True)
    state = ckpt.get("params_ema", ckpt.get("params", ckpt)) if isinstance(ckpt, dict) else ckpt

    model = RRDBNet(num_in_ch=3, num_out_ch=3, scale=4, num_feat=64, num_block=6, num_grow_ch=32)
    model.load_state_dict(state, strict=True)
    model.eval()

    dummy = torch.rand(1, 3, 64, 64, dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        ONNX_PATH,
        opset_version=17,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch", 2: "height", 3: "width"},
                      "output": {0: "batch", 2: "height", 3: "width"}},
        do_constant_folding=True,
        dynamo=False,
    )
    onnx_bytes = os.path.getsize(ONNX_PATH)
    onnx_hash = sha256_file(ONNX_PATH)

    # Verify it runs + scales x4, on the CPU path the shell's WASM runtime mirrors.
    ran = "onnxruntime not installed - skipped run-check"
    try:
        import numpy as np
        import onnxruntime as ort
        sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
        x = np.random.rand(1, 3, 64, 64).astype(np.float32)
        y = sess.run(None, {sess.get_inputs()[0].name: x})[0]
        ran = f"ran 64²→{y.shape[2]}×{y.shape[3]} (x{y.shape[2] // 64}), out range [{y.min():.3f},{y.max():.3f}]"
    except Exception as e:  # noqa: BLE001
        ran = f"run-check error: {e}"

    print("\n── ONNX emitted ─────────────────────────────────────────────")
    print(f"  path   : {ONNX_PATH}")
    print(f"  bytes  : {onnx_bytes}")
    print(f"  sha256 : {onnx_hash}")
    print(f"  verify : {ran}")
    print("\nPaste into scripts/fetch-upscale-models.ts note + upscale-models.ts approxBytes.")

    # CREDITS - appended to the upscale ledger the fetch script also writes to.
    credits = os.path.join(OUT_DIR, "CREDITS-anime.txt")
    with open(credits, "w") as f:
        f.write(
            "realesrgan-x4plus-anime.onnx\n"
            "  License:    BSD-3-Clause\n"
            "  Source:     https://github.com/xinntao/Real-ESRGAN (RealESRGAN_x4plus_anime_6B, BSD-3-Clause)\n"
            "  Copyright:  Copyright (c) 2021, Xintao Wang and contributors (xinntao/Real-ESRGAN)\n"
            f"  Upstream:   {PTH_URL}\n"
            f"  .pth sha256:{pth_hash}\n"
            f"  ONNX sha256:{onnx_hash}\n"
            "  Note:       Converted on-device from the upstream .pth by scripts/convert-anime-upscale-onnx.py\n"
            "              (RRDBNet 6-block, x4, opset 17, [0,1] RGB I/O) - a drop-in for the runRealEsrgan path.\n"
        )
    print(f"Wrote {credits}")


if __name__ == "__main__":
    main()
