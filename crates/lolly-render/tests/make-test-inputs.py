#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
"""The crate's picture seeds (tests/seeds) and malformed corpus (tests/malformed).

    python3 -I crates/lolly-render/tests/make-test-inputs.py [--seeds]

The malformed corpus is rewritten every run: each file is a whole input and
manifest.json lists the codes its refusal must hold (tests/malformed.rs). With
--seeds the six 16 x 12 seed pictures are written first, from Pillow's encoders
(libjpeg-turbo, libwebp); a different Pillow writes other bytes, which the fuzz
test (tests/fuzz.rs) accepts, since it checks only that each seed decodes.
Needs Pillow.
"""
import base64, json, os, struct, sys, zlib, io
from PIL import Image

W = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
out = os.path.join(W, 'crates/lolly-render/tests/malformed')
seeds = os.path.join(W, 'crates/lolly-render/tests/seeds')
os.makedirs(out, exist_ok=True)

if '--seeds' in sys.argv:
    w, h = 16, 12
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = (x * 16 % 256, y * 20 % 256, (x * y * 7) % 256)
    rgba = img.convert('RGBA')
    ra = rgba.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = ra[x, y]
            ra[x, y] = (r, g, b, 255 if x < 12 else 128)
    rgba.save(os.path.join(seeds, 'tiny.png'), optimize=False)
    img.save(os.path.join(seeds, 'tiny.jpg'), quality=85, subsampling=2)
    img.save(os.path.join(seeds, 'tiny-progressive.jpg'), quality=85, progressive=True, subsampling=0)
    img.save(os.path.join(seeds, 'tiny-lossy.webp'), quality=80, method=4)
    rgba.save(os.path.join(seeds, 'tiny-lossless.webp'), lossless=True)
    rgba.save(os.path.join(seeds, 'tiny-alpha.webp'), quality=80)
for f in os.listdir(out): os.remove(os.path.join(out, f))
cases = []

def frame(w=64, h=48):
    return {"id": "f", "box": {"x": 0, "y": 0, "w": w, "h": h}, "opacity": 100, "op": "shape", "shape": {"kind": "rect", "radius": 0}, "fills": [{"kind": "color", "color": "#ffffff"}]}

def pic_op(ref='p'):
    return {"id": "pic", "box": {"x": 4, "y": 4, "w": 56, "h": 40}, "opacity": 100, "op": "shape", "shape": {"kind": "rect", "radius": 0}, "fills": [],
            "picture": {"ref": ref, "fit": "cover", "x": 50, "y": 50, "zoom": 1, "area": {"x": 4, "y": 4, "w": 56, "h": 40},
                        "element": {"box": {"x": 4, "y": 4, "w": 56, "h": 40}, "shape": {"kind": "rect", "radius": 0}},
                        "clip": {"box": {"x": 4, "y": 4, "w": 56, "h": 40}, "shape": {"kind": "rect", "radius": 0}},
                        "label": "Picture not available here", "natural": {"width": 16, "height": 12}}}

def envelope(ops=None, resources=None, **over):
    e = {"format": "lolly-render-input", "version": 1, "drawVersion": 0, "output": {"width": 64, "height": 48, "dpi": 96},
         "page": {"version": 0, "width": 64, "height": 48, "background": "#ffffff", "findings": [], "frame": frame(), "ops": ops or []},
         "resources": resources or []}
    for k, v in over.items():
        if k == 'page': e['page'].update(v)
        else: e[k] = v
    return e

def add(name, data, codes, why):
    path = os.path.join(out, name)
    with open(path, 'wb') as fh: fh.write(data if isinstance(data, bytes) else json.dumps(data, separators=(',', ':')).encode())
    cases.append({"file": name, "codes": codes, "why": why})

def with_picture(name, pic_bytes, codes, why, declared='image/png'):
    add(name, envelope([pic_op()], [{"ref": "p", "type": declared, "data": base64.b64encode(pic_bytes).decode()}]), codes, why)

def chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)

def png(w, h, depth=8, colour=6, extra=b'', rows=None):
    ihdr = struct.pack('>IIBBBBB', w, h, depth, colour, 0, 0, 0)
    bpp = {6: 4, 2: 3, 0: 1}[colour] * depth // 8
    raw = rows if rows is not None else b''.join(b'\0' + b'\x80' * (w * bpp) for _ in range(h))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + extra + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

