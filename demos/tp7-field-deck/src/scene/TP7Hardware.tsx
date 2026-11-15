import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  createChassisMetalMaps,
  createOledBundle,
  createReelPlatterMaps,
  createFaceplateMaps,
  drawOledDisplay,
} from './proceduralTextures';
import { BASE_REEL_OMEGA, notifyTP7, stepTP7Physics, tp7State, type RockerState } from '../state/tp7Store';
import { tp7Audio } from '../audio/tp7AudioEngine';

const BODY_W = 6.8;
const BODY_H = 9.6;
const CORNER_R = 0.42;
const REEL_CX = 0.0;
const REEL_CY = 0.18;
const REEL_R = 2.26;
const TILT_RAD = 0.14; // ~8 deg ergonomic tabletop tilt
// Exact world Y lift so front-bottom bumper rests flush on desk mat y=0
const BODY_WORLD_Y = BODY_H * 0.5 * Math.sin(TILT_RAD) + 0.86 * Math.cos(TILT_RAD);

function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function makeRoundedRectHole(cx: number, cy: number, w: number, h: number, r: number): THREE.Path {
  const p = new THREE.Path();
  const hw = w / 2;
  const hh = h / 2;
  // Clockwise path for Three.js hole cutout
  p.moveTo(cx - hw + r, cy - hh);
  p.quadraticCurveTo(cx - hw, cy - hh, cx - hw, cy - hh + r);
  p.lineTo(cx - hw, cy + hh - r);
  p.quadraticCurveTo(cx - hw, cy + hh, cx - hw + r, cy + hh);
  p.lineTo(cx + hw - r, cy + hh);
  p.quadraticCurveTo(cx + hw, cy + hh, cx + hw, cy + hh - r);
  p.lineTo(cx + hw, cy - hh + r);
  p.quadraticCurveTo(cx + hw, cy - hh, cx + hw - r, cy - hh);
  p.lineTo(cx - hw + r, cy - hh);
  return p;
}

function normalizeBodyUVs(geom: THREE.BufferGeometry, w: number, h: number): void {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  if (!pos || !uv) return;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x + w * 0.5) / w, (y + h * 0.5) / h);
  }
  uv.needsUpdate = true;
}

