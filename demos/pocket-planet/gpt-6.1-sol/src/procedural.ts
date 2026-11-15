import * as THREE from 'three';
import { land, seeded, surface } from './world';

export function makeTerrain() {
  const g = new THREE.IcosahedronGeometry(1, 17);
  const p = g.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const n = new THREE.Vector3(); const center = new THREE.Vector3();
  const c = new THREE.Color(); const rng = seeded(520);
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    p.setXYZ(i, n.x * surface(n), n.y * surface(n), n.z * surface(n));
  }
  for (let i = 0; i < p.count; i += 3) {
    center.set(0, 0, 0);
    for (let j = 0; j < 3; j++) center.add(n.fromBufferAttribute(p, i + j).normalize());
    center.normalize(); const h = land(center);
    if (h > .43 || (center.y > .92 && h > .03)) c.set('#e0e5d9');
    else if (h > .36) c.set('#8b9b88');
    else if (h > .25) c.set('#46835b');
    else if (h > .055) c.set('#257348');
    else if (h > .016) c.set('#a6bb72');
    else c.set('#c7c598');
    c.multiplyScalar(.84 + rng() * .24);
    for (let j = 0; j < 3; j++) c.toArray(colors, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals(); return g;
}
export function sampleLand(count: number, seed: number, min = .055, max = .26) {
  const rng = seeded(seed); const out: { n: THREE.Vector3; r: number; size: number; phase: number }[] = [];
  for (let i = 0; i < 18000 && out.length < count; i++) {
    const n = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    const h = land(n);
    if (h < min || h > max || Math.abs(n.y) > .91) continue;
    out.push({ n, r: surface(n) + .012, size: .65 + rng() * .65, phase: rng() });
  }
  return out;
}
export function labelTexture(text: string, color = '#302416', fontSize = 70) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = color; ctx.font = `${fontSize}pt Georgia,serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
export function brushedTexture() {
  const rng = seeded(42); const data = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) {
    const stripe = rng() * 45;
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4; const v = 185 + stripe + rng() * 25;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, 128, 128);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.needsUpdate = true; return t;
}
export function annulus(radius: number, width: number, depth: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, radius + width / 2, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, radius - width / 2, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: .009, bevelThickness: .009, curveSegments: 160 });
  g.translate(0, 0, -depth / 2); return g;
}
export function curveGeometry(points: THREE.Vector3[], radius = .012) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, radius, 6, false);
}
