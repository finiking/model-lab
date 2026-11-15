import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { R_OCEAN, samplePlanetRadius } from './noise';

export interface CraterData {
  id: number;
  dir: THREE.Vector3;
  bornAt: number;
  intensity: number;
  rippleAge: number;
}

export interface MeteorData {
  id: number;
  startPos: THREE.Vector3;
  targetDir: THREE.Vector3;
  progress: number;
  speed: number;
  hit: boolean;
}

export interface PlanetSnapshot {
  solarTime: number; // 0..1 (0.34 golden day, 0.66 sunset, 0.90 bioluminescent night)
  autoSolar: boolean;
  springBloom: boolean;
  springFactor: number;
  iceAge: boolean;
  iceFactor: number;
  cratersCount: number;
  floraCount: number;
  tempC: number;
  eraLabel: string;
  lastEventText: string;
  soundEnabled: boolean;
}

class PlanetStore {
  public time = 0;
  public solarTime = 0.34;
  public autoSolar = false;
  public springBloom = false;
  public springFactor = 0.25;
  public iceAge = false;
  public iceFactor = 0.0;

  public astrolabeYaw = -0.35;
  public astrolabePitch = 0.26;
  public velYaw = 0;
  public velPitch = 0;
  public cameraZoom = 1.0;

  public trainAngle = 0.72;
  public trainSpeed = 0.26;

  public craters: CraterData[] = [];
  public meteors: MeteorData[] = [];
  public nextId = 1;

  public baseFloraCount = 240;
  public lastEventText = '星盘校准完成 · 拖拽旋转或点击行星召唤陨石';
  public soundEnabled = false;

  // Camera director overrides for showcase reel
  public cameraOrbitOffset = 0;
  public cameraPitchOffset = 0;

  private listeners = new Set<() => void>();
  private snapshot: PlanetSnapshot;
  private lastEmitTime = -1;

  constructor() {
    this.snapshot = this.computeSnapshot();
  }

  private computeSnapshot(): PlanetSnapshot {
    const tempBase = 17.5;
    const tempSolar = Math.sin(this.solarTime * Math.PI * 2 - 0.5) * 3.5;
    const tempIce = -this.iceFactor * 36.0;
    const tempCrater = Math.min(18, this.craters.length * 4.2);
    const tempC = Math.round((tempBase + tempSolar + tempIce + tempCrater) * 10) / 10;

    const floraCount = Math.round(
      this.baseFloraCount * (0.65 + this.springFactor * 0.95) * (1 - this.iceFactor * 0.52)
    );

    let eraLabel = '黄金创世纪 · 翡翠洋';
    if (this.iceFactor > 0.45) {
      eraLabel = '极地冰封纪 · 极光之冠';
    } else if (this.craters.length > 0 && this.craters[0].rippleAge < 6.0) {
      eraLabel = '天火陨击 · 熔岩海啸';
    } else if (this.solarTime > 0.72 || this.solarTime < 0.12) {
      eraLabel = '星夜微光纪 · 荧光生态';
    } else if (this.springFactor > 0.65) {
      eraLabel = '繁花春醒纪 · 万物生辉';
    }

    return {
      solarTime: this.solarTime,
      autoSolar: this.autoSolar,
      springBloom: this.springBloom,
      springFactor: this.springFactor,
      iceAge: this.iceAge,
      iceFactor: this.iceFactor,
      cratersCount: this.craters.length,
      floraCount,
      tempC,
      eraLabel,
      lastEventText: this.lastEventText,
      soundEnabled: this.soundEnabled,
    };
  }

  public emit(force = false) {
    if (!force && Math.abs(this.time - this.lastEmitTime) < 0.08) return;
    this.lastEmitTime = this.time;
    this.snapshot = this.computeSnapshot();
    for (const cb of this.listeners) cb();
  }

  public subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  public getSnapshot = (): PlanetSnapshot => this.snapshot;

  public toggleSpringBloom(forceState?: boolean) {
    this.springBloom = forceState !== undefined ? forceState : !this.springBloom;
    if (this.springBloom && this.iceAge) {
      this.iceAge = false;
    }
    this.lastEventText = this.springBloom
      ? '春意盎然：微缩森林与荧光繁花竞相绽放，环轨列车提速！'
      : '生态回归平稳巡航状态';
    this.emit(true);
  }

