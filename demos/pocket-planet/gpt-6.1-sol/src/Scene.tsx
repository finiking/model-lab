import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, FXAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Enclosure, Pedestal } from './Enclosure';
import { Planet } from './Planet';
import { advance, seeded, world } from './world';

function Lighting() {
  const { gl, scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const daylight = useMemo(() => new THREE.Color('#ffe0a7'), []);
  const sunset = useMemo(() => new THREE.Color('#f7924b'), []);
  const moonlight = useMemo(() => new THREE.Color('#83b4d4'), []);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl); const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, .025);
    scene.environment = env.texture; scene.environmentIntensity = .55;
    room.dispose(); pmrem.dispose();
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);
  useFrame(() => {
    sun.current!.intensity = 1.8 - world.night * 1.35;
    sun.current!.position.set(-4 + world.night * 8, 6 - world.night * 4, 5 - world.night * 8);
    if (world.night < .5) sun.current!.color.lerpColors(daylight, sunset, world.night * 2);
    else sun.current!.color.lerpColors(sunset, moonlight, (world.night - .5) * 2);
    fill.current!.intensity = .65 + world.night * .35;
    ambient.current!.intensity = .36 - world.night * .16;
    scene.environmentIntensity = .55 - world.night * .22;
  });
  return <>
    <ambientLight ref={ambient} intensity={.35} color="#9fc8cf" />
    <directionalLight ref={sun} position={[-4, 6, 5]} intensity={3.3} color="#ffdda4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-normalBias={.025} />
    <directionalLight ref={fill} position={[4, 2, -3]} intensity={.65} color="#7fcbd5" />
    <pointLight position={[-3, -1.3, 3]} intensity={6} color="#f0a74f" distance={9} />
    <pointLight position={[3, 3, -2]} intensity={9} color="#72b9c7" distance={9} />
  </>;
}
function Observatory() {
  const positions = useMemo(() => {
    const rng = seeded(160); const p = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { p[i * 3] = (rng() - .5) * 35; p[i * 3 + 1] = (rng() - .25) * 20; p[i * 3 + 2] = -6 - rng() * 12; }
    return p;
  }, []);
  return <>
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#93b5b4" size={.018} transparent opacity={.48} sizeAttenuation /></points>
    <mesh position={[0, -3.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshBasicMaterial color="#07131e" /></mesh>
    <mesh position={[0, -3.19, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[16, 16]} /><shadowMaterial transparent opacity={.22} depthWrite={false} /></mesh>
    {[1.55, 1.7, 2.65, 3.0].map((r, i) => <mesh key={r} position={[0, -3.188, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r, r + (i === 2 ? .008 : .004), 160]} /><meshBasicMaterial color="#bba071" transparent opacity={i === 2 ? .12 : .07} depthWrite={false} /></mesh>)}
    {Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 2; return <mesh key={i} position={[Math.sin(a) * 2.84, -3.18, Math.cos(a) * 2.84]} rotation={[-Math.PI / 2, 0, -a]}><planeGeometry args={[.007, i % 4 === 0 ? .12 : .045]} /><meshBasicMaterial color="#ad946b" transparent opacity={.14} /></mesh>; })}
  </>;
}
function World() {
  const root = useRef<THREE.Group>(null); const { camera, size, scene } = useThree();
  useEffect(() => {
    window.__planet.renderMetrics = () => {
      const result: Record<string, unknown> = {};
      scene.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial && object.name) {
          result[object.name] = Object.fromEntries(Object.entries(object.material.uniforms).map(([key, uniform]) => [key, typeof uniform.value === 'number' ? uniform.value : 'vector']));
        }
      }); return result;
    };
  }, [scene]);
  useFrame((_, delta) => {
    advance(Math.min(delta, .05));
    root.current!.rotation.y = -.06 + world.rotation + Math.sin(world.time * .06) * .055;
    root.current!.rotation.x = world.tilt;
    const distance = size.width < 820 ? 17 : 9.6;
    camera.position.set(0, distance * .16, distance / world.zoom);
    camera.lookAt(0, -.19, 0);
    world.ready = true;
  }, -10);
  return <>
    <Lighting /><Observatory />
    <group scale={.88} position={[0, .13, 0]}><Pedestal /><group ref={root}><Planet /><Enclosure /></group></group>
    <EffectComposer multisampling={0} enableNormalPass={false} mergeMode="none">
      <Bloom intensity={.40} luminanceThreshold={1.05} luminanceSmoothing={.45} mipmapBlur />
      <DepthOfField target={[0, 0, .65]} focalLength={.12} bokehScale={.20} height={405} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <FXAA />
      <Vignette eskil={false} offset={.22} darkness={.48} />
    </EffectComposer>
  </>;
}
export function Scene() {
  const pointer = useRef({ x: 0, y: 0, down: false, distance: 0 });
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current!;
    const wheel = (event: WheelEvent) => { event.preventDefault(); world.zoom = THREE.MathUtils.clamp(world.zoom - event.deltaY * .0005, .78, 1.22); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  return <div ref={viewport} className="viewport" aria-label="Interactive brass astrolabe planet. Drag to rotate, scroll to zoom, click the planet to call a meteor."
    onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY, down: true, distance: 0 }; }}
    onPointerMove={event => {
      const p = pointer.current; if (!p.down) return;
      const dx = event.clientX - p.x, dy = event.clientY - p.y;
      p.distance += Math.abs(dx) + Math.abs(dy); world.dragging = p.distance > 5;
      if (world.dragging) { world.rotation += dx * .006; world.tilt = THREE.MathUtils.clamp(world.tilt + dy * .003, -.45, .45); }
      p.x = event.clientX; p.y = event.clientY;
    }}
    onPointerUp={() => { pointer.current.down = false; setTimeout(() => { world.dragging = false; }, 0); }}
    onPointerLeave={() => { pointer.current.down = false; world.dragging = false; }}>
    <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.5]} camera={{ position: [0, 1.5, 9.6], fov: 43, near: .1, far: 90 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl, scene }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; scene.background = new THREE.Color('#07131e'); }}
      fallback={<div className="webgl-fallback">This miniature world needs a browser with WebGL 2 enabled.</div>}>
      <World />
    </Canvas>
  </div>;
}