function createKeySymbolTexture(kind: 'rec' | 'play' | 'stop'): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ff4f00';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#fff8f2';
  ctx.strokeStyle = '#fff8f2';
  const cx = size / 2;
  const cy = size / 2;

  if (kind === 'rec') {
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'play') {
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 34);
    ctx.lineTo(cx + 36, cy);
    ctx.lineTo(cx - 24, cy + 34);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(cx - 28, cy - 28, 56, 56);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const TP7Hardware: React.FC<{
  onSetOrbitEnabled: (enabled: boolean) => void;
}> = ({ onSetOrbitEnabled }) => {
  const { camera, gl } = useThree();

  const deckRootRef = useRef<THREE.Group>(null);
  const reelSpinRef = useRef<THREE.Group>(null);
  const reelDepressRef = useRef<THREE.Group>(null);
  const rockerRef = useRef<THREE.Group>(null);
  const keyRecRef = useRef<THREE.Group>(null);
  const keyPlayRef = useRef<THREE.Group>(null);
  const keyStopRef = useRef<THREE.Group>(null);
  const keyMemoRef = useRef<THREE.Group>(null);
  const recLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const micMeshRef = useRef<THREE.InstancedMesh>(null);
  const encoderMeshRef = useRef<THREE.InstancedMesh>(null);
  const vuLeftRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const vuRightRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  // Scratch pointer tracking
  const scratchInfo = useRef<{
    active: boolean;
    pointerId: number;
    lastAngle: number;
    lastTimeMs: number;
    plane: THREE.Plane;
    worldNormal: THREE.Vector3;
    worldCenter: THREE.Vector3;
  }>({
    active: false,
    pointerId: -1,
    lastAngle: 0,
    lastTimeMs: 0,
    plane: new THREE.Plane(),
    worldNormal: new THREE.Vector3(0, 1, 0),
    worldCenter: new THREE.Vector3(),
  });

  const rockerDragInfo = useRef<{
    active: boolean;
    pointerId: number;
    startClientY: number;
  }>({
    active: false,
    pointerId: -1,
    startClientY: 0,
  });

  const faceMaps = useMemo(() => createFaceplateMaps(BODY_W, BODY_H), []);
  const chassisMaps = useMemo(() => createChassisMetalMaps(), []);
  const reelMaps = useMemo(() => createReelPlatterMaps(), []);
  const oledBundle = useMemo(() => createOledBundle(), []);

  const recTex = useMemo(() => createKeySymbolTexture('rec'), []);
  const playTex = useMemo(() => createKeySymbolTexture('play'), []);
  const stopTex = useMemo(() => createKeySymbolTexture('stop'), []);

  // Procedural CNC Geometries
  const geometries = useMemo(() => {
    // 1. Lower CNC aluminum shell
    const lowerShape = makeRoundedRectShape(BODY_W, BODY_H, CORNER_R);
    const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, {
      depth: 1.04,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.055,
      bevelSegments: 5,
      curveSegments: 24,
    });
    lowerGeo.translate(0, 0, -0.74);

    // 2. Dark anodized precision mid-seam gasket
    const seamShape = makeRoundedRectShape(BODY_W - 0.08, BODY_H - 0.08, CORNER_R - 0.03);
    const seamGeo = new THREE.ExtrudeGeometry(seamShape, {
      depth: 0.12,
      bevelEnabled: false,
      curveSegments: 20,
    });
    seamGeo.translate(0, 0, 0.34);

    // 3. Upper brushed aluminum faceplate WITH true milled pockets (holes)
    const upperShape = makeRoundedRectShape(BODY_W, BODY_H, CORNER_R);

    // Center platter circular hole (non-overlapping: top +2.56, bottom -2.20)
    const reelHole = new THREE.Path();
    reelHole.absarc(REEL_CX, REEL_CY, 2.38, 0, Math.PI * 2, true);
    upperShape.holes.push(reelHole);

    // Upper-right OLED + VU display cutout (bottom +2.92 -> 0.36cm clean bridge)
    upperShape.holes.push(makeRoundedRectHole(1.24, 3.58, 3.28, 1.32, 0.18));

    // Lower keybed cutout (top -2.74 -> 0.54cm clean bridge)
    upperShape.holes.push(makeRoundedRectHole(0.0, -3.48, 5.44, 1.48, 0.24));

    const upperGeo = new THREE.ExtrudeGeometry(upperShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.048,
      bevelSegments: 4,
      curveSegments: 36,
    });
    upperGeo.translate(0, 0, 0.44);
    normalizeBodyUVs(upperGeo, BODY_W, BODY_H);

    // 4. Lathe-turned aluminum platter body (R = 2.26cm inside 2.38cm cavity)
    const lathePts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(2.21, 0.0),
      new THREE.Vector2(2.26, 0.04),
      new THREE.Vector2(2.26, 0.21),
      new THREE.Vector2(2.21, 0.25),
      new THREE.Vector2(1.05, 0.232),
      new THREE.Vector2(0.56, 0.232),
      new THREE.Vector2(0.51, 0.275),
      new THREE.Vector2(0.16, 0.275),
      new THREE.Vector2(0.14, 0.31),
      new THREE.Vector2(0.0, 0.31),
    ];
    const platterLatheGeo = new THREE.LatheGeometry(lathePts, 72);
    platterLatheGeo.rotateX(Math.PI / 2);

    // 5. Keycap sculpted geometry
    const keyShape = makeRoundedRectShape(1.42, 1.12, 0.16);
    const keyGeo = new THREE.ExtrudeGeometry(keyShape, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.065,
      bevelSize: 0.065,
      bevelSegments: 4,
      curveSegments: 16,
    });
    normalizeBodyUVs(keyGeo, 1.55, 1.25);

    // 6. Left side ergonomic rocker paddle
    const rockerShape = makeRoundedRectShape(0.46, 2.36, 0.14);
    const rockerGeo = new THREE.ExtrudeGeometry(rockerShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 12,
    });
    rockerGeo.translate(-0.23, 0, -0.21);

    // 7. Rear ergonomic desk wedge feet (exact grounded in TP7 local coords so bottom meets world y=0)
    const footHeightAtRear = (BODY_WORLD_Y + 3.95 * Math.sin(TILT_RAD)) / Math.cos(TILT_RAD) - 0.72;
    const footShape = new THREE.Shape();
    footShape.moveTo(-0.45, 0);
    footShape.lineTo(0.45, 0);
    footShape.lineTo(0.36, -footHeightAtRear);
    footShape.lineTo(-0.36, -footHeightAtRear);
    footShape.closePath();
    const footGeo = new THREE.ExtrudeGeometry(footShape, {
      depth: 0.62,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    footGeo.rotateY(Math.PI / 2);
    footGeo.rotateX(Math.PI / 2);
    footGeo.translate(-0.31, 0, -0.72);

    // 8. Coiled orange TRS cable leaving top Jack 1 (x = -2.05, y = +5.52, z = +0.12)
    // Compute exact local Z that corresponds to resting cleanly on desk mat (worldY = 0.09)
    const deskLocalZ = (localY: number, lift = 0.09) =>
      (lift - BODY_WORLD_Y - localY * Math.sin(TILT_RAD)) / Math.cos(TILT_RAD);

    const cablePts: THREE.Vector3[] = [];
    cablePts.push(new THREE.Vector3(-2.05, 5.52, 0.12));
    cablePts.push(new THREE.Vector3(-2.12, 6.22, -0.15));
    cablePts.push(new THREE.Vector3(-2.75, 6.65, deskLocalZ(6.65, 0.28)));
    // Smooth helical studio coil resting tangentially on desk mat behind/beside deck
    const coilTurns = 6.0;
    const coilSteps = 108;
    const coilRadius = 0.24;
    for (let i = 0; i <= coilSteps; i++) {
      const t = i / coilSteps;
      const angle = t * Math.PI * 2 * coilTurns;
      const cx = -3.45 - t * 2.85 + Math.sin(angle) * 0.14;
      const cy = 6.45 - t * 3.85 + Math.cos(angle) * 0.16;
      const baseDeskZ = deskLocalZ(cy, 0.095 + coilRadius);
      const cz = baseDeskZ + Math.sin(angle) * coilRadius;
      cablePts.push(new THREE.Vector3(cx, cy, Math.max(deskLocalZ(cy, 0.095), cz)));
    }
    cablePts.push(new THREE.Vector3(-6.95, 1.95, deskLocalZ(1.95, 0.095)));
    cablePts.push(new THREE.Vector3(-8.4, 1.05, deskLocalZ(1.05, 0.095)));

    const cableCurve = new THREE.CatmullRomCurve3(cablePts);
    const cableGeo = new THREE.TubeGeometry(cableCurve, 220, 0.088, 12, false);

    return {
      lowerGeo,
      seamGeo,
      upperGeo,
      platterLatheGeo,
      keyGeo,
      rockerGeo,
      footGeo,
      cableGeo,
    };
  }, []);

  // Populate instanced micro acoustic grille & optical encoder ring teeth
  useEffect(() => {
    const mic = micMeshRef.current;
    if (mic) {
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          const x = -2.84 + col * 0.22 + (row % 2 === 1 ? 0.08 : 0);
          const y = 3.12 + row * 0.22;
          dummy.position.set(x, y, 0.835);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          mic.setMatrixAt(idx++, dummy.matrix);
        }
      }
      mic.instanceMatrix.needsUpdate = true;
    }

    const enc = encoderMeshRef.current;
    if (enc) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        dummy.position.set(Math.cos(a) * 2.31, Math.sin(a) * 2.31, 0.45);
        dummy.rotation.set(0, 0, a);
        dummy.updateMatrix();
        enc.setMatrixAt(i, dummy.matrix);
      }
      enc.instanceMatrix.needsUpdate = true;
    }
  }, []);

  // Global window pointer move/up listeners so dragging reel or rocker smoothly tracks outside mesh bounds
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitWorld = new THREE.Vector3();

    const getReelPointerAngle = (clientX: number, clientY: number): number | null => {
      const reelGroup = reelSpinRef.current;
      if (!reelGroup) return null;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(scratchInfo.current.plane, hitWorld);
      if (!hit) return null;
      const local = reelGroup.parent!.worldToLocal(hit.clone());
      return Math.atan2(local.y, local.x);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (scratchInfo.current.active && e.pointerId === scratchInfo.current.pointerId) {
        const angle = getReelPointerAngle(e.clientX, e.clientY);
        if (angle === null) return;

        let dAngle = angle - scratchInfo.current.lastAngle;
        while (dAngle > Math.PI) dAngle -= Math.PI * 2;
        while (dAngle < -Math.PI) dAngle += Math.PI * 2;

        const now = performance.now();
        const dt = Math.max(0.004, (now - scratchInfo.current.lastTimeMs) / 1000);
        scratchInfo.current.lastAngle = angle;
        scratchInfo.current.lastTimeMs = now;

        tp7State.reelAngle += dAngle;
        // Forward motion decreases reelAngle (clockwise from above) -> omega = -dAngle / dt
        const omega = THREE.MathUtils.clamp(-dAngle / dt, -BASE_REEL_OMEGA * 3.4, BASE_REEL_OMEGA * 3.4);
        tp7State.scratchOmega = omega;
        tp7State.angularVelocity = omega;
      }

      if (rockerDragInfo.current.active && e.pointerId === rockerDragInfo.current.pointerId) {
        const dy = rockerDragInfo.current.startClientY - e.clientY;
        const next: RockerState = dy > 14 ? 'up' : dy < -14 ? 'down' : 'neutral';
        if (next !== tp7State.rockerState) {
          tp7State.rockerState = next;
          tp7Audio.playRockerSnap();
          notifyTP7();
        }
      }
    };

    const endInteractions = (e: PointerEvent) => {
      if (scratchInfo.current.active && e.pointerId === scratchInfo.current.pointerId) {
        scratchInfo.current.active = false;
        tp7State.isScratching = false;
        onSetOrbitEnabled(true);
        notifyTP7();
      }
      if (rockerDragInfo.current.active && e.pointerId === rockerDragInfo.current.pointerId) {
        rockerDragInfo.current.active = false;
        if (tp7State.rockerState !== 'neutral') {
          tp7State.rockerState = 'neutral';
          tp7Audio.playRockerSnap();
        }
        onSetOrbitEnabled(true);
        notifyTP7();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endInteractions);
    window.addEventListener('pointercancel', endInteractions);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endInteractions);
      window.removeEventListener('pointercancel', endInteractions);
    };
  }, [camera, gl, onSetOrbitEnabled]);

  // Keyboard shortcuts for tactile feel (Space = Play/Stop, R = Rec, W/S = Rocker)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      tp7Audio.unlock();
      if (e.code === 'Space') {
        e.preventDefault();
        tp7State.isPlaying = !tp7State.isPlaying;
        if (tp7State.isPlaying) {
          tp7State.keyTarget.play = 1;
          setTimeout(() => {
            tp7State.keyTarget.play = 0;
          }, 120);
        } else {
          tp7State.keyTarget.stop = 1;
          setTimeout(() => {
            tp7State.keyTarget.stop = 0;
          }, 120);
        }
        tp7Audio.playKeyClick(true);
        notifyTP7();
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        if (tp7State.rockerState !== 'up') {
          tp7State.rockerState = 'up';
          tp7Audio.playRockerSnap();
          notifyTP7();
        }
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        if (tp7State.rockerState !== 'down') {
          tp7State.rockerState = 'down';
          tp7Audio.playRockerSnap();
          notifyTP7();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        tp7State.isRecArmed = !tp7State.isRecArmed;
        tp7State.keyTarget.rec = 1;
        tp7Audio.playKeyClick(true);
        setTimeout(() => {
          tp7State.keyTarget.rec = 0;
        }, 120);
        notifyTP7();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp' || e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        if (tp7State.rockerState !== 'neutral') {
          tp7State.rockerState = 'neutral';
          tp7Audio.playRockerSnap();
          notifyTP7();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Main per-frame simulation & 3D hardware animation
  useFrame((_, delta) => {
    stepTP7Physics(delta);

    // Apply physical reel rotation & finger depression
    if (reelSpinRef.current) {
      reelSpinRef.current.rotation.z = tp7State.reelAngle;
    }
    if (reelDepressRef.current) {
      reelDepressRef.current.position.z = 0.54 - tp7State.reelDepress * 0.052;
    }

    // Side mechanical rocker tilt
    if (rockerRef.current) {
      rockerRef.current.rotation.z = -tp7State.rockerTilt * 0.25;
    }

    // Physical key travel along -Z
    if (keyRecRef.current) keyRecRef.current.position.z = 0.56 - tp7State.keyTravel.rec * 0.15;
    if (keyPlayRef.current) keyPlayRef.current.position.z = 0.56 - tp7State.keyTravel.play * 0.15;
    if (keyStopRef.current) keyStopRef.current.position.z = 0.56 - tp7State.keyTravel.stop * 0.15;
    if (keyMemoRef.current) keyMemoRef.current.position.x = 3.43 - tp7State.keyTravel.memo * 0.09;

    // Glowing REC LED ring intensity
    if (recLedMatRef.current) {
      const targetGlow = tp7State.isRecArmed ? 3.2 + Math.sin(tp7State.displayTimeSec * 5.0) * 0.6 : 0.18;
      recLedMatRef.current.emissiveIntensity = targetGlow;
    }

    // Update live OLED CanvasTexture
    drawOledDisplay(oledBundle, {
      displayTimeSec: tp7State.displayTimeSec,
      tapeVelocity: tp7State.tapeVelocity,
      isPlaying: tp7State.isPlaying,
      isScratching: tp7State.isScratching,
      isRecArmed: tp7State.isRecArmed,
      tapeDirtMode: tp7State.tapeDirtMode,
      vuL: tp7State.vuLeft,
      vuR: tp7State.vuRight,
      oledPage: tp7State.oledPage,
    });

    // Update 2x10 physical glowing LED VU segments
    const activeL = tp7State.vuLeft * 10.2;
    const activeR = tp7State.vuRight * 10.2;
    const peakIdxL = Math.min(9, Math.floor(tp7State.vuPeakL * 9.8));
    const peakIdxR = Math.min(9, Math.floor(tp7State.vuPeakR * 9.8));

    for (let i = 0; i < 10; i++) {
      const mL = vuLeftRefs.current[i];
      if (mL) {
        const lit = i < activeL;
        const isPeak = i === peakIdxL && tp7State.vuPeakL > 0.08;
        mL.emissiveIntensity = lit ? (i >= 8 ? 3.1 : 2.1) : isPeak ? 1.85 : 0.06;
      }
      const mR = vuRightRefs.current[i];
      if (mR) {
        const lit = i < activeR;
        const isPeak = i === peakIdxR && tp7State.vuPeakR > 0.08;
        mR.emissiveIntensity = lit ? (i >= 8 ? 3.1 : 2.1) : isPeak ? 1.85 : 0.06;
      }
    }
  });

  // Pointer handlers for Metal Reel
  const handleReelPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    tp7Audio.unlock();
    onSetOrbitEnabled(false);

    const reelParent = reelSpinRef.current?.parent;
    if (!reelParent) return;

    const worldNormal = new THREE.Vector3(0, 0, 1).transformDirection(reelParent.matrixWorld);
    const worldCenter = new THREE.Vector3().setFromMatrixPosition(reelParent.matrixWorld);
    scratchInfo.current.worldNormal.copy(worldNormal);
    scratchInfo.current.worldCenter.copy(worldCenter);
    scratchInfo.current.plane.setFromNormalAndCoplanarPoint(worldNormal, worldCenter);

    const localHit = reelParent.worldToLocal(e.point.clone());
    scratchInfo.current.lastAngle = Math.atan2(localHit.y, localHit.x);
    scratchInfo.current.lastTimeMs = performance.now();
    scratchInfo.current.pointerId = e.pointerId;
    scratchInfo.current.active = true;

    tp7State.isScratching = true;
    tp7State.scratchOmega = 0;
    tp7Audio.playKeyClick(false); // faint stylus touch thump
    notifyTP7();
  };

  // Pointer handlers for Orange Mechanical Keys
  const pressKey = (kind: 'rec' | 'play' | 'stop') => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    tp7Audio.unlock();
    tp7State.keyTarget[kind] = 1;
    tp7Audio.playKeyClick(true);

    if (kind === 'rec') {
      tp7State.isRecArmed = !tp7State.isRecArmed;
      if (!tp7State.isPlaying) tp7State.isPlaying = true;
    } else if (kind === 'play') {
      tp7State.isPlaying = true;
      tp7State.rockerState = 'neutral';
    } else if (kind === 'stop') {
      tp7State.isPlaying = false;
      tp7State.rockerState = 'neutral';
    }
    notifyTP7();
  };

  const releaseKey = (kind: 'rec' | 'play' | 'stop') => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (tp7State.keyTarget[kind] > 0) {
      tp7State.keyTarget[kind] = 0;
      tp7Audio.playKeyClick(false);
    }
  };

  // Side Rocker pointer down (either click top/bottom or drag up/down)
  const handleRockerPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    tp7Audio.unlock();
    onSetOrbitEnabled(false);

    const localHit = rockerRef.current?.worldToLocal(e.point.clone());
    const initDir: RockerState = localHit && localHit.y > 0.12 ? 'up' : localHit && localHit.y < -0.12 ? 'down' : 'neutral';
    if (initDir !== 'neutral') {
      tp7State.rockerState = initDir;
      tp7Audio.playRockerSnap();
      notifyTP7();
    }
    rockerDragInfo.current.active = true;
    rockerDragInfo.current.pointerId = e.pointerId;
    rockerDragInfo.current.startClientY = e.clientY;
  };

  // Right-side MEMO / Tape Mode button
  const handleMemoDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    tp7Audio.unlock();
    tp7State.keyTarget.memo = 1;
    tp7State.tapeDirtMode = !tp7State.tapeDirtMode;
    tp7State.oledPage = ((tp7State.oledPage + 1) % 3) as 0 | 1 | 2;
    tp7Audio.playKeyClick(true);
    notifyTP7();
  };
  const handleMemoUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (tp7State.keyTarget.memo > 0) {
      tp7State.keyTarget.memo = 0;
      tp7Audio.playKeyClick(false);
    }
  };

  const setCursor = (part: string | null) => {
    tp7State.hoveredPart = part;
    if (part === 'reel') document.body.style.cursor = tp7State.isScratching ? 'grabbing' : 'grab';
    else if (part) document.body.style.cursor = 'pointer';
    else document.body.style.cursor = 'auto';
  };

  return (
    <group
      ref={deckRootRef}
      position={[0, BODY_WORLD_Y, 0]}
      rotation={[-Math.PI / 2 + TILT_RAD, 0, 0]}
    >
      {/* 1. Lower CNC Brushed Aluminum Chassis */}
      <mesh geometry={geometries.lowerGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#d8dde4"
          map={chassisMaps.map}
          roughnessMap={chassisMaps.roughnessMap}
          bumpMap={chassisMaps.bumpMap}
          bumpScale={0.006}
          metalness={0.78}
          roughness={0.34}
        />
      </mesh>

      {/* 2. Dark Anodized Precision Mid-Seam Band */}
      <mesh geometry={geometries.seamGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#23272e" metalness={0.55} roughness={0.52} />
      </mesh>

      {/* 3. Upper CNC Brushed Aluminum Faceplate with Real Milled Holes */}
      <mesh geometry={geometries.upperGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#e8ecf2"
          map={faceMaps.map}
          roughnessMap={faceMaps.roughnessMap}
          bumpMap={faceMaps.bumpMap}
          bumpScale={0.008}
          metalness={0.78}
          roughness={0.34}
        />
      </mesh>

      {/* 4. Rear Ergonomic Anodized Desk Feet & Front Silicone Pads (flush onto mat at y=0) */}
      <mesh geometry={geometries.footGeo} position={[-2.25, 3.95, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#22252b" metalness={0.4} roughness={0.62} />
      </mesh>
      <mesh geometry={geometries.footGeo} position={[2.25, 3.95, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#22252b" metalness={0.4} roughness={0.62} />
      </mesh>
      <mesh position={[-2.25, -4.15, -0.83]} castShadow>
        <boxGeometry args={[0.72, 0.42, 0.1]} />
        <meshStandardMaterial color="#181a1f" roughness={0.85} />
      </mesh>
      <mesh position={[2.25, -4.15, -0.83]} castShadow>
        <boxGeometry args={[0.72, 0.42, 0.1]} />
        <meshStandardMaterial color="#181a1f" roughness={0.85} />
      </mesh>

      {/* 5. Center Reel Well Floor & Optical Encoder Ring */}
      <group position={[REEL_CX, REEL_CY, 0]}>
        <mesh position={[0, 0, 0.41]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <cylinderGeometry args={[2.39, 2.39, 0.08, 64]} />
          <meshStandardMaterial color="#181b20" metalness={0.6} roughness={0.45} />
        </mesh>
        <instancedMesh ref={encoderMeshRef} args={[undefined, undefined, 36]}>
          <boxGeometry args={[0.07, 0.035, 0.04]} />
          <meshStandardMaterial color="#a4aebc" metalness={0.85} roughness={0.25} />
        </instancedMesh>
      </group>

      {/* 6. Motorized Center Tape Reel (Scratch & Physical Brake) */}
      <group position={[REEL_CX, REEL_CY, 0]}>
        <group ref={reelDepressRef} position={[0, 0, 0.54]}>
          <group
            ref={reelSpinRef}
            onPointerDown={handleReelPointerDown}
            onPointerOver={(e) => {
              e.stopPropagation();
              setCursor('reel');
            }}
            onPointerOut={() => setCursor(null)}
          >
            {/* Lathe-Turned Platter */}
            <mesh geometry={geometries.platterLatheGeo} castShadow receiveShadow>
              <meshStandardMaterial
                color="#e2e7ee"
                map={chassisMaps.map}
                roughnessMap={chassisMaps.roughnessMap}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>

            {/* Top Concentric Brushed Strobe & Index Face */}
            <mesh position={[0, 0, 0.254]} receiveShadow>
              <circleGeometry args={[2.2, 72]} />
              <meshStandardMaterial
                color="#eaeef4"
                map={reelMaps.map}
                roughnessMap={reelMaps.roughnessMap}
                bumpMap={reelMaps.bumpMap}
                bumpScale={0.01}
                metalness={0.72}
                roughness={0.36}
              />
            </mesh>

            {/* Eccentric Machined Finger Control Dimple (flat concentric ring) */}
            <group position={[1.32, 0, 0.252]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.35, 0.24, 0.035, 32]} />
                <meshStandardMaterial color="#a5acb8" metalness={0.86} roughness={0.26} />
              </mesh>
              <mesh position={[0, 0, 0.015]}>
                <torusGeometry args={[0.35, 0.02, 12, 32]} />
                <meshStandardMaterial color="#2f343d" metalness={0.7} roughness={0.35} />
              </mesh>
            </group>

            {/* Central Magnetic Cap & Stainless Spindle */}
            <mesh position={[0, 0, 0.27]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.48, 0.52, 0.08, 40]} />
              <meshStandardMaterial color="#272b33" metalness={0.78} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.15, 0.06, 24]} />
              <meshStandardMaterial color="#eef2f8" metalness={0.94} roughness={0.16} />
            </mesh>
          </group>
        </group>
      </group>

      {/* 7. Recessed Keybed Pocket & 3 Signal Orange Mechanical Keys */}
      <mesh position={[0, -3.48, 0.43]} receiveShadow>
        <boxGeometry args={[5.5, 1.52, 0.08]} />
        <meshStandardMaterial color="#1d2026" metalness={0.55} roughness={0.55} />
      </mesh>

      {/* Key stems inside pocket */}
      {[-1.78, 0, 1.78].map((kx) => (
        <mesh key={kx} position={[kx, -3.48, 0.5]} receiveShadow>
          <boxGeometry args={[0.54, 0.54, 0.2]} />
          <meshStandardMaterial color="#3b4049" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* REC Orange Key (white base multiplier so #ff4f00 & white icons stay razor crisp) */}
      <group
        ref={keyRecRef}
        position={[-1.78, -3.48, 0.56]}
        onPointerDown={pressKey('rec')}
        onPointerUp={releaseKey('rec')}
        onPointerLeave={releaseKey('rec')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setCursor('rec');
        }}
        onPointerOut={() => setCursor(null)}
      >
        <mesh geometry={geometries.keyGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" map={recTex} roughness={0.36} metalness={0.05} />
        </mesh>
        {/* Glowing REC Armed Indicator LED */}
        <mesh position={[0.48, 0.38, 0.315]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial
            ref={recLedMatRef}
            color="#ff3300"
            emissive="#ff2a00"
            emissiveIntensity={0.2}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* PLAY Orange Key */}
      <group
        ref={keyPlayRef}
        position={[0.0, -3.48, 0.56]}
        onPointerDown={pressKey('play')}
        onPointerUp={releaseKey('play')}
        onPointerLeave={releaseKey('play')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setCursor('play');
        }}
        onPointerOut={() => setCursor(null)}
      >
        <mesh geometry={geometries.keyGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" map={playTex} roughness={0.36} metalness={0.05} />
        </mesh>
      </group>

      {/* STOP Orange Key */}
      <group
        ref={keyStopRef}
        position={[1.78, -3.48, 0.56]}
        onPointerDown={pressKey('stop')}
        onPointerUp={releaseKey('stop')}
        onPointerLeave={releaseKey('stop')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setCursor('stop');
        }}
        onPointerOut={() => setCursor(null)}
      >
        <mesh geometry={geometries.keyGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" map={stopTex} roughness={0.36} metalness={0.05} />
        </mesh>
      </group>

      {/* 8. Left Side Mechanical Rocker Lever (Cue / Rew Shuttle) */}
      <group position={[-3.38, REEL_CY, 0.14]}>
        {/* Milled dark slot & stainless pivot shaft */}
        <mesh position={[0.04, 0, 0]} receiveShadow>
          <boxGeometry args={[0.24, 2.75, 0.54]} />
          <meshStandardMaterial color="#191c22" metalness={0.65} roughness={0.48} />
        </mesh>
        <mesh position={[-0.08, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.52, 20]} />
          <meshStandardMaterial color="#e2e6ed" metalness={0.95} roughness={0.18} />
        </mesh>

        {/* Interactive CNC Rocker Paddle */}
        <group
          ref={rockerRef}
          position={[-0.14, 0, 0]}
          onPointerDown={handleRockerPointerDown}
          onPointerOver={(e) => {
            e.stopPropagation();
            setCursor('rocker');
          }}
          onPointerOut={() => setCursor(null)}
        >
          <mesh geometry={geometries.rockerGeo} castShadow receiveShadow>
            <meshStandardMaterial color="#7b8290" metalness={0.82} roughness={0.3} />
          </mesh>
          {/* Knurled tactile grip ribs on outer face (outer paddle wall is at x=-0.50) */}
          {[-0.85, -0.58, -0.31, 0.31, 0.58, 0.85].map((ry) => (
            <mesh key={ry} position={[-0.495, ry, 0]} castShadow>
              <boxGeometry args={[0.045, 0.08, 0.36]} />
              <meshStandardMaterial color="#262a32" metalness={0.65} roughness={0.4} />
            </mesh>
          ))}
          {/* Center orange tactile index line on rocker */}
          <mesh position={[-0.5, 0, 0]}>
            <boxGeometry args={[0.05, 0.13, 0.38]} />
            <meshStandardMaterial color="#ff4f00" roughness={0.32} />
          </mesh>
        </group>
      </group>

      {/* 9. Right Side Controls: MEMO / Tape Mode Switch + Power Slide + USB-C */}
      <group
        ref={keyMemoRef}
        position={[3.43, 2.42, 0.16]}
        onPointerDown={handleMemoDown}
        onPointerUp={handleMemoUp}
        onPointerLeave={handleMemoUp}
        onPointerOver={(e) => {
          e.stopPropagation();
          setCursor('memo');
        }}
        onPointerOut={() => setCursor(null)}
      >
        <mesh castShadow>
          <boxGeometry args={[0.18, 0.72, 0.34]} />
          <meshStandardMaterial color="#2c313a" metalness={0.72} roughness={0.35} />
        </mesh>
        <mesh position={[0.095, 0, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#ff4f00" emissive="#ff4f00" emissiveIntensity={0.9} />
        </mesh>
      </group>

      {/* Power toggle & USB-C port on right flank */}
      <mesh position={[3.41, 0.52, 0.12]}>
        <boxGeometry args={[0.12, 0.58, 0.24]} />
        <meshStandardMaterial color="#1f2329" metalness={0.65} roughness={0.45} />
      </mesh>
      <mesh position={[3.41, -2.1, 0.06]}>
        <boxGeometry args={[0.08, 0.85, 0.28]} />
        <meshStandardMaterial color="#15171c" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* 10. Upper-Left Acoustic Mic/Speaker Micro-Perforations */}
      <instancedMesh ref={micMeshRef} args={[undefined, undefined, 32]}>
        <cylinderGeometry args={[0.046, 0.046, 0.03, 12]} />
        <meshStandardMaterial color="#15181e" metalness={0.4} roughness={0.75} />
      </instancedMesh>

      {/* 11. Upper-Right Smoked Display Pocket: OLED + Dual 10-Segment LED VU Meter */}
      <group position={[1.24, 3.58, 0]}>
        {/* Dark display recessed well */}
        <mesh position={[0, 0, 0.44]} receiveShadow>
          <boxGeometry args={[3.34, 1.38, 0.1]} />
          <meshStandardMaterial color="#090b0f" metalness={0.4} roughness={0.6} />
        </mesh>

        {/* Live OLED Canvas Screen */}
        <mesh position={[-0.52, 0, 0.52]}>
          <planeGeometry args={[2.06, 1.04]} />
          <meshBasicMaterial map={oledBundle.texture} toneMapped={false} />
        </mesh>

        {/* Stereo 2x10 Segment 3D LED VU Level Meter */}
        <group position={[1.04, 0, 0.52]}>
          {/* Meter bezel backing */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[0.92, 1.08]} />
            <meshStandardMaterial color="#0b0e13" roughness={0.85} />
          </mesh>
          {Array.from({ length: 10 }).map((_, idx) => {
            const y = -0.45 + idx * 0.1;
            const color = idx >= 8 ? '#ff3d00' : idx >= 6 ? '#ffb82e' : '#3bf2a8';
            return (
              <React.Fragment key={idx}>
                <mesh position={[-0.18, y, 0.01]}>
                  <boxGeometry args={[0.26, 0.062, 0.02]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      vuLeftRefs.current[idx] = el;
                    }}
                    color="#1a2028"
                    emissive={color}
                    emissiveIntensity={0.1}
                    toneMapped={false}
                  />
                </mesh>
                <mesh position={[0.18, y, 0.01]}>
                  <boxGeometry args={[0.26, 0.062, 0.02]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      vuRightRefs.current[idx] = el;
                    }}
                    color="#1a2028"
                    emissive={color}
                    emissiveIntensity={0.1}
                    toneMapped={false}
                  />
                </mesh>
              </React.Fragment>
            );
          })}
        </group>

        {/* Flush Gorilla-Glass Cover Lens */}
        <mesh position={[0, 0, 0.72]}>
          <planeGeometry args={[3.24, 1.28]} />
          <meshPhysicalMaterial
            color="#10141c"
            transparent
            opacity={0.18}
            roughness={0.05}
            metalness={0.1}
            clearcoat={1.0}
            clearcoatRoughness={0.04}
          />
        </mesh>
      </group>

      {/* 12. Top Edge 3.5mm TRS Jacks (1, 2, 3) + Plugged Coiled Orange Cable */}
      {[-2.05, -1.2, -0.35].map((jx) => (
        <group key={jx} position={[jx, 4.82, 0.12]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.21, 0.21, 0.12, 24]} />
            <meshStandardMaterial color="#d8dde6" metalness={0.95} roughness={0.16} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.04, 20]} />
            <meshStandardMaterial color="#121418" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Plugged Knurled 3.5mm Connector in Jack 1 */}
      <group position={[-2.05, 5.18, 0.12]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.18, 0.56, 24]} />
          <meshStandardMaterial color="#23272f" metalness={0.82} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.34, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.14, 0.18, 20]} />
          <meshStandardMaterial color="#ff4f00" roughness={0.35} />
        </mesh>
      </group>

      {/* Coiled Braided Orange Patch Cable */}
      <mesh geometry={geometries.cableGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#ff4f00" roughness={0.48} metalness={0.08} />
      </mesh>

      {/* 13. Stainless Corner Torx Screws on Chassis Rear & Top Corner Lanyard Pin */}
      {[
        [-2.85, 4.25],
        [2.85, 4.25],
        [-2.85, -4.25],
        [2.85, -4.25],
      ].map(([sx, sy], i) => (
        <mesh key={i} position={[sx, sy, -0.78]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.05, 16]} />
          <meshStandardMaterial color="#bfc5cf" metalness={0.94} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
};
