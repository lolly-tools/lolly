// SPDX-License-Identifier: MPL-2.0

import { geoEqualEarth, geoEquirectangular, geoMercator, geoNaturalEarth1 } from 'd3-geo';
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  Matrix3,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  cameraDistance,
  countries,
  fitMap,
  geoPath,
  geoRotation,
  grid,
  layout,
  night,
  RAD,
  region,
} from './geography';
import { num, type State, type View } from './model';

const vertexShader = `
attribute vec3 flatPosition;
varying vec3 vGeo;
varying vec3 vShape;
uniform float unfold;
uniform mat3 orient;
void main(){
 vGeo=orient*position;
 vec3 p=mix(position,flatPosition,unfold);
 vShape=p;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const fragmentShader = `
precision highp float;
uniform sampler2D atlas;
uniform float unfold;
uniform vec3 accent;
varying vec3 vGeo;
varying vec3 vShape;
void main(){
 vec3 g=normalize(vGeo);
 vec2 uv=vec2(atan(g.x,g.z)/6.28318530718+0.5,asin(clamp(g.y,-1.0,1.0))/3.14159265359+0.5);
 vec3 col=texture2D(atlas,uv).rgb;
 float front=clamp(normalize(vShape).z,0.0,1.0);
 float edge=pow(1.0-front,3.0)*(1.0-unfold);
 col=col*(1.0-0.22*edge)+accent*edge*0.22;
 gl_FragColor=vec4(col,1.0);
}`;
export function createGlobe(canvas: HTMLCanvasElement, s: State) {
  const l = layout(s),
    scratch = document.createElement('canvas'),
    ctx = canvas.getContext('2d')!;
  const renderer = new WebGLRenderer({ canvas: scratch, antialias: true, alpha: true });
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(l.map.w * scale);
  canvas.height = Math.round(l.map.h * scale);
  renderer.setSize(canvas.width, canvas.height, false);
  const scene = new Scene(),
    camera = new PerspectiveCamera(num(s.inputs.fov, 40), l.map.w / l.map.h, 0.01, 100);
  camera.position.z = cameraDistance(s);
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = Math.min(4096, renderer.capabilities.maxTextureSize);
  textureCanvas.height = textureCanvas.width / 2;
  const tc = textureCanvas.getContext('2d')!,
    tp = geoEquirectangular()
      .translate([textureCanvas.width / 2, textureCanvas.height / 2])
      .scale(textureCanvas.width / (2 * Math.PI)),
    path = geoPath(tp, tc);
  const draw = (geo: any, fill?: string, stroke?: string, width = 0.6) => {
    tc.beginPath();
    path(geo);
    if (fill) {
      tc.fillStyle = fill;
      tc.fill();
    }
    if (stroke) {
      tc.strokeStyle = stroke;
      tc.lineWidth = width;
      tc.stroke();
    }
  };
  tc.fillStyle = s.palette.ocean;
  tc.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  draw(
    countries,
    s.palette.land,
    s.inputs.showBorders !== false
      ? s.inputs.theme === 'minimal'
        ? s.palette.edge
        : s.palette.ocean
      : undefined,
    0.8
  );
  const seen = new Set<string>();
  for (const p of s.places) {
    if (p.spread && !p.error && !seen.has(p.timezone)) {
      const r = region(p.timezone);
      if (r) {
        tc.globalAlpha = num(s.inputs.regionOpacity, 0.45);
        draw(r, p.color, p.color);
        tc.globalAlpha = 1;
        seen.add(p.timezone);
      }
    }
  }
  if (s.inputs.showGrid !== false) {
    tc.globalAlpha = 0.14;
    draw(grid, undefined, s.palette.ink, 0.75);
    tc.globalAlpha = 1;
  }
  if (s.inputs.showConnections !== false) {
    const coordinates = s.places
      .filter((p) => !p.error && p.longitude !== null && p.latitude !== null)
      .map((p) => [p.longitude, p.latitude]);
    if (coordinates.length > 1) {
      tc.setLineDash([6, 7]);
      draw({ type: 'LineString', coordinates }, undefined, s.palette.accent, 1.5);
      tc.setLineDash([]);
    }
  }
  const dayAtlas = tc.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
  const texture = new CanvasTexture(textureCanvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  let lastNight = '';
  function setTime() {
    if (s.inputs.showNight === false || !s.instant) return;
    const key = s.instant.slice(0, 16);
    if (key === lastNight) return;
    lastNight = key;
    tc.putImageData(dayAtlas, 0, 0);
    tc.globalAlpha = 0.24;
    draw(night(new Date(s.instant)), '#030910');
    tc.globalAlpha = 1;
    texture.needsUpdate = true;
  }
  const positions: number[] = [],
    flat: number[] = [],
    indices: number[] = [],
    nx = 256,
    ny = 128;
  const projectionType = s.inputs.projection === 'globe' ? 'equalEarth' : s.inputs.projection;
  const fp = (
    {
      equalEarth: geoEqualEarth,
      naturalEarth: geoNaturalEarth1,
      mercator: geoMercator,
      equirectangular: geoEquirectangular,
    }[projectionType as 'equalEarth'] || geoEqualEarth
  )();
  const aspect = l.map.w / l.map.h;
  fitMap(fp, aspect * 2, 2, s.inputs.mapFit !== 'fit');
  const translation = fp.translate();
  fp.translate([translation[0] - aspect, translation[1] - 1]);
  for (let y = 0; y <= ny; y++) {
    const lat = -90 + (y * 180) / ny;
    for (let x = 0; x <= nx; x++) {
      const lon = -180 + (x * 360) / nx,
        a = lon * RAD,
        b = lat * RAD;
      positions.push(Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a));
      const p = fp([lon, Math.max(-85.051, Math.min(85.051, lat))])!;
      flat.push(p[0], -p[1], 0);
      if (x < nx && y < ny) {
        const k = y * (nx + 1) + x;
        indices.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('flatPosition', new Float32BufferAttribute(flat, 3));
  geometry.setIndex(indices);
  const accent = new Vector3(
    ...([1, 3, 5].map((i) => parseInt(s.palette.accent.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ])
  );
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      atlas: { value: texture },
      unfold: { value: 0 },
      orient: { value: new Matrix3() },
      accent: { value: accent },
    },
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  let rot = geoRotation([0, 0, 0]),
    amount = 0;
  const vector = (xy: number[]) =>
    new Vector3(
      Math.cos(xy[1] * RAD) * Math.sin(xy[0] * RAD),
      Math.sin(xy[1] * RAD),
      Math.cos(xy[1] * RAD) * Math.cos(xy[0] * RAD)
    );
  function render(view: View, unfold: number) {
    setTime();
    rot = geoRotation([-view[0], -view[1], view[2]]);
    amount = s.inputs.projection === 'globe' ? 0 : unfold;
    const inv = rot.invert!,
      vx = vector(inv([90, 0])),
      vy = vector(inv([0, 90])),
      vz = vector(inv([0, 0]));
    material.uniforms.orient.value.set(vx.x, vy.x, vz.x, vx.y, vy.y, vz.y, vx.z, vy.z, vz.z);
    material.uniforms.unfold.value = amount;
    mesh.rotation.x = num(s.inputs.tilt, 0) * RAD;
    mesh.updateMatrixWorld();
    const globeSpan = s.inputs.mapFit === 'fit' ? Math.min(1, camera.aspect) : camera.aspect;
    const globeZoom = Math.sqrt(camera.position.z ** 2 - 1) * globeSpan;
    // A sphere silhouette and a flat plane have different perspective extents.
    // Blend their exact fits so unfolding does not add a hidden ten-percent inset.
    camera.zoom =
      Math.tan((camera.fov * RAD) / 2) *
      (globeZoom * (1 - amount) + camera.position.z * amount) *
      view[3] *
      num(s.inputs.mapScale, 1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    ctx.fillStyle = s.palette.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(scratch, 0, 0);
  }
  function project(xy: number[]) {
    const r = rot([xy[0], xy[1]]),
      g = vector(r),
      f = fp([r[0], Math.max(-85.051, Math.min(85.051, r[1]))])!,
      v = g
        .clone()
        .lerp(new Vector3(f[0], -f[1], 0), amount)
        .applyMatrix4(mesh.matrixWorld);
    // Back-face and limb occlusion: no pins shining through the globe.
    if (amount < 0.5 && g.clone().applyEuler(mesh.rotation).z < 1 / camera.position.z) return null;
    v.project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
    return [((v.x + 1) * l.map.w) / 2, ((1 - v.y) * l.map.h) / 2];
  }
  function dispose() {
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.width = 1;
    canvas.height = 1;
  }
  return { render, project, dispose };
}
