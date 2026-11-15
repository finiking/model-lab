import * as T from './vendor/three.module.js';
import { createCombatFx, GALE_RADIUS, quakeRadius } from './combat-fx.js';
import { createHero } from './actors.js';
import { HERO_ACTIONS } from './hero-actions.js';

const poses = [
  ['idle', '持剑'], ['walk', '行走'], ['run', '疾跑'], ['attack', '三连斩'],
  ['gale', '破风斩'], ['quake', '震地击'], ['heal', '饮药'], ['dodge', '闪避']
];

export function inspectMarkup() {
  return `<section class="ar-model" aria-label="角色模型">
    <div class="ar-model-stage">
      <canvas aria-label="角色三维模型，左右拖动或使用方向键旋转" tabindex="0"></canvas>
      <div class="ar-model-caption"><small>THE RANGER</small><span>岚行者</span></div>
      <div class="ar-model-lenses" role="group" aria-label="镜头距离">
        <button type="button" data-lens="full" aria-pressed="true">全身</button><button type="button" data-lens="face" aria-pressed="false">面部</button><button type="button" data-lens="hand" aria-pressed="false">握剑</button>
      </div>
      <small class="ar-model-hint">左右拖动旋转</small>
    </div>
    <div class="ar-model-poses" role="group" aria-label="预览动作">${poses.map(([id, name]) => `<button type="button" data-pose="${id}" aria-pressed="${id === 'idle'}">${name}</button>`).join('')}</div>
    <button type="button" class="ar-p-action ar-p-quiet" data-op="inspect-back">返回属性</button>
  </section>`;
}

