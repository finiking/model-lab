import { startGame } from './game.js';
import { createPanels } from './panels.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const audio = createAudio();
const regions = {
  '苍岚古道':['01','THE ASHEN WAY'], '雾松林地':['02','MISTPINE WOOD'],
  '回声祭坛':['03','ECHO SHRINE'], '古道关隘':['04','THE OLD GATE'], '灰冠遗迹':['05','ASHCROWN RUINS']
};
const keys = { Escape:'pause', KeyC:'character', KeyI:'inventory', KeyK:'skills', KeyL:'journal', KeyM:'map' };
const displayKey = 'ashen-reach.hud.v1';
const displayOptions = { showFps: false, showHints: false };
try {
  const saved = JSON.parse(localStorage.getItem(displayKey));
  displayOptions.showFps = saved?.showFps === true;
  displayOptions.showHints = saved?.showHints === true;
} catch { /* Private browsing can disable local storage. */ }
const controls = document.querySelector('.controls');
function applyOptions() {
  controls.hidden = !displayOptions.showHints;
  $('fps-meter').hidden = !displayOptions.showFps;
}
applyOptions();
const degreeLabels = ['N','NE','E','SE','S','SW','W','NW'];
const slots = [...document.querySelectorAll('.slot')];
const quakeSlot = slots.find(slot=>slot.dataset.act==='quake');
const characterTab=document.querySelector('.profile'), skillTab=document.querySelector('.field-tool[data-open="skills"]');
const tags = new Map(), dots = new Map(), ticks = [];
let game, panels, outcome = '', lastHeading = NaN, lastRegion, rendered = false;
function write(el, value) { const t = String(value); if(el.textContent !== t) el.textContent = t; }
function percent(num, max) { return Math.max(0, Math.min(100, num / max * 100)) + '%'; }
function mapPoint(v){return (Math.max(-56, Math.min(56, v)) + 56) / 112 * 100 + '%';}

for(let i=0; i<48; i++){
  const tick=document.createElement('span');
  if(i%6===0){
    tick.className='tick major cardinal';
    const b=document.createElement('b'); b.textContent=degreeLabels[i/6]; tick.append(b);
  }else{tick.className='tick'+(i%3===0?' major':'');}
  ticks.push(tick); $('compass-strip').append(tick);
}
function drawCompass(angle){
  if(Math.abs(angle-lastHeading)<.08) return;
  lastHeading=angle;
  ticks.forEach((tick,i)=>{
    const delta=(i*7.5-angle+540)%360-180;
    tick.hidden=Math.abs(delta)>64;
    if(!tick.hidden)tick.style.left=(50+delta/1.25)+'%';
  });
}
function syncList(cache,items,create,update){
  const present=new Set();
  for(const item of items){
    let el=cache.get(item.id);
    if(!el){el=create(item);cache.set(item.id,el);}
    update(el,item);present.add(item.id);
  }
  for(const [id,el] of cache) if(!present.has(id)){el.remove(); cache.delete(id);}
}
function drawActors(s){
  syncList(tags,s.tags,t=>{
    const el=document.createElement('div');el.className='enemy-tag'+(t.elite?' elite':'');
    const line=document.createElement('span'),lv=document.createElement('span');
    lv.className='enemy-lvl'; lv.textContent='Lv.'+t.level;
    line.append(lv,document.createTextNode(t.name));
    const bar=document.createElement('span');bar.className='enemy-bar';bar.append(document.createElement('i'));
    el.append(line,bar);$('tags').append(el);return el;
  },(el,t)=>{
    el.style.left=(100*t.x)+'%';el.style.top=(100*t.y)+'%';
    el.lastChild.firstChild.style.width=percent(t.hp,t.maxHp);
    el.classList.toggle('winding',t.winding);
  });
  syncList(dots,[...s.enemies,...s.drops],t=>{
    const el=document.createElement('i');el.className='map-mark '+(t.elite?'elite':t.hp===undefined?'loot':'');
    $('map-marks').append(el);return el;
  },(el,t)=>{el.style.left=mapPoint(t.x);el.style.top=mapPoint(t.z);});
  const player=$('map-player');player.style.left=mapPoint(s.player.x);player.style.top=mapPoint(s.player.z);
  player.style.transform='rotate('+s.player.yaw+'rad)';
}

