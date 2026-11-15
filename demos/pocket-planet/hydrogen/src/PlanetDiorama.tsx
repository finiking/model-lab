import { useMemo, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { R_OCEAN, R_RAIL, sampleMoisture, samplePlanetRadius } from './noise';
import { planetStore } from './planetStore';
import { getSunDirection } from './AstrolabeRig';
import {
  createAuroraMaterial,
  createOceanMaterial,
  createPlanetTerrainMaterial,
} from './shaders';

interface TreePlacement {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
  isBlossom: boolean;
  phase: number;
}

interface HousePlacement {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}

interface CloudCluster {
  lat: number;
  lon: number;
  radius: number;
  speed: number;
  puffs: { offset: [number, number, number]; scale: number }[];
}

function buildTerrainAndOceanGeometries() {
  const terrainGeo = new THREE.IcosahedronGeometry(1, 5);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;

  const elevArr = new Float32Array(count);
  const moistArr = new Float32Array(count);
  const dir = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    dir.fromBufferAttribute(posAttr, i).normalize();
    const r = samplePlanetRadius(dir);
    const m = sampleMoisture(dir);
    posAttr.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);
    elevArr[i] = r;
    moistArr[i] = m;
  }

  terrainGeo.setAttribute('aElev', new THREE.BufferAttribute(elevArr, 1));
  terrainGeo.setAttribute('aMoisture', new THREE.BufferAttribute(moistArr, 1));
  terrainGeo.computeVertexNormals();

  const oceanGeo = new THREE.IcosahedronGeometry(R_OCEAN, 5);
  const oPos = oceanGeo.attributes.position as THREE.BufferAttribute;
  const oLandElev = new Float32Array(oPos.count);
  for (let i = 0; i < oPos.count; i++) {
    dir.fromBufferAttribute(oPos, i).normalize();
    oLandElev[i] = samplePlanetRadius(dir);
  }
  oceanGeo.setAttribute('aLandElev', new THREE.BufferAttribute(oLandElev, 1));
  oceanGeo.computeVertexNormals();

  return { terrainGeo, oceanGeo };
}

