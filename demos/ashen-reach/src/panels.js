import { inspectMarkup, mountInspector } from './hero-inspect.js';

const illustration = {
  journal: '<path d="M3.5 5.5c3-1 5.8-.6 8.5 1.3 2.7-1.9 5.5-2.3 8.5-1.3v13c-3-1-5.8-.6-8.5 1.3-2.7-1.9-5.5-2.3-8.5-1.3zM12 7v12M6.5 9l3 1M6.5 12l3 1m5-3 3-1m-3 4 3-1"/>',
  map: '<path d="m2.5 6 6.3-2.2 6.4 2.4 6.3-2.4v14.5l-6.3 2.1-6.4-2.1-6.3 2.1zM8.8 4v14m6.4-12v14"/><path d="m11.5 12 1 1m3.9-2 2-1.2" stroke-dasharray="1 2"/>',
  inventory: '<path d="M5 10.5h14l1.4 8.8a1.8 1.8 0 0 1-1.8 2H5.4a1.8 1.8 0 0 1-1.8-2zM7.5 10.5V7.2a4.5 4.5 0 0 1 9 0v3.3M5 13.2c4.6 2.1 9.4 2.1 14 0"/><path d="M10.6 14.4h2.8v2.3h-2.8z"/>',
  character: '<path d="m12 2 7.5 3v6.8c0 4.3-3.3 7.6-7.5 10-4.2-2.4-7.5-5.7-7.5-10V5z"/><path d="m12 6 3.1 5.7L12 16l-3.1-4.3z"/>',
  skills: '<path d="m12 2 1.8 6.7L20 6l-4 6 5.2 2.4-7 1.1L12 22l-2.2-6.5-7-1.1L8 12 4 6l6.2 2.7z"/><path d="m12 9 1.9 3L12 15l-1.9-3z"/>',
  pause: '<path d="m10 3 .7-1h2.6l.7 1 .4 2 2 .9 1.8-.8 1.8 1.8-.8 1.8.9 2 1.9.5v2.7l-1.9.5-.9 2 .8 1.7-1.8 1.8-1.8-.8-2 .9-.5 1.8h-2.7l-.5-1.8-2-.9-1.7.8-1.8-1.8.8-1.7-.9-2-1.9-.5v-2.7l1.9-.5.9-2L4.2 7l1.8-1.8 1.8.8 2-.9z"/><circle cx="12" cy="12" r="3"/>',
  weapon: '<path d="m15.5 3.4 5.1-1-1 5.1-10 10-3-3zM7.2 12.2l4.6 4.6M7.5 16.3l-3.9 4-1-1 4-3.9"/><path d="m11.5 12.5 5.7-5.7"/>',
  armor: '<path d="m8 3 4 2 4-2 4.8 4.6-2.5 3-1.9-1V20l-4.4 1.4L7.6 20V9.6l-1.9 1-2.5-3z"/><path d="m8 7 4 3 4-3m-4 3v7m-4-4 4 2 4-2"/>',
  charm: '<path d="m5 2 7 8 7-8M12 8l6 7-6 7-6-7z"/><path d="m12 12 2.8 3-2.8 3-2.8-3z"/>',
  strength: '<path d="m5 18 9-9 3 3-9 9zM12 7l2-2 5 5-2 2M14 5l3-3 5 5-3 3M4 17l3 3"/>',
  vitality: '<path d="M12 20C3.2 14.4 2.6 10.7 3.8 7.6 5.1 4.2 9.6 4.2 12 7c2.4-2.8 6.9-2.8 8.2.6 1.2 3.1.6 6.8-8.2 12.4z"/><path d="M4.6 12h4l1.5-2.9 2.6 6 2.2-4.1H20"/>',
  agility: '<path d="m3 15 6-3-2-2L20 3l-5.5 8-2.5.7L15 14 4 21l4-6z"/>',
  quake: '<path d="m12 2 1.6 5.8-1.6 4-1.6-4zM8 10l-2 2.3 1.6 1.2-3.4 3M16 10l2 2.3-1.6 1.2 3.4 3M3 16.4c2.3 2 5.3 3 9 3s6.7-1 9-3M6.4 15.1c1.4 1 3.3 1.6 5.6 1.6s4.2-.6 5.6-1.6"/><path d="m12 13-.7 1.5 1.1-.2"/>',
  sword: '<path d="m12 2 2 3.4-.7 9.6h-2.6L10 5.4zM7.7 14.7l4.3 1.6 4.3-1.6M12 16.5V21m-1.4.4h2.8"/>',
  cross: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  location: '<path d="m12 2 7 10-7 10-7-10z"/><circle cx="12" cy="12" r="2.3"/>',
  guard: '<path d="m6 4 6-2 6 2 2 10-4 6-4 2-4-2-4-6zM7 9l4 2m6-2-4 2m-3 5h4"/>',
  star: '<path d="m12 2 2.5 7.5 7.5 2.5-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>'
};
const icon = (name, cls = '') => `<svg class="ar-panel-icon ${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${illustration[name] || illustration.star}</svg>`;
const safe = (value = '') => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[s]));
const number = x => Math.round(Number(x) || 0);
const tabs = {
  character: ['角色', 'CHARACTER', 'C'],
  inventory: ['行囊', 'INVENTORY', 'I'],
  skills: ['技能', 'SKILLS', 'K'],
  journal: ['任务', 'QUEST JOURNAL', 'L'],
  map: ['地图', 'REGIONAL ATLAS', 'M'],
  pause: ['设置', 'SETTINGS', 'Esc']
};
const gearArt = {
  '巡林短剑': './art/painted/starter-sword.webp',
  '行者披风': './art/painted/cloak.webp',
  '守望者长剑': './art/painted/watch-sword.webp',
  '苔纹胸甲': './art/painted/moss-armor.webp',
  '余火护符': './art/painted/ember.webp',
  '风蚀重刃': './art/painted/heavy-blade.webp',
  '苍岚肩铠': './art/painted/pauldron.webp',
  '断冠之誓': './art/painted/crown.webp'
};
const skillArt = {
  gale:'./art/painted/gale.webp',
  quake:'./art/painted/quake.webp',
  edge:'./art/painted/attack.webp',
  renew:'./art/painted/renew.webp'
};
const tabArt = {
  inventory:'./art/painted/bag.webp',
  skills:'./art/painted/book.webp',
  journal:'./art/painted/journal.webp',
  character:'./art/painted/hero.webp'
};
const pict = (src, fallback) => src ? `<img class="ar-p-painted" src="${src}" alt="" draggable="false">` : icon(fallback);
const preferences = {audio:'游戏音效',showFps:'显示帧率',showHints:'显示操作提示'};
const aliases = { equipment:'inventory', stats:'character', help:'pause', settings:'pause', bag:'inventory', quests:'journal' };
const slots = {weapon:'主手武器', armor:'护甲', charm:'护符'};
const attributes = {
  strength:['力量','每点增加 3 点攻击'],
  vitality:['体魄','每点增加 15 点生命与 1 点防御'],
  agility:['敏捷','每点增加 5 点耐力上限']
};
const label = (cn,en) => `<div class="ar-p-section"><h3>${cn}</h3><i></i><small>${en}</small></div>`;
const stats = (item) => [['attack','攻击'],['defense','防御'],['hp','生命']].filter(([key])=>Number(item[key])).map(([key,name])=>`<b>${name} +${number(item[key])}</b>`).join('');
const rarityClass = r => ({普通:'plain',精良:'fine',稀有:'rare',史诗:'epic'}[r] || 'plain');
const keycap = k => `<kbd>${k}</kbd>`;
const progress = (current, total) => Math.min(100, Math.max(0, 100 * (Number(current) || 0) / (Number(total) || 1)));
const btn = (op, arg, content, disabled=false, style='') => `<button type="button" class="ar-p-action ${style}" data-op="${op}" data-arg="${safe(arg)}" ${disabled ? 'disabled' : ''}>${content}</button>`;
function renderCharacter(s) {
  const xpPercent = progress(s.xp,s.xpNext);
  return `<div class="ar-p-character">
    <section class="ar-p-profile"><button class="ar-p-portrait" type="button" data-op="inspect" aria-label="检视角色模型"><img src="./art/painted/hero.webp" alt="岚行者的肖像" draggable="false"><span>检视模型</span></button><div class="ar-p-micro">RANGER</div><h3>岚行者</h3><div class="ar-p-level">等级 <strong>${number(s.level)}</strong></div>
      <div class="ar-p-xp"><span>升级经验</span><b>${number(s.xp)} <em>/ ${number(s.xpNext)}</em></b></div><div class="ar-p-bar"><i style="width:${xpPercent}%"></i></div>
    </section>
    <section class="ar-p-column">${label('基础属性','ATTRIBUTES')}<div class="ar-p-note-line">可分配属性点 <strong>${number(s.statPoints)}</strong></div>
      <div class="ar-p-attributes">${Object.entries(attributes).map(([id,[name,description]])=>`<div class="ar-p-attribute"><span class="ar-p-sigil">${icon(id)}</span><div><h4>${name}</h4><p>${description}</p></div><strong>${number(s.stats?.[id])}</strong>${btn('stat',id,'<span aria-hidden="true">＋</span><span class="ar-p-sr">增加'+name+'</span>',!s.statPoints,'ar-p-plus')}</div>`).join('')}</div>
      ${label('战斗数值','COMBAT')}<div class="ar-p-values">${[['攻击',s.attack],['防御',s.defense],['生命上限',s.maxHp],['耐力上限',s.maxStamina]].map(([l,v])=>`<div><span>${l}</span><b>${number(v)}</b></div>`).join('')}</div>
    </section></div>`;
}
function renderInventory(s) {
  const items = s.inventory || [];
  const equipped = s.equipped || {};
  return `<div class="ar-p-inventory"><section>${label('穿戴中','EQUIPPED')}<div class="ar-p-gear">${Object.entries(slots).map(([slot,name])=>{
    const found=items.find(i=>i.id===equipped[slot]);
    return `<article class="ar-p-gear-slot ar-r-${rarityClass(found?.rarity)} ${found?'ar-p-filled':''}"><span class="ar-p-item-icon">${pict(gearArt[found?.name],slot)}</span><div><small>${name}${found ? ' · '+safe(found.rarity) : ''}</small><h4>${safe(found?.name || '尚未穿戴')}</h4>${found?`<div class="ar-p-item-stats">${stats(found)}</div>`:''}</div></article>`;
  }).join('')}</div></section><section>${label('随身行囊',String(items.length).padStart(2,'0')+' ITEMS')}<div class="ar-p-items">${items.length?items.map(item=>{
    const worn=equipped[item.slot]===item.id;
    return `<article class="ar-p-item ar-r-${rarityClass(item.rarity)}"><div class="ar-p-item-head"><span class="ar-p-item-icon">${pict(gearArt[item.name],item.slot)}</span><div><small>${safe(item.rarity)} · ${slots[item.slot] || '装备'}</small><h4>${safe(item.name)}</h4></div>${worn?`<span class="ar-p-worn">${icon('check')} 已穿戴</span>`:''}</div><p>${safe(item.description)}</p><div class="ar-p-item-foot"><div class="ar-p-item-stats">${stats(item)}</div>${btn(worn?'unequip':'equip',item.id,worn?'卸下':'穿戴',false,worn?'ar-p-quiet':'')}</div></article>`;
  }).join(''):'<p class="ar-p-empty">击败守卫后，拾取掉落的装备。</p>'}</div></section></div>`;
}
function renderSkills(s) {
 const bindings={gale:'2',quake:'4'};
 return `<div class="ar-p-note-line ar-p-note-wide">可用技能点 <strong>${number(s.skillPoints)}</strong></div><div class="ar-p-skills">${(s.skills||[]).map((skill,i)=>{
    const rank=number(skill.rank),max=number(skill.maxRank),level=number(skill.requiredLevel);
    const full=rank>=max, locked=s.level<level, key=bindings[skill.id];
    const description=String(skill.description||'').replace(/^(主动技能〔\d+〕|被动技能)。/,'');
    const actionText=full?'已精通':locked?`等级 ${level} 解锁`:rank?'提升技能':'学习技能';
    return `<article class="ar-p-skill ${rank?'':'ar-p-unlearned'}"><div class="ar-p-skill-mark">${pict(skillArt[skill.id],'skills')}</div><div class="ar-p-skill-detail"><small>ART · ${String(i+1).padStart(2,'0')}</small><span class="ar-p-skill-binding">${key?'主动 · '+keycap(key):'被动'}${rank?'':' · 未习得'}</span><h4>${safe(skill.name)}</h4><p>${safe(description)}</p><span class="ar-p-ranks" aria-label="等级 ${rank} / ${max}">${Array.from({length:max},(_,j)=>`<i class="${j<rank?'on':''}"></i>`).join('')}<b>${rank} / ${max}</b></span></div>${btn('learn',skill.id,actionText,full||locked||!s.skillPoints)}</article>`;
  }).join('')}</div>`;
}