function drawObjective(s){
  const {x,z}=s.player;
  let point;
  if(!s.quest.done){
    if(s.quests?.[0]?.title===s.quest.title){
      for (const enemy of s.enemies) {
        if (!point || Math.hypot(enemy.x-x,enemy.z-z)<Math.hypot(point.x-x,point.z-z)) point=enemy;
      }
    }else if(s.quests?.[1]?.title===s.quest.title){point={x:30,z:-14};}
    else{point=s.enemies.find(enemy=>enemy.boss);}
  }
  const bearing=$('objective-bearing'), dot=$('map-objective');
  dot.hidden=!point;
  if(!point){bearing.hidden=true;write($('quest-distance'),'');return;}
  const dx=point.x-x,dz=point.z-z;
  dot.style.left=mapPoint(point.x);dot.style.top=mapPoint(point.z);
  write($('quest-distance'),Math.round(Math.hypot(dx,dz))+' m');
  const delta=(Math.atan2(dx,-dz)*180/Math.PI-s.heading+900)%360-180;
  bearing.hidden=Math.abs(delta)>58;
  if(!bearing.hidden)bearing.style.left=(50+delta/1.25)+'%';
}

function draw(s){
  if(!rendered){rendered=true;$('loader').hidden=true;}
  if(displayOptions.showFps) {
    const fps = s.performance?.fps, frameMs = s.performance?.frameMs;
    write($('fps-value'), Number.isFinite(fps) ? Math.round(fps) : '—');
    write($('ms-value'), Number.isFinite(frameMs) ? frameMs.toFixed(1) : '—');
  }
  write($('lv-disc'),s.level); write($('hpnum'),s.hp+' / '+s.maxHp);
  $('hpbar').style.width=percent(s.hp,s.maxHp); $('stbar').style.width=percent(s.stamina,s.maxStamina);
  $('xpbar').style.width=percent(s.xp,s.xpNext);
  $('hpbar').parentElement.title='生命 '+s.hp+' / '+s.maxHp;
  $('stbar').parentElement.title='耐力 '+s.stamina+' / '+s.maxStamina;
  $('xpbar').parentElement.title='经验 '+s.xp+' / '+s.xpNext;
  write($('quest-title'),s.quest.title);write($('quest-desc'),s.quest.description);
  write($('quest-progress'),s.quest.done?'✓':s.quest.current+'/'+s.quest.total);
  if(lastRegion!==s.region){
    const [num,en]=regions[s.region]||['·','ASHEN REACH']; lastRegion=s.region;
    write($('region-kicker'),'REGION  '+num); write($('region-title'),s.region);write($('region-en'),en);
  }
  write($('pot-count'),'×'+s.potions);
  characterTab.classList.toggle('has-points',s.statPoints>0);
  skillTab.classList.toggle('has-points',s.skillPoints>0&&s.skills.some(sk=>sk.requiredLevel<=s.level&&sk.rank<sk.maxRank));
  quakeSlot.hidden=!s.skills.some(skill=>skill.id==='quake'&&skill.rank>0);
  for(const slot of slots){
    const action=slot.dataset.act, cooldown=s.cooldowns[action==='heal'?'potion':action];
    write(slot.querySelector('.cd'), cooldown>.05? (cooldown<1?cooldown.toFixed(1):Math.ceil(cooldown)):'');
  }
  $('pickup').hidden=!s.nearDrop; if(s.nearDrop)write($('pickup').querySelector('span'),'拾取 '+s.nearDrop);
  drawCompass(s.heading); drawActors(s); drawObjective(s);
  if(s.dead && outcome!=='death')showOutcome('death');
  if(!s.dead && outcome==='death')dismissOutcome();
  if(panels?.active)panels.refresh();
}
function toast(message,gold=false){
  if(!message)return;
  const el=document.createElement('div');el.className='notice'+(gold?' gold':'');el.textContent=message;
  const area=$('toasts');while(area.childElementCount>=3)area.firstChild.remove();area.append(el);
  setTimeout(()=>el.remove(),2750);
}
function onEvent(e){
  if(e.type==='sound'){audio.play(e.variant || e.name);return;}
  if(e.type==='hit'){
    if(!Number.isFinite(e.x)||!Number.isFinite(e.y))return;
    const n=document.createElement('span');n.className='damage-num';n.textContent=e.text;
    if(e.target==='player'){n.style.color='#ff9c86';$('world').animate?.([{filter:'sepia(.18) saturate(1.35)'},{filter:'none'}],250);}
    n.style.left=(e.x*100)+'%';n.style.top=(e.y*100)+'%';$('fx-text').append(n);setTimeout(()=>n.remove(),770);return;
  }
  if(e.type==='death'||e.type==='victory'){audio.play(e.type); showOutcome(e.type); return;}
  toast(e.text,e.type==='levelup'||e.type==='loot');
}
function setPause(value){game?.setPaused(value);audio.setPaused(value);}
function showOutcome(type){
  if(outcome===type)return;
  outcome=type;panels?.close();setPause(true);
  const death=type==='death',box=$('outcome');box.hidden=false;box.replaceChildren();
  const micro=document.createElement('small'),heading=document.createElement('h2'),body=document.createElement('p'),button=document.createElement('button');
  micro.textContent=death?'FALLEN IN BATTLE':'CHAPTER COMPLETE'; heading.textContent=death?'行者倒下了':'山谷重归宁静';
  body.textContent=death?'回到古道入口，带着已经获得的装备与经验再次出发。':'断冠守望者已经陨落。你仍可以留在山谷，拾取战利品，继续探索。';
  button.textContent=death?'在古道苏醒':'继续探索';button.onclick=()=>{if(death)game.action('respawn');dismissOutcome();};
  box.append(micro,heading,body,button);button.focus();
}
function dismissOutcome(){outcome='';$('outcome').hidden=true;setPause(false);$('world').focus({preventScroll:true});}
function action(name,arg){
  if(name==='audio'){if(audio.enabled!==Boolean(arg))audio.toggle();return true;}
  if(name==='showFps'||name==='showHints'){
    displayOptions[name]=Boolean(arg);
    try { localStorage.setItem(displayKey, JSON.stringify(displayOptions)); } catch {}
    applyOptions();
    return true;
  }
  const result=game?.action(name,arg);
  if(result&&['stat','learn','equip','unequip','save'].includes(name))audio.play(name==='unequip'?'equip':name);
  return result;
}
function open(tab){
  if(!game||!panels||outcome)return;
  audio.play('ui');
  panels.open(tab);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-open],[data-act]');if(!b)return;
  if(b.dataset.open)open(b.dataset.open);
  else if(!outcome&&!panels?.active)action(b.dataset.act);
});
document.addEventListener('keydown',e=>{
  if(!game||panels?.active||outcome||e.ctrlKey||e.metaKey||e.altKey||!keys[e.code])return;
  e.preventDefault();if(!e.repeat)open(keys[e.code]);
});
const stick=$('stick'),knob=stick.firstElementChild;let stickPointer=null;
function steer(e){
  const r=stick.getBoundingClientRect(),radius=r.width*.36,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
  const scale=Math.max(radius,Math.hypot(dx,dy)); const x=dx/scale,y=dy/scale;
  knob.style.transform='translate('+x*radius+'px,'+y*radius+'px)';game?.action('move',{x,y});
}
stick.addEventListener('pointerdown',e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);steer(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)steer(e);});
function release(e){if(e.pointerId!==stickPointer)return;stickPointer=null;knob.style.transform='none';game?.action('move',{x:0,y:0});}
for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,release);
try{
  game=startGame($('world'),{onFrame:draw,onEvent});
  panels=createPanels($('panels'),{getState:()=>({...game.getState(),audio:audio.enabled,...displayOptions}),action,setPaused:setPause,onClose:()=>{if(outcome)setPause(true);}});
}catch(error){
  console.error(error);
  const panel=$('loader');panel.querySelector('p').textContent='山谷未能载入';
  panel.querySelector('span').textContent='请启用浏览器硬件加速后重试';
  const retry=document.createElement('button');retry.textContent='重新载入';retry.onclick=()=>location.reload();panel.append(retry);
}