// Only create a second WebGL context while this view is open. The field is
// paused and its model, world position and current attack are left in place.
export function mountInspector(host, state) {
  const canvas = host.querySelector('canvas');
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    host.querySelector('.ar-model-hint').textContent = '当前设备无法打开模型预览';
    host.querySelectorAll('[data-lens], [data-pose]').forEach(el => { el.disabled = true; });
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0, 0);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(31, 1, .035, 26);
  const hero = createHero(T);
  const worn = {};
  for (const [slot, id] of Object.entries(state.equipped)) {
    worn[slot] = state.inventory.find(item => item.id === id) || null;
  }
  hero.equip?.(worn);
  const fx = createCombatFx(T, scene, hero, () => 0);
  const groundReach = quakeRadius(Math.max(1, state.skills?.find(s => s.id === 'quake')?.rank || 1));
  scene.add(hero.root, new T.HemisphereLight(0xfff2df, 0x788b85, 1.5));
  const shadowMap = document.createElement('canvas');
  shadowMap.width = shadowMap.height = 96;
  const ink = shadowMap.getContext('2d');
  const shade = ink.createRadialGradient(48,48,0,48,48,48);
  shade.addColorStop(0,'rgba(18,24,21,.55)'); shade.addColorStop(.42,'rgba(18,24,21,.38)'); shade.addColorStop(1,'rgba(18,24,21,0)');
  ink.fillStyle = shade; ink.fillRect(0,0,96,96);
  const shadow = new T.Mesh(new T.PlaneGeometry(1.45, 1), new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowMap),transparent:true,depthWrite:false}));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const lamp = (color, power, x, y, z) => {
    const light = new T.DirectionalLight(color, power);
    light.position.set(x, y, z);
    scene.add(light);
  };
  lamp(0xffdfbc, 2.4, 2.5, 4.5, -4);
  lamp(0xb0dbe3, .85, -3, 2, -1.5);
  lamp(0xe6c089, 2.1, -1.5, 2.7, 3);
  let pose = 'idle', lens = 'full', drag = null;
  const angles = {full:.30, face:.18, hand:2.58};
  let age = 0, time = 0, previous = 0, frame = 0, combo = 0, width = 0, height = 0;
  const moveState = { moving: false, sprint: false, speed: 0, moveForward: 0, moveSide: 0, actionKind: '', actionPhase: 0, comboIndex: 0 };
  const focus = new T.Vector3();
  const swing = { kind: '', phase: 0, contact: 0, comboIndex: 0 };
  let released = false;
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (document.hidden || (previous && now - previous < 30)) return;
    const dt = previous ? Math.min(.066, (now - previous) / 1000) : 1 / 60;
    previous = now; time += dt; age += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    moveState.sprint = pose === 'run';
    moveState.moving = pose === 'walk' || moveState.sprint;
    moveState.speed = moveState.sprint ? 8.2 : moveState.moving ? 4.65 : 0;
    moveState.moveForward = moveState.moving ? 1 : 0;
    const spec = pose === 'attack' ? HERO_ACTIONS.attack[combo] : HERO_ACTIONS[pose];
    moveState.actionKind = spec && age < spec.duration ? pose : '';
    moveState.actionPhase = moveState.actionKind ? age / spec.duration : 0;
    moveState.comboIndex = combo;
    hero.update(dt, moveState, time);
    if (lens === 'full') {
      swing.kind = moveState.actionKind;
      swing.phase = moveState.actionPhase;
      swing.contact = spec?.contact || 0;
      swing.comboIndex = combo;
      if (!released && swing.kind && swing.phase >= swing.contact) {
        released = true;
        fx.release(swing.kind, 0, pose === 'gale' ? GALE_RADIUS : groundReach, worn.weapon);
      }
      fx.update(dt, swing.kind ? swing : null, worn.weapon);
    }
    if (spec && age >= spec.duration + (pose === 'attack' && combo !== 2 ? .06 : .52)) {
      age = 0; released = false;
      if (pose === 'attack') combo = (combo + 1) % 3;
    }
    // Long blades clear the upper edge at the apex and the side edges on a sweep.
    const sweeping = ['attack','gale','quake'].includes(pose);
    focus.set(0, sweeping ? 1.49 : 1.23, sweeping ? -.27 : 0);
    let range = sweeping ? Math.max(6.75, 7.45 / camera.aspect) : Math.max(4.95, 3.85 / camera.aspect);
    const wideCast = lens === 'full' && (pose === 'gale' || pose === 'quake');
    if (wideCast) {
      range = Math.max(8.8, 12.1 / camera.aspect);
      focus.set(0, .94, -.35);
    }
    if (lens === 'face') {
      hero.bones.head.getWorldPosition(focus);
      focus.y += .12;
      range = Math.max(.83, .47 / camera.aspect);
    } else if (lens === 'hand') {
      hero.bones.handR.getWorldPosition(focus); focus.y -= .08;
      range = Math.max(.78, .56 / camera.aspect);
    }
    const yaw = angles[lens];
    camera.position.set(focus.x + Math.sin(yaw) * range, focus.y + range * (wideCast ? .25 : .08), focus.z - Math.cos(yaw) * range);
    camera.lookAt(focus);
    renderer.render(scene, camera);
  }
  host.addEventListener('click', e => {
    const selected = e.target.closest('[data-pose], [data-lens]');
    if (!selected) return;
    const group = selected.hasAttribute('data-pose') ? 'pose' : 'lens';
    for (const b of host.querySelectorAll('[data-' + group + ']')) b.setAttribute('aria-pressed', String(b === selected));
    fx.reset();
    if (group === 'pose') {
      pose = selected.dataset.pose; age = 0; combo = 0; released = false;
    } else {
      lens = selected.dataset.lens;
      const spec = pose === 'attack' ? HERO_ACTIONS.attack[combo] : HERO_ACTIONS[pose];
      released = Boolean(spec && age >= spec.duration * spec.contact);
    }
  });
  const rotate = delta => {
    const next = angles[lens] + delta;
    angles[lens] = lens === 'hand' ? T.MathUtils.clamp(next, -.18, 3.16) : next;
  };
  canvas.addEventListener('pointerdown', e => {
    if (drag || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (drag?.id !== e.pointerId) return;
    rotate((drag.x - e.clientX) * .012); drag.x = e.clientX;
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); rotate(e.key === 'ArrowLeft' ? -.16 : .16);
  });
  draw(performance.now());
  return () => {
    cancelAnimationFrame(frame);
    fx.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
