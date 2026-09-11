const nt = {
  clickDepthSpring: 115,
  clickDepthDamping: 18,
  insidePressSpring: 92,
  insidePressDamping: 15,
  insideLocalBulgeImpulse: 390,
  insideLocalHoldBulgeForce: 48,
  pressSpring: 76,
  pressDamping: 13,
  holdPressAmount: 0,
  heldCurveSpring: 135,
  heldCurveDamping: 22,
  insideHeldBulgeAmount: 10.8,
  insideHeldHaloAmount: 2.65,
  insideHeldDepthAmount: 0,
  insidePointInfluenceWidth: 38,
  insidePointHaloWidth: 70,
  insidePointEdgeBoost: 0.44,
  outsideHeldDentAmount: 7.2,
  outsideHeldSideBulgeAmount: 1.7,
  outsideHeldDepthAmount: 9.4,
  normalBlendPasses: 3,
  curveTension: 0.68,
  axisDepth: 34,
  axisSpring: 48,
  axisDamping: 11,
  depthImpulse: 420,
  depthBulgeImpulse: 130,
  depthSpring: 76,
  depthDamping: 14,
  depthCoupling: 150,
  maxDepthIn: -26,
  maxDepthOut: 16,
  zRotateSpring: 42,
  zRotateDamping: 12,
  zRotateImpulse: 0.14,
  membraneSpring: 96,
  membraneDamping: 17,
  waveCoupling: 145,
  pressure: 620,
  volumeCorrection: 0.1,
  outsideDentImpulse: 255,
  outsideSideBulgeImpulse: 54,
  outsideOppositeBulgeImpulse: 74,
  rippleWidth: 8,
  outsideHoldForce: 20,
  outsideHoldDepthForce: 52,
  maxDent: 8,
  maxBulge: 24,
  perspective: 390,
  samples: 240
};
let Rt = 0;
function X(n = "jelly") {
  return `${n}-${++Rt}`;
}
function g(n, t, e = null, i = {}) {
  const s = new CustomEvent(t, {
    bubbles: !0,
    composed: !0,
    detail: e,
    ...i
  });
  return n.dispatchEvent(s);
}
function V(n, t, e = 0) {
  const i = n.getAttribute(t);
  if (i === null || i.trim() === "")
    return e;
  const s = Number(i);
  return Number.isFinite(s) ? s : e;
}
function B(n) {
  return String(n).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function k(n) {
  return getComputedStyle(n).direction === "rtl";
}
const J = {
  sm: "small",
  md: "medium",
  lg: "large"
};
function q(n, t) {
  const e = n.getAttribute("size");
  for (const i of n.querySelectorAll(t)) {
    const s = i.hasAttribute("data-jelly-inherited-size");
    e ? (!i.hasAttribute("size") || s) && (i.setAttribute("size", e), i.setAttribute("data-jelly-inherited-size", "")) : s && (i.removeAttribute("size"), i.removeAttribute("data-jelly-inherited-size"));
  }
}
function j(n) {
  const t = n.getAttribute("size");
  t && J[t] && n.setAttribute("size", J[t]);
}
function Pt(n, t = "medium") {
  const e = (n.getAttribute("size") || "").toLowerCase();
  return J[e] ? J[e] : e === "small" || e === "medium" || e === "large" ? e : t;
}
function m(n, t, e) {
  return Math.max(t, Math.min(e, n));
}
function E(n, t, e, i, s, r) {
  const o = (e - n) * i - t * s, l = t + o * r;
  return [n + l * r, l];
}
const ut = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
function F() {
  const n = typeof document < "u" ? document.documentElement.getAttribute("data-jelly-motion") : null;
  return n === "reduce" ? !0 : n === "no-preference" ? !1 : ut ? ut.matches : !1;
}
function T(n = 8) {
  if ("vibrate" in navigator)
    try {
      navigator.vibrate(n);
    } catch {
    }
}
function O(n, t = !1) {
  return n === "ArrowRight" ? t ? -1 : 1 : n === "ArrowLeft" ? t ? 1 : -1 : 0;
}
function kt(n, t, e, { rtl: i = !1, wrap: s = !0, horizontal: r = !0, vertical: o = !0 } = {}) {
  let l = 0;
  if (r && (l = O(n, i)), o && l === 0 && (n === "ArrowDown" && (l = 1), n === "ArrowUp" && (l = -1)), n === "Home")
    return 0;
  if (n === "End")
    return e - 1;
  if (l === 0 || e === 0)
    return -1;
  const d = t + l;
  return s ? (d + e) % e : m(d, 0, e - 1);
}
const Ht = 1 / 58;
function pt(n, t, e) {
  const i = m((e - n) / (t - n), 0, 1);
  return i * i * (3 - 2 * i);
}
function A(n, t) {
  return (n + t) % t;
}
function bt(n, t, e) {
  const i = Math.abs(n - t);
  return Math.min(i, e - i);
}
function N(n, t) {
  return Math.exp(-(n * n) / (2 * t * t));
}
function Vt(n, t, e, i, s) {
  const r = Math.min(s, e, i), o = Math.abs(n) - (e - r), l = Math.abs(t) - (i - r), d = Math.hypot(Math.max(o, 0), Math.max(l, 0)), h = Math.min(Math.max(o, l), 0);
  return d + h - r;
}
function gt(n, t, e, i) {
  const s = n / 2, r = t / 2, o = Math.min(e, s, r), l = [], d = (v, x) => {
    l.push({ x: v, y: x });
  }, h = 48, a = 48;
  function c(v, x, y, w, S) {
    for (let M = S ? 0 : 1; M <= h; M++) {
      const I = M / h;
      d(v + (y - v) * I, x + (w - x) * I);
    }
  }
  function p(v, x, y, w) {
    for (let S = 1; S <= a; S++) {
      const M = y + (w - y) * (S / a);
      d(v + Math.cos(M) * o, x + Math.sin(M) * o);
    }
  }
  c(-s + o, -r, s - o, -r, !0), p(s - o, -r + o, -Math.PI / 2, 0), c(s, -r + o, s, r - o, !1), p(s - o, r - o, 0, Math.PI / 2), c(s - o, r, -s + o, r, !1), p(-s + o, r - o, Math.PI / 2, Math.PI), c(-s, r - o, -s, -r + o, !1), p(-s + o, -r + o, Math.PI, Math.PI * 1.5);
  const u = [0];
  let f = 0;
  for (let v = 0; v < l.length; v++) {
    const x = l[v], y = l[A(v + 1, l.length)];
    f += Math.hypot(y.x - x.x, y.y - x.y), u.push(f);
  }
  const C = [];
  for (let v = 0; v < i; v++) {
    const x = v / i * f;
    let y = 0;
    for (; y < l.length - 1 && u[y + 1] < x; )
      y += 1;
    const w = l[y], S = l[(y + 1) % l.length], M = u[y], I = u[y + 1], Bt = Math.max(I - M, 1e-4), dt = (x - M) / Bt;
    C.push({
      x: w.x + (S.x - w.x) * dt,
      y: w.y + (S.y - w.y) * dt,
      nx: 0,
      ny: 0,
      d: 0,
      v: 0,
      z: 0,
      zv: 0
    });
  }
  return $t(C), C;
}
function Dt(n, t) {
  const e = n.length, i = n[A(t - 1, e)], s = n[A(t + 1, e)], r = s.x - i.x, o = s.y - i.y, l = Math.hypot(o, -r) || 1;
  return { nx: o / l, ny: -r / l };
}
function $t(n) {
  const t = n.length;
  let e = n.map((i, s) => Dt(n, s));
  for (let i = 0; i < nt.normalBlendPasses; i++)
    e = e.map((s, r) => {
      const o = e[A(r - 1, t)], l = e[A(r + 1, t)], d = o.nx * 0.22 + s.nx * 0.56 + l.nx * 0.22, h = o.ny * 0.22 + s.ny * 0.56 + l.ny * 0.22, a = Math.hypot(d, h) || 1;
      return { nx: d / a, ny: h / a };
    });
  for (let i = 0; i < t; i++)
    n[i].nx = e[i].nx, n[i].ny = e[i].ny;
}
function _(n) {
  let t = 0;
  for (let e = 0; e < n.length; e++) {
    const i = n[e], s = n[A(e + 1, n.length)];
    t += i.x * s.y - s.x * i.y;
  }
  return Math.abs(t) * 0.5;
}
function Q(n, t, e = nt.curveTension) {
  const i = t.length;
  n.beginPath(), n.moveTo(t[0].x, t[0].y);
  for (let s = 0; s < i; s++) {
    const r = t[A(s - 1, i)], o = t[s], l = t[A(s + 1, i)], d = t[A(s + 2, i)], h = o.x + (l.x - r.x) * e / 6, a = o.y + (l.y - r.y) * e / 6, c = l.x - (d.x - o.x) * e / 6, p = l.y - (d.y - o.y) * e / 6;
    n.bezierCurveTo(h, a, c, p, l.x, l.y);
  }
  n.closePath();
}
class D {
  constructor({ width: t, height: e, radius: i, config: s }) {
    this.width = t, this.height = e, this.radius = i ?? Math.min(t, e) / 2, this.config = { ...nt, ...s ?? {} }, this.lean = 0, this.leanAmount = 0, this.membrane = gt(t, e, this.radius, this.config.samples), this.state = {
      clickDepth: 0,
      clickDepthV: 0,
      targetClickDepth: 0,
      insidePress: 0,
      insidePressV: 0,
      targetInsidePress: 0,
      press: 0,
      pressV: 0,
      targetPress: 0,
      insideCurveHold: 0,
      insideCurveHoldV: 0,
      targetInsideCurveHold: 0,
      rotateZ: 0,
      rotateZV: 0,
      tiltX: 0,
      tiltXV: 0,
      tiltY: 0,
      tiltYV: 0,
      targetTiltX: 0,
      targetTiltY: 0,
      pointerActive: !1,
      pointerInsideWeight: 0,
      pointerIndex: 0,
      pointerLocalX: 0,
      pointerLocalY: 0
    }, this.baseArea = _(this.getSurfacePoints());
  }
  // Rebuild the ring for a new size, preserving no motion (used on resize)
  resize(t, e, i) {
    this.width = t, this.height = e, this.radius = i ?? Math.min(t, e) / 2, this.membrane = gt(t, e, this.radius, this.config.samples), this.baseArea = _(this.getSurfacePoints());
  }
  // Signed distance from a local point to the resting surface
  sdf(t, e) {
    return Vt(t, e, this.width / 2, this.height / 2, this.radius);
  }
  // Index of the membrane point closest to a local coordinate
  nearestMembraneIndex(t, e) {
    let i = 0, s = 1 / 0;
    for (let r = 0; r < this.membrane.length; r++) {
      const o = this.membrane[r], l = t - o.x, d = e - o.y, h = l * l + d * d;
      h < s && (s = h, i = r);
    }
    return i;
  }
  // Kick the membrane outward around a ring index with a gaussian falloff
  addMembraneImpulse(t, e, i) {
    const s = this.membrane.length;
    for (let r = 0; r < s; r++) {
      const o = bt(r, t, s);
      this.membrane[r].v += e * N(o, i);
    }
  }
  // Kick the membrane's depth (z) around a ring index with a gaussian falloff
  addDepthImpulse(t, e, i) {
    const s = this.membrane.length;
    for (let r = 0; r < s; r++) {
      const o = bt(r, t, s);
      this.membrane[r].zv += e * N(o, i);
    }
  }
  // Bulge the membrane around the pointer with a softer counter-halo
  addInsidePointImpulse(t) {
    for (let e = 0; e < this.membrane.length; e++) {
      const i = this.insidePointInfluence(e);
      this.membrane[e].v += t * (i.local - i.halo * 0.18);
    }
  }
  // Five-tap smoothing of one membrane channel around an index
  smoothedMembraneValue(t, e) {
    const i = this.membrane.length, s = this.membrane[A(t - 2, i)][e], r = this.membrane[A(t - 1, i)][e], o = this.membrane[t][e], l = this.membrane[A(t + 1, i)][e], d = this.membrane[A(t + 2, i)][e];
    return s * 0.06 + r * 0.2 + o * 0.48 + l * 0.2 + d * 0.06;
  }
  // How strongly the pointer's held position affects one membrane point
  insidePointInfluence(t) {
    const e = this.membrane[t], i = e.x - this.state.pointerLocalX, s = e.y - this.state.pointerLocalY, r = Math.hypot(i, s), o = N(r, this.config.insidePointInfluenceWidth), l = N(r, this.config.insidePointHaloWidth), d = m(
      Math.hypot(
        this.state.pointerLocalX / (this.width / 2),
        this.state.pointerLocalY / (this.height / 2)
      ),
      0,
      1
    ), h = 1 + pt(0.12, 0.82, d) * this.config.insidePointEdgeBoost;
    return {
      local: o * h,
      halo: Math.max(l - o * 0.34, 0)
    };
  }
  // Sustained bulge / depth offsets while the pointer is held inside
  heldMembraneOffsets(t) {
    const e = this.insidePointInfluence(t);
    return {
      d: this.state.insideCurveHold * (this.config.insideHeldBulgeAmount * e.local - this.config.insideHeldHaloAmount * e.halo),
      z: -this.state.insideCurveHold * this.config.insideHeldDepthAmount * e.local
    };
  }
  // Five-tap smoothing over a plain array of ring values
  smoothArrayValue(t, e) {
    const i = t.length;
    return t[A(e - 2, i)] * 0.06 + t[A(e - 1, i)] * 0.2 + t[e] * 0.48 + t[A(e + 1, i)] * 0.2 + t[A(e + 2, i)] * 0.06;
  }
  /*
   * The current deformed surface. `offset` pushes every point outward along
   * its normal - used to trace a focus ring that follows the same jiggle.
   */
  getSurfacePoints(t = 0) {
    const e = [], i = this.membrane.length, s = new Array(i), r = new Array(i);
    for (let o = 0; o < i; o++) {
      const l = this.heldMembraneOffsets(o);
      s[o] = this.smoothedMembraneValue(o, "d") + l.d, r[o] = this.smoothedMembraneValue(o, "z") + l.z;
    }
    for (let o = 0; o < i; o++) {
      const l = this.membrane[o], d = this.smoothArrayValue(s, o), h = this.smoothArrayValue(r, o), a = this.smoothArrayValue(s, A(o - 1, i)), p = this.smoothArrayValue(s, A(o + 1, i)) - a, u = -l.ny, f = l.nx, C = p * 0.05, v = this.leanAmount === 0 ? 0 : this.lean * m(l.x / (this.width / 2), -1, 1) * this.leanAmount, x = l.x + l.nx * (d + t + v) + u * C, y = l.y + l.ny * (d + t + v) + f * C, w = m(x / (this.width / 2), -1, 1), S = m(y / (this.height / 2), -1, 1), M = -(w * this.state.tiltY + S * this.state.tiltX) * this.config.axisDepth;
      e.push({ x, y, z: M + h });
    }
    return e;
  }
  // Apply the perspective projection to one surface point
  projectPoint(t) {
    const e = this.config.perspective / (this.config.perspective - t.z);
    return { x: t.x * e, y: t.y * e, z: t.z };
  }
  // Aim the held-press springs at the pointer's current position
  updatePressTargets(t, e, i = 1) {
    this.state.pointerLocalX = t, this.state.pointerLocalY = e;
    const s = this.sdf(t, e), r = (1 - pt(-2, 5, s)) * i;
    return this.state.pointerInsideWeight = r, this.state.targetClickDepth = r, this.state.targetInsidePress = r, this.state.targetPress = r * this.config.holdPressAmount, this.state.targetInsideCurveHold = r, { insideWeight: r };
  }
  // Press at a point already in local (shape-centered) coordinates
  pressAtLocal(t, e, i = 1, s = 1) {
    const r = this.nearestMembraneIndex(t, e);
    this.state.pointerIndex = r, this.state.pointerActive = !0;
    const { insideWeight: o } = this.updatePressTargets(t, e, s), l = i * 1.15 * s;
    o > 0.01 && (this.addInsidePointImpulse(this.config.insideLocalBulgeImpulse * o * l), this.state.pressV += 1.9 * o * l);
  }
  // Follow the pointer while it is held down
  moveToLocal(t, e, i = 1) {
    this.state.pointerIndex = this.nearestMembraneIndex(t, e), this.updatePressTargets(t, e, i);
  }
  // A press whose energy comes from the shape center (keyboard activation)
  centerPulse(t = 1) {
    this.pressAtLocal(0, 0, t);
  }
  /*
   * A one-shot squish from the center that settles on its own - for feedback
   * that isn't a sustained press (focus, toggle, grab). Unlike centerPulse it
   * sets no held target, so the body returns to rest and can sleep.
   */
  centerPop(t = 1) {
    this.state.pointerLocalX = 0, this.state.pointerLocalY = 0, this.addInsidePointImpulse(this.config.insideLocalBulgeImpulse * 0.5 * t), this.state.pressV += 0.9 * t;
  }
  /*
   * A one-shot directional jiggle along an axis: the leading edge (normals
   * aligned with the direction) bulges out and the trailing edge tucks in, so
   * the blob stretches the way it's thrown. Used by the sliding controls and
   * jelly-alert's shake.
   */
  stretchAlong(t, e, i = 1) {
    const s = Math.hypot(t, e) || 1, r = t / s, o = e / s, l = this.config.insideLocalBulgeImpulse * 0.42 * i;
    for (const d of this.membrane) {
      const h = d.nx * r + d.ny * o;
      d.v += l * h;
    }
  }
  // A one-shot ripple with no hold (typing feedback, toggles, etc.)
  pulseAt(t, e, i = 1) {
    const s = this.nearestMembraneIndex(t, e);
    this.state.pointerLocalX = t, this.state.pointerLocalY = e, this.addMembraneImpulse(
      s,
      this.config.insideLocalBulgeImpulse * 0.5 * i,
      this.config.rippleWidth * 1.6
    );
  }
  // Let go: clear every held target and give a small parting kick
  release() {
    this.state.pointerActive = !1, this.state.targetClickDepth = 0, this.state.targetInsidePress = 0, this.state.targetPress = 0, this.state.targetInsideCurveHold = 0, this.state.targetTiltX = 0, this.state.targetTiltY = 0, this.state.pointerInsideWeight = 0, this.state.pressV -= 0.55;
  }
  // Advance the whole-body springs (press depth, tilt, rotation) one step
  updateGlobal(t) {
    const e = this.state, i = this.config;
    [e.clickDepth, e.clickDepthV] = E(
      e.clickDepth,
      e.clickDepthV,
      e.targetClickDepth,
      i.clickDepthSpring,
      i.clickDepthDamping,
      t
    ), [e.insidePress, e.insidePressV] = E(
      e.insidePress,
      e.insidePressV,
      e.targetInsidePress,
      i.insidePressSpring,
      i.insidePressDamping,
      t
    ), [e.press, e.pressV] = E(
      e.press,
      e.pressV,
      e.targetPress,
      i.pressSpring,
      i.pressDamping,
      t
    ), [e.insideCurveHold, e.insideCurveHoldV] = E(
      e.insideCurveHold,
      e.insideCurveHoldV,
      e.targetInsideCurveHold,
      i.heldCurveSpring,
      i.heldCurveDamping,
      t
    ), [e.rotateZ, e.rotateZV] = E(
      e.rotateZ,
      e.rotateZV,
      0,
      i.zRotateSpring,
      i.zRotateDamping,
      t
    ), [e.tiltX, e.tiltXV] = E(
      e.tiltX,
      e.tiltXV,
      e.targetTiltX,
      i.axisSpring,
      i.axisDamping,
      t
    ), [e.tiltY, e.tiltYV] = E(
      e.tiltY,
      e.tiltYV,
      e.targetTiltY,
      i.axisSpring,
      i.axisDamping,
      t
    ), e.clickDepth = m(e.clickDepth, 0, 1), e.insidePress = m(e.insidePress, 0, 1), e.press = m(e.press, -0.025, 0.085), e.insideCurveHold = m(e.insideCurveHold, 0, 1), e.rotateZ = m(e.rotateZ, -0.018, 0.018), e.tiltX = m(e.tiltX, -1, 1), e.tiltY = m(e.tiltY, -1, 1);
  }
  // Advance the membrane wave equation one step
  updateMembrane(t) {
    const e = this.membrane.length, i = this.config, s = this.getSurfacePoints(), r = _(s), o = m((this.baseArea - r) / this.baseArea, -0.08, 0.08), l = new Array(e), d = new Array(e);
    for (let a = 0; a < e; a++) {
      const c = this.membrane[a], p = this.membrane[A(a - 1, e)], u = this.membrane[A(a + 1, e)], f = p.d + u.d - 2 * c.d, C = p.z + u.z - 2 * c.z;
      l[a] = -c.d * i.membraneSpring + f * i.waveCoupling - c.v * i.membraneDamping + o * i.pressure, d[a] = -c.z * i.depthSpring + C * i.depthCoupling - c.zv * i.depthDamping;
    }
    if (this.state.pointerActive && this.state.pointerInsideWeight > 0.02)
      for (let a = 0; a < e; a++) {
        const c = this.insidePointInfluence(a);
        l[a] += i.insideLocalHoldBulgeForce * c.local * this.state.pointerInsideWeight, l[a] -= i.insideLocalHoldBulgeForce * 0.18 * c.halo * this.state.pointerInsideWeight;
      }
    for (let a = 0; a < e; a++) {
      const c = this.membrane[a];
      c.v += l[a] * t, c.d += c.v * t, c.zv += d[a] * t, c.z += c.zv * t, c.d = m(c.d, -i.maxDent, i.maxBulge), c.v = m(c.v, -410, 410), c.z = m(c.z, i.maxDepthIn, i.maxDepthOut), c.zv = m(c.zv, -600, 600);
    }
    let h = 0;
    for (const a of this.membrane)
      h += a.d;
    h /= e;
    for (const a of this.membrane)
      a.d -= h * i.volumeCorrection;
  }
  /*
   * Advance the simulation by a frame delta. The delta is split into
   * substeps no longer than MAX_STEP so the integration stays stable on
   * slow frames, low-Hz displays and after background-tab pauses.
   */
  update(t) {
    const e = Math.max(1, Math.ceil(t / Ht)), i = t / e;
    for (let s = 0; s < e; s++)
      this.updateGlobal(i), this.updateMembrane(i);
    this.recoverIfUnstable();
  }
  /*
   * Defensive backstop: if anything ever produced a non-finite number
   * (a zero-sized rebuild, an extreme external mutation), reset all motion
   * instead of painting garbage forever. The clamps make this near
   * impossible, but a physics toy should never be able to wedge the UI.
   */
  recoverIfUnstable() {
    const t = this.state;
    let e = Number.isFinite(t.press) && Number.isFinite(t.clickDepth) && Number.isFinite(t.rotateZ);
    if (e) {
      for (const i of this.membrane)
        if (!Number.isFinite(i.d) || !Number.isFinite(i.v) || !Number.isFinite(i.z) || !Number.isFinite(i.zv)) {
          e = !1;
          break;
        }
    }
    if (!e) {
      for (const i of this.membrane)
        i.d = 0, i.v = 0, i.z = 0, i.zv = 0;
      t.clickDepth = 0, t.clickDepthV = 0, t.insidePress = 0, t.insidePressV = 0, t.press = 0, t.pressV = 0, t.insideCurveHold = 0, t.insideCurveHoldV = 0, t.rotateZ = 0, t.rotateZV = 0, t.tiltX = 0, t.tiltXV = 0, t.tiltY = 0, t.tiltYV = 0;
    }
  }
  // True when the body has essentially stopped moving and nothing is held
  isResting() {
    const t = this.state;
    if (t.pointerActive || Math.abs(t.clickDepth) > 1e-3 || Math.abs(t.insidePress) > 1e-3 || Math.abs(t.insideCurveHold) > 1e-3 || Math.abs(t.rotateZ) > 1e-4 || Math.abs(t.tiltX) > 1e-3 || Math.abs(t.tiltY) > 1e-3)
      return !1;
    for (const e of this.membrane)
      if (Math.abs(e.d) > 0.03 || Math.abs(e.v) > 0.05 || Math.abs(e.z) > 0.03 || Math.abs(e.zv) > 0.05)
        return !1;
    return !0;
  }
}
class qt {
  constructor() {
    this.active = /* @__PURE__ */ new Set(), this.running = !1, this.lastTime = 0, this.loop = this.loop.bind(this);
  }
  // Add a component to the loop and start it if it was parked
  wake(t) {
    this.active.add(t), this.running || (this.running = !0, this.lastTime = performance.now(), requestAnimationFrame(this.loop));
  }
  // Remove a component from the loop (used on disconnect)
  drop(t) {
    this.active.delete(t);
  }
  // One shared animation frame: step every live component, park when idle.
  // The delta is capped so a background-tab pause never becomes one giant step.
  loop(t) {
    const e = m((t - this.lastTime) / 1e3, 0, 0.033);
    this.lastTime = t;
    for (const i of this.active) {
      let s = !1;
      i.frameDt = e, i.colorEasing = !1;
      try {
        s = i.frame(e);
      } catch (r) {
        console.error("Jelly UI frame error", r);
      }
      !s && !i.colorEasing && this.active.delete(i);
    }
    this.active.size > 0 ? requestAnimationFrame(this.loop) : this.running = !1;
  }
}
const yt = new qt(), P = 8;
function Xt(n, t) {
  if (n !== "start" && n !== "end")
    return n;
  const e = k(t);
  return n === "start" ? e ? "right" : "left" : e ? "left" : "right";
}
function W(n, t, e = "bottom", i = 8) {
  const s = Xt(e, n), r = n.getBoundingClientRect(), o = t.getBoundingClientRect(), l = window.innerWidth, d = window.innerHeight;
  let h = s;
  s === "top" && r.top - o.height - i < P && r.bottom + o.height + i < d ? h = "bottom" : s === "bottom" && r.bottom + o.height + i > d - P && r.top - o.height - i > 0 ? h = "top" : s === "left" && r.left - o.width - i < P && r.right + o.width + i < l ? h = "right" : s === "right" && r.right + o.width + i > l - P && r.left - o.width - i > 0 && (h = "left");
  let a, c;
  h === "top" ? a = r.top - o.height - i : h === "bottom" ? a = r.bottom + i : a = r.top + (r.height - o.height) / 2, h === "left" ? c = r.left - o.width - i : h === "right" ? c = r.right + i : c = r.left + (r.width - o.width) / 2, c = Math.max(P, Math.min(l - o.width - P, c)), a = Math.max(P, Math.min(d - o.height - P, a)), t.style.left = `${Math.round(c)}px`, t.style.top = `${Math.round(a)}px`;
  const p = t.getBoundingClientRect(), u = c - p.left, f = a - p.top;
  return (Math.abs(u) > 0.5 || Math.abs(f) > 0.5) && (t.style.left = `${Math.round(c + u)}px`, t.style.top = `${Math.round(a + f)}px`), h;
}
function lt(n, t, e = "bottom", i = 8, s = null) {
  const r = () => {
    if (W(n, t, e, i), s) {
      const o = n.getBoundingClientRect();
      (o.bottom <= 0 || o.top >= window.innerHeight || o.right <= 0 || o.left >= window.innerWidth) && s();
    }
  };
  return window.addEventListener("scroll", r, !0), window.addEventListener("resize", r), () => {
    window.removeEventListener("scroll", r, !0), window.removeEventListener("resize", r);
  };
}
let it = 0, Ct = "";
function At() {
  if (it++ > 0)
    return;
  const n = window.innerWidth - document.documentElement.clientWidth;
  Ct = document.body.style.paddingInlineEnd, document.body.style.overflow = "hidden", n > 0 && (document.body.style.paddingInlineEnd = `${n}px`);
}
function zt() {
  it !== 0 && (--it > 0 || (document.body.style.overflow = "", document.body.style.paddingInlineEnd = Ct));
}
function Lt(n) {
  const t = [];
  let e = n;
  for (; e && e.parentElement && e !== document.body; ) {
    for (const i of e.parentElement.children)
      i === e || i.inert || i.tagName === "SCRIPT" || i.tagName === "STYLE" || (i.inert = !0, t.push(i));
    e = e.parentElement;
  }
  return () => {
    for (const i of t)
      i.inert = !1;
  };
}
function St(n) {
  if (n.parentNode === document.body)
    return () => {
    };
  const t = n.parentNode;
  if (!t)
    return () => {
    };
  const e = document.createComment("jelly-portal");
  return t.insertBefore(e, n), document.body.appendChild(n), () => {
    e.parentNode && e.parentNode.insertBefore(n, e), e.remove();
  };
}
function at(n, t = "center") {
  n.style.transformOrigin = t, !(F() || !n.animate) && n.animate(
    [
      { opacity: 0, transform: "scale(0.92, 0.96)" },
      { opacity: 1, transform: "scale(1.014, 0.997)", offset: 0.55 },
      { transform: "scale(0.998, 1.002)", offset: 0.8 },
      { transform: "scale(1)" }
    ],
    { duration: 420, easing: "cubic-bezier(.16,.82,.28,1)" }
  );
}
function ht(n, t) {
  if (F() || !n.animate) {
    t();
    return;
  }
  const e = n.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.92)" }
    ],
    { duration: 150, easing: "ease-in" }
  );
  e.onfinish = t, e.oncancel = t;
}
function Ot(n) {
  const t = k(n), e = t ? "-35%" : "35%", i = t ? "1.5%" : "-1.5%";
  n.style.transformOrigin = t ? "left center" : "right center", !(F() || !n.animate) && n.animate(
    [
      { opacity: 0, transform: `translateX(${e}) scale(0.9)` },
      { opacity: 1, transform: `translateX(${i}) scale(1.015)`, offset: 0.62 },
      { transform: "translateX(0) scale(1)" }
    ],
    { duration: 480, easing: "cubic-bezier(.16,.82,.28,1)" }
  );
}
function Wt(n, t) {
  const e = k(n), i = e ? "-30%" : "30%";
  if (n.style.transformOrigin = e ? "left center" : "right center", F() || !n.animate) {
    t();
    return;
  }
  const s = n.animate(
    [
      { opacity: 1, transform: "translateX(0) scale(1)" },
      { opacity: 0, transform: `translateX(${i}) scale(0.92)` }
    ],
    { duration: 320, easing: "cubic-bezier(.4,0,.5,1)" }
  );
  s.onfinish = t, s.oncancel = t;
}
const Nt = "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', sans-serif", Kt = "system-ui, -apple-system, 'Segoe UI', sans-serif", Yt = "ui-monospace, 'SF Mono', Menlo, monospace", $ = "oklch(1 0 0)", Y = "oklch(0.2609 0.0238 267.11)", Mt = "oklch(0.5771 0.2152 27.33)", Et = "oklch(0.5779 0.1495 51.54)", Z = "oklch(0.5601 0.1577 249.8)", Tt = "oklch(0.5489 0.1374 151.7)", mt = "oklch(0.7112 0.1559 250.96)", Ft = {
  background: {
    default: $,
    // page background
    surface: $,
    // raised surface (cards, sheets)
    muted: "oklch(0.9906 0.0017 247.84)",
    // #FBFCFD  input / field rest fill
    neutral: "oklch(0.8884 0 0)",
    // #DADADA  neutral fill (platinum)
    neutralEmphasis: "oklch(0.4676 0 0)",
    // #5A5A5A  strong neutral fill (graphite)
    white: $,
    // explicit white fill
    rose: Mt,
    amber: Et,
    azure: Z,
    mint: Tt,
    accent: Z
  },
  foreground: {
    default: Y,
    // primary text
    muted: "oklch(0.503 0.0269 266.68)",
    // #5D6474  secondary text
    onEmphasis: $,
    // label on a saturated / graphite fill
    onNeutral: Y,
    // label on a neutral fill
    onWhite: Y,
    // label on the white fill
    onAccent: $
    // label on the accent fill
  },
  border: {
    default: "oklch(0.9439 0.004 286.32)",
    // #ECECEF  hairline
    focus: Z
    // focus ring
  },
  shadow: "20, 26, 38"
  // rgb triple, consumed inside rgba()
}, Zt = {
  background: {
    default: "oklch(0.2198 0.006 236.84)",
    // #181B1D
    surface: "oklch(0.2514 0.0163 264.22)",
    // #1E222A
    muted: "oklch(0.288 0.018 262.21)",
    // #262B34
    neutral: "oklch(0.3674 0.0201 266.01)",
    // #3A3F4A  neutral fill + hairline
    neutralEmphasis: "oklch(0.4707 0.0189 266.12)",
    // #565B66
    white: "oklch(0.94 0.0071 268.55)",
    // #E9EBF0
    rose: Mt,
    amber: Et,
    azure: Z,
    mint: Tt,
    accent: mt
  },
  foreground: {
    default: "oklch(0.9645 0.0054 274.97)",
    // #F2F3F7
    muted: "oklch(0.7595 0.0259 265.54)",
    // #A9B1C2
    onEmphasis: $,
    onNeutral: "oklch(0.9645 0.0054 274.97)",
    // #F2F3F7  light label on a dark neutral fill
    onWhite: Y,
    // dark label on the near-white fill
    onAccent: "oklch(0.2514 0.0163 264.22)"
    // #1E222A  card surface, not pure black
  },
  border: {
    default: "oklch(0.3674 0.0201 266.01)",
    // #3A3F4A  shares the neutral step
    focus: mt
  },
  shadow: "0, 0, 0"
}, Jt = (n) => n.replace(/[A-Z]/g, (t) => "-" + t.toLowerCase());
function It(n) {
  const t = {};
  for (const e of ["background", "foreground", "border"])
    for (const [i, s] of Object.entries(n[e]))
      t[`${e}-${Jt(i)}`] = s;
  return t.shadow = n.shadow, t;
}
const ct = It(Ft), st = It(Zt), b = ct, H = {
  color: Ft.border.focus,
  width: 4.5,
  gap: 0,
  alpha: 0.5
}, rt = {
  white: { fill: "background-white", on: "foreground-on-white" },
  rose: { fill: "background-rose", on: "foreground-on-emphasis" },
  amber: { fill: "background-amber", on: "foreground-on-emphasis" },
  azure: { fill: "background-azure", on: "foreground-on-emphasis" },
  mint: { fill: "background-mint", on: "foreground-on-emphasis" },
  platinum: { fill: "background-neutral", on: "foreground-on-neutral" },
  graphite: { fill: "background-neutral-emphasis", on: "foreground-on-emphasis" }
}, Ki = `
  :host {
    --jelly-fill:  var(--jelly-color-background-accent,    ${b["background-accent"]});
    --jelly-label: var(--jelly-color-foreground-on-accent, ${b["foreground-on-accent"]});
  }
${Object.entries(rt).map(
  ([n, { fill: t, on: e }]) => `  :host([variant="${n}"]) { --jelly-fill: var(--jelly-color-${t}, ${b[t]}); --jelly-label: var(--jelly-color-${e}, ${b[e]}); }`
).join(`
`)}
`;
function R({ color: n, on: t = null, ring: e = null } = {}) {
  const i = (s) => {
    const r = rt[s];
    return [
      n ? `${n}: var(--jelly-color-${r.fill}, ${b[r.fill]});` : "",
      e ? `${e}: var(--jelly-color-${r.fill}, ${b[r.fill]});` : "",
      t ? `${t}: var(--jelly-color-${r.on}, ${b[r.on]});` : ""
    ].filter(Boolean).join(" ");
  };
  return Object.keys(rt).map((s) => `  :host([variant="${s}"]) { ${i(s)} }`).join(`
`);
}
function tt(n) {
  return Object.entries(n).map(([t, e]) => `  --jelly-color-${t}: ${e};`).join(`
`);
}
function Gt() {
  return `
@layer jelly {
  :root {
    color-scheme: light dark;
    --jelly-font-display: ${Nt};
    --jelly-font-text:    ${Kt};
    --jelly-font-mono:    ${Yt};
    --jelly-ring-width:     ${H.width}px;
    --jelly-ring-gap:       ${H.gap}px;
    --jelly-ring-color:     color-mix(in srgb, var(--jelly-ring, var(--jelly-color-border-focus)) ${H.alpha * 100}%, transparent);
    --jelly-shadow-raised:  0 16px 42px -20px rgba(var(--jelly-color-shadow), 0.34);
    --jelly-shadow-overlay: 0 14px 34px -16px rgba(var(--jelly-color-shadow), 0.42), 0 4px 12px -8px rgba(var(--jelly-color-shadow), 0.28);
${tt(ct)}
  }

  :root[data-jelly-mode="light"] {
    color-scheme: light;
  }

  :root[data-jelly-mode="dark"] {
    color-scheme: dark;
${tt(st)}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-jelly-mode="light"]) {
      color-scheme: dark;
${tt(st)}
    }
  }
}
`;
}
function z() {
  if (typeof document > "u" || document.querySelector("style[data-jelly-tokens]"))
    return;
  const n = document.createElement("style");
  n.setAttribute("data-jelly-tokens", ""), n.textContent = Gt(), document.head.appendChild(n);
}
function Yi(n = "auto") {
  z(), n === "light" || n === "dark" ? document.documentElement.setAttribute("data-jelly-mode", n) : document.documentElement.removeAttribute("data-jelly-mode"), G();
}
function Zi() {
  const n = document.documentElement.getAttribute("data-jelly-mode");
  return n === "light" || n === "dark" ? n : "auto";
}
function Ji() {
  const n = document.documentElement.getAttribute("data-jelly-mode");
  return n === "dark" ? !0 : n === "light" ? !1 : typeof matchMedia == "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}
function G() {
  window.dispatchEvent(new CustomEvent("jelly-theme-change"));
}
function Gi(n) {
  return window.addEventListener("jelly-theme-change", n), () => window.removeEventListener("jelly-theme-change", n);
}
typeof matchMedia == "function" && matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => G());
z();
const Ut = ":host{display:inline-block;position:relative;box-sizing:border-box;vertical-align:middle;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}:host([hidden]){display:none}.jelly-canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:0}.jelly-content{position:relative;z-index:1;width:100%;height:100%}";
class L extends HTMLElement {
  constructor() {
    super(), this.body = null, this.built = !1, this.dpr = 1, this.cssW = 0, this.cssH = 0, this.config = void 0, this.resizeObserver = null, this.attributeObserver = null, this.focusVisible = !1, this.frameDt = 0, this.colorEasing = !1, this.eased = {}, this.pressPointerId = null, this.keyboardActive = !1, this.onThemeChange = () => {
      this.built && (this.applyShape(), this.onShape()), this.requestFrame();
    }, this.onMotionChange = () => this.requestFrame(), this.onWindowResize = () => this.applyShape(), this.attachShadow({ mode: "open", delegatesFocus: !0 });
  }
  static {
    this.PAD = 48;
  }
  /* ---- Subclass hooks ---------------------------------------------- */
  // Extra CSS (string) for the shadow root
  styles() {
    return "";
  }
  // Interactive markup that sits above the canvas
  content() {
    return "<slot></slot>";
  }
  // Given the measured host size, return the jelly shape to build
  shape(t, e) {
    return { width: t, height: e, radius: Math.min(t, e) / 2 };
  }
  // Resolve the current fill color (the canvas reads the computed token)
  fill() {
    return getComputedStyle(this).getPropertyValue("--jelly-fill").trim() || b["background-accent"];
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
  }
  // Called whenever the shape (re)builds
  onShape() {
  }
  // One animation step. Return true to keep animating.
  frame(t) {
    return this.defaultFrame(t);
  }
  /* ---- Lifecycle --------------------------------------------------- */
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), this.built || this.build(), this.observeResize(), this.attributeObserver || (this.attributeObserver = new MutationObserver(() => this.requestFrame()), this.attributeObserver.observe(this, { attributes: !0 })), window.addEventListener("jelly-theme-change", this.onThemeChange), window.addEventListener("jelly-motion-change", this.onMotionChange), window.addEventListener("resize", this.onWindowResize, { passive: !0 }), this.requestFrame();
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    yt.drop(this), window.removeEventListener("jelly-theme-change", this.onThemeChange), window.removeEventListener("jelly-motion-change", this.onMotionChange), window.removeEventListener("resize", this.onWindowResize), this.resizeObserver && (this.resizeObserver.disconnect(), this.resizeObserver = null), this.attributeObserver && (this.attributeObserver.disconnect(), this.attributeObserver = null);
  }
  // True when the user prefers reduced motion (checked live, not cached)
  get reducedMotion() {
    return F();
  }
  // Render the shadow DOM once and let the subclass wire itself up
  build() {
    this.shadowRoot.innerHTML = `<style>${Ut}${this.styles()}</style><canvas class="jelly-canvas" part="jelly" aria-hidden="true"></canvas><div class="jelly-content">${this.content()}</div>`, this.canvas = this.shadowRoot.querySelector(".jelly-canvas"), this.ctx = this.canvas.getContext("2d"), this.built = !0, this.onBuilt();
  }
  // Rebuild the shape whenever the host's layout size changes
  observeResize() {
    this.resizeObserver || (this.resizeObserver = new ResizeObserver(() => this.applyShape()), this.resizeObserver.observe(this), this.applyShape());
  }
  /*
   * The region the jelly shape occupies, in host-local pixels. Defaults to
   * the whole host; a component can mark an inner element with
   * `data-jelly-box` to render the jelly over just that sub-region
   * (e.g. a checkbox next to its label).
   */
  jellyBox() {
    const t = this.getBoundingClientRect(), e = this.offsetWidth > 0 ? t.width / this.offsetWidth : 1, i = this.offsetHeight > 0 ? t.height / this.offsetHeight : 1, s = e > 1e-3 ? 1 / e : 1, r = i > 1e-3 ? 1 / i : 1, o = this.shadowRoot.querySelector("[data-jelly-box]"), l = o ? o.getBoundingClientRect() : t;
    return {
      width: l.width * s,
      height: l.height * r,
      offsetX: (l.left + l.width / 2 - t.left) * s,
      offsetY: (l.top + l.height / 2 - t.top) * r,
      // Screen coords stay in screen space for pointer → local mapping
      screenX: l.left + l.width / 2,
      screenY: l.top + l.height / 2
    };
  }
  // Size the canvas for the current shape and (re)build the physics body
  applyShape() {
    if (!this.built)
      return;
    const t = this.jellyBox();
    if (t.width < 1 || t.height < 1)
      return;
    const e = this.shape(t.width, t.height), i = this.constructor.PAD, s = e.width + i * 2, r = e.height + i * 2, o = Math.min(window.devicePixelRatio || 1, 3), l = Math.round(s * o), d = Math.round(r * o);
    if (this.canvas.style.left = `${t.offsetX}px`, this.canvas.style.top = `${t.offsetY}px`, !(this.body && this.canvas.width === l && this.canvas.height === d)) {
      this.dpr = o, this.cssW = s, this.cssH = r, this.canvas.style.width = `${s}px`, this.canvas.style.height = `${r}px`, this.canvas.width = l, this.canvas.height = d, this.ctx.setTransform(o, 0, 0, o, 0, 0), this.body ? this.body.resize(e.width, e.height, e.radius) : this.body = new D({
        width: e.width,
        height: e.height,
        radius: e.radius,
        config: this.config
      }), this.onShape();
      try {
        this.frame(0);
      } catch (h) {
        console.error("Jelly UI paint error", h);
      }
      this.requestFrame();
    }
  }
  /*
   * Rebuild the membrane in place after a shape attribute change (e.g. a
   * radius swap) that doesn't resize the box - applyShape would early-return
   * since the canvas pixel size is unchanged, so reshape the body directly.
   */
  reshapeMembrane() {
    if (!this.built || !this.body)
      return;
    const t = this.jellyBox();
    if (t.width < 1 || t.height < 1)
      return;
    const e = this.shape(t.width, t.height);
    this.body.resize(e.width, e.height, e.radius), this.requestFrame();
  }
  /* ---- Rendering --------------------------------------------------- */
  // Wipe the canvas for the next paint
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.cssW, this.cssH);
  }
  /*
   * Paint one body centered in the canvas (with optional pixel offset).
   * Flat solid fill - no gradients or shading.
   */
  paintBody(t, e = {}) {
    const {
      fill: i = this.fill(),
      cx: s = 0,
      cy: r = 0,
      alpha: o = 1,
      ctx: l = this.ctx,
      cssW: d = this.cssW,
      cssH: h = this.cssH,
      ring: a = null,
      scaleX: c = 1,
      scaleY: p = 1,
      border: u = null,
      // Optional per-point post-projection deform (x, y, z) → (x, y, z).
      // Used for effects the physics shouldn't carry, e.g. tapering a
      // slider thumb's tail.
      warp: f = null,
      // Crossfade the fill toward its target instead of snapping (so variant /
      // state changes ease). Components that paint more than one body per frame
      // pass a distinct easeKey per body so their colours don't share a track.
      ease: C = !0,
      easeKey: v = "body"
    } = e, x = C ? this.easeColor(v, i, this.frameDt || 0) : i, y = d / 2 + s, w = h / 2 + r, S = f ? (I) => f(t.projectPoint(I)) : (I) => t.projectPoint(I);
    if (l.save(), l.globalAlpha = o, l.translate(y, w), l.rotate(t.state.rotateZ), (c !== 1 || p !== 1) && l.scale(c, p), a) {
      const I = t.getSurfacePoints(a.gap + a.width / 2).map(S);
      Q(l, I), l.lineWidth = a.width, l.strokeStyle = a.color, l.lineJoin = "round", l.stroke();
    }
    const M = t.getSurfacePoints().map(S);
    Q(l, M), l.fillStyle = x, l.fill(), u && (Q(l, M), l.lineWidth = u.width, l.strokeStyle = u.color, l.lineJoin = "round", l.stroke()), l.restore();
  }
  // The standard frame: advance physics, repaint, sleep when at rest
  defaultFrame(t) {
    const e = this.body;
    return e ? (e.update(t), this.clearCanvas(), this.paintBody(e, { ring: this.focusRing(), border: this.surfaceBorder() }), !e.isResting()) : !1;
  }
  // Border descriptor painted on the jelly surface, else null
  surfaceBorder() {
    return null;
  }
  /* ---- Focus ring -------------------------------------------------- */
  // Ring descriptor when keyboard-focused, else null. Override as needed.
  // Width and gap resolve from --jelly-ring-width / --jelly-ring-gap so the
  // ring geometry is themeable, not only its color.
  focusRing() {
    if (!this.focusVisible)
      return null;
    const t = getComputedStyle(this), e = parseFloat(t.getPropertyValue("--jelly-ring-width")) || H.width, i = parseFloat(t.getPropertyValue("--jelly-ring-gap"));
    return { color: this.ringColor(), width: e, gap: Number.isFinite(i) ? i : H.gap };
  }
  // The focus ring color, softly blended toward transparent - it tracks the
  // component's own --jelly-ring (usually its fill hue) so the ring reads as
  // part of the control rather than a generic blue outline.
  ringColor() {
    const [t, e, i, s] = this.rgbaTuple(
      `var(--jelly-ring, var(--jelly-color-border-focus, ${b["border-focus"]}))`
    );
    return this.colorString([t, e, i, s * H.alpha], { forceAlpha: !0 });
  }
  /*
   * Ease a fill color toward its target so a variant / state change crossfades
   * rather than snapping. Keyed so a component painting several bodies a frame
   * eases each on its own track. Frame-rate independent; settles in ~0.3s and
   * jumps straight to the target under reduced motion or on the first paint.
   * Raises `colorEasing` (read by the engine) so the frame keeps running.
   */
  easeColor(t, e, i) {
    const s = this.rgbaTuple(e), r = this.eased[t];
    if (!r || this.reducedMotion)
      return this.eased[t] = s, this.colorString(s);
    if (Math.abs(s[0] - r[0]) <= 0.4 && Math.abs(s[1] - r[1]) <= 0.4 && Math.abs(s[2] - r[2]) <= 0.4 && Math.abs(s[3] - r[3]) <= 2e-3)
      return this.eased[t] = s, this.colorString(s);
    if (this.colorEasing = !0, i > 0) {
      const l = 1 - Math.exp(-i * 10);
      for (let d = 0; d < 4; d++)
        r[d] += (s[d] - r[d]) * l;
    }
    return this.colorString(r);
  }
  // Resolve a color expression to an [r, g, b, a] tuple. RGB channels use
  // 0–255; alpha uses 0–1. Keeping alpha here prevents short hex colors such
  // as #fff0 from becoming opaque as they pass through canvas animation.
  rgbaTuple(t) {
    const e = this.resolveColor(String(t)), i = e.match(/[\d.]+/g);
    if (!i)
      return [0, 0, 0, 1];
    const s = i.slice(0, 3).map(Number), r = Math.max(0, Math.min(1, Number(i[3] ?? 1))), o = e.startsWith("color(") ? s.map((l) => Math.round(l * 255)) : s;
    return [o[0], o[1], o[2], r];
  }
  // Backward-compatible RGB-only view for calculations that do not need alpha
  rgbTriple(t) {
    return this.rgbaTuple(t).slice(0, 3);
  }
  // Serialize a tuple to a canvas-safe legacy color. Keep opaque colors as
  // rgb() for compactness; rgba() is required whenever transparency matters.
  colorString([t, e, i, s = 1], { forceAlpha: r = !1 } = {}) {
    const o = Math.round(t), l = Math.round(e), d = Math.round(i), h = Math.max(0, Math.min(1, s));
    return !r && h >= 0.9995 ? `rgb(${o}, ${l}, ${d})` : `rgba(${o}, ${l}, ${d}, ${Number(h.toFixed(4))})`;
  }
  // Blend two live CSS color expressions. Shared by controls that animate
  // between semantic off/on colors, including their alpha channels.
  mixColor(t, e, i) {
    const s = this.rgbaTuple(t), r = this.rgbaTuple(e), o = Math.max(0, Math.min(1, i)), l = s.map((d, h) => d + (r[h] - d) * o);
    return this.colorString(l);
  }
  // Resolve a CSS color expression (var(), color-mix(), …) to a concrete sRGB
  // color. The token values are oklch(), and getComputedStyle preserves oklch()
  // in modern browsers - so we wrap the expression in color-mix(in srgb, …) to
  // force the computed value into sRGB (color(srgb …) / rgb()). rgbaTuple reads
  // the channels numerically and would misread a raw oklch triple as RGB.
  resolveColor(t) {
    return this.probe || (this.probe = document.createElement("span"), this.probe.setAttribute("aria-hidden", "true"), this.probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none", this.shadowRoot.appendChild(this.probe)), this.probe.style.color = `color-mix(in srgb, ${t} 100%, transparent)`, getComputedStyle(this.probe).color;
  }
  // Track keyboard-focus (:focus-visible) on an inner control for the ring
  trackFocus(t) {
    t.addEventListener("focus", () => {
      this.focusVisible = t.matches(":focus-visible") || this.matches(":focus-visible"), this.requestFrame();
    }), t.addEventListener("blur", () => {
      this.focusVisible = !1, this.requestFrame();
    });
  }
  // Route host.focus() into an inner shadow control
  useHostFocusTarget(t) {
    t && (this.hostFocusTarget = t, this.syncHostFocusTarget(), this.hostFocusHandler || (this.hostFocusHandler = (e) => {
      e.target !== this || !this.hostFocusTarget || this.shadowRoot?.activeElement || this.hostFocusTarget.focus({ preventScroll: !0 });
    }, this.addEventListener("focus", this.hostFocusHandler)));
  }
  // Keep the inner focus target's tab order in sync with disabled state
  syncHostFocusTarget() {
    this.hostFocusTarget && (this.hostFocusTarget.tabIndex = this.hasAttribute("disabled") ? -1 : 0, this.removeAttribute("tabindex"));
  }
  /* ---- Interaction helpers ----------------------------------------- */
  // Ask the shared engine for animation frames until the body rests
  requestFrame() {
    yt.wake(this);
  }
  // Convert client coords into the body's local (shape-centered) frame
  toLocal(t, e, i = this.body) {
    const s = this.jellyBox(), r = this.getBoundingClientRect(), o = this.offsetWidth > 0 ? r.width / this.offsetWidth : 1, l = this.offsetHeight > 0 ? r.height / this.offsetHeight : 1, d = (t - s.screenX) / (o > 1e-3 ? o : 1), h = (e - s.screenY) / (l > 1e-3 ? l : 1), a = -(i ? i.state.rotateZ : 0), c = Math.cos(a), p = Math.sin(a);
    return { x: d * c - h * p, y: d * p + h * c };
  }
  // Press the jelly at a screen coordinate
  pressAt(t, e, i = 1.12) {
    if (this.reducedMotion || !this.body)
      return;
    const s = this.toLocal(t, e);
    this.body.pressAtLocal(s.x, s.y, i), this.requestFrame();
  }
  // Drag the held press to a new screen coordinate
  moveAt(t, e) {
    if (this.reducedMotion || !this.body)
      return;
    const i = this.toLocal(t, e);
    this.body.moveToLocal(i.x, i.y), this.requestFrame();
  }
  // Release the held press and let the body settle
  releaseBody() {
    this.body && (this.body.release(), this.requestFrame());
  }
  // Sustained center squish (keyboard press-and-hold)
  centerPulse(t = 1) {
    this.reducedMotion || !this.body || (this.body.centerPulse(t), this.requestFrame());
  }
  // One-shot center squish that settles on its own (focus, toggle, grab)
  centerPop(t = 1) {
    this.reducedMotion || !this.body || (this.body.centerPop(t), this.requestFrame());
  }
  /*
   * Wire the standard press feel onto an inner control: pointer presses
   * dent the jelly under the finger and follow it, Enter / Space squish
   * from the center and everything releases cleanly - including pointer
   * capture loss and blur mid-press. Handles one pointer at a time; extra
   * touches are ignored rather than fighting over the membrane.
   */
  wirePress(t, { keyboard: e = !0, disabled: i = () => this.hasAttribute("disabled") } = {}) {
    this.pressPointerId = null, t.addEventListener("pointerdown", (r) => {
      if (!(i() || this.pressPointerId !== null)) {
        this.pressPointerId = r.pointerId;
        try {
          t.setPointerCapture(r.pointerId);
        } catch {
        }
        this.pressAt(r.clientX, r.clientY), T();
      }
    }), t.addEventListener("pointermove", (r) => {
      r.pointerId === this.pressPointerId && this.moveAt(r.clientX, r.clientY);
    });
    const s = (r) => {
      r.pointerId === this.pressPointerId && (this.pressPointerId = null, this.releaseBody());
    };
    t.addEventListener("pointerup", s), t.addEventListener("pointercancel", s), t.addEventListener("lostpointercapture", s), e && (t.addEventListener("keydown", (r) => {
      r.key !== "Enter" && r.key !== " " || this.keyboardActive || r.repeat || i() || (this.keyboardActive = !0, this.centerPulse(1.12), T());
    }), t.addEventListener("keyup", (r) => {
      r.key !== "Enter" && r.key !== " " || (this.keyboardActive = !1, this.releaseBody());
    }), t.addEventListener("blur", () => {
      this.keyboardActive = !1, this.pressPointerId = null, this.releaseBody();
    }));
  }
}
if (typeof document < "u" && typeof MutationObserver == "function") {
  const n = new MutationObserver(() => G());
  n.observe(document.documentElement, { attributes: !0, attributeFilter: ["dir"] }), document.body && n.observe(document.body, { attributes: !0, attributeFilter: ["dir"] });
}
const _t = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 8.5a.75.75 0 0 0-.75.75v5a.75.75 0 0 0 1.5 0v-5a.75.75 0 0 0-.75-.75ZM12 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
`, Qt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm3.22 6.97-4.47 4.47-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5c.3.3.77.3 1.06 0l5-5a.75.75 0 1 0-1.06-1.06Z"/></svg>
`, te = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.14 3.7a3.25 3.25 0 0 1 5.72 0l6.74 12.5a3.25 3.25 0 0 1-2.86 4.8H5.25a3.25 3.25 0 0 1-2.86-4.8L9.14 3.7ZM12 15a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0-7.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 12 7.5Z"/></svg>
`, ee = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 12.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 7a.75.75 0 0 0-.75.75v4.6a.75.75 0 0 0 1.5-.1v-4.5l-.01-.1a.75.75 0 0 0-.75-.65Z"/></svg>
`, ie = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4.39705 4.55379L4.46967 4.46967C4.73594 4.2034 5.1526 4.1792 5.44621 4.39705L5.53033 4.46967L12 10.939L18.4697 4.46967C18.7626 4.17678 19.2374 4.17678 19.5303 4.46967C19.8232 4.76256 19.8232 5.23744 19.5303 5.53033L13.061 12L19.5303 18.4697C19.7966 18.7359 19.8208 19.1526 19.6029 19.4462L19.5303 19.5303C19.2641 19.7966 18.8474 19.8208 18.5538 19.6029L18.4697 19.5303L12 13.061L5.53033 19.5303C5.23744 19.8232 4.76256 19.8232 4.46967 19.5303C4.17678 19.2374 4.17678 18.7626 4.46967 18.4697L10.939 12L4.46967 5.53033C4.2034 5.26406 4.1792 4.8474 4.39705 4.55379Z"/></svg>
`, se = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16.1017 17.1624C14.717 18.3101 12.9391 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11C19 12.9391 18.3101 14.717 17.1624 16.1018L21.7803 20.7197C22.0732 21.0126 22.0732 21.4874 21.7803 21.7803C21.4874 22.0732 21.0125 22.0732 20.7196 21.7803L16.1017 17.1624ZM17.5 11C17.5 7.41015 14.5899 4.5 11 4.5C7.41015 4.5 4.5 7.41015 4.5 11C4.5 14.5899 7.41015 17.5 11 17.5C14.5899 17.5 17.5 14.5899 17.5 11Z"/></svg>
`, re = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.25 7C9.66421 7 10 7.33579 10 7.75C10 8.12656 9.72249 8.4383 9.36083 8.49187L9.25 8.5H7C5.067 8.5 3.5 10.067 3.5 12C3.5 13.864 4.95707 15.3876 6.79435 15.4941L7 15.5H9.25C9.66421 15.5 10 15.8358 10 16.25C10 16.6266 9.72249 16.9383 9.36083 16.9919L9.25 17H7C4.23858 17 2 14.7614 2 12C2 9.32226 4.10496 7.13615 6.75045 7.00612L7 7H9.25ZM17 7C19.7614 7 22 9.23858 22 12C22 14.6777 19.895 16.8638 17.2495 16.9939L17 17H14.75C14.3358 17 14 16.6642 14 16.25C14 15.8734 14.2775 15.5617 14.6392 15.5081L14.75 15.5H17C18.933 15.5 20.5 13.933 20.5 12C20.5 10.136 19.0429 8.6124 17.2057 8.50594L17 8.5H14.75C14.3358 8.5 14 8.16421 14 7.75C14 7.37344 14.2775 7.0617 14.6392 7.00813L14.75 7H17ZM7 11.25H17C17.4142 11.25 17.75 11.5858 17.75 12C17.75 12.3797 17.4678 12.6935 17.1018 12.7432L17 12.75H7C6.58579 12.75 6.25 12.4142 6.25 12C6.25 11.6203 6.53215 11.3065 6.89823 11.2568L7 11.25Z"/></svg>
`, oe = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.0122 2.25C12.7462 2.25846 13.4773 2.34326 14.1937 2.50304C14.5064 2.57279 14.7403 2.83351 14.7758 3.15196L14.946 4.67881C15.0231 5.37986 15.615 5.91084 16.3206 5.91158C16.5103 5.91188 16.6979 5.87238 16.8732 5.79483L18.2738 5.17956C18.5651 5.05159 18.9055 5.12136 19.1229 5.35362C20.1351 6.43464 20.8889 7.73115 21.3277 9.14558C21.4223 9.45058 21.3134 9.78203 21.0564 9.9715L19.8149 10.8866C19.4607 11.1468 19.2516 11.56 19.2516 11.9995C19.2516 12.4389 19.4607 12.8521 19.8157 13.1129L21.0582 14.0283C21.3153 14.2177 21.4243 14.5492 21.3297 14.8543C20.8911 16.2685 20.1377 17.5649 19.1261 18.6461C18.9089 18.8783 18.5688 18.9483 18.2775 18.8206L16.8712 18.2045C16.4688 18.0284 16.0068 18.0542 15.6265 18.274C15.2463 18.4937 14.9933 18.8812 14.945 19.3177L14.7759 20.8444C14.741 21.1592 14.5122 21.4182 14.204 21.4915C12.7556 21.8361 11.2465 21.8361 9.79803 21.4915C9.48991 21.4182 9.26105 21.1592 9.22618 20.8444L9.05736 19.32C9.00777 18.8843 8.75434 18.498 8.37442 18.279C7.99451 18.06 7.5332 18.0343 7.1322 18.2094L5.72557 18.8256C5.43422 18.9533 5.09403 18.8833 4.87678 18.6509C3.86462 17.5685 3.11119 16.2705 2.6732 14.8548C2.57886 14.5499 2.68786 14.2186 2.94485 14.0293L4.18818 13.1133C4.54232 12.8531 4.75147 12.4399 4.75147 12.0005C4.75147 11.561 4.54232 11.1478 4.18771 10.8873L2.94516 9.97285C2.6878 9.78345 2.5787 9.45178 2.67337 9.14658C3.11212 7.73215 3.86594 6.43564 4.87813 5.35462C5.09559 5.12236 5.43594 5.05259 5.72724 5.18056L7.12762 5.79572C7.53056 5.97256 7.9938 5.94585 8.37577 5.72269C8.75609 5.50209 9.00929 5.11422 9.05817 4.67764L9.22824 3.15196C9.26376 2.83335 9.49786 2.57254 9.8108 2.50294C10.5281 2.34342 11.26 2.25865 12.0122 2.25ZM12.0124 3.7499C11.5583 3.75524 11.1056 3.79443 10.6578 3.86702L10.5489 4.84418C10.4471 5.75368 9.92003 6.56102 9.13042 7.01903C8.33597 7.48317 7.36736 7.53903 6.52458 7.16917L5.62629 6.77456C5.05436 7.46873 4.59914 8.25135 4.27852 9.09168L5.07632 9.67879C5.81513 10.2216 6.25147 11.0837 6.25147 12.0005C6.25147 12.9172 5.81513 13.7793 5.0771 14.3215L4.27805 14.9102C4.59839 15.752 5.05368 16.5361 5.626 17.2316L6.53113 16.8351C7.36923 16.4692 8.33124 16.5227 9.12353 16.9794C9.91581 17.4361 10.4443 18.2417 10.548 19.1526L10.657 20.1365C11.5466 20.2878 12.4555 20.2878 13.3451 20.1365L13.4541 19.1527C13.5549 18.2421 14.0828 17.4337 14.876 16.9753C15.6692 16.5168 16.6332 16.463 17.4728 16.8305L18.3772 17.2267C18.949 16.5323 19.4041 15.7495 19.7247 14.909L18.9267 14.3211C18.1879 13.7783 17.7516 12.9162 17.7516 11.9995C17.7516 11.0827 18.1879 10.2206 18.9258 9.67847L19.7227 9.09109C19.4021 8.25061 18.9468 7.46784 18.3748 6.77356L17.4783 7.16737C17.113 7.32901 16.7178 7.4122 16.3187 7.41158C14.849 7.41004 13.6155 6.30355 13.4551 4.84383L13.3462 3.8667C12.9007 3.7942 12.4526 3.75512 12.0124 3.7499ZM11.9997 8.24995C14.0708 8.24995 15.7497 9.92888 15.7497 12C15.7497 14.071 14.0708 15.75 11.9997 15.75C9.92863 15.75 8.2497 14.071 8.2497 12C8.2497 9.92888 9.92863 8.24995 11.9997 8.24995ZM11.9997 9.74995C10.7571 9.74995 9.7497 10.7573 9.7497 12C9.7497 13.2426 10.7571 14.25 11.9997 14.25C13.2423 14.25 14.2497 13.2426 14.2497 12C14.2497 10.7573 13.2423 9.74995 11.9997 9.74995Z"/></svg>
`, ne = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.7878 3.10215C11.283 2.09877 12.7138 2.09876 13.209 3.10215L15.567 7.87987L20.8395 8.64601C21.9468 8.80691 22.3889 10.1677 21.5877 10.9487L17.7724 14.6676L18.6731 19.9189C18.8622 21.0217 17.7047 21.8627 16.7143 21.342L11.9984 18.8627L7.28252 21.342C6.29213 21.8627 5.13459 21.0217 5.32374 19.9189L6.2244 14.6676L2.40916 10.9487C1.60791 10.1677 2.05005 8.80691 3.15735 8.64601L8.42988 7.87987L10.7878 3.10215Z"/></svg>
`, le = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.8199 5.57912L11.9992 6.40163L11.1759 5.57838C9.07688 3.47931 5.67361 3.47931 3.57455 5.57838C1.47548 7.67744 1.47548 11.0807 3.57455 13.1798L11.4699 21.0751C11.7628 21.368 12.2377 21.368 12.5306 21.0751L20.432 13.1783C22.5264 11.0723 22.53 7.67857 20.4306 5.57912C18.3277 3.47623 14.9228 3.47623 12.8199 5.57912Z"/></svg>
`, ae = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.0258 17.0014C17.2639 21.7851 11.1471 23.4241 6.3634 20.6622C5.06068 19.9101 3.964 18.8926 3.12872 17.6797C2.84945 17.2741 3.0301 16.7141 3.49369 16.5482C7.26112 15.1997 9.27892 13.6372 10.4498 11.4021C11.6825 9.04908 12.001 6.47162 11.1387 2.93862C11.0195 2.45008 11.4053 1.98492 11.9075 2.01186C13.4645 2.09539 14.9856 2.54263 16.3649 3.33903C21.1486 6.10088 22.7876 12.2177 20.0258 17.0014Z"/></svg>
`, he = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C12.4142 2 12.75 2.33579 12.75 2.75V4.25C12.75 4.66421 12.4142 5 12 5C11.5858 5 11.25 4.66421 11.25 4.25V2.75C11.25 2.33579 11.5858 2 12 2ZM17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12ZM21.25 12.75C21.6642 12.75 22 12.4142 22 12C22 11.5858 21.6642 11.25 21.25 11.25H19.75C19.3358 11.25 19 11.5858 19 12C19 12.4142 19.3358 12.75 19.75 12.75H21.25ZM12 19C12.4142 19 12.75 19.3358 12.75 19.75V21.25C12.75 21.6642 12.4142 22 12 22C11.5858 22 11.25 21.6642 11.25 21.25V19.75C11.25 19.3358 11.5858 19 12 19ZM4.25 12.75C4.66421 12.75 5 12.4142 5 12C5 11.5858 4.66421 11.25 4.25 11.25H2.75C2.33579 11.25 2 11.5858 2 12C2 12.4142 2.33579 12.75 2.75 12.75H4.25ZM4.21967 4.22004C4.51256 3.92715 4.98744 3.92715 5.28033 4.22004L6.78033 5.72004C7.07322 6.01294 7.07322 6.48781 6.78033 6.7807C6.48744 7.0736 6.01256 7.0736 5.71967 6.7807L4.21967 5.2807C3.92678 4.98781 3.92678 4.51294 4.21967 4.22004ZM5.28033 19.7807C4.98744 20.0736 4.51256 20.0736 4.21967 19.7807C3.92678 19.4878 3.92678 19.0129 4.21967 18.72L5.71967 17.22C6.01256 16.9271 6.48744 16.9271 6.78033 17.22C7.07322 17.5129 7.07322 17.9878 6.78033 18.2807L5.28033 19.7807ZM19.7803 4.22004C19.4874 3.92715 19.0126 3.92715 18.7197 4.22004L17.2197 5.72004C16.9268 6.01294 16.9268 6.48781 17.2197 6.7807C17.5126 7.0736 17.9874 7.0736 18.2803 6.7807L19.7803 5.2807C20.0732 4.98781 20.0732 4.51294 19.7803 4.22004ZM18.7197 19.7807C19.0126 20.0736 19.4874 20.0736 19.7803 19.7807C20.0732 19.4878 20.0732 19.0129 19.7803 18.72L18.2803 17.22C17.9874 16.9271 17.5126 16.9271 17.2197 17.22C16.9268 17.5129 16.9268 17.9878 17.2197 18.2807L18.7197 19.7807Z"/></svg>
`, ce = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.75 12.6 A5.25 5.25 0 0 1 17.25 12.6 Z"/><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="4.4"/><line x1="4.6" y1="4.6" x2="6.6" y2="6.6"/><line x1="19.4" y1="4.6" x2="17.4" y2="6.6"/><line x1="1.9" y1="13.7" x2="22.1" y2="13.7"/><line x1="6.1" y1="16.9" x2="18.2" y2="16.9"/><line x1="10" y1="20" x2="14.1" y2="20"/></g></svg>
`, de = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.3368 4.9174C17.5191 3.69448 19.4803 3.69717 20.6593 4.92332L27.8322 12.3831C29.155 13.4822 30 15.1428 30 17C30 20.2785 27.3704 22.9429 24.1053 22.9991V23.0004C24.1053 25.2096 22.3144 27.0004 20.1053 27.0004H18C18 27.0004 18 27.0004 18 27.0004V24.5004C18 22.0151 15.9853 20.0004 13.5 20.0004H12C11.4477 20.0004 11 20.4481 11 21.0004C11 21.5527 11.4477 22.0004 12 22.0004H13.5C14.8807 22.0004 16 23.1197 16 24.5004V27.0004C16 27.0004 16 27.0004 16 27.0004L11 27.0004C8.23858 27.0004 6 24.7618 6 22.0004V19.9004C3.71776 19.4371 2 17.4193 2 15.0004C2 12.2389 4.23858 10.0004 7 10.0004C8.63694 10.0004 10.0891 10.7874 11.0003 12.0004H17.5995C17.7351 11.7351 17.8914 11.4823 18.0664 11.2443L16.1624 8.89416C15.2071 7.71502 15.2819 6.00841 16.3368 4.9174Z" fill="currentColor"/>
</svg>
`, ue = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23.5758 24.99L28.2927 29.7068C28.6832 30.0973 29.3164 30.0973 29.7069 29.7068C30.0975 29.3163 30.0974 28.6831 29.7069 28.2926L3.70661 2.29288C3.31608 1.90237 2.68292 1.90237 2.2924 2.2929C1.90188 2.68343 1.90188 3.3166 2.29241 3.70712L9.00318 10.4177C8.39 10.1492 7.71241 10.0001 6.99982 10.0001C4.23839 10.0001 1.99982 12.2386 1.99982 15.0001C1.99982 17.419 3.71758 19.4368 5.99982 19.9001V22.0001C5.99982 24.7615 8.2384 27.0001 10.9998 27.0001H15.9998V24.4997C15.9998 23.119 14.8805 21.9997 13.4998 21.9997H11.9998C11.4475 21.9997 10.9998 21.552 10.9998 20.9997C10.9998 20.4474 11.4475 19.9997 11.9998 19.9997H13.4998C15.9851 19.9997 17.9998 22.0144 17.9998 24.4997V26.9997L20.1051 27.0001C21.5898 27.0001 22.8856 26.1912 23.5758 24.99ZM29.9998 16.9997C29.9998 19.5582 28.3984 21.7427 26.1433 22.6055L15.5377 12.0001H17.5993C17.7349 11.7348 17.8913 11.482 18.0663 11.244L16.1622 8.89386C15.2069 7.71472 15.2818 6.00811 16.3366 4.91709C17.5189 3.69417 19.4801 3.69686 20.6591 4.92302L27.8321 12.3828C29.1549 13.4819 29.9998 15.1425 29.9998 16.9997Z" fill="currentColor"/>
</svg>
`, pe = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M11.0003 12.0004H11.8436C11.8956 11.9991 11.9477 11.9984 12 11.9984V12.0004H17.5995C17.7351 11.7351 17.8914 11.4823 18.0664 11.2443L16.1624 8.89416C15.2071 7.71502 15.2819 6.00841 16.3368 4.9174C17.5191 3.69448 19.4803 3.69717 20.6593 4.92332L27.8322 12.3831C29.155 13.4822 30 15.1428 30 17C30 20.2785 27.3704 22.9429 24.1053 22.9991V23.0004C24.1053 25.2096 22.3144 27.0004 20.1053 27.0004H11C8.23858 27.0004 6 24.7618 6 22.0004V19.9004C3.71776 19.4371 2 17.4193 2 15.0004C2 12.2389 4.23858 10.0004 7 10.0004C8.63694 10.0004 10.0891 10.7874 11.0003 12.0004ZM19.2177 6.30954C18.8241 5.9002 18.1693 5.89931 17.7746 6.30756C17.4225 6.67178 17.3975 7.24152 17.7164 7.63516L20.7241 11.3476L20.0662 11.9843C19.6801 12.358 19.3805 12.8187 19.1987 13.3335L18.9631 14.0004H11.8723C9.72227 14.0678 8 15.832 8 17.9984V22.0004C8 23.6573 9.34315 25.0004 11 25.0004H16C16 25.0004 16 25.0004 16 25.0004V24.5004C16 23.1197 14.8807 22.0004 13.5 22.0004H12C11.4477 22.0004 11 21.5527 11 21.0004C11 20.4481 11.4477 20.0004 12 20.0004H13.5C15.9853 20.0004 18 22.0151 18 24.5004V25.0004C18 25.0004 18 25.0004 18 25.0004L20.1053 25.0004C21.2098 25.0004 22.1053 24.105 22.1053 23.0004V20.7233L23.283 20.9361C23.5149 20.978 23.7545 21 24 21C26.2091 21 28 19.2091 28 17C28 15.7472 27.4252 14.6293 26.5211 13.8943L26.4736 13.8557L19.2177 6.30954ZM6.00231 17.8305C6.06168 15.6698 7.26332 13.7945 9.02502 12.7867C8.49077 12.2976 7.77981 12.0004 7 12.0004C5.34315 12.0004 4 13.3435 4 15.0004C4 16.3075 4.83591 17.4193 6.00231 17.8305Z" fill="currentColor"/>
</svg>
`, be = {
  info: _t,
  "checkmark-circle": Qt,
  warning: te,
  "error-circle": ee,
  dismiss: ie,
  search: se,
  link: re,
  settings: oe,
  star: ne,
  heart: le,
  "weather-moon": ae,
  "weather-sunny": he,
  "theme-auto": ce,
  "animal-rabbit-filled": de,
  "animal-rabbit-off-filled": ue,
  "animal-rabbit-regular": pe
};
function ot(n, { size: t = 20, label: e = null } = {}) {
  const i = be[n];
  if (!i)
    return "";
  const s = e ? `role="img" aria-label="${e.replace(/"/g, "&quot;")}"` : 'aria-hidden="true"';
  return i.replace("<svg ", `<svg width="${t}" height="${t}" ${s} `);
}
const ge = ':host{position:fixed;top:calc(18px + env(safe-area-inset-top,0px));inset-inline-end:calc(18px + env(safe-area-inset-right,0px));z-index:10002;pointer-events:none;--jelly-toast-radius: 999px;--jelly-toast-font-size: 14px}.rail{display:flex;flex-direction:column;gap:10px;align-items:flex-end}:host([position="bottom"]){top:auto;bottom:calc(18px + env(safe-area-inset-bottom,0px))}:host([position="bottom"]) .rail{flex-direction:column-reverse}:host(:dir(rtl)) .rail{align-items:flex-start}.toast{pointer-events:auto;display:flex;align-items:center;gap:11px;cursor:pointer;touch-action:manipulation;background:var(--jelly-color-background-surface);border:1px solid var(--jelly-color-border-default);border-radius:var(--jelly-toast-radius);box-shadow:var(--jelly-shadow-overlay);padding-block:11px;padding-inline-start:14px;padding-inline-end:14px;font:600 var(--jelly-toast-font-size)/1.3 var(--jelly-font-display);color:var(--jelly-color-foreground-default);max-width:min(320px,calc(100vw - 48px))}.dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto}.toast-text{flex:1}.close{flex:0 0 auto;appearance:none;border:0;margin:0;padding:0;width:22px;height:22px;border-radius:50%;background:transparent;color:var(--jelly-color-foreground-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.close:hover{background:var(--jelly-color-border-default)}.close:focus-visible{outline:2px solid var(--jelly-ring-color);outline-offset:1px}.sr-tone{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}@media(forced-colors:active){.toast{border-color:CanvasText}.dot{border:3px solid CanvasText}}', ft = {
  info: { color: `var(--jelly-color-background-azure, ${b["background-azure"]})`, spoken: "Info" },
  success: { color: `var(--jelly-color-background-mint,  ${b["background-mint"]})`, spoken: "Success" },
  warning: { color: `var(--jelly-color-background-amber, ${b["background-amber"]})`, spoken: "Warning" },
  danger: { color: `var(--jelly-color-background-rose,  ${b["background-rose"]})`, spoken: "Error" }
};
class ye extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1;
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), !this.built && (this.built = !0, this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `
      <style>${ge}</style>

      <div class="rail" aria-live="polite"></div>
    `);
  }
  // Add one toast; returns its element (click or timeout removes it)
  push(t, { tone: e = "info", duration: i = 3500 } = {}) {
    const s = ft[e] || ft.info, r = document.createElement("div");
    r.className = "toast", r.setAttribute("part", "toast"), r.setAttribute("role", "status");
    const o = document.createElement("span");
    o.className = "dot", o.setAttribute("part", "dot"), o.style.background = s.color, o.setAttribute("aria-hidden", "true");
    const l = document.createElement("span");
    l.className = "sr-tone", l.textContent = `${s.spoken}:`;
    const d = document.createElement("span");
    d.className = "toast-text", d.textContent = String(t);
    const h = document.createElement("button");
    h.className = "close", h.setAttribute("part", "close"), h.setAttribute("aria-label", "Dismiss"), h.innerHTML = ot("dismiss", { size: 13 }), r.append(o, l, d, h), this.shadowRoot.querySelector(".rail").appendChild(r), Ot(r);
    const a = () => Wt(r, () => r.remove());
    return i > 0 && setTimeout(a, i), r.addEventListener("click", a), h.addEventListener("click", (c) => {
      c.stopPropagation(), a();
    }), r;
  }
}
customElements.define("jelly-toaster", ye);
function me(n, t) {
  let e = document.querySelector("jelly-toaster");
  return e || (e = document.createElement("jelly-toaster"), document.body.appendChild(e)), e.push(n, t);
}
typeof window < "u" && (window.jellyToast = me);
function et(n) {
  const t = String(n).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0], e = n.startsWith("color(") ? t : t.map((s) => s / 255), i = Number(String(n).match(/[\d.]+/g)?.[3] ?? 1);
  return [...e, Math.max(0, Math.min(1, i))];
}
function vt(n) {
  const t = n.slice(0, 3).map((e) => e <= 0.04045 ? e / 12.92 : Math.pow((e + 0.055) / 1.055, 2.4));
  return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
}
function fe(n, t) {
  const e = et(n), i = et(t), s = e[3], r = e.slice(0, 3).map((a, c) => a * s + i[c] * (1 - s)), o = vt(r), l = vt(et("rgb(30, 34, 42)")), d = 1, h = (a, c) => (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
  return h(o, l) >= h(o, d) ? "#1E222A" : "#FFFFFF";
}
class ve extends HTMLElement {
  constructor() {
    super(), this.tokenStyle = null, this.colorProbe = null, this.schemeQuery = typeof matchMedia == "function" ? matchMedia("(prefers-color-scheme: dark)") : null, this.onSchemeChange = () => this.sync();
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["mode", "accent"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), this.shadowRoot || (this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `
        <style data-jelly-theme-tokens>:host { display: contents; }</style>

        <slot></slot>
      `), this.tokenStyle = this.shadowRoot.querySelector("[data-jelly-theme-tokens]"), this.schemeQuery?.addEventListener?.("change", this.onSchemeChange), this.sync();
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    this.schemeQuery?.removeEventListener?.("change", this.onSchemeChange);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback() {
    this.isConnected && this.sync();
  }
  // The requested mode: 'light', 'dark', or 'auto' (follow the OS)
  get mode() {
    const t = this.getAttribute("mode");
    return t === "light" || t === "dark" ? t : "auto";
  }
  set mode(t) {
    this.setAttribute("mode", t);
  }
  // The re-tinted accent hue for this subtree (null when unset)
  get accent() {
    return this.getAttribute("accent");
  }
  set accent(t) {
    t == null ? this.removeAttribute("accent") : this.setAttribute("accent", t);
  }
  // The mode in effect right now, with 'auto' resolved against the OS
  get resolvedMode() {
    return this.mode !== "auto" ? this.mode : this.schemeQuery?.matches ? "dark" : "light";
  }
  // Resolve any supported CSS color syntax to computed sRGB for contrast math
  resolveColor(t) {
    this.colorProbe || (this.colorProbe = document.createElement("span"), this.colorProbe.setAttribute("aria-hidden", "true"), this.colorProbe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none", this.shadowRoot.appendChild(this.colorProbe));
    const e = this.colorProbe;
    return e.style.color = `color-mix(in srgb, ${t} 100%, transparent)`, getComputedStyle(e).color;
  }
  /*
   * Apply the resolved token set through the shadow :host rule, so the whole
   * subtree - including canvas-painted components that read computed tokens -
   * picks up the theme through normal CSS inheritance. Writing it as a :host
   * selector rule (rather than inline styles on the host) means a consumer's
   * own inline `style="--jelly-color-…"` still wins.
   */
  sync() {
    if (!this.tokenStyle)
      return;
    const t = this.resolvedMode === "dark" ? st : ct, e = Object.entries(t).map(([s, r]) => `--jelly-color-${s}: ${r};`), i = this.getAttribute("accent")?.trim();
    if (i) {
      const s = t["background-" + i], r = s || i;
      if (!!s || CSS.supports("color", r)) {
        const l = s ? t["foreground-on-emphasis"] : fe(this.resolveColor(r), this.resolveColor(t["background-surface"]));
        e.push(`--jelly-color-background-accent: ${r};`), e.push(`--jelly-color-foreground-on-accent: ${l};`);
      }
    }
    this.tokenStyle.textContent = `:host { display: contents; color-scheme: ${this.resolvedMode}; ${e.join(" ")} }`, G();
  }
}
customElements.define("jelly-theme", ve);
const xe = ':host{--jelly-button-height: 62px;--jelly-button-min-width: 168px;--jelly-button-padding-inline: 30px;--jelly-button-font-size: 16px;--jelly-button-gap: 9px;--jelly-button-radius: 999px;--jelly-ring: var(--jelly-fill, var(--jelly-color-border-focus));font:640 var(--jelly-button-font-size)/1 var(--jelly-font-display)}:host([shape="square"]){--jelly-button-radius: calc(var(--jelly-button-height) * .32)}:host([disabled]){opacity:.55;pointer-events:none}:host([block]){display:block;width:100%}:host([block]) button{width:100%}:host([size="small"]),:host([size="sm"]){--jelly-button-height: 42px;--jelly-button-min-width: 42px;--jelly-button-padding-inline: 16px;--jelly-button-font-size: 14px}:host([size="medium"]),:host([size="md"]){--jelly-button-height: 62px;--jelly-button-min-width: 168px;--jelly-button-padding-inline: 30px;--jelly-button-font-size: 16px}:host([size="large"]),:host([size="lg"]){--jelly-button-height: 72px;--jelly-button-min-width: 200px;--jelly-button-padding-inline: 38px;--jelly-button-font-size: 18px}button{appearance:none;-webkit-appearance:none;border:0;margin:0;background:transparent;color:var(--jelly-label);font:inherit;height:var(--jelly-button-height);min-width:var(--jelly-button-min-width);padding-block:0;padding-inline:var(--jelly-button-padding-inline);display:inline-flex;align-items:center;justify-content:center;gap:var(--jelly-button-gap);position:relative;cursor:pointer;border-radius:var(--jelly-button-radius);touch-action:manipulation;transition:height .42s cubic-bezier(.4,0,.2,1),min-width .42s cubic-bezier(.4,0,.2,1),padding-inline .42s cubic-bezier(.4,0,.2,1),border-radius .42s cubic-bezier(.4,0,.2,1)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) button{transition:none}}:host-context([data-jelly-motion="reduce"]) button{transition:none}button:focus-visible{outline:none}button:after{content:"";position:absolute;inset:-2px;border:var(--jelly-ring-width) solid transparent;border-radius:calc(var(--jelly-button-radius) + 2px);pointer-events:none}::slotted(svg),::slotted(img){pointer-events:none}@media(forced-colors:active){button{color:ButtonText}button:focus-visible:after{border-color:Highlight}}', U = ':host{--jelly-fill: var(--jelly-color-background-accent);--jelly-label: var(--jelly-color-foreground-on-accent)}:host([variant="white"]){--jelly-fill: var(--jelly-color-background-white);--jelly-label: var(--jelly-color-foreground-on-white)}:host([variant="rose"]){--jelly-fill: var(--jelly-color-background-rose);--jelly-label: var(--jelly-color-foreground-on-emphasis)}:host([variant="amber"]){--jelly-fill: var(--jelly-color-background-amber);--jelly-label: var(--jelly-color-foreground-on-emphasis)}:host([variant="azure"]){--jelly-fill: var(--jelly-color-background-azure);--jelly-label: var(--jelly-color-foreground-on-emphasis)}:host([variant="mint"]){--jelly-fill: var(--jelly-color-background-mint);--jelly-label: var(--jelly-color-foreground-on-emphasis)}:host([variant="platinum"]){--jelly-fill: var(--jelly-color-background-neutral);--jelly-label: var(--jelly-color-foreground-on-neutral)}:host([variant="graphite"]){--jelly-fill: var(--jelly-color-background-neutral-emphasis);--jelly-label: var(--jelly-color-foreground-on-emphasis)}';
class je extends L {
  constructor() {
    super(...arguments), this.activationPointerId = null, this.cancelPointerClick = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return [
      "disabled",
      "label",
      "type",
      "shape",
      // Global ARIA state forwarded to the inner focusable button, so the
      // roled/focusable element - not the roleless host - carries the state
      "aria-current",
      "aria-expanded",
      "aria-haspopup",
      "aria-controls",
      "aria-pressed"
    ];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return U + xe;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<button part="button"><slot></slot></button>';
  }
  // The capsule (or, with shape="square", rounded-rectangle) the physics body
  // takes, inset so the wobble stays inside the host
  shape(t, e) {
    const i = t - 8, s = e - 8, r = this.getAttribute("shape") === "square", o = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-button-radius")), l = Number.isFinite(o) ? Math.min(o, s / 2) : r ? s * 0.32 : s / 2;
    return { width: i, height: s, radius: l };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.button = this.shadowRoot.querySelector("button"), this.sync("type"), this.sync("disabled"), this.sync("label");
    for (const t of this.getAttributeNames())
      t.startsWith("aria-") && this.sync(t);
    this.useHostFocusTarget(this.button), this.trackFocus(this.button), this.preventReleaseOutsideActivation(), this.wirePress(this.button), this.button.addEventListener("click", () => this.driveForm());
  }
  // Pointer capture keeps a drag routed to the button after the pointer leaves
  // it. Only let the resulting native click through when it is released back
  // inside the button; keyboard activation stays unchanged.
  preventReleaseOutsideActivation() {
    this.button.addEventListener("pointerdown", (e) => {
      this.activationPointerId = e.pointerId, this.cancelPointerClick = !1;
    }), this.button.addEventListener("pointerup", (e) => {
      if (e.pointerId !== this.activationPointerId)
        return;
      const i = this.button.getBoundingClientRect();
      this.cancelPointerClick = e.clientX < i.left || e.clientX > i.right || e.clientY < i.top || e.clientY > i.bottom, this.activationPointerId = null;
    }), this.button.addEventListener("pointercancel", () => {
      this.activationPointerId = null, this.cancelPointerClick = !1;
    });
    const t = (e) => {
      this.cancelPointerClick && (this.cancelPointerClick = !1, e.preventDefault(), e.stopImmediatePropagation());
    };
    this.button.addEventListener("click", t), this.addEventListener("click", t, { capture: !0 });
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.button && this.sync(t);
  }
  // Push one observed attribute into the inner native button
  sync(t) {
    if (t.startsWith("aria-")) {
      const e = this.getAttribute(t);
      e === null ? this.button.removeAttribute(t) : this.button.setAttribute(t, e);
      return;
    }
    switch (t) {
      case "disabled":
        this.button.disabled = this.hasAttribute("disabled"), this.syncHostFocusTarget();
        break;
      case "type": {
        const e = this.getAttribute("type");
        this.button.type = e === "submit" || e === "reset" ? e : "button";
        break;
      }
      case "label": {
        const e = this.getAttribute("label");
        e ? this.button.setAttribute("aria-label", e) : this.button.removeAttribute("aria-label");
        break;
      }
      case "shape":
        this.reshapeMembrane();
        break;
    }
  }
  // Submit or reset the closest light-DOM form when this is a submit / reset button
  driveForm() {
    const t = this.button.type;
    if (t !== "submit" && t !== "reset")
      return;
    const e = this.closest("form");
    e && (t === "submit" ? e.requestSubmit() : e.reset());
  }
  // Route programmatic host focus into the inner native button
  focus(t) {
    this.button?.focus(t);
  }
}
customElements.define("jelly-button", je);
const we = ':host{--jelly-icon-button-size: 48px;--jelly-icon-button-radius: 16px;--jelly-icon-button-font-size: 18px;--jelly-icon-button-icon-size: 20px;--jelly-ring: var(--jelly-fill, var(--jelly-color-border-focus))}:host([disabled]){opacity:.55;pointer-events:none}:host([size="small"]),:host([size="sm"]){--jelly-icon-button-size: 40px;--jelly-icon-button-radius: 13px;--jelly-icon-button-font-size: 16px;--jelly-icon-button-icon-size: 18px}:host([size="medium"]),:host([size="md"]){--jelly-icon-button-size: 48px;--jelly-icon-button-radius: 16px;--jelly-icon-button-font-size: 18px;--jelly-icon-button-icon-size: 20px}:host([size="large"]),:host([size="lg"]){--jelly-icon-button-size: 56px;--jelly-icon-button-radius: 18px;--jelly-icon-button-font-size: 20px;--jelly-icon-button-icon-size: 23px}button{appearance:none;-webkit-appearance:none;border:0;margin:0;padding:0;background:transparent;color:var(--jelly-label);width:var(--jelly-icon-button-size);height:var(--jelly-icon-button-size);display:inline-flex;align-items:center;justify-content:center;font:600 var(--jelly-icon-button-font-size)/1 var(--jelly-font-display);position:relative;cursor:pointer;border-radius:var(--jelly-icon-button-radius);touch-action:manipulation;transition:width .42s cubic-bezier(.4,0,.2,1),height .42s cubic-bezier(.4,0,.2,1)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) button{transition:none}}:host-context([data-jelly-motion="reduce"]) button{transition:none}button:focus-visible{outline:none}button:after{content:"";position:absolute;inset:-2px;border:var(--jelly-ring-width) solid transparent;border-radius:calc(var(--jelly-icon-button-radius) + 2px);pointer-events:none}::slotted(svg){width:var(--jelly-icon-button-icon-size);height:var(--jelly-icon-button-icon-size)}@media(forced-colors:active){button{color:ButtonText}button:focus-visible:after{border-color:Highlight}}';
class ke extends L {
  constructor() {
    super(...arguments), this.activationPointerId = null, this.cancelPointerClick = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["disabled", "label", "shape"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return U + we;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<button part="button"><slot></slot></button>';
  }
  // The rounded square (default / shape="square") or circle (shape="circle")
  // the physics body takes, inset so the wobble stays inside
  shape(t, e) {
    const i = Math.min(t, e) - 6, s = this.getAttribute("shape") === "circle", r = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-icon-button-radius")), o = s ? i / 2 : Number.isFinite(r) ? Math.min(r, i / 2) : i * 0.32;
    return { width: i, height: i, radius: o };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.button = this.shadowRoot.querySelector("button"), this.sync("disabled"), this.sync("label"), this.useHostFocusTarget(this.button), this.trackFocus(this.button), this.preventReleaseOutsideActivation(), this.wirePress(this.button);
  }
  // Pointer capture keeps a drag routed to the button after the pointer leaves
  // it. Cancel the resulting native click unless the release is back inside
  // the button; keyboard-originated clicks are unaffected.
  preventReleaseOutsideActivation() {
    this.button.addEventListener("pointerdown", (e) => {
      this.activationPointerId = e.pointerId, this.cancelPointerClick = !1;
    }), this.button.addEventListener("pointerup", (e) => {
      if (e.pointerId !== this.activationPointerId)
        return;
      const i = this.button.getBoundingClientRect();
      this.cancelPointerClick = e.clientX < i.left || e.clientX > i.right || e.clientY < i.top || e.clientY > i.bottom, this.activationPointerId = null;
    }), this.button.addEventListener("pointercancel", () => {
      this.activationPointerId = null, this.cancelPointerClick = !1;
    });
    const t = (e) => {
      this.cancelPointerClick && (this.cancelPointerClick = !1, e.preventDefault(), e.stopImmediatePropagation());
    };
    this.button.addEventListener("click", t), this.addEventListener("click", t, { capture: !0 });
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.button && this.sync(t);
  }
  // Push one observed attribute into the inner native button or the membrane
  sync(t) {
    switch (t) {
      case "disabled":
        this.button.disabled = this.hasAttribute("disabled"), this.syncHostFocusTarget();
        break;
      case "label": {
        const e = this.getAttribute("label");
        e ? this.button.setAttribute("aria-label", e) : this.button.removeAttribute("aria-label");
        break;
      }
      case "shape":
        this.reshapeMembrane();
        break;
    }
  }
  // Route programmatic host focus into the inner native button
  focus(t) {
    this.button?.focus(t);
  }
}
customElements.define("jelly-icon-button", ke);
const Ce = ':host{--jelly-input-padding-inline: 20px;--jelly-input-font-size: 16px;--jelly-input-radius: 16px;--jelly-fill: var(--jelly-color-background-muted);--jelly-label: var(--jelly-color-foreground-default);--jelly-accent: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-accent, var(--jelly-color-border-focus));display:inline-block;width:280px;height:56px;font:500 var(--jelly-input-font-size)/1.2 var(--jelly-font-text)}:host([size="small"]),:host([size="sm"]){--jelly-input-padding-inline: 16px;--jelly-input-font-size: 14.5px;--jelly-input-radius: 14px;width:220px;height:46px}:host([size="medium"]),:host([size="md"]){--jelly-input-padding-inline: 20px;--jelly-input-font-size: 16px;--jelly-input-radius: 16px;width:280px;height:56px}:host([size="large"]),:host([size="lg"]){--jelly-input-padding-inline: 24px;--jelly-input-font-size: 17px;--jelly-input-radius: 18px;width:340px;height:64px}:host([disabled]){--jelly-fill: var(--jelly-color-background-neutral);opacity:.55;pointer-events:none}input{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;border:0;outline:none;background:transparent;padding-block:0;padding-inline:var(--jelly-input-padding-inline);font:inherit;color:var(--jelly-label);text-align:start;touch-action:manipulation}input::placeholder{color:var(--jelly-color-foreground-muted)}.ring{position:absolute;inset:4px;border:var(--jelly-ring-width) solid transparent;border-radius:var(--jelly-input-radius);pointer-events:none}@media(forced-colors:active){.ring{border-color:FieldText}:host(:focus-within) .ring{border-color:Highlight}}';
class Ae extends L {
  constructor() {
    super(), this.focused = !1, this.measure = null, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "placeholder", "type", "label", "disabled", "readonly", "autocomplete", "no-autofill", "size"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Ce;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<input part="input" /><div class="ring" part="ring" aria-hidden="true"></div>';
  }
  // The rounded rectangle the physics body takes, inset so the wobble stays inside the host
  shape(t, e) {
    const i = t - 8, s = e - 8, r = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-input-radius")), o = Number.isFinite(r) ? Math.min(r, s / 2) : Math.min(16, s / 2);
    return { width: i, height: s, radius: o };
  }
  // Resolve the surface color the canvas paints: neutral when disabled,
  // the elevated surface while focused, the resting field fill otherwise
  fill() {
    return this.hasAttribute("disabled") ? this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`) : this.focused ? this.resolveColor(`var(--jelly-color-background-surface, ${b["background-surface"]})`) : getComputedStyle(this).getPropertyValue("--jelly-fill").trim() || this.resolveColor(`var(--jelly-color-background-muted, ${b["background-muted"]})`);
  }
  // Hairline border on the jelly surface: accent while focused, neutral at rest
  surfaceBorder() {
    return { color: this.focused ? this.resolveColor(`var(--jelly-accent, var(--jelly-color-background-accent, ${b["background-accent"]}))`) : this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`), width: 1 };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.input = this.shadowRoot.querySelector("input"), this.sync("type"), this.sync("value"), this.sync("placeholder"), this.sync("label"), this.sync("readonly"), this.sync("disabled"), this.syncAutofill(), this.useHostFocusTarget(this.input), this.input.addEventListener("focus", this), this.input.addEventListener("blur", this), this.input.addEventListener("input", this), this.input.addEventListener("change", this);
  }
  // Route the inner input's events (registered with `this` as the listener)
  handleEvent(t) {
    switch (t.type) {
      case "focus":
        this.handleFocus();
        break;
      case "blur":
        this.handleBlur();
        break;
      case "input":
        this.handleInput();
        break;
      case "change":
        g(this, "change");
        break;
    }
  }
  // Focus lifts the surface: elevated fill, a soft center pop, a visible ring
  handleFocus() {
    this.focused = !0, this.focusVisible = !0, this.centerPop(0.7), this.requestFrame();
  }
  // Blur settles the surface back to its resting fill
  handleBlur() {
    this.focused = !1, this.focusVisible = !1, this.requestFrame();
  }
  // Mirror the value into the form and ripple the membrane at the caret
  handleInput() {
    if (this.internals.setFormValue(this.input.value), !this.reducedMotion && this.body) {
      const t = this.caretLocalX(), e = this.body.height / 2;
      this.body.pulseAt(t, -e, 0.34), this.body.pulseAt(t, e, 0.34), this.requestFrame();
    }
  }
  /*
   * Apply the autofill posture: no-autofill turns off autocomplete,
   * autocorrect, autocapitalize and spellcheck and sets the opt-out
   * attributes the common password managers respect
   */
  syncAutofill() {
    const t = this.hasAttribute("no-autofill"), e = this.getAttribute("autocomplete");
    this.input.autocomplete = t ? "off" : e || "", this.input.toggleAttribute("data-lpignore", t), this.input.toggleAttribute("data-1p-ignore", t), this.input.toggleAttribute("data-bwignore", t), t ? (this.input.setAttribute("data-form-type", "other"), this.input.setAttribute("autocorrect", "off"), this.input.setAttribute("autocapitalize", "none"), this.input.spellcheck = !1) : (this.input.removeAttribute("data-form-type"), this.input.removeAttribute("autocorrect"), this.input.removeAttribute("autocapitalize"), this.input.removeAttribute("spellcheck"));
  }
  /*
   * The caret's x in the body's local frame (0 = shape center, +x = right).
   * Measures the text advance up to the caret in the input's own font,
   * offsets it by the inline-start padding and the direction-aware scroll,
   * then mirrors the result in RTL - where the inline start is the right
   * edge - so the ripple lands under the caret in either direction.
   */
  caretLocalX() {
    const t = this.input;
    let e;
    try {
      e = t.selectionStart;
    } catch {
      e = null;
    }
    e == null && (e = t.value.length);
    const i = getComputedStyle(t);
    this.measure || (this.measure = document.createElement("canvas").getContext("2d"));
    const s = this.measure;
    s.font = i.font || `${i.fontWeight} ${i.fontSize} ${i.fontFamily}`;
    const r = t.type === "password" ? "•".repeat(e) : t.value.slice(0, e), o = s.measureText(r).width, l = k(this), d = parseFloat(i.paddingInlineStart || (l ? i.paddingRight : i.paddingLeft)) || 0, h = l ? -t.scrollLeft : t.scrollLeft, a = d + o - h, c = l ? t.clientWidth / 2 - a : a - t.clientWidth / 2, p = this.body.width / 2;
    return m(c, -p + 6, p - 6);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.input && this.sync(t);
  }
  // Push one observed attribute into the inner native input
  sync(t) {
    switch (t) {
      case "value":
        this.input.value = this.getAttribute("value") ?? "", this.internals.setFormValue(this.input.value);
        break;
      case "placeholder":
        this.input.placeholder = this.getAttribute("placeholder") ?? "";
        break;
      case "type":
        this.input.type = this.getAttribute("type") || "text";
        break;
      case "label": {
        const e = this.getAttribute("label");
        e ? this.input.setAttribute("aria-label", e) : this.input.removeAttribute("aria-label");
        break;
      }
      case "disabled":
        this.input.disabled = this.hasAttribute("disabled"), this.syncHostFocusTarget(), this.requestFrame();
        break;
      case "readonly":
        this.input.readOnly = this.hasAttribute("readonly");
        break;
      case "autocomplete":
      case "no-autofill":
        this.syncAutofill();
        break;
      case "size":
        j(this);
        break;
    }
  }
  // The current text value (read live from the inner control once built)
  get value() {
    return this.input ? this.input.value : this.getAttribute("value") || "";
  }
  // Set the text value and mirror it into the form
  set value(t) {
    this.input && (this.input.value = t, this.internals.setFormValue(t));
  }
  // Route programmatic host focus into the inner native input
  focus(t) {
    this.input?.focus(t);
  }
}
customElements.define("jelly-input", Ae);
const ze = ':host{--jelly-textarea-font-size: 15.5px;--jelly-textarea-padding-block: 16px;--jelly-textarea-padding-inline: 20px;--jelly-textarea-radius: 18px;--jelly-textarea-min-height: 96px;--jelly-textarea-max-height: 240px;--jelly-fill: var(--jelly-color-background-muted);--jelly-label: var(--jelly-color-foreground-default);--jelly-accent: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-accent, var(--jelly-color-border-focus));display:inline-block;width:320px;font:500 var(--jelly-textarea-font-size)/1.5 var(--jelly-font-text)}:host([size="small"]),:host([size="sm"]){--jelly-textarea-font-size: 14px;--jelly-textarea-padding-block: 13px;--jelly-textarea-padding-inline: 16px;--jelly-textarea-radius: 15px;--jelly-textarea-min-height: 76px;--jelly-textarea-max-height: 200px;width:280px}:host([size="medium"]),:host([size="md"]){--jelly-textarea-font-size: 15.5px;--jelly-textarea-padding-block: 16px;--jelly-textarea-padding-inline: 20px;--jelly-textarea-radius: 18px;--jelly-textarea-min-height: 96px;--jelly-textarea-max-height: 240px;width:320px}:host([size="large"]),:host([size="lg"]){--jelly-textarea-font-size: 16.5px;--jelly-textarea-padding-block: 18px;--jelly-textarea-padding-inline: 24px;--jelly-textarea-radius: 20px;--jelly-textarea-min-height: 124px;--jelly-textarea-max-height: 300px;width:380px}:host([disabled]){--jelly-fill: var(--jelly-color-background-neutral);opacity:.55;pointer-events:none}textarea{display:block;width:100%;box-sizing:border-box;border:0;outline:none;resize:none;background:transparent;padding-block:var(--jelly-textarea-padding-block);padding-inline:var(--jelly-textarea-padding-inline);min-height:var(--jelly-textarea-min-height);max-height:var(--jelly-textarea-max-height);overflow-y:auto;font:inherit;color:var(--jelly-label);text-align:start;touch-action:manipulation}textarea::placeholder{color:var(--jelly-color-foreground-muted)}.ring{position:absolute;inset:4px;border:var(--jelly-ring-width) solid transparent;border-radius:var(--jelly-textarea-radius);pointer-events:none}@media(forced-colors:active){.ring{border-color:FieldText}:host(:focus-within) .ring{border-color:Highlight}}', Le = [
  "direction",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
  "lineHeight",
  "textIndent",
  "tabSize",
  "textAlign",
  "wordBreak"
];
class Se extends L {
  constructor() {
    super(), this.focused = !1, this.textareaResizeObserver = null, this.mirror = null, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "placeholder", "rows", "label", "disabled", "readonly", "autocomplete", "no-autofill", "size"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return ze;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<textarea part="textarea"></textarea><div class="ring" part="ring" aria-hidden="true"></div>';
  }
  // The rounded rectangle the physics body takes, inset so the wobble stays inside the host
  shape(t, e) {
    const i = t - 8, s = e - 8, r = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-textarea-radius")), o = Number.isFinite(r) ? Math.min(r, s / 2) : Math.min(20, s / 2);
    return { width: i, height: s, radius: o };
  }
  // Resolve the surface color the canvas paints: neutral when disabled,
  // the elevated surface while focused, the resting field fill otherwise
  fill() {
    return this.hasAttribute("disabled") ? this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`) : this.focused ? this.resolveColor(`var(--jelly-color-background-surface, ${b["background-surface"]})`) : getComputedStyle(this).getPropertyValue("--jelly-fill").trim() || this.resolveColor(`var(--jelly-color-background-muted, ${b["background-muted"]})`);
  }
  // Hairline border on the jelly surface: accent while focused, neutral at rest
  surfaceBorder() {
    return { color: this.focused ? this.resolveColor(`var(--jelly-accent, var(--jelly-color-background-accent, ${b["background-accent"]}))`) : this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`), width: 1 };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.textarea = this.shadowRoot.querySelector("textarea"), this.sync("value"), this.sync("placeholder"), this.sync("rows"), this.sync("label"), this.sync("readonly"), this.sync("disabled"), this.syncAutofill(), this.useHostFocusTarget(this.textarea), this.autoSize(), this.textareaResizeObserver = new ResizeObserver(() => this.applyShape()), this.textareaResizeObserver.observe(this.textarea), this.textarea.addEventListener("focus", this), this.textarea.addEventListener("blur", this), this.textarea.addEventListener("input", this), this.textarea.addEventListener("change", this);
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    super.connectedCallback(), this.textarea && !this.textareaResizeObserver && (this.textareaResizeObserver = new ResizeObserver(() => this.applyShape()), this.textareaResizeObserver.observe(this.textarea));
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), this.textareaResizeObserver && (this.textareaResizeObserver.disconnect(), this.textareaResizeObserver = null);
  }
  // Route the inner textarea's events (registered with `this` as the listener)
  handleEvent(t) {
    switch (t.type) {
      case "focus":
        this.handleFocus();
        break;
      case "blur":
        this.handleBlur();
        break;
      case "input":
        this.handleInput();
        break;
      case "change":
        g(this, "change");
        break;
    }
  }
  // Focus lifts the surface: elevated fill, a soft center pop, a visible ring
  handleFocus() {
    this.focused = !0, this.focusVisible = !0, this.centerPop(0.6), this.requestFrame();
  }
  // Blur settles the surface back to its resting fill
  handleBlur() {
    this.focused = !1, this.focusVisible = !1, this.requestFrame();
  }
  // Mirror the value into the form, grow to fit and ripple at the caret
  handleInput() {
    if (this.internals.setFormValue(this.textarea.value), this.autoSize(), !this.reducedMotion && this.body) {
      const { x: t, y: e } = this.caretLocalPoint();
      this.body.pulseAt(t, e, 0.5), this.requestFrame();
    }
  }
  // Grow the control to fit its content (the CSS max-height caps it)
  autoSize() {
    this.textarea && (this.textarea.style.height = "auto", this.textarea.style.height = `${this.textarea.scrollHeight}px`, this.applyShape());
  }
  /*
   * Apply the autofill posture: no-autofill turns off autocomplete,
   * autocorrect, autocapitalize and spellcheck and sets the opt-out
   * attributes the common password managers respect
   */
  syncAutofill() {
    const t = this.hasAttribute("no-autofill"), e = this.getAttribute("autocomplete");
    this.textarea.autocomplete = t ? "off" : e || "", this.textarea.toggleAttribute("data-lpignore", t), this.textarea.toggleAttribute("data-1p-ignore", t), this.textarea.toggleAttribute("data-bwignore", t), t ? (this.textarea.setAttribute("data-form-type", "other"), this.textarea.setAttribute("autocorrect", "off"), this.textarea.setAttribute("autocapitalize", "none"), this.textarea.spellcheck = !1) : (this.textarea.removeAttribute("data-form-type"), this.textarea.removeAttribute("autocorrect"), this.textarea.removeAttribute("autocapitalize"), this.textarea.removeAttribute("spellcheck"));
  }
  /*
   * The caret's {x, y} in the body's local frame (0,0 = shape center). A
   * hidden "mirror" div replicates the textarea's layout - font, width,
   * padding, wrap and direction - so a marker span at the caret reports
   * its real physical position, wrapping and RTL layout included.
   */
  caretLocalPoint() {
    const t = this.textarea;
    let e;
    try {
      e = t.selectionStart;
    } catch {
      e = null;
    }
    e == null && (e = t.value.length);
    const i = getComputedStyle(t), s = this.mirror || (this.mirror = document.createElement("div")), r = s.style;
    r.position = "absolute", r.top = "0", r.left = "-9999px", r.visibility = "hidden", r.whiteSpace = "pre-wrap", r.overflowWrap = "break-word", r.boxSizing = "content-box";
    const o = parseFloat(i.paddingLeft) || 0, l = parseFloat(i.paddingRight) || 0;
    r.width = `${t.clientWidth - o - l}px`;
    const d = i, h = r;
    for (const w of Le)
      h[w] = d[w];
    s.textContent = t.value.slice(0, e);
    const a = document.createElement("span");
    a.textContent = t.value.slice(e) || ".", s.appendChild(a), this.shadowRoot.appendChild(s);
    const c = t.scrollWidth - t.clientWidth, p = k(this) ? t.scrollLeft + c : t.scrollLeft, u = a.offsetLeft - p, f = a.offsetTop - t.scrollTop;
    this.shadowRoot.removeChild(s), s.removeChild(a);
    const C = u - t.offsetWidth / 2, v = f - t.offsetHeight / 2, x = this.body.width / 2 - 6, y = this.body.height / 2 - 6;
    return {
      x: m(C, -x, x),
      y: m(v, -y, y)
    };
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.textarea && this.sync(t);
  }
  // Push one observed attribute into the inner native textarea
  sync(t) {
    switch (t) {
      case "value":
        this.textarea.value = this.getAttribute("value") ?? "", this.internals.setFormValue(this.textarea.value), this.autoSize();
        break;
      case "placeholder":
        this.textarea.placeholder = this.getAttribute("placeholder") ?? "";
        break;
      case "rows": {
        const e = this.getAttribute("rows");
        e == null ? this.textarea.removeAttribute("rows") : this.textarea.rows = Number(e) || 2, this.autoSize();
        break;
      }
      case "label": {
        const e = this.getAttribute("label");
        e ? this.textarea.setAttribute("aria-label", e) : this.textarea.removeAttribute("aria-label");
        break;
      }
      case "disabled":
        this.textarea.disabled = this.hasAttribute("disabled"), this.syncHostFocusTarget(), this.requestFrame();
        break;
      case "readonly":
        this.textarea.readOnly = this.hasAttribute("readonly");
        break;
      case "autocomplete":
      case "no-autofill":
        this.syncAutofill();
        break;
      case "size":
        j(this);
        break;
    }
  }
  // The current text value (read live from the inner control once built)
  get value() {
    return this.textarea ? this.textarea.value : this.getAttribute("value") || "";
  }
  // Set the text value, mirror it into the form and re-fit the height
  set value(t) {
    this.textarea && (this.textarea.value = t, this.internals.setFormValue(t), this.autoSize());
  }
  // Route programmatic host focus into the inner native textarea
  focus(t) {
    this.textarea?.focus(t);
  }
}
customElements.define("jelly-textarea", Se);
const Me = ':host{display:inline-flex;--jelly-checkbox-size: 32px;--jelly-checkbox-gap: 11px;--jelly-checkbox-font-size: 15.5px;--jelly-checkbox-radius: 13px;--jelly-checkbox-stroke-width: 3.4;--jelly-checkbox-mark: var(--jelly-color-background-white);--jelly-fill: var(--jelly-color-background-neutral);--jelly-on: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-on, var(--jelly-color-border-focus));--jelly-label: var(--jelly-color-foreground-muted);font:600 var(--jelly-checkbox-font-size)/1.2 var(--jelly-font-display)}:host([size="small"]),:host([size="sm"]){--jelly-checkbox-size: 28px;--jelly-checkbox-gap: 9px;--jelly-checkbox-font-size: 14px;--jelly-checkbox-radius: 11px;--jelly-checkbox-stroke-width: 3.1}:host([size="medium"]),:host([size="md"]){--jelly-checkbox-size: 32px;--jelly-checkbox-gap: 11px;--jelly-checkbox-font-size: 15.5px;--jelly-checkbox-radius: 13px;--jelly-checkbox-stroke-width: 3.4}:host([size="large"]),:host([size="lg"]){--jelly-checkbox-size: 38px;--jelly-checkbox-gap: 13px;--jelly-checkbox-font-size: 16.5px;--jelly-checkbox-radius: 15px;--jelly-checkbox-stroke-width: 3.7}:host([disabled]){opacity:.5;pointer-events:none}.wrap{display:inline-flex;align-items:center;gap:var(--jelly-checkbox-gap);cursor:pointer;position:relative;touch-action:manipulation}input{position:absolute;inset-inline-start:0;top:50%;width:var(--jelly-checkbox-size);height:var(--jelly-checkbox-size);margin:0;transform:translateY(-50%);opacity:0;cursor:pointer}.box{position:relative;width:var(--jelly-checkbox-size);height:var(--jelly-checkbox-size);flex:0 0 auto}.box:after{content:"";position:absolute;inset:-2px;border:var(--jelly-ring-width) solid transparent;border-radius:var(--jelly-checkbox-radius);pointer-events:none}.mark{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:var(--jelly-checkbox-mark);stroke-width:var(--jelly-checkbox-stroke-width);stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30;transform:scale(.7);transform-origin:center;opacity:0;transition:stroke-dashoffset .26s cubic-bezier(.65,0,.35,1) .03s,transform .34s cubic-bezier(.3,1.7,.5,1),opacity .12s ease}:host([checked]:not([indeterminate])) .check,:host([indeterminate]) .dash{stroke-dashoffset:0;transform:scale(1);opacity:1}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .mark{transition:opacity .12s ease;stroke-dashoffset:0}}:host-context([data-jelly-motion="reduce"]) .mark{transition:opacity .12s ease;stroke-dashoffset:0}.label{color:var(--jelly-label)}.label:empty{display:none}@media(forced-colors:active){.box{border:1px solid ButtonBorder;border-radius:var(--jelly-checkbox-radius)}.mark{stroke:CanvasText}input:focus-visible+.box:after{border-color:Highlight}}';
class Ee extends L {
  constructor() {
    super(), this.scale = 1, this.scaleVelocity = 0, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["checked", "disabled", "indeterminate", "label", "size", "value"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Me + R({ color: "--jelly-on", on: "--jelly-checkbox-mark" });
  }
  // The interactive markup that sits above the canvas
  content() {
    return `
      <label class="wrap" part="wrap">
        <input type="checkbox" part="input" />
        <span class="box" data-jelly-box aria-hidden="true">
          <svg class="mark check" viewBox="0 0 32 32"><path d="M7 17l6 6 12-14" /></svg>
          <svg class="mark dash" viewBox="0 0 32 32"><path d="M9 16h14" /></svg>
        </span>
        <span class="label"><slot></slot></span>
      </label>`;
  }
  // The square the physics body takes - the box region, not the label
  shape(t, e) {
    const i = Math.min(t, e);
    return { width: i, height: i, radius: i * 0.32 };
  }
  // Resolve the box fill for the current state through the live theme tokens
  fill() {
    return this.checked || this.indeterminate ? this.resolveColor(`var(--jelly-on, ${b["background-accent"]})`) : this.resolveColor(`var(--jelly-fill, ${b["background-neutral"]})`);
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.input = this.shadowRoot.querySelector("input"), this.sync("checked"), this.sync("indeterminate"), this.sync("disabled"), this.sync("label"), this.useHostFocusTarget(this.input), this.trackFocus(this.input), this.input.addEventListener("change", () => {
      this.indeterminate = !1, this.toggleAttribute("checked", this.input.checked), this.syncFormValue(), this.pop(this.input.checked ? 4 : -3), T(), g(this, "change");
    });
  }
  // Kick the scale spring: +v expands (check), -v collapses (uncheck)
  pop(t) {
    this.reducedMotion || (this.scaleVelocity += t, this.requestFrame());
  }
  // One animation step: advance the scale spring and repaint. True keeps animating.
  frame(t) {
    const e = this.body;
    return e ? ([this.scale, this.scaleVelocity] = E(this.scale, this.scaleVelocity, 1, 260, 17, t), this.clearCanvas(), this.paintBody(e, { fill: this.fill(), scaleX: this.scale, scaleY: this.scale, ring: this.focusRing() }), Math.abs(1 - this.scale) > 15e-4 || Math.abs(this.scaleVelocity) > 15e-4) : !1;
  }
  // Report the submitted value: `value` when checked, nothing otherwise
  syncFormValue() {
    this.internals.setFormValue(this.input.checked ? this.value : null);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.input && this.sync(t);
  }
  // Push one observed attribute into the hidden native input
  sync(t) {
    switch (t) {
      case "checked":
        this.input.checked = this.checked, this.syncFormValue(), this.requestFrame();
        break;
      case "indeterminate":
        this.input.indeterminate = this.indeterminate, this.requestFrame();
        break;
      case "value":
        this.syncFormValue();
        break;
      case "disabled":
        this.input.disabled = this.hasAttribute("disabled"), this.syncHostFocusTarget();
        break;
      case "size":
        j(this);
        break;
      case "label": {
        const e = this.getAttribute("label");
        e ? this.input.setAttribute("aria-label", e) : this.input.removeAttribute("aria-label");
        break;
      }
    }
  }
  // Whether the checkbox is currently checked (reflects the attribute)
  get checked() {
    return this.hasAttribute("checked");
  }
  set checked(t) {
    this.toggleAttribute("checked", !!t);
  }
  // Mixed state: shows a dash and reports aria-checked="mixed"; cleared by a user toggle
  get indeterminate() {
    return this.hasAttribute("indeterminate");
  }
  set indeterminate(t) {
    this.toggleAttribute("indeterminate", !!t);
  }
  // The form value submitted while checked (defaults to "on", like native)
  get value() {
    return this.getAttribute("value") || "on";
  }
  set value(t) {
    this.setAttribute("value", String(t));
  }
  // Route programmatic host focus into the hidden native input
  focus(t) {
    this.input?.focus(t);
  }
}
customElements.define("jelly-checkbox", Ee);
const Te = ':host{display:inline-flex;--jelly-radio-size: 32px;--jelly-radio-dot-size: 12px;--jelly-radio-gap: 11px;--jelly-radio-font-size: 15.5px;--jelly-radio-dot-color: var(--jelly-color-background-white);--jelly-fill: var(--jelly-color-background-neutral);--jelly-on: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-on, var(--jelly-color-border-focus));--jelly-label: var(--jelly-color-foreground-muted);font:600 var(--jelly-radio-font-size)/1.2 var(--jelly-font-display)}:host([size="small"]),:host([size="sm"]){--jelly-radio-size: 28px;--jelly-radio-dot-size: 10px;--jelly-radio-gap: 9px;--jelly-radio-font-size: 14px}:host([size="medium"]),:host([size="md"]){--jelly-radio-size: 32px;--jelly-radio-dot-size: 12px;--jelly-radio-gap: 11px;--jelly-radio-font-size: 15.5px}:host([size="large"]),:host([size="lg"]){--jelly-radio-size: 38px;--jelly-radio-dot-size: 14px;--jelly-radio-gap: 13px;--jelly-radio-font-size: 16.5px}:host([disabled]){opacity:.5;pointer-events:none}.wrap{display:inline-flex;align-items:center;gap:var(--jelly-radio-gap);cursor:pointer;position:relative;touch-action:manipulation}.control{position:relative;width:var(--jelly-radio-size);height:var(--jelly-radio-size);flex:0 0 auto;outline:none}.control:after{content:"";position:absolute;inset:-2px;border:var(--jelly-ring-width) solid transparent;border-radius:50%;pointer-events:none}.dot{position:absolute;left:50%;top:50%;width:var(--jelly-radio-dot-size);height:var(--jelly-radio-dot-size);border-radius:50%;background:var(--jelly-radio-dot-color);transform:translate(-50%,-50%) scale(.15);opacity:0;transition:transform .36s cubic-bezier(.3,1.8,.45,1),opacity .13s}:host([checked]) .dot{transform:translate(-50%,-50%) scale(1);opacity:1}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .dot{transition:opacity .13s}}:host-context([data-jelly-motion="reduce"]) .dot{transition:opacity .13s}.label{color:var(--jelly-label)}.label:empty{display:none}@media(forced-colors:active){.control{border:1px solid ButtonBorder;border-radius:50%}.dot{background:CanvasText}.control:focus-visible:after{border-color:Highlight}}';
class Fe extends L {
  constructor() {
    super(), this.scale = 1, this.scaleVelocity = 0, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["checked", "disabled", "label", "size", "value"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Te + R({ color: "--jelly-on", on: "--jelly-radio-dot-color" });
  }
  // The interactive markup that sits above the canvas
  content() {
    const t = X("jelly-radio-label");
    return `
      <label class="wrap" part="wrap">
        <span class="control" part="control" data-jelly-box role="radio"
              tabindex="-1" aria-checked="false" aria-labelledby="${t}">
          <span class="dot" aria-hidden="true"></span>
        </span>
        <span class="label" id="${t}"><slot></slot></span>
      </label>`;
  }
  // The circle the physics body takes - the control region, not the label
  shape(t, e) {
    const i = Math.min(t, e);
    return { width: i, height: i, radius: i / 2 };
  }
  // Resolve the control fill for the current state through the live theme tokens
  fill() {
    return this.checked ? this.resolveColor(`var(--jelly-on, ${b["background-accent"]})`) : this.resolveColor(`var(--jelly-fill, ${b["background-neutral"]})`);
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.control = this.shadowRoot.querySelector(".control"), this.wrap = this.shadowRoot.querySelector(".wrap"), this.reflect(), this.sync("label"), this.trackFocus(this.control), this.wrap.addEventListener("click", () => this.select(!0)), this.control.addEventListener("keydown", (t) => this.onKeydown(t)), queueMicrotask(() => this.ensureTabbable());
  }
  // Kick the scale spring: +v expands (select), -v collapses (deselect)
  pop(t) {
    this.reducedMotion || (this.scaleVelocity += t, this.requestFrame());
  }
  // One animation step: advance the scale spring and repaint. True keeps animating.
  frame(t) {
    const e = this.body;
    return e ? ([this.scale, this.scaleVelocity] = E(this.scale, this.scaleVelocity, 1, 260, 17, t), this.clearCanvas(), this.paintBody(e, { fill: this.fill(), scaleX: this.scale, scaleY: this.scale, ring: this.focusRing() }), Math.abs(1 - this.scale) > 15e-4 || Math.abs(this.scaleVelocity) > 15e-4) : !1;
  }
  // Every radio sharing this name under the same root (document or shadow root)
  group() {
    const t = this.getAttribute("name");
    return t ? [...this.getRootNode().querySelectorAll(`jelly-radio[name="${CSS.escape(t)}"]`)] : [this];
  }
  // With no selection yet, the first enabled radio becomes the group's tab stop
  ensureTabbable() {
    const t = this.group();
    if (t.some((i) => i.checked && !i.hasAttribute("disabled")))
      return;
    const e = t.find((i) => !i.hasAttribute("disabled"));
    e && e.control && (e.control.tabIndex = 0);
  }
  // Select this radio, deselecting the rest of its group
  select(t = !1) {
    if (!this.hasAttribute("disabled")) {
      for (const e of this.group())
        e !== this && (t && e.checked && e.pop && e.pop(-2.5), e.checked = !1);
      this.checked = !0, t && (this.pop(4), T(), g(this, "change"));
    }
  }
  // Keyboard: Space / Enter select; arrows and Home / End move the selection
  onKeydown(t) {
    if (t.key === " " || t.key === "Enter") {
      t.preventDefault(), this.select(!0);
      return;
    }
    const e = this.group().filter((o) => !o.hasAttribute("disabled")), i = e.indexOf(this);
    if (i === -1)
      return;
    const s = kt(t.key, i, e.length, { rtl: k(this) });
    if (s === -1)
      return;
    t.preventDefault();
    const r = e[s];
    r.control.focus(), r.select(!0);
  }
  // Mirror state into ARIA, the roving tabindex and the submitted form value
  reflect() {
    const t = this.checked, e = this.hasAttribute("disabled");
    this.control.setAttribute("aria-checked", String(t)), this.control.setAttribute("aria-disabled", String(e)), this.control.tabIndex = e ? -1 : t ? 0 : -1, this.removeAttribute("tabindex"), this.internals.setFormValue(t ? this.value : null);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.control && this.sync(t);
  }
  // Push one observed attribute into the inner control
  sync(t) {
    switch (t) {
      case "checked":
      case "value":
        this.reflect(), this.requestFrame();
        break;
      case "disabled":
        this.reflect(), queueMicrotask(() => this.ensureTabbable()), this.requestFrame();
        break;
      case "size":
        j(this);
        break;
      case "label": {
        const e = this.getAttribute("label");
        e ? this.control.setAttribute("aria-label", e) : this.control.removeAttribute("aria-label");
        break;
      }
    }
  }
  // Whether this radio is currently selected (reflects the attribute)
  get checked() {
    return this.hasAttribute("checked");
  }
  set checked(t) {
    this.toggleAttribute("checked", !!t);
  }
  // The form value submitted while selected (defaults to "on", like native)
  get value() {
    return this.getAttribute("value") || "on";
  }
  set value(t) {
    this.setAttribute("value", String(t));
  }
  // Route programmatic host focus into the inner control
  focus(t) {
    this.control?.focus(t);
  }
}
customElements.define("jelly-radio", Fe);
const Ie = ':host{display:block;--jelly-radio-group-font-size: 13.5px;--jelly-radio-group-column-gap: 20px;--jelly-radio-group-row-gap: 14px;--jelly-radio-group-legend-gap: 10px;--jelly-radio-group-legend-color: var(--jelly-color-foreground-muted)}:host([size="small"]),:host([size="sm"]){--jelly-radio-group-font-size: 12px;--jelly-radio-group-column-gap: 16px;--jelly-radio-group-row-gap: 10px;--jelly-radio-group-legend-gap: 8px}:host([size="medium"]),:host([size="md"]){--jelly-radio-group-font-size: 13.5px;--jelly-radio-group-column-gap: 20px;--jelly-radio-group-row-gap: 14px;--jelly-radio-group-legend-gap: 10px}:host([size="large"]),:host([size="lg"]){--jelly-radio-group-font-size: 15px;--jelly-radio-group-column-gap: 24px;--jelly-radio-group-row-gap: 16px;--jelly-radio-group-legend-gap: 12px}.legend{font:650 var(--jelly-radio-group-font-size)/1.3 var(--jelly-font-display);color:var(--jelly-radio-group-legend-color);margin-block-end:var(--jelly-radio-group-legend-gap)}.legend:empty{display:none}.items{display:flex;gap:var(--jelly-radio-group-row-gap) var(--jelly-radio-group-column-gap);flex-wrap:wrap}:host([direction="vertical"]) .items{flex-direction:column}';
class Be extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.legendId = "";
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["label", "direction", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), this.built || this.build(), this.syncLabel(), q(this, "jelly-radio");
  }
  // Render the shadow DOM once
  build() {
    this.built = !0, this.legendId = X("jelly-radio-group-legend"), this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `
      <style>${Ie}</style>
      <div class="legend" part="legend" id="${this.legendId}"></div>
      <div class="items" part="items" role="radiogroup"><slot></slot></div>`, this.legend = this.shadowRoot.querySelector(".legend"), this.items = this.shadowRoot.querySelector(".items"), this.slotEl = this.shadowRoot.querySelector("slot"), this.slotEl.addEventListener("slotchange", () => q(this, "jelly-radio"));
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.built && (t === "label" ? this.syncLabel() : t === "size" && (j(this), q(this, "jelly-radio")));
  }
  // Show the legend text and link it to the group as its accessible name
  syncLabel() {
    const t = this.getAttribute("label") || "";
    this.legend.textContent = t, t ? this.items.setAttribute("aria-labelledby", this.legendId) : this.items.removeAttribute("aria-labelledby");
  }
}
customElements.define("jelly-radio-group", Be);
const Re = ':host{display:inline-flex;--jelly-switch-width: 62px;--jelly-switch-height: 34px;--jelly-switch-gap: 12px;--jelly-switch-font-size: 15.5px;--jelly-off: var(--jelly-color-background-neutral);--jelly-on: var(--jelly-color-background-accent);--jelly-switch-thumb-off: var(--jelly-color-background-white);--jelly-switch-thumb-on: var(--jelly-color-background-white);--jelly-ring: var(--jelly-on, var(--jelly-color-border-focus));--jelly-label: var(--jelly-color-foreground-muted);font:600 var(--jelly-switch-font-size)/1.2 var(--jelly-font-display)}:host([size="small"]),:host([size="sm"]){--jelly-switch-width: 50px;--jelly-switch-height: 28px;--jelly-switch-gap: 10px;--jelly-switch-font-size: 14px}:host([size="medium"]),:host([size="md"]){--jelly-switch-width: 62px;--jelly-switch-height: 34px;--jelly-switch-gap: 12px;--jelly-switch-font-size: 15.5px}:host([size="large"]),:host([size="lg"]){--jelly-switch-width: 74px;--jelly-switch-height: 40px;--jelly-switch-gap: 14px;--jelly-switch-font-size: 16.5px}:host([disabled]){opacity:.5;pointer-events:none}.wrap{display:inline-flex;align-items:center;gap:var(--jelly-switch-gap);cursor:pointer;position:relative;touch-action:manipulation}input{position:absolute;inset-inline-start:0;top:50%;width:var(--jelly-switch-width);height:var(--jelly-switch-height);transform:translateY(-50%);margin:0;opacity:0;pointer-events:none}.track{position:relative;width:var(--jelly-switch-width);height:var(--jelly-switch-height);flex:0 0 auto;touch-action:none;transition:width .42s cubic-bezier(.4,0,.2,1),height .42s cubic-bezier(.4,0,.2,1)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .track{transition:none}}:host-context([data-jelly-motion="reduce"]) .track{transition:none}.track:after{content:"";position:absolute;inset:-2px;border:var(--jelly-ring-width) solid transparent;border-radius:999px;pointer-events:none}.label{color:var(--jelly-label)}.label:empty{display:none}@media(forced-colors:active){.track{border:1px solid ButtonBorder;border-radius:999px}input:focus-visible+.track:after{border-color:Highlight}}', Pe = {
  small: { width: 50, height: 28, inset: 4, gap: 10, font: "14px" },
  medium: { width: 62, height: 34, inset: 5, gap: 12, font: "15.5px" },
  large: { width: 74, height: 40, inset: 6, gap: 14, font: "16.5px" }
};
class He extends L {
  constructor() {
    super(), this.thumbBody = null, this.thumbX = 0, this.thumbXVelocity = 0, this.thumbTarget = 0, this.dragging = !1, this.pointerId = null, this.downX = 0, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["checked", "disabled", "label", "size", "value"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Re + R({ color: "--jelly-on", on: "--jelly-switch-thumb-on" });
  }
  // The interactive markup that sits above the canvas
  content() {
    return `
      <label class="wrap" part="wrap">
        <input type="checkbox" role="switch" part="input" />
        <span class="track" data-jelly-box part="track" aria-hidden="true"></span>
        <span class="label"><slot></slot></span>
      </label>`;
  }
  // The capsule the physics body takes - the track region, not the label
  shape(t = this.sizeConfig.width, e = this.sizeConfig.height) {
    return { width: t, height: e, radius: e / 2 };
  }
  // The canonical size name, accepting the sm / md / lg aliases
  get sizeKey() {
    return Pt(this);
  }
  // The geometry row for the current size
  get sizeConfig() {
    return Pe[this.sizeKey];
  }
  // The live track dimensions (physics body if built, size table otherwise)
  get trackSize() {
    return {
      width: this.body?.width || this.sizeConfig.width,
      height: this.body?.height || this.sizeConfig.height
    };
  }
  // How far the thumb center travels between its two resting points
  get travel() {
    const { width: t, height: e } = this.trackSize;
    return t - e;
  }
  // The thumb's resting offset for a checked state - "on" sits at the inline end
  targetFor(t) {
    const e = k(this) ? -1 : 1;
    return (t ? 1 : -1) * e * (this.travel / 2);
  }
  // Normalized travel from the visual off edge (0) to the on edge (1)
  slideProgress() {
    const t = Math.max(this.travel / 2, 1), e = k(this) ? -1 : 1;
    return m((this.thumbX * e / t + 1) / 2, 0, 1);
  }
  /*
   * The track color for the current thumb position. The off / on endpoints
   * are re-resolved through the live theme tokens on every paint - so theme
   * flips, variant changes and token overrides (including rgb() and named
   * colors) recolor the track mid-slide - then blended by the thumb's
   * progress toward the "on" end, which is the inline end in both directions.
   */
  trackFill() {
    return this.mixColor(
      "var(--jelly-off)",
      "var(--jelly-on)",
      this.slideProgress()
    );
  }
  // The thumb stays white as it slides (off and on both default to the white
  // token), like a physical knob, so it reads consistently across themes and
  // accents. Variants can still override --jelly-switch-thumb-on for contrast.
  thumbFill() {
    return this.mixColor(
      "var(--jelly-switch-thumb-off)",
      "var(--jelly-switch-thumb-on)",
      this.slideProgress()
    );
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.input = this.shadowRoot.querySelector("input"), this.track = this.shadowRoot.querySelector(".track"), this.sync("checked"), this.sync("disabled"), this.sync("label"), this.useHostFocusTarget(this.input), this.trackFocus(this.input), this.input.addEventListener("click", (t) => t.preventDefault()), this.shadowRoot.querySelector(".label").addEventListener("click", () => {
      this.hasAttribute("disabled") || this.setChecked(!this.checked, !0);
    }), this.input.addEventListener("keydown", (t) => {
      (t.key === " " || t.key === "Enter") && (t.preventDefault(), this.setChecked(!this.checked, !0));
    }), this.track.addEventListener("pointerdown", (t) => this.onDown(t)), this.track.addEventListener("pointermove", (t) => this.onMove(t)), this.track.addEventListener("pointerup", (t) => this.onUp(t)), this.track.addEventListener("pointercancel", (t) => this.onUp(t)), this.track.addEventListener("lostpointercapture", (t) => this.onUp(t));
  }
  // Called whenever the shape (re)builds: size the thumb and seat it in place
  onShape() {
    const { height: t } = this.trackSize, e = t - this.sizeConfig.inset * 2;
    this.thumbBody ? this.thumbBody.resize(e, e, e / 2) : this.thumbBody = new D({ width: e, height: e, radius: e / 2 }), this.thumbTarget = this.targetFor(this.checked), this.thumbX = this.thumbTarget, this.thumbXVelocity = 0, this.requestFrame();
  }
  // Press: capture the pointer and dent the track where the finger lands
  onDown(t) {
    if (!this.hasAttribute("disabled")) {
      this.pointerId = t.pointerId, this.dragging = !1, this.downX = t.clientX;
      try {
        this.track.setPointerCapture(t.pointerId);
      } catch {
      }
      this.pressAt(t.clientX, t.clientY, 0.8), this.requestFrame();
    }
  }
  // Drag: after a small slop the thumb follows the finger along the track
  onMove(t) {
    if (this.pointerId !== t.pointerId || (Math.abs(t.clientX - this.downX) > 4 && (this.dragging = !0), !this.dragging))
      return;
    const e = this.toLocal(t.clientX, t.clientY), i = this.travel / 2;
    this.thumbTarget = m(e.x, -i, i), this.requestFrame();
  }
  // Release: a drag settles to whichever side the thumb is on; a tap toggles
  onUp(t) {
    if (this.pointerId !== t.pointerId)
      return;
    this.pointerId = null;
    try {
      this.track.releasePointerCapture(t.pointerId);
    } catch {
    }
    this.releaseBody();
    const e = k(this) ? this.thumbX < 0 : this.thumbX > 0, i = this.dragging ? e : !this.checked;
    this.setChecked(i, !0), this.dragging = !1;
  }
  // Move to a checked state, animating and emitting only on real user changes
  setChecked(t, e = !1) {
    const i = t !== this.checked;
    if (this.checked = t, this.thumbTarget = this.targetFor(t), e && i) {
      if (!this.reducedMotion && this.thumbBody) {
        const s = k(this) ? -1 : 1;
        this.thumbBody.stretchAlong((t ? 1 : -1) * s, 0, 0.9);
      }
      T(), g(this, "change");
    }
    this.requestFrame();
  }
  // One animation step: slide the thumb, advance both bodies, repaint
  frame(t) {
    const e = this.body, i = this.thumbBody;
    if (!e || !i)
      return !1;
    const s = this.thumbX;
    this.reducedMotion ? (this.thumbX = this.thumbTarget, this.thumbXVelocity = 0) : [this.thumbX, this.thumbXVelocity] = E(this.thumbX, this.thumbXVelocity, this.thumbTarget, 300, 26, t);
    const r = Math.abs(this.thumbXVelocity);
    r > 6 && (i.lean = Math.sign(this.thumbXVelocity)), i.leanAmount = this.reducedMotion ? 0 : Math.min(i.height * 0.34, r * 0.014), !this.reducedMotion && Math.abs(this.thumbX - s) > 0.01 && e.pulseAt(this.thumbX, -this.trackSize.height / 2, 0.02 * Math.min(3, r / 120)), e.update(t), i.update(t), this.clearCanvas(), this.paintBody(e, { fill: this.trackFill(), ring: this.focusRing(), easeKey: "track" }), this.paintBody(i, {
      fill: this.thumbFill(),
      cx: this.thumbX,
      easeKey: "thumb"
    });
    const o = Math.abs(this.thumbTarget - this.thumbX) < 0.2 && Math.abs(this.thumbXVelocity) < 0.5;
    return !(e.isResting() && i.isResting() && o) || this.pointerId != null;
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (t === "size") {
      this.built && this.applyShape();
      return;
    }
    this.input && this.sync(t);
  }
  // Push one observed attribute into the hidden native input
  sync(t) {
    switch (t) {
      case "checked":
        this.input.checked = this.checked, this.input.setAttribute("aria-checked", String(this.checked)), this.internals.setFormValue(this.checked ? this.value : null), this.thumbTarget = this.targetFor(this.checked), this.requestFrame();
        break;
      case "value":
        this.internals.setFormValue(this.checked ? this.value : null);
        break;
      case "disabled":
        this.input.disabled = this.hasAttribute("disabled"), this.syncHostFocusTarget();
        break;
      case "label": {
        const e = this.getAttribute("label");
        e ? this.input.setAttribute("aria-label", e) : this.input.removeAttribute("aria-label");
        break;
      }
    }
  }
  // Whether the switch is currently on (reflects the attribute)
  get checked() {
    return this.hasAttribute("checked");
  }
  set checked(t) {
    this.toggleAttribute("checked", !!t);
  }
  // The form value submitted while on (defaults to "on", like native)
  get value() {
    return this.getAttribute("value") || "on";
  }
  set value(t) {
    this.setAttribute("value", String(t));
  }
  // Route programmatic host focus into the hidden native input
  focus(t) {
    this.input?.focus(t);
  }
}
customElements.define("jelly-switch", He);
const Ve = ':host{--jelly-slider-track-height: 12px;--jelly-track: var(--jelly-color-background-neutral);--jelly-accent: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-accent, var(--jelly-color-border-focus));display:inline-block;width:240px;height:36px;outline:none}:host([size="small"]){--jelly-slider-track-height: 9px;width:200px;height:30px}:host([size="medium"]){--jelly-slider-track-height: 12px;width:240px;height:36px}:host([size="large"]){--jelly-slider-track-height: 14px;width:300px;height:44px}:host([disabled]){opacity:.5;pointer-events:none}.wrap{position:relative;width:100%;height:100%}input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none}.track{position:absolute;inset-inline:0;top:50%;transform:translateY(-50%);height:var(--jelly-slider-track-height);touch-action:none}.track:before{content:"";position:absolute;inset-inline:0;top:50%;transform:translateY(-50%);height:max(100%,24px)}@media(forced-colors:active){.jelly-canvas,.track{display:none}input{opacity:1;pointer-events:auto}}', De = {
  small: { width: 200, height: 30, thumb: 24, track: 9 },
  medium: { width: 240, height: 36, thumb: 28, track: 12 },
  large: { width: 300, height: 44, thumb: 34, track: 14 }
}, $e = {
  membraneSpring: 82,
  membraneDamping: 14,
  waveCoupling: 170,
  pressure: 700,
  volumeCorrection: 0.14,
  insideLocalBulgeImpulse: 330,
  rippleWidth: 10
};
class qe extends L {
  constructor() {
    super(), this.thumbBody = null, this.thumbX = 0, this.thumbXVelocity = 0, this.thumbTarget = 0, this.dragging = !1, this.pointerId = null, this.pressScale = 1, this.pressScaleVelocity = 0, this.trackW = 0, this.trackH = 0, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "min", "max", "step", "label", "disabled", "size"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Ve + R({ color: "--jelly-accent" });
  }
  // The interactive markup that sits above the canvas
  content() {
    return `
      <div class="wrap" part="wrap">
        <input type="range" part="input" />
        <span class="track" part="track" data-jelly-box aria-hidden="true"></span>
      </div>`;
  }
  // The base jelly body is the track capsule; the thumb body rides on top
  shape(t, e) {
    const i = e || this.sizeConfig.track;
    return { width: t, height: i, radius: i / 2 };
  }
  // The canonical size name, defaulting to medium
  get sizeKey() {
    const t = (this.getAttribute("size") || "medium").toLowerCase();
    return t === "small" || t === "large" ? t : "medium";
  }
  // The geometry record for the current size
  get sizeConfig() {
    return De[this.sizeKey];
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.input = this.shadowRoot.querySelector("input"), this.track = this.shadowRoot.querySelector(".track"), this.input.min = this.getAttribute("min") ?? "0", this.input.max = this.getAttribute("max") ?? "100", this.input.step = this.getAttribute("step") ?? "1", this.input.value = this.getAttribute("value") ?? "50", this.input.disabled = this.hasAttribute("disabled"), this.syncLabel(), this.syncA11y(), this.internals.setFormValue(this.input.value), this.trackFocus(this.input), this.input.addEventListener("input", this), this.input.addEventListener("keydown", this), this.track.addEventListener("pointerdown", this), this.track.addEventListener("pointermove", this), this.track.addEventListener("pointerup", this), this.track.addEventListener("pointercancel", this);
  }
  // Route the inner-control events registered with `this` as the listener
  handleEvent(t) {
    switch (t.type) {
      case "input":
        this.updateFromInput();
        break;
      case "keydown":
        this.onKey(t);
        break;
      case "pointerdown":
        this.onDown(t);
        break;
      case "pointermove":
        this.onMove(t);
        break;
      case "pointerup":
      case "pointercancel":
        this.onUp(t);
        break;
    }
  }
  // Rebuild the thumb body whenever the track shape (re)builds
  onShape() {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width, this.trackH = this.body ? this.body.height : this.sizeConfig.track;
    const t = this.sizeConfig.thumb;
    this.thumbBody ? this.thumbBody.resize(t, t, t / 2) : this.thumbBody = new D({ width: t, height: t, radius: t / 2, config: $e }), this.thumbTarget = this.valueToX(), this.thumbX = this.thumbTarget, this.thumbXVelocity = 0;
  }
  // How far the thumb center can travel along the track, in pixels
  get travel() {
    return Math.max(0, this.trackW - this.sizeConfig.thumb);
  }
  // The current value as a 0..1 fraction of the min → max span
  fraction() {
    const t = +this.input.min, i = +this.input.max - t || 1;
    return (this.input.valueAsNumber - t) / i;
  }
  // The thumb's physical canvas x for the current value - mirrored in RTL,
  // where the value origin sits at the right edge
  valueToX() {
    const t = -this.travel / 2 + this.fraction() * this.travel;
    return k(this) ? -t : t;
  }
  // Reflect the input's value into the thumb target, ARIA and the form
  updateFromInput() {
    this.thumbTarget = this.valueToX(), this.syncA11y(), this.internals.setFormValue(this.input.value), this.requestFrame();
  }
  // Map the label attribute onto the hidden input's accessible name
  syncLabel() {
    const t = this.getAttribute("label");
    t ? this.input.setAttribute("aria-label", t) : this.input.removeAttribute("aria-label");
  }
  // Keep the hidden input's tab order and ARIA value state in sync
  syncA11y() {
    const t = this.hasAttribute("disabled");
    this.input.tabIndex = t ? -1 : 0, this.removeAttribute("tabindex"), this.input.setAttribute("aria-valuemin", this.input.min), this.input.setAttribute("aria-valuemax", this.input.max), this.input.setAttribute("aria-valuenow", this.input.value), this.input.setAttribute("aria-disabled", String(t));
  }
  // Set the value from a pointer position, honoring reading direction
  setFromClientX(t) {
    const e = this.toLocal(t, 0), i = this.travel / 2 || 1;
    let s = m((e.x + i) / (i * 2), 0, 1);
    k(this) && (s = 1 - s);
    const r = +this.input.min, o = +this.input.max;
    this.input.value = String(r + s * (o - r)), this.updateFromInput(), g(this, "input");
  }
  // Step the value by direction × step (× the Shift multiplier), clamped
  setFromStep(t, e = 1) {
    const i = +this.input.min || 0, s = +this.input.max || 100, r = s - i || 1, o = parseFloat(this.input.step), l = Number.isFinite(o) && o > 0 ? o : r / 100, d = Number.isFinite(this.input.valueAsNumber) ? this.input.valueAsNumber : i, h = m(d + t * l * e, i, s);
    this.input.value = String(Number(h.toFixed(10))), this.updateFromInput(), g(this, "input");
  }
  // Keyboard stepping: arrows follow reading direction, Shift ×10, Home / End jump
  onKey(t) {
    let e = O(t.key, k(this));
    if (e === 0 && t.key === "ArrowUp" && (e = 1), e === 0 && t.key === "ArrowDown" && (e = -1), e !== 0) {
      t.preventDefault(), this.setFromStep(e, t.shiftKey ? 10 : 1), g(this, "change");
      return;
    }
    (t.key === "Home" || t.key === "End") && (t.preventDefault(), this.input.value = t.key === "Home" ? this.input.min : this.input.max, this.updateFromInput(), g(this, "input"), g(this, "change"));
  }
  // Begin a drag on the track: capture the pointer and jump to the press point
  onDown(t) {
    if (!this.hasAttribute("disabled")) {
      this.dragging = !0, this.pointerId = t.pointerId;
      try {
        this.track.setPointerCapture(t.pointerId);
      } catch {
      }
      this.setFromClientX(t.clientX), !this.reducedMotion && this.thumbBody && this.thumbBody.centerPop(1), T();
    }
  }
  // Follow the captured pointer while a drag is active
  onMove(t) {
    !this.dragging || this.pointerId !== t.pointerId || this.setFromClientX(t.clientX);
  }
  // End the drag: release capture, let the thumb settle, commit the change
  onUp(t) {
    if (this.pointerId === t.pointerId) {
      this.dragging = !1, this.pointerId = null;
      try {
        this.track.releasePointerCapture(t.pointerId);
      } catch {
      }
      this.thumbBody?.release(), g(this, "change"), this.requestFrame();
    }
  }
  // One animation step: advance the travel spring, repaint track, fill and thumb
  frame(t) {
    const e = this.thumbBody;
    if (!e)
      return !1;
    this.reducedMotion ? (this.thumbX = this.thumbTarget, this.thumbXVelocity = 0) : [this.thumbX, this.thumbXVelocity] = E(this.thumbX, this.thumbXVelocity, this.thumbTarget, 310, 22, t);
    const i = Math.abs(this.thumbXVelocity);
    i > 6 && (e.lean = Math.sign(this.thumbXVelocity));
    const s = this.reducedMotion ? 0 : Math.min(1, i / 550);
    e.leanAmount = this.reducedMotion ? 0 : Math.min(e.height * 0.12, i * 45e-4);
    const o = ((this.dragging && !this.reducedMotion ? 1.12 : 1) - this.pressScale) * 420 - this.pressScaleVelocity * 28;
    this.pressScaleVelocity += o * t, this.pressScale += this.pressScaleVelocity * t;
    const l = (1 + s * 0.32) * this.pressScale, d = 1 / Math.sqrt(1 + s * 0.32) * this.pressScale;
    e.update(t);
    const h = this.ctx, a = this.cssW / 2, c = this.cssH / 2, p = this.trackW, u = this.trackH || this.sizeConfig.track, f = this.resolveColor(`var(--jelly-track, ${b["background-neutral"]})`), C = this.resolveColor(`var(--jelly-accent, ${b["background-accent"]})`);
    return this.clearCanvas(), h.save(), h.beginPath(), h.roundRect(a - p / 2, c - u / 2, p, u, u / 2), h.fillStyle = f, h.fill(), h.clip(), h.fillStyle = C, k(this) ? h.fillRect(a + this.thumbX, c - u / 2, p / 2 - this.thumbX, u) : h.fillRect(a - p / 2, c - u / 2, this.thumbX + p / 2, u), h.restore(), this.paintBody(e, {
      fill: C,
      cx: this.thumbX,
      scaleX: l,
      scaleY: d,
      ring: this.focusRing()
    }), !(e.isResting() && Math.abs(this.thumbTarget - this.thumbX) < 0.2 && Math.abs(this.thumbXVelocity) < 0.5 && Math.abs(this.pressScale - 1) < 1e-3 && Math.abs(this.pressScaleVelocity) < 1e-3) || this.dragging;
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this), this.input && this.sync(t, this.getAttribute(t));
  }
  // Push one observed attribute into the hidden native input, then re-sync
  sync(t, e) {
    switch (t) {
      case "value":
        this.input.value = e ?? "50";
        break;
      case "min":
        this.input.min = e ?? "0";
        break;
      case "max":
        this.input.max = e ?? "100";
        break;
      case "step":
        this.input.step = e ?? "1";
        break;
      case "label":
        this.syncLabel();
        break;
      case "disabled":
        this.input.disabled = this.hasAttribute("disabled");
        break;
      case "size":
        this.applyShape();
        break;
    }
    this.updateFromInput();
  }
  // The current value (read live from the inner control once built)
  get value() {
    return this.input ? this.input.value : this.getAttribute("value") || "50";
  }
  // Set the value and reflect it into the thumb, ARIA and the form
  set value(t) {
    this.input && (this.input.value = t, this.updateFromInput());
  }
  // Route programmatic host focus into the hidden native input
  focus(t) {
    this.input?.focus(t);
  }
}
customElements.define("jelly-slider", qe);
const Xe = ':host{--jelly-range-track-height: 12px;--jelly-range-thumb-size: 28px;--jelly-track: var(--jelly-color-background-neutral);--jelly-accent: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-accent, var(--jelly-color-border-focus));display:inline-block;width:260px;height:36px;outline:none}:host([size="small"]){--jelly-range-track-height: 9px;--jelly-range-thumb-size: 24px;width:220px;height:30px}:host([size="medium"]){--jelly-range-track-height: 12px;--jelly-range-thumb-size: 28px;width:260px;height:36px}:host([size="large"]){--jelly-range-track-height: 14px;--jelly-range-thumb-size: 34px;width:320px;height:44px}:host([disabled]){opacity:.5;pointer-events:none}.wrap{position:relative;width:100%;height:100%}.track{position:absolute;inset-inline:0;top:50%;transform:translateY(-50%);height:var(--jelly-range-track-height);touch-action:none}.track:before{content:"";position:absolute;inset-inline:0;top:50%;transform:translateY(-50%);height:max(100%,24px)}.knob{position:absolute;top:50%;width:var(--jelly-range-thumb-size);height:var(--jelly-range-thumb-size);transform:translateY(-50%);border-radius:50%;outline:none;cursor:grab;touch-action:none}.knob:active{cursor:grabbing}@media(forced-colors:active){.jelly-canvas{display:none}.track{background:ButtonText;border-radius:999px}.knob{background:ButtonFace;border:1px solid ButtonText}.knob:focus-visible{outline:2px solid Highlight;outline-offset:2px}}', Oe = {
  small: { width: 220, height: 30, thumb: 24, track: 9 },
  medium: { width: 260, height: 36, thumb: 28, track: 12 },
  large: { width: 320, height: 44, thumb: 34, track: 14 }
}, We = {
  membraneSpring: 82,
  membraneDamping: 14,
  waveCoupling: 170,
  pressure: 700,
  volumeCorrection: 0.14,
  insideLocalBulgeImpulse: 330,
  rippleWidth: 10
};
class Ne extends L {
  constructor() {
    super(), this.thumbs = null, this.val = [], this.x = [0, 0], this.xVelocity = [0, 0], this.target = [0, 0], this.pressScale = [1, 1], this.pressScaleVelocity = [0, 0], this.active = 1, this.drag = null, this.pointerId = null, this.windowBound = !1, this.trackW = 0, this.trackH = 0, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["min", "max", "step", "low", "high", "label", "disabled", "size"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Xe + R({ color: "--jelly-accent" });
  }
  // The interactive markup that sits above the canvas
  content() {
    return `
      <div class="wrap" part="wrap">
        <span class="track" part="track" data-jelly-box aria-hidden="true"></span>
        <span class="knob" part="knob" data-k="0" role="slider" tabindex="0"></span>
        <span class="knob" part="knob" data-k="1" role="slider" tabindex="0"></span>
      </div>`;
  }
  // The base jelly body is the track capsule; the thumbs ride on top
  shape(t, e) {
    const i = e || this.sizeConfig.track;
    return { width: t, height: i, radius: i / 2 };
  }
  // The canonical size name, defaulting to medium
  get sizeKey() {
    const t = (this.getAttribute("size") || "medium").toLowerCase();
    return t === "small" || t === "large" ? t : "medium";
  }
  // The geometry record for the current size
  get sizeConfig() {
    return Oe[this.sizeKey];
  }
  // The numeric lower bound of the whole range
  get min() {
    return V(this, "min", 0);
  }
  // The numeric upper bound of the whole range
  get max() {
    return V(this, "max", 100);
  }
  // The step increment (always positive)
  get step() {
    const t = V(this, "step", 1);
    return t > 0 ? t : 1;
  }
  // How far a thumb center can travel along the track, in pixels
  get travel() {
    return Math.max(0, this.trackW - this.sizeConfig.thumb);
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.track = this.shadowRoot.querySelector(".track"), this.knobs = [...this.shadowRoot.querySelectorAll(".knob")], this.val = [
      V(this, "low", this.min),
      V(this, "high", this.max)
    ], this.normalizeValues(), this.track.addEventListener("pointerdown", this);
    for (const t of this.knobs)
      t.addEventListener("pointerdown", this), t.addEventListener("keydown", this), t.addEventListener("focus", this), t.addEventListener("blur", this);
    this.syncA11y(), this.syncFormValue();
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), this.unbindWindow(), this.drag = null, this.pointerId = null;
  }
  // Route knob-, track- and window-level events registered with `this`
  handleEvent(t) {
    switch (t.type) {
      case "pointerdown":
        this.down(t, this.knobIndex(t));
        break;
      case "pointermove":
        this.move(t);
        break;
      case "pointerup":
      case "pointercancel":
        this.up(t);
        break;
      case "keydown":
        this.key(t, this.knobIndex(t));
        break;
      case "focus":
        this.focusKnob(t);
        break;
      case "blur":
        this.blurKnob();
        break;
    }
  }
  // The knob index an event was wired on, or null for the track / window
  knobIndex(t) {
    const e = t.currentTarget?.dataset?.k;
    return e == null ? null : +e;
  }
  // Rebuild the two thumb bodies and settle them onto their targets
  onShape() {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width, this.trackH = this.body ? this.body.height : this.sizeConfig.track;
    const t = this.sizeConfig.thumb;
    this.thumbs ? this.thumbs.forEach((e) => e.resize(t, t, t / 2)) : this.thumbs = [0, 1].map(() => new D({ width: t, height: t, radius: t / 2, config: We })), this.target = this.val.map((e) => this.valToX(e)), this.x = [...this.target], this.xVelocity = [0, 0], this.reflectKnobs(), this.syncA11y(), this.requestFrame();
  }
  // A value as a 0..1 fraction of the min → max span
  fraction(t) {
    return (t - this.min) / (this.max - this.min || 1);
  }
  // A value's logical x-offset from the track center (+ toward the inline end)
  logicalX(t) {
    return -this.travel / 2 + this.fraction(t) * this.travel;
  }
  // A value's physical canvas x - mirrored in RTL, where values grow leftward
  valToX(t) {
    const e = this.logicalX(t);
    return k(this) ? -e : e;
  }
  // A physical canvas x back to a stepped value, honoring reading direction
  xToVal(t) {
    const e = this.travel / 2 || 1;
    let i = m((t + e) / (e * 2), 0, 1);
    k(this) && (i = 1 - i);
    const s = this.min + i * (this.max - this.min);
    return Math.round(s / this.step) * this.step;
  }
  // Clamp both values into [min, max] and keep low ≤ high
  normalizeValues() {
    const t = this.min, e = this.max, i = Number.isFinite(this.val?.[0]) ? this.val[0] : t, s = Number.isFinite(this.val?.[1]) ? this.val[1] : e;
    this.val = [
      m(Math.min(i, s), t, e),
      m(Math.max(i, s), t, e)
    ];
  }
  // Re-derive targets, knob placement, ARIA and the form value after a bound change
  syncValueState() {
    this.val && (this.normalizeValues(), this.body && (this.target = this.val.map((t) => this.valToX(t))), this.reflectKnobs(), this.syncA11y(), this.syncFormValue(), this.requestFrame());
  }
  // Set one bound (0 = low, 1 = high), clamped against the other and reflect it
  setVal(t, e, i = !1) {
    Number.isFinite(e) && (e = m(e, this.min, this.max), e = t === 0 ? Math.min(e, this.val[1]) : Math.max(e, this.val[0]), e !== this.val[t] && (this.val[t] = e, this.target[t] = this.valToX(e), this.active = t, this.reflectKnobs(), this.syncA11y(), this.syncFormValue(), i && g(this, "input"), this.requestFrame()));
  }
  // Place the knobs along the track via direction-aware inset-inline-start
  reflectKnobs() {
    if (!this.knobs || !Number.isFinite(this.trackW))
      return;
    const t = this.sizeConfig.thumb;
    this.knobs.forEach((e, i) => {
      const s = this.trackW / 2 + this.logicalX(this.val[i]);
      e.style.insetInlineStart = `${s - t / 2}px`;
    });
  }
  // Mirror state onto the two role=slider knobs - they carry all the ARIA
  syncA11y() {
    if (!this.knobs)
      return;
    const t = this.hasAttribute("disabled"), e = this.getAttribute("label");
    this.removeAttribute("tabindex"), this.knobs.forEach((i, s) => {
      const r = s === 0 ? "Minimum" : "Maximum";
      i.tabIndex = t ? -1 : 0, i.setAttribute("aria-label", e ? `${e} ${r.toLowerCase()}` : r), i.setAttribute("aria-valuemin", String(this.min)), i.setAttribute("aria-valuemax", String(this.max)), i.setAttribute("aria-valuenow", String(this.val[s])), i.setAttribute("aria-valuetext", String(this.val[s])), i.setAttribute("aria-disabled", String(t));
    });
  }
  // Mirror the "low,high" value into the host form
  syncFormValue() {
    this.internals.setFormValue(this.val.join(","));
  }
  // The knob index whose thumb sits closest to a physical canvas x
  nearest(t) {
    return Math.abs(t - this.valToX(this.val[0])) <= Math.abs(t - this.valToX(this.val[1])) ? 0 : 1;
  }
  // Attach the window-level drag listeners for the duration of one drag
  bindWindow() {
    this.windowBound || (this.windowBound = !0, window.addEventListener("pointermove", this), window.addEventListener("pointerup", this), window.addEventListener("pointercancel", this));
  }
  // Detach the window-level drag listeners once the drag ends
  unbindWindow() {
    this.windowBound && (this.windowBound = !1, window.removeEventListener("pointermove", this), window.removeEventListener("pointerup", this), window.removeEventListener("pointercancel", this));
  }
  // Begin a drag: pick the pressed (or nearest) knob and jump it to the pointer
  down(t, e) {
    if (this.hasAttribute("disabled"))
      return;
    const i = this.toLocal(t.clientX, 0), s = e ?? this.nearest(i.x);
    this.drag = s, this.active = s, this.pointerId = t.pointerId, this.focus({ preventScroll: !0 }), this.reducedMotion || this.thumbs?.[s]?.centerPop(1), this.setVal(s, this.xToVal(i.x), !0), this.bindWindow(), this.requestFrame(), T();
  }
  // Follow the pointer while a drag is active
  move(t) {
    const e = this.drag;
    if (e == null || this.pointerId !== t.pointerId)
      return;
    const i = this.toLocal(t.clientX, 0);
    this.setVal(e, this.xToVal(i.x), !0);
  }
  // End the drag: release the thumb, detach window listeners, commit the change
  up(t) {
    const e = this.drag;
    e == null || this.pointerId !== t.pointerId || (this.thumbs?.[e]?.release(), this.drag = null, this.pointerId = null, this.unbindWindow(), g(this, "change"), this.requestFrame());
  }
  // Keyboard stepping per knob: arrows follow reading direction, Shift ×10, Home / End
  key(t, e) {
    if (e == null)
      return;
    const i = this.step * (t.shiftKey ? 10 : 1);
    let s = O(t.key, k(this)) * i;
    s === 0 && t.key === "ArrowUp" && (s = i), s === 0 && t.key === "ArrowDown" && (s = -i), t.key === "PageUp" && (s = this.step * 10), t.key === "PageDown" && (s = -this.step * 10);
    let r;
    if (s !== 0)
      r = this.val[e] + s;
    else if (t.key === "Home")
      r = this.min;
    else if (t.key === "End")
      r = this.max;
    else
      return;
    t.preventDefault(), t.stopPropagation(), this.setVal(e, r, !0), g(this, "change");
  }
  // A knob taking keyboard focus becomes the active thumb and shows the ring
  focusKnob(t) {
    const e = t.currentTarget;
    this.focusVisible = e.matches(":focus-visible"), this.active = Number(e.dataset.k), this.requestFrame();
  }
  // Hide the focus ring when the knob loses focus
  blurKnob() {
    this.focusVisible = !1, this.requestFrame();
  }
  // One animation step: advance both thumb springs, repaint track, fill, thumbs
  frame(t) {
    const e = this.thumbs;
    if (!e)
      return !1;
    const i = this.ctx, s = this.cssW / 2, r = this.cssH / 2, o = this.trackW, l = this.trackH || this.sizeConfig.track, d = this.resolveColor(`var(--jelly-track, ${b["background-neutral"]})`), h = this.resolveColor(`var(--jelly-accent, ${b["background-accent"]})`);
    let a = !0;
    for (let u = 0; u < 2; u++) {
      this.reducedMotion ? (this.x[u] = this.target[u], this.xVelocity[u] = 0) : [this.x[u], this.xVelocity[u]] = E(this.x[u], this.xVelocity[u], this.target[u], 310, 22, t);
      const f = Math.abs(this.xVelocity[u]);
      f > 6 && (e[u].lean = Math.sign(this.xVelocity[u])), e[u].leanAmount = this.reducedMotion ? 0 : Math.min(e[u].height * 0.12, f * 45e-4), e[u].update(t), (Math.abs(this.target[u] - this.x[u]) > 0.2 || Math.abs(this.xVelocity[u]) > 0.5 || !e[u].isResting()) && (a = !1);
    }
    this.clearCanvas(), i.save(), i.beginPath(), i.roundRect(s - o / 2, r - l / 2, o, l, l / 2), i.fillStyle = d, i.fill(), i.clip();
    const c = s + this.x[0], p = s + this.x[1];
    i.fillStyle = h, i.fillRect(Math.min(c, p), r - l / 2, Math.abs(p - c), l), i.restore();
    for (let u = 0; u < 2; u++) {
      const f = Math.abs(this.xVelocity[u]), C = this.reducedMotion ? 0 : Math.min(1, f / 550), x = ((this.drag === u && !this.reducedMotion ? 1.12 : 1) - this.pressScale[u]) * 420 - this.pressScaleVelocity[u] * 28;
      this.pressScaleVelocity[u] += x * t, this.pressScale[u] += this.pressScaleVelocity[u] * t;
      const y = 1 + C * 0.32, w = y * this.pressScale[u], S = 1 / Math.sqrt(y) * this.pressScale[u];
      this.paintBody(e[u], {
        fill: h,
        cx: this.x[u],
        scaleX: w,
        scaleY: S,
        easeKey: `thumb${u}`,
        ring: this.active === u ? this.focusRing() : null
      }), (Math.abs(this.pressScale[u] - 1) > 1e-3 || Math.abs(this.pressScaleVelocity[u]) > 1e-3) && (a = !1);
    }
    return !a || this.drag != null;
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this), this.knobs && this.sync(t);
  }
  // Re-derive state from one observed attribute change
  sync(t) {
    switch (t) {
      case "low":
        this.val[0] = V(this, "low", this.min), this.syncValueState();
        break;
      case "high":
        this.val[1] = V(this, "high", this.max), this.syncValueState();
        break;
      case "min":
      case "max":
      case "step":
        this.syncValueState();
        break;
      case "label":
      case "disabled":
        this.syncA11y();
        break;
      case "size":
        this.applyShape();
        break;
    }
  }
  // The current interval, serialized as "low,high"
  get value() {
    return this.val.join(",");
  }
  // Route programmatic host focus into the active knob
  focus(t) {
    this.knobs?.[this.active]?.focus(t);
  }
}
customElements.define("jelly-range", Ne);
class Ke extends HTMLElement {
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "selected", "disabled"];
  }
  // The submitted value: the value attribute, else the trimmed text content
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") ?? "" : (this.textContent ?? "").trim();
  }
  // The human-readable label shown in the trigger and its listbox row
  get label() {
    return (this.textContent ?? "").trim();
  }
  // True when the option cannot be selected
  get disabled() {
    return this.hasAttribute("disabled");
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback() {
    this.closest("jelly-select")?.syncOptions?.();
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    this.style.display = "none", this.closest("jelly-select")?.syncOptions?.();
  }
}
customElements.define("jelly-option", Ke);
const Ye = ':host{--jelly-select-padding-inline: 18px;--jelly-select-font-size: 15.5px;--jelly-select-radius: 16px;--jelly-select-gap: 10px;--jelly-select-chevron-size: 16px;--jelly-select-row-height: 44px;--jelly-select-row-padding-inline: 14px;--jelly-select-row-radius: 11px;--jelly-fill: var(--jelly-color-background-muted);--jelly-label: var(--jelly-color-foreground-default);--jelly-accent: var(--jelly-color-background-accent);--jelly-ring: var(--jelly-accent, var(--jelly-color-border-focus));display:inline-block;width:240px;height:54px;font:600 var(--jelly-select-font-size)/1.2 var(--jelly-font-text)}:host([size="small"]){--jelly-select-padding-inline: 15px;--jelly-select-font-size: 14px;--jelly-select-radius: 14px;--jelly-select-gap: 8px;--jelly-select-chevron-size: 14px;--jelly-select-row-height: 38px;--jelly-select-row-padding-inline: 12px;--jelly-select-row-radius: 9px;width:210px;height:46px}:host([size="medium"]){--jelly-select-padding-inline: 18px;--jelly-select-font-size: 15.5px;--jelly-select-radius: 16px;--jelly-select-gap: 10px;--jelly-select-chevron-size: 16px;--jelly-select-row-height: 44px;--jelly-select-row-padding-inline: 14px;--jelly-select-row-radius: 11px;width:240px;height:54px}:host([size="large"]){--jelly-select-padding-inline: 22px;--jelly-select-font-size: 16.5px;--jelly-select-radius: 18px;--jelly-select-gap: 11px;--jelly-select-chevron-size: 18px;--jelly-select-row-height: 50px;--jelly-select-row-padding-inline: 16px;--jelly-select-row-radius: 13px;width:280px;height:62px}:host([open]){z-index:var(--jelly-dropdown-z-index, 9999)}:host([disabled]){--jelly-fill: var(--jelly-color-background-neutral);opacity:.55;pointer-events:none}.trigger{appearance:none;border:0;margin:0;background:transparent;color:var(--jelly-label);font:inherit;width:100%;height:100%;padding-block:0;padding-inline:var(--jelly-select-padding-inline);display:flex;align-items:center;gap:var(--jelly-select-gap);cursor:pointer;position:relative;border-radius:var(--jelly-select-radius);text-align:start;touch-action:manipulation}.trigger:after{content:"";position:absolute;inset:4px;border:var(--jelly-ring-width) solid transparent;border-radius:var(--jelly-select-radius);pointer-events:none}.trigger:focus-visible{outline:none}.value{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.value.placeholder{color:var(--jelly-color-foreground-muted)}.chevron{width:var(--jelly-select-chevron-size);height:var(--jelly-select-chevron-size);flex:0 0 auto;transition:transform .22s ease}:host([open]) .chevron{transform:rotate(180deg)}.panel{position:absolute;inset-inline-start:0;top:calc(100% + 10px);z-index:9999;opacity:0;visibility:hidden;pointer-events:none;will-change:opacity}.panel[data-side=top]{top:auto;bottom:calc(100% + 10px)}:host([open]) .panel{pointer-events:auto}.panel-canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none}.panel-mask{position:relative;z-index:1;width:100%;height:100%;border-radius:20px;overflow:hidden;clip-path:inset(0 0 100% 0 round 20px);transition:none;will-change:clip-path}.list{margin:0;padding:8px;box-sizing:border-box;list-style:none;width:100%;height:100%;overflow-y:auto}.row{height:var(--jelly-select-row-height);display:flex;align-items:center;gap:10px;padding-block:0;padding-inline:var(--jelly-select-row-padding-inline);border-radius:var(--jelly-select-row-radius);cursor:pointer;color:var(--jelly-label);white-space:nowrap;touch-action:manipulation;will-change:transform,opacity}.row[aria-selected=true]{font-weight:800}.row.active{background:color-mix(in srgb,var(--jelly-accent, var(--jelly-color-background-accent)) 15%,transparent)}.row .tick{margin-inline-start:auto;width:15px;height:15px;color:var(--jelly-accent);opacity:0}.row[aria-selected=true] .tick{opacity:1}.row[aria-disabled=true]{opacity:.4;cursor:not-allowed}@media(forced-colors:active){.trigger:after{border-color:ButtonText}.trigger:focus-visible:after{border-color:Highlight}.panel-mask{border:1px solid CanvasText;background:Canvas}.row.active{background:Highlight;color:HighlightText}}', Ze = 8, xt = 10, K = 20, Je = 8;
class Ge extends L {
  constructor() {
    super(), this.isOpen = !1, this.focused = !1, this.activeIndex = -1, this.selectedIndex = -1, this.options = [], this.panelSide = "bottom", this.openT = 0, this.openTargetVelocity = 0, this.openTarget = 0, this.panelBody = null, this.panelCssW = 0, this.panelCssH = 0, this.mutationObserver = null, this.reflectingValue = !1, this.typeaheadBuffer = "", this.internals = this.attachInternals(), this.instanceId = X("jelly-select");
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["disabled", "label", "placeholder", "size", "value"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return Ye + R({ color: "--jelly-accent" });
  }
  // The interactive markup that sits above the canvas
  content() {
    return `
      <button class="trigger" part="trigger" type="button" role="combobox"
              aria-haspopup="listbox" aria-expanded="false"
              aria-controls="${this.instanceId}-list">
        <span class="value placeholder" part="value"></span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div class="panel" part="panel" data-side="bottom">
        <canvas class="panel-canvas" aria-hidden="true"></canvas>
        <div class="panel-mask" part="panel-mask">
          <ul class="list" id="${this.instanceId}-list" role="listbox" tabindex="-1"></ul>
        </div>
      </div>
      <slot style="display:none"></slot>`;
  }
  // The rounded rectangle the trigger body takes, inset so the wobble stays inside the host
  shape(t, e) {
    const i = t - 8, s = e - 8, r = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-select-radius")), o = Number.isFinite(r) ? Math.min(r, s / 2) : Math.min(16, s / 2);
    return { width: i, height: s, radius: o };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.trigger = this.shadowRoot.querySelector(".trigger"), this.valueEl = this.shadowRoot.querySelector(".value"), this.panel = this.shadowRoot.querySelector(".panel"), this.panelMask = this.shadowRoot.querySelector(".panel-mask"), this.panelCanvas = this.shadowRoot.querySelector(".panel-canvas"), this.panelCtx = this.panelCanvas.getContext("2d"), this.list = this.shadowRoot.querySelector(".list"), this.trigger.disabled = this.hasAttribute("disabled"), this.syncLabel(), this.useHostFocusTarget(this.trigger), this.trigger.addEventListener("pointerdown", this), this.trigger.addEventListener("pointerup", this), this.trigger.addEventListener("pointercancel", this), this.trigger.addEventListener("pointerleave", this), this.trigger.addEventListener("click", this), this.trigger.addEventListener("keydown", this), this.trigger.addEventListener("focus", this), this.trigger.addEventListener("blur", this), this.list.addEventListener("pointermove", this), this.list.addEventListener("click", this), this.mutationObserver = new MutationObserver(() => this.syncOptions()), this.mutationObserver.observe(this, { childList: !0, subtree: !0, characterData: !0 }), this.syncOptions();
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    const t = this.built;
    super.connectedCallback(), t && this.mutationObserver && (this.mutationObserver.observe(this, { childList: !0, subtree: !0, characterData: !0 }), this.syncOptions());
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), this.mutationObserver?.disconnect(), document.removeEventListener("pointerdown", this, !0), this.isOpen && (this.isOpen = !1, this.openTarget = 0, this.openT = 0, this.openTargetVelocity = 0, this.removeAttribute("open"), this.trigger?.setAttribute("aria-expanded", "false"), this.trigger?.removeAttribute("aria-activedescendant"));
  }
  // Route events from the trigger, the option list and the document
  handleEvent(t) {
    if (t.currentTarget === document) {
      this.isOpen && !t.composedPath().includes(this) && this.close();
      return;
    }
    const e = t.currentTarget === this.list;
    switch (t.type) {
      case "pointerdown":
        this.pressTrigger(t);
        break;
      case "pointerup":
      case "pointercancel":
      case "pointerleave":
        this.releaseBody();
        break;
      case "pointermove":
        this.onRowHover(t);
        break;
      case "keydown":
        this.onTriggerKey(t);
        break;
      case "focus":
        this.setFocused(!0);
        break;
      case "blur":
        this.setFocused(!1);
        break;
      case "click":
        e ? this.onRowClick(t) : this.toggle();
        break;
    }
  }
  // Dent the trigger surface under the pointer
  pressTrigger(t) {
    this.hasAttribute("disabled") || this.pressAt(t.clientX, t.clientY, 0.9);
  }
  // Track trigger focus so the fill, border and painted ring can respond
  setFocused(t) {
    this.focused = t, this.requestFrame();
  }
  // Rebuild the listbox rows from the light-DOM options and re-derive the selection
  syncOptions() {
    if (!this.list)
      return;
    this.options = [...this.querySelectorAll("jelly-option")];
    const t = this.getAttribute("value"), e = t != null && t !== "";
    let i = -1;
    this.options.forEach((s, r) => {
      (e ? s.value === t : s.hasAttribute("selected")) && (i = r);
    }), this.selectedIndex = i, this.list.innerHTML = this.options.map((s, r) => {
      const o = r === this.selectedIndex;
      return `
          <li class="row" id="${this.instanceId}-opt${r}" role="option" data-index="${r}"
              aria-selected="${o}" ${s.disabled ? 'aria-disabled="true"' : ""}>
            <span class="row-label">${B(s.label)}</span>
            <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 13l4 4 10-11" />
            </svg>
          </li>`;
    }).join(""), this.renderValue(), this.sizePanel();
  }
  // Show the selected label (or the placeholder) and mirror the value into the form
  renderValue() {
    const t = this.options[this.selectedIndex];
    t ? (this.valueEl.textContent = t.label, this.valueEl.classList.remove("placeholder"), this.internals.setFormValue(t.value)) : (this.valueEl.textContent = this.getAttribute("placeholder") || "Select…", this.valueEl.classList.add("placeholder"), this.internals.setFormValue(null));
  }
  // Size the panel, its canvas and the panel physics body to fit the options
  sizePanel() {
    const e = this.getBoundingClientRect().width || 240, i = Math.min(this.options.length, 6), s = this.rowHeight, r = i * s + Ze * 2;
    this.panel.style.width = `${e}px`, this.panel.style.height = `${r}px`;
    const o = 16, l = e + o * 2, d = r + o * 2, h = Math.min(window.devicePixelRatio || 1, 3);
    this.panelCssW = l, this.panelCssH = d, this.panelCanvas.style.width = `${l}px`, this.panelCanvas.style.height = `${d}px`, this.panelCanvas.style.left = `${e / 2}px`, this.panelCanvas.style.top = `${r / 2}px`, this.panelCanvas.width = Math.round(l * h), this.panelCanvas.height = Math.round(d * h), this.panelCtx.setTransform(h, 0, 0, h, 0, 0), this.panelBody ? this.panelBody.resize(e, r, K) : this.panelBody = new D({ width: e, height: r, radius: K });
  }
  // The current row height in px, read from the size-scaled token
  get rowHeight() {
    return parseFloat(getComputedStyle(this).getPropertyValue("--jelly-select-row-height")) || 44;
  }
  /*
   * Collision handling: measure the viewport room around the trigger and
   * anchor the panel below when it fits, above when it would clip and there
   * is room overhead - the same flip rule placeAnchored() uses. The chosen
   * side lands in data-side, which re-anchors the panel in CSS and frame()
   * mirrors the clip reveal, the row stagger and the canvas scale origin so
   * the surface always unfolds away from the trigger edge.
   */
  placePanel() {
    const t = this.getBoundingClientRect(), e = this.panel.offsetHeight || parseFloat(this.panel.style.height) || 0, i = t.bottom + xt + e > window.innerHeight - Je, s = t.top - xt - e > 0;
    this.panelSide = i && s ? "top" : "bottom", this.panel.setAttribute("data-side", this.panelSide);
  }
  // Flip between open and closed
  toggle() {
    this.isOpen ? this.close() : this.openPanel();
  }
  // Open the panel on the side with room and let the surface unfold
  openPanel() {
    if (!(this.isOpen || !this.options.length)) {
      if (this.sizePanel(), this.placePanel(), this.isOpen = !0, this.setAttribute("open", ""), this.trigger.setAttribute("aria-expanded", "true"), this.activeIndex = this.selectedIndex >= 0 ? this.selectedIndex : 0, this.renderActive(), this.openTarget = 1, !this.reducedMotion && this.panelBody) {
        const t = this.panelSide === "top" ? this.panelBody.height / 2 : -this.panelBody.height / 2;
        this.panelBody.centerPop(1.2), this.panelBody.pulseAt(0, t, 0.8);
      }
      document.addEventListener("pointerdown", this, !0), T(), this.requestFrame();
    }
  }
  // Close the panel and hand focus back to the trigger
  close() {
    this.isOpen && (this.isOpen = !1, this.openTarget = 0, this.removeAttribute("open"), this.trigger.setAttribute("aria-expanded", "false"), this.trigger.removeAttribute("aria-activedescendant"), document.removeEventListener("pointerdown", this, !0), this.trigger.focus(), this.requestFrame());
  }
  // Highlight the active row and point aria-activedescendant at it
  renderActive() {
    const t = [...this.list.children];
    t.forEach((i, s) => i.classList.toggle("active", s === this.activeIndex));
    const e = t[this.activeIndex];
    e && (this.trigger.setAttribute("aria-activedescendant", e.id), e.scrollIntoView({ block: "nearest" }));
  }
  // Step the active row by delta, wrapping and skipping disabled options
  moveActive(t) {
    const e = this.options.length;
    if (!e)
      return;
    let i = this.activeIndex;
    for (let s = 0; s < e && (i = (i + t + e) % e, !!this.options[i].disabled); s++)
      ;
    this.activeIndex = i, this.renderActive();
  }
  // Commit a selection: reflect it, re-render, close and notify listeners
  selectIndex(t) {
    const e = this.options[t];
    !e || e.disabled || (this.options.forEach((i) => i.removeAttribute("selected")), e.setAttribute("selected", ""), this.selectedIndex = t, this.reflectValue(e.value), [...this.list.children].forEach((i, s) => i.setAttribute("aria-selected", String(s === t))), this.renderValue(), this.close(), T(), g(this, "change"));
  }
  // Mirror the current value into the value attribute without re-entering sync
  reflectValue(t) {
    this.reflectingValue = !0, t == null || t === "" ? this.removeAttribute("value") : this.setAttribute("value", t), this.reflectingValue = !1;
  }
  // Deselect every option and fall back to the placeholder
  clearSelection() {
    this.options.forEach((t) => t.removeAttribute("selected")), this.selectedIndex = -1, this.reflectValue(""), [...this.list.children].forEach((t) => t.setAttribute("aria-selected", "false")), this.renderValue(), this.requestFrame();
  }
  // Select the option whose value matches; unknown values are ignored
  setValue(t) {
    const e = t == null ? "" : String(t);
    if (!e) {
      this.clearSelection();
      return;
    }
    const i = this.options.findIndex((s) => s.value === e);
    i < 0 || (this.options.forEach((s, r) => s.toggleAttribute("selected", r === i)), this.selectedIndex = i, this.reflectValue(e), [...this.list.children].forEach((s, r) => s.setAttribute("aria-selected", String(r === i))), this.renderValue(), this.requestFrame());
  }
  // Keyboard on the trigger: closed it opens; open it navigates and selects
  onTriggerKey(t) {
    if (!this.hasAttribute("disabled")) {
      if (!this.isOpen) {
        ["ArrowDown", "ArrowUp", "Enter", " "].includes(t.key) && (t.preventDefault(), this.openPanel());
        return;
      }
      switch (t.key) {
        case "ArrowDown":
          t.preventDefault(), this.moveActive(1);
          break;
        case "ArrowUp":
          t.preventDefault(), this.moveActive(-1);
          break;
        case "Home":
          t.preventDefault(), this.activeIndex = -1, this.moveActive(1);
          break;
        case "End":
          t.preventDefault(), this.activeIndex = 0, this.moveActive(-1);
          break;
        case "Enter":
        case " ":
          t.preventDefault(), this.selectIndex(this.activeIndex);
          break;
        case "Escape":
          t.preventDefault(), this.close();
          break;
        case "Tab":
          this.close();
          break;
        default:
          t.key.length === 1 && !t.ctrlKey && !t.metaKey && !t.altKey && this.typeahead(t.key);
      }
    }
  }
  // Accumulate typed characters and move the active row to the first enabled
  // option whose label starts with the buffer (case-insensitive)
  typeahead(t) {
    clearTimeout(this.typeaheadTimer), this.typeaheadTimer = setTimeout(() => {
      this.typeaheadBuffer = "";
    }, 500), this.typeaheadBuffer = (this.typeaheadBuffer || "") + t.toLowerCase();
    const e = this.options.length;
    if (e === 0)
      return;
    const s = ((this.typeaheadBuffer.length === 1 ? this.activeIndex + 1 : this.activeIndex) % e + e) % e;
    for (let r = 0; r < e; r++) {
      const o = (s + r) % e, l = this.options[o];
      if (!l.disabled && l.label.toLowerCase().startsWith(this.typeaheadBuffer)) {
        this.activeIndex = o, this.renderActive();
        return;
      }
    }
  }
  // Pointer movement over the list makes the hovered row active
  onRowHover(t) {
    const e = t.target.closest(".row");
    if (!e)
      return;
    const i = Number(e.dataset.index);
    i !== this.activeIndex && (this.activeIndex = i, this.renderActive());
  }
  // A click on a row selects it
  onRowClick(t) {
    const e = t.target.closest(".row");
    e && this.selectIndex(Number(e.dataset.index));
  }
  // Resolve the trigger surface color: platinum when disabled, the elevated
  // surface while focused or open, the resting field fill otherwise
  fill() {
    return this.hasAttribute("disabled") ? this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`) : this.focused || this.isOpen ? this.resolveColor(`var(--jelly-color-background-surface, ${b["background-surface"]})`) : getComputedStyle(this).getPropertyValue("--jelly-fill").trim() || this.resolveColor(`var(--jelly-color-background-muted, ${b["background-muted"]})`);
  }
  /*
   * Show the painted ring whenever the trigger is focused or the panel is
   * open - including pointer focus - so the dropdown gets the same ring as
   * jelly-input rather than only lighting up on keyboard (:focus-visible) focus
   */
  focusRing() {
    return !this.focused && !this.isOpen ? null : { color: this.ringColor(), width: H.width, gap: H.gap };
  }
  // Hairline border on the trigger surface: accent while focused or open
  surfaceBorder() {
    return { color: this.focused || this.isOpen ? this.resolveColor(`var(--jelly-accent, var(--jelly-color-background-accent, ${b["background-accent"]}))`) : this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`), width: 1 };
  }
  // One animation step: trigger body, unfold spring, panel body, row reveal
  frame(t) {
    const e = this.body;
    if (!e)
      return !1;
    e.update(t), this.clearCanvas(), this.paintBody(e, {
      fill: this.fill(),
      ring: this.focusRing(),
      border: this.surfaceBorder(),
      easeKey: "trigger"
    });
    let i = !e.isResting();
    if (this.reducedMotion)
      this.openT = this.openTarget, this.openTargetVelocity = 0;
    else {
      const h = (this.openTarget - this.openT) * 210 - this.openTargetVelocity * 16;
      this.openTargetVelocity += h * t, this.openT += this.openTargetVelocity * t;
    }
    const s = this.openT, r = m(s, 0, 1), o = this.openTarget === 1 || s > 0.02, l = this.panelSide === "top";
    if (this.panel) {
      this.panel.style.visibility = o ? "visible" : "hidden", this.panel.style.opacity = String(m(s * 2, 0, 1));
      const h = (1 - r) * 100;
      this.panelMask.style.clipPath = l ? `inset(${h}% 0 0 0 round ${K}px)` : `inset(0 0 ${h}% 0 round ${K}px)`;
      const a = this.list.children;
      for (let c = 0; c < a.length; c++) {
        const p = l ? a.length - 1 - c : c, u = m((s - 0.12) * 1.7 - p * 0.05, 0, 1);
        a[c].style.opacity = String(u), a[c].style.transform = `translateY(${(l ? -7 : 7) * (1 - u)}px)`;
      }
    }
    if (this.panelBody && o) {
      this.panelBody.update(t), this.panelCtx.clearRect(0, 0, this.panelCssW, this.panelCssH);
      const h = this.panelBody.height, a = Math.max(0.02, s), c = (1 - a) * h / 2;
      this.paintBody(this.panelBody, {
        fill: this.resolveColor(`var(--jelly-color-background-surface, ${b["background-surface"]})`),
        border: { color: this.resolveColor(`var(--jelly-color-background-neutral, ${b["background-neutral"]})`), width: 1 },
        ctx: this.panelCtx,
        cssW: this.panelCssW,
        cssH: this.panelCssH,
        cy: l ? c : -c,
        scaleX: 1 + (1 - r) * 0.05,
        scaleY: a,
        easeKey: "panel"
      });
    }
    const d = Math.abs(this.openTarget - s) > 1e-3 || Math.abs(this.openTargetVelocity) > 1e-3;
    return i = i || d || o && this.panelBody !== null && !this.panelBody.isResting(), i;
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    this.reflectingValue || this.sync(t, this.getAttribute(t));
  }
  // Push one observed attribute into the rendered control
  sync(t, e) {
    switch (t) {
      case "placeholder":
        this.valueEl && this.renderValue();
        break;
      case "label":
        this.syncLabel();
        break;
      case "disabled":
        if (!this.trigger)
          break;
        this.trigger.disabled = this.hasAttribute("disabled"), this.hasAttribute("disabled") && (this.focused = !1), this.syncHostFocusTarget(), this.requestFrame();
        break;
      case "size":
        j(this), this.panel && (this.sizePanel(), this.requestFrame());
        break;
      case "value":
        this.list && this.setValue(e);
        break;
    }
  }
  // Mirror the label attribute onto the trigger as its accessible name
  syncLabel() {
    if (!this.trigger)
      return;
    const t = this.getAttribute("label");
    t ? this.trigger.setAttribute("aria-label", t) : this.trigger.removeAttribute("aria-label");
  }
  // The selected option's value ('' when nothing is selected)
  get value() {
    const t = this.options[this.selectedIndex];
    return t ? t.value : "";
  }
  // Select the option whose value matches (empty clears the selection)
  set value(t) {
    this.setValue(t);
  }
  // Route programmatic host focus onto the trigger button
  focus(t) {
    this.trigger?.focus(t);
  }
}
customElements.define("jelly-select", Ge);
class Ue extends HTMLElement {
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "selected", "disabled"];
  }
  // The submitted value: the value attribute, falling back to the text label
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") ?? "" : (this.textContent ?? "").trim();
  }
  // The visible label rendered by the parent control
  get label() {
    return (this.textContent ?? "").trim();
  }
  // True when this option cannot be selected
  get disabled() {
    return this.hasAttribute("disabled");
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    this.style.display = "none", this.closest("jelly-segmented")?.sync?.();
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback() {
    this.closest("jelly-segmented")?.sync?.();
  }
}
customElements.define("jelly-segment", Ue);
const _e = ':host{display:inline-flex;height:44px;--jelly-segmented-padding: 4px;--jelly-segmented-min-width: 60px;--jelly-segmented-gap: 7px;--jelly-segmented-padding-inline: 18px;--jelly-segmented-font-size: 14.5px;--jelly-track: color-mix(in srgb, var(--jelly-color-background-neutral) 88%, var(--jelly-color-background-surface));--jelly-pill: var(--jelly-color-background-accent);--jelly-label: var(--jelly-color-foreground-default);--jelly-label-on: var(--jelly-color-foreground-on-accent);font:600 var(--jelly-segmented-font-size)/1 var(--jelly-font-display)}:host([size="small"]),:host([size="sm"]){height:36px;--jelly-segmented-padding: 3px;--jelly-segmented-min-width: 50px;--jelly-segmented-gap: 5px;--jelly-segmented-padding-inline: 14px;--jelly-segmented-font-size: 13px}:host([size="medium"]),:host([size="md"]){height:44px;--jelly-segmented-padding: 4px;--jelly-segmented-min-width: 60px;--jelly-segmented-gap: 7px;--jelly-segmented-padding-inline: 18px;--jelly-segmented-font-size: 14.5px}:host([size="large"]),:host([size="lg"]){height:52px;--jelly-segmented-padding: 5px;--jelly-segmented-min-width: 74px;--jelly-segmented-gap: 8px;--jelly-segmented-padding-inline: 22px;--jelly-segmented-font-size: 16px}:host([disabled]){opacity:.55;pointer-events:none}.wrap{display:flex;width:100%;height:100%;box-sizing:border-box;padding:var(--jelly-segmented-padding);position:relative}.segment{flex:1 1 0;min-width:var(--jelly-segmented-min-width);display:inline-flex;align-items:center;justify-content:center;gap:var(--jelly-segmented-gap);padding-block:0;padding-inline:var(--jelly-segmented-padding-inline);margin:0;border:0;background:transparent;color:var(--jelly-label);font:inherit;white-space:nowrap;cursor:pointer;position:relative;border-radius:999px;transition:color .18s ease;outline:none;touch-action:manipulation}.segment[aria-checked=true],.segment[aria-selected=true]{color:var(--jelly-label-on)}.segment[aria-checked=true]{font-weight:750}.segment:disabled{cursor:default;opacity:.45}.segment-top{display:inline-grid;place-items:center}.segment-top>span{grid-area:1 / 1;white-space:nowrap}.segment-bottom{font-weight:750;visibility:hidden}:host([roles="tablist"]) .segment-bottom{display:none}.segment:after{content:"";position:absolute;inset:2px;border:var(--jelly-ring-width) solid transparent;border-radius:999px;pointer-events:none}@media(forced-colors:active){.wrap{border:1px solid ButtonBorder;border-radius:999px}.segment[aria-checked=true],.segment[aria-selected=true]{forced-color-adjust:none;background:SelectedItem;color:SelectedItemText}.segment:focus-visible:after{border-color:Highlight}}';
class Qe extends L {
  constructor() {
    super(), this.pill = null, this.mutationObserver = null, this.segments = [], this.index = 0, this.pillX = 0, this.pillXVelocity = 0, this.pillTarget = 0, this.trackW = 0, this.trackH = 0, this.segW = 0, this.placed = !1, this.reflecting = !1, this.internals = this.attachInternals();
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "disabled", "size", "roles", "label"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return _e;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<div class="wrap" part="wrap" role="radiogroup"></div>';
  }
  // The jelly track: a capsule inset a hair from the host box
  shape(t, e) {
    const i = t - 6, s = e - 6;
    return { width: i, height: s, radius: s / 2 };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.wrap = this.shadowRoot.querySelector(".wrap"), this.wrap.addEventListener("click", this), this.wrap.addEventListener("keydown", this), this.wrap.addEventListener("focusin", this), this.wrap.addEventListener("focusout", this), this.mutationObserver = new MutationObserver(() => this.sync()), this.mutationObserver.observe(this, { childList: !0, subtree: !0, characterData: !0 }), this.sync();
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    const t = this.built;
    super.connectedCallback(), t && this.mutationObserver && (this.mutationObserver.observe(this, { childList: !0, subtree: !0, characterData: !0 }), this.sync());
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), this.mutationObserver?.disconnect();
  }
  // Central handler for the listeners registered with `this`
  handleEvent(t) {
    switch (t.type) {
      case "click":
        this.onClick(t);
        break;
      case "keydown":
        this.onKey(t);
        break;
      case "focusin":
        this.onFocusIn(t);
        break;
      case "focusout":
        this.onFocusOut();
        break;
    }
  }
  // True when the control presents tab semantics instead of radio semantics
  get isTablist() {
    return this.getAttribute("roles") === "tablist";
  }
  // The ARIA state attribute matching the current roles mode
  get stateAttribute() {
    return this.isTablist ? "aria-selected" : "aria-checked";
  }
  /*
   * Rebuild the shadow buttons from the light-DOM <jelly-segment> children.
   * Runs on connect, on any light-DOM mutation and when the roles or
   * disabled attributes change the rendered semantics.
   */
  sync() {
    if (!this.wrap)
      return;
    this.segments = [...this.querySelectorAll("jelly-segment")];
    const t = this.getAttribute("value"), e = this.segments.findIndex((o) => o.value === t);
    this.index = e >= 0 ? e : this.segments.findIndex((o) => o.hasAttribute("selected")), this.index < 0 && (this.index = 0);
    const i = this.isTablist, s = this.stateAttribute, r = this.hasAttribute("disabled");
    this.wrap.setAttribute("role", i ? "tablist" : "radiogroup"), this.wrap.innerHTML = this.segments.map((o, l) => {
      const d = B(o.label);
      return `
        <button class="segment" type="button" role="${i ? "tab" : "radio"}" data-index="${l}"
                ${s}="${l === this.index}"
                tabindex="${l === this.index ? 0 : -1}"
                ${o.disabled || r ? "disabled" : ""}><span class="segment-top"><span>${d}</span><span class="segment-bottom" aria-hidden="true">${d}</span></span></button>`;
    }).join(""), this.syncLabel(), this.syncValue(), this.removeAttribute("tabindex"), this.onShape();
  }
  // Apply the label attribute as the group's accessible name
  syncLabel() {
    const t = this.getAttribute("label");
    t ? this.wrap.setAttribute("aria-label", t) : this.wrap.removeAttribute("aria-label");
  }
  // Push the active segment's value into the form internals
  syncValue() {
    const t = this.segments[this.index];
    this.internals.setFormValue(t ? t.value : null);
  }
  // Called whenever the shape (re)builds: size the pill and aim it at the active segment
  onShape() {
    if (!this.body || !this.segments.length)
      return;
    this.trackW = this.body.width, this.trackH = this.body.height, this.segW = this.trackW / this.segments.length;
    const t = this.segW - 6, e = this.trackH - 6, i = e / 2;
    this.pill ? (Math.abs(this.pill.width - t) > 1.5 || Math.abs(this.pill.height - e) > 1.5) && this.pill.resize(t, e, i) : this.pill = new D({ width: t, height: e, radius: i }), this.pillTarget = this.segX(this.index), this.placed || (this.pillX = this.pillTarget, this.pillXVelocity = 0, this.placed = !0), this.requestFrame();
  }
  /*
   * The pill's resting center for a segment, in canvas-local coordinates.
   * Measured from the rendered button's box, so it is correct in both LTR
   * and RTL without any direction math; falls back to an even split
   * (mirrored for RTL) before the first layout.
   */
  segX(t) {
    const e = this.wrap?.children[t];
    if (e && e.offsetWidth > 0)
      return e.offsetLeft + e.offsetWidth / 2 - this.wrap.offsetWidth / 2;
    const i = -this.trackW / 2 + (t + 0.5) * this.segW;
    return k(this) ? -i : i;
  }
  /*
   * Make a segment the active one: move the roving tabindex, launch the
   * pill toward it, sync the form value and reflect to the host attribute.
   * User selections also stretch the pill, buzz, focus and emit change.
   */
  select(t, e = !1) {
    const i = this.segments[t];
    if (!i || i.disabled || t === this.index) {
      e && this.focusSeg(t);
      return;
    }
    this.index = t, this.pillTarget = this.segX(t);
    const s = Math.sign(this.pillTarget - this.pillX) || 1, r = this.stateAttribute;
    [...this.wrap.children].forEach((o, l) => {
      o.setAttribute(r, String(l === t)), o.tabIndex = l === t ? 0 : -1;
    }), this.syncValue(), this.reflecting = !0, this.setAttribute("value", i.value), this.reflecting = !1, e && (!this.reducedMotion && this.pill && this.pill.stretchAlong(s, 0, 0.75), T(), this.focusSeg(t), g(this, "change", { value: i.value })), this.requestFrame();
  }
  // Move focus onto a segment's button
  focusSeg(t) {
    this.wrap.children[t]?.focus();
  }
  // Activate the segment under a click / tap
  onClick(t) {
    const e = t.target.closest(".segment");
    e && this.select(Number(e.dataset.index), !0);
  }
  /*
   * Roving-tabindex keyboard support: arrows move the selection (horizontal
   * arrows flip with the reading direction), Home / End jump to the ends,
   * and disabled segments are skipped in the direction of travel.
   */
  onKey(t) {
    const e = this.segments.length;
    if (!e)
      return;
    const i = kt(t.key, this.index, e, { rtl: k(this) });
    if (i < 0)
      return;
    t.preventDefault();
    const s = t.key === "Home" ? 1 : t.key === "End" ? -1 : i === (this.index + 1) % e ? 1 : -1;
    let r = i;
    for (let o = 0; o < e && this.segments[r].disabled; o++)
      r = (r + s + e) % e;
    this.select(r, !0);
  }
  // Show the painted focus ring only for keyboard (:focus-visible) focus
  onFocusIn(t) {
    const e = t.target.closest(".segment");
    this.focusVisible = e ? e.matches(":focus-visible") : !1, this.requestFrame();
  }
  // Hide the painted focus ring when focus leaves the control
  onFocusOut() {
    this.focusVisible = !1, this.requestFrame();
  }
  // One animation step: spring the pill toward its segment, paint track + pill
  frame(t) {
    const e = this.pill;
    if (!e)
      return !1;
    this.reducedMotion ? (this.pillX = this.pillTarget, this.pillXVelocity = 0) : [this.pillX, this.pillXVelocity] = E(this.pillX, this.pillXVelocity, this.pillTarget, 260, 32, t);
    const i = Math.max(0, this.trackW / 2 - e.width / 2);
    this.pillX > i ? (this.pillX = i, this.pillXVelocity > 0 && (this.pillXVelocity = 0)) : this.pillX < -i && (this.pillX = -i, this.pillXVelocity < 0 && (this.pillXVelocity = 0));
    const s = Math.abs(this.pillXVelocity);
    s > 6 && (e.lean = Math.sign(this.pillXVelocity)), e.leanAmount = this.reducedMotion ? 0 : Math.min(e.height * 0.16, s * 6e-3), e.update(t);
    const r = this.resolveColor(`var(--jelly-track, ${b["background-neutral"]})`), o = this.resolveColor(`var(--jelly-pill, ${b["background-accent"]})`), l = this.ctx, d = this.cssW / 2, h = this.cssH / 2;
    return this.clearCanvas(), l.beginPath(), l.roundRect(d - this.trackW / 2, h - this.trackH / 2, this.trackW, this.trackH, this.trackH / 2), l.fillStyle = r, l.fill(), this.paintBody(e, {
      fill: o,
      cx: this.pillX,
      ring: this.focusRing()
    }), !(Math.abs(this.pillTarget - this.pillX) < 0.2 && Math.abs(this.pillXVelocity) < 0.5 && e.isResting());
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (!this.reflecting)
      switch (t) {
        case "value":
          if (this.segments?.length) {
            const e = this.segments.findIndex((i) => i.value === this.getAttribute("value"));
            e >= 0 && this.select(e, !1);
          }
          break;
        case "size":
          this.body && this.applyShape();
          break;
        case "roles":
        case "disabled":
          this.wrap && this.sync();
          break;
        case "label":
          this.wrap && this.syncLabel();
          break;
      }
  }
  // The active segment's value (empty until segments exist)
  get value() {
    return this.segments[this.index]?.value ?? "";
  }
  // Select the segment whose value matches, without the user-interaction effects
  set value(t) {
    const e = this.segments.findIndex((i) => i.value === t);
    e >= 0 && this.select(e, !1);
  }
  // Route programmatic host focus onto the active segment's button
  focus(t) {
    this.wrap?.children[this.index]?.focus(t);
  }
}
customElements.define("jelly-segmented", Qe);
const ti = ':host{display:inline-flex;--jelly-otp-width: 44px;--jelly-otp-height: 52px;--jelly-otp-gap: 9px;--jelly-otp-font-size: 22px;--jelly-otp-radius: 14px;--jelly-ring: var(--jelly-color-border-focus);--jelly-otp-accent: var(--jelly-color-background-accent)}:host([size="small"]){--jelly-otp-width: 36px;--jelly-otp-height: 44px;--jelly-otp-gap: 7px;--jelly-otp-font-size: 18px;--jelly-otp-radius: 12px}:host([size="large"]){--jelly-otp-width: 54px;--jelly-otp-height: 62px;--jelly-otp-gap: 11px;--jelly-otp-font-size: 26px;--jelly-otp-radius: 17px}.row{display:inline-flex;gap:var(--jelly-otp-gap);direction:ltr}input{width:var(--jelly-otp-width);height:var(--jelly-otp-height);box-sizing:border-box;text-align:center;border:1px solid var(--jelly-color-background-neutral);border-radius:var(--jelly-otp-radius);background:var(--jelly-color-background-muted);color:var(--jelly-color-foreground-default);font:640 var(--jelly-otp-font-size)/1 var(--jelly-font-display);caret-color:var(--jelly-otp-accent);touch-action:manipulation;outline:var(--jelly-ring-width) solid transparent;outline-offset:var(--jelly-ring-gap);transition:background .15s}input:focus{background:var(--jelly-color-background-surface);border-color:var(--jelly-ring);outline-color:var(--jelly-ring-color)}:host([disabled]){opacity:.55;pointer-events:none}:host([disabled]) input{background:var(--jelly-color-background-neutral)}@media(forced-colors:active){input{border-color:ButtonText}input:focus{outline-color:Highlight}}';
class ei extends HTMLElement {
  constructor() {
    super(...arguments), this.boxes = [];
  }
  static {
    this.formAssociated = !0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["length", "size", "variant", "disabled", "label"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), this.shadowRoot || (this.internals = this.attachInternals?.(), this.attachShadow({ mode: "open", delegatesFocus: !0 })), this.render();
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (this.shadowRoot)
      switch (t) {
        case "size":
          j(this);
          break;
        case "length":
          this.render();
          break;
        case "disabled":
          this.syncDisabled();
          break;
        case "label":
          this.syncLabel();
          break;
      }
  }
  // Build one input box per digit (rebuilds when `length` changes)
  render() {
    const t = Math.max(1, parseInt(this.getAttribute("length") ?? "", 10) || 6);
    if (this.boxes && this.boxes.length === t)
      return;
    this.shadowRoot.innerHTML = `
      <style>${ti}${R({ color: "--jelly-otp-accent", ring: "--jelly-ring" })}</style>

      <div class="row" role="group" aria-label="One-time code"></div>
    `;
    const e = this.shadowRoot.querySelector(".row");
    this.boxes = [];
    for (let i = 0; i < t; i++) {
      const s = document.createElement("input");
      s.inputMode = "numeric", s.autocomplete = i === 0 ? "one-time-code" : "off", s.maxLength = 1, s.setAttribute("aria-label", `Digit ${i + 1}`), s.addEventListener("input", (r) => this.onInput(r, i)), s.addEventListener("keydown", (r) => this.onKey(r, i)), s.addEventListener("paste", (r) => this.onPaste(r, i)), s.addEventListener("focus", () => s.select()), e.appendChild(s), this.boxes.push(s);
    }
    this.removeAttribute("tabindex"), this.syncDisabled(), this.syncLabel(), this.internals?.setFormValue("");
  }
  // Mirror the disabled attribute onto every box (observed live)
  syncDisabled() {
    const t = this.hasAttribute("disabled");
    for (const e of this.boxes || [])
      e.disabled = t;
  }
  // Map the label attribute onto the group's accessible name
  syncLabel() {
    this.shadowRoot.querySelector(".row")?.setAttribute("aria-label", this.getAttribute("label") || "One-time code");
  }
  // A filled digit settles in softly (the box itself stays put)
  reveal(t, e = 0) {
    F() || this.boxes[t].animate?.(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      { duration: 260, delay: e, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
  }
  // A quiet confirmation when every box is filled
  completeReveal() {
    F() || this.shadowRoot.querySelector(".row")?.animate?.(
      [
        { opacity: 0.82 },
        { opacity: 1 }
      ],
      { duration: 420, easing: "ease-out" }
    );
  }
  // Accept one digit, reveal it and hop to the next box
  onInput(t, e) {
    t.stopPropagation();
    const i = t.target, s = i.value.replace(/\D/g, "").slice(-1);
    i.value = s, s && (this.reveal(e), e < this.boxes.length - 1 && this.boxes[e + 1].focus()), this.announce();
  }
  // Backspace hops back when empty; arrows move between boxes.
  // The row is pinned LTR, so the physical arrow directions are correct.
  onKey(t, e) {
    const i = t.target;
    t.key === "Backspace" && !i.value && e > 0 ? this.boxes[e - 1].focus() : t.key === "ArrowLeft" && e > 0 ? this.boxes[e - 1].focus() : t.key === "ArrowRight" && e < this.boxes.length - 1 && this.boxes[e + 1].focus();
  }
  // Distribute pasted digits across the remaining boxes
  onPaste(t, e) {
    t.preventDefault();
    const i = (t.clipboardData?.getData("text") || "").replace(/\D/g, "").split("");
    for (let r = 0; r + e < this.boxes.length && r < i.length; r++)
      this.boxes[e + r].value = i[r], this.reveal(e + r, r * 45);
    const s = Math.min(this.boxes.length - 1, e + i.length);
    this.boxes[s].focus(), this.announce();
  }
  // Push the joined value to the form and notify listeners
  announce() {
    const t = this.value;
    this.internals?.setFormValue(t), g(this, "input"), t.length === this.boxes.length && (this.completeReveal(), g(this, "change"), g(this, "complete", { value: t }));
  }
  // The joined code across all boxes
  get value() {
    return this.boxes.map((t) => t.value).join("");
  }
  set value(t) {
    const e = String(t).split("");
    this.boxes.forEach((i, s) => {
      i.value = e[s] || "";
    }), this.internals?.setFormValue(this.value);
  }
  // Route programmatic host focus onto the first box
  focus(t) {
    this.boxes?.[0]?.focus(t);
  }
}
customElements.define("jelly-otp", ei);
const ii = ':host{display:inline-block;--jelly-label-font-size: 13.5px;--jelly-label-gap: 5px}:host([size="small"]){--jelly-label-font-size: 12px;--jelly-label-gap: 4px}:host([size="large"]){--jelly-label-font-size: 15px;--jelly-label-gap: 6px}label{display:inline-flex;align-items:center;gap:var(--jelly-label-gap);font:650 var(--jelly-label-font-size)/1.3 var(--jelly-font-display);letter-spacing:.01em;color:var(--jelly-color-foreground-default);cursor:default}.required{color:var(--jelly-color-background-rose);font-weight:800}.sr-required{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}:host(:not([required])) .required,:host(:not([required])) .sr-required{display:none}';
class si extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["for", "required", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), !this.built && (this.built = !0, this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `
      <style>${ii}</style>

      <label part="label">
        <slot></slot>
        <span class="required" aria-hidden="true">*</span>
        <span class="sr-required">(required)</span>
      </label>
    `, this.label = this.shadowRoot.querySelector("label"), this.label.addEventListener("click", () => this.focusTarget()), this.shadowRoot.querySelector("slot").addEventListener("slotchange", () => this.sync()), this.sync());
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this), this.built && this.sync();
  }
  // Resolve the `for` target in this label's own document / shadow root
  get target() {
    const t = this.getAttribute("for");
    return t ? this.getRootNode().getElementById?.(t) ?? document.getElementById(t) : null;
  }
  // Clicking the label focuses the referenced control (cross-root safe)
  focusTarget() {
    this.target?.focus?.();
  }
  /*
   * Give the target an accessible name and required state. Jelly form
   * controls map their `label` attribute to an inner aria-label, which
   * works across shadow roots where aria-labelledby idrefs cannot.
   */
  sync() {
    const t = this.target;
    if (!t)
      return;
    const e = (this.textContent ?? "").trim();
    e && t.localName.startsWith("jelly-") && !t.hasAttribute("label") && t.setAttribute("label", e), this.hasAttribute("required") && (t.ariaRequired = "true");
  }
}
customElements.define("jelly-label", si);
const ri = ':host{display:inline-block;width:240px;height:14px;--jelly-track: var(--jelly-color-background-neutral);--jelly-accent: var(--jelly-color-background-accent)}:host([size="small"]){width:200px;height:10px}:host([size="large"]){width:300px;height:18px}', jt = {
  small: { width: 200, track: 10 },
  medium: { width: 240, track: 14 },
  large: { width: 300, track: 18 }
};
class oi extends L {
  constructor() {
    super(...arguments), this.fraction = 0, this.shownFrac = 0, this.phase = 0, this.trackW = 0, this.trackH = 0, this.blob = null, this.blobW = 0, this.blobH = 0, this.wall = !1, this.rip = 0;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["value", "max", "indeterminate", "size", "label"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return ri + R({ color: "--jelly-accent" });
  }
  // No interactive content - the bar is pure canvas
  content() {
    return "";
  }
  // The full track is the physics body; the fill is painted clipped
  shape(t, e) {
    const i = e || this.sizeConfig.track;
    return { width: t, height: i, radius: i / 2 };
  }
  // Geometry for the current (canonicalized) size attribute
  get sizeConfig() {
    return jt[this.getAttribute("size") ?? ""] || jt.medium;
  }
  // Called once after the shadow DOM and canvas exist. Wire ARIA here.
  onBuilt() {
    this.setAttribute("role", "progressbar"), this.readValue();
  }
  // Cache the track box whenever the shape (re)builds
  onShape() {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width, this.trackH = this.body ? this.body.height : this.sizeConfig.track;
  }
  // True while the bar shows busy-without-a-value
  get indeterminate() {
    return this.hasAttribute("indeterminate");
  }
  set indeterminate(t) {
    this.toggleAttribute("indeterminate", !!t);
  }
  // Parse value / max and mirror them into the progressbar ARIA
  readValue() {
    const t = parseFloat(this.getAttribute("max") ?? "") || 100, e = parseFloat(this.getAttribute("value") ?? "") || 0;
    this.fraction = m(e / t, 0, 1), this.indeterminate ? (this.setAttribute("aria-valuetext", "Loading…"), this.removeAttribute("aria-valuenow")) : (this.setAttribute("aria-valuemin", "0"), this.setAttribute("aria-valuemax", String(t)), this.setAttribute("aria-valuenow", String(e)), this.removeAttribute("aria-valuetext"));
    const i = this.getAttribute("label");
    i && this.setAttribute("aria-label", i), this.requestFrame();
  }
  // Clip the drawing context to a rounded track segment
  roundedClip(t, e, i, s, r, o) {
    t.beginPath(), t.roundRect(e, i, Math.max(0, s), r, Math.min(o, Math.max(0, s) / 2, r / 2)), t.clip();
  }
  // One animation step: paint the track, then the fill or the travelling blob
  frame(t) {
    const e = this.body;
    if (!e)
      return !1;
    const i = this.ctx, s = this.cssH / 2, r = this.trackW, o = this.cssW / 2 - r / 2, l = k(this), d = getComputedStyle(this).getPropertyValue("--jelly-track").trim() || b["background-neutral"], h = getComputedStyle(this).getPropertyValue("--jelly-accent").trim() || b["background-accent"];
    e.update(t), this.clearCanvas();
    const a = this.trackH || this.sizeConfig.track;
    i.beginPath(), i.roundRect(o, s - a / 2, r, a, a / 2), i.fillStyle = d, i.fill();
    let c = !1;
    if (this.indeterminate) {
      const p = Math.max(a * 1.8, r * 0.24);
      this.blob ? (this.blobW !== p || this.blobH !== a) && this.blob.resize(p, a, a / 2) : this.blob = new D({ width: p, height: a, radius: a / 2 }), this.blobW = p, this.blobH = a;
      const u = this.blob;
      if (this.reducedMotion)
        return u.leanAmount = 0, u.update(t), this.paintBody(u, { fill: h, cx: 0 }), !1;
      const f = Math.max(0, r - p);
      this.phase += t * 2;
      const C = Math.sin(this.phase), v = C * (f / 2), x = Math.cos(this.phase), y = Math.abs(x), w = y * 0.34;
      y > 0.06 && (u.lean = Math.sign(x)), u.leanAmount = y * (a / 2) * 0.4, Math.abs(C) > 0.985 ? this.wall || (this.wall = !0, u.stretchAlong(Math.sign(v) || 1, 0, 0.6)) : Math.abs(C) < 0.9 && (this.wall = !1), u.update(t), this.paintBody(u, {
        fill: h,
        cx: v,
        scaleX: 1 + w,
        scaleY: 1 - w * 0.5
      }), c = !0;
    } else {
      this.shownFrac += (this.fraction - this.shownFrac) * Math.min(1, t * 9);
      const p = Math.abs(this.fraction - this.shownFrac);
      p < 4e-4 && (this.shownFrac = this.fraction);
      const u = m(l ? r / 2 - this.shownFrac * r : -r / 2 + this.shownFrac * r, -r / 2, r / 2);
      this.rip += t, !this.reducedMotion && p > 3e-3 && this.rip > 0.13 && (this.rip = 0, e.pulseAt(u, -a / 2, 0.28), e.pulseAt(u, a / 2, 0.28));
      const f = this.shownFrac * r, C = l ? o + r - f : o;
      i.save(), this.roundedClip(i, C, s - a / 2, f, a, a / 2), this.paintBody(e, { fill: h }), i.restore(), c = p > 4e-4 || !e.isResting();
    }
    return c;
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically.
  // Guard on built-state (not body, which only exists after the first
  // nonzero-size layout) so value changes land even before the first paint.
  attributeChangedCallback(t) {
    this.built && (t === "size" && this.applyShape(), this.readValue());
  }
  // The current value as a number
  get value() {
    return parseFloat(this.getAttribute("value") ?? "") || 0;
  }
  set value(t) {
    this.setAttribute("value", String(t));
  }
}
customElements.define("jelly-progress", oi);
const ni = ':host{display:inline-block;width:42px;height:18px}:host([type="blob"]){width:44px;height:44px}:host([size="small"]){width:34px;height:14px}:host([size="large"]){width:54px;height:22px}:host([type="blob"][size="small"]){width:32px;height:32px}:host([type="blob"][size="large"]){width:56px;height:56px}.dots{display:block;width:100%;height:100%;overflow:visible}.dots g{fill:var(--jelly-fill)}.rover{animation:sp-rove 1.5s cubic-bezier(.55,0,.45,1) infinite}@keyframes sp-rove{0%,to{transform:translate(0)}25%{transform:translate(12px)}50%{transform:translate(24px)}75%{transform:translate(12px)}}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .rover{animation:none}}:host-context([data-jelly-motion="reduce"]) .rover{animation:none}@media(forced-colors:active){.dots g{fill:CanvasText}}';
class li extends L {
  constructor() {
    super(...arguments), this.timeAccumulator = 0, this.idx = 0, this.angle = 0, this.instanceId = X("jelly-spinner-goo");
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["type", "variant", "size", "label"];
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (this.built) {
      switch (t) {
        case "type":
          this.shadowRoot.querySelector(".jelly-content").innerHTML = this.content(), this.clearCanvas();
          break;
        case "size":
          this.applyShape();
          break;
        case "label":
          this.setAttribute("aria-label", this.getAttribute("label") || "Loading");
          break;
      }
      this.requestFrame();
    }
  }
  // The spinner flavor: gooey dots (default) or a morphing blob
  get type() {
    return this.getAttribute("type") || "dots";
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return U + ni;
  }
  // Dots render as gooey SVG; the blob is pure canvas
  content() {
    return this.type === "dots" ? `
        <svg class="dots" viewBox="0 0 42 18" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id="${this.instanceId}">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="b" />
              <feColorMatrix in="b" mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12" />
            </filter>
          </defs>
          <g filter="url(#${this.instanceId})">
            <circle cx="9" cy="9" r="4.2" />
            <circle cx="21" cy="9" r="4.2" />
            <circle cx="33" cy="9" r="4.2" />
            <circle class="rover" cx="9" cy="9" r="5.4" />
          </g>
        </svg>` : "";
  }
  // The blob is a circle; the dots body is unused (SVG draws instead)
  shape(t, e) {
    if (this.type === "dots")
      return { width: t, height: e, radius: e / 2 };
    const i = Math.min(t, e);
    return { width: i, height: i, radius: i / 2 };
  }
  // Called once after the shadow DOM and canvas exist. Wire ARIA here.
  onBuilt() {
    this.setAttribute("role", "status"), this.hasAttribute("aria-label") || this.setAttribute("aria-label", this.getAttribute("label") || "Loading");
  }
  // One animation step: keep the blob alive, spinning and breathing
  frame(t) {
    if (this.type === "dots")
      return !1;
    const e = this.body;
    if (!e)
      return !1;
    if (this.reducedMotion)
      return this.clearCanvas(), this.paintBody(e, { fill: this.fill() }), !1;
    if (this.timeAccumulator += t, this.timeAccumulator > 0.13) {
      this.timeAccumulator = 0;
      const l = e.membrane.length;
      this.idx = (this.idx + Math.round(l * 0.37)) % l, e.addMembraneImpulse(
        this.idx,
        e.config.insideLocalBulgeImpulse * 0.24,
        e.config.rippleWidth * 2.4
      );
    }
    e.update(t), this.angle += t * 1.5;
    const i = 1 + Math.sin(this.angle * 1.7) * 0.05, s = this.cssW / 2, r = this.cssH / 2, o = this.ctx;
    return this.clearCanvas(), o.save(), o.translate(s, r), o.rotate(this.angle), o.scale(i, 2 - i), o.translate(-s, -r), this.paintBody(e, { fill: this.fill() }), o.restore(), !0;
  }
}
customElements.define("jelly-spinner", li);
const ai = ':host{display:inline-block;width:200px;height:16px;--jelly-fill: var(--jelly-color-background-neutral)}:host([shape="line"]){width:220px;height:16px}:host([shape="rect"]),:host([shape="square"]){width:220px;height:88px}:host([shape="circle"]){width:52px;height:52px}';
class hi extends L {
  constructor() {
    super(...arguments), this.phase = Math.random() * 1.5, this.timeAccumulator = Math.random() * 0.08, this.breath = Math.random() * 1.2, this.sweepSpeed = 0.7 + Math.random() * 0.35, this.breathEvery = 1 + Math.random() * 0.7;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["shape"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return ai;
  }
  // No interactive content - the placeholder is pure canvas
  content() {
    return "";
  }
  // Lines and rects get gently rounded corners; circles go fully round
  shape(t, e) {
    const i = this.getAttribute("shape") === "circle";
    return {
      width: t,
      height: e,
      radius: i ? Math.min(t, e) / 2 : Math.min(e / 2, 7)
    };
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically.
  // A shape swap usually resizes the host (the ResizeObserver rebuilds then);
  // reshape the membrane directly for same-size swaps (inline width/height),
  // where a radius-only change would otherwise be dropped.
  attributeChangedCallback() {
    this.built && this.reshapeMembrane();
  }
  // Called once after the shadow DOM and canvas exist. Wire ARIA here.
  onBuilt() {
    this.setAttribute("role", "status"), this.setAttribute("aria-busy", "true"), this.hasAttribute("aria-label") || this.setAttribute("aria-label", "Loading");
  }
  // One animation step: a sweeping ripple plus an occasional soft breath
  frame(t) {
    const e = this.body;
    if (!e)
      return !1;
    if (this.reducedMotion)
      return this.clearCanvas(), this.paintBody(e, { fill: this.fill() }), !1;
    const i = e.width, s = e.height;
    if (this.phase = (this.phase + t * this.sweepSpeed) % 1.5, this.timeAccumulator += t, this.timeAccumulator > 0.08 && this.phase <= 1) {
      this.timeAccumulator = 0;
      const r = -i / 2 + this.phase * i;
      e.pulseAt(r, -s / 2, 0.16), e.pulseAt(r, s / 2, 0.1);
    }
    return this.breath += t, this.breath > this.breathEvery && (this.breath = 0, this.breathEvery = 1 + Math.random() * 0.7, e.centerPop(0.16)), e.update(t), this.clearCanvas(), this.paintBody(e, { fill: this.fill(), alpha: 0.82 }), !0;
  }
}
customElements.define("jelly-skeleton", hi);
const ci = ':host{display:inline-flex;height:24px;--jelly-badge-radius: 999px;font:640 12.5px/1 var(--jelly-font-display)}:host([size="small"]){height:20px;font-size:11px}:host([size="large"]){height:30px;font-size:14px}:host([shape="square"]){--jelly-badge-radius: 8px}:host([shape="square"][size="small"]){--jelly-badge-radius: 6px}:host([shape="square"][size="large"]){--jelly-badge-radius: 10px}.badge{display:inline-flex;align-items:center;justify-content:center;height:100%;min-width:12px;padding-inline:9px;color:var(--jelly-label);position:relative;border-radius:var(--jelly-badge-radius);white-space:nowrap}:host([size="small"]) .badge{min-width:10px;padding-inline:7px}:host([size="large"]) .badge{min-width:16px;padding-inline:12px}:host([outline]) .badge{color:var(--jelly-color-foreground-default)}@media(forced-colors:active){.badge{border:1px solid CanvasText}}';
class di extends L {
  constructor() {
    super(...arguments), this.mutationObserver = null;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["live", "shape"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return U + ci;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<span class="badge" part="badge"><slot></slot></span>';
  }
  // The pill (or, with shape="square", rounded-rectangle) the physics body takes
  shape(t, e) {
    const i = e - 2, s = this.getAttribute("shape") === "square", r = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-badge-radius")), o = Number.isFinite(r) && r < 900 ? Math.min(r, i / 2) : s ? i * 0.32 : i / 2;
    return { width: t - 2, height: i, radius: o };
  }
  /*
   * One animation step. A filled badge uses the base solid paint (crossfading
   * toward a new fill unless `instant` skips the ease - handy for badges that
   * swap variant on every scroll tick, where a lagging crossfade reads as
   * messy); an `outline` badge paints a hollow pill instead - a transparent
   * fill with the variant colour drawn as the rim (see surfaceBorder). The
   * transparent fill always skips easing too, which would otherwise round it
   * to opaque black.
   */
  frame(t) {
    const e = this.body;
    return e ? (e.update(t), this.clearCanvas(), this.hasAttribute("outline") ? this.paintBody(e, {
      fill: "transparent",
      ease: !1,
      ring: this.focusRing(),
      border: this.surfaceBorder()
    }) : this.paintBody(e, {
      ease: !this.hasAttribute("instant"),
      ring: this.focusRing(),
      border: this.surfaceBorder()
    }), !e.isResting()) : !1;
  }
  // The rim for an outline badge: the full variant fill colour, resolved to a
  // concrete colour (canvas strokeStyle can't read var()).
  surfaceBorder() {
    return this.hasAttribute("outline") ? {
      width: 2,
      color: this.resolveColor("var(--jelly-fill)")
    } : null;
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.sync(), this.mutationObserver = new MutationObserver(() => this.centerPop(0.7)), this.mutationObserver.observe(this, { childList: !0, characterData: !0, subtree: !0 });
  }
  // Lifecycle method: Called automatically when the element is appended to the
  // DOM. Re-arm the content observer - disconnectedCallback dropped it and a
  // badge that is detached and re-appended should keep popping on new counts.
  connectedCallback() {
    super.connectedCallback(), this.mutationObserver?.observe(this, { childList: !0, characterData: !0, subtree: !0 });
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (this.built) {
      if (t === "shape") {
        this.reshapeMembrane();
        return;
      }
      this.sync();
    }
  }
  // With `live`, content changes are announced politely by screen readers
  sync() {
    this.hasAttribute("live") ? (this.setAttribute("role", "status"), this.setAttribute("aria-live", "polite")) : (this.removeAttribute("role"), this.removeAttribute("aria-live"));
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), this.mutationObserver?.disconnect();
  }
}
customElements.define("jelly-badge", di);
const ui = ':host{display:block;position:relative;--jelly-alert-padding-block: 15px;--jelly-alert-padding-inline: 16px;--jelly-alert-gap: 12px;--jelly-alert-font-size: 14.5px;--jelly-alert-icon: 22px;--jelly-alert-close: 24px;--jelly-alert-radius: 16px;--tone: var(--jelly-color-background-azure);--jelly-fill: color-mix(in srgb, var(--tone) 15%, var(--jelly-color-background-surface));--jelly-alert-border: color-mix(in srgb, var(--tone) 34%, var(--jelly-color-background-surface));font:500 var(--jelly-alert-font-size)/1.5 var(--jelly-font-text);color:var(--jelly-color-foreground-default)}:host([size="small"]){--jelly-alert-padding-block: 12px;--jelly-alert-padding-inline: 13px;--jelly-alert-gap: 9px;--jelly-alert-font-size: 13px;--jelly-alert-icon: 19px;--jelly-alert-close: 22px;--jelly-alert-radius: 14px}:host([size="large"]){--jelly-alert-padding-block: 18px;--jelly-alert-padding-inline: 20px;--jelly-alert-gap: 14px;--jelly-alert-font-size: 16px;--jelly-alert-icon: 26px;--jelly-alert-close: 28px;--jelly-alert-radius: 18px}:host([tone="success"]){--tone: var(--jelly-color-background-mint)}:host([tone="warning"]){--tone: var(--jelly-color-background-amber)}:host([tone="danger"]){--tone: var(--jelly-color-background-rose)}.box{position:relative;box-sizing:border-box;display:flex;gap:var(--jelly-alert-gap);align-items:flex-start;padding-block:var(--jelly-alert-padding-block);padding-inline:var(--jelly-alert-padding-inline)}.icon{flex:0 0 auto;width:var(--jelly-alert-icon);height:var(--jelly-alert-icon);color:var(--tone);display:inline-flex;align-items:center;justify-content:center;margin-top:1px}.icon svg{width:100%;height:100%;fill:currentColor}.body{flex:1;min-width:0}.body ::slotted(strong){font-weight:750}.close{flex:0 0 auto;appearance:none;border:0;background:transparent;cursor:pointer;touch-action:manipulation;color:var(--jelly-color-foreground-muted);width:var(--jelly-alert-close);height:var(--jelly-alert-close);min-width:24px;min-height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;transition:background-color .12s ease,color .12s ease}.close svg{fill:currentColor}.close:hover{background:var(--jelly-alert-border)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .close{transition:none}}:host-context([data-jelly-motion="reduce"]) .close{transition:none}.close:focus-visible{outline:2px solid var(--jelly-ring-color);outline-offset:1px}:host(:not([dismissible])) .close{display:none}@media(forced-colors:active){.box{border:1px solid CanvasText;border-radius:var(--jelly-alert-radius)}.close:focus-visible{outline-color:Highlight}}', wt = {
  info: "info",
  success: "checkmark-circle",
  warning: "warning",
  danger: "error-circle"
};
class pi extends L {
  constructor() {
    super(...arguments), this.shakeT = 0, this.shaking = 0, this.shakeDir = -1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["tone", "size", "dismissible"];
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (this.built)
      switch (t) {
        case "tone":
          this.shadowRoot.querySelector(".jelly-content").innerHTML = this.content(), this.wireClose(), this.requestFrame();
          break;
        case "size":
          this.applyShape();
          break;
        case "dismissible":
          this.wireClose();
          break;
      }
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return ui;
  }
  // The interactive markup that sits above the canvas
  content() {
    const t = this.getAttribute("tone") || "info";
    return `
      <div class="box" part="box" role="alert">
        <span class="icon" aria-hidden="true">${ot(wt[t] || wt.info)}</span>
        <div class="body"><slot></slot></div>
        <button class="close" part="close" aria-label="Dismiss">${ot("dismiss", { size: 14 })}</button>
      </div>`;
  }
  // The banner the physics body takes (radius follows the size token)
  shape(t, e) {
    const i = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-alert-radius")) || 16;
    return { width: t, height: e, radius: Math.min(i, e / 2) };
  }
  // The surface fill resolves through the theme so dark mode recolors it
  fill() {
    return this.resolveColor(`var(--jelly-fill, var(--jelly-color-background-surface, ${b["background-surface"]}))`);
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.wireClose(), this.reducedMotion || requestAnimationFrame(() => this.centerPop(0.7));
  }
  // Hook up the dismiss button (re-run after tone re-renders the box)
  wireClose() {
    const t = this.shadowRoot.querySelector(".close");
    t && (this.hasAttribute("dismissible") && this.useHostFocusTarget(t), !t.wired && (t.wired = !0, t.addEventListener("click", () => this.dismiss())));
  }
  // A quick left-right jelly shake
  shake() {
    this.reducedMotion || !this.body || (this.shaking = 0.5, this.shakeT = 0, this.requestFrame());
  }
  // Announce the dismissal, then fade out and remove the element
  dismiss() {
    g(this, "dismiss"), this.style.transition = "opacity .18s ease, transform .18s ease", this.style.opacity = "0", this.style.transform = "scale(0.96)", setTimeout(() => this.remove(), 180);
  }
  // One animation step: alternate horizontal flings while shaking
  frame(t) {
    const e = this.body;
    return e ? (this.shaking > 0 && (this.shaking -= t, this.shakeT += t, this.shakeT >= 0.08 && (this.shakeT = 0, this.shakeDir = -this.shakeDir, e.stretchAlong(this.shakeDir, 0, 0.8))), e.update(t), this.clearCanvas(), this.paintBody(e, {
      fill: this.fill(),
      border: { color: this.resolveColor(`var(--jelly-alert-border, var(--jelly-color-border-default, ${b["border-default"]}))`), width: 1 }
    }), this.shaking > 0 || !e.isResting()) : !1;
  }
}
customElements.define("jelly-alert", pi);
const bi = ':host{display:block;position:relative;--jelly-fill: var(--jelly-color-background-surface);--jelly-radius: 22px;--jelly-card-padding-block: 22px;--jelly-card-padding-inline: 24px;--jelly-card-font-size: 15px;color:var(--jelly-color-foreground-default);font:400 var(--jelly-card-font-size)/1.55 var(--jelly-font-text)}:host([size="small"]){--jelly-radius: 18px;--jelly-card-padding-block: 16px;--jelly-card-padding-inline: 18px;--jelly-card-font-size: 13.5px}:host([size="large"]){--jelly-radius: 26px;--jelly-card-padding-block: 28px;--jelly-card-padding-inline: 30px;--jelly-card-font-size: 16.5px}:host([squish]){cursor:pointer}.card{position:relative;box-sizing:border-box;padding-block:var(--jelly-card-padding-block);padding-inline:var(--jelly-card-padding-inline);outline:none;touch-action:manipulation}.card:after{content:"";position:absolute;inset:-2px;border:var(--jelly-ring-width) solid transparent;border-radius:calc(var(--jelly-radius) + 3px);pointer-events:none}@media(forced-colors:active){.card{border:1px solid CanvasText;border-radius:var(--jelly-radius)}.card:focus-visible:after{border-color:Highlight}}::slotted(:first-child){margin-top:0}::slotted(:last-child){margin-bottom:0}';
class gi extends L {
  constructor() {
    super(...arguments), this.pressing = !1, this.squishWired = !1, this.kb = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["squish"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return bi;
  }
  // The interactive markup that sits above the canvas
  content() {
    return `<div class="card" part="card" ${this.hasAttribute("squish") ? 'tabindex="0" role="button"' : ""}><slot></slot></div>`;
  }
  // The rounded surface the physics body takes (radius follows the token)
  shape(t, e) {
    const i = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-radius")) || 22;
    return { width: t, height: e, radius: Math.min(i, Math.min(t, e) / 2) };
  }
  // A hairline on the jelly surface, resolved through the theme
  surfaceBorder() {
    return {
      color: this.resolveColor(`var(--jelly-color-border-default, ${b["border-default"]})`),
      width: 1
    };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.card = this.shadowRoot.querySelector(".card"), this.reducedMotion || requestAnimationFrame(() => this.centerPop(0.7)), this.syncSquish();
  }
  /*
   * Wire (or unwire) button behavior for squish mode. The card is a div
   * with role="button", so Space/Enter need preventDefault by hand - the
   * shared wirePress helper is for real buttons and would let Space scroll.
   */
  syncSquish() {
    if (!this.card)
      return;
    const t = this.hasAttribute("squish");
    if (t ? (this.card.setAttribute("tabindex", "0"), this.card.setAttribute("role", "button")) : (this.card.removeAttribute("tabindex"), this.card.removeAttribute("role"), this.pressing = !1, this.releaseBody()), !t || this.squishWired)
      return;
    this.squishWired = !0, this.useHostFocusTarget(this.card), this.trackFocus(this.card), this.card.addEventListener("pointerdown", (i) => {
      if (this.hasAttribute("squish")) {
        try {
          this.card.setPointerCapture(i.pointerId);
        } catch {
        }
        this.pressing = !0, this.pressAt(i.clientX, i.clientY, 1), T();
      }
    }), this.card.addEventListener("pointermove", (i) => {
      this.pressing && this.moveAt(i.clientX, i.clientY);
    });
    const e = () => {
      this.pressing && (this.pressing = !1, this.releaseBody());
    };
    this.card.addEventListener("pointerup", e), this.card.addEventListener("pointercancel", e), this.card.addEventListener("keydown", (i) => {
      this.hasAttribute("squish") && (i.key === "Enter" || i.key === " ") && !this.kb && (i.preventDefault(), this.kb = !0, this.centerPulse());
    }), this.card.addEventListener("keyup", () => {
      this.kb && (this.kb = !1, this.releaseBody(), g(this, "click"));
    });
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "squish" && this.syncSquish();
  }
  // Route programmatic host focus onto the card surface
  focus(t) {
    this.card?.focus(t);
  }
}
customElements.define("jelly-card", gi);
const yi = ':host{display:inline-flex;height:36px;--jelly-fill: var(--jelly-color-background-neutral);--jelly-on: var(--jelly-color-background-accent);--jelly-label: var(--jelly-color-foreground-on-neutral);--jelly-label-on: var(--jelly-color-foreground-on-accent);--jelly-ring: var(--jelly-fill, var(--jelly-color-border-focus));--jelly-chip-radius: 999px;font:600 14px/1 var(--jelly-font-display)}:host([size="small"]){height:30px;font-size:12.5px}:host([size="large"]){height:42px;font-size:15.5px}:host([shape="square"]){--jelly-chip-radius: 11px}:host([shape="square"][size="small"]){--jelly-chip-radius: 9px}:host([shape="square"][size="large"]){--jelly-chip-radius: 13px}:host([selected]){--jelly-ring: var(--jelly-on, var(--jelly-color-border-focus))}:host([disabled]){opacity:.5;pointer-events:none}:host{transition:transform .28s cubic-bezier(.4,0,.2,1),opacity .24s ease,width .34s cubic-bezier(.5,0,.15,1),margin .34s cubic-bezier(.5,0,.15,1)}:host(.removing){transform:scale(.74);opacity:0;overflow:hidden}.chip{display:inline-flex;align-items:center;height:100%;position:relative;white-space:nowrap}.main{appearance:none;border:0;background:transparent;font:inherit;color:var(--jelly-label);height:100%;padding-inline:17px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;border-radius:var(--jelly-chip-radius);position:relative;outline:none;touch-action:manipulation;transition:color .24s ease}:host([size="small"]) .main{padding-inline:13px;gap:5px}:host([size="large"]) .main{padding-inline:21px;gap:8px}span.main{cursor:default}:host([removable]) .main{padding-inline-end:4px}:host([selected]) .main{color:var(--jelly-label-on)}.remove{appearance:none;border:0;background:transparent;color:var(--jelly-label);cursor:pointer;touch-action:manipulation;position:relative;width:24px;height:24px;margin-inline-end:6px;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;opacity:.65;outline:none;transition:color .24s ease,opacity .15s ease}.remove:hover{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}:host([shape="square"]) .remove{border-radius:7px}.remove:focus-visible{outline:var(--jelly-ring-width) solid var(--jelly-ring-color);outline-offset:var(--jelly-ring-gap)}:host([selected]) .remove{color:var(--jelly-label-on)}.remove svg{width:13px;height:13px}:host([size="small"]) .remove{width:20px;height:20px;margin-inline-end:5px}:host([size="small"]) .remove svg{width:11px;height:11px}:host([size="small"]) .remove:before{content:"";position:absolute;inset:-2px}:host([size="large"]) .remove{width:28px;height:28px;margin-inline-end:8px}:host([size="large"]) .remove svg{width:15px;height:15px}@media(forced-colors:active){.chip{border:1px solid CanvasText;border-radius:999px}:host([selected]) .chip{border-width:3px}.main:focus-visible,.remove:focus-visible{outline:2px solid Highlight}}';
class mi extends L {
  constructor() {
    super(...arguments), this.onThemeFlip = () => {
      this.requestFrame();
    }, this.removeButton = null, this.selectTarget = null;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["selected", "disabled", "selectable", "removable", "variant", "shape"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("jelly-theme-change", this.onThemeFlip);
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener("jelly-theme-change", this.onThemeFlip);
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return yi + R({ color: "--jelly-on", on: "--jelly-label-on" });
  }
  // The interactive markup that sits above the canvas
  content() {
    const t = this.hasAttribute("selectable"), e = this.hasAttribute("removable"), i = this.hasAttribute("disabled") ? " disabled" : "", s = t ? `<button class="main" part="main" aria-pressed="${this.hasAttribute("selected")}"${i}><slot></slot></button>` : '<span class="main" part="main"><slot></slot></span>', r = e ? `<button class="remove" part="remove" aria-label="Remove"${i}>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
             <path d="M6 6l12 12M18 6L6 18" />
           </svg>
         </button>` : "";
    return `<div class="chip" part="chip">${s}${r}</div>`;
  }
  // The capsule (or, with shape="square", rounded rectangle) the physics body
  // takes, inset so the wobble stays inside
  shape(t, e) {
    const i = t - 6, s = e - 6, r = this.getAttribute("shape") === "square", o = parseFloat(getComputedStyle(this).getPropertyValue("--jelly-chip-radius")), l = Number.isFinite(o) && o < 900 ? Math.min(o, s / 2) : r ? s * 0.32 : s / 2;
    return { width: i, height: s, radius: l };
  }
  // The current fill along the off → on crossfade
  fill() {
    return this.mixFill(this.hasAttribute("selected") ? 1 : 0);
  }
  // Blend the off → on fills at factor t (0..1) so the color eases, not snaps.
  // Both endpoints resolve fresh each paint so a runtime --jelly-on / --jelly-fill
  // override (inline style, class swap) recolors the chip instead of being
  // pinned to a stale cached triple.
  mixFill(t) {
    return this.mixColor("var(--jelly-fill)", "var(--jelly-on)", t);
  }
  /*
   * Ease a selection factor so the jelly fill fades between tones instead
   * of flipping instantly. Runs whenever `selected` changes (or the body
   * wobbles).
   */
  frame(t) {
    const e = this.body;
    if (!e)
      return !1;
    const i = this.hasAttribute("selected") ? 1 : 0;
    return this.selectTarget == null && (this.selectTarget = i), this.selectTarget += (i - this.selectTarget) * Math.min(1, t * 11), Math.abs(i - this.selectTarget) < 4e-3 && (this.selectTarget = i), e.update(t), this.clearCanvas(), this.paintBody(e, { fill: this.mixFill(this.selectTarget), ring: this.focusRing() }), Math.abs(i - this.selectTarget) > 1e-3 || !e.isResting();
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.main = this.shadowRoot.querySelector(".main"), this.removeButton = this.shadowRoot.querySelector(".remove"), this.selectTarget = this.hasAttribute("selected") ? 1 : 0;
    const t = this.hasAttribute("selectable") || this.hasAttribute("removable");
    if (t) {
      const s = this.hasAttribute("selectable") ? this.main : this.removeButton;
      this.useHostFocusTarget(s);
    }
    const e = this.shadowRoot.querySelector(".chip");
    e.addEventListener("pointerdown", (s) => {
      this.hasAttribute("disabled") || this.pressAt(s.clientX, s.clientY, t ? 1 : 0.7);
    });
    const i = () => this.releaseBody();
    e.addEventListener("pointerup", i), e.addEventListener("pointercancel", i), e.addEventListener("pointerleave", i), this.hasAttribute("selectable") && (this.trackFocus(this.main), this.main.addEventListener("click", () => this.toggleSelected()), this.main.addEventListener("keydown", (s) => {
      s.key !== "Enter" && s.key !== " " || (s.preventDefault(), !(s.repeat || this.hasAttribute("disabled")) && this.main.click());
    })), this.removeButton && this.removeButton.addEventListener("click", (s) => {
      s.stopPropagation(), this.removeChip();
    });
  }
  // Flip the selection, pop the jelly and notify listeners
  toggleSelected() {
    const t = !this.hasAttribute("selected");
    this.toggleAttribute("selected", t), this.main.setAttribute("aria-pressed", String(t)), this.centerPop(t ? 1.05 : -0.85), T(), g(this, "change");
  }
  // Fire the cancelable remove event, then collapse out of the layout
  removeChip() {
    if (g(this, "remove", null, { cancelable: !0 }) === !1)
      return;
    if (this.centerPop(-1.1), T(), this.reducedMotion) {
      this.remove();
      return;
    }
    const t = parseFloat(getComputedStyle(this.parentElement || this).columnGap) || 0, e = this.getBoundingClientRect().width;
    this.style.width = `${e}px`, this.offsetWidth, this.classList.add("removing"), this.style.width = "0px", t && (this.style.marginInlineEnd = `-${t}px`);
    let i = !1;
    const s = () => {
      i || (i = !0, this.remove());
    };
    this.addEventListener("transitionend", (r) => {
      r.propertyName === "width" && s();
    }), setTimeout(s, 480);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (this.built)
      switch (t) {
        case "selectable":
        case "removable":
          this.rebuildContent();
          break;
        case "variant":
          this.requestFrame();
          break;
        case "selected":
          this.main?.tagName === "BUTTON" && this.main.setAttribute("aria-pressed", String(this.hasAttribute("selected"))), this.requestFrame();
          break;
        case "disabled":
          this.main?.tagName === "BUTTON" && (this.main.disabled = this.hasAttribute("disabled")), this.removeButton && (this.removeButton.disabled = this.hasAttribute("disabled")), this.syncHostFocusTarget();
          break;
        case "shape":
          this.reshapeMembrane();
          break;
      }
  }
  // Re-render the chip's interactive markup in place and re-wire it
  rebuildContent() {
    const t = this.shadowRoot.querySelector(".jelly-content");
    t && (t.innerHTML = this.content(), this.onBuilt(), this.requestFrame());
  }
  // The selection state as a property
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(t) {
    this.toggleAttribute("selected", !!t);
  }
  // Route programmatic host focus onto the main (or remove) button
  focus(t) {
    (this.main || this.removeButton)?.focus(t);
  }
}
customElements.define("jelly-chip", mi);
const fi = ':host{display:inline-flex;height:28px;--jelly-fill: var(--jelly-color-background-neutral);--jelly-label: var(--jelly-color-foreground-on-neutral);font:640 12px/1 var(--jelly-font-mono);cursor:pointer;outline:none}:host([size="small"]){height:24px;font-size:11px}:host([size="large"]){height:34px;font-size:13px}.cap{display:inline-flex;align-items:center;justify-content:center;height:100%;min-width:16px;padding-inline:8px;position:relative;color:var(--jelly-label);transition:transform .09s ease;touch-action:manipulation}:host([size="small"]) .cap{min-width:14px;padding-inline:7px}:host([size="large"]) .cap{min-width:20px;padding-inline:10px}:host(.pressed) .cap{transform:translateY(2px)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .cap{transition:none}}:host-context([data-jelly-motion="reduce"]) .cap{transition:none}@media(forced-colors:active){.cap{border:1px solid ButtonText;border-radius:6px}:host(:focus-visible) .cap{outline:2px solid Highlight}}';
class vi extends L {
  constructor() {
    super(...arguments), this.onDocumentKeyDown = null, this.onDocumentKeyUp = null;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["key"];
  }
  // Component styles layered over the shared jelly base styles
  styles() {
    return fi;
  }
  // The interactive markup that sits above the canvas
  content() {
    return '<span class="cap" part="cap"><slot></slot></span>';
  }
  // The keycap the physics body takes, with gently squared corners
  shape(t, e) {
    return {
      width: t - 2,
      height: e - 2,
      radius: Math.min(10, (e - 2) * 0.34)
    };
  }
  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt() {
    this.tabIndex = 0, this.setAttribute("role", "button"), this.trackFocus(this), this.addEventListener("pointerdown", this), this.addEventListener("pointerup", this), this.addEventListener("pointercancel", this), this.addEventListener("pointerleave", this), this.addEventListener("keydown", this), this.addEventListener("keyup", this), this.addEventListener("blur", this), this.armKeyMirror();
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback() {
    this.built && this.armKeyMirror();
  }
  // Lifecycle method: Called automatically when the element is appended to the
  // DOM. Re-arm the document-wide key mirror - disconnectedCallback dropped it,
  // and a kbd that is detached and re-appended should keep mirroring its key.
  connectedCallback() {
    super.connectedCallback(), this.built && this.armKeyMirror();
  }
  /*
   * With key="…" the cap mirrors that physical key document-wide. Idempotent:
   * the old listener pair is always dropped first, so connect / re-connect /
   * key changes never stack listeners.
   */
  armKeyMirror() {
    this.disarmKeyMirror();
    const t = this.getAttribute("key");
    t && (this.onDocumentKeyDown = (e) => {
      e.key.toLowerCase() === t.toLowerCase() && !e.repeat && this.press();
    }, this.onDocumentKeyUp = (e) => {
      e.key.toLowerCase() === t.toLowerCase() && this.release();
    }, document.addEventListener("keydown", this.onDocumentKeyDown), document.addEventListener("keyup", this.onDocumentKeyUp));
  }
  // Drop the document-wide key mirror listeners, if any are wired
  disarmKeyMirror() {
    this.onDocumentKeyDown && this.onDocumentKeyUp && (document.removeEventListener("keydown", this.onDocumentKeyDown), document.removeEventListener("keyup", this.onDocumentKeyUp), this.onDocumentKeyDown = null, this.onDocumentKeyUp = null);
  }
  // Handle callback events
  handleEvent(t) {
    switch (t.type) {
      case "pointerdown": {
        const e = t;
        try {
          this.setPointerCapture(e.pointerId);
        } catch {
        }
        this.press(e.clientX, e.clientY);
        break;
      }
      case "pointerup":
      case "pointercancel":
      case "pointerleave":
        this.release();
        break;
      case "keydown": {
        const e = t;
        if (e.key !== "Enter" && e.key !== " " || this.keyboardActive || e.repeat)
          return;
        e.preventDefault(), this.keyboardActive = !0, this.press();
        break;
      }
      case "keyup": {
        const e = t;
        if (e.key !== "Enter" && e.key !== " ")
          return;
        e.preventDefault(), this.keyboardActive = !1, this.release();
        break;
      }
      case "blur":
        this.keyboardActive = !1, this.release();
        break;
    }
  }
  // Depress the cap: bulge from the pointer, or squish from the center
  press(t, e) {
    this.classList.add("pressed"), t != null && e != null ? this.pressAt(t, e, 1) : this.centerPulse(0.9);
  }
  // Let the cap travel back up and the jelly settle
  release() {
    this.classList.contains("pressed") && (this.classList.remove("pressed"), this.releaseBody());
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    super.disconnectedCallback(), this.disarmKeyMirror();
  }
}
customElements.define("jelly-kbd", vi);
const xi = ':host{display:block;flex:1 1 100%;align-self:center;--jelly-divider: var(--jelly-color-border-default);--jelly-divider-font-size: 12px;--jelly-divider-gap: 14px}:host([size="small"]){--jelly-divider-font-size: 11px;--jelly-divider-gap: 10px}:host([size="large"]){--jelly-divider-font-size: 13.5px;--jelly-divider-gap: 18px}:host([direction="vertical"]){display:inline-block;flex:0 0 auto;align-self:stretch;width:auto;min-height:1em}:host([direction="vertical"]:not(:empty)),:host([direction="vertical"][content]){min-width:calc(var(--jelly-divider-font-size) + 2px)}.line{height:1px;background:var(--jelly-divider)}:host([direction="vertical"]) .line{width:1px;height:100%}.labelled{display:flex;align-items:center;gap:var(--jelly-divider-gap);color:var(--jelly-color-foreground-muted);font:600 var(--jelly-divider-font-size)/1 var(--jelly-font-display);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}.labelled:before,.labelled:after{content:"";flex:1;height:1px;background:var(--jelly-divider)}.labelled.vertical{height:100%;flex-direction:column;justify-content:center}.labelled.vertical:before,.labelled.vertical:after{width:1px;height:auto}.labelled.vertical .label{writing-mode:vertical-rl;text-orientation:mixed}';
class ji extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["direction", "content", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), !this.built && (this.built = !0, this.setAttribute("role", "separator"), this.attachShadow({ mode: "open" }), this.render());
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this), this.built && this.render();
  }
  // The optional visible text: the content attribute, falling back to slotted
  // text. Exposed as `content` (matching the attribute); `label` stays as an
  // alias, though across the rest of the library `label` means the aria-label.
  get content() {
    return this.getAttribute("content") ?? (this.textContent ?? "").trim();
  }
  get label() {
    return this.content;
  }
  // Rebuild the line (or labelled line) for the current attributes
  render() {
    const t = this.getAttribute("direction") === "vertical", e = this.label;
    t ? this.setAttribute("aria-orientation", "vertical") : this.removeAttribute("aria-orientation"), this.shadowRoot.innerHTML = `
      <style>${xi}</style>

      ${e ? `<div class="labelled${t ? " vertical" : ""}"><span class="label">${B(e)}</span></div>` : '<div class="line"></div>'}
    `;
  }
}
customElements.define("jelly-divider", ji);
const wi = ':host{display:block;--jelly-collapsible-padding-block: 13px;--jelly-collapsible-padding-inline: 14px;--jelly-collapsible-gap: 10px;--jelly-collapsible-header-font: 15px;--jelly-collapsible-body-font: 14.5px;--jelly-collapsible-chevron: 16px;--jelly-collapsible-radius: 12px}:host([size="small"]){--jelly-collapsible-padding-block: 10px;--jelly-collapsible-padding-inline: 12px;--jelly-collapsible-gap: 8px;--jelly-collapsible-header-font: 13.5px;--jelly-collapsible-body-font: 13px;--jelly-collapsible-chevron: 14px;--jelly-collapsible-radius: 10px}:host([size="large"]){--jelly-collapsible-padding-block: 16px;--jelly-collapsible-padding-inline: 18px;--jelly-collapsible-gap: 12px;--jelly-collapsible-header-font: 16.5px;--jelly-collapsible-body-font: 15.5px;--jelly-collapsible-chevron: 18px;--jelly-collapsible-radius: 14px}.head{appearance:none;width:100%;box-sizing:border-box;border:0;margin:0;background:transparent;cursor:pointer;touch-action:manipulation;text-align:start;display:flex;align-items:center;gap:var(--jelly-collapsible-gap);padding-block:var(--jelly-collapsible-padding-block);padding-inline:var(--jelly-collapsible-padding-inline);font:650 var(--jelly-collapsible-header-font)/1.3 var(--jelly-font-display);color:var(--jelly-color-foreground-default);border-radius:var(--jelly-collapsible-radius)}.head:hover{background:color-mix(in srgb,var(--jelly-color-background-accent) 7%,transparent)}.head:focus-visible{outline:var(--jelly-ring-width) solid var(--jelly-ring-color);outline-offset:var(--jelly-ring-gap)}.label{flex:1}.chevron{width:var(--jelly-collapsible-chevron);height:var(--jelly-collapsible-chevron);flex:0 0 auto;transition:transform .32s cubic-bezier(.34,1.5,.5,1)}:host(:dir(rtl)) .chevron{transform:scaleX(-1)}:host([open]) .chevron{transform:rotate(90deg)}.wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows .36s cubic-bezier(.28,1.35,.5,1)}:host([open]) .wrap{grid-template-rows:1fr}.content{overflow:hidden;visibility:hidden;transition:visibility 0s linear .36s}:host([open]) .content{visibility:visible;transition:visibility 0s}.inner{padding-block-start:2px;padding-block-end:var(--jelly-collapsible-padding-inline);padding-inline:var(--jelly-collapsible-padding-inline);color:var(--jelly-color-foreground-default);font:400 var(--jelly-collapsible-body-font)/1.6 var(--jelly-font-text);transform-origin:top}:host([open]) .inner{animation:pop .42s cubic-bezier(.34,1.56,.64,1)}@keyframes pop{0%{transform:translateY(-6px) scale(.99)}to{transform:none}}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) :is(.wrap,.chevron,.content){transition:none}:host([open]):host-context(html:not([data-jelly-motion="no-preference"])) .inner{animation:none}:host(:dir(rtl)):host-context(html:not([data-jelly-motion="no-preference"])) .chevron{transform:scaleX(-1)}}:host-context([data-jelly-motion="reduce"]) :is(.wrap,.chevron,.content){transition:none}:host([open]):host-context([data-jelly-motion="reduce"]) .inner{animation:none}:host(:dir(rtl)):host-context([data-jelly-motion="reduce"]) .chevron{transform:scaleX(-1)}@media(forced-colors:active){.head:focus-visible{outline:2px solid Highlight}}';
class ki extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["open", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    if (z(), j(this), this.built)
      return;
    this.built = !0;
    const t = X("jelly-collapsible");
    this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${wi}</style>

      <button class="head" part="header" id="${t}-header" aria-expanded="${this.hasAttribute("open")}" aria-controls="${t}-panel">
        <span class="label"><slot name="header">Details</slot></span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>

      <div class="wrap">
        <div class="content" id="${t}-panel" role="region" aria-labelledby="${t}-header">
          <div class="inner"><slot></slot></div>
        </div>
      </div>
    `, this.head = this.shadowRoot.querySelector(".head"), this.head.addEventListener("click", () => this.toggle());
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (t === "size") {
      j(this);
      return;
    }
    this.head?.setAttribute("aria-expanded", String(this.hasAttribute("open")));
  }
  // Flip (or force) the open state; fires exactly one toggle per real change
  toggle(t) {
    const e = this.hasAttribute("open"), i = t ?? !e;
    i !== e && (this.toggleAttribute("open", i), g(this, "toggle"));
  }
  // The open state as a property
  get open() {
    return this.hasAttribute("open");
  }
  set open(t) {
    this.toggle(!!t);
  }
  // Route programmatic host focus onto the header button
  focus(t) {
    this.head?.focus(t);
  }
}
customElements.define("jelly-collapsible", ki);
const Ci = ":host{display:block}::slotted(jelly-collapsible){display:block;border-radius:var(--jelly-accordion-radius, 12px)}::slotted(jelly-collapsible + jelly-collapsible){border-top:1px solid var(--jelly-color-border-default);border-radius:0}";
class Ai extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["single", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), !this.built && (this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${Ci}</style>

      <slot></slot>
    `, this.shadowRoot.querySelector("slot").addEventListener("slotchange", () => {
      q(this, "jelly-collapsible");
    }), q(this, "jelly-collapsible"), this.addEventListener("toggle", (t) => {
      if (!this.hasAttribute("single"))
        return;
      const e = t.target;
      if (!(!e || !e.matches("jelly-collapsible") || !e.open))
        for (const i of this.querySelectorAll("jelly-collapsible"))
          i !== e && i.open && i.toggle(!1);
    }));
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    if (t === "size" && (j(this), q(this, "jelly-collapsible")), t === "single" && this.built && this.hasAttribute("single")) {
      let e = !1;
      for (const i of this.querySelectorAll("jelly-collapsible"))
        i.open && (e ? i.toggle(!1) : e = !0);
    }
  }
  // Route programmatic host focus onto the first item
  focus(t) {
    this.querySelector("jelly-collapsible")?.focus(t);
  }
}
customElements.define("jelly-accordion", Ai);
const zi = ":host{display:block}.bar{display:flex}.panels{padding-block-start:16px}";
class Li extends HTMLElement {
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), this.setAttribute("role", "tabpanel");
    const t = this.getAttribute("label");
    !this.hasAttribute("aria-label") && t && this.setAttribute("aria-label", t), this.hasAttribute("active") || (this.hidden = !0);
  }
  // The tab label shown in the tab bar
  get label() {
    return this.getAttribute("label") || "";
  }
}
class Si extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.segmented = null, this.current = null;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["size", "value"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    if (z(), this.built)
      return;
    this.built = !0;
    const t = [...this.querySelectorAll("jelly-tab-panel")], e = Math.max(0, t.findIndex((r) => r.hasAttribute("active"))), i = t[e], s = this.getAttribute("value") ?? (i ? this.panelValue(i, e) : "0");
    this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${zi}</style>

      <div class="bar">
        <jelly-segmented part="tabs" roles="tablist" value="${B(s)}">
          ${t.map(
      (r, o) => `<jelly-segment value="${B(this.panelValue(r, o))}">${B(this.panelLabel(r, o))}</jelly-segment>`
    ).join("")}
        </jelly-segmented>
      </div>

      <div class="panels"><slot></slot></div>
    `, this.segmented = this.shadowRoot.querySelector("jelly-segmented"), this.current = null, this.syncSize(), this.segmented.addEventListener("change", (r) => {
      r.stopPropagation(), this.activate(this.segmented.value, !0);
    }), this.activate(s, !1);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && this.syncSize(), t === "value" && this.syncValue();
  }
  // Reflect a host value attribute into the tab bar (a no-op when it already
  // matches, so the change event only fires for real switches)
  syncValue() {
    const t = this.getAttribute("value");
    !this.segmented || t == null || String(t) === this.current || (this.segmented.setAttribute("value", t), this.activate(t, !0));
  }
  // Pass the host's size down to the tab bar
  syncSize() {
    if (!this.segmented)
      return;
    const t = this.getAttribute("size");
    t ? this.segmented.setAttribute("size", t) : this.segmented.removeAttribute("size");
  }
  // A panel's value: its explicit `value` attribute, else its index. Derived
  // on demand rather than cached on the panel - a panel that upgrades after
  // this controller (as happens when the tabs markup is set through a
  // connected element's innerHTML, the parent connecting before its children
  // upgrade) would have any stamped field reset to its class default.
  panelValue(t, e) {
    return t.getAttribute("value") || String(e);
  }
  // The visible label for one panel's tab
  panelLabel(t, e) {
    const i = t.getAttribute("label");
    return i || (t.textContent ?? "").trim() || `Tab ${e + 1}`;
  }
  // Show the panel for `value`, hide the rest and announce real changes
  activate(t, e) {
    [...this.querySelectorAll("jelly-tab-panel")].forEach((r, o) => {
      const l = this.panelValue(r, o) === String(t);
      r.hidden = !l, r.toggleAttribute("active", l), r.tabIndex = l ? 0 : -1, l && e && !F() && r.animate?.(
        [
          { opacity: 0, transform: "translateY(4px) scale(0.995)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" }
      );
    });
    const s = this.current;
    this.current = String(t), this.getAttribute("value") !== this.current && this.setAttribute("value", this.current), s !== null && s !== this.current && g(this, "change", { value: this.current });
  }
  // The active panel's value as a property
  get value() {
    return this.segmented?.value;
  }
  set value(t) {
    this.segmented?.setAttribute("value", t), this.activate(t, !0);
  }
  // Route programmatic host focus onto the active tab
  focus(t) {
    this.segmented?.focus(t);
  }
}
customElements.define("jelly-tab-panel", Li);
customElements.define("jelly-tabs", Si);
const Mi = ':host{display:block;--jelly-breadcrumbs-font-size: 13.5px;--jelly-breadcrumbs-padding-block: 4px;--jelly-breadcrumbs-padding-inline: 8px;--jelly-breadcrumbs-gap: 4px;--jelly-breadcrumbs-radius: 9px}:host([size="small"]){--jelly-breadcrumbs-font-size: 12px;--jelly-breadcrumbs-padding-block: 3px;--jelly-breadcrumbs-padding-inline: 6px;--jelly-breadcrumbs-gap: 3px;--jelly-breadcrumbs-radius: 8px}:host([size="large"]){--jelly-breadcrumbs-font-size: 15px;--jelly-breadcrumbs-padding-block: 5px;--jelly-breadcrumbs-padding-inline: 10px;--jelly-breadcrumbs-gap: 5px;--jelly-breadcrumbs-radius: 10px}ol{display:flex;flex-wrap:wrap;align-items:center;gap:var(--jelly-breadcrumbs-gap);margin:0;padding:0;list-style:none;font:600 var(--jelly-breadcrumbs-font-size)/1 var(--jelly-font-display)}a{color:var(--jelly-color-foreground-muted);text-decoration:none;padding-block:var(--jelly-breadcrumbs-padding-block);padding-inline:var(--jelly-breadcrumbs-padding-inline);border-radius:var(--jelly-breadcrumbs-radius);display:inline-block;transition:transform .18s cubic-bezier(.34,1.7,.5,1),color .15s,background .15s}a:hover{color:var(--jelly-color-background-accent);background:color-mix(in srgb,var(--jelly-color-background-accent) 9%,transparent);transform:scale(1.08)}a:active{transform:scale(.94)}a:focus-visible{outline:2px solid var(--jelly-ring-color);outline-offset:1px}.current{color:var(--jelly-color-foreground-default);font-weight:750;padding-block:var(--jelly-breadcrumbs-padding-block);padding-inline:var(--jelly-breadcrumbs-padding-inline)}.separator{color:var(--jelly-color-border-default);user-select:none}:host(:dir(rtl)) .separator{display:inline-block;transform:scaleX(-1)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) a{transition:none}:host-context(html:not([data-jelly-motion="no-preference"])) a:hover,:host-context(html:not([data-jelly-motion="no-preference"])) a:active{transform:none}}:host-context([data-jelly-motion="reduce"]) a{transition:none}:host-context([data-jelly-motion="reduce"]) a:hover,:host-context([data-jelly-motion="reduce"]) a:active{transform:none}';
class Ei extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.mutationObserver = null;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), !this.built && (this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.render(), this.mutationObserver = new MutationObserver(() => this.render()), this.mutationObserver.observe(this, { childList: !0, characterData: !0, subtree: !0, attributes: !0, attributeFilter: ["href"] }));
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    this.mutationObserver?.disconnect(), this.mutationObserver = null;
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this);
  }
  // Rebuild the trail from the current light-DOM children
  render() {
    const t = [...this.children], e = t.map((i) => ({
      text: (i.textContent ?? "").trim(),
      href: i.getAttribute("href")
    }));
    this.shadowRoot.innerHTML = `
      <style>${Mi}</style>

      <nav aria-label="Breadcrumb"><ol>${e.map((i, s) => {
      const r = s === e.length - 1;
      return (r ? `<li class="current" aria-current="page">${B(i.text)}</li>` : `<li><a href="${B(i.href || "#")}">${B(i.text)}</a></li>`) + (r ? "" : '<li class="separator" aria-hidden="true">›</li>');
    }).join("")}</ol></nav>
    `;
    for (const i of t)
      i.hidden = !0;
  }
  // Route programmatic host focus onto the first link
  focus(t) {
    this.shadowRoot?.querySelector("a")?.focus(t);
  }
}
customElements.define("jelly-breadcrumbs", Ei);
const Ti = ':host{display:block;--jelly-pagination-gap: 7px;--jelly-pagination-font-size: 14px;--jelly-pagination-gap-padding: 2px;--jelly-pagination-button: 40px;--jelly-pagination-button-pad: 10px}:host([size="small"]){--jelly-pagination-gap: 5px;--jelly-pagination-font-size: 12.5px;--jelly-pagination-gap-padding: 1px;--jelly-pagination-button: 34px;--jelly-pagination-button-pad: 8px}:host([size="large"]){--jelly-pagination-gap: 9px;--jelly-pagination-font-size: 15.5px;--jelly-pagination-gap-padding: 3px;--jelly-pagination-button: 48px;--jelly-pagination-button-pad: 12px}.row{display:inline-flex;align-items:center;gap:var(--jelly-pagination-gap);font:640 var(--jelly-pagination-font-size)/1 var(--jelly-font-display)}jelly-button{--jelly-button-height: var(--jelly-pagination-button);--jelly-button-min-width: var(--jelly-pagination-button);--jelly-button-padding-inline: var(--jelly-pagination-button-pad);--jelly-fill: var(--jelly-color-background-neutral);--jelly-label: var(--jelly-color-foreground-on-neutral)}jelly-button[aria-current]{--jelly-fill: var(--jelly-color-background-accent);--jelly-label: var(--jelly-color-foreground-on-accent)}.gap{color:var(--jelly-color-foreground-muted);padding-inline:var(--jelly-pagination-gap-padding)}';
class Fi extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.onDirectionChange = () => this.render();
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["total", "page", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), j(this), !this.built && (this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${Ti}</style>

      <div class="row" role="navigation" aria-label="Pagination"></div>
    `, this.row = this.shadowRoot.querySelector(".row"), window.addEventListener("jelly-theme-change", this.onDirectionChange), this.render());
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    window.removeEventListener("jelly-theme-change", this.onDirectionChange);
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this), this.row && this.render();
  }
  // Total page count (at least one)
  get total() {
    return Math.max(1, parseInt(this.getAttribute("total") ?? "", 10) || 1);
  }
  // The current page, clamped into range
  get page() {
    return Math.min(this.total, Math.max(1, parseInt(this.getAttribute("page") ?? "", 10) || 1));
  }
  set page(t) {
    this.setAttribute("page", String(t));
  }
  // The size passed to the child buttons (pagination defaults to small)
  get buttonSize() {
    return this.getAttribute("size") || "small";
  }
  // The windowed page list: first, last, current ±1, with … in the gaps
  pagesToShow() {
    const t = this.total, e = this.page, i = [], s = 1;
    for (let r = 1; r <= t; r++)
      r === 1 || r === t || r >= e - s && r <= e + s ? i.push(r) : i[i.length - 1] !== "…" && i.push("…");
    return i;
  }
  // Navigate to a page and announce the change
  go(t) {
    t < 1 || t > this.total || t === this.page || (this.page = t, g(this, "change", { page: t }));
  }
  // Rebuild the row of page buttons for the current state
  render() {
    const t = this.page, e = k(this), i = (o, l, { current: d = !1, disabled: h = !1, name: a = null } = {}) => {
      const c = document.createElement("jelly-button");
      return c.setAttribute("size", this.buttonSize), c.textContent = o, d && c.setAttribute("aria-current", "page"), h && c.setAttribute("disabled", ""), a && c.setAttribute("label", a), c.addEventListener("click", () => this.go(l)), c;
    }, s = e ? "›" : "‹", r = e ? "‹" : "›";
    this.row.textContent = "", this.row.appendChild(i(s, t - 1, { disabled: t === 1, name: "Previous page" }));
    for (const o of this.pagesToShow())
      if (o === "…") {
        const l = document.createElement("span");
        l.className = "gap", l.textContent = "…", l.setAttribute("aria-hidden", "true"), this.row.appendChild(l);
      } else
        this.row.appendChild(i(String(o), o, { current: o === t }));
    this.row.appendChild(i(r, t + 1, { disabled: t === this.total, name: "Next page" }));
  }
  // Route programmatic host focus onto the current (or first enabled) page
  focus(t) {
    const e = this.shadowRoot.querySelector("[aria-current]"), i = [...this.shadowRoot.querySelectorAll("jelly-button")].find((s) => !s.hasAttribute("disabled"));
    (e || i)?.focus(t);
  }
}
customElements.define("jelly-pagination", Fi);
const Ii = ':host{display:block;--jelly-resizable-line: var(--jelly-color-border-default);--jelly-resizable-handle: var(--jelly-color-background-neutral);--jelly-resizable-handle-active: var(--jelly-color-background-accent)}.container{display:flex;flex-direction:row;width:100%;height:100%}:host([direction="vertical"]) .container{flex-direction:column}:host([direction="both"]) .container{display:grid;grid-template-columns:minmax(0,var(--jelly-resizable-col-a, 1fr)) 14px minmax(0,var(--jelly-resizable-col-b, 1fr));grid-template-rows:minmax(0,var(--jelly-resizable-row-a, 1fr)) 14px minmax(0,var(--jelly-resizable-row-b, 1fr))}:host([direction="both"]) slot{display:flex;min-width:0;min-height:0;overflow:hidden}:host([direction="both"]) slot[name=p0]{grid-area:1 / 1}:host([direction="both"]) slot[name=p1]{grid-area:1 / 3}:host([direction="both"]) slot[name=p2]{grid-area:3 / 1}:host([direction="both"]) slot[name=p3]{grid-area:3 / 3}:host([direction="both"]) slot:nth-of-type(n+5){display:none}.divider{position:relative;flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:14px;cursor:col-resize;touch-action:none;outline:none;border-radius:999px}.divider:before{content:"";position:absolute;background:var(--jelly-resizable-line);inset:0 50%;width:1px;transform:translate(-50%)}:host([direction="vertical"]) .divider:before,:host([direction="both"]) .divider-y:before{inset:50% 0;width:auto;height:1px;transform:translateY(-50%)}:host([direction="vertical"]) .divider{width:auto;height:14px;cursor:row-resize}:host([direction="both"]) .divider{width:auto;height:auto}:host([direction="both"]) .divider-x{grid-area:1 / 2 / 4 / 3;cursor:col-resize}:host([direction="both"]) .divider-y{grid-area:2 / 1 / 3 / 4;cursor:row-resize}.divider b{display:block;background:var(--jelly-resizable-handle);border-radius:999px;transition:width .18s cubic-bezier(.34,1.7,.5,1),height .18s cubic-bezier(.34,1.7,.5,1),background .15s;width:5px;height:42px}:host([direction="vertical"]) .divider b,:host([direction="both"]) .divider-y b{width:42px;height:5px}:host([direction="both"]) .divider-x b{width:5px;height:42px}.divider:hover b,.divider:focus-visible b{background:var(--jelly-resizable-handle-active);width:10px}:host([direction="vertical"]) .divider:hover b,:host([direction="vertical"]) .divider:focus-visible b,:host([direction="both"]) .divider-y:hover b,:host([direction="both"]) .divider-y:focus-visible b{width:42px;height:10px}:host([direction="both"]) .divider-x:hover b,:host([direction="both"]) .divider-x:focus-visible b{width:10px;height:42px}.divider.drag b{background:var(--jelly-resizable-handle-active);width:12px}:host([direction="vertical"]) .divider.drag b,:host([direction="both"]) .divider-y.drag b{width:42px;height:12px}:host([direction="both"]) .divider-x.drag b{width:12px;height:42px}@media(forced-colors:active){.divider b{background:ButtonText}.divider:focus-visible{outline:2px solid Highlight}}';
class Bi extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.grow = [], this.colGrow = [1, 1], this.rowGrow = [1, 1], this.endDrag = null;
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["direction"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), !this.built && (this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.render());
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    this.endDrag?.();
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback() {
    this.built && this.render();
  }
  // True for the 2×2 two-axis layout
  get isBothAxes() {
    return this.getAttribute("direction") === "both";
  }
  // True when panes stack top-to-bottom
  get vertical() {
    return this.getAttribute("direction") === "vertical";
  }
  // The current pane fractions (each axis sums to 1). A single-axis layout
  // returns a flat array; the 2×2 layout returns { cols, rows }. Carried in
  // the change event detail so a listener can read the resulting layout.
  get sizes() {
    const t = (e) => {
      const i = e.reduce((s, r) => s + r, 0) || 1;
      return e.map((s) => s / i);
    };
    return this.isBothAxes ? { cols: t(this.colGrow), rows: t(this.rowGrow) } : t(this.grow);
  }
  // Rebuild panes and dividers for the current direction
  render() {
    const t = [...this.children];
    this.grow = t.map(() => 1), t.forEach((i, s) => {
      i.slot = `p${s}`, i.style.flex = "1 1 0", i.style.overflow = "auto", i.style.minWidth = "0", i.style.minHeight = "0";
    });
    let e = "";
    if (this.isBothAxes) {
      for (let i = 0; i < Math.max(4, t.length); i++)
        e += `<slot name="p${i}"></slot>`;
      e += `
        <span class="divider divider-x" data-axis="x" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize columns"><b></b></span>
        <span class="divider divider-y" data-axis="y" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Resize rows"><b></b></span>`;
    } else
      t.forEach((i, s) => {
        e += `<slot name="p${s}"></slot>`, s < t.length - 1 && (e += `<span class="divider" data-i="${s}" role="separator" tabindex="0"
                      aria-orientation="${this.vertical ? "horizontal" : "vertical"}"
                      aria-label="Resize panels ${s + 1} and ${s + 2}"><b></b></span>`);
      });
    this.shadowRoot.innerHTML = `
      <style>${Ii}</style>

      <div class="container" part="container">${e}</div>
    `, this.container = this.shadowRoot.querySelector(".container"), this.shadowRoot.querySelectorAll(".divider").forEach((i) => {
      i.addEventListener("pointerdown", (s) => this.onDividerDown(s, i)), i.addEventListener("keydown", (s) => this.onDividerKey(s, Number(i.dataset.i)));
    }), this.syncDirection(), this.syncSeparatorValues();
  }
  // Keep aria-orientation (and the 2×2 tracks) in sync with the direction
  syncDirection() {
    if (this.isBothAxes) {
      this.shadowRoot?.querySelector(".divider-x")?.setAttribute("aria-orientation", "vertical"), this.shadowRoot?.querySelector(".divider-y")?.setAttribute("aria-orientation", "horizontal"), this.applyBoth();
      return;
    }
    const t = this.vertical ? "horizontal" : "vertical";
    this.shadowRoot?.querySelectorAll(".divider").forEach((e) => {
      e.setAttribute("aria-orientation", t);
    });
  }
  /*
   * Window-splitter values: each separator reports the size of its first
   * pane as a percentage of the pair (0–100), kept live through drags and
   * keyboard resizes.
   */
  syncSeparatorValues() {
    const t = (e, i) => String(Math.round(e / (e + i) * 100));
    for (const e of this.shadowRoot?.querySelectorAll(".divider") || [])
      if (e.setAttribute("aria-valuemin", "0"), e.setAttribute("aria-valuemax", "100"), this.isBothAxes) {
        const i = e.dataset.axis === "x" ? this.colGrow : this.rowGrow;
        e.setAttribute("aria-valuenow", t(i[0], i[1]));
      } else {
        const i = Number(e.dataset.i);
        e.setAttribute("aria-valuenow", t(this.grow[i], this.grow[i + 1]));
      }
  }
  // Start a divider drag (single-axis layouts)
  onDividerDown(t, e) {
    if (this.isBothAxes) {
      this.onDividerDownBoth(t, e);
      return;
    }
    const i = Number(e.dataset.i);
    e.setPointerCapture(t.pointerId), e.classList.add("drag");
    const s = this.container.getBoundingClientRect(), r = this.vertical ? s.height : s.width, o = this.vertical ? t.clientY : t.clientX, l = !this.vertical && k(this) ? -1 : 1, d = this.grow[i], h = this.grow[i + 1], a = d + h, c = (u) => {
      const v = ((this.vertical ? u.clientY : u.clientX) - o) * l / r * this.grow.reduce((S, M) => S + M, 0), x = Math.max(0.08, d + v), y = Math.max(0.08, h - v), w = x + y;
      this.grow[i] = x / w * a, this.grow[i + 1] = y / w * a, this.apply();
    }, p = (u) => {
      e.classList.remove("drag"), e.releasePointerCapture(u.pointerId), this.endDrag?.(), g(this, "change", { sizes: this.sizes });
    };
    this.endDrag = () => {
      window.removeEventListener("pointermove", c), window.removeEventListener("pointerup", p), window.removeEventListener("pointercancel", p), this.endDrag = null;
    }, window.addEventListener("pointermove", c), window.addEventListener("pointerup", p), window.addEventListener("pointercancel", p);
  }
  // Start a divider drag (2×2 layout)
  onDividerDownBoth(t, e) {
    const i = e.dataset.axis;
    if (i !== "x" && i !== "y")
      return;
    e.setPointerCapture(t.pointerId), e.classList.add("drag");
    const s = this.container.getBoundingClientRect(), r = i === "x" ? s.width : s.height, o = i === "x" ? t.clientX : t.clientY, l = i === "x" && k(this) ? -1 : 1, d = i === "x" ? this.colGrow : this.rowGrow, h = d[0], a = d[1], c = h + a, p = (f) => {
      const v = ((i === "x" ? f.clientX : f.clientY) - o) * l / r * c, x = Math.max(0.12, h + v), y = Math.max(0.12, a - v), w = x + y;
      d[0] = x / w * c, d[1] = y / w * c, this.applyBoth();
    }, u = (f) => {
      e.classList.remove("drag"), e.releasePointerCapture(f.pointerId), this.endDrag?.(), g(this, "change", { sizes: this.sizes });
    };
    this.endDrag = () => {
      window.removeEventListener("pointermove", p), window.removeEventListener("pointerup", u), window.removeEventListener("pointercancel", u), this.endDrag = null;
    }, window.addEventListener("pointermove", p), window.addEventListener("pointerup", u), window.addEventListener("pointercancel", u);
  }
  // Keyboard resize: arrows move the divider (direction-aware), one step at a
  // time; Home/End drive it to the minimum / maximum (nudge clamps the ends)
  onDividerKey(t, e) {
    const s = t.currentTarget?.dataset.axis;
    if (t.key === "Home" || t.key === "End") {
      const o = t.key === "End";
      this.isBothAxes ? this.nudgeBoth(s, o ? 1 : -1) : this.nudge(e, o ? 1 : -1), t.preventDefault();
      return;
    }
    if (this.isBothAxes) {
      if (s === "x") {
        const o = O(t.key, k(this));
        o !== 0 && (this.nudgeBoth("x", o * 0.12), t.preventDefault());
      } else s === "y" && (t.key === "ArrowUp" || t.key === "ArrowDown") && (this.nudgeBoth("y", t.key === "ArrowDown" ? 0.12 : -0.12), t.preventDefault());
      return;
    }
    if (this.vertical) {
      (t.key === "ArrowUp" || t.key === "ArrowDown") && (this.nudge(e, t.key === "ArrowDown" ? 0.12 : -0.12), t.preventDefault());
      return;
    }
    const r = O(t.key, k(this));
    r !== 0 && (this.nudge(e, r * 0.12), t.preventDefault());
  }
  // Grow one pane of a pair by d (single-axis layouts)
  nudge(t, e) {
    this.grow[t] = Math.max(0.08, this.grow[t] + e), this.grow[t + 1] = Math.max(0.08, this.grow[t + 1] - e), this.apply(), g(this, "change", { sizes: this.sizes });
  }
  // Grow one track of an axis by d (2×2 layout)
  nudgeBoth(t, e) {
    const i = t === "x" ? this.colGrow : this.rowGrow, s = i[0] + i[1];
    i[0] = Math.max(0.12, i[0] + e), i[1] = Math.max(0.12, i[1] - e);
    const r = i[0] + i[1];
    i[0] = i[0] / r * s, i[1] = i[1] / r * s, this.applyBoth(), g(this, "change", { sizes: this.sizes });
  }
  // Push the flex weights onto the panes
  apply() {
    [...this.children].forEach((e, i) => {
      e.style.flex = `${this.grow[i]} 1 0`;
    }), this.syncSeparatorValues();
  }
  // Push the track weights onto the 2×2 grid
  applyBoth() {
    this.container?.style.setProperty("--jelly-resizable-col-a", `${this.colGrow[0]}fr`), this.container?.style.setProperty("--jelly-resizable-col-b", `${this.colGrow[1]}fr`), this.container?.style.setProperty("--jelly-resizable-row-a", `${this.rowGrow[0]}fr`), this.container?.style.setProperty("--jelly-resizable-row-b", `${this.rowGrow[1]}fr`), this.syncSeparatorValues();
  }
  // Route programmatic host focus onto the first divider
  focus(t) {
    this.shadowRoot?.querySelector(".divider")?.focus(t);
  }
}
customElements.define("jelly-resizable", Bi);
const Ri = ':host{display:inline-flex;--jelly-tooltip-font-size: 12.5px;--jelly-tooltip-padding-block: 7px;--jelly-tooltip-padding-inline: 11px;--jelly-tooltip-radius: 11px;--jelly-tooltip-max-width: 240px;--jelly-tooltip-background: var(--jelly-color-foreground-default);--jelly-tooltip-color: var(--jelly-color-background-default)}:host([size="small"]){--jelly-tooltip-font-size: 11.5px;--jelly-tooltip-padding-block: 6px;--jelly-tooltip-padding-inline: 9px;--jelly-tooltip-radius: 9px;--jelly-tooltip-max-width: 200px}:host([size="large"]){--jelly-tooltip-font-size: 14px;--jelly-tooltip-padding-block: 9px;--jelly-tooltip-padding-inline: 13px;--jelly-tooltip-radius: 13px;--jelly-tooltip-max-width: 280px}.bubble{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;background:var(--jelly-tooltip-background);color:var(--jelly-tooltip-color);font:600 var(--jelly-tooltip-font-size)/1.35 var(--jelly-font-display);padding-block:var(--jelly-tooltip-padding-block);padding-inline:var(--jelly-tooltip-padding-inline);border-radius:var(--jelly-tooltip-radius);width:max-content;max-width:var(--jelly-tooltip-max-width);opacity:0;visibility:hidden}.bubble[data-show]{opacity:1;visibility:visible}@media(forced-colors:active){.bubble{border:1px solid CanvasText}}';
class Pi extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.untrack = null, this.onDocumentKey = (t) => {
      t.key === "Escape" && this.hide();
    };
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["text", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    if (z(), j(this), this.built)
      return;
    this.built = !0;
    const t = X("jelly-tooltip");
    this.attachShadow({ mode: "open" }), this.shadowRoot.innerHTML = `
      <style>${Ri}</style>

      <slot></slot>

      <div class="bubble" role="tooltip" id="${t}"><slot name="content"></slot></div>
    `, this.bubble = this.shadowRoot.querySelector(".bubble"), this.contentSlot = this.shadowRoot.querySelector('slot[name="content"]'), this.syncText(), this.addEventListener("pointerenter", this), this.addEventListener("pointerleave", this), this.addEventListener("focusin", this), this.addEventListener("focusout", this), this.shadowRoot.querySelector("slot:not([name])").addEventListener("slotchange", () => this.syncDescription()), this.syncDescription();
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    this.hide();
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    switch (t) {
      case "size":
        j(this), this.reposition();
        break;
      case "text":
        this.syncText(), this.syncDescription(), this.reposition();
        break;
    }
  }
  // Copy the text attribute into the bubble's content slot
  syncText() {
    this.contentSlot && (this.contentSlot.textContent = this.getAttribute("text") || "");
  }
  // Content and size changes alter the bubble's dimensions. Re-anchor an
  // already-visible tooltip immediately instead of waiting for the next
  // pointer movement, scroll, or resize event.
  reposition() {
    if (!this.bubble?.hasAttribute("data-show"))
      return;
    const t = this.getAttribute("placement") || "top";
    W(this, this.bubble, t, 8);
  }
  /*
   * Expose the tooltip text as the trigger's accessible description.
   * An aria-describedby idref cannot point into this shadow root from the
   * light-DOM trigger, so the description is set via ARIA reflection
   * directly on the slotted element (skipped gracefully where unsupported).
   */
  syncDescription() {
    const t = this.querySelector(":scope > :not([slot])") || this.firstElementChild;
    t && "ariaDescription" in t && (t.ariaDescription = this.getAttribute("text") || "");
  }
  // Position the bubble over the trigger and fade it in
  show() {
    const t = this.getAttribute("placement") || "top", e = this.bubble;
    e.setAttribute("data-show", ""), W(this, e, t, 8), this.untrack?.(), this.untrack = lt(this, e, t, 8), document.addEventListener("keydown", this.onDocumentKey), at(e, "center");
  }
  // Hide the bubble and stop tracking the trigger
  hide() {
    this.untrack?.(), this.untrack = null, document.removeEventListener("keydown", this.onDocumentKey), this.bubble?.removeAttribute("data-show");
  }
  // Handle callback events
  handleEvent(t) {
    switch (t.type) {
      case "pointerenter":
        this.show();
        break;
      case "focusin":
        this.show();
        break;
      case "pointerleave":
        this.hide();
        break;
      case "focusout":
        this.hide();
        break;
    }
  }
}
customElements.define("jelly-tooltip", Pi);
const Hi = ':host{display:inline-flex;position:relative;--jelly-popover-min-width: 180px;--jelly-popover-padding-block: 12px;--jelly-popover-padding-inline: 14px;--jelly-popover-radius: 16px;--jelly-popover-font-size: 14.5px}:host([size="small"]){--jelly-popover-min-width: 150px;--jelly-popover-padding-block: 9px;--jelly-popover-padding-inline: 11px;--jelly-popover-radius: 13px;--jelly-popover-font-size: 13px}:host([size="large"]){--jelly-popover-min-width: 220px;--jelly-popover-padding-block: 15px;--jelly-popover-padding-inline: 18px;--jelly-popover-radius: 18px;--jelly-popover-font-size: 16px}.panel{position:fixed;left:0;top:0;z-index:9998;min-width:var(--jelly-popover-min-width);max-width:min(360px,calc(100vw - 24px));background:var(--jelly-color-background-surface);border:1px solid var(--jelly-color-border-default);border-radius:var(--jelly-popover-radius);box-shadow:var(--jelly-shadow-raised);padding-block:var(--jelly-popover-padding-block);padding-inline:var(--jelly-popover-padding-inline);color:var(--jelly-color-foreground-default);font:400 var(--jelly-popover-font-size)/1.5 var(--jelly-font-text);outline:none;opacity:0;visibility:hidden}.panel[data-open]{opacity:1;visibility:visible}@media(forced-colors:active){.panel{border-color:CanvasText}}';
class Vi extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.isOpen = !1, this.untrack = null, this.onDocumentPointer = (t) => {
      this.isOpen && !t.composedPath().includes(this) && this.close();
    }, this.onDocumentKey = (t) => {
      t.key === "Escape" && !t.defaultPrevented && (t.preventDefault(), this.close());
    };
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["placement", "size", "label"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    if (z(), j(this), this.built)
      return;
    this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${Hi}</style>

      <slot name="trigger"></slot>

      <div class="panel" part="panel" role="dialog" aria-modal="false" tabindex="-1"><slot name="content"></slot></div>
    `, this.panel = this.shadowRoot.querySelector(".panel");
    const t = this.shadowRoot.querySelector('slot[name="trigger"]');
    t.addEventListener("click", () => this.toggle()), t.addEventListener("slotchange", () => this.reflectTrigger()), this.reflectTrigger(), this.syncLabel();
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    this.isOpen && (this.isOpen = !1, this.untrack?.(), this.untrack = null, document.removeEventListener("pointerdown", this.onDocumentPointer, !0), document.removeEventListener("keydown", this.onDocumentKey), this.panel?.removeAttribute("data-open"));
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    switch (t) {
      case "size":
        j(this);
        break;
      case "label":
        this.syncLabel();
        break;
    }
    this.isOpen && this.place();
  }
  // The panel's accessible name comes from the label attribute
  syncLabel() {
    const t = this.getAttribute("label");
    t ? this.panel?.setAttribute("aria-label", t) : this.panel?.removeAttribute("aria-label");
  }
  // The current trigger, resolved live from the slot (never stale)
  get trigger() {
    return this.shadowRoot?.querySelector('slot[name="trigger"]')?.assignedElements()[0] || this;
  }
  // Mark the trigger as opening a dialog and mirror the open state onto it
  reflectTrigger() {
    const t = this.trigger;
    !t || t === this || (t.setAttribute("aria-haspopup", "dialog"), t.setAttribute("aria-expanded", this.isOpen ? "true" : "false"));
  }
  // Flip between open and closed
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  // Open the panel, move focus into it and start following the trigger
  open() {
    if (this.isOpen)
      return;
    this.isOpen = !0, this.reflectTrigger(), this.panel.setAttribute("data-open", ""), this.place(), at(this.panel, "top center"), document.addEventListener("pointerdown", this.onDocumentPointer, !0), document.addEventListener("keydown", this.onDocumentKey), (this.querySelector(
      '[slot="content"] a, [slot="content"] button, [slot="content"] input, [slot="content"] [tabindex]'
    ) || this.panel).focus({ preventScroll: !0 }), g(this, "open");
  }
  // Anchor the panel to the trigger and keep it pinned on scroll
  place() {
    if (!this.panel)
      return;
    const t = this.getAttribute("placement") || "bottom", e = this.trigger;
    W(e, this.panel, t, 8), this.untrack?.(), this.untrack = lt(e, this.panel, t, 8, () => this.close({ returnFocus: !1 }));
  }
  // Close the panel. Hands focus back to the trigger for a user-driven close
  // (Escape, click-outside, selection); scroll-out closes pass returnFocus:
  // false so the page doesn't jump back to the now-off-screen trigger.
  close({ returnFocus: t = !0 } = {}) {
    this.isOpen && (this.isOpen = !1, this.untrack?.(), this.untrack = null, document.removeEventListener("pointerdown", this.onDocumentPointer, !0), document.removeEventListener("keydown", this.onDocumentKey), ht(this.panel, () => this.panel.removeAttribute("data-open")), t && this.trigger?.focus?.(), g(this, "close"));
  }
  // Route programmatic host focus onto the trigger
  focus(t) {
    this.trigger?.focus?.(t);
  }
}
customElements.define("jelly-popover", Vi);
const Di = ':host{display:inline-flex;--jelly-menu-min-width: 190px;--jelly-menu-padding: 7px;--jelly-menu-radius: 15px;--jelly-menu-font-size: 14.5px;--jelly-menu-item-height: 40px;--jelly-menu-item-padding-inline: 12px;--jelly-menu-item-gap: 9px;--jelly-menu-item-radius: 10px}:host([size="small"]){--jelly-menu-min-width: 160px;--jelly-menu-padding: 5px;--jelly-menu-radius: 12px;--jelly-menu-font-size: 13px;--jelly-menu-item-height: 34px;--jelly-menu-item-padding-inline: 10px;--jelly-menu-item-gap: 7px;--jelly-menu-item-radius: 8px}:host([size="large"]){--jelly-menu-min-width: 230px;--jelly-menu-padding: 9px;--jelly-menu-radius: 18px;--jelly-menu-font-size: 16px;--jelly-menu-item-height: 46px;--jelly-menu-item-padding-inline: 14px;--jelly-menu-item-gap: 11px;--jelly-menu-item-radius: 12px}.source{display:none}.menu{position:fixed;left:0;top:0;z-index:9998;min-width:var(--jelly-menu-min-width);background:var(--jelly-color-background-surface);border:1px solid var(--jelly-color-border-default);border-radius:var(--jelly-menu-radius);padding:var(--jelly-menu-padding);box-shadow:var(--jelly-shadow-raised);opacity:0;visibility:hidden;font:600 var(--jelly-menu-font-size)/1 var(--jelly-font-display)}.menu[data-open]{opacity:1;visibility:visible}.item{display:flex;align-items:center;gap:var(--jelly-menu-item-gap);height:var(--jelly-menu-item-height);padding-inline:var(--jelly-menu-item-padding-inline);border-radius:var(--jelly-menu-item-radius);color:var(--jelly-color-foreground-default);cursor:pointer;touch-action:manipulation;user-select:none;outline:none}.item:hover,.item:focus-visible,.item:focus,.item.active{background:color-mix(in srgb,var(--jelly-color-background-accent) 12%,transparent)}.item[aria-disabled=true]{opacity:.4;cursor:not-allowed}.item[data-danger]{color:var(--jelly-color-background-rose)}.item[data-danger]:hover,.item[data-danger]:focus,.item[data-danger].active{background:color-mix(in srgb,var(--jelly-color-background-rose) 15%,transparent)}@media(forced-colors:active){.menu{border-color:CanvasText}.item:focus{outline:2px solid Highlight;outline-offset:-2px}}';
class $i extends HTMLElement {
  // The value reported in the select event (falls back to the text)
  get value() {
    return this.getAttribute("value") ?? (this.textContent ?? "").trim();
  }
  // True when this item cannot be picked
  get disabled() {
    return this.hasAttribute("disabled");
  }
}
class qi extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.isOpen = !1, this.active = 0, this.items = [], this.untrack = null, this.onDocumentPointer = (t) => {
      this.isOpen && !t.composedPath().includes(this) && this.close();
    };
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["placement", "size"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    if (z(), j(this), this.built)
      return;
    this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${Di}</style>

      <slot name="trigger"></slot>

      <div class="source"><slot></slot></div>

      <div class="menu" part="menu" role="menu"></div>
    `, this.menu = this.shadowRoot.querySelector(".menu");
    const t = this.shadowRoot.querySelector('slot[name="trigger"]');
    t.addEventListener("click", () => this.toggle()), t.addEventListener("slotchange", () => this.reflectTrigger()), this.reflectTrigger(), this.menu.addEventListener("click", (e) => this.pick(this.rowFrom(e))), this.menu.addEventListener("pointermove", (e) => this.highlight(this.rowFrom(e))), this.menu.addEventListener("keydown", (e) => this.onKey(e));
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    this.isOpen && (this.isOpen = !1, this.untrack?.(), this.untrack = null, document.removeEventListener("pointerdown", this.onDocumentPointer, !0), this.menu?.removeAttribute("data-open"));
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t) {
    t === "size" && j(this), this.isOpen && this.place();
  }
  // The nearest rendered row for an event target, or null
  rowFrom(t) {
    return t.target.closest(".item");
  }
  // The current trigger, resolved live from the slot
  get trigger() {
    return this.shadowRoot?.querySelector('slot[name="trigger"]')?.assignedElements()[0] || this;
  }
  // Mark the trigger as a menu button and mirror the open state onto it, so
  // screen readers announce that it opens a menu and whether it is expanded
  reflectTrigger() {
    const t = this.trigger;
    !t || t === this || (t.setAttribute("aria-haspopup", "menu"), t.setAttribute("aria-expanded", this.isOpen ? "true" : "false"));
  }
  // The rendered rows currently in the menu
  rows() {
    return [...this.menu.querySelectorAll(".item")];
  }
  // Flip between open and closed
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  /*
   * Open the menu: re-read the live light-DOM items (so dynamically added
   * entries always appear), render them as focusable rows, anchor to the
   * trigger and move focus to the first enabled row.
   */
  open() {
    if (this.isOpen)
      return;
    this.isOpen = !0, this.reflectTrigger(), this.items = [...this.querySelectorAll("jelly-menu-item")], this.menu.innerHTML = this.items.map((i, s) => `<div class="item" role="menuitem" tabindex="-1" data-i="${s}"
        ${i.disabled ? 'aria-disabled="true"' : ""} ${i.hasAttribute("danger") ? "data-danger" : ""}>${i.innerHTML}</div>`).join(""), this.menu.setAttribute("data-open", ""), this.place(), at(this.menu, "top center"), document.addEventListener("pointerdown", this.onDocumentPointer, !0);
    const t = this.rows(), e = t.findIndex((i) => i.getAttribute("aria-disabled") !== "true");
    this.active = Math.max(0, e), t[this.active]?.focus({ preventScroll: !0 }), g(this, "open");
  }
  // Anchor the menu to the trigger and keep it pinned on scroll
  place() {
    if (!this.menu)
      return;
    const t = this.trigger, e = this.getAttribute("placement") || "bottom";
    W(t, this.menu, e, 8), this.untrack?.(), this.untrack = lt(t, this.menu, e, 8, () => this.close({ returnFocus: !1 }));
  }
  // Close the menu. Hands focus back to the trigger for a user-driven close
  // (Escape, click-outside, selection); scroll-out closes pass returnFocus:
  // false so the page doesn't jump back to the now-off-screen trigger.
  close({ returnFocus: t = !0 } = {}) {
    this.isOpen && (this.isOpen = !1, this.reflectTrigger(), this.untrack?.(), this.untrack = null, document.removeEventListener("pointerdown", this.onDocumentPointer, !0), ht(this.menu, () => this.menu.removeAttribute("data-open")), t && this.trigger?.focus?.(), g(this, "close"));
  }
  // Pointer hover mirrors the roving focus onto the hovered row
  highlight(t) {
    !t || t.getAttribute("aria-disabled") === "true" || (this.active = Number(t.dataset.i), t.focus({ preventScroll: !0 }));
  }
  // Pick a row: announce the selection and close
  pick(t) {
    if (!t || t.getAttribute("aria-disabled") === "true")
      return;
    const e = this.items[Number(t.dataset.i)];
    g(this, "select", { value: e.value, item: e }), this.close();
  }
  // Menu keyboard: arrows rove, Home/End jump, Enter/Space picks, Escape/Tab close
  onKey(t) {
    const e = this.rows();
    switch (t.key) {
      case "Escape":
        t.preventDefault(), this.close();
        break;
      case "Tab":
        this.close();
        break;
      case "ArrowDown":
        t.preventDefault(), this.step(1);
        break;
      case "ArrowUp":
        t.preventDefault(), this.step(-1);
        break;
      case "Home":
        t.preventDefault(), this.step(1, -1);
        break;
      case "End":
        t.preventDefault(), this.step(-1, e.length);
        break;
      case "Enter":
      case " ":
        t.preventDefault(), this.pick(e[this.active]);
        break;
    }
  }
  // Move the roving focus by delta (skipping disabled rows), wrapping around
  step(t, e = this.active) {
    const i = this.rows();
    let s = e;
    for (let r = 0; r < i.length && (s = (s + t + i.length) % i.length, i[s].getAttribute("aria-disabled") === "true"); r++)
      ;
    this.active = s, i[s]?.focus({ preventScroll: !0 });
  }
  // Route programmatic host focus onto the trigger
  focus(t) {
    this.trigger?.focus?.(t);
  }
}
customElements.define("jelly-menu-item", $i);
customElements.define("jelly-menu", qi);
const Xi = ':host{position:fixed;inset:0;z-index:10001;display:none}:host([open]){display:block}.backdrop{position:absolute;inset:0;background:color-mix(in srgb,var(--jelly-color-foreground-default) 42%,transparent);-webkit-backdrop-filter:blur(1.5px);backdrop-filter:blur(1.5px);opacity:0;transition:opacity .34s ease}:host([open]) .backdrop{opacity:1}.wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:calc(24px + env(safe-area-inset-top,0px)) calc(24px + env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) calc(24px + env(safe-area-inset-left,0px))}.dialog{position:relative;width:var(--jelly-dialog-width, min(460px, 100%));max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow:auto;background:var(--jelly-color-background-surface);border-radius:var(--jelly-dialog-radius, 24px);padding:var(--jelly-dialog-padding, 26px);color:var(--jelly-color-foreground-default);font:400 15px/1.55 var(--jelly-font-text);box-shadow:var(--jelly-shadow-overlay);will-change:transform,opacity}.close{position:absolute;top:16px;inset-inline-end:16px;width:30px;height:30px;border:0;background:transparent;border-radius:50%;cursor:pointer;touch-action:manipulation;color:var(--jelly-color-foreground-muted);font-size:16px;transition:background-color .12s ease,color .12s ease}.close:hover{background:var(--jelly-color-background-neutral);color:var(--jelly-color-foreground-on-neutral)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .close{transition:none}}:host-context([data-jelly-motion="reduce"]) .close{transition:none}.close:focus-visible{outline:2px solid var(--jelly-ring-color);outline-offset:1px}::slotted(:first-child){margin-top:0}@media(forced-colors:active){.dialog{border:1px solid CanvasText}.close:focus-visible{outline-color:Highlight}}';
class Oi extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.closing = !1, this.modalActive = !1, this.prevFocus = null, this.restorePortal = null, this.restoreInert = null, this.onDocumentKey = (t) => {
      t.key === "Escape" && !t.defaultPrevented && (this.open = !1);
    };
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["open", "label"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), !this.built && (this.built = !0, this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${Xi}</style>

      <div class="backdrop" part="backdrop"></div>

      <div class="wrap">
        <div class="dialog" part="dialog" role="dialog" aria-modal="true" tabindex="-1">
          <button class="close" aria-label="Close">✕</button>
          <slot></slot>
        </div>
      </div>
    `, this.dialog = this.shadowRoot.querySelector(".dialog"), this.wrap = this.shadowRoot.querySelector(".wrap"), this.wrap.addEventListener("click", (t) => {
      t.target === this.wrap && (this.open = !1);
    }), this.shadowRoot.querySelector(".close").addEventListener("click", () => {
      this.open = !1;
    }));
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    queueMicrotask(() => {
      !this.isConnected && this.modalActive && this.teardownModal();
    });
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t, e, i) {
    if (!(e === i || !this.dialog)) {
      if (t === "label") {
        this.syncLabel();
        return;
      }
      this.hasAttribute("open") ? this.afterOpen() : this.afterClose();
    }
  }
  /*
   * The dialog's accessible name: an explicit label attribute wins,
   * else the first heading's text is mirrored onto aria-label (idrefs
   * can't cross the shadow boundary to slotted content).
   */
  syncLabel() {
    const t = this.getAttribute("label"), e = this.querySelector("h1, h2, h3, [data-dialog-title]");
    t ? this.dialog.setAttribute("aria-label", t) : e && this.dialog.setAttribute("aria-label", (e.textContent ?? "").trim());
  }
  // Everything that happens when the open attribute arrives
  afterOpen() {
    this.closing = !1, this.dialog.getAnimations?.().forEach((t) => t.cancel()), this.dialog.style.opacity = "", this.dialog.style.transform = "", this.prevFocus = document.activeElement, this.restorePortal = St(this), this.modalActive = !0, document.addEventListener("keydown", this.onDocumentKey), At(), this.restoreInert = Lt(this), this.syncLabel(), !F() && this.dialog.animate && this.dialog.animate(
      [
        { opacity: 0, transform: "translateY(12px) scale(0.97)" },
        { opacity: 1, offset: 0.55 },
        { transform: "translateY(0) scale(1.004)", offset: 0.78 },
        { transform: "translateY(0) scale(1)" }
      ],
      { duration: 500, easing: "cubic-bezier(.16,.82,.28,1)" }
    ), this.dialog.focus(), g(this, "open");
  }
  // Everything that happens when the open attribute drops
  afterClose() {
    this.closing || (this.teardownModal(), this.prevFocus?.focus?.(), g(this, "close"));
  }
  // Release every page-level effect the open dialog holds (idempotent)
  teardownModal() {
    this.modalActive && (this.modalActive = !1, document.removeEventListener("keydown", this.onDocumentKey), this.restoreInert?.(), this.restoreInert = null, zt(), this.restorePortal?.(), this.restorePortal = null);
  }
  // Open the dialog (mirrors the native dialog API)
  showModal() {
    this.open = !0;
  }
  // Route programmatic host focus onto the dialog surface
  focus(t) {
    this.dialog?.focus(t);
  }
  // The open state as a property
  get open() {
    return this.hasAttribute("open");
  }
  set open(t) {
    if (t) {
      this.hasAttribute("open") || this.setAttribute("open", "");
      return;
    }
    this.hasAttribute("open") && (this.closing = !0, ht(this.dialog, () => {
      this.closing && (this.closing = !1, this.removeAttribute("open"));
    }));
  }
}
customElements.define("jelly-dialog", Oi);
const Wi = ':host{position:fixed;inset:0;z-index:10001;display:none}:host([open]){display:block}.backdrop{position:absolute;inset:0;background:color-mix(in srgb,var(--jelly-color-foreground-default) 42%,transparent);-webkit-backdrop-filter:blur(1.5px);backdrop-filter:blur(1.5px);opacity:0;transition:opacity .3s ease}:host([open]) .backdrop{opacity:1}.sheet{position:absolute;background:var(--jelly-color-background-surface);box-sizing:border-box;overflow:auto;color:var(--jelly-color-foreground-default);font:400 15px/1.55 var(--jelly-font-text);padding:var(--jelly-drawer-padding, 22px);border-radius:var(--jelly-drawer-radius, 24px);box-shadow:var(--jelly-shadow-overlay);will-change:transform}.close{position:absolute;top:16px;inset-inline-end:16px;width:30px;height:30px;border:0;background:transparent;border-radius:50%;cursor:pointer;touch-action:manipulation;color:var(--jelly-color-foreground-muted);font-size:16px;transition:background-color .12s ease,color .12s ease}.close:hover{background:var(--jelly-color-background-neutral);color:var(--jelly-color-foreground-on-neutral)}@media(prefers-reduced-motion:reduce){:host-context(html:not([data-jelly-motion="no-preference"])) .close{transition:none}}:host-context([data-jelly-motion="reduce"]) .close{transition:none}.close:focus-visible{outline:2px solid var(--jelly-ring-color);outline-offset:1px}:host([side="end"]) .sheet,:host([side="right"]) .sheet,:host([side="left"]) .sheet,:host([side="start"]) .sheet{inset-block:calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 32px))}:host([side="end"]) .sheet{inset-inline-end:16px}:host([side="start"]) .sheet{inset-inline-start:16px}:host([side="right"]) .sheet{right:16px}:host([side="left"]) .sheet{left:16px}:host([side="bottom"]) .sheet{inset-inline:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-height:82vh;max-height:82dvh}@media(forced-colors:active){.sheet{border:1px solid CanvasText}.close:focus-visible{outline-color:Highlight}}';
class Ni extends HTMLElement {
  constructor() {
    super(...arguments), this.built = !1, this.closing = !1, this.modalActive = !1, this.prevFocus = null, this.restorePortal = null, this.restoreInert = null, this.onDocumentKey = (t) => {
      t.key === "Escape" && !t.defaultPrevented && (this.open = !1);
    };
  }
  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes() {
    return ["open", "label"];
  }
  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback() {
    z(), !this.built && (this.built = !0, this.hasAttribute("side") || this.setAttribute("side", "end"), this.attachShadow({ mode: "open", delegatesFocus: !0 }), this.shadowRoot.innerHTML = `
      <style>${Wi}</style>

      <div class="backdrop" part="backdrop"></div>

      <div class="sheet" part="sheet" role="dialog" aria-modal="true" tabindex="-1">
        <button class="close" part="close" aria-label="Close">✕</button>
        <slot></slot>
      </div>
    `, this.sheet = this.shadowRoot.querySelector(".sheet"), this.shadowRoot.querySelector(".backdrop").addEventListener("click", () => {
      this.open = !1;
    }), this.shadowRoot.querySelector(".close").addEventListener("click", () => {
      this.open = !1;
    }));
  }
  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback() {
    queueMicrotask(() => {
      !this.isConnected && this.modalActive && this.teardownModal();
    });
  }
  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback(t, e, i) {
    if (!(!this.sheet || e === i)) {
      if (t === "label") {
        this.syncLabel();
        return;
      }
      this.hasAttribute("open") ? this.afterOpen() : this.afterClose();
    }
  }
  // The accessible name: explicit label attribute, else the first heading
  syncLabel() {
    const t = this.getAttribute("label"), e = this.querySelector("h1, h2, h3, [data-drawer-title]");
    t ? this.sheet.setAttribute("aria-label", t) : e && this.sheet.setAttribute("aria-label", (e.textContent ?? "").trim());
  }
  // Everything that happens when the open attribute arrives
  afterOpen() {
    this.closing = !1, this.sheet.getAnimations?.().forEach((t) => t.cancel()), this.sheet.style.opacity = "", this.sheet.style.transform = "", this.prevFocus = document.activeElement, this.restorePortal = St(this), this.modalActive = !0, document.addEventListener("keydown", this.onDocumentKey), At(), this.restoreInert = Lt(this), this.syncLabel(), this.slideIn(), requestAnimationFrame(() => this.sheet.focus()), g(this, "open");
  }
  // Everything that happens when the open attribute drops
  afterClose() {
    this.closing || (this.teardownModal(), this.prevFocus?.focus?.(), g(this, "close"));
  }
  // Release every page-level effect the open drawer holds (idempotent)
  teardownModal() {
    this.modalActive && (this.modalActive = !1, document.removeEventListener("keydown", this.onDocumentKey), this.restoreInert?.(), this.restoreInert = null, zt(), this.restorePortal?.(), this.restorePortal = null);
  }
  // The side attribute with start / end resolved against reading direction
  get resolvedSide() {
    const t = this.getAttribute("side") || "end", e = k(this);
    return t === "start" ? e ? "right" : "left" : t === "end" ? e ? "left" : "right" : t === "left" || t === "bottom" ? t : "right";
  }
  // Off-screen / overshoot transforms for the resolved physical side
  frames() {
    const t = {
      right: { off: "translateX(115%)", over: "translateX(-1%)", rest: "translateX(0)" },
      left: { off: "translateX(-115%)", over: "translateX(1%)", rest: "translateX(0)" },
      bottom: { off: "translateY(115%)", over: "translateY(-1%)", rest: "translateY(0)" }
    };
    return t[this.resolvedSide] || t.right;
  }
  // Glide in and decelerate into place with a barely-there overshoot
  slideIn() {
    const t = this.sheet;
    if (F() || !t.animate)
      return;
    const e = this.frames();
    t.animate(
      [
        { transform: e.off, opacity: 0.5 },
        { transform: e.over, opacity: 1, offset: 0.78 },
        { transform: e.rest }
      ],
      { duration: 560, easing: "cubic-bezier(.18,.84,.26,1)" }
    );
  }
  // Route programmatic host focus onto the sheet
  focus(t) {
    this.sheet?.focus(t);
  }
  // The open state as a property
  get open() {
    return this.hasAttribute("open");
  }
  set open(t) {
    if (t) {
      this.hasAttribute("open") || this.setAttribute("open", "");
      return;
    }
    if (!this.hasAttribute("open"))
      return;
    const e = this.sheet;
    if (F() || !e.animate) {
      this.removeAttribute("open");
      return;
    }
    const i = this.frames();
    this.closing = !0;
    const s = e.animate(
      [
        { transform: i.rest, opacity: 1 },
        { transform: i.off, opacity: 0.3 }
      ],
      { duration: 300, easing: "cubic-bezier(.4,0,.7,.25)" }
    ), r = () => {
      this.closing && (this.closing = !1, this.removeAttribute("open"));
    };
    s.onfinish = r, s.oncancel = r;
  }
}
customElements.define("jelly-drawer", Ni);
export {
  Kt as BODY_FONT_STACK,
  Zt as DARK,
  st as DARK_TOKENS,
  nt as DEFAULT_CONFIG,
  H as FOCUS_RING,
  Nt as FONT_STACK,
  be as ICONS,
  D as JellyBody,
  L as JellyElement,
  Ft as LIGHT,
  ct as LIGHT_TOKENS,
  Yt as MONO_FONT_STACK,
  b as PALETTE,
  Ki as VARIANT_CSS,
  j as canonicalizeSize,
  m as clamp,
  g as emit,
  yt as engine,
  z as ensureThemeTokens,
  B as escapeHTML,
  Zi as getThemeMode,
  O as horizontalStep,
  Lt as inertOutside,
  E as integrateSpring,
  Ji as isDarkMode,
  k as isRTL,
  ot as jellyIcon,
  me as jellyToast,
  kt as listNavigate,
  At as lockScroll,
  G as notifyThemeChange,
  V as numberAttribute,
  Gi as onThemeChange,
  W as placeAnchored,
  St as portalToBody,
  F as prefersReducedMotion,
  q as propagateSize,
  Xt as resolvePlacement,
  Yi as setThemeMode,
  Pt as sizeName,
  at as springIn,
  ht as springOut,
  Gt as themeTokenCSS,
  Ot as toastIn,
  Wt as toastOut,
  Q as traceSmoothPath,
  lt as trackAnchor,
  T as triggerHaptic,
  X as uniqueId,
  zt as unlockScroll,
  R as variantColors
};
//# sourceMappingURL=jelly.js.map
