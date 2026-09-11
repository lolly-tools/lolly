/*! Lolly Chart Three adapter - MPL-2.0. Three.js is loaded separately under MIT. */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function finite(v) { var n = Number(v); return Number.isFinite(n) ? n : null; }
  function cleanHex(v, fallback) { return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : fallback; }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
  function extent(values) {
    var lo = Infinity, hi = -Infinity;
    (values || []).forEach(function (value) { var n = finite(value); if (n == null) return; lo = Math.min(lo, n); hi = Math.max(hi, n); });
    if (!Number.isFinite(lo)) return [0, 1];
    if (lo === hi) return [lo - .5, hi + .5];
    return [lo, hi];
  }
  function normal(v, ex) { var n = finite(v); return n == null ? null : (n - ex[0]) / (ex[1] - ex[0]); }
  function svg(tag, attrs, text) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { if (attrs[key] != null) el.setAttribute(key, String(attrs[key])); });
    if (text != null) el.textContent = String(text);
    return el;
  }

  function mount(opts) {
    var root = opts.root, state = opts.state || {}, THREE = opts.THREE;
    var cfg = state.cfg || {}, data = state.data || {}, spec = state.spec || {};
    var isCinematic = ['flythrough3d','ribbon3d','constellation3d','skyline3d'].indexOf(cfg.chartType) >= 0;
    var canvas = root.querySelector('[data-chart3d-canvas]');
    var overlay = root.querySelector('[data-chart3d-overlay]');
    var overlayRoot = overlay && overlay.querySelector('[data-chart3d-overlay-root]');
    var fallback = root.querySelector('[data-chart3d-fallback]');
    if (!canvas || !overlay || !overlayRoot || !THREE || !THREE.WebGLRenderer) throw new Error('3-D chart renderer is unavailable');

    var W = clamp(Math.round(Number(cfg.width) || 1280), 100, 8000);
    var H = clamp(Math.round(Number(cfg.height) || 800), 100, 8000);
    canvas.width = W; canvas.height = H;
    var out = canvas.getContext('2d');
    if (!out) throw new Error('2-D presentation canvas is unavailable');
    var gpu = document.createElement('canvas'); gpu.width = W; gpu.height = H;
    var renderer = new THREE.WebGLRenderer({ canvas: gpu, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.sceneMaterial === 'accurate' ? 1 : 1.05;
    renderer.shadowMap.enabled = !!cfg.sceneShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var theme = cfg.brandTheme || {}, tc = theme.colours || {};
    var surface = cleanHex(tc.surface, '#ffffff'), ink = cleanHex(tc.ink, '#111111');
    var edge = cleanHex(tc.edge, ink), primary = cleanHex(tc.primary, '#4676ee');
    var palette = (tc.categorical || []).filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
    if (!palette.length) palette = [primary, cleanHex(tc.secondary, primary), ink];
    var scene = new THREE.Scene();
    if (!cfg.transparent) scene.background = new THREE.Color(surface);
    var world = new THREE.Group(); scene.add(world);
    var disposables = [];
    var materialCache = {};

    function material(colour, opacity) {
      colour = cleanHex(colour, primary); opacity = opacity == null ? 1 : opacity;
      var kind = cfg.sceneMaterial || 'matte', key = kind + ':' + colour + ':' + opacity;
      if (materialCache[key]) return materialCache[key];
      var m;
      if (kind === 'accurate') {
        m = new THREE.MeshBasicMaterial({ color: colour, transparent: opacity < 1, opacity: opacity });
      } else if (kind === 'glass') {
        m = new THREE.MeshPhysicalMaterial({ color: colour, roughness: clamp(cfg.sceneRoughness,0,1), metalness: clamp(cfg.sceneMetalness,0,1), transparent: true, opacity: .58, transmission: .36, thickness: .5 });
      } else {
        m = new THREE.MeshStandardMaterial({ color: colour, roughness: kind === 'gloss' ? Math.min(.24, cfg.sceneRoughness) : clamp(cfg.sceneRoughness,0,1), metalness: kind === 'gloss' ? Math.max(.16, cfg.sceneMetalness) : clamp(cfg.sceneMetalness,0,1), transparent: opacity < 1, opacity: opacity });
      }
      materialCache[key] = m; disposables.push(m); return m;
    }
    function addMesh(geometry, mat, id) {
      var mesh = new THREE.Mesh(geometry, mat); mesh.name = id || '';
      mesh.castShadow = !!cfg.sceneShadows; mesh.receiveShadow = !!cfg.sceneShadows;
      world.add(mesh); disposables.push(geometry); return mesh;
    }

    if (cfg.sceneMaterial !== 'accurate') {
      scene.add(new THREE.HemisphereLight(surface, ink, 1.25));
      scene.add(new THREE.AmbientLight(0xffffff, .52));
      var key = new THREE.DirectionalLight(0xffffff, 2.25); key.position.set(-5, 9, 6); key.castShadow = !!cfg.sceneShadows;
      if (key.shadow) { key.shadow.mapSize.width = 1024; key.shadow.mapSize.height = 1024; key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7; }
      scene.add(key);
      var fill = new THREE.DirectionalLight(cleanHex(tc.secondary, primary), .46); fill.position.set(7, 4, -4); scene.add(fill);
    } else scene.add(new THREE.AmbientLight(0xffffff, 1));

    var gridSize = isCinematic ? Math.max(8, ((data.categories || []).length - 1) * 1.18 + 4) : 8;
    var grid = new THREE.GridHelper(gridSize, Math.max(8, Math.min(40, Math.round(gridSize))), edge, edge);
    var gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(function (m) { m.transparent = true; m.opacity = cfg.chartStyle === 'poster' ? .08 : .22; disposables.push(m); });
    grid.position.y = -.012; grid.visible = cfg.showGrid !== false; world.add(grid); disposables.push(grid.geometry);
    if (cfg.sceneShadows) {
      var groundGeo = new THREE.PlaneGeometry(10, 10), groundMat = new THREE.ShadowMaterial({ opacity: .18 });
      var ground = new THREE.Mesh(groundGeo, groundMat); ground.rotation.x = -Math.PI/2; ground.position.y = -.02; ground.receiveShadow = true;
      world.add(ground); disposables.push(groundGeo, groundMat);
    }

    var flightCurve = null, flightMeta = null, flightHud = null;
    var maxSpan = buildMarks();

    function buildMarks() {
      if (isCinematic) return cinematic();
      if (cfg.chartType === 'scatter3d') return scatter();
      if (cfg.chartType === 'surface3d') return surfacePlot();
      return bars();
    }

    function bars() {
      var cats = data.categories || [], series = data.series || [];
      var values = []; series.forEach(function (s) { (s.values || []).forEach(function (v) { if (finite(v) != null) values.push(Number(v)); }); });
      var ex = extent(values.concat([0])), maxAbs = Math.max(Math.abs(ex[0]), Math.abs(ex[1]), 1);
      var nx = Math.max(1, cats.length), nz = Math.max(1, series.length), span = Math.max(nx, nz);
      var pitch = Math.min(1.1, 6.2 / span), bw = pitch * .62, yScale = 3.25 / maxAbs;
      series.forEach(function (s, zi) {
        (s.values || []).forEach(function (raw, xi) {
          var value = finite(raw); if (value == null) return;
          var height = Math.max(.012, Math.abs(value) * yScale);
          var mesh = addMesh(new THREE.BoxGeometry(bw, height, bw), material(palette[(cfg.colorBy === 'category' ? xi : zi) % palette.length]), 'bar:' + zi + ':' + xi);
          mesh.position.set((xi-(nx-1)/2)*pitch, (value < 0 ? -1 : 1)*height/2, (zi-(nz-1)/2)*pitch);
          mesh.userData.value = value;
        });
      });
      return Math.max(4.4, span * pitch);
    }

    function cinematic() {
      var cats = data.categories || [], series = data.series || [];
      if (cats.length < 2 || !series.length) return 8;
      var values = [];
      series.forEach(function (s) { (s.values || []).forEach(function (v) { if (finite(v) != null) values.push(+v); }); });
      var ex = extent(values), maxAbs = values.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 1), nx = cats.length, nz = series.length;
      var pitch = 1.18, spanZ = Math.max(7, (nx - 1) * pitch), lane = Math.min(1.55, 5.2 / Math.max(1, nz));

      function valueAt(s, i) {
        var direct = finite(s.values && s.values[i]); if (direct != null) return direct;
        var a = i - 1, b = i + 1;
        while (a >= 0 && finite(s.values[a]) == null) a--;
        while (b < nx && finite(s.values[b]) == null) b++;
        if (a >= 0 && b < nx) return +s.values[a] + (+s.values[b] - +s.values[a]) * ((i - a) / (b - a));
        if (a >= 0) return +s.values[a];
        if (b < nx) return +s.values[b];
        return ex[0];
      }
      function pointFor(si, i) {
        var value = valueAt(series[si], i);
        // Skyline towers retain an honest zero baseline; path/ribbon forms use
        // the shared series extent so relative changes remain readable.
        var y = cfg.chartType === 'skyline3d' ? value / maxAbs * 3.9 : .28 + clamp(normal(value, ex), 0, 1) * 3.9;
        return new THREE.Vector3((si - (nz - 1) / 2) * lane, y, spanZ / 2 - i * pitch);
      }
      function ribbonGeometry(curve, width) {
        var samples = curve.getPoints(Math.max(16, nx * 10)), verts = [], indices = [];
        samples.forEach(function (p) { verts.push(p.x - width, p.y, p.z, p.x + width, p.y, p.z); });
        for (var i = 0; i < samples.length - 1; i++) { var a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals(); return geo;
      }

      var requested = String(cfg.flightSeries || '').trim().toLowerCase(), follow = 0;
      if (/^\d+$/.test(requested)) follow = clamp(+requested - 1, 0, nz - 1);
      else if (requested) for (var fi = 0; fi < nz; fi++) if (String(series[fi].name || '').trim().toLowerCase() === requested) { follow = fi; break; }

      series.forEach(function (s, si) {
        var points = cats.map(function (_, i) { return pointFor(si, i); });
        var curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', .45);
        var col = palette[si % palette.length], mat;
        if (cfg.chartType === 'ribbon3d') {
          mat = material(col, si === follow ? .9 : .58); mat.side = THREE.DoubleSide;
          addMesh(ribbonGeometry(curve, si === follow ? .25 : .18), mat, 'ribbon:' + si);
        } else {
          var radius = cfg.chartType === 'constellation3d' ? .028 : cfg.chartType === 'skyline3d' ? .022 : (si === follow ? .075 : .04);
          addMesh(new THREE.TubeGeometry(curve, Math.max(24, nx * 12), radius, 8, false), material(col, si === follow ? .96 : .58), 'flight-line:' + si);
        }
        points.forEach(function (point, i) {
          if (cfg.chartType === 'skyline3d') {
            var towerHeight = Math.max(.03, Math.abs(point.y)), towerWidth = si === follow ? .32 : .24;
            var tower = addMesh(new THREE.BoxGeometry(towerWidth, towerHeight, towerWidth), material(col, si === follow ? .88 : .58), 'flight-tower:' + si + ':' + i);
            tower.position.set(point.x, point.y < 0 ? -towerHeight / 2 : towerHeight / 2, point.z);
          }
          var radius = cfg.chartType === 'constellation3d' ? .13 : cfg.chartType === 'skyline3d' ? .065 : (si === follow ? .09 : .06);
          var node = addMesh(new THREE.SphereGeometry(radius, 14, 10), material(col, si === follow ? 1 : .72), 'flight-point:' + si + ':' + i);
          node.position.copy(point);
          if (cfg.chartType === 'constellation3d') {
            var height = Math.max(.02, point.y);
            var pylon = addMesh(new THREE.BoxGeometry(.018, height, .018), material(col, .2), 'flight-pylon:' + si + ':' + i);
            pylon.position.set(point.x, height / 2, point.z);
          }
        });
        if (si === follow) {
          flightCurve = curve;
          flightMeta = { categories: cats.slice(), values: cats.map(function (_, i) { return valueAt(s, i); }), series: String(s.name || 'Value'), pitch: pitch, length: curve.getLength(), outward: si < (nz - 1) / 2 ? -1 : 1 };
        }
      });
      return Math.max(8, spanZ);
    }

    function scatter() {
      var cols = data.numericCols || [];
      if (cols.length < 3) return 5;
      var ex = [extent(cols[0].values), extent(cols[1].values), extent(cols[2].values)];
      var sizeEx = cols[3] ? extent(cols[3].values) : [0,1];
      var n = Math.min(4000, cols[0].values.length);
      for (var i=0; i<n; i++) {
        var xn=normal(cols[0].values[i],ex[0]), yn=normal(cols[1].values[i],ex[1]), zn=normal(cols[2].values[i],ex[2]);
        if (xn==null || yn==null || zn==null) continue;
        var sn = cols[3] ? normal(cols[3].values[i],sizeEx) : .35;
        var radius = .075 + clamp(sn == null ? .35 : sn,0,1)*.18;
        var mesh = addMesh(new THREE.SphereGeometry(radius, 14, 10), material(palette[i%palette.length], .9), 'point:' + i);
        mesh.position.set((xn-.5)*6, (yn-.5)*5.2 + 2.55, (zn-.5)*6);
      }
      return 6;
    }

    function surfacePlot() {
      var cats = data.categories || [], series = data.series || [];
      if (cats.length < 2 || series.length < 2) return 5;
      var all = []; series.forEach(function(s){ (s.values||[]).forEach(function(v){ if(finite(v)!=null) all.push(Number(v)); }); });
      var ex = extent(all), verts = [], cols = [], indices = [], nx = cats.length, nz = series.length;
      for (var z=0; z<nz; z++) for (var x=0; x<nx; x++) {
        var yn = normal(series[z].values[x], ex); if (yn == null) yn = 0;
        verts.push((x/(nx-1)-.5)*6, yn*3.7, (z/(nz-1)-.5)*6);
        var c = new THREE.Color(palette[clamp(Math.round(yn*(palette.length-1)),0,palette.length-1)]); cols.push(c.r,c.g,c.b);
      }
      for (var zz=0; zz<nz-1; zz++) for (var xx=0; xx<nx-1; xx++) {
        var a=zz*nx+xx,b=a+1,c=a+nx+1,d=a+nx; indices.push(a,b,d,b,c,d);
      }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3)); geo.setIndex(indices); geo.computeVertexNormals();
      var mat;
      if (cfg.sceneMaterial === 'accurate') mat = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide });
      else if (cfg.sceneMaterial === 'glass') mat = new THREE.MeshPhysicalMaterial({ vertexColors:true, side:THREE.DoubleSide, roughness:clamp(cfg.sceneRoughness,0,1), metalness:clamp(cfg.sceneMetalness,0,1), transparent:true, opacity:.67, transmission:.22 });
      else mat = new THREE.MeshStandardMaterial({ vertexColors:true, side:THREE.DoubleSide, roughness:clamp(cfg.sceneRoughness,0,1), metalness:clamp(cfg.sceneMetalness,0,1) });
      disposables.push(mat); addMesh(geo,mat,'surface'); return 6;
    }

    var aspect = W/H, camera;
    if (isCinematic) {
      camera = new THREE.PerspectiveCamera(clamp(Number(cfg.flightFov) || 54, 28, 82), aspect, .01, Math.max(120, maxSpan * 8));
    } else if (cfg.cameraProjection === 'orthographic') {
      var half = Math.max(4.5, maxSpan*.72); camera = new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,100);
    } else camera = new THREE.PerspectiveCamera(36,aspect,.01,100);
    var baseAz = (Number(cfg.cameraAzimuth)||38)*Math.PI/180, elevation = clamp(Number(cfg.cameraElevation)||24,5,80)*Math.PI/180;
    var distance = cfg.cameraProjection === 'orthographic' ? Math.max(10,maxSpan*2.2) : Math.max(11,maxSpan*2.35);

    function cameraAt(angle) {
      var flat = Math.cos(elevation)*distance;
      camera.position.set(Math.sin(angle)*flat, Math.sin(elevation)*distance+1.15, Math.cos(angle)*flat);
      camera.lookAt(0,1.25,0);
    }

    function flightPhase(t) {
      if (cfg.animDirection !== 'bounce') return { u: t, direction: 1 };
      return t < .5 ? { u: t * 2, direction: 1 } : { u: (1 - t) * 2, direction: -1 };
    }

    function cameraAlongData(t) {
      if (!flightCurve || !flightMeta) { cameraAt(baseAz); return 0; }
      var phase = flightPhase(t), u = clamp(phase.u, 0, .999999);
      var point = flightCurve.getPointAt(u), routeTangent = flightCurve.getTangentAt(u).normalize();
      var tangent = routeTangent.clone().multiplyScalar(phase.direction);
      var clearance = clamp(Number(cfg.flightHeight) || .85, .2, 3);
      var lookDistance = clamp(Number(cfg.flightLookAhead) || 1.5, .4, 5) * flightMeta.pitch;
      // Fly beside the route, not inside its geometry.  The stable side vector
      // keeps bounce playback on the same side of the data instead of cutting
      // across it at the turnaround.
      var side = new THREE.Vector3().crossVectors(routeTangent, new THREE.Vector3(0,1,0));
      if (side.lengthSq() < .0001) side.set(1,0,0); else side.normalize();
      if (side.x * flightMeta.outward < 0) side.multiplyScalar(-1);
      var lateral = 1.65 + clearance * .55;
      camera.position.copy(point).addScaledVector(tangent, -.42).addScaledVector(side, lateral);
      camera.position.y += .55 + clearance * .65;
      var bank = clamp(tangent.y * 2.4, -1, 1) * clamp(Number(cfg.flightBank) || 0, 0, 30) * Math.PI / 180;
      camera.up.set(0,1,0);
      // Look at a real point farther along the spline. Tangent extrapolation
      // loses the route on precisely the sharp corrections worth showing.
      var ahead = clamp(u + phase.direction * lookDistance / Math.max(flightMeta.length, .001), 0, .999999);
      var aim = flightCurve.getPointAt(ahead).addScaledVector(side, -lateral*.1);
      aim.y += .28;
      camera.lookAt(aim);
      camera.rotateZ(bank);
      return u;
    }

    function drawOverlay() {
      while (overlayRoot.firstChild) overlayRoot.removeChild(overlayRoot.firstChild);
      var pad=Math.round(Math.min(W,H)*.045)+16, titleY=pad+34;
      if (cfg.heading) {
        overlayRoot.appendChild(svg('rect',{x:pad-12,y:pad-9,width:Math.min(620,W*.54),height:cfg.subheading?79:51,rx:10,fill:surface,'fill-opacity':.76}));
        overlayRoot.appendChild(svg('text',{x:pad,y:titleY,fill:ink,'font-size':cfg.titleSize||34,'font-weight':cfg.titleWeight||700,'data-canvas-input':'heading'},cfg.heading));
      }
      if (cfg.subheading) overlayRoot.appendChild(svg('text',{x:pad,y:titleY+(cfg.heading?32:0),fill:ink,'fill-opacity':.64,'font-size':20},cfg.subheading));
      var series = data.series || [];
      if (cfg.showLegend && series.length > 1) {
        var x=W-pad, y=pad+10, fs=clamp(cfg.legendTextSize||cfg.labelSize||18,12,28);
        series.slice(0,12).forEach(function(s,i){ var yy=y+i*(fs+10); overlayRoot.appendChild(svg('rect',{x:x-190,y:yy-fs*.75,width:fs*.8,height:fs*.8,rx:cfg.legendRadius||2,fill:palette[i%palette.length]})); overlayRoot.appendChild(svg('text',{x:x-190+fs+5,y:yy,fill:ink,'font-size':fs,'text-anchor':'start'},s.name)); });
      }
      var nums=data.numericCols||[], axis = cfg.chartType==='scatter3d' ? nums.slice(0,3).map(function(c){return c.name;}) : [cfg.xTitle||'Categories',cfg.yTitle||'Value','Series'];
      if (isCinematic && flightMeta) {
        var hudY = H - pad - 72;
        overlayRoot.appendChild(svg('rect',{x:pad-12,y:hudY-35,width:Math.min(430,W*.42),height:76,rx:12,fill:surface,'fill-opacity':.82,stroke:edge,'stroke-opacity':.36}));
        var categoryText=svg('text',{x:pad,y:hudY-5,fill:ink,'font-size':clamp((cfg.labelSize||18)*1.15,16,28),'font-weight':700});
        var valueText=svg('text',{x:pad,y:hudY+23,fill:ink,'fill-opacity':.68,'font-size':clamp(cfg.labelSize||18,13,22)});
        overlayRoot.appendChild(categoryText); overlayRoot.appendChild(valueText);
        overlayRoot.appendChild(svg('line',{x1:pad,y1:H-pad+2,x2:W-pad,y2:H-pad+2,stroke:edge,'stroke-opacity':.45,'stroke-width':3}));
        var progress=svg('line',{x1:pad,y1:H-pad+2,x2:pad,y2:H-pad+2,stroke:primary,'stroke-width':5,'stroke-linecap':'round'}); overlayRoot.appendChild(progress);
        flightHud={category:categoryText,value:valueText,progress:progress,left:pad,right:W-pad};
      } else {
        overlayRoot.appendChild(svg('text',{x:pad,y:H-pad,fill:ink,'fill-opacity':.62,'font-size':clamp(cfg.labelSize,12,22)},'x · '+(axis[0]||'x')));
        overlayRoot.appendChild(svg('text',{x:W/2,y:H-pad,fill:ink,'fill-opacity':.62,'font-size':clamp(cfg.labelSize,12,22),'text-anchor':'middle'},'y · '+(axis[1]||'y')));
        overlayRoot.appendChild(svg('text',{x:W-pad,y:H-pad,fill:ink,'fill-opacity':.62,'font-size':clamp(cfg.labelSize,12,22),'text-anchor':'end'},'z · '+(axis[2]||'z')));
      }
      if (data.recommendation && W>=520 && H>=220) {
        var rec=data.recommendation, cardW=Math.min(500,Math.max(300,W*.42),W-pad*2), cardX=W-pad-cardW, cardY=H-pad-120;
        var recG=svg('g',{'data-export-hide':'',role:'note','aria-label':'Chart recommendation: '+rec.label+'. '+rec.reason});
        recG.appendChild(svg('rect',{x:cardX,y:cardY,width:cardW,height:96,rx:12,fill:surface,'fill-opacity':.9,stroke:edge,'stroke-opacity':.5}));
        recG.appendChild(svg('text',{x:cardX+16,y:cardY+26,fill:ink,'font-size':14,'font-weight':750},'Recommended · '+rec.label+' · '+rec.confidence+' confidence'));
        var reason=String(rec.reason||''); if(reason.length>96) reason=reason.slice(0,93).replace(/\s+\S*$/,'')+'…';
        recG.appendChild(svg('text',{x:cardX+16,y:cardY+53,fill:ink,'fill-opacity':.64,'font-size':13},reason));
        recG.appendChild(svg('text',{x:cardX+16,y:cardY+77,fill:ink,'fill-opacity':.46,'font-size':12},data.profileSummary||''));
        overlayRoot.appendChild(recG);
      }
      var brand=(spec.theme&& (spec.theme.sourceLabel||spec.theme.sourceId));
      if (brand) overlayRoot.appendChild(svg('text',{x:W-pad,y:H-14,fill:ink,'fill-opacity':.42,'font-size':13,'text-anchor':'end'},'Theme · '+brand));
    }
    drawOverlay();

    function updateFlightHud(u) {
      if (!flightHud || !flightMeta) return;
      var i=clamp(Math.round(u*(flightMeta.categories.length-1)),0,flightMeta.categories.length-1);
      var value=flightMeta.values[i], formatted=Number.isFinite(value) ? value.toLocaleString('en',{maximumFractionDigits:2}) : 'No value';
      flightHud.category.textContent=flightMeta.categories[i] || ('Point '+(i+1));
      flightHud.value.textContent=flightMeta.series+' · '+formatted;
      flightHud.progress.setAttribute('x2',String(flightHud.left+(flightHud.right-flightHud.left)*u));
    }

    var motion = isCinematic ? 'data-flight' : (cfg.motionPreset || 'none'), disposed=false, raf=0, curT=0;
    var loopMs=isCinematic ? Math.max(3000,(data.categories||[]).length*(Number(cfg.animSpeed)||1.5)*1000) : Math.max(2000,(Number(cfg.animSpeed)||1.5)*4000);
    function renderAt(t) {
      if (disposed) return;
      // beforeExport exposes the projected SVG for vector output. The live rAF
      // must not race that DOM swap and put the presentation canvas back while
      // the shell's asynchronous SVG walker is still serialising the node.
      if (root.getAttribute('data-export-renderer') === 'svg-projection') return;
      t=clamp(Number(t)||0,0,.999999); curT=t;
      var reveal = (motion==='reveal'||motion==='reveal-orbit') ? ease(Math.min(1,t*1.8)) : 1;
      if (isCinematic) world.scale.set(1,1,1);
      else if (cfg.chartType==='scatter3d') world.scale.set(Math.max(.001,reveal),Math.max(.001,reveal),Math.max(.001,reveal));
      else world.scale.set(1,Math.max(.001,reveal),1);
      if (isCinematic) updateFlightHud(cameraAlongData(t));
      else { var angle=baseAz+((motion==='orbit'||motion==='reveal-orbit') ? t*Math.PI*2 : 0); cameraAt(angle); }
      renderer.render(scene,camera);
      out.clearRect(0,0,W,H); out.drawImage(gpu,0,0,W,H);
      if (fallback) fallback.style.display='none'; canvas.style.opacity='1'; overlay.style.opacity='1'; root.setAttribute('data-backend','webgl2');
      if (global.__lollyAnim && global.__lollyAnim.owner===root) global.__lollyAnim.curT=t;
    }
    renderAt((spec.motion&&spec.motion.poster)||.22);
    canvas.__lollyFrameRender=renderAt;
    if (motion!=='none') {
      var prev=global.__lollyAnim||{};
      var reduced=!!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var elapsed=(Number(prev.curT)||0)*loopMs, lastNow=null;
      global.__lollyAnim={active:true,owner:root,loopMs:loopMs,labels:isCinematic?(data.categories||[]):[],playing:!reduced&&prev.playing!==false,scrubT:prev.scrubT,curT:prev.curT||0};
      function tick(now) {
        if (disposed) return;
        var A=global.__lollyAnim&&global.__lollyAnim.owner===root?global.__lollyAnim:null;
        var dt=lastNow==null?0:Math.max(0,now-lastNow); lastNow=now;
        if (!canvas.__lollyFrameDriven) {
          if (A&&A.scrubT!=null) { elapsed=clamp(Number(A.scrubT)||0,0,.999999)*loopMs; renderAt(A.scrubT); }
          else if (!A||A.playing!==false) { elapsed=(elapsed+dt)%loopMs; renderAt(elapsed/loopMs); }
        }
        raf=requestAnimationFrame(tick);
      }
      raf=requestAnimationFrame(tick);
    }

    return {
      renderAt:renderAt,
      inspect:function(){return state.report||null;},
      dispose:function(){
        if(disposed)return;disposed=true;if(raf)cancelAnimationFrame(raf);delete canvas.__lollyFrameRender;
        if(global.__lollyAnim&&global.__lollyAnim.owner===root)global.__lollyAnim.active=false;
        world.traverse(function(o){if(o.geometry&&o.geometry.dispose)try{o.geometry.dispose();}catch(e){} });
        disposables.forEach(function(o){if(o&&o.dispose)try{o.dispose();}catch(e){} });
        try{renderer.dispose();}catch(e){} try{renderer.forceContextLoss();}catch(e){}
      }
    };
  }

  global.LollyChart3D = { mount: mount };
})(window);
