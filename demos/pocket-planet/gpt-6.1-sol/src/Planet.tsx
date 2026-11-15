import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { makeTerrain, sampleLand } from './procedural';
import { auroraFrag, auroraVert, oceanFrag, oceanVert, terrainFrag, terrainVert } from './shaders';
import { actions, seeded, world } from './world';

const UP = new THREE.Vector3(0, 1, 0);
function usePlanetUniforms() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uT: { value: 0 }, uIce: { value: 0 }, uNight: { value: 0 }, uAge: { value: -100 },
    uImpact: { value: world.impact }, uSun: { value: new THREE.Vector3(-.6, .75, 1).normalize() },
  }), []);
  useFrame(() => {
    // R3F copies uniform prop objects. Animate the material's actual GPU uniforms.
    if (!material.current) return;
    const u = material.current.uniforms;
    u.uT.value = world.time; u.uIce.value = world.ice;
    u.uNight.value = world.night; u.uAge.value = world.strikes > 0 ? world.time - world.meteorAt : -100;
    u.uImpact.value.copy(world.impact);
    u.uSun.value.set(-.7 + world.night * 1.4, .65 - world.night * .4, .9 - world.night * 1.2).normalize();
  });
  return [uniforms, material] as const;
}
function Terrain() {
  const g = useMemo(makeTerrain, []); const [uniforms, material] = usePlanetUniforms();
  return <mesh name="terrain" geometry={g} castShadow receiveShadow><shaderMaterial ref={material} uniforms={uniforms} vertexShader={terrainVert} fragmentShader={terrainFrag} /></mesh>;
}
function Ocean() {
  const [uniforms, material] = usePlanetUniforms();
  return <mesh name="ocean"><icosahedronGeometry args={[1.625, 22]} /><shaderMaterial ref={material} uniforms={uniforms} vertexShader={oceanVert} fragmentShader={oceanFrag} /></mesh>;
}
function Forest() {
  const data = useMemo(() => sampleLand(230, 74), []);
  const trunks = useRef<THREE.InstancedMesh>(null); const foliage = useRef<THREE.InstancedMesh>(null); const tips = useRef<THREE.InstancedMesh>(null);
  const foliageMat = useRef<THREE.MeshStandardMaterial>(null); const tipMat = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const color = new THREE.Color(); data.forEach((d, i) => {
      color.setHSL(.34 + d.phase * .12, .62 + d.phase * .24, .13 + d.phase * .12);
      foliage.current!.setColorAt(i, color); tips.current!.setColorAt(i, color.clone().multiplyScalar(1.16));
    });
  }, [data]);
  useFrame(() => {
    if (!trunks.current || !foliage.current || !tips.current) return;
    const age = world.time - world.meteorAt;
    data.forEach((d, i) => {
      let grow = i < 150 ? .85 + world.spring * .15 : Math.max(.001, world.spring - .2) * 1.25;
      if (world.strikes > 0 && age > .92 && d.n.dot(world.impact) > .965) grow *= .025;
      const h = (.18 + d.size * .11) * grow; const r = .067 * d.size * grow;
      dummy.quaternion.setFromUnitVectors(UP, d.n);
      dummy.position.copy(d.n).multiplyScalar(d.r + h * .20); dummy.scale.set(r * .20, h * .45, r * .20); dummy.updateMatrix(); trunks.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.copy(d.n).multiplyScalar(d.r + h * .53); dummy.scale.set(r, h * .74, r); dummy.updateMatrix(); foliage.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.copy(d.n).multiplyScalar(d.r + h * .82); dummy.scale.set(r * .68, h * .65, r * .68); dummy.updateMatrix(); tips.current!.setMatrixAt(i, dummy.matrix);
    });
    [trunks, foliage, tips].forEach(ref => { ref.current!.instanceMatrix.needsUpdate = true; });
    foliageMat.current!.emissiveIntensity = .04 + world.night * .9 + world.spring * .09;
    tipMat.current!.emissiveIntensity = .06 + world.night * 1.3 + world.spring * .15;
    foliageMat.current!.color.setRGB(1 - world.ice * .34, 1, 1);
  });
  return <group>
    <instancedMesh ref={trunks} args={[undefined, undefined, data.length]} frustumCulled={false} castShadow><cylinderGeometry args={[1, 1.25, 1, 5]} /><meshStandardMaterial color="#65513b" roughness={.9} /></instancedMesh>
    <instancedMesh ref={foliage} args={[undefined, undefined, data.length]} frustumCulled={false} castShadow><coneGeometry args={[1, 1, 5]} /><meshStandardMaterial ref={foliageMat} color="white" emissive="#164d3a" roughness={.8} /></instancedMesh>
    <instancedMesh ref={tips} args={[undefined, undefined, data.length]} frustumCulled={false} castShadow><coneGeometry args={[1, 1, 5]} /><meshStandardMaterial ref={tipMat} color="white" emissive="#297559" roughness={.7} /></instancedMesh>
  </group>;
}
function FlowersAndFireflies() {
  const data = useMemo(() => sampleLand(160, 914, .025, .21), []);
  const mesh = useRef<THREE.InstancedMesh>(null); const glow = useRef<THREE.MeshBasicMaterial>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => { data.forEach((p, i) => mesh.current!.setColorAt(i, new THREE.Color(i % 3 === 0 ? '#ff9cb0' : i % 3 === 1 ? '#c1f7a1' : '#e7bbff').multiplyScalar(1.7))); }, [data]);
  useFrame(() => {
    data.forEach((p, i) => {
      const floating = i > 90;
      const up = floating ? .15 + Math.sin(world.time * .9 + p.phase * 90) * .065 : .028;
      d.position.copy(p.n).multiplyScalar(p.r + up);
      const size = (.008 + p.size * .009) * world.spring * (floating ? .55 + world.night * .65 : 1);
      const burnt = world.strikes > 0 && world.time - world.meteorAt > .92 && p.n.dot(world.impact) > .968;
      d.scale.setScalar(burnt ? .0001 : size); d.updateMatrix(); mesh.current!.setMatrixAt(i, d.matrix);
    }); mesh.current!.instanceMatrix.needsUpdate = true;
    glow.current!.opacity = .45 + world.spring * .55;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, data.length]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={glow} transparent toneMapped={false} /></instancedMesh>;
}
function TinyTown() {
  const places = useMemo(() => sampleLand(30, 316, .022, .09), []);
  const windows = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => { if (windows.current) windows.current.emissiveIntensity = .4 + world.night * 3.0; });
  const windowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffe1a4', emissive: '#ffc56b', emissiveIntensity: .5, roughness: .4 }), []);
  useFrame(() => { windowMat.emissiveIntensity = .5 + world.night * 3; });
  return <group>{places.map((p, i) => <group key={i} position={p.n.clone().multiplyScalar(p.r).toArray()} quaternion={new THREE.Quaternion().setFromUnitVectors(UP, p.n)} scale={p.size}>
    <mesh position={[0, .045, 0]} castShadow><boxGeometry args={[.07, .09, .065]} /><meshStandardMaterial color={i % 3 ? '#e0d0a0' : '#7aab9d'} roughness={.8} /></mesh>
    <mesh position={[0, .11, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[.068, .055, 4]} /><meshStandardMaterial color={i % 4 ? '#b26542' : '#507773'} roughness={.7} /></mesh>
    <mesh position={[0, .052, .034]} material={windowMat}><boxGeometry args={[.018, .027, .003]} /></mesh>
    <mesh position={[.036, .052, 0]} material={windowMat}><boxGeometry args={[.003, .027, .018]} /></mesh>
  </group>)}</group>;
}
function Clouds() {
  const group = useRef<THREE.Group>(null);
  const data = useMemo(() => {
    const rng = seeded(8); return Array.from({ length: 25 }, (_, i) => {
      const a = i / 25 * Math.PI * 2;
      return { x: Math.sin(a) * 1.9, z: Math.cos(a) * 1.9, y: .52 + Math.sin(a * 3) * .3, size: .06 + rng() * .08 };
    });
  }, []);
  useFrame(() => { group.current!.rotation.y = world.time * .025; });
  return <group ref={group}>{data.map((p, i) => <group key={i} position={[p.x, p.y, p.z]}>
    {[0, 1, 2].map(j => <mesh key={j} position={[(j - 1) * p.size, Math.sin(j * 2) * .025, 0]} scale={[1.3, .65, .75]}><icosahedronGeometry args={[p.size * (j === 1 ? 1.3 : 1), 2]} /><meshStandardMaterial color="#d6e7d8" emissive="#576a62" emissiveIntensity={.12} roughness={1} /></mesh>)}
  </group>)}</group>;
}
function Aurora() {
  const uniforms = useMemo(() => ({ uT: { value: 0 }, uPower: { value: 0 } }), []);
  const north = useRef<THREE.ShaderMaterial>(null); const south = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => { [north, south].forEach(ref => { if (ref.current) { ref.current.uniforms.uT.value = world.time; ref.current.uniforms.uPower.value = world.ice * 1.1 + world.spring * .13; } }); });
  return <group>
    <mesh name="aurora" position={[0, 1.67, 0]}><cylinderGeometry args={[.60, 1.12, .70, 120, 8, true]} /><shaderMaterial ref={north} uniforms={uniforms} vertexShader={auroraVert} fragmentShader={auroraFrag} side={THREE.DoubleSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
    <mesh position={[0, -1.72, 0]} rotation={[Math.PI, 0, 0]}><cylinderGeometry args={[.45, .87, .55, 96, 6, true]} /><shaderMaterial ref={south} uniforms={uniforms} vertexShader={auroraVert} fragmentShader={auroraFrag} side={THREE.DoubleSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
  </group>;
}

const brassProps = { color: '#c5994e', metalness: .8, roughness: .28 };
function Engine({ carriage = false }: { carriage?: boolean }) {
  const headlight = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { if (headlight.current) headlight.current.opacity = world.night * .17; });
  return <group>
    <mesh position={[0, .035, 0]} castShadow><boxGeometry args={[.16, .07, .29]} /><meshStandardMaterial color="#254b4b" metalness={.45} roughness={.4} /></mesh>
    <mesh position={[0, .045, 0]}><boxGeometry args={[.17, .018, .31]} /><meshStandardMaterial {...brassProps} /></mesh>
    {carriage ? <>
      <mesh position={[0, .13, 0]} castShadow><boxGeometry args={[.145, .16, .25]} /><meshStandardMaterial color="#bdc1a0" roughness={.5} /></mesh>
      <mesh position={[0, .225, 0]}><boxGeometry args={[.18, .035, .30]} /><meshStandardMaterial color="#34575a" metalness={.4} roughness={.35} /></mesh>
      {[-1, 1].map(s => [-.075, .025, .10].map(z => <mesh key={`${s}-${z}`} position={[s * .074, .14, z]}><boxGeometry args={[.006, .055, .048]} /><meshStandardMaterial color="#ffdda1" emissive="#ffd07a" emissiveIntensity={2} /></mesh>))}
    </> : <>
      <mesh position={[0, .12, .055]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.067, .067, .20, 12]} /><meshStandardMaterial color="#2f5b58" metalness={.55} roughness={.3} /></mesh>
      <mesh position={[0, .15, -.10]} castShadow><boxGeometry args={[.17, .19, .12]} /><meshStandardMaterial color="#b89756" metalness={.7} roughness={.3} /></mesh>
      <mesh position={[0, .26, -.10]}><boxGeometry args={[.20, .026, .16]} /><meshStandardMaterial color="#244e4d" metalness={.5} roughness={.3} /></mesh>
      <mesh position={[0, .21, .09]}><cylinderGeometry args={[.033, .022, .15, 10]} /><meshStandardMaterial {...brassProps} /></mesh>
      <mesh position={[0, .15, .167]}><sphereGeometry args={[.033, 12, 8]} /><meshBasicMaterial color={[3.2, 2.3, .9]} toneMapped={false} /></mesh>
      <mesh position={[0, .145, .55]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.18, .7, 18, 1, true]} /><meshBasicMaterial ref={headlight} color="#ffe6a0" side={THREE.DoubleSide} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * .086, .19, -.08]}><boxGeometry args={[.008, .06, .055]} /><meshStandardMaterial color="#ffdd9e" emissive="#ffc26c" emissiveIntensity={2} /></mesh>)}
    </>}
    {[-1, 1].map(s => [-.1, .09].map(z => <mesh key={`${s}-${z}`} position={[s * .085, .015, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.043, .043, .025, 12]} /><meshStandardMaterial color="#283636" metalness={.65} roughness={.3} /></mesh>))}
  </group>;
}
function Train() {
  const group = useRef<THREE.Group>(null); const cars = useRef<(THREE.Group | null)[]>([]);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dce1c5', roughness: 1, transparent: true, opacity: .63, depthWrite: false }), []);
  const sleepers = useMemo(() => Array.from({ length: 120 }, (_, i) => i * Math.PI / 60), []);
  useFrame(() => {
    cars.current.forEach((car, i) => {
      if (!car) return; const a = world.trainAngle - i * .205;
      car.position.set(Math.sin(a) * 1.98, -.24, Math.cos(a) * 1.98); car.rotation.y = a + Math.PI / 2;
    });
    puffs.current.forEach((puff, i) => {
      if (!puff) return; const age = ((world.time * .7 + i / 10) % 1); const a = world.trainAngle - age * .28;
      puff.position.set(Math.sin(a) * 1.98, .04 + age * .38, Math.cos(a) * 1.98);
      puff.scale.setScalar(.026 + age * .07);
    });
  });
  return <group ref={group}>
    {[1.92, 2.035].map(r => <mesh key={r} rotation={[Math.PI / 2, 0, 0]} position={[0, -.25, 0]}><torusGeometry args={[r, .014, 6, 180]} /><meshStandardMaterial color="#d2a969" metalness={.9} roughness={.27} /></mesh>)}
    {sleepers.map((a, i) => <mesh key={i} position={[Math.sin(a) * 1.98, -.273, Math.cos(a) * 1.98]} rotation={[0, a, 0]}><boxGeometry args={[.045, .024, .17]} /><meshStandardMaterial color="#414d3d" metalness={.35} roughness={.75} /></mesh>)}
    {[0, 1, 2].map(i => <group key={i} ref={el => { cars.current[i] = el; }}><Engine carriage={i > 0} /></group>)}
    {Array.from({ length: 10 }, (_, i) => <mesh ref={el => { puffs.current[i] = el; }} key={i} material={mat}><icosahedronGeometry args={[1, 1]} /></mesh>)}
  </group>;
}
function Meteor() {
  const flying = useRef<THREE.Group>(null); const sparks = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const path = useMemo(() => new THREE.Vector3(2.1, 3.8, 1.1), []);
  const particles = useMemo(() => { const rng = seeded(19); return Array.from({ length: 65 }, () => ({ v: new THREE.Vector3(rng() - .5, rng() * .9, rng() - .5).normalize().multiplyScalar(.45 + rng() * .75), size: .012 + rng() * .026 })); }, []);
  useFrame(() => {
    const age = world.time - world.meteorAt; const impact = world.impact.clone().multiplyScalar(1.73);
    flying.current!.visible = age >= 0 && age < .94;
    const progress = THREE.MathUtils.clamp(age / .94, 0, 1);
    flying.current!.position.copy(impact).addScaledVector(path, 1 - progress);
    flying.current!.quaternion.setFromUnitVectors(UP, path.clone().normalize());
    light.current!.position.copy(flying.current!.position); light.current!.intensity = age >= 0 && age < .94 ? 5 : age >= .94 && age < 3 ? 2 * (1 - (age - .94) / 2.06) : 0;
    sparks.current!.visible = age >= .94 && age < 4;
    const t = Math.max(0, age - .94);
    particles.forEach((p, i) => {
      temp.position.copy(impact).addScaledVector(p.v, t).addScaledVector(world.impact, .20 * t - .12 * t * t);
      temp.scale.setScalar(p.size * Math.max(0, 1 - t / 3)); temp.updateMatrix(); sparks.current!.setMatrixAt(i, temp.matrix);
    }); sparks.current!.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <group ref={flying}>
      <mesh><icosahedronGeometry args={[.14, 1]} /><meshStandardMaterial color="#301e13" emissive="#ff5216" emissiveIntensity={2} roughness={.8} /></mesh>
      <mesh position={[0, .45, 0]}><coneGeometry args={[.145, .95, 12]} /><meshBasicMaterial color={[3.7, .65, .045]} transparent opacity={.82} toneMapped={false} /></mesh>
      <mesh position={[0, .31, .01]}><coneGeometry args={[.095, .70, 9]} /><meshBasicMaterial color={[4, 2.5, .15]} toneMapped={false} /></mesh>
      <mesh position={[0, .63, -.01]}><coneGeometry args={[.20, 1.3, 10]} /><meshBasicMaterial color="#fc5e19" transparent opacity={.21} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
    </group>
    <pointLight ref={light} color="#ff641f" intensity={0} distance={5} decay={2} />
    <instancedMesh ref={sparks} args={[undefined, undefined, particles.length]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color={[4, 1.15, .08]} toneMapped={false} /></instancedMesh>
  </group>;
}
export function Planet() {
  const group = useRef<THREE.Group>(null);
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 5 || world.dragging) return;
    actions.meteor(group.current!.worldToLocal(event.point.clone()).normalize());
  };
  return <group ref={group} onClick={onClick}>
    <Terrain /><Ocean /><Forest /><FlowersAndFireflies /><TinyTown /><Clouds /><Aurora /><Train /><Meteor />
  </group>;
}
