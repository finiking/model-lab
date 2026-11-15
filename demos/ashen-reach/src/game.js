import * as THREE from './vendor/three.module.js';
import { HERO_ACTIONS } from './hero-actions.js';
import { createCombatFx, GALE_RADIUS, quakeRadius } from './combat-fx.js';
import { createWorld } from './world.js';
import { createHero, createMonster } from './actors.js';

const SAVE_KEY = 'ashen-reach.adventure.v1';
const HOME = { x: 0, z: 16 };
const SHRINE = { x: 30, z: -14 };
const clamp = THREE.MathUtils.clamp;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const expGoal = level => 48 + (level - 1) * 34;

const skillBook = [
  { id: 'gale', name: '破风斩', description: '以剑风横扫身边的敌人。每级提高伤害，并缩短冷却。', maxRank: 3, requiredLevel: 1 },
  { id: 'quake', name: '震地击', description: '主动技能〔4〕。震击地面，对周围敌人造成伤害并使其短暂失衡。消耗 26 点耐力。', maxRank: 2, requiredLevel: 2 },
  { id: 'edge', name: '锋刃精通', description: '被动技能。每级使所有剑击的攻击力提高 4 点。', maxRank: 3, requiredLevel: 2 },
  { id: 'renew', name: '复苏之息', description: '被动技能。脱离战斗 6 秒后，每秒恢复 2 点生命，逐级提升。', maxRank: 3, requiredLevel: 2 },
];

const item = (id, name, slot, rarity, description, attack = 0, defense = 0, hp = 0) =>
  ({ id, name, slot, rarity, description, attack, defense, hp });
const blade = item('first-blade', '巡林短剑', 'weapon', '普通', '篝火旁磨亮的旧剑，刃口仍然锋利。', 4);
const coat = item('first-coat', '行者披风', 'armor', '普通', '缝着山道纹章的旅行披风。', 0, 2);
const lootTable = [
  item('', '守望者长剑', 'weapon', '精良', '古驿守卫留下的佩剑，握柄上仍绕着麻绳。', 9),
  item('', '苔纹胸甲', 'armor', '精良', '石甲裂隙间长出新苔，穿戴时依然轻盈。', 0, 5, 8),
  item('', '余火护符', 'charm', '稀有', '余烬在符石内部缓缓搏动。', 3, 1, 12),
  item('', '风蚀重刃', 'weapon', '稀有', '风蚀岩脊锻成的宽刃，剑锋刻着失传的祝词。', 15),
  item('', '苍岚肩铠', 'armor', '稀有', '旧骑士的护肩，银面倒映群山。', 0, 8, 16),
];
const crown = item('', '断冠之誓', 'charm', '史诗', '遗迹之王最后一块冠石，留存着群山的力量。', 8, 5, 24);

const camps = [
  ['trail1', 1.15, 6, 1], ['trail2', -6, -2, 1], ['trail3', 6, -9, 1],
  ['west1', -15, -8, 2], ['east1', 18, -9, 2], ['east2', 29, -19, 2],
  ['gate1', 3, -32, 3], ['west2', -20, -24, 3], ['boss', -28, -35, 4],
];
const definitions = camps.map(([id, x, z, level]) => {
  const boss = id === 'boss', elite = level === 3;
  return { id, x, z, level, boss, elite: boss || elite,
    kind: boss ? 'boss' : elite ? 'elite' : 'sentinel',
    name: boss ? '断冠守望者' : elite ? '古岩禁卫' : level === 2 ? '山脊石卫' : '苔岩守卫',
    maxHp: boss ? 310 : 30 + level * 11,
    damage: boss ? 26 : 5 + level * 3, reward: boss ? 175 : 46 + level * 8 };
});

function freshProfile() {
  return { version: 1, level: 1, xp: 0, hp: 110, stamina: 100, x: HOME.x, z: HOME.z,
    yaw: 0, view: 0, statPoints: 0, skillPoints: 0, stats: { strength: 1, vitality: 1, agility: 1 },
    ranks: { gale: 1, quake: 0, edge: 0, renew: 0 }, inventory: [{ ...blade }, { ...coat }],
    equipped: { weapon: blade.id, armor: coat.id, charm: null }, kills: 0, potions: 3, serial: 0,
    shrine: false, bossDefeated: false, victory: false, drops: [], fallen: {}, audio: true, savedAt: 0 };
}

function readSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (raw?.version !== 1 || !Number.isFinite(raw.x) || !Array.isArray(raw.inventory)) return freshProfile();
    const base = freshProfile();
    return { ...base, ...raw, stats: { ...base.stats, ...raw.stats }, ranks: { ...base.ranks, ...raw.ranks },
      equipped: { ...base.equipped, ...raw.equipped }, drops: Array.isArray(raw.drops) ? raw.drops : [] };
  } catch { return freshProfile(); }
}

function derived(p) {
  const worn = p.inventory.filter(it => p.equipped[it.slot] === it.id);
  const bonus = key => worn.reduce((n, it) => n + (it[key] || 0), 0);
  return { maxHp: 95 + p.stats.vitality * 15 + (p.level - 1) * 5 + bonus('hp'),
    maxStamina: 95 + p.stats.agility * 5, attack: 8 + p.stats.strength * 3 + p.ranks.edge * 4 + bonus('attack'),
    defense: p.stats.vitality + bonus('defense') };
}