  public toggleIceAge(forceState?: boolean) {
    this.iceAge = forceState !== undefined ? forceState : !this.iceAge;
    if (this.iceAge && this.springBloom) {
      this.springBloom = false;
    }
    this.lastEventText = this.iceAge
      ? '极地冰期降临：海面凝结为冰晶陆架，南北极光漫天舞动！'
      : '冰川消融：碧蓝海洋重新苏醒';
    this.emit(true);
  }

  public setSolarTime(val: number) {
    this.solarTime = ((val % 1) + 1) % 1;
    this.autoSolar = false;
    this.emit(true);
  }

  public toggleAutoSolar(forceState?: boolean) {
    this.autoSolar = forceState !== undefined ? forceState : !this.autoSolar;
    this.lastEventText = this.autoSolar ? '星盘昼夜自动巡转已开启' : '星盘太阳刻度已锁定';
    this.emit(true);
  }

  public triggerMeteorStrike(targetDir?: THREE.Vector3) {
    const dir = targetDir
      ? targetDir.clone().normalize()
      : new THREE.Vector3(
          Math.cos(this.astrolabeYaw * -1 + 0.35) * 0.85,
          0.25 + Math.sin(this.nextId * 1.7) * 0.3,
          Math.sin(this.astrolabeYaw * -1 + 0.35) * 0.85
        ).normalize();

    const startPos = dir
      .clone()
      .multiplyScalar(3.4)
      .add(new THREE.Vector3(0.75, 1.35, 0.55));

    this.meteors.push({
      id: this.nextId++,
      startPos,
      targetDir: dir,
      progress: 0,
      speed: 1.55,
      hit: false,
    });
    this.lastEventText = '警告：流星火球突破晶球大气层，正在坠落！';
    this.emit(true);
  }

  public registerCrater(dir: THREE.Vector3) {
    this.craters.unshift({
      id: this.nextId++,
      dir: dir.clone().normalize(),
      bornAt: this.time,
      intensity: 1.0,
      rippleAge: 0,
    });
    if (this.craters.length > 6) {
      this.craters.length = 6;
    }
    this.lastEventText = '陨石撞击！熔岩陨石坑形成，环形海啸波正横扫大洋！';
    this.emit(true);
  }

  public clearCraters() {
    this.craters = [];
    this.meteors = [];
    this.emit(true);
  }

  public step(dt: number) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;

    if (this.autoSolar) {
      this.solarTime = (this.solarTime + clampedDt * 0.045) % 1;
    }

    const targetSpring = this.springBloom ? 1.0 : 0.18;
    this.springFactor += (targetSpring - this.springFactor) * Math.min(1, clampedDt * 2.4);

    const targetIce = this.iceAge ? 1.0 : 0.0;
    this.iceFactor += (targetIce - this.iceFactor) * Math.min(1, clampedDt * 1.9);

    // Train speed responds to Spring Bloom & Ice Age
    const targetTrainSpeed = this.iceAge ? 0.18 : this.springBloom ? 0.52 : 0.30;
    this.trainSpeed += (targetTrainSpeed - this.trainSpeed) * Math.min(1, clampedDt * 3.0);
    this.trainAngle = (this.trainAngle + clampedDt * this.trainSpeed) % (Math.PI * 2);

    // Gentle astrolabe inertia
    this.astrolabeYaw += this.velYaw * clampedDt;
    this.astrolabePitch = Math.max(-0.95, Math.min(0.95, this.astrolabePitch + this.velPitch * clampedDt));
    const damp = Math.exp(-5.5 * clampedDt);
    this.velYaw *= damp;
    this.velPitch *= damp;

    // Update falling meteors
    for (const m of this.meteors) {
      if (!m.hit) {
        m.progress += clampedDt * m.speed;
        if (m.progress >= 1.0) {
          m.progress = 1.0;
          m.hit = true;
          this.registerCrater(m.targetDir);
        }
      }
    }
    // Remove finished meteors after brief trail fade
    this.meteors = this.meteors.filter((m) => !m.hit);

