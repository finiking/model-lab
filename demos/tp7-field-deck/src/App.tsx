import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { StudioStage } from './scene/StudioStage';
import { HudOverlay } from './components/HudOverlay';
import { BASE_REEL_OMEGA, notifyTP7, tp7State, type RockerState } from './state/tp7Store';
import { tp7Audio } from './audio/tp7AudioEngine';

declare global {
  interface Window {
    __tp7Director?: {
      setCamera: (pos: [number, number, number], target: [number, number, number]) => void;
      releaseCamera: () => void;
      setScratch: (active: boolean, velocityRatio?: number) => void;
      setRocker: (state: RockerState) => void;
      pressKey: (key: 'rec' | 'play' | 'stop' | 'memo', down: boolean) => void;
      setRecArmed: (armed: boolean) => void;
      setPlaying: (playing: boolean) => void;
      getState: () => {
        reelAngle: number;
        tapeVelocity: number;
        vuLeft: number;
        vuRight: number;
      };
    };
  }
}

export const App: React.FC = () => {
  useEffect(() => {
    const unlockOnce = () => {
      tp7Audio.unlock();
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });

    window.__tp7Director = {
      setCamera: (pos, target) => {
        tp7State.directorCamera.active = true;
        tp7State.directorCamera.pos = pos;
        tp7State.directorCamera.target = target;
      },
      releaseCamera: () => {
        tp7State.directorCamera.active = false;
      },
      setScratch: (active, velocityRatio = 0) => {
        tp7State.isScratching = active;
        if (active) {
          const omega = velocityRatio * BASE_REEL_OMEGA;
          tp7State.scratchOmega = omega;
          tp7State.angularVelocity = omega;
          // In virtual frame stepping, keep applying direct reel rotation smoothly
          tp7State.reelAngle -= omega * (1 / 60);
        }
      },
      setRocker: (state) => {
        tp7State.rockerState = state;
        notifyTP7();
      },
      pressKey: (key, down) => {
        tp7State.keyTarget[key] = down ? 1 : 0;
        if (down) {
          tp7State.clickTransient = Math.max(tp7State.clickTransient, 0.36);
        }
      },
      setRecArmed: (armed) => {
        tp7State.isRecArmed = armed;
        notifyTP7();
      },
      setPlaying: (playing) => {
        tp7State.isPlaying = playing;
        notifyTP7();
      },
      getState: () => ({
        reelAngle: tp7State.reelAngle,
        tapeVelocity: tp7State.tapeVelocity,
        vuLeft: tp7State.vuLeft,
        vuRight: tp7State.vuRight,
      }),
    };

    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      delete window.__tp7Director;
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 36, near: 0.1, far: 120, position: [-3.8, 10.1, 13.0] }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.94,
          preserveDrawingBuffer: true,
        }}
      >
        <StudioStage />
      </Canvas>
      <HudOverlay />
    </div>
  );
};

export default App;
