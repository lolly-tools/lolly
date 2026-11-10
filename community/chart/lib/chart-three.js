/*! Lolly Chart Three adapter - MPL-2.0. Three.js is loaded separately under MIT. */
(function (global) {
  'use strict';

  // This adapter draws the scene plan the chart's hooks compute: marks, stage,
  // colours, labels and a framed camera. It decides none of those itself, so the
  // GPU picture and the vector projection the hooks draw always agree. What it
  // adds is light: a studio environment built from the colourway for
  // reflections, the finish of each material, soft shadows and the motion
  // clock.

  var NS = 'http://www.w3.org/2000/svg';
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function cleanHex(v, fallback) { return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : fallback; }
  function svg(tag, attrs, text) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { if (attrs[key] != null) el.setAttribute(key, String(attrs[key])); });
    if (text != null) el.textContent = String(text);
    return el;
  }

  // Finishes, in the vocabulary 3D Studio uses. Roughness and metalness for the
  // physically based ones; env is how strongly the colourway's studio reflects.
  var FINISHES = {
    matte: { r: .64, m: 0, env: .5 },
    satin: { r: .36, m: .04, env: .85 },
    gloss: { r: .16, m: 0, env: .7, coat: .55 },
    metal: { r: .24, m: .9, env: 1.3 },
    clay: { r: .96, m: 0, env: .28 },
    glass: { r: .05, m: 0, env: 1.15, glass: true },
    glow: { r: .42, m: 0, env: .55, glow: .38 },
  };

  function mount(opts) {
    var root = opts.root, state = opts.state || {}, THREE = opts.THREE;
    var plan = state.scene, data = state.data || {};
    var canvas = root.querySelector('[data-chart3d-canvas]');
    var overlay = root.querySelector('[data-chart3d-overlay]');
    var overlayRoot = overlay && overlay.querySelector('[data-chart3d-overlay-root]');
    var fallback = root.querySelector('[data-chart3d-fallback]');
    if (!plan || !canvas || !overlay || !overlayRoot || !THREE || !THREE.WebGLRenderer) throw new Error('3-D chart renderer is unavailable');

    var W = clamp(Math.round(Number(plan.W) || 1280), 100, 8000);
    var H = clamp(Math.round(Number(plan.H) || 800), 100, 8000);
    canvas.width = W; canvas.height = H;
    var out = canvas.getContext('2d');
    if (!out) throw new Error('2-D presentation canvas is unavailable');
    var gpu = document.createElement('canvas'); gpu.width = W; gpu.height = H;
    var renderer = new THREE.WebGLRenderer({ canvas: gpu, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps a lit swatch close to the design system's own
    // value; ACES shifts brand hues, which is what made the old bars look black.
    renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    var C = plan.stage.colours || {};
    var finishName = plan.finish || 'matte', accurate = finishName === 'accurate';
    var finish = finishName === 'custom'
      ? { r: clamp(Number(plan.roughness), 0, 1), m: clamp(Number(plan.metalness), 0, 1), env: .85 }
      : (FINISHES[finishName] || FINISHES.matte);
    var stage = plan.stage.kind || 'studio', dark = !!C.dark, transparent = !!plan.transparent;
    var shadows = !!plan.stage.shadows && !accurate;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    var cam = plan.camera, T = new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]);
    var b0 = plan.bounds.min, b1 = plan.bounds.max;
    var radius = Math.max(1, Math.hypot(b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]) / 2);
    var disposables = [];
    function keep(x) { disposables.push(x); return x; }

    var scene = new THREE.Scene();
    if (!transparent) scene.background = new THREE.Color(C.backdrop);
    // Fog in the backdrop colour fades the floor into the wall behind it, so
    // the studio has no visible edge from any angle the camera takes.
    if (!transparent && stage !== 'float' && THREE.Fog) scene.fog = new THREE.Fog(C.backdrop, cam.dist + radius * .9, cam.dist * 2.6 + radius * 3);

    // ── light ──
    function dirFrom(azDeg, elDeg, d) {
      var a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
      return new THREE.Vector3(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d).add(T);
    }
    var keyAz = cam.az - 42, keyEl = 52;
    if (!accurate) {
      buildEnvironment();
      scene.add(new THREE.HemisphereLight(C.sky, C.ground, dark ? .45 : .7));
      var key = new THREE.DirectionalLight(0xffffff, dark ? 1.5 : 2.1);
      key.position.copy(dirFrom(keyAz, keyEl, radius * 3)); key.target.position.copy(T);
      key.castShadow = shadows;
      if (shadows) {
        key.shadow.mapSize.width = 2048; key.shadow.mapSize.height = 2048;
        var sc = key.shadow.camera, ext = radius * 1.35;
        sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = .1; sc.far = radius * 7;
        key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 4;
      }
      scene.add(key); scene.add(key.target);
      var fill = new THREE.DirectionalLight(C.fill || '#ffffff', dark ? .55 : .45);
      fill.position.copy(dirFrom(cam.az + 64, 16, radius * 3)); scene.add(fill);
      var rim = new THREE.DirectionalLight(C.rim || '#ffffff', dark || stage === 'night' ? 1.6 : .7);
      rim.position.copy(dirFrom(cam.az + 180, 34, radius * 3)); scene.add(rim);
    }

    // A small studio, built from the colourway and pre-filtered into an
    // environment map: a backdrop-coloured dome, a white key softbox, a fill
    // card in the accent and a rim strip in the primary. Glossy, metal and
    // glass finishes reflect the brand rather than a grey room.
    function buildEnvironment() {
      if (!THREE.PMREMGenerator) return;
      var env = new THREE.Scene();
      var geo = keep(new THREE.SphereGeometry(10, 32, 16));
      var pos = geo.attributes.position, cols = [];
      var sky = new THREE.Color(C.sky), hor = new THREE.Color(C.backdrop), gnd = new THREE.Color(C.ground);
      for (var i = 0; i < pos.count; i++) {
        var y = pos.getY(i) / 10, c = y > 0 ? hor.clone().lerp(sky, y) : hor.clone().lerp(gnd, Math.min(1, -y * 1.6));
        cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      env.add(new THREE.Mesh(geo, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }))));
      function panel(colour, power, w, h, azDeg, elDeg) {
        var m = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(power), side: THREE.DoubleSide }));
        var p = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), m);
        var a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
        p.position.set(Math.sin(a) * Math.cos(e) * 8, Math.sin(e) * 8, Math.cos(a) * Math.cos(e) * 8);
        p.lookAt(0, 0, 0); env.add(p);
      }
      panel('#ffffff', dark ? 5 : 7, 7, 4.5, keyAz, keyEl);
      panel(C.fill || '#ffffff', dark ? 2.2 : 1.6, 3, 6, cam.az + 70, 12);
      panel(C.rim || '#ffffff', dark ? 4 : 2.2, 9, 1.4, cam.az + 180, 30);
      var pm = new THREE.PMREMGenerator(renderer);
      var tex = pm.fromScene(env, .035).texture;
      pm.dispose();
      keep(tex);
      scene.environment = tex;
    }

    // ── stage ──
    var fp = plan.stage.footprint || {};
    var plinth = stage === 'plinth', floorY = plinth ? -.18 : 0;
    if (!transparent && stage !== 'float') {
      var floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(600, 600)), keep(new THREE.MeshStandardMaterial({
        color: C.floor, roughness: stage === 'night' ? .62 : .92, metalness: 0, envMapIntensity: stage === 'night' ? .22 : .25,
      })));
      floor.rotation.x = -Math.PI / 2; floor.position.y = floorY - .001; floor.receiveShadow = shadows; scene.add(floor);
    } else if (shadows && THREE.ShadowMaterial) {
      var catcher = new THREE.Mesh(keep(new THREE.PlaneGeometry(radius * 8, radius * 8)), keep(new THREE.ShadowMaterial({ opacity: dark ? .38 : .2 })));
      catcher.rotation.x = -Math.PI / 2; catcher.position.set(T.x, floorY - .001, T.z); catcher.receiveShadow = true; scene.add(catcher);
    }
    if (plinth) {
      var pm2 = keep(new THREE.MeshStandardMaterial({ color: C.plinth, roughness: .55, metalness: 0, envMapIntensity: .6 }));
      var slab;
      if (fp.circle) slab = new THREE.Mesh(keep(new THREE.CylinderGeometry(fp.circle[2] + .25, fp.circle[2] + .25, .18, 128)), pm2);
      else if (fp.rect && THREE.RoundedBoxGeometry) slab = new THREE.Mesh(keep(new THREE.RoundedBoxGeometry(fp.rect[1] - fp.rect[0] + .5, .18, fp.rect[3] - fp.rect[2] + .5, 3, .06)), pm2);
      if (slab) {
        slab.position.set(fp.circle ? fp.circle[0] : (fp.rect[0] + fp.rect[1]) / 2, -.09, fp.circle ? fp.circle[1] : (fp.rect[2] + fp.rect[3]) / 2);
        slab.receiveShadow = shadows; slab.castShadow = shadows; scene.add(slab);
      }
    }
    // A soft contact shadow under the whole chart grounds it even where the
    // key light's shadow falls away.
    if (shadows || accurate) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 128;
      var g2 = cv.getContext('2d');
      if (g2) {
        var grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(0,0,0,' + (dark ? .55 : .3) + ')'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g2.fillStyle = grd; g2.fillRect(0, 0, 128, 128);
        var ct = keep(new THREE.CanvasTexture(cv));
        var cw = fp.circle ? fp.circle[2] * 2.6 : fp.rect ? (fp.rect[1] - fp.rect[0]) * 1.35 : radius * 2;
        var cd = fp.circle ? fp.circle[2] * 2.6 : fp.rect ? (fp.rect[3] - fp.rect[2]) * 1.5 : radius * 2;
        var contact = new THREE.Mesh(keep(new THREE.PlaneGeometry(cw, cd)), keep(new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false })));
        contact.rotation.x = -Math.PI / 2;
        contact.position.set(fp.circle ? fp.circle[0] : fp.rect ? (fp.rect[0] + fp.rect[1]) / 2 : T.x, .002, fp.circle ? fp.circle[1] : fp.rect ? (fp.rect[2] + fp.rect[3]) / 2 : T.z);
        contact.renderOrder = -1; scene.add(contact);
      }
    }
    function lines(segments, colour, opacity) {
      if (!segments.length || !THREE.LineSegments) return;
      var g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
      var l = new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: colour, transparent: opacity < 1, opacity: opacity })));
      scene.add(l);
    }
    var gridSeg = [];
    (plan.stage.grid || []).forEach(function (s) { gridSeg.push(s[0], .004, s[1], s[2], .004, s[3]); });
    lines(gridSeg, C.grid, .85);
    var axisSeg = [];
    (plan.stage.axisLines || []).forEach(function (s) { axisSeg.push(s[0], s[1], s[2], s[3], s[4], s[5]); });
    lines(axisSeg, C.grid, 1);

    // ── marks ──
    var materialCache = {};
    function material(colour, opacity, quiet, extra) {
      colour = cleanHex(colour, '#4676ee'); opacity = opacity == null ? 1 : opacity;
      var cacheKey = colour + ':' + opacity + ':' + (quiet ? 1 : 0) + ':' + (extra || '');
      if (materialCache[cacheKey]) return materialCache[cacheKey];
      var m, base = { color: colour, transparent: opacity < 1, opacity: opacity };
      if (extra === 'vertex') { base.vertexColors = true; base.color = 0xffffff; base.side = THREE.DoubleSide; }
      if (accurate) m = new THREE.MeshBasicMaterial(base);
      else if (finish.glass && !quiet) m = new THREE.MeshPhysicalMaterial(Object.assign(base, {
        roughness: finish.r, metalness: 0, transmission: dark ? .62 : .82, thickness: .7, ior: 1.42,
        attenuationColor: new THREE.Color(colour), attenuationDistance: 2.2, envMapIntensity: finish.env,
        // On a dark stage there is little behind the glass to show through, so
        // it carries a little of its own colour.
        emissive: new THREE.Color(colour), emissiveIntensity: dark ? .22 : 0,
      }));
      else if (finish.coat && !quiet) m = new THREE.MeshPhysicalMaterial(Object.assign(base, { roughness: finish.r, metalness: finish.m, clearcoat: finish.coat, clearcoatRoughness: .1, envMapIntensity: finish.env }));
      else m = new THREE.MeshStandardMaterial(Object.assign(base, {
        roughness: quiet ? Math.max(.5, finish.r) : finish.r, metalness: quiet ? 0 : finish.m, envMapIntensity: quiet ? .4 : finish.env,
      }));
      if (finish.glow && !quiet && !accurate && extra !== 'vertex') { m.emissive = new THREE.Color(colour); m.emissiveIntensity = finish.glow; }
      materialCache[cacheKey] = m; disposables.push(m); return m;
    }
    var unitSphere = keep(new THREE.SphereGeometry(1, 28, 18));
    var grow = [];
    function addMesh(geometry, mat, mark) {
      var mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = shadows && (mark.o == null || mark.o > .5); mesh.receiveShadow = shadows;
      scene.add(mesh); return mesh;
    }
    var boxCount = plan.marks.filter(function (m) { return m.t === 'box'; }).length;
    plan.marks.forEach(function (m) {
      var mesh;
      if (m.t === 'box') {
        var w = m.s[0], h = m.s[1], d = m.s[2], bevel = Math.min(.05, Math.min(w, d) * .1, h * .3);
        var geo = !accurate && THREE.RoundedBoxGeometry && boxCount <= 600 && bevel > .004
          ? new THREE.RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d);
        keep(geo);
        mesh = addMesh(geo, material(m.c, m.o, m.q), m);
        mesh.position.set(m.p[0], m.p[1], m.p[2]); mesh.rotation.y = m.r || 0;
        grow.push({ mesh: mesh, y: m.p[1], g: m.g || 0, kind: 'box' });
      } else if (m.t === 'sector') {
        mesh = addMesh(keep(sectorGeometry(m)), material(m.c, m.o, m.q), m);
        mesh.position.set(m.off[0], 0, m.off[1]);
        grow.push({ mesh: mesh, y: 0, g: m.g || 0, kind: 'sector' });
      } else if (m.t === 'sphere') {
        mesh = addMesh(unitSphere, material(m.c, m.o, m.q), m);
        mesh.position.set(m.p[0], m.p[1], m.p[2]); mesh.scale.setScalar(m.r);
        grow.push({ mesh: mesh, y: m.p[1], g: m.g || 0, kind: 'sphere', r: m.r });
        if (m.stem) lines([m.p[0], 0, m.p[2], m.p[0], m.p[1], m.p[2]], m.c, .4);
      } else if (m.t === 'path') {
        var pts = m.pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
        var curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .45);
        var pmat = material(m.c, m.o, m.q);
        if (m.k === 'ribbon') { pmat.side = THREE.DoubleSide; mesh = addMesh(keep(ribbonGeometry(curve, m.r, pts.length)), pmat, m); }
        else mesh = addMesh(keep(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 12), m.r, 10, false)), pmat, m);
      } else if (m.t === 'surface') {
        mesh = addMesh(keep(surfaceGeometry(m)), material('#ffffff', 1, false, 'vertex'), m);
        if (m.skirt) addMesh(keep(skirtGeometry(m)), material('#ffffff', 1, false, 'vertex'), m);
        var seg = [];
        (m.lines || []).forEach(function (ln) { for (var i = 0; i < ln.length - 1; i++) seg.push(ln[i][0], ln[i][1] + .012, ln[i][2], ln[i + 1][0], ln[i + 1][1] + .012, ln[i + 1][2]); });
        lines(seg, C.text, .3);
        grow.push({ mesh: mesh, y: 0, g: 0, kind: 'surface' });
      }
    });

    function sectorGeometry(m) {
      var n = Math.max(8, Math.ceil((m.a1 - m.a0) / .045)), P = [], N = [];
      function tri(a, b, c, na, nb, nc) { P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); N.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]); }
      function quad(a, b, c, d, na, nb, nc, nd) { tri(a, b, c, na, nb, nc); tri(a, c, d, na, nc, nd); }
      function at(a, r, y) { return [Math.cos(a) * r, y, Math.sin(a) * r]; }
      var up = [0, 1, 0], down = [0, -1, 0];
      for (var i = 0; i < n; i++) {
        var a = m.a0 + (m.a1 - m.a0) * i / n, b = m.a0 + (m.a1 - m.a0) * (i + 1) / n;
        var na = [Math.cos(a), 0, Math.sin(a)], nb = [Math.cos(b), 0, Math.sin(b)];
        quad(at(a, m.r0, m.y1), at(b, m.r0, m.y1), at(b, m.r1, m.y1), at(a, m.r1, m.y1), up, up, up, up);
        quad(at(a, m.r1, m.y0), at(b, m.r1, m.y0), at(b, m.r0, m.y0), at(a, m.r0, m.y0), down, down, down, down);
        quad(at(a, m.r1, m.y1), at(b, m.r1, m.y1), at(b, m.r1, m.y0), at(a, m.r1, m.y0), na, nb, nb, na);
        if (m.r0 > .01) {
          var ia = [-na[0], 0, -na[2]], ib = [-nb[0], 0, -nb[2]];
          quad(at(b, m.r0, m.y1), at(a, m.r0, m.y1), at(a, m.r0, m.y0), at(b, m.r0, m.y0), ib, ia, ia, ib);
        }
      }
      if (m.a1 - m.a0 < Math.PI * 2 - .01) {
        var c0 = [Math.sin(m.a0), 0, -Math.cos(m.a0)], c1 = [-Math.sin(m.a1), 0, Math.cos(m.a1)];
        quad(at(m.a0, m.r0, m.y0), at(m.a0, m.r0, m.y1), at(m.a0, m.r1, m.y1), at(m.a0, m.r1, m.y0), c0, c0, c0, c0);
        quad(at(m.a1, m.r1, m.y0), at(m.a1, m.r1, m.y1), at(m.a1, m.r0, m.y1), at(m.a1, m.r0, m.y0), c1, c1, c1, c1);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      return g;
    }
    function ribbonGeometry(curve, width, n) {
      var samples = curve.getPoints(Math.max(16, n * 10)), verts = [], indices = [];
      samples.forEach(function (p) { verts.push(p.x - width, p.y, p.z, p.x + width, p.y, p.z); });
      for (var i = 0; i < samples.length - 1; i++) { var a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices); geo.computeVertexNormals(); return geo;
    }
    function hexColours(list) {
      var out = [];
      list.forEach(function (h) { var c = new THREE.Color(cleanHex(h, '#888888')); out.push(c.r, c.g, c.b); });
      return out;
    }
    function surfaceGeometry(m) {
      var idx = [];
      for (var j = 0; j < m.nz - 1; j++) for (var i = 0; i < m.nx - 1; i++) {
        var a = j * m.nx + i, b = a + 1, c = a + m.nx + 1, d = a + m.nx;
        idx.push(a, d, b, b, d, c);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(m.pts, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(hexColours(m.cols), 3));
      g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    function skirtGeometry(m) {
      var P = [], Cc = [], shade = new THREE.Color(C.text);
      function V(i, j) { var k = (j * m.nx + i) * 3; return [m.pts[k], m.pts[k + 1], m.pts[k + 2]]; }
      function col(i, j) { return new THREE.Color(cleanHex(m.cols[j * m.nx + i], '#888888')).lerp(shade, .14); }
      function strip(len, idx) {
        for (var k = 0; k < len - 1; k++) {
          var i1 = idx(k), i2 = idx(k + 1), a = V(i1[0], i1[1]), b = V(i2[0], i2[1]);
          var ca = col(i1[0], i1[1]), cb = col(i2[0], i2[1]);
          var q = [a, b, [b[0], 0, b[2]], a, [b[0], 0, b[2]], [a[0], 0, a[2]]], qc = [ca, cb, cb, ca, cb, ca];
          q.forEach(function (p, n) { P.push(p[0], p[1], p[2]); Cc.push(qc[n].r, qc[n].g, qc[n].b); });
        }
      }
      strip(m.nx, function (k) { return [k, m.nz - 1]; });
      strip(m.nx, function (k) { return [k, 0]; });
      strip(m.nz, function (k) { return [m.nx - 1, k]; });
      strip(m.nz, function (k) { return [0, k]; });
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
      g.computeVertexNormals(); return g;
    }

    // ── camera ──
    var aspect = W / H, camera;
    if (cam.ortho) camera = new THREE.OrthographicCamera(-cam.half * aspect, cam.half * aspect, cam.half, -cam.half, cam.near, cam.far);
    else camera = new THREE.PerspectiveCamera(cam.fov, aspect, cam.near, cam.far);
    function setLens(fov) {
      if (!cam.ortho && fov) camera.fov = fov;
      camera.updateProjectionMatrix();
      // The plan's lens shift centres the framed chart in the safe area.
      var e = camera.projectionMatrix.elements, sx = cam.shift[0], sy = cam.shift[1];
      if (cam.ortho) { e[12] += sx; e[13] += sy; } else { e[8] -= sx; e[9] -= sy; }
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    setLens();
    function placeCamera(azDeg) {
      var a = azDeg * Math.PI / 180, e = cam.el * Math.PI / 180;
      camera.position.set(T.x + Math.sin(a) * Math.cos(e) * cam.dist, T.y + Math.sin(e) * cam.dist, T.z + Math.cos(a) * Math.cos(e) * cam.dist);
      camera.up.set(0, 1, 0); camera.lookAt(T);
      camera.updateMatrixWorld(true);
    }

    // ── cinematic flight ──
    var flight = plan.flight, flightCurve = null, flightLength = 1;
    if (flight && plan.kind === 'flight') {
      var lead = plan.marks.filter(function (m) { return m.t === 'path'; })[flight.follow];
      if (lead) {
        flightCurve = new THREE.CatmullRomCurve3(lead.pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, 'centripetal', .45);
        flightLength = flightCurve.getLength();
      }
    }
    var flightCfg = state.cfg || {};
    function flightPhase(t) {
      if (flightCfg.animDirection !== 'bounce') return { u: t, direction: 1 };
      return t < .5 ? { u: t * 2, direction: 1 } : { u: (1 - t) * 2, direction: -1 };
    }
    function cameraAlongData(t) {
      var phase = flightPhase(t), u = clamp(phase.u, 0, .999999);
      var point = flightCurve.getPointAt(u), routeTangent = flightCurve.getTangentAt(u).normalize();
      var tangent = routeTangent.clone().multiplyScalar(phase.direction);
      var clearance = clamp(Number(flightCfg.flightHeight) || .85, .2, 3);
      var lookDistance = clamp(Number(flightCfg.flightLookAhead) || 1.5, .4, 5) * flight.pitch;
      // Fly beside the route, not inside its geometry. The stable side vector
      // keeps bounce playback on the same side of the data instead of cutting
      // across it at the turnaround.
      var side = new THREE.Vector3().crossVectors(routeTangent, new THREE.Vector3(0, 1, 0));
      if (side.lengthSq() < .0001) side.set(1, 0, 0); else side.normalize();
      if (side.x * flight.outward < 0) side.multiplyScalar(-1);
      var lateral = 1.65 + clearance * .55;
      flightCam.position.copy(point).addScaledVector(tangent, -.42).addScaledVector(side, lateral);
      flightCam.position.y += .55 + clearance * .65;
      var bank = clamp(tangent.y * 2.4, -1, 1) * clamp(Number(flightCfg.flightBank) || 0, 0, 30) * Math.PI / 180;
      flightCam.up.set(0, 1, 0);
      // Look at a real point farther along the spline. Tangent extrapolation
      // loses the route on precisely the sharp corrections worth showing.
      var ahead = clamp(u + phase.direction * lookDistance / Math.max(flightLength, .001), 0, .999999);
      var aim = flightCurve.getPointAt(ahead).addScaledVector(side, -lateral * .1);
      aim.y += .28;
      flightCam.lookAt(aim);
      flightCam.rotateZ(bank);
      flightCam.updateMatrixWorld(true);
      return u;
    }
    var flightCam = null;
    if (flightCurve) {
      flightCam = new THREE.PerspectiveCamera(clamp(Number(flightCfg.flightFov) || 54, 28, 82), aspect, .01, Math.max(120, radius * 16));
    }

    // ── overlay ──
    // Title, legend and the labels for a still camera arrive ready-drawn from
    // the hooks (the same SVG the vector export uses). A moving camera
    // re-places the labels each frame with the same rules.
    var staticLabels = overlayRoot.querySelector('[data-c3d-labels]');
    var halo = transparent ? null : C.backdrop;
    function placeLabels(project) {
      var placed = [], boxes = [], pad = plan.overlay.pad, limit = plan.overlay.bottom + pad * .5;
      var order = plan.labels.map(function (l, i) { return { l: l, i: i, q: project(l.p) }; }).sort(function (a, b) {
        return (b.l.pri || 0) - (a.l.pri || 0) || (a.q ? a.q[2] : 9) - (b.q ? b.q[2] : 9) || a.i - b.i;
      });
      order.forEach(function (o) {
        var l = o.l, q = o.q;
        if (!q) return;
        var size = l.size || 16, text = String(l.text || '');
        var w = Math.max(text.length, l.sub ? String(l.sub).length : 0) * size * .53 + 6, h = size * (l.sub ? 2.3 : 1.25);
        var anchor = l.anchor || 'middle';
        if (l.side != null) anchor = l.side > .25 ? 'start' : l.side < -.25 ? 'end' : 'middle';
        var x = q[0] + (l.dx || 0), y = q[1];
        if (l.kind === 'value') y -= size * .4 + (l.sub && l.up ? size * 1.15 : 0); else y += size * (l.below ? 1.35 : .35);
        var left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        var tries = l.below ? [0, size * 1.32] : [0], box = null;
        for (var t = 0; t < tries.length && !box; t++) {
          var top = y + tries[t] - size * .95, cand = [left, top, left + w, top + h];
          if (cand[0] < pad * .25 || cand[2] > W - pad * .25 || cand[1] < pad * .25 || cand[3] > limit) break;
          var hit = false;
          for (var k = 0; k < boxes.length; k++) { var b = boxes[k]; if (cand[0] < b[2] && cand[2] > b[0] && cand[1] < b[3] && cand[3] > b[1]) { hit = true; break; } }
          if (!hit) { box = cand; y += tries[t]; }
        }
        if (!box) return;
        boxes.push(box);
        placed.push({ x: x, y: y, anchor: anchor, text: text, sub: l.sub || '', size: size, weight: l.weight || 500, kind: l.kind, colour: l.colour || null });
      });
      return placed;
    }
    var v3 = new THREE.Vector3();
    function projectWith(c) {
      return function (p) {
        v3.set(p[0], p[1], p[2]).project(c);
        if (v3.z > 1 || v3.z < -1) return null;
        return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, v3.z];
      };
    }
    // A moving camera re-places its labels every frame. They are painted on the
    // presentation canvas with the frame rather than written into the DOM, so
    // the page holds still for anything that waits for it to settle (an
    // export, a thumbnail) and only the pixels move, as they do anyway.
    var fontFamily = plan.font || 'SUSE, sans-serif';
    function paintLabels(placed) {
      out.save();
      out.lineJoin = 'round';
      placed.forEach(function (l) {
        var dim = l.kind === 'category' || l.kind === 'series' || l.kind === 'tick';
        out.textAlign = l.anchor === 'start' ? 'left' : l.anchor === 'end' ? 'right' : 'center';
        function line(text, y, size, weight, alpha) {
          out.font = weight + ' ' + size + 'px ' + fontFamily;
          if (halo) { out.globalAlpha = 1; out.strokeStyle = halo; out.lineWidth = 4; out.strokeText(text, l.x, y); }
          out.globalAlpha = alpha; out.fillStyle = l.colour || C.text; out.fillText(text, l.x, y);
        }
        line(l.text, l.y, l.size, l.weight, dim ? .78 : 1);
        if (l.sub) line(l.sub, l.y + l.size * 1.15, Math.round(l.size * .86), 500, .7);
      });
      out.restore();
    }
    var flightHud = null;
    if (flightCam && flight) {
      var pad = plan.overlay.pad, hudY = H - pad - 54;
      overlayRoot.appendChild(svg('rect', { x: pad - 12, y: hudY - 35, width: Math.min(430, W * .42), height: 76, rx: 12, fill: C.backdrop, 'fill-opacity': .84, stroke: C.grid, 'stroke-opacity': .6 }));
      var categoryText = svg('text', { x: pad, y: hudY - 5, fill: C.text, 'font-size': clamp((flightCfg.labelSize || 18) * 1.15, 16, 28), 'font-weight': 700 });
      var valueText = svg('text', { x: pad, y: hudY + 23, fill: C.text, 'fill-opacity': .68, 'font-size': clamp(flightCfg.labelSize || 18, 13, 22) });
      overlayRoot.appendChild(categoryText); overlayRoot.appendChild(valueText);
      overlayRoot.appendChild(svg('line', { x1: pad, y1: H - pad + 2, x2: W - pad, y2: H - pad + 2, stroke: C.grid, 'stroke-width': 3 }));
      flightHud = { category: categoryText, value: valueText, left: pad, right: W - pad, y: H - pad + 2, last: -1, u: 0 };
    }
    function updateFlightHud(u) {
      if (!flightHud) return;
      flightHud.u = u;
      var i = clamp(Math.round(u * (flight.categories.length - 1)), 0, flight.categories.length - 1);
      if (i === flightHud.last) return;
      flightHud.last = i;
      var value = flight.values[i], formatted = Number.isFinite(value) ? value.toLocaleString('en', { maximumFractionDigits: 2 }) : 'No value';
      flightHud.category.textContent = flight.categories[i] || ('Point ' + (i + 1));
      flightHud.value.textContent = flight.series + ' · ' + formatted;
    }
    function paintProgress() {
      if (!flightHud) return;
      out.save(); out.strokeStyle = C.accent || C.text; out.lineWidth = 5; out.lineCap = 'round';
      out.beginPath(); out.moveTo(flightHud.left, flightHud.y); out.lineTo(flightHud.left + (flightHud.right - flightHud.left) * flightHud.u, flightHud.y); out.stroke();
      out.restore();
    }
    if (data.recommendation && W >= 520 && H >= 220) {
      var rec = data.recommendation, rpad = plan.overlay.pad, cardW = Math.min(500, Math.max(300, W * .42), W - rpad * 2), cardX = W - rpad - cardW, cardY = rpad;
      var recG = svg('g', { 'data-export-hide': '', role: 'note', 'aria-label': 'Chart recommendation: ' + rec.label + '. ' + rec.reason });
      recG.appendChild(svg('rect', { x: cardX, y: cardY, width: cardW, height: 96, rx: 12, fill: C.backdrop, 'fill-opacity': .92, stroke: C.grid }));
      recG.appendChild(svg('text', { x: cardX + 16, y: cardY + 26, fill: C.text, 'font-size': 14, 'font-weight': 750 }, 'Recommended · ' + rec.label + ' · ' + rec.confidence + ' confidence'));
      var reason = String(rec.reason || ''); if (reason.length > 96) reason = reason.slice(0, 93).replace(/\s+\S*$/, '') + '…';
      recG.appendChild(svg('text', { x: cardX + 16, y: cardY + 53, fill: C.text, 'fill-opacity': .64, 'font-size': 13 }, reason));
      recG.appendChild(svg('text', { x: cardX + 16, y: cardY + 77, fill: C.text, 'fill-opacity': .46, 'font-size': 12 }, data.profileSummary || ''));
      overlayRoot.appendChild(recG);
    }

    // ── motion ──
    var motion = cam.motion || 'none', disposed = false, raf = 0;
    var moving = motion === 'orbit' || motion === 'reveal-orbit' || motion === 'arc' || !!flightCam;
    var speed = Number((state.cfg || {}).animSpeed) || 1.5;
    var loopMs = flightCam ? Math.max(3000, (flight.categories.length) * speed * 1000) : Math.max(2000, speed * 4000);
    function growAt(t) {
      if (motion === 'reveal' || motion === 'reveal-orbit') { var s = ease(Math.min(1, t * (motion === 'reveal' ? 1.8 : 2.2))); return function () { return s; }; }
      if (motion === 'stagger') return function (g) { return ease(clamp((t - g * .6) / .3, 0, 1)); };
      return null;
    }
    // The DOM changes only when something in it really changes.
    var shown = false, valuesShown = null;
    function showOnce() {
      if (shown) return; shown = true;
      if (fallback) fallback.style.display = 'none';
      canvas.style.opacity = '1'; overlay.style.opacity = '1'; root.setAttribute('data-backend', 'webgl2');
      if (moving && staticLabels) staticLabels.style.display = 'none';
    }
    function showValues(on) {
      if (!staticLabels || valuesShown === on) return;
      valuesShown = on;
      var vals = staticLabels.querySelectorAll('.c3d-value');
      for (var i = 0; i < vals.length; i++) vals[i].style.opacity = on ? '' : '0';
    }
    function renderAt(t) {
      if (disposed) return;
      // beforeExport exposes the projected SVG for vector output. The live rAF
      // must not race that DOM swap and put the presentation canvas back while
      // the shell's asynchronous SVG walker is still serialising the node.
      if (root.getAttribute('data-export-renderer') === 'svg-projection') return;
      t = clamp(Number(t) || 0, 0, .999999);
      var gf = growAt(t), grown = 1;
      grow.forEach(function (it) {
        var s = gf ? Math.max(.001, gf(it.g)) : 1;
        if (gf) grown = Math.min(grown, s);
        if (it.kind === 'sphere') it.mesh.scale.setScalar(it.r * s);
        else { it.mesh.scale.y = s; it.mesh.position.y = it.y * s; }
      });
      var activeCam = camera;
      if (flightCam) { activeCam = flightCam; updateFlightHud(cameraAlongData(t)); }
      else if (motion === 'orbit' || motion === 'reveal-orbit') placeCamera(cam.az + t * 360);
      else if (motion === 'arc') placeCamera(cam.az + Math.sin(t * Math.PI * 2) * (cam.arc || 26));
      else placeCamera(cam.az);
      renderer.render(scene, activeCam);
      out.clearRect(0, 0, W, H); out.drawImage(gpu, 0, 0, W, H);
      // Values wait until their marks have grown; a moving camera re-places labels.
      if (moving) paintLabels(placeLabels(projectWith(activeCam)).filter(function (l) { return grown > .98 || l.kind !== 'value'; }));
      else showValues(grown > .98);
      paintProgress();
      showOnce();
      if (global.__lollyAnim && global.__lollyAnim.owner === root) global.__lollyAnim.curT = t;
    }
    // The export clock. A clip passes its length and walks t from 0; a still
    // passes neither, and gets the finished pose (the poster) rather than the
    // first frame of an entrance, which for a reveal is bars of no height.
    function clock(t, clipSec) {
      renderAt(clipSec == null && !(Number(t) > 0) ? (plan.poster || 0) : t);
    }
    clock.stillPose = true;
    renderAt(plan.poster || 0);
    canvas.__lollyFrameRender = clock;
    if (motion !== 'none') {
      var prev = global.__lollyAnim || {};
      var reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var elapsed = (Number(prev.curT) || 0) * loopMs, lastNow = null;
      global.__lollyAnim = { active: true, owner: root, loopMs: loopMs, labels: flightCam ? flight.categories : [], playing: !reduced && prev.playing !== false, scrubT: prev.scrubT, curT: prev.curT || 0 };
      function tick(now) {
        if (disposed) return;
        // A detached canvas is a dead preview: a one-shot render (a gallery look, a
        // batch row) is removed without anyone calling dispose(), and only a later
        // paint of the same chart would. Release it here instead of drawing forever.
        if (!canvas.isConnected) { api.dispose(); return; }
        var A = global.__lollyAnim && global.__lollyAnim.owner === root ? global.__lollyAnim : null;
        var dt = lastNow == null ? 0 : Math.max(0, now - lastNow); lastNow = now;
        if (!canvas.__lollyFrameDriven) {
          if (A && A.scrubT != null) { elapsed = clamp(Number(A.scrubT) || 0, 0, .999999) * loopMs; renderAt(A.scrubT); }
          else if (!A || A.playing !== false) { elapsed = (elapsed + dt) % loopMs; renderAt(elapsed / loopMs); }
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }

    var api = {
      renderAt:clock,
      inspect:function(){return state.report||null;},
      dispose:function(){
        if (disposed) return; disposed = true; if (raf) cancelAnimationFrame(raf); delete canvas.__lollyFrameRender;
        if (global.__lollyAnim && global.__lollyAnim.owner === root) global.__lollyAnim.active = false;
        scene.traverse(function (o) { if (o.geometry && o.geometry.dispose) try { o.geometry.dispose(); } catch (e) {} });
        disposables.forEach(function (o) { if (o && o.dispose) try { o.dispose(); } catch (e) {} });
        try { renderer.dispose(); } catch (e) {} try { renderer.forceContextLoss(); } catch (e) {}
      }
    };
    return api;
  }

  global.LollyChart3D = { mount: mount };
})(window);