function questLog(p) {
  return [
    { title: '山道上的异动', description: '击败 3 名遗迹守卫', current: Math.min(3, p.kills), total: 3, done: p.kills >= 3 },
    { title: '古老的回响', description: '前往东侧的回声祭坛', current: +p.shrine, total: 1, done: p.shrine },
    { title: '断冠之誓', description: '在西北遗迹击败断冠守望者', current: +p.bossDefeated, total: 1, done: p.bossDefeated },
  ];
}

function getRegion(p) {
  if (p.x < -15 && p.z < -20) return '灰冠遗迹';
  if (p.x > 17 && p.z < 2) return '回声祭坛';
  if (p.z < -26) return '古道关隘';
  if (p.x < -12) return '雾松林地';
  return '苍岚古道';
}

function contactShadow(radius) {
  const shadow = new THREE.Group();
  const radii = [1, .76, .48], opacities = [.045, .08, .13];
  radii.forEach((r, i) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius * r, 24),
      new THREE.MeshBasicMaterial({ color: 0x23271e, transparent: true, opacity: opacities[i], depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = .034 + i * .004;
    mesh.scale.y = .69;
    shadow.add(mesh);
  });
  return shadow;
}

export function startGame(canvas, { onFrame = () => {}, onEvent = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const world = createWorld(THREE, scene);
  const camera = new THREE.PerspectiveCamera(50, 1, .12, 420);
  const hero = createHero(THREE);
  scene.add(hero.root);
  const combatFx = createCombatFx(THREE, scene, hero, world.height);
  const hitPoint = new THREE.Vector3(), hitDirection = new THREE.Vector3();
  const shadow = contactShadow(.8);
  scene.add(shadow);

  let p = readSave();
  let liveStats = derived(p);
  let active = false, paused = false, disposed = false, time = 0, previous = 0;
  let view = p.view || 0, tilt = .14, zoom = 7.7, invuln = 0;
  let inCombat = 0, lastCombo = -1, comboUntil = 0, shake = 0;
  let performing = null, buffered = '';
  let heroMotion = { moving: false, sprint: false, speed: 0, moveForward: 0, moveSide: 0 };
  let nextDisplay = 0, saveTimer = 0, dirty = false, pausedDraw = true;
  let sampleStart = null, frameIntervals = 0, frameMs = null;
  let drag = null, width = 0, height = 0, moveInput = { x: 0, y: 0 };
  let actionCooldown = { attack: 0, skill: 0, quake: 0, dodge: 0, potion: 0 };
  const keys = new Set(), effects = [], groundLoot = new Map();
  const runVelocity = new THREE.Vector2();
  const wishPos = new THREE.Vector3(), look = new THREE.Vector3(), projected = new THREE.Vector3();
  const monsters = definitions.map(def => {
    const model = createMonster(THREE, def.kind);
    const footprint = contactShadow(def.boss ? 1.65 : 1.12);
    scene.add(model.root, footprint);
    return { ...def, model, footprint, homeX: def.x, homeZ: def.z, hp: def.maxHp, yaw: Math.PI,
      wind: 0, stagger: 0, delay: .4, strike: 0, hit: 0, death: 0, moving: false, aggro: false };
  });
  const emit = (type, text, extra = {}) => onEvent({ type, text, ...extra });
  function save(announce = false) {
    p.view = view; p.savedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(p)); dirty = false;
      if (announce) { sound('save'); emit('toast', '冒险进度已保存'); }
    } catch { if (announce) emit('toast', '浏览器无法保存当前进度'); }
  }
  const cues = { sword: 'attack', impact: 'hit', skill: 'skill', pickup: 'loot', level: 'levelup', hurt: 'hurt', dodge: 'dodge', heal: 'heal' };
  function sound(kind, variant) { onEvent({ type: 'sound', name: cues[kind] || kind, variant }); }
  function syncEquipment() {
    liveStats = derived(p);
    p.hp = Math.min(liveStats.maxHp, p.hp); p.stamina = Math.min(liveStats.maxStamina, p.stamina);
    const worn = {};
    for (const slot of ['weapon', 'armor', 'charm']) worn[slot] = p.inventory.find(it => it.id === p.equipped[slot]) || null;
    hero.equip?.(worn);
  }
  function resetMonster(m) {
    m.x = m.homeX; m.z = m.homeZ; m.hp = m.maxHp; m.yaw = Math.PI; m.wind = 0; m.stagger = 0;
    m.delay = .6; m.strike = 0; m.death = 0; m.hit = 0; m.moving = false; m.aggro = false;
    m.model.root.visible = m.footprint.visible = true;
  }
  function restoreField() {
    syncEquipment();
    for (const m of monsters) {
      resetMonster(m);
      if ((m.boss && p.bossDefeated) || p.fallen[m.id] > Date.now()) {
        m.hp = 0; m.death = 1; m.model.root.visible = m.footprint.visible = false;
      }
    }
    for (const g of groundLoot.values()) removeLootMesh(g);
    groundLoot.clear();
    for (const drop of p.drops) addLootMesh(drop);
  }
  function addLootMesh(drop) {
    const group = new THREE.Group();
    const gold = drop.item.rarity === '史诗' ? 0xe4a7ff : drop.item.rarity === '稀有' ? 0x92eaf0 : 0xffda80;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.21), new THREE.MeshBasicMaterial({ color: gold }));
    core.position.y = .42; core.scale.y = 1.32; group.add(core);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.028, .10, 1.25, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = .67; group.add(beam);
    group.position.set(drop.x, world.height(drop.x, drop.z), drop.z);
    scene.add(group); groundLoot.set(drop.id, group);
  }
  function removeLootMesh(g) {
    scene.remove(g);
    g.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  function nearestLoot() {
    let result, best = 3.4;
    for (const drop of p.drops) {
      const d = dist(p, drop);
      if (d < best) { result = drop; best = d; }
    }
    return result;
  }
  function place(entity, x, z) {
    const next = world.constrain(x, z);
    entity.x = next.x; entity.z = next.z;
  }
  function healToFull() { p.hp = liveStats.maxHp; p.stamina = liveStats.maxStamina; }
  function screen(x, y, z) {
    projected.set(x, y, z).project(camera);
    return { x: projected.x * .5 + .5, y: .5 - projected.y * .5, visible: projected.z > -1 && projected.z < 1 };
  }
  function addEffect(mesh, life, update) {
    scene.add(mesh); effects.push({ mesh, life, age: 0, update });
  }
  function flashRing(x, z, color, radius, life = .43) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.87, 1, 36), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, world.height(x, z) + .11, z);
    addEffect(mesh, life, u => { mesh.scale.setScalar(radius * (.23 + .77 * u)); mesh.material.opacity = .74 * (1 - u); });
  }
  function gainXp(amount) {
    p.xp += amount;
    while (p.xp >= expGoal(p.level)) {
      p.xp -= expGoal(p.level); p.level++; p.statPoints += 2; p.skillPoints++;
      liveStats = derived(p); healToFull();
      sound('level'); flashRing(p.x, p.z, 0xffe599, 3.8, .7);
      emit('levelup', '升至 ' + p.level + ' 级 · 属性点 +2 · 技能点 +1', { level: p.level });
    }
  }
  function checkVictory() {
    if (!p.victory && questLog(p).every(q => q.done)) {
      p.victory = true;
      emit('victory', '苍岚古道重归宁静', { detail: '已完成全部冒险委托，可继续探索山谷。' });
    }
  }
  function defeat(m) {
    m.hp = 0; m.wind = 0; m.death = .001; m.aggro = false; m.moving = false;
    p.kills++;
    p.fallen[m.id] = Date.now() + 70000;
    if (m.boss) p.bossDefeated = true;
    const template = m.boss ? crown : lootTable[(p.kills - 1) % lootTable.length];
    const it = { ...template, id: 'relic-' + (++p.serial) };
    const drop = { id: it.id, item: it, x: m.x + .24, z: m.z + .38 };
    p.drops.push(drop); addLootMesh(drop);
    if (p.kills % 2 === 0) p.potions++;
    emit('loot', m.name + '倒下 · 经验 +' + m.reward, { item: it.name, xp: m.reward });
    gainXp(m.reward); checkVictory(); save();
  }
  function hurtMonster(m, damage, push, heavy, action) {
    m.hp = Math.max(0, m.hp - damage); m.hit = m.boss && !heavy ? .35 : 1;
    // The crowned guardian can finish its wind-up through light hits.
    if (!m.boss || heavy) {
      m.wind = 0; m.strike = 0; m.delay = Math.max(m.delay, .36);
    }
    m.aggro = true; inCombat = 6;
    const mark = screen(m.x, world.height(m.x, m.z) + (m.boss ? 3.5 : 2.15), m.z);
    if (mark.visible) emit('hit', String(damage), { x: mark.x, y: mark.y, target: 'monster' });
    const d = Math.max(.01, dist(p, m));
    const scale = m.boss ? 1.49 : m.elite ? 1.13 : 1;
    hitDirection.set((m.x - p.x) / d, 0, (m.z - p.z) / d);
    if (hitDirection.lengthSq() < .01) hitDirection.set(Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const floor = world.height(m.x, m.z);
    let height = action.kind === 'quake' ? .65 * scale : 1.46 * scale;
    if (action.kind === 'attack' && p.equipped.weapon && hero.bladeTip) {
      hero.bladeTip.getWorldPosition(hitPoint);
      height = clamp(hitPoint.y - floor, .82 * scale, 1.92 * scale);
    }
    hitPoint.set(m.x, floor + height, m.z).addScaledVector(hitDirection, -.66 * scale);
    combatFx.hit(hitPoint, hitDirection, action.kind, action.comboIndex);
    if (m.hp > 0) place(m, m.x + (m.x - p.x) / d * push, m.z + (m.z - p.z) / d * push);
    else defeat(m);
  }
  function alignToTarget(a) {
    let target = null, score = 5.1;
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const d = dist(p, m);
      const alignment = ((m.x - p.x) * Math.sin(p.yaw) - (m.z - p.z) * Math.cos(p.yaw)) / Math.max(d, .001);
      const priority = d + (1 - alignment) * .6;
      if (priority < score) { score = priority; target = m; }
    }
    if (!target) return;
    const d = dist(p, target);
    p.yaw = Math.atan2(target.x - p.x, p.z - target.z);
    if (a.kind === 'attack' && d > 1.85 && d <= 4.35) a.travel = Math.min(d - 1.85, 1.25);
  }
  function strikeTargets(a) {
    const big = a.kind === 'gale';
    sound(big ? 'skill' : 'sword', !big && a.comboIndex ? 'sword' + (a.comboIndex + 1) : undefined);
    if (big) combatFx.release('gale', p.yaw, GALE_RADIUS, p.equipped.weapon);
    let connected = false;
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const d = dist(p, m), reach = (big ? GALE_RADIUS : 2.9) + (m.boss ? .85 : 0);
      const dot = ((m.x - p.x) * Math.sin(p.yaw) - (m.z - p.z) * Math.cos(p.yaw)) / Math.max(d, .001);
      if (d <= reach && (big || dot > -.13)) {
        const multiplier = big ? 1.72 + p.ranks.gale * .28 : a.comboIndex === 2 ? 1.32 : 1;
        hurtMonster(m, Math.round(liveStats.attack * multiplier), m.boss ? .05 : big ? 1 : .28, big, a);
        shake = Math.max(shake, big ? .12 : a.comboIndex === 2 ? .08 : .048);
        connected = true;
      }
    }
    if (connected) sound('impact');
  }
  function groundImpact(a) {
    const rank = p.ranks.quake;
    shake = .26;
    const radius = quakeRadius(rank);
    combatFx.release('quake', p.yaw, radius, p.equipped.weapon);
    sound('quake');
    for (const m of monsters) {
      if (m.hp <= 0 || dist(m,p) > radius + (m.boss ? .7 : 0)) continue;
      hurtMonster(m, Math.round(liveStats.attack * (1.85 + .32 * rank)), .47, true, a);
      m.stagger = .97 + rank * .2;
    }
  }
  function pickup() {
    const drop = nearestLoot();
    if (!drop) return false;
    p.inventory.push(drop.item);
    p.drops = p.drops.filter(d => d.id !== drop.id);
    removeLootMesh(groundLoot.get(drop.id)); groundLoot.delete(drop.id);
    sound('pickup'); emit('loot', '获得「' + drop.item.name + '」', { item: drop.item.name, picked: true }); save(); return true;
  }
  function drinkPotion() {
    const restored = Math.min(Math.round(liveStats.maxHp * .57), Math.ceil(liveStats.maxHp - p.hp));
    p.hp = Math.min(liveStats.maxHp, p.hp + restored); p.potions--;
    sound('heal'); flashRing(p.x, p.z, 0xa6ffd4, 1.7); emit('toast', '饮用药剂 · 生命 +' + restored);
    save();
  }
  function unavailable(kind) {
    if (kind === 'gale' && !p.ranks.gale) return '请先学习破风斩';
    if (kind === 'quake' && !p.ranks.quake) return '升至 2 级后，在技能手册中学习震地击';
    if (kind === 'heal' && !p.potions) return '药剂已经用完';
    if (kind === 'heal' && p.hp >= liveStats.maxHp) return '生命已满';
    const cost = staminaCost[kind] || 0;
    if (p.stamina < cost) return '耐力不足 · 需要 ' + cost + ' 点耐力';
    return '';
  }
  const staminaCost = { gale: 18, quake: 26, dodge: 16 };
  const cooldownKey = { attack: 'attack', gale: 'skill', quake: 'quake', heal: 'potion', dodge: 'dodge' };
  function beginMove(kind) {
    const comboIndex = kind === 'attack' && time <= comboUntil ? (lastCombo + 1) % 3 : 0;
    const spec = kind === 'attack' ? HERO_ACTIONS.attack[comboIndex] : HERO_ACTIONS[kind];
    const a = { ...spec, kind, comboIndex, phase: 0, elapsed: 0, released: false, travel: 0, travelled: 0 };
    performing = a;
    if (kind === 'attack') {
      lastCombo = comboIndex; comboUntil = time + a.duration + .43;
      actionCooldown.attack = a.duration * .86;
    } else {
      lastCombo = -1; comboUntil = 0;
      if (kind === 'gale') actionCooldown.skill = 5 - .45 * p.ranks.gale;
      if (kind === 'quake') actionCooldown.quake = 8 - .6 * p.ranks.quake;
      if (kind === 'heal') actionCooldown.potion = 3;
      if (kind === 'dodge') {
        const input = direction();
        if (input.length > .02) p.yaw = Math.atan2(input.x, -input.z);
        a.travel = 3.78; actionCooldown.dodge = 1.05; sound('dodge');
      }
      p.stamina -= staminaCost[kind] || 0;
    }
    if (kind === 'attack' || kind === 'gale') alignToTarget(a);
    dirty = true;
  }
  function requestMove(kind) {
    const key = cooldownKey[kind];
    if (actionCooldown[key] > 0 && !(performing && kind === 'attack')) return false;
    const reason = unavailable(kind);
    if (reason) { emit('toast', reason); return false; }
    if (performing) {
      // Dodge may interrupt a light attack, or the recovery of a committed skill.
      if (kind !== 'dodge' || (performing.kind !== 'attack' && !performing.released)) {
        if (buffered && (kind === 'attack' || kind === buffered)) return false;
        buffered = kind; return true;
      }
      buffered = '';
    }
    beginMove(kind); return true;
  }
  function tickAction(dt) {
    if (p.hp <= 0) { performing = null; buffered = ''; return; }
    if (performing && (performing.phase >= 1 || (buffered && performing.phase >= .86))) {
      performing = null;
      if (buffered) {
        const kind = buffered; buffered = '';
        if (!unavailable(kind) && actionCooldown[cooldownKey[kind]] <= .001) beginMove(kind);
      }
    }
    if (!performing && (keys.has('KeyJ') || keys.has('Digit1') || keys.has('Numpad1'))) beginMove('attack');
    if (performing) {
      performing.elapsed += dt;
      performing.phase = Math.min(1, performing.elapsed / performing.duration);
    }
  }
  function releaseContact() {
    const a = performing;
    if (!a || a.released || a.phase < a.contact) return;
    a.released = true;
    if (a.kind === 'attack' || a.kind === 'gale') strikeTargets(a);
    else if (a.kind === 'quake') groundImpact(a);
    else if (a.kind === 'heal' && p.potions > 0 && p.hp < liveStats.maxHp) drinkPotion();
  }
  function equip(id, remove) {
    const it = p.inventory.find(it => it.id === id);
    if (!it || (remove && p.equipped[it.slot] !== id)) return false;
    if (!remove && p.equipped[it.slot] === id) return false;
    p.equipped[it.slot] = remove ? null : id;
    syncEquipment(); sound('equip'); save(); return true;
  }
  function invest(key) {
    if (p.statPoints < 1 || !['strength','vitality','agility'].includes(key)) return false;
    p.statPoints--; p.stats[key]++; liveStats = derived(p);
    if (key === 'vitality') p.hp += 15;
    if (key === 'agility') p.stamina += 5;
    sound('stat'); save(); return true;
  }
  function learn(id) {
    const entry = skillBook.find(s => s.id === id);
    if (!entry || p.level < entry.requiredLevel || p.skillPoints < 1 || p.ranks[id] >= entry.maxRank) return false;
    p.skillPoints--; p.ranks[id]++; liveStats = derived(p); sound('learn'); save(); return true;
  }
  function direction() {
    const side = clamp((+keys.has('KeyD') || +keys.has('ArrowRight')) - (+keys.has('KeyA') || +keys.has('ArrowLeft')) + moveInput.x, -1, 1);
    const forward = clamp((+keys.has('KeyW') || +keys.has('ArrowUp')) - (+keys.has('KeyS') || +keys.has('ArrowDown')) - moveInput.y, -1, 1);
    const norm = Math.max(1, Math.hypot(side, forward));
    return { x: (Math.cos(view) * side + Math.sin(view) * forward) / norm,
      z: (Math.sin(view) * side - Math.cos(view) * forward) / norm, length: Math.min(1, Math.hypot(side, forward)) };
  }
  function setPaused(value) {
    if (paused !== Boolean(value)) resetFrameSample();
    paused = Boolean(value); buffered = ''; pausedDraw = true; nextDisplay = 0; keys.clear(); moveInput = { x: 0, y: 0 }; drag = null;
    if (paused) runVelocity.set(0, 0);
    if (paused && dirty) save();
  }
  function resetActions() {
    performing = null; buffered = ''; lastCombo = -1; comboUntil = invuln = inCombat = shake = 0;
    heroMotion = { moving: false, sprint: false, speed: 0, moveForward: 0, moveSide: 0 };
    runVelocity.set(0, 0);
    combatFx.reset();
    actionCooldown = { attack: 0, skill: 0, quake: 0, dodge: 0, potion: 0 }; keys.clear(); moveInput = {x:0,y:0};
  }
  function respawn() {
    if (p.hp > 0) return false;
    p.x = HOME.x; p.z = HOME.z; p.yaw = view = 0;
    healToFull(); resetActions(); active = false; restoreField(); cameraFollow(1, true); save();
    emit('toast','已在古道入口苏醒'); return true;
  }
  function restart() {
    p = freshProfile(); resetActions(); active = false; view = 0; tilt = .14; zoom = 7.7;
    while (effects.length) removeEffect(effects.length - 1);
    restoreField(); cameraFollow(1, true); save(); emit('toast','新的旅程开始了'); return true;
  }
  function action(name, arg) {
    let ok = false;
    if (name === 'stat') ok = invest(arg);
    else if (name === 'learn') ok = learn(arg);
    else if (name === 'equip' || name === 'unequip') ok = equip(arg, name === 'unequip');
    else if (name === 'audio') { p.audio = Boolean(arg); save(); ok = true; }
    else if (name === 'save') { save(true); ok = true; }
    else if (name === 'restart') ok = restart();
    else if (name === 'respawn') ok = respawn();
    else if ((!paused || name === 'heal') && p.hp > 0) {
      active = true;
      switch (name) {
        case 'attack': ok = requestMove('attack'); break;
        case 'skill': ok = requestMove('gale'); break;
        case 'quake': ok = requestMove('quake'); break;
        case 'dodge': ok = requestMove('dodge'); break;
        case 'heal': ok = requestMove('heal'); break;
        case 'pickup': ok = pickup(); break;
        case 'move':
          moveInput = { x: clamp(Number(arg?.x) || 0, -1, 1), y: clamp(Number(arg?.y) || 0, -1, 1) }; ok = true; break;
      }
    }
    nextDisplay = 0; pausedDraw = true;
    return ok;
  }
  function hurtPlayer(m) {
    if (invuln > 0 || p.hp <= 0 || (performing?.kind === 'dodge' && performing.phase < .83)) return;
    const amount = Math.max(2, m.damage - Math.floor(liveStats.defense * .65));
    p.hp = Math.max(0, p.hp - amount); invuln = .36; shake = .13; inCombat = 6; dirty = true;
    sound('hurt');
    hitDirection.set(p.x - m.x, 0, p.z - m.z).normalize();
    hitPoint.set(p.x, world.height(p.x, p.z) + 1.42, p.z).addScaledVector(hitDirection, -.24);
    combatFx.hit(hitPoint, hitDirection, 'guard', 0);
    const mark = screen(p.x, world.height(p.x, p.z) + 2.45, p.z);
    if (mark.visible) emit('hit', '−' + amount, { x: mark.x, y: mark.y, target: 'player' });
    if (p.hp === 0) { performing = null; buffered = ''; keys.clear(); save(); emit('death', '冒险者倒下了'); }
  }
  function updateMonster(m, dt) {
    m.moving = false;
    if (m.hp <= 0) {
      m.death = Math.min(1, m.death + dt * 1.6);
      if (m.death >= 1) {
        m.model.root.visible = m.footprint.visible = false;
        if (!m.boss && p.fallen[m.id] < Date.now() && Math.hypot(p.x - m.homeX, p.z - m.homeZ) > 13) {
          resetMonster(m); delete p.fallen[m.id]; dirty = true;
        }
      }
      return;
    }
    m.hit = Math.max(0, m.hit - dt * 4.7);
    m.strike = Math.max(0, m.strike - dt * 2.9);
    m.delay = Math.max(0, m.delay - dt);
    if (m.stagger > 0) {
      m.stagger = Math.max(0, m.stagger - dt); m.hit = Math.max(m.hit, .34); return;
    }
    if (!active || p.hp <= 0) return;
    const distance = dist(p, m), fromHome = Math.hypot(m.x - m.homeX, m.z - m.homeZ);
    const attackRange = m.boss ? 3.0 : 2.05;
    if (distance < (m.boss ? 12 : 8.3)) m.aggro = true;
    if (distance > 16 || fromHome > 18) m.aggro = false;
    if (!m.aggro) {
      if (fromHome > .3) {
        m.yaw = Math.atan2(m.homeX - m.x, m.z - m.homeZ);
        place(m, m.x + Math.sin(m.yaw) * dt * 2, m.z - Math.cos(m.yaw) * dt * 2);
        m.moving = true;
      }
      m.wind = 0; return;
    }
    if (m.wind > 0) {
      m.wind = Math.max(0, m.wind - dt);
      if (m.wind <= .0001) {
        m.wind = 0; m.strike = 1; m.delay = m.boss ? 1.28 : 1.55;
        if (distance < attackRange + .68) hurtPlayer(m);
      }
      return;
    }
    m.yaw = Math.atan2(p.x - m.x, m.z - p.z);
    if (distance > attackRange && m.hit < .45 && m.strike < .65) {
      const speed = m.boss ? 2.45 : 1.65 + m.level * .17;
      let vx = Math.sin(m.yaw), vz = -Math.cos(m.yaw);
      for (const other of monsters) {
        if (other === m || other.hp <= 0) continue;
        const gap = dist(m, other);
        if (gap < 1.65 && gap > .02) {
          vx += (m.x - other.x) / gap * (1.65 - gap); vz += (m.z - other.z) / gap * (1.65 - gap);
        }
      }
      const norm = Math.max(1, Math.hypot(vx, vz));
      place(m, m.x + vx / norm * dt * speed, m.z + vz / norm * dt * speed);
      m.moving = true;
    } else if (distance <= attackRange + .05 && m.delay <= 0 && m.hit < .15) {
      m.wind = m.boss ? .76 : .59; inCombat = 6;
      flashRing(m.x, m.z, 0xe9844d, attackRange + .2, m.wind);
    }
  }
  function updatePlayer(dt) {
    const fromX = p.x, fromZ = p.z, a = performing;
    const input = direction(), walking = input.length > .05 && p.hp > 0;
    const sprint = walking && !a && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && p.stamina > 1;
    if (p.hp <= 0) return { moving: false, sprint: false, speed: 0, moveSide: 0, moveForward: 0 };
    if (a && a.travel > 0) {
      const dodge = a.kind === 'dodge';
      const travelled = a.travel * THREE.MathUtils.smoothstep(a.phase, dodge ? .02 : .07, dodge ? .84 : a.contact + .02);
      const step = travelled - a.travelled; a.travelled = travelled;
      if (step > 0) place(p, p.x + Math.sin(p.yaw) * step, p.z - Math.cos(p.yaw) * step);
    }
    const committed = a && a.phase < .76;
    let speedLimit = (sprint ? 8.2 : 4.65) + (p.stats.agility - 1) * .09;
    if (committed) speedLimit *= a.kind === 'attack' ? .4 : a.kind === 'heal' ? .58 : .16;
    const targetX = walking ? input.x * speedLimit : 0;
    const targetZ = walking ? input.z * speedLimit : 0;
    if (a?.kind === 'dodge') runVelocity.set(0, 0);
    else if (a) runVelocity.set(targetX, targetZ);
    else {
      // A short acceleration and braking interval gives the first and last
      // footfall time to carry weight. Combat travel keeps its authored timing.
      const dx = targetX - runVelocity.x, dz = targetZ - runVelocity.y;
      const rate = walking ? 62 : 82;
      const amount = Math.min(1, dt * rate / Math.max(.001, Math.hypot(dx, dz)));
      runVelocity.x += dx * amount; runVelocity.y += dz * amount;
    }
    if (runVelocity.lengthSq() > .0001) {
      place(p, p.x + runVelocity.x * dt, p.z + runVelocity.y * dt);
      if (walking && !committed) {
        const nextYaw = Math.atan2(input.x, -input.z);
        p.yaw += Math.atan2(Math.sin(nextYaw - p.yaw), Math.cos(nextYaw - p.yaw)) * (1 - Math.exp(-15 * dt));
      }
      dirty = true;
    }
    if (sprint) p.stamina = Math.max(0, p.stamina - dt * 9);
    else if (!a || a.kind === 'attack' || a.kind === 'heal') p.stamina = Math.min(liveStats.maxStamina, p.stamina + dt * 12);
    if (p.ranks.renew && inCombat <= 0 && active) p.hp = Math.min(liveStats.maxHp, p.hp + dt * p.ranks.renew * 2);
    if (!p.shrine && dist(p, SHRINE) < 4.6) {
      p.shrine = true; p.potions += 2; healToFull();
      emit('toast', '回声祭坛已点亮 · 药剂 +2'); flashRing(SHRINE.x, SHRINE.z, 0xb8ffed, 4.5, .9);
      gainXp(36); checkVictory(); save();
    }
    const dx = p.x - fromX, dz = p.z - fromZ, distance = Math.hypot(dx,dz);
    const speed = dt > 0 ? distance / dt : 0;
    const moving = speed > .08, divisor = moving ? distance : 1;
    return { moving, sprint: moving && sprint, speed,
      moveForward: (dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw)) / divisor,
      moveSide: (dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) / divisor };
  }
  let headingSin = 0, headingCos = 1;
  function groundAtFoot(x, z) {
    return world.height(p.x + x * headingCos - z * headingSin, p.z + x * headingSin + z * headingCos) - hero.root.position.y;
  }
  function positionHero(dt, motion) {
    headingSin = Math.sin(p.yaw); headingCos = Math.cos(p.yaw);
    const py = world.height(p.x, p.z);
    hero.root.position.set(p.x, py, p.z); hero.root.rotation.y = -p.yaw;
    shadow.position.set(p.x, py, p.z);
    const actionKind = performing?.kind || '', actionPhase = performing?.phase || 0;
    hero.update(dt, { ...motion, groundAt: groundAtFoot, actionKind, actionPhase, comboIndex: performing?.comboIndex || 0,
      attack: actionKind === 'attack' ? 1 - actionPhase : 0,
      dodge: actionKind === 'dodge' ? 1 - actionPhase : 0,
      skill: actionKind === 'gale' || actionKind === 'quake' ? 1 - actionPhase : 0, hit: clamp(invuln * 2, 0, 1), dead: p.hp <= 0 ? 1 : 0 }, time);
  }
  function positionFieldActors(dt) {
    for (const m of monsters) {
      if (!m.model.root.visible) continue;
      const my = world.height(m.x, m.z);
      m.model.root.position.set(m.x, my, m.z);
      m.model.root.rotation.y = -m.yaw; m.footprint.position.set(m.x, my, m.z);
      const kind = m.wind > 0 ? 'windup' : m.stagger > 0 ? 'stagger' : m.strike > 0 ? 'strike' : '';
      const phase = kind === 'windup' ? 1 - m.wind / (m.boss ? .76 : .59) : kind === 'strike' ? 1 - m.strike : 0;
      m.model.update(dt, { moving: m.moving, sprint: false, actionKind: kind, actionPhase: phase, attack: m.wind > 0 ? .16 : m.strike,
        hit: m.hit, dead: m.hp <= 0 ? m.death : 0, dodge: 0, skill: 0 }, time);
    }
    for (const g of groundLoot.values()) {
      g.children[0].position.y = .43 + Math.sin(time * 2.9) * .08;
      g.rotation.y = time * 1.6;
    }
  }
  function cameraFollow(dt, snap = false) {
    const py = world.height(p.x, p.z);
    const vertical = 1.95 + zoom * Math.sin(tilt);
    const r = zoom * Math.cos(tilt), rightX = Math.cos(view), rightZ = Math.sin(view);
    const cx = p.x - Math.sin(view) * r + rightX * .65, cz = p.z + Math.cos(view) * r + rightZ * .65;
    wishPos.set(cx, Math.max(py + vertical, world.height(cx, cz) + .58), cz);
    const blend = snap ? 1 : 1 - Math.exp(-10 * dt);
    camera.position.lerp(wishPos, blend);
    look.set(p.x + Math.sin(view) * 3.7 + rightX * .40, py + 1.97 - Math.sin(tilt - .14) * 1.6, p.z - Math.cos(view) * 3.7 + rightZ * .40);
    if (shake > 0) camera.position.y += Math.sin(time * 71) * shake * .43;
    camera.lookAt(look); camera.updateMatrixWorld();
  }
  function getState() {
    const quests = questLog(p), current = quests.find(q => !q.done) || { title: '苍岚再会', description: '自由探索古道与山林', current: 3, total: 3, done: true };
    const enemies = [], tags = [];
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const distance = dist(m, p);
      enemies.push({ id: m.id, name: m.name, level: m.level, hp: m.hp, maxHp: m.maxHp, x: m.x, z: m.z, elite: m.elite, boss: m.boss });
      if (distance > 17.5) continue;
      const point = screen(m.x, world.height(m.x, m.z) + (m.boss ? 4.7 : m.elite ? 3.55 : 3.08), m.z);
      if (point.visible && point.x > .04 && point.x < .96 && point.y > .1 && point.y < .88) {
        tags.push({ id: m.id, name: m.name, level: m.level, hp: m.hp, maxHp: m.maxHp,
          x: point.x, y: point.y, distance, elite: m.elite, winding: m.wind > 0 });
      }
    }
    tags.sort((a, b) => a.distance - b.distance);
    const near = nearestLoot();
    return { level: p.level, xp: p.xp, xpNext: expGoal(p.level), hp: Math.ceil(p.hp), stamina: Math.ceil(p.stamina), ...liveStats,
      statPoints: p.statPoints, skillPoints: p.skillPoints, stats: { ...p.stats },
      skills: skillBook.map(s => ({ ...s, rank: p.ranks[s.id] })), inventory: p.inventory.map(it => ({...it})), equipped: { ...p.equipped },
      kills: p.kills, potions: p.potions, dead: p.hp <= 0, victory: p.victory, region: getRegion(p), quest: current, quests,
      player: { x: p.x, z: p.z, yaw: p.yaw, ...heroMotion, actionKind: performing?.kind || '',
        actionPhase: performing?.phase || 0, comboIndex: performing?.comboIndex || 0 }, heading: ((THREE.MathUtils.radToDeg(view) % 360) + 360) % 360,
      enemies, tags, drops: p.drops.map(d => ({id:d.id,name:d.item.name,x:d.x,z:d.z})),
      nearDrop: near?.item.name || null, cooldowns: { ...actionCooldown }, activated: active, audio: p.audio, savedAt: p.savedAt,
      paused, performance: { fps: frameMs === null ? null : 1000 / frameMs, frameMs } };
  }
  function removeEffect(i) {
    const mesh = effects[i].mesh;
    scene.remove(mesh); mesh.dispose?.(); mesh.geometry.dispose(); mesh.material.dispose(); effects.splice(i, 1);
  }
  function advance(dt) {
    time += dt; invuln = Math.max(0, invuln - dt);
    inCombat = Math.max(0, inCombat - dt); shake = Math.max(0, shake - dt * .48);
    for (const key in actionCooldown) actionCooldown[key] = Math.max(0, actionCooldown[key] - dt);
    tickAction(dt); heroMotion = updatePlayer(dt); positionHero(dt, heroMotion); releaseContact();
    for (const m of monsters) updateMonster(m, dt);
    combatFx.update(dt, performing, p.equipped.weapon);
    world.update(dt, time); positionFieldActors(dt); cameraFollow(dt);
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i]; fx.age += dt;
      if (fx.age >= fx.life) removeEffect(i);
      else fx.update(fx.age / fx.life);
    }
    saveTimer += dt;
    if (saveTimer >= 4) { saveTimer = 0; if (dirty) save(); }
  }
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === width && h === height) return false;
    width = w; height = h; renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < .9 ? 59 : 50; camera.updateProjectionMatrix(); return true;
  }
  let animationId;
  function resetFrameSample() {
    sampleStart = null;
    frameIntervals = 0;
    frameMs = null;
  }
  function sampleRenderedFrame(now) {
    if (sampleStart === null) {
      sampleStart = now;
      return;
    }
    frameIntervals++;
    const elapsed = now - sampleStart;
    if (elapsed >= 600) {
      frameMs = elapsed / frameIntervals;
      sampleStart = now;
      frameIntervals = 0;
    }
  }
  function loop(now) {
    if (disposed) return;
    animationId = requestAnimationFrame(loop);
    const dt = previous ? Math.min(.066, Math.max(0, (now - previous) / 1000)) : .016;
    previous = now;
    const resized = resize();
    if (!paused) advance(dt);
    if (!paused || resized || pausedDraw) {
      renderer.render(scene, camera);
      if (!paused && !document.hidden) sampleRenderedFrame(now);
      if (now >= nextDisplay || resized || pausedDraw) { onFrame(getState()); nextDisplay = now + 65; }
      pausedDraw = false;
    }
  }
  const movementKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight']);
  const bindings = { KeyJ: 'attack', Digit1: 'attack', Numpad1: 'attack', Digit2: 'skill', Numpad2: 'skill', Digit3: 'heal', Numpad3: 'heal', Digit4: 'quake', Numpad4: 'quake', Space: 'dodge', KeyE: 'pickup' };
  function keydown(e) {
    if (paused || e.ctrlKey || e.metaKey || e.altKey || e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    if (p.hp <= 0 || (!movementKeys.has(e.code) && !bindings[e.code])) return;
    e.preventDefault(); keys.add(e.code); active = true;
    if (bindings[e.code] && !e.repeat) action(bindings[e.code]);
  }
  const keyup = e => keys.delete(e.code);
  function pointerdown(e) {
    if (paused || drag || (e.button !== 0 && e.button !== 2)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, attack: e.button === 0 };
    canvas.setPointerCapture?.(e.pointerId);
  }
  function pointermove(e) {
    if (!drag || paused || drag.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
    if (drag.moved) {
      view = (view - (e.clientX - drag.lastX) * .0065) % (Math.PI * 2);
      tilt = clamp(tilt - (e.clientY - drag.lastY) * .0045, -.07, .80); dirty = true;
    }
    drag.lastX = e.clientX; drag.lastY = e.clientY;
  }
  function pointerup(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const click = !drag.moved && drag.attack; drag = null;
    if (click && !paused) action('attack');
  }
  function pointercancel(e) { if (drag?.id === e.pointerId) drag = null; }
  function wheel(e) { if (!paused) { e.preventDefault(); zoom = clamp(zoom + e.deltaY * .009, 4.4, 11.8); } }
  const contextmenu = e => e.preventDefault();
  function blur() { buffered = ''; runVelocity.set(0, 0); keys.clear(); moveInput = {x:0,y:0}; drag = null; if (dirty) save(); }
  const hidden = () => {
    resetFrameSample();
    if (document.hidden) blur();
  };
  const events = [[window,'keydown',keydown],[window,'keyup',keyup],[window,'blur',blur],[window,'pagehide',blur],
    [document,'visibilitychange',hidden],[canvas,'pointerdown',pointerdown],[canvas,'pointermove',pointermove],
    [canvas,'pointerup',pointerup],[canvas,'pointercancel',pointercancel],[canvas,'lostpointercapture',pointercancel],
    [canvas,'contextmenu',contextmenu],[canvas,'wheel',wheel,{passive:false}]];
  for (const [node, name, fn, options] of events) node.addEventListener(name, fn, options);
  restoreField(); resize(); cameraFollow(1, true); positionHero(.001, heroMotion); positionFieldActors(.001);
  animationId = requestAnimationFrame(loop);
  return { getState, action, setPaused, dispose() {
    disposed = true; cancelAnimationFrame(animationId); blur();
    for (const [node, name, fn] of events) node.removeEventListener(name, fn);
    combatFx.dispose();
    scene.traverse(o => { o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose(); });
    renderer.dispose();
  } };
}