tiny_png = open(os.path.join(seeds, 'tiny.png'), 'rb').read()
tiny_jpg = open(os.path.join(seeds, 'tiny.jpg'), 'rb').read()
tiny_webp = open(os.path.join(seeds, 'tiny-lossy.webp'), 'rb').read()

# The envelope.
add('empty.json', b'', ['input-json'], 'no bytes at all')
add('not-utf8.json', b'\xff\xfe{\x00', ['input-json'], 'bytes that are not UTF-8 JSON')
add('array.json', b'[]', ['input-json'], 'JSON, but not an object')
add('truncated.json', json.dumps(envelope()).encode()[:120], ['input-json'], 'the envelope cut short')
add('deep.json', b'{"format":"lolly-render-input","version":1,"drawVersion":0,"output":{"width":64,"height":48},"page":' + b'[' * 4000 + b']' * 4000 + b',"resources":[]}', ['input-json'], 'nesting far past the reader\'s recursion limit')
add('huge-number.json', json.dumps(envelope()).replace('"width": 64', '"width": 1e400', 1).encode(), ['input-json'], 'a number too large for a float')
add('unknown-field.json', dict(envelope(), extra=True), ['input-field'], 'a field the envelope does not have')
add('format.json', envelope(format='something-else'), ['input-format'], 'another format\'s envelope')
add('version.json', envelope(version=2), ['input-version'], 'an envelope version this build does not read')
add('draw-version.json', envelope(drawVersion=1), ['draw-version'], 'drawing operations of another version')
add('output-zero.json', envelope(output={"width": 0, "height": 0}), ['output-size'], 'a zero size')
add('output-huge.json', envelope(output={"width": 8193, "height": 6145}), ['output-size'], 'a side over 8192 pixels')
add('output-fraction.json', envelope(output={"width": 64.5, "height": 48}), ['output-size'], 'a size in part pixels')
add('output-dpi.json', envelope(output={"width": 64, "height": 48, "dpi": -1}), ['output-dpi'], 'a negative resolution')
add('output-proportions.json', envelope(output={"width": 64, "height": 64}), ['output-proportions'], 'a size of other proportions than the page')
add('page-size.json', envelope(page={"width": 0}), ['page-size'], 'a page with no width')
add('finding.json', envelope(page={"findings": [{"id": "x", "feature": "fit-text"}]}), ['finding'], 'a page the engine reports it cannot carry')
add('unknown-op.json', envelope([{"id": "x", "box": {"x": 0, "y": 0, "w": 1, "h": 1}, "opacity": 100, "op": "teleport"}]), ['unknown-op'], 'an operation of an unknown kind')
add('long-id.json', envelope([dict(pic_op(), id='x' * 300, picture=None)]), ['id'], 'an id over 256 characters')
add('lottie-path.json', envelope([{"id": "a", "box": {"x": 0, "y": 0, "w": 10, "h": 10}, "opacity": 100, "op": "shape", "shape": {"kind": "path", "commands": []}, "fills": [{"kind": "color", "color": "#000000"}]}]), ['compatibility-reading'], 'a path that keeps Lottie commands')
add('bad-colour.json', envelope([{"id": "c", "box": {"x": 0, "y": 0, "w": 10, "h": 10}, "opacity": 100, "op": "shape", "shape": {"kind": "rect", "radius": 0}, "fills": [{"kind": "color", "color": "var(--brand)"}]}]), ['colour'], 'a colour left unresolved')
add('nan-box.json', json.dumps(envelope([{"id": "n", "box": {"x": 0, "y": 0, "w": 10, "h": 10}, "opacity": 100, "op": "shape", "shape": {"kind": "rect", "radius": 0}, "fills": [{"kind": "color", "color": "#000000"}]}])).replace('"w": 10, "h": 10}, "opacity"', '"w": 1e300, "h": 10}, "opacity"').replace('"w":10,"h":10},"opacity"', '"w":1e300,"h":10},"opacity"').encode(), ['geometry'], 'a box far outside the coordinate bound')

