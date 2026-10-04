// SPDX-License-Identifier: MPL-2.0
// The test oracle for engine/src/heal.ts (plans/289 D4): runs Compositor's spot_heal
// (HealPixels.c, MIT, unchanged) on one job read from standard input and writes the
// healed pixels to standard output. Built and run by scripts/build-heal-goldens.ts.
//
// Input: six little-endian uint32 values (width, height, mode, seed, opacity x 1e6,
// reserved), then width*height*4 bytes of premultiplied RGBA, then width*height
// bytes of coverage. Output: width*height*4 bytes of RGBA.
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "HealPixels.h"

static int read_all(void *buf, size_t n) { return fread(buf, 1, n, stdin) == n; }

int main(void) {
    uint32_t head[6];
    if (!read_all(head, sizeof head)) return 2;
    size_t w = head[0], h = head[1];
    if (!w || !h || w > 4096 || h > 4096) return 2;
    uint8_t *rgba = malloc(w * h * 4), *cov = malloc(w * h);
    if (!rgba || !cov || !read_all(rgba, w * h * 4) || !read_all(cov, w * h)) return 2;
    if (spot_heal(rgba, cov, w, h, w * 4, (float)head[4] / 1e6f, (int)head[2], head[3]) != 0) return 3;
    fwrite(rgba, 1, w * h * 4, stdout);
    free(rgba);
    free(cov);
    return 0;
}