    // Age craters and ocean tsunami ripples
    for (const c of this.craters) {
      c.rippleAge += clampedDt;
      c.intensity = Math.max(0.45, c.intensity - clampedDt * 0.008);
    }

    this.emit(false);
  }
}

export const planetStore = new PlanetStore();

export function usePlanetStore(): PlanetSnapshot {
  return useSyncExternalStore(planetStore.subscribe, planetStore.getSnapshot);
}

// Expose deterministic director API for showcase & debugging
declare global {
  interface Window {
    __pocketPlanet?: PlanetStore;
    __pocketDirector?: {
      setAct: (act: 'day' | 'spring' | 'meteor' | 'ice' | 'night') => void;
      strikeFront: () => void;
      strikeFrontLand: () => void;
      strikeFrontOcean: () => void;
      setView: (yaw: number, pitch: number, zoom?: number) => void;
      setSolar: (t: number) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__pocketPlanet = planetStore;
  window.__pocketDirector = {
    setAct: (act) => {
      if (act === 'day') {
        planetStore.toggleSpringBloom(false);
        planetStore.toggleIceAge(false);
        planetStore.setSolarTime(0.34);
      } else if (act === 'spring') {
        planetStore.toggleIceAge(false);
        planetStore.toggleSpringBloom(true);
        planetStore.setSolarTime(0.38);
      } else if (act === 'meteor') {
        planetStore.toggleIceAge(false);
        planetStore.setSolarTime(0.56);
      } else if (act === 'ice') {
        planetStore.toggleSpringBloom(false);
        planetStore.toggleIceAge(true);
        planetStore.setSolarTime(0.86);
      } else if (act === 'night') {
        planetStore.setSolarTime(0.90);
      }
    },
    strikeFront: () => {
      // Strike on the front-facing hemisphere facing the camera
      const yaw = -(planetStore.astrolabeYaw + planetStore.time * 0.055) + 0.14;
      const dir = new THREE.Vector3(Math.sin(yaw), 0.12, Math.cos(yaw)).normalize();
      planetStore.triggerMeteorStrike(dir);
    },
    strikeFrontLand: () => {
      const baseYaw = -(planetStore.astrolabeYaw + planetStore.time * 0.055);
      let bestDir = new THREE.Vector3(Math.sin(baseYaw - 0.3), 0.38, Math.cos(baseYaw - 0.3)).normalize();
      let bestR = 0;
      for (let a = -0.75; a <= 0.35; a += 0.07) {
        for (let y = 0.08; y <= 0.58; y += 0.07) {
          const d = new THREE.Vector3(Math.sin(baseYaw + a), y, Math.cos(baseYaw + a)).normalize();
          const r = samplePlanetRadius(d);
          if (r > bestR) {
            bestR = r;
            bestDir = d;
          }
        }
      }
      planetStore.triggerMeteorStrike(bestDir);
    },
    strikeFrontOcean: () => {
      const baseYaw = -(planetStore.astrolabeYaw + planetStore.time * 0.055);
      let bestDir = new THREE.Vector3(Math.sin(baseYaw + 0.3), -0.1, Math.cos(baseYaw + 0.3)).normalize();
      let minR = 99;
      for (let a = -0.65; a <= 0.65; a += 0.12) {
        for (let y = -0.35; y <= 0.35; y += 0.12) {
          const d = new THREE.Vector3(Math.sin(baseYaw + a), y, Math.cos(baseYaw + a)).normalize();
          const r = samplePlanetRadius(d);
          if (r < R_OCEAN - 0.015 && r < minR) {
            minR = r;
            bestDir = d;
          }
        }
      }
      planetStore.triggerMeteorStrike(bestDir);
    },
    setView: (yaw, pitch, zoom = 1.0) => {
      planetStore.astrolabeYaw = yaw;
      planetStore.astrolabePitch = pitch;
      planetStore.velYaw = 0;
      planetStore.velPitch = 0;
      planetStore.cameraZoom = zoom;
    },
    setSolar: (t) => {
      planetStore.setSolarTime(t);
    },
  };
}