# Pictures.
add('picture-missing.json', envelope([pic_op('q')], [{"ref": "p", "type": "image/png", "data": base64.b64encode(tiny_png).decode()}]), ['picture-missing'], 'an operation naming a picture the input does not carry')
add('picture-duplicate.json', envelope([pic_op()], [{"ref": "p", "type": "image/png", "data": base64.b64encode(tiny_png).decode()}] * 2), ['picture'], 'two pictures under one ref')
add('picture-base64.json', envelope([pic_op()], [{"ref": "p", "type": "image/png", "data": "not base64!"}]), ['picture-unreadable'], 'picture data that is not base64')
with_picture('png-truncated.json', tiny_png[:60], ['picture-unreadable'], 'a PNG cut short')
with_picture('png-bad-crc.json', tiny_png[:30] + bytes([tiny_png[30] ^ 0xff]) + tiny_png[31:], ['picture-unreadable'], 'a PNG whose header checksum is wrong')
with_picture('png-huge.json', png(70000, 70000, rows=b''), ['picture-size'], 'a PNG claiming 70000 x 70000 pixels')
with_picture('png-sixteen-bit.json', png(2, 2, depth=16), ['picture-depth'], 'a PNG of 16 bits a channel')
with_picture('png-own-gamma.json', png(2, 2, extra=chunk(b'gAMA', struct.pack('>I', 100000))), ['picture-colour'], 'a PNG with a gamma of its own')
with_picture('png-own-profile.json', png(2, 2, extra=chunk(b'iCCP', b'not srgb\0\0' + zlib.compress(b'\0' * 200))), ['picture-colour'], 'a PNG with a colour profile that is not sRGB')
with_picture('png-animated.json', png(2, 2, extra=chunk(b'acTL', struct.pack('>II', 2, 0))), ['picture-motion'], 'an animated PNG')
with_picture('jpeg-truncated.json', tiny_jpg[:200], ['picture-unreadable'], 'a JPEG cut short', 'image/jpeg')
img = Image.new('CMYK', (4, 4), (0, 128, 255, 0)); b = io.BytesIO(); img.save(b, 'JPEG'); cmyk = b.getvalue()
with_picture('jpeg-cmyk.json', cmyk, ['picture-type'], 'a CMYK JPEG', 'image/jpeg')
img = Image.new('RGB', (4, 2), (200, 30, 30)); ex = Image.Exif(); ex[0x0112] = 6; b = io.BytesIO(); img.save(b, 'JPEG', exif=ex.tobytes()); turned = b.getvalue()
with_picture('jpeg-turned.json', turned, ['picture-orientation'], 'a JPEG whose Exif says to turn it', 'image/jpeg')
with_picture('webp-truncated.json', tiny_webp[:40], ['picture-unreadable'], 'a WebP cut short', 'image/webp')
frames = [Image.new('RGB', (4, 4), c) for c in [(255, 0, 0), (0, 0, 255)]]; b = io.BytesIO(); frames[0].save(b, 'WEBP', save_all=True, append_images=frames[1:], duration=100); anim = b.getvalue()
with_picture('webp-animated.json', anim, ['picture-motion'], 'an animated WebP', 'image/webp')
bits = (16384 - 1) | ((16384 - 1) << 14)
vp8l = bytes([0x2f]) + struct.pack('<I', bits) + b'\0' * 7
huge_webp = b'RIFF' + struct.pack('<I', 4 + 8 + len(vp8l)) + b'WEBP' + b'VP8L' + struct.pack('<I', len(vp8l)) + vp8l
with_picture('webp-huge.json', huge_webp, ['picture-size'], 'a lossless WebP of 16384 x 16384 pixels', 'image/webp')
with_picture('gif.json', b'GIF89a\x01\x00\x01\x00\x00\x00\x00;', ['picture-type'], 'a GIF', 'image/gif')
with_picture('svg.json', b'<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>', ['picture-vector'], 'a vector picture', 'image/svg+xml')
with_picture('unknown-type.json', b'\0\0\0\0garbage', ['picture-type'], 'bytes of no known picture type')

open(os.path.join(out, 'manifest.json'), 'w').write(json.dumps({"about": "Small malformed inputs and the refusal codes each must give, the first code first. Written by ../make-test-inputs.py; each file is the whole input.", "cases": cases}, indent=1) + '\n')
print(len(cases), 'cases')
