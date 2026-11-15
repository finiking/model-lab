import * as THREE from 'three';

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash3(ix: number, iy: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453123;
  return fract(n);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);

  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = lerp(n000, n100, fx);
  const nx10 = lerp(n010, n110, fx);
  const nx01 = lerp(n001, n101, fx);
  const nx11 = lerp(n011, n111, fx);

  const nxy0 = lerp(nx00, nx10, fy);
  const nxy1 = lerp(nx01, nx11, fy);

  return lerp(nxy0, nxy1, fz) * 2 - 1;
}

export function fbm3D(x: number, y: number, z: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3D(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

export function ridge3D(x: number, y: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3D(x * freq, y * freq, z * freq));
    sum += amp * (n * n);
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm;
}

export const R_OCEAN = 1.0;
export const R_RAIL = 1.062;
export const R_GLASS = 1.38;

/**
 * Deterministic terrain elevation relative to unit sphere (1.0 = sea level).
 * Returns radius in [0.905, 1.21].
 */
export function samplePlanetRadius(dir: THREE.Vector3): number {
  const x = dir.x;
  const y = dir.y;
  const z = dir.z;

  // Macro continental plates + archipelago detail
  const cont = fbm3D(x * 1.65 + 3.1, y * 1.65 - 1.7, z * 1.65 + 5.2, 5);
  const detail = fbm3D(x * 4.4 - 2.3, y * 4.4 + 4.1, z * 4.4 - 1.1, 3);
  const ridge = ridge3D(x * 3.1 + 7.4, y * 3.1 + 1.2, z * 3.1 - 3.9, 4);

  // Polar landmass caps + slightly balanced continents near mid-latitudes
  const absLat = Math.abs(y);
  const polarCap = Math.max(0, (absLat - 0.78) * 0.42);

  let h = cont * 0.165 + detail * 0.036 + polarCap - 0.008;

  // Keep a scenic equatorial corridor so the railway traverses both bridges & emerald passes
  const eqBand = Math.exp(-Math.pow(y / 0.11, 2));
  if (h > 0.035) {
    h = lerp(h, Math.min(h, 0.056), eqBand * 0.65);
  }

  // Stylized low-poly terrace steps on land + dramatic alpine peaks
  if (h > 0) {
    const stepped = Math.floor(h * 26) / 26;
    h = lerp(h, stepped, 0.35);
    const mountainMask = Math.max(0, (h - 0.032) * 4.2);
    h += ridge * 0.078 * Math.min(1, mountainMask);
  }

  return Math.max(0.905, Math.min(1.21, R_OCEAN + h));
}

export function sampleMoisture(dir: THREE.Vector3): number {
  return 0.5 + 0.5 * fbm3D(dir.x * 2.8 - 4.2, dir.y * 2.8 + 2.9, dir.z * 2.8 + 6.1, 3);
}