const atlasPoint = n => Math.max(0,Math.min(112,56+Number(n || 0)));
const landmarks=[{x:0,z:16,name:'苍岚古道'},{x:0,z:-40,name:'古道关隘'},{x:-28,z:-35,name:'灰冠遗迹'},{x:30,z:-14,name:'回声祭坛'}];
function renderMap(s){
 const pin=(e,shape)=>`<g transform="translate(${atlasPoint(e.x)} ${atlasPoint(e.z)})"><title>${safe(e.name || '行者')}</title>${shape}</g>`;
 return `<div class="ar-p-map-layout"><div class="ar-p-atlas">
 <svg viewBox="0 0 112 112" role="img" aria-label="苍岚之境区域地图，古道、遗迹、祭坛与角色位置">
 <image href="./art/map.svg" width="112" height="112"/><rect width="112" height="112" fill="#203a32" opacity=".23"/>
 ${landmarks.map((p,i)=>`<g transform="translate(${atlasPoint(p.x)} ${atlasPoint(p.z)})"><path d="m0-1.9 1.9 1.9-1.9 1.9L-1.9 0z" fill="#ffe1a4" stroke="#25352e" stroke-width=".45"/><text x="0" y="${i===0?6:-3.4}" text-anchor="middle" font-size="3.2" fill="#fff1ce" stroke="#263a31" stroke-width=".8" paint-order="stroke" letter-spacing=".25">${p.name}</text></g>`).join('')}
 ${(s.enemies||[]).filter(e=>e.hp>0).map(e=>pin(e,e.elite?'<path d="m0-1.5 1.7 3h-3.4z" fill="#e29875" stroke="#30342a" stroke-width=".35"/>':'<circle r=".95" fill="#e69b76" stroke="#30342a" stroke-width=".35"/>')).join('')}
 ${(s.drops||[]).map(d=>pin(d,'<path d="m0-1.3 1.3 1.3L0 1.3-1.3 0z" fill="#b9df9e" stroke="#30342a" stroke-width=".35"/>')).join('')}
 ${pin(s.player || {},`<circle r="3.1" fill="#8ddfca" opacity=".29"/><path transform="rotate(${number((s.player?.yaw||0)*180/Math.PI)})" d="M0-2.6 1.85 1.8 0 1-1.85 1.8z" fill="#aaffe6" stroke="#173f38" stroke-width=".5"/>`)}
 <g transform="translate(105 7)" fill="#e9d5a7" stroke="#2c4439" stroke-width=".35" paint-order="stroke"><path d="M0 1-1.4 5 0 4l1.4 1z"/><text x="0" y="0" text-anchor="middle" font-size="3" font-family="Georgia">N</text></g></svg></div>
 <aside class="ar-p-map-side"><small class="ar-p-micro">REGIONAL ATLAS</small><h3>苍岚之境</h3><p>所在区域<br><strong>${safe(s.region || '行者营地')}</strong></p>${label('图例','LEGEND')}<ul class="ar-p-legend"><li><i class="player"></i>你的位置</li><li><i class="place"></i>地标</li><li><i class="foe"></i>守卫</li><li><i class="boss"></i>精英敌人</li><li><i class="drop"></i>掉落装备</li></ul></aside></div>`;
}
function renderJournal(s){
 const quests=s.quests?.length?s.quests:[s.quest].filter(Boolean);
 return `<div class="ar-p-note-line ar-p-note-wide">主线进度 <strong>${quests.filter(q=>q.done).length} <em>/ ${quests.length}</em></strong></div><div class="ar-p-quests">${quests.map((q,i)=>{
    const current=!q.done&&q.title===s.quest?.title;
    return `<article class="ar-p-quest ${current?'ar-p-tracked':''}"><div class="ar-p-quest-number">${q.done?icon('check'):String(i+1).padStart(2,'0')}</div><div><small>${q.done?'已完成':current?'追踪中':'后续目标'}</small><h4>${safe(q.title)}</h4><p>${safe(q.description)}</p></div><strong>${number(q.current)} / ${number(q.total)}</strong></article>`;
 }).join('')}</div>`;
}
function renderPause(s, confirmReset) {
 const touch = window.matchMedia('(pointer: coarse)').matches;
 const rows=touch?[['左侧摇杆','移动角色'],['拖动场景','转动视角'],['普通攻击','挥剑攻击'],['破风斩 / 震地击','施放主动技能'],['生命药水','使用药水'],['闪避','翻滚回避'],['拾取按钮','拾取装备'],['功能图标','角色、行囊与任务']]:[['W A S D','移动角色'],['拖动 / 滚轮','转动 / 缩放视角'],['Shift','按住疾跑'],['左键 / J / 1','挥剑攻击'],['空格','闪避'],['2 / 4','破风斩 / 震地击'],['3','使用药水'],['E','拾取装备'],['C / I / K','角色 / 行囊 / 技能'],['L / M / Esc','任务 / 地图 / 设置']];
 const switches=Object.entries(preferences).map(([op,name])=>`<div><label id="ar-option-${op}">${name}</label><button type="button" aria-labelledby="ar-option-${op}" data-op="${op}" class="ar-p-switch" role="switch" aria-checked="${!!s[op]}"><i></i>${s[op]?'开启':'关闭'}</button></div>`).join('');
 const lastSave=s.savedAt?new Date(s.savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'尚未存档';
 return `<div class="ar-p-pause"><section>${label('操作指南','CONTROLS')}<div class="ar-p-controls">${rows.map(([key,desc])=>`<div><span>${desc}</span>${keycap(key)}</div>`).join('')}</div></section><section>${label('旅途选项','OPTIONS')}
    <div class="ar-p-options">${switches}
    <div><span>本地存档 <small>${safe(lastSave)}</small></span>${btn('save','','保存进度')}</div></div>
    <div class="ar-p-pause-actions">${btn('close','',`继续旅途 ${icon('arrow')}`,false,'ar-p-primary')}${confirmReset?`<div class="ar-p-confirm" role="alert"><strong>重新开始旅途？</strong><p>当前角色与探索进度将被重置。</p><div>${btn('restart','','确认重置',false,'ar-p-danger')}${btn('cancel','','取消',false,'ar-p-quiet')}</div></div>`:btn('confirm','','重新开始',false,'ar-p-quiet')}</div>
  </section></div>`;
}

export function createPanels(container,{getState,action,setPaused,onClose}){
 container.classList.add('ar-panels');
 container.hidden=true;
 let active=null, previousFocus=null, resetPending=false, lastSignature='';
 let inspecting=false, releaseModel=null;
 const renderers={character:s=>inspecting?inspectMarkup():renderCharacter(s),inventory:renderInventory,skills:renderSkills,map:renderMap,journal:renderJournal,pause:s=>renderPause(s,resetPending)};
 const close=()=>{
    if(!active) return;
    active=null;
    releaseModel?.(); releaseModel=null; inspecting=false;
    resetPending=false;
    lastSignature='';
    container.hidden=true;
    container.innerHTML='';
    setPaused(false);
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    onClose?.();
 };
 function refresh(force=false){
    if(!active) return;
    const state=getState();
    if(!state) return;
    const signatures={
      character:()=>[inspecting,state.equipped,state.level,state.xp,state.stats,state.statPoints,state.attack,state.defense,state.maxHp,state.maxStamina],
      inventory:()=>[state.inventory,state.equipped],
      skills:()=>[state.level,state.skillPoints,state.skills],
      map:()=>[state.region,state.player,state.enemies?.map(e=>[e.id,Math.round(e.x*5),Math.round(e.z*5),e.hp>0]),state.drops],
      journal:()=>[state.quests,state.quest],
      pause:()=>[state.audio,state.showFps,state.showHints,state.savedAt,resetPending]
    };
    const signature=active+JSON.stringify(signatures[active]());
    if(!force&&signature===lastSignature) return;
    lastSignature=signature;
    const content=container.querySelector('.ar-p-content');
    const oldScroll=content?.scrollTop||0;
    const focused=container.contains(document.activeElement)?document.activeElement:null;
    const op=focused?.dataset.op, arg=focused?.dataset.arg,tab=focused?.dataset.tab;
    releaseModel?.(); releaseModel=null;
    const [title,en]=inspecting?['角色检视','FIELD PORTRAIT']:tabs[active];
    container.innerHTML=`<div class="ar-p-shade" data-op="close"></div><section role="dialog" aria-modal="true" aria-labelledby="ar-p-heading" class="ar-p-window" tabindex="-1">
      <div class="ar-p-body"><nav aria-label="游戏功能" class="ar-p-nav">${Object.entries(tabs).map(([id,[name,,key]])=>`<button type="button" data-tab="${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${pict(tabArt[id],id)}<span>${name}</span><small>${key}</small></button>`).join('')}</nav>
      <div class="ar-p-main"><header class="ar-p-heading"><div><div class="ar-p-micro"><i></i>${en}</div><h2 id="ar-p-heading">${title}</h2></div><button type="button" data-op="close" class="ar-p-close" aria-label="关闭面板">${icon('cross')}</button></header><div class="ar-p-content">${renderers[active](state)}</div></div></div>
      <footer><span class="ar-p-footer-mark">◆</span><span>${safe(state.region || '苍岚之境')}</span><small>LV. ${String(number(state.level)).padStart(2,'0')}</small><span class="ar-p-footer-hint">${keycap('Esc')} 返回游戏</span></footer></section>`;
    container.querySelector('.ar-p-content').scrollTop=oldScroll;
    if(inspecting)releaseModel=mountInspector(container.querySelector('.ar-model'),state);
    const target=[...container.querySelectorAll('button')].find(el=>tab?el.dataset.tab===tab:(op&&el.dataset.op===op&&el.dataset.arg===arg));
    if(target&&!target.disabled) target.focus({preventScroll:true});
    else if (focused) container.querySelector('.ar-p-nav .active').focus({preventScroll:true});
 }
 function open(requested='pause'){
    const id=aliases[requested]||requested;
    if(!tabs[id]) return;
    if(!active){
      previousFocus=document.activeElement;
      setPaused(true);
      container.hidden=false;
    }
    if(id!==active){
      const oldContent=container.querySelector('.ar-p-content');
      if(oldContent)oldContent.scrollTop=0;
    }
    active=id; inspecting=false;
    resetPending=false;
    refresh(true);
    container.querySelector('.ar-p-nav .active')?.focus({preventScroll:true});
 }
 container.addEventListener('click',e=>{
    if(!active) return;
    const el=e.target.closest('[data-tab],[data-op]');
    if(!el || el.disabled) return;
    if(el.dataset.tab){open(el.dataset.tab);return;}
    const op=el.dataset.op;
    if(op==='close'){close();return;}
    if(op==='inspect'||op==='inspect-back'){
      inspecting=op==='inspect'; refresh(true);
      container.querySelector(inspecting?'.ar-model canvas':'[data-op=inspect]')?.focus({preventScroll:true}); return;
    }
    if(op==='confirm'||op==='cancel'){resetPending=op==='confirm';refresh(true);return;}
    if(op==='restart'){
      if(!resetPending)return;
      action(op);close();return;
    }
    if(Object.hasOwn(preferences,op))action(op,!getState()[op]);
    else action(op,el.dataset.arg);
    refresh(true);
 });
 document.addEventListener('keydown',e=>{
    if(!active)return;
    if (e.code==='Escape'){
      e.preventDefault();e.stopImmediatePropagation();
      if(resetPending){resetPending=false;refresh(true);}
      else close();
      return;
    }
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const hotkey={KeyI:'inventory',KeyC:'character',KeyK:'skills',KeyL:'journal',KeyM:'map'}[e.code];
    if(hotkey){
      e.preventDefault();e.stopImmediatePropagation();
      if(!e.repeat){if(active===hotkey)close();else open(hotkey);}
      return;
    }
    if(e.key==='Tab'){
      const buttons=[...container.querySelectorAll('button:not([disabled])')];
      if(!buttons.length)return;
      if(e.shiftKey && document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}
      else if(!e.shiftKey && document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}
    }
 },true);
 return {open,close,refresh,get active(){return active;}};
}
