import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { R_GLASS } from './noise';
import { planetStore } from './planetStore';
import { createCrystalGlassMaterial } from './shaders';

function createBrushedBrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 512, 128);

  // Fine lathe brushed metal streaks
  for (let y = 0; y < 128; y++) {
    const v = 112 + Math.floor(Math.sin(y * 1.9) * 18 + ((y * 37) % 24));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 512, 1);
  }
  // Engraved tick marks along edge
  ctx.fillStyle = '#2a2a2a';
  for (let i = 0; i < 72; i++) {
    const x = (i / 72) * 512;
    const h = i % 6 === 0 ? 34 : i % 3 === 0 ? 22 : 12;
    ctx.fillRect(x, 0, 2, h);
    ctx.fillRect(x, 128 - h, 2, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.needsUpdate = true;
  return tex;
}

function createCardinalBadgeTexture(glyph: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#181410';
  ctx.fillRect(0, 0, 128, 128);

  // Brass double border
  ctx.strokeStyle = '#ecc06b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#9b7228';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffe29e';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 64, 67);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function getSunDirection(solarTime: number): THREE.Vector3 {
  // solarTime 0.34 -> warm front-right-upper golden day; 0.65 -> sunset left; 0.90 -> behind/night
  const angle = (solarTime - 0.34) * Math.PI * 2 + 0.55;
  const elev = 0.42 + Math.sin(solarTime * Math.PI * 2) * 0.24;
  return new THREE.Vector3(Math.cos(angle), elev, Math.sin(angle)).normalize();
}

export function AstrolabeRig() {
  const outerRingRef = useRef<THREE.Group>(null);
  const eclipticRingRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Group>(null);
  const orreryArmRef = useRef<THREE.Group>(null);
  const sunLightRef = useRef<THREE.PointLight>(null);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  const glassMat = useMemo(() => createCrystalGlassMaterial(), []);
  const brushedTex = useMemo(() => createBrushedBrassTexture(), []);
  const cardinalTextures = useMemo(
    () => ({
      N: createCardinalBadgeTexture('N'),
      E: createCardinalBadgeTexture('E'),
      S: createCardinalBadgeTexture('S'),
      W: createCardinalBadgeTexture('W'),
    }),
    []
  );

  const goldBrassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e2b257'),
        metalness: 0.88,
        roughness: 0.24,
        roughnessMap: brushedTex,
        bumpMap: brushedTex,
        bumpScale: 0.012,
      }),
    [brushedTex]
  );

  const agedBronzeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#8e6326'),
        metalness: 0.82,
        roughness: 0.36,
        roughnessMap: brushedTex,
      }),
    [brushedTex]
  );

  const brightGoldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffda82'),
        metalness: 0.92,
        roughness: 0.16,
      }),
    []
  );

  const tickTransforms = useMemo(() => {
    const arr: { pos: [number, number, number]; rotZ: number; major: boolean }[] = [];
    const r = 1.66;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      arr.push({
        pos: [Math.cos(a) * r, Math.sin(a) * r, 0],
        rotZ: a,
        major: i % 6 === 0,
      });
    }
    return arr;
  }, []);

  const eclipticStuds = useMemo(() => {
    const arr: [number, number, number][] = [];
    const r = 1.54;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      arr.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    const t = planetStore.time;
    const sunDir = getSunDirection(planetStore.solarTime);

    glassMat.uniforms.uSunDir.value.copy(sunDir);
    glassMat.uniforms.uTime.value = t;

    if (dirLightRef.current) {
      dirLightRef.current.position.copy(sunDir).multiplyScalar(7);
      // Warm sunset tint when solarTime ~ 0.65 or 0.15, cool moonlight when night
      const dayElevation = Math.max(0, Math.sin((planetStore.solarTime - 0.12) * Math.PI * 2));
      const sunsetFactor = Math.exp(-Math.pow((planetStore.solarTime - 0.62) * 6.0, 2));
      const c = new THREE.Color('#fff1d6')
        .lerp(new THREE.Color('#ff8e3c'), sunsetFactor * 0.85)
        .lerp(new THREE.Color('#3b5d9a'), (1 - dayElevation) * 0.65);
      dirLightRef.current.color.copy(c);
      dirLightRef.current.intensity = 1.15 + dayElevation * 1.95;
    }

    if (orreryArmRef.current) {
      const sunPos = sunDir.clone().multiplyScalar(1.88);
      orreryArmRef.current.lookAt(sunPos);
    }

    if (sunLightRef.current) {
      const sunPos = sunDir.clone().multiplyScalar(1.9);
      sunLightRef.current.position.copy(sunPos);
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.y = planetStore.astrolabeYaw * 0.32 + Math.sin(t * 0.18) * 0.04;
      outerRingRef.current.rotation.x = planetStore.astrolabePitch * 0.25;
    }

    if (eclipticRingRef.current) {
      eclipticRingRef.current.rotation.y = t * 0.11 + planetStore.astrolabeYaw * 0.55;
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = Math.sin(t * 0.25) * 0.08 + planetStore.astrolabePitch * 0.35;
      innerRingRef.current.rotation.y = -t * 0.08 + planetStore.astrolabeYaw * 0.72;
    }
  });

  return (
    <group>
      {/* Dynamic Solar Key Light + Warm Brass Rim Lights */}
      <directionalLight ref={dirLightRef} position={[4, 3, 4]} intensity={2.6} color="#fff0d4" />
      <pointLight ref={sunLightRef} position={[1.5, 1.0, 1.2]} intensity={3.2} distance={6.5} color="#ffd175" />
      <directionalLight position={[-4.5, 2.2, -3.5]} intensity={1.15} color="#468cff" />
      <directionalLight position={[1.0, -4.0, 2.0]} intensity={0.75} color="#e59a38" />

      {/* Crystal Terrarium Glass Sphere — razor-clear interior, crisp Fresnel studio rim */}
      <mesh material={glassMat} renderOrder={20}>
        <sphereGeometry args={[R_GLASS, 64, 64]} />
      </mesh>

      {/* Outer Meridian Astrolabe Ring + Cardinal Glyphs */}
      <group ref={outerRingRef}>
        <mesh material={goldBrassMat}>
          <torusGeometry args={[1.66, 0.042, 18, 128]} />
        </mesh>
        <mesh material={agedBronzeMat}>
          <torusGeometry args={[1.71, 0.016, 12, 128]} />
        </mesh>
        <mesh material={brightGoldMat}>
          <torusGeometry args={[1.605, 0.011, 10, 128]} />
        </mesh>

        {/* 72 Engraved Brass Degree Ticks */}
        {tickTransforms.map((tk, idx) => (
          <mesh
            key={idx}
            position={tk.pos}
            rotation={[0, 0, tk.rotZ]}
            material={tk.major ? brightGoldMat : agedBronzeMat}
          >
            <boxGeometry args={[tk.major ? 0.068 : 0.036, tk.major ? 0.016 : 0.008, 0.092]} />
          </mesh>
        ))}

        {/* 4 Cardinal Compass Medallions (N, E, S, W) */}
        {[
          { pos: [0, 1.72, 0] as [number, number, number], tex: cardinalTextures.N },
          { pos: [1.72, 0, 0] as [number, number, number], tex: cardinalTextures.E },
          { pos: [0, -1.72, 0] as [number, number, number], tex: cardinalTextures.S },
          { pos: [-1.72, 0, 0] as [number, number, number], tex: cardinalTextures.W },
        ].map((card, idx) => (
          <group key={idx} position={card.pos}>
            <mesh material={brightGoldMat} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.105, 0.115, 0.052, 24]} />
            </mesh>
            <mesh position={[0, 0, 0.028]}>
              <circleGeometry args={[0.088, 24]} />
              <meshBasicMaterial map={card.tex} />
            </mesh>
            <mesh position={[0, 0, -0.028]} rotation={[0, Math.PI, 0]}>
              <circleGeometry args={[0.088, 24]} />
              <meshBasicMaterial map={card.tex} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Tilted Ecliptic Gimbal Ring (23.5 deg) */}
      <group rotation={[0.41, 0.25, -0.36]}>
        <group ref={eclipticRingRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={goldBrassMat}>
            <torusGeometry args={[1.54, 0.028, 16, 112]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={agedBronzeMat}>
            <torusGeometry args={[1.575, 0.01, 10, 112]} />
          </mesh>
          {eclipticStuds.map((pos, idx) => (
            <group key={idx} position={pos}>
              <mesh material={brightGoldMat}>
                <sphereGeometry args={[0.028, 12, 12]} />
              </mesh>
              <mesh position={[0, 0.018, 0]}>
                <octahedronGeometry args={[0.018, 0]} />
                <meshStandardMaterial
                  color={idx % 3 === 0 ? '#49f2d0' : '#ffbd59'}
                  emissive={idx % 3 === 0 ? '#18b899' : '#d97a16'}
                  emissiveIntensity={1.2}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* Inner Polar Pivot Armillary Ring clasping the crystal sphere */}
      <group ref={innerRingRef}>
        <mesh material={brightGoldMat}>
          <torusGeometry args={[1.445, 0.018, 14, 112]} />
        </mesh>
        {/* North & South Polar Finial Pins */}
        <mesh position={[0, 1.42, 0]} material={brightGoldMat}>
          <coneGeometry args={[0.048, 0.14, 16]} />
        </mesh>
        <mesh position={[0, -1.42, 0]} rotation={[Math.PI, 0, 0]} material={brightGoldMat}>
          <coneGeometry args={[0.048, 0.14, 16]} />
        </mesh>
      </group>

      {/* Orbiting Brass Solar & Lunar Orrery Arm */}
      <group ref={orreryArmRef}>
        {/* Golden Sun Orb */}
        <group position={[0, 0, 1.88]}>
          <mesh>
            <sphereGeometry args={[0.088, 24, 24]} />
            <meshStandardMaterial
              color="#ffe599"
              emissive="#ffae38"
              emissiveIntensity={2.3}
              roughness={0.15}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={brightGoldMat}>
            <torusGeometry args={[0.135, 0.01, 10, 32]} />
          </mesh>
        </group>

        {/* Opposing Silver-Pearl Crescent Moon Orb */}
        <group position={[0, 0, -1.88]}>
          <mesh>
            <sphereGeometry args={[0.056, 20, 20]} />
            <meshStandardMaterial
              color="#dbe9ff"
              emissive="#5c88e0"
              emissiveIntensity={1.1}
              roughness={0.3}
              metalness={0.3}
            />
          </mesh>
        </group>
      </group>

      {/* Ornate Brass Observatory Pedestal Cradle underneath the Astrolabe */}
      <group position={[0, -1.88, 0]}>
        {/* Upper brass collar */}
        <mesh material={agedBronzeMat} position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.14, 0.22, 0.2, 24]} />
        </mesh>
        {/* Fluted brass column */}
        <mesh material={goldBrassMat} position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.18, 0.36, 0.18, 32]} />
        </mesh>
        {/* Stepped mahogany-and-brass base */}
        <mesh material={agedBronzeMat} position={[0, -0.21, 0]}>
          <cylinderGeometry args={[0.68, 0.82, 0.11, 48]} />
        </mesh>
        <mesh position={[0, -0.28, 0]}>
          <cylinderGeometry args={[0.88, 0.94, 0.08, 48]} />
          <meshStandardMaterial color="#1a120d" roughness={0.45} metalness={0.25} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.23, 0]} material={brightGoldMat}>
          <torusGeometry args={[0.84, 0.016, 12, 64]} />
        </mesh>
      </group>
    </group>
  );
}
