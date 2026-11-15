import { Vector3 } from 'three';

export type Mode = 'garden' | 'meteor' | 'ice' | 'dawn';
const listeners = new Set<() => void>();
let revision = 0;
export const world = {
  time: 0, spring: 0.15, springTarget: 0.15,
  ice: 0, iceTarget: 0, night: 0, nightTarget: 0,
  dial: 20, mode: 'garden' as Mode,
  meteorAt: -100, strikes: 0, blooms: 0,
  impact: new Vector3(0.52, 0.40, 0.755).normalize(),
  rotation: 0, tilt: 0, zoom: 1, dragging: false,
  paused: false, ready: false, trainAngle: -0.68,
};
function publish() { revision++; listeners.forEach(fn => fn()); }
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const snapshot = () => revision;
export const actions = {
  bloom() {
    world.springTarget = 1; world.iceTarget = 0; world.mode = 'garden';
    world.blooms++; publish();
  },
  meteor(point?: Vector3) {
    if (point) world.impact.copy(point).normalize();
    world.meteorAt = world.time; world.strikes++; world.mode = 'meteor'; publish();
  },
  ice() {
    world.iceTarget = world.iceTarget > 0.5 ? 0 : 1;
    world.mode = world.iceTarget ? 'ice' : 'garden';
    if (world.iceTarget) { world.dial = 92; world.nightTarget = 1; }
    publish();
  },
  dial(value: number) {
    world.dial = Math.max(0, Math.min(100, value));
    world.nightTarget = Math.max(0, Math.min(1, (world.dial - 27) / 65));
    world.mode = world.nightTarget < 0.5 ? 'dawn' : 'ice';
    if (world.nightTarget < 0.35) world.iceTarget = 0;
    publish();
  },
  solar() { actions.dial(world.nightTarget > 0.45 ? 18 : 92); },
  reset() {
    world.time = 0; world.spring = 0.15; world.springTarget = 0.15;
    world.ice = 0; world.iceTarget = 0; world.night = 0; world.nightTarget = 0;
    world.dial = 20; world.mode = 'garden'; world.meteorAt = -100;
    world.rotation = 0; world.tilt = 0; world.zoom = 1;
    world.strikes = 0; world.blooms = 0; world.trainAngle = -0.68;
    world.impact.set(0.52, 0.40, 0.755).normalize(); publish();
  },
};
export function advance(dt: number) {
  if (world.paused) return;
  world.time += dt;
  const ease = 1 - Math.exp(-dt * 2.2);
  world.spring += (world.springTarget - world.spring) * ease;
  world.ice += (world.iceTarget - world.ice) * ease * 0.72;
  world.night += (world.nightTarget - world.night) * ease;
  world.trainAngle += dt * (0.30 + world.spring * 0.34) * (1 - world.ice * 0.10);
}

export function land(n: Vector3): number {
  const { x, y, z } = n;
  return Math.sin(x * 3.7 + z * 2.1) * 0.23
    + Math.sin(z * 4.8 - y * 3.1) * 0.18
    + Math.sin(y * 6.7 + x * 2.8) * 0.11
    + Math.sin(x * 13.1 + y * 7.2) * Math.cos(z * 9.1) * 0.045
    + Math.cos(z * 17 + x * 11 + y * 9) * 0.022 - 0.015;
}
export const surface = (n: Vector3) => 1.61 + land(n) * 0.84;
export function seeded(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
declare global {
  interface Window {
    __planet: { world: typeof world; actions: typeof actions; metrics: () => Record<string, unknown>; renderMetrics?: () => Record<string, unknown> };
    __stepVirtualFrame?: (dt: number) => void;
    __virtualNow?: number;
  }
}
window.__planet = {
  world, actions,
  metrics: () => ({ time: world.time, mode: world.mode, blooms: world.blooms, strikes: world.strikes,
    spring: world.spring, ice: world.ice, night: world.night, zoom: world.zoom,
    rotation: world.rotation, trainAngle: world.trainAngle, ready: world.ready, ...window.__planet.renderMetrics?.() }),
};
