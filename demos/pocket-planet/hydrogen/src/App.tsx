import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AstrolabeRig } from './AstrolabeRig';
import { PlanetDiorama } from './PlanetDiorama';
import { planetStore, usePlanetStore } from './planetStore';
import { createSkyDomeMaterial } from './shaders';

function ObservatoryBackdrop() {
  const skyMat = useMemo(() => createSkyDomeMaterial(), []);

  useFrame(() => {
    const dayEl = Math.sin((planetStore.solarTime - 0.12) * Math.PI * 2);
    const night = THREE.MathUtils.clamp(0.5 - dayEl * 0.7, 0, 1);
    skyMat.uniforms.uTime.value = planetStore.time;
    skyMat.uniforms.uNight.value = night;
  });

  return (
    <mesh material={skyMat} renderOrder={-10}>
      <sphereGeometry args={[28, 32, 32]} />
    </mesh>
  );
}

function SimulationTicker() {
  const { camera } = useThree();

  useFrame((_, dt) => {
    planetStore.step(dt);
    const targetZ = 6.02 / THREE.MathUtils.clamp(planetStore.cameraZoom, 0.76, 1.38);
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 8);
    camera.position.y += (0.04 - camera.position.y) * Math.min(1, dt * 8);
    camera.lookAt(0, -0.05, 0);
  });

  return null;
}

function getSolarPhaseLabel(solarTime: number): string {
  if (solarTime < 0.16 || solarTime > 0.80) return '星夜微光';
  if (solarTime < 0.30) return '金色黎明';
  if (solarTime < 0.56) return '白昼暖阳';
  return '琥珀黄昏';
}

export function App() {
  const snap = usePlanetStore();
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.pp-dock')) return;
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    planetStore.astrolabeYaw += dx * 0.0075;
    planetStore.astrolabePitch = Math.max(-0.95, Math.min(0.95, planetStore.astrolabePitch + dy * 0.006));
    planetStore.velYaw = dx * 0.38;
    planetStore.velPitch = dy * 0.32;
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    planetStore.cameraZoom = THREE.MathUtils.clamp(
      planetStore.cameraZoom - e.deltaY * 0.0008,
      0.78,
      1.36
    );
  };

  return (
    <div
      className="pp-root"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.04, 6.02], fov: 38, near: 0.1, far: 60 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <SimulationTicker />
        <ObservatoryBackdrop />

        <ambientLight intensity={0.28} color="#9bb8e8" />

        {/* Zero-network procedural studio Lightformers for brushed gold brass reflections */}
        <Environment frames={1} resolution={256}>
          <Lightformer
            form="rect"
            intensity={2.8}
            color="#ffe6b0"
            position={[3.5, 4.0, 3.0]}
            scale={[5, 3, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="ring"
            intensity={1.6}
            color="#72b7ff"
            position={[-4.0, 2.0, -3.5]}
            scale={[4, 4, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.4}
            color="#ffba5c"
            position={[0, -4.5, 2.0]}
            scale={[6, 2, 1]}
            target={[0, 0, 0]}
          />
        </Environment>

        <AstrolabeRig />
        <PlanetDiorama />

        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1.12} intensity={0.68} radius={0.68} />
          <Vignette eskil={false} offset={0.24} darkness={0.44} />
        </EffectComposer>
      </Canvas>

      {/* Edge-Pinned Luxury Watchmaker HUD */}
      <div className="pp-hud-top-left">
        <div className="pp-title-card">
          <div className="pp-title-row">
            <span className="pp-crest" />
            <span className="pp-title">掌中造物星盘 · 微缩行星演化球</span>
          </div>
          <div className="pp-subtitle">POCKET PLANET // BRASS ASTROLABE TERRARIUM</div>
        </div>

        <div className="pp-stats-row">
          <span className="pp-pill pp-pill-era">{snap.eraLabel}</span>
          <span className="pp-pill">
            地表均值 <strong>{snap.tempC > 0 ? `+${snap.tempC}` : snap.tempC}°C</strong>
          </span>
          <span className="pp-pill">
            生态植被 <strong>{snap.floraCount}</strong>
          </span>
          {snap.cratersCount > 0 && (
            <span className="pp-pill">
              熔岩陨坑 <strong>{snap.cratersCount}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="pp-hud-top-right">
        <div className="pp-hint-pill">拖拽旋转星盘 · 滚轮缩放 · 点击行星表面召唤陨石</div>
        <div className="pp-event-banner">{snap.lastEventText}</div>
      </div>

      {/* Bottom God-Mode Console */}
      <div className="pp-dock" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`pp-btn ${snap.springBloom ? 'active-spring' : ''}`}
          onClick={() => planetStore.toggleSpringBloom()}
        >
          <span>🌸</span>
          <span>春意盎然</span>
        </button>

        <button
          type="button"
          className="pp-btn meteor-btn"
          onClick={() => {
            if (window.__pocketDirector) window.__pocketDirector.strikeFront();
          }}
        >
          <span>☄️</span>
          <span>陨石天降</span>
        </button>

        <button
          type="button"
          className={`pp-btn ${snap.iceAge ? 'active-ice' : ''}`}
          onClick={() => planetStore.toggleIceAge()}
        >
          <span>❄️</span>
          <span>极地冰期</span>
        </button>

        <div className="pp-divider" />

        <div className="pp-solar-box">
          <span className="pp-solar-label">☀️ {getSolarPhaseLabel(snap.solarTime)}</span>
          <input
            className="pp-slider"
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={snap.solarTime}
            onChange={(e) => planetStore.setSolarTime(parseFloat(e.target.value))}
            aria-label="晨昏星盘刻度"
          />
          <button
            type="button"
            className={`pp-auto-btn ${snap.autoSolar ? 'on' : ''}`}
            onClick={() => planetStore.toggleAutoSolar()}
          >
            {snap.autoSolar ? '巡转中' : '自动'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