function createAuroraRibbonGeometry(poleSign: number, radius: number, height: number): THREE.BufferGeometry {
  const segsU = 96;
  const segsV = 12;
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let v = 0; v <= segsV; v++) {
    const vt = v / segsV;
    for (let u = 0; u <= segsU; u++) {
      const ut = u / segsU;
      const theta = ut * Math.PI * 2;
      // Undulating clover-ribbon wave around the pole
      const rMod = radius + Math.sin(theta * 3) * 0.055 + Math.cos(theta * 5) * 0.025;
      const baseAlt = 1.13 + vt * height;
      const x = Math.cos(theta) * rMod * (1 - vt * 0.12);
      const z = Math.sin(theta) * rMod * (1 - vt * 0.12);
      const y = poleSign * Math.sqrt(Math.max(0.05, baseAlt * baseAlt - rMod * rMod * 0.72));
      positions.push(x, y, z);
      uvs.push(ut, vt);
    }
  }

  for (let v = 0; v < segsV; v++) {
    for (let u = 0; u < segsU; u++) {
      const a = v * (segsU + 1) + u;
      const b = a + segsU + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function PlanetDiorama() {
  const planetGroupRef = useRef<THREE.Group>(null);
  const trainGroupRef = useRef<THREE.Group>(null);
  const cloudsGroupRef = useRef<THREE.Group>(null);
  const floraCanopyRef = useRef<THREE.InstancedMesh>(null);
  const floraBlossomRef = useRef<THREE.InstancedMesh>(null);
  const floraTrunkRef = useRef<THREE.InstancedMesh>(null);
  const wispsRef = useRef<THREE.InstancedMesh>(null);
  const smokeRef = useRef<THREE.InstancedMesh>(null);
  const trainHeadlightRef = useRef<THREE.PointLight>(null);
  const meteorGroupRef = useRef<THREE.Group>(null);
  const shockwaveGroupRef = useRef<THREE.Group>(null);
  const craterLavaGroupRef = useRef<THREE.Group>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const { terrainGeo, oceanGeo } = useMemo(() => buildTerrainAndOceanGeometries(), []);
  const terrainMat = useMemo(() => createPlanetTerrainMaterial(), []);
  const oceanMat = useMemo(() => createOceanMaterial(), []);
  const auroraMat = useMemo(() => createAuroraMaterial(), []);
  const houseWindowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffe08a',
        emissive: '#ffaa33',
        emissiveIntensity: 1.4,
      }),
    []
  );
  const northAuroraGeo = useMemo(() => createAuroraRibbonGeometry(1, 0.44, 0.34), []);
  const southAuroraGeo = useMemo(() => createAuroraRibbonGeometry(-1, 0.44, 0.34), []);

  // Deterministic trees, blossom flora, and glowing night cottages
  const { trees, blossoms, houses, wisps } = useMemo(() => {
    const treeList: TreePlacement[] = [];
    const blossomList: TreePlacement[] = [];
    const houseList: HousePlacement[] = [];
    const wispList: { baseDir: THREE.Vector3; phase: number; speed: number }[] = [];

    const up = new THREE.Vector3(0, 1, 0);
    // Fibonacci sphere sampling for even organic distribution
    const N = 1600;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const dir = new THREE.Vector3(Math.cos(theta) * rad, y, Math.sin(theta) * rad);

      // Avoid the equatorial railway corridor
      if (Math.abs(dir.y) < 0.088) continue;
      if (Math.abs(dir.y) > 0.86) continue;

      const r = samplePlanetRadius(dir);
      const m = sampleMoisture(dir);
      const h = r - R_OCEAN;

      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const pos = dir.clone().multiplyScalar(r - 0.004);

      if (h > 0.018 && h < 0.095) {
        const hash = Math.abs(Math.sin(i * 19.31) * 43758.5453) % 1;
        if (hash < 0.24 && treeList.length < 180) {
          treeList.push({
            pos,
            quat,
            scale: 0.72 + (hash * 3.1) % 0.65,
            isBlossom: false,
            phase: hash * Math.PI * 2,
          });
        } else if (hash >= 0.24 && hash < 0.41 && m > 0.42 && blossomList.length < 130) {
          blossomList.push({
            pos,
            quat,
            scale: 0.75 + (hash * 5.2) % 0.65,
            isBlossom: true,
            phase: hash * Math.PI * 2,
          });
        } else if (hash > 0.88 && h < 0.055 && houseList.length < 36) {
          houseList.push({
            pos: dir.clone().multiplyScalar(r - 0.002),
            quat,
            scale: 0.85 + (hash * 2.1) % 0.35,
          });
        }
      }
    }

    for (let i = 0; i < 64; i++) {
      const phi = golden * i * 7.3;
      const y = ((i % 16) / 15) * 1.4 - 0.7;
      const rad = Math.sqrt(Math.max(0.05, 1 - y * y));
      wispList.push({
        baseDir: new THREE.Vector3(Math.cos(phi) * rad, y, Math.sin(phi) * rad).normalize(),
        phase: i * 0.71,
        speed: 0.35 + (i % 5) * 0.12,
      });
    }

    return { trees: treeList, blossoms: blossomList, houses: houseList, wisps: wispList };
  }, []);

  // Puffy cloud bands
  const clouds = useMemo<CloudCluster[]>(() => {
    const arr: CloudCluster[] = [];
    for (let i = 0; i < 18; i++) {
      const lat = (i % 2 === 0 ? 0.28 : -0.32) + Math.sin(i * 2.3) * 0.24;
      const lon = (i / 18) * Math.PI * 2;
      arr.push({
        lat,
        lon,
        radius: 1.21 + (i % 3) * 0.025,
        speed: 0.045 + (i % 4) * 0.012,
        puffs: [
          { offset: [0, 0, 0], scale: 0.046 },
          { offset: [0.036, 0.006, 0.01], scale: 0.036 },
          { offset: [-0.034, -0.004, -0.008], scale: 0.033 },
          { offset: [0.012, 0.016, -0.014], scale: 0.03 },
        ],
      });
    }
    return arr;
  }, []);

  // Railway sleepers & viaduct support pillars
  const railwaySupports = useMemo(() => {
    const sleepers: { pos: [number, number, number]; rotY: number }[] = [];
    const pillars: { pos: [number, number, number]; rotY: number }[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      sleepers.push({
        pos: [Math.cos(a) * (R_RAIL - 0.004), 0, Math.sin(a) * (R_RAIL - 0.004)],
        rotY: -a,
      });
      if (i % 3 === 0) {
        pillars.push({
          pos: [Math.cos(a) * (R_RAIL - 0.068), 0, Math.sin(a) * (R_RAIL - 0.068)],
          rotY: -a,
        });
      }
    }
    return { sleepers, pillars };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const t = planetStore.time;
    const sunDir = getSunDirection(planetStore.solarTime);
    const dayElevation = Math.sin((planetStore.solarTime - 0.12) * Math.PI * 2);
    const nightFactor = THREE.MathUtils.clamp(0.5 - dayElevation * 0.7, 0, 1);

    // Transform world sunDir into planet local space so rotating the astrolabe keeps sun alignment accurate!
    const localSunDir = sunDir.clone();
    if (planetGroupRef.current) {
      planetGroupRef.current.rotation.y = planetStore.astrolabeYaw + t * 0.055;
      planetGroupRef.current.rotation.x = planetStore.astrolabePitch;
    }

    // Update shader uniforms
    terrainMat.uniforms.uTime.value = t;
    terrainMat.uniforms.uSunDir.value.copy(localSunDir);
    terrainMat.uniforms.uSpring.value = planetStore.springFactor;
    terrainMat.uniforms.uIce.value = planetStore.iceFactor;
    terrainMat.uniforms.uNight.value = nightFactor;

    oceanMat.uniforms.uTime.value = t;
    oceanMat.uniforms.uSunDir.value.copy(localSunDir);
    oceanMat.uniforms.uSpring.value = planetStore.springFactor;
    oceanMat.uniforms.uIce.value = planetStore.iceFactor;
    oceanMat.uniforms.uNight.value = nightFactor;

    // Crater uniforms
    for (let i = 0; i < 6; i++) {
      const c = planetStore.craters[i];
      if (c) {
        terrainMat.uniforms.uCraters.value[i].set(c.dir.x, c.dir.y, c.dir.z, c.intensity);
        terrainMat.uniforms.uCraterAges.value[i] = c.rippleAge;
        oceanMat.uniforms.uCraters.value[i].set(c.dir.x, c.dir.y, c.dir.z, c.intensity);
        oceanMat.uniforms.uCraterAges.value[i] = c.rippleAge;
      } else {
        terrainMat.uniforms.uCraters.value[i].set(0, 1, 0, 0);
        oceanMat.uniforms.uCraters.value[i].set(0, 1, 0, 0);
      }
    }

    // Aurora intensity rises sharply during Polar Ice Age & Night
    const auroraPower = 0.16 + planetStore.iceFactor * 1.45 + nightFactor * 0.65;
    auroraMat.uniforms.uTime.value = t;
    auroraMat.uniforms.uIntensity.value = auroraPower;

    // House glowing windows
    houseWindowMat.emissiveIntensity = 0.35 + nightFactor * 2.4;

    // Animate trees & spring blossoms
    if (floraTrunkRef.current && floraCanopyRef.current) {
      for (let i = 0; i < trees.length; i++) {
        const tr = trees[i];
        const sway = Math.sin(t * 2.2 + tr.phase) * 0.04;
        const s = tr.scale * (0.9 + planetStore.springFactor * 0.25) * (1 - planetStore.iceFactor * 0.15);
        dummy.position.copy(tr.pos);
        dummy.quaternion.copy(tr.quat);
        dummy.rotateZ(sway);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        floraTrunkRef.current.setMatrixAt(i, dummy.matrix);

        dummy.translateY(0.028);
        dummy.updateMatrix();
        floraCanopyRef.current.setMatrixAt(i, dummy.matrix);
      }
      floraTrunkRef.current.instanceMatrix.needsUpdate = true;
      floraCanopyRef.current.instanceMatrix.needsUpdate = true;
    }

    if (floraBlossomRef.current) {
      const bloomScale = 0.25 + planetStore.springFactor * 1.15;
      for (let i = 0; i < blossoms.length; i++) {
        const bl = blossoms[i];
        const pulse = 1 + Math.sin(t * 3.1 + bl.phase) * 0.1;
        const s = bl.scale * bloomScale * pulse * (1 - planetStore.iceFactor * 0.65);
        dummy.position.copy(bl.pos);
        dummy.quaternion.copy(bl.quat);
        dummy.translateY(0.022 * s);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        floraBlossomRef.current.setMatrixAt(i, dummy.matrix);
      }
      floraBlossomRef.current.instanceMatrix.needsUpdate = true;
    }

    // Floating Spring Firefly / Aurora Wisps
    if (wispsRef.current) {
      const wispVis = THREE.MathUtils.clamp((planetStore.springFactor - 0.25) * 1.4 + nightFactor * 0.5, 0.08, 1.0);
      for (let i = 0; i < wisps.length; i++) {
        const w = wisps[i];
        const angle = t * w.speed + w.phase;
        const dir = w.baseDir.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle * 0.25);
        const hover = 1.11 + Math.sin(t * 2.4 + w.phase) * 0.045;
        dummy.position.copy(dir).multiplyScalar(hover);
        const s = wispVis * (0.6 + 0.4 * Math.sin(t * 4.5 + w.phase));
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        wispsRef.current.setMatrixAt(i, dummy.matrix);
      }
      wispsRef.current.instanceMatrix.needsUpdate = true;
    }

    // Orbital Miniature Train around the equator
    const ta = planetStore.trainAngle;
    if (trainGroupRef.current) {
      const tx = Math.cos(ta) * (R_RAIL + 0.015);
      const tz = Math.sin(ta) * (R_RAIL + 0.015);
      trainGroupRef.current.position.set(tx, 0, tz);
      // Orient forward along tangent (-sin, 0, cos)
      trainGroupRef.current.rotation.set(0, -ta, 0);
    }

    if (trainHeadlightRef.current) {
      trainHeadlightRef.current.intensity = 0.8 + nightFactor * 2.2;
    }

    // Puffing smoke balls trailing the locomotive
    if (smokeRef.current) {
      for (let i = 0; i < 16; i++) {
        const life = ((t * (1.2 + planetStore.trainSpeed) + i / 16) % 1);
        const lagAngle = ta - 0.03 - life * 0.34;
        const rSmoke = R_RAIL + 0.045 + life * 0.11;
        const jitterY = Math.sin(life * 8 + i) * 0.014 + life * 0.025;
        dummy.position.set(Math.cos(lagAngle) * rSmoke, jitterY, Math.sin(lagAngle) * rSmoke);
        const s = Math.sin(life * Math.PI) * (0.45 + life * 0.9);
        tmpScale.setScalar(Math.max(0.001, s));
        dummy.scale.copy(tmpScale);
        dummy.updateMatrix();
        smokeRef.current.setMatrixAt(i, dummy.matrix);
      }
      smokeRef.current.instanceMatrix.needsUpdate = true;
    }

    // Drifting clouds
    if (cloudsGroupRef.current) {
      cloudsGroupRef.current.rotation.y = t * 0.032;
    }

    // Update active falling meteors meshes
    if (meteorGroupRef.current) {
      const children = meteorGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const m = planetStore.meteors[i];
        const mesh = children[i];
        if (m) {
          mesh.visible = true;
          const endPos = m.targetDir.clone().multiplyScalar(samplePlanetRadius(m.targetDir));
          // Parabolic flaming arc
          const p = m.progress;
          mesh.position.lerpVectors(m.startPos, endPos, p * p);
          mesh.lookAt(endPos);
        } else {
          mesh.visible = false;
        }
      }
    }

    // Update impact shockwave rings
    if (shockwaveGroupRef.current) {
      const children = shockwaveGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const c = planetStore.craters[i];
        const ring = children[i] as THREE.Mesh;
        if (c && c.rippleAge < 2.2) {
          ring.visible = true;
          const p = c.rippleAge / 2.2;
          ring.position.copy(c.dir).multiplyScalar(1.03);
          ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), c.dir);
          const sc = 0.06 + p * 0.65;
          ring.scale.set(sc, sc, 1);
          const mat = ring.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - p) * 0.9;
        } else {
          ring.visible = false;
        }
      }
    }

    // Update glowing molten lava crater pools on land craters
    if (craterLavaGroupRef.current) {
      const children = craterLavaGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const c = planetStore.craters[i];
        const grp = children[i];
        if (c) {
          const r = samplePlanetRadius(c.dir);
          if (r > R_OCEAN - 0.008) {
            grp.visible = true;
            grp.position.copy(c.dir).multiplyScalar(Math.max(R_OCEAN, r) - 0.004);
            grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.dir);
            const pulse = 0.90 + 0.10 * Math.sin(t * 5.2 + i);
            grp.scale.setScalar(pulse * Math.min(1.1, c.intensity + 0.25));
          } else {
            grp.visible = false;
          }
        } else {
          grp.visible = false;
        }
      }
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.hypot(dx, dy) > 7) return; // User was dragging to spin
    }
    if (planetGroupRef.current) {
      const localPt = planetGroupRef.current.worldToLocal(e.point.clone());
      planetStore.triggerMeteorStrike(localPt.normalize());
    }
  };

  return (
    <group ref={planetGroupRef}>
      {/* Displaced Multi-Biome Procedural Terrain */}
      <mesh
        geometry={terrainGeo}
        material={terrainMat}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      />

      {/* Teal-Turquoise Animated Ocean Shell with Tsunami Ripples & Ice Shelves */}
      <mesh
        geometry={oceanGeo}
        material={oceanMat}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      />

      {/* Equatorial Miniature Railway Track & Viaduct Arches */}
      <group>
        {/* Outer & Inner Brass Rails */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R_RAIL, 0.007, 8, 128]} />
          <meshStandardMaterial color="#f5cd79" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R_RAIL + 0.028, 0.007, 8, 128]} />
          <meshStandardMaterial color="#f5cd79" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Timber Rail Bed */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R_RAIL + 0.014, 0.014, 6, 128]} />
          <meshStandardMaterial color="#4e301d" roughness={0.75} />
        </mesh>

        {/* Sleepers & Grounded Bridge Pillars */}
        {railwaySupports.sleepers.map((s, idx) => (
          <mesh key={idx} position={s.pos} rotation={[0, s.rotY, 0]}>
            <boxGeometry args={[0.044, 0.008, 0.012]} />
            <meshStandardMaterial color="#3c2314" roughness={0.8} />
          </mesh>
        ))}
        {railwaySupports.pillars.map((p, idx) => (
          <mesh key={idx} position={p.pos} rotation={[0, p.rotY, Math.PI / 2]}>
            <cylinderGeometry args={[0.009, 0.013, 0.14, 8]} />
            <meshStandardMaterial color="#9c7233" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}

        {/* Articulated 3-Car Glowing Miniature Orbital Train */}
        <group ref={trainGroupRef}>
          {/* Car 1: Brass & Crimson Steam Locomotive */}
          <group position={[0.014, 0, 0]}>
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.068, 12]} />
              <meshStandardMaterial color="#b8322b" metalness={0.4} roughness={0.35} />
            </mesh>
            {/* Brass Boiler Rings & Smokestack */}
            <mesh position={[0.022, 0, 0.02]} rotation={[0, 0, -Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.009, 0.026, 10]} />
              <meshStandardMaterial color="#f2c464" metalness={0.88} roughness={0.2} />
            </mesh>
            {/* Glowing Golden Locomotive Cab & Headlight */}
            <mesh position={[0.016, 0, -0.022]}>
              <boxGeometry args={[0.036, 0.034, 0.03]} />
              <meshStandardMaterial
                color="#ffd37d"
                emissive="#ff9f38"
                emissiveIntensity={1.6}
                roughness={0.3}
              />
            </mesh>
            {/* Headlight Lens + Glow Cone */}
            <mesh position={[0.012, 0, 0.038]}>
              <sphereGeometry args={[0.01, 10, 10]} />
              <meshBasicMaterial color="#fff3b8" />
            </mesh>
            <mesh position={[0.012, 0, 0.095]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.042, 0.11, 16, 1, true]} />
              <meshBasicMaterial color="#ffe599" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <pointLight ref={trainHeadlightRef} position={[0.025, 0, 0.08]} distance={0.45} color="#ffd57a" intensity={1.8} />
          </group>

          {/* Car 2: Glowing Amber Passenger Carriage */}
          <group position={[0.014, 0, -0.082]}>
            <mesh>
              <boxGeometry args={[0.03, 0.032, 0.056]} />
              <meshStandardMaterial
                color="#2c4a58"
                emissive="#ffb84d"
                emissiveIntensity={1.25}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0.017, 0, 0]}>
              <boxGeometry args={[0.007, 0.036, 0.06]} />
              <meshStandardMaterial color="#d9a84e" metalness={0.75} roughness={0.3} />
            </mesh>
          </group>

          {/* Car 3: Observation Tail Coach */}
          <group position={[0.014, 0, -0.148]}>
            <mesh>
              <boxGeometry args={[0.028, 0.03, 0.048]} />
              <meshStandardMaterial
                color="#335e4f"
                emissive="#88ffd6"
                emissiveIntensity={0.85}
                roughness={0.35}
              />
            </mesh>
          </group>
        </group>

        {/* Puffing Steam Smoke Spheres */}
        <instancedMesh ref={smokeRef} args={[undefined, undefined, 16]}>
          <dodecahedronGeometry args={[0.022, 0]} />
          <meshStandardMaterial color="#fff6e6" emissive="#ffd89c" emissiveIntensity={0.35} transparent opacity={0.78} roughness={0.9} />
        </instancedMesh>
      </group>

      {/* Instanced Low-Poly Pine Trees */}
      <instancedMesh ref={floraTrunkRef} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.004, 0.006, 0.022, 6]} />
        <meshStandardMaterial color="#593a24" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={floraCanopyRef} args={[undefined, undefined, trees.length]}>
        <coneGeometry args={[0.019, 0.046, 6]} />
        <meshStandardMaterial color="#1f7a4d" roughness={0.65} flatShading />
      </instancedMesh>

      {/* Instanced Glowing Spring Blossoms & Bioluminescent Flowers */}
      <instancedMesh ref={floraBlossomRef} args={[undefined, undefined, blossoms.length]}>
        <dodecahedronGeometry args={[0.015, 0]} />
        <meshStandardMaterial
          color="#ff9ec4"
          emissive="#ff5ca8"
          emissiveIntensity={0.85}
          roughness={0.4}
          flatShading
        />
      </instancedMesh>

      {/* Floating Spring Glow Wisps */}
      <instancedMesh ref={wispsRef} args={[undefined, undefined, wisps.length]}>
        <octahedronGeometry args={[0.009, 0]} />
        <meshBasicMaterial color="#7affd4" />
      </instancedMesh>

      {/* Miniature Night-Lit Toy Cottages */}
      {houses.map((h, idx) => (
        <group key={idx} position={h.pos} quaternion={h.quat} scale={h.scale}>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[0.022, 0.02, 0.022]} />
            <meshStandardMaterial color="#eadbc8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.026, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.02, 0.018, 4]} />
            <meshStandardMaterial color="#c95b3c" roughness={0.65} flatShading />
          </mesh>
          <mesh position={[0, 0.011, 0]} material={houseWindowMat}>
            <boxGeometry args={[0.024, 0.008, 0.012]} />
          </mesh>
        </group>
      ))}

      {/* Puffy Floating Cloud Rings */}
      <group ref={cloudsGroupRef}>
        {clouds.map((cl, idx) => {
          const cy = Math.sin(cl.lat) * cl.radius;
          const cr = Math.cos(cl.lat) * cl.radius;
          const cx = Math.cos(cl.lon) * cr;
          const cz = Math.sin(cl.lon) * cr;
          const normal = new THREE.Vector3(cx, cy, cz).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
          return (
            <group key={idx} position={[cx, cy, cz]} quaternion={q}>
              {cl.puffs.map((p, pIdx) => (
                <mesh key={pIdx} position={p.offset} scale={p.scale}>
                  <icosahedronGeometry args={[1, 1]} />
                  <meshStandardMaterial
                    color="#f6f9ff"
                    emissive="#253352"
                    emissiveIntensity={0.2}
                    roughness={0.85}
                    flatShading
                  />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>

      {/* Shimmering Emerald & Violet Polar Aurora Ribbons */}
      <mesh geometry={northAuroraGeo} material={auroraMat} renderOrder={12} />
      <mesh geometry={southAuroraGeo} material={auroraMat} renderOrder={12} />

      {/* Active Falling Meteorites (pool of 4 slots) */}
      <group ref={meteorGroupRef}>
        {[0, 1, 2, 3].map((slot) => (
          <group key={slot} visible={false}>
            <mesh>
              <dodecahedronGeometry args={[0.052, 0]} />
              <meshStandardMaterial
                color="#ff8c38"
                emissive="#ff5214"
                emissiveIntensity={3.2}
                roughness={0.3}
              />
            </mesh>
            {/* Fiery meteor tail cone */}
            <mesh position={[0, 0, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.068, 0.52, 12, 1, true]} />
              <meshBasicMaterial
                color="#ffb347"
                transparent
                opacity={0.78}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
            <pointLight color="#ff7324" intensity={4.5} distance={1.8} />
          </group>
        ))}
      </group>

      {/* Expanding Meteor Impact Shockwaves */}
      <group ref={shockwaveGroupRef}>
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <mesh key={slot} visible={false}>
            <ringGeometry args={[0.82, 1.0, 48]} />
            <meshBasicMaterial
              color="#ffbe6b"
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* Glowing Molten Magma Core & Ember Rings inside Land Craters */}
      <group ref={craterLavaGroupRef}>
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <group key={slot} visible={false}>
            <mesh position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.085, 0.115, 0.025, 16]} />
              <meshStandardMaterial
                color="#ff7a22"
                emissive="#ff4808"
                emissiveIntensity={2.6}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.095, 0.155, 24]} />
              <meshStandardMaterial
                color="#2c1614"
                emissive="#ff6e1a"
                emissiveIntensity={1.1}
                roughness={0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
