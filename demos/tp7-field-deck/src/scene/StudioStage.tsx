import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { createDeskMatTexture } from './proceduralTextures';
import { TP7Hardware } from './TP7Hardware';
import { tp7State, type CameraPreset } from '../state/tp7Store';

const PRESET_VIEWS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { pos: [-3.8, 10.1, 13.0], target: [-0.8, 0.7, -0.15] },
  reel: { pos: [0.45, 8.2, 6.9], target: [0.15, 0.85, -0.55] },
  rocker: { pos: [-7.6, 5.4, 6.4], target: [-0.95, 0.85, -0.05] },
  top: { pos: [0.0, 14.5, 2.5], target: [0.0, 0.75, -0.15] },
};

export const StudioStage: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const orbitEnabledRef = useRef(true);
  const lastPresetNonce = useRef(-1);
  const transitioningRef = useRef(false);
  const goalPos = useRef(new THREE.Vector3(...PRESET_VIEWS.hero.pos));
  const goalTarget = useRef(new THREE.Vector3(...PRESET_VIEWS.hero.target));

  const matTex = useMemo(() => createDeskMatTexture(), []);

  useEffect(() => {
    const view = PRESET_VIEWS.hero;
    camera.position.set(...view.pos);
    if (controlsRef.current) {
      controlsRef.current.target.set(...view.target);
      controlsRef.current.update();
    }
  }, [camera]);

  const handleSetOrbitEnabled = (enabled: boolean) => {
    orbitEnabledRef.current = enabled;
    if (controlsRef.current) {
      controlsRef.current.enabled = enabled;
    }
  };

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    if (tp7State.directorCamera.active) {
      camera.position.set(...tp7State.directorCamera.pos);
      ctrl.target.set(...tp7State.directorCamera.target);
      ctrl.update();
      return;
    }

    if (tp7State.cameraRequestNonce !== lastPresetNonce.current) {
      lastPresetNonce.current = tp7State.cameraRequestNonce;
      const view = PRESET_VIEWS[tp7State.cameraPreset];
      goalPos.current.set(...view.pos);
      goalTarget.current.set(...view.target);
      transitioningRef.current = true;
    }

    if (transitioningRef.current) {
      const k = 1 - Math.exp(-Math.min(0.05, delta) * 7.5);
      camera.position.lerp(goalPos.current, k);
      ctrl.target.lerp(goalTarget.current, k);
      ctrl.update();
      if (
        camera.position.distanceTo(goalPos.current) < 0.02 &&
        ctrl.target.distanceTo(goalTarget.current) < 0.02
      ) {
        transitioningRef.current = false;
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#b8c0cc']} />
      <fog attach="fog" args={['#b8c0cc', 28, 65]} />

      {/* 100% Procedural Studio Softbox Environment (zero external HDR fetches) */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#767f8d']} />
        {/* High Diffused Softbox Strips (clean anisotropic bands without mirror glare) */}
        <Lightformer
          form="rect"
          intensity={1.05}
          color="#f8fafe"
          position={[-5, 14, -4]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[16, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.95}
          color="#f4f8ff"
          position={[6, 14, -3]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[14, 6, 1]}
        />
        {/* Warm Left-Front Soft Key Panel */}
        <Lightformer
          form="rect"
          intensity={1.35}
          color="#fff4e6"
          position={[-14, 7, 6]}
          rotation={[0, Math.PI / 2.6, 0]}
          scale={[6, 12, 1]}
        />
        {/* Cool Right-Rear Rim Panel (angled cleanly without blinding macro camera) */}
        <Lightformer
          form="rect"
          intensity={0.95}
          color="#ddecff"
          position={[14, 11, -11]}
          rotation={[0, -Math.PI * 0.75, 0]}
          scale={[6, 10, 1]}
        />
        {/* Gentle Front Bounce Card */}
        <Lightformer
          form="rect"
          intensity={0.75}
          color="#f0f4fa"
          position={[0, 3.5, 16]}
          rotation={[0, Math.PI, 0]}
          scale={[18, 4, 1]}
        />
        {/* Dark studio edge negative-fill cards for crisp anodized contrast */}
        <Lightformer
          form="rect"
          intensity={0.18}
          color="#1e2229"
          position={[-14, 2, -6]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[12, 6, 1]}
        />
      </Environment>

      {/* Key, Fill & Studio Rim Lights */}
      <hemisphereLight args={['#eef3fb', '#8c94a1', 0.62]} />
      <directionalLight
        position={[-8.5, 14, 7.5]}
        intensity={1.15}
        color="#fffaf3"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00025}
        shadow-camera-near={1}
        shadow-camera-far={35}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
      />
      <directionalLight position={[9, 8.5, -7.5]} intensity={0.9} color="#dcebff" />
      <pointLight position={[3.0, 8.5, 11.5]} intensity={1.6} distance={28} decay={2} color="#fff3e6" />

      {/* Architectural Studio Tabletop Sweep */}
      <mesh position={[0, -0.11, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#bfc6d1" roughness={0.86} metalness={0.03} />
      </mesh>

      {/* Dark Charcoal Precision Desk Mat (Top Surface Exact at y = 0.0) */}
      <mesh position={[-1.1, -0.055, -0.25]} receiveShadow castShadow>
        <boxGeometry args={[17.8, 0.11, 13.0]} />
        <meshStandardMaterial map={matTex} roughness={0.88} metalness={0.05} />
      </mesh>

      <ContactShadows
        position={[-0.6, 0.004, -0.1]}
        opacity={0.48}
        scale={22}
        blur={1.8}
        far={4.2}
        resolution={512}
        color="#0b0d12"
      />

      {/* Hero Brushed Aluminum TP-7 Hardware */}
      <TP7Hardware onSetOrbitEnabled={handleSetOrbitEnabled} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4.0}
        maxDistance={24.0}
        maxPolarAngle={Math.PI * 0.47}
        minPolarAngle={0.08}
        onStart={() => {
          transitioningRef.current = false;
        }}
      />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.32} luminanceThreshold={1.85} luminanceSmoothing={0.25} />
      </EffectComposer>
    </>
  );
};
