import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { annulus, brushedTexture, curveGeometry, labelTexture } from './procedural';
import { glassFrag, glassVert } from './shaders';
import { world } from './world';

function Engraving({ text, angle, radius = 2.39 }: { text: string; angle: number; radius?: number }) {
  const texture = useMemo(() => labelTexture(text), [text]);
  return <mesh position={[Math.sin(angle) * radius, Math.cos(angle) * radius, .045]} rotation={[0, 0, -angle]}>
    <planeGeometry args={[.16, .052]} /><meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>;
}
function Gimbal({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => annulus(2.4 + index * .055, index === 0 ? .145 : .105, .047), [index]);
  const brush = useMemo(brushedTexture, []);
  const ticks = useMemo(() => Array.from({ length: 120 }, (_, i) => {
    const a = i / 120 * Math.PI * 2;
    return { a, r: 2.4 + index * .055 + (i % 5 === 0 ? .0 : .024), len: i % 5 === 0 ? .075 : .031 };
  }), [index]);
  useFrame(() => {
    if (!group.current) return;
    if (index === 0) group.current.rotation.set(.11, -.12 + Math.sin(world.time * .1) * .04, -.35 + world.time * .008);
    if (index === 1) group.current.rotation.set(1.20, .27, .18 + world.time * .018);
    if (index === 2) group.current.rotation.set(.25, 1.25 + Math.sin(world.time * .17) * .18, .11);
  });
  return <group ref={group}>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={index === 1 ? '#b99553' : '#a98248'} metalness={.92} roughness={.27} roughnessMap={brush} />
    </mesh>
    <mesh><torusGeometry args={[2.4 + index * .055 - .064, .009, 6, 180]} /><meshStandardMaterial color="#efc878" metalness={.9} roughness={.24} /></mesh>
    {ticks.map(({ a, r, len }, i) => <mesh key={i} position={[Math.sin(a) * r, Math.cos(a) * r, .035]} rotation={[0, 0, -a]}>
      <boxGeometry args={[i % 5 === 0 ? .008 : .004, len, .003]} /><meshStandardMaterial color="#44331e" metalness={.65} roughness={.48} />
    </mesh>)}
    {index === 0 && Array.from({ length: 12 }, (_, i) => <Engraving key={i} text={i % 3 === 0 ? ['N', 'E', 'S', 'W'][i / 3] : String(i * 30)} angle={i * Math.PI / 6} radius={2.4} />)}
    {[-1, 1].map(s => <group key={s} position={[s * 2.43, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh><cylinderGeometry args={[.10, .10, .13, 24]} /><meshStandardMaterial color="#c09c58" metalness={.92} roughness={.23} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.09, .018, 8, 24]} /><meshStandardMaterial color="#3b3428" metalness={.8} roughness={.3} /></mesh>
    </group>)}
  </group>;
}
export function Enclosure() {
  const highlights = useMemo(() => {
    const arc = (phase: number, start: number, end: number) => Array.from({ length: 40 }, (_, i) => {
      const a = start + (end - start) * i / 39;
      return new THREE.Vector3(Math.sin(a) * Math.cos(phase), Math.cos(a), Math.sin(a) * Math.sin(phase)).multiplyScalar(2.235);
    });
    return [curveGeometry(arc(2.0, .42, 1.05), .012), curveGeometry(arc(.85, 2.12, 2.52), .006)];
  }, []);
  return <group>
    {[0, 1, 2].map(i => <Gimbal index={i} key={i} />)}
    <mesh renderOrder={4}>
      <sphereGeometry args={[2.23, 96, 64]} /><shaderMaterial vertexShader={glassVert} fragmentShader={glassFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
    {highlights.map((g, i) => <mesh geometry={g} key={i} renderOrder={5}><meshBasicMaterial color={i ? '#c4e0de' : '#fff2ce'} transparent opacity={i ? .25 : .42} depthWrite={false} /></mesh>)}
    <group position={[0, 2.54, 0]}>
      <mesh><sphereGeometry args={[.13, 24, 16]} /><meshStandardMaterial color="#bc9351" metalness={.95} roughness={.23} /></mesh>
      <mesh position={[0, .1, 0]}><cylinderGeometry args={[.12, .12, .12, 24]} /><meshStandardMaterial color="#9f773f" metalness={.9} roughness={.32} /></mesh>
      <mesh position={[0, .19, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.105, .025, 8, 32]} /><meshStandardMaterial color="#d2ad67" metalness={.95} roughness={.23} /></mesh>
    </group>
  </group>;
}
export function Pedestal() {
  const plaque = useMemo(() => labelTexture('V I V A R I U M   ·   0 0 4', '#e9cd93', 24), []);
  const arms = useMemo(() => [-1, 1].map(s => curveGeometry([
    new THREE.Vector3(s * .4, -2.65, -.1), new THREE.Vector3(s * 1.25, -2.25, -.05),
    new THREE.Vector3(s * 2.30, -1.0, 0), new THREE.Vector3(s * 2.5, -.05, 0),
  ], .045)), []);
  return <group>
    {arms.map((g, i) => <mesh key={i} geometry={g} castShadow><meshStandardMaterial color="#98713b" metalness={.95} roughness={.28} /></mesh>)}
    <mesh position={[0, -2.64, 0]} castShadow><cylinderGeometry args={[.20, .42, .48, 64]} /><meshStandardMaterial color="#b28b4a" metalness={.93} roughness={.26} /></mesh>
    <mesh position={[0, -2.86, 0]} castShadow><cylinderGeometry args={[.85, 1.0, .14, 96]} /><meshStandardMaterial color="#c9a362" metalness={.9} roughness={.25} /></mesh>
    <mesh position={[0, -2.98, 0]} castShadow><cylinderGeometry args={[1.0, 1.0, .15, 96]} /><meshStandardMaterial color="#11272b" metalness={.75} roughness={.25} /></mesh>
    {[-2.9, -3.06].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.005, .022, 8, 96]} /><meshStandardMaterial color="#d0aa69" metalness={.95} roughness={.25} /></mesh>)}
    <mesh position={[0, -2.98, 1.006]}><planeGeometry args={[.77, .15]} /><meshBasicMaterial map={plaque} transparent /></mesh>
    {Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2; return <mesh key={i} position={[Math.sin(a) * .99, -2.99, Math.cos(a) * .99]} rotation={[0, a, 0]}><boxGeometry args={[.008, .065, .012]} /><meshStandardMaterial color="#a17d46" metalness={.9} roughness={.3} /></mesh>; })}
    <mesh position={[0, -3.12, 0]}><cylinderGeometry args={[1.08, 1.16, .08, 96]} /><meshStandardMaterial color="#08191e" metalness={.55} roughness={.3} /></mesh>
  </group>;
}
