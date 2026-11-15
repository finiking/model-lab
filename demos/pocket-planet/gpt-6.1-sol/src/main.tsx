import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Scene } from './Scene';
import { actions, snapshot, subscribe, world } from './world';
import './style.css';

function Icon({ name }: { name: 'bloom' | 'meteor' | 'ice' | 'sun' | 'orbit' | 'drag' }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'bloom' && <><path d="M16 28V15M16 23C5 23 5 14 5 14s11-1 11 9ZM16 18c0-9 10-10 10-10s2 11-10 10Z" /><path d="M16 13c-6-4-5-10-1-11 5 3 6 7 1 11Z" /></>}
    {name === 'meteor' && <><path d="m11 20 15-15M4 18 18 4M16 27l12-12M21 19l7-7" /><circle cx="10" cy="23" r="6" /><path d="m8 21 3 1-1 3" /></>}
    {name === 'ice' && <><path d="M16 2v28M4 9l24 14M4 23 28 9M11 5l5 5 5-5M11 27l5-5 5 5M5 14l7-2-1-7M27 18l-7 2 1 7M5 18l7 2-1 7M27 14l-7-2 1-7" /></>}
    {name === 'sun' && <><circle cx="16" cy="16" r="6" /><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" /></>}
    {name === 'orbit' && <><circle cx="16" cy="16" r="9" /><ellipse cx="16" cy="16" rx="14" ry="5" transform="rotate(-35 16 16)" /><path d="M16 1v5M16 26v5M1 16h5M26 16h5" /></>}
    {name === 'drag' && <><path d="M5 16h22M9 12l-4 4 4 4M23 12l4 4-4 4" /><circle cx="16" cy="16" r="3" /></>}
  </svg>;
}
const chapters = {
  garden: { num: '01', title: 'A world, coming alive.', detail: 'SPRING BLOOM', color: '#a9cf9e' },
  meteor: { num: '02', title: 'A little cosmic chaos.', detail: 'CELESTIAL IMPACT', color: '#e9a270' },
  ice: { num: '03', title: 'The quiet of the poles.', detail: 'POLAR REVERIE', color: '#8fd4d0' },
  dawn: { num: '04', title: 'Let there be morning.', detail: 'SOLAR DAWN', color: '#e7c690' },
};
function HUD() {
  useSyncExternalStore(subscribe, snapshot);
  const temp = useRef<HTMLSpanElement>(null); const life = useRef<HTMLSpanElement>(null);
  const rail = useRef<HTMLSpanElement>(null); const lifeBar = useRef<HTMLDivElement>(null);
  const era = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id: number;
    const update = () => {
      if (temp.current) temp.current.textContent = `${Math.round(23 - world.ice * 42 + (world.time - world.meteorAt < 4 ? 4 : 0))}°`;
      if (life.current) life.current.textContent = `${Math.round(64 + world.spring * 32 - world.ice * 12)}%`;
      if (rail.current) rail.current.textContent = `${(16 + world.spring * 18 - world.ice * 7).toFixed(0)} km/h`;
      if (lifeBar.current) lifeBar.current.style.width = `${64 + world.spring * 32 - world.ice * 12}%`;
      if (era.current) era.current.textContent = `ERA ${String(Math.floor(world.time * 2) + 1).padStart(4, '0')}`;
      id = requestAnimationFrame(update);
    }; id = requestAnimationFrame(update); return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input,button')) return;
      if (event.key === '1') actions.bloom(); if (event.key === '2') actions.meteor();
      if (event.key === '3') actions.ice(); if (event.key === '4') actions.solar();
      if (event.key.toLowerCase() === 'r') actions.reset();
    }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const chapter = chapters[world.mode];
  return <main className="hud">
    <header className="masthead"><a className="brand" href="#" aria-label="Pocket Planet home" onClick={event => { event.preventDefault(); actions.reset(); }}><span className="brand-mark"><Icon name="orbit" /></span><span>ATELIER <i>cosmos</i><small>OBJECTS OF SMALL WONDER</small></span></a><div className="collection">THE ASTROLABE COLLECTION <span> / </span> Nº 004</div><div className="live-status"><i /> LIVING SIMULATION <span ref={era}>ERA 0001</span></div></header>
    <section className="introduction"><div className="eyebrow">掌中造物星盘 · 微缩行星演化球</div><h1>Pocket<br /><em>Planet.</em></h1><p>An entire world.<br />A little room for wonder.</p><span className="edition">BRASS & GLASS EDITION</span></section>
    <section className="god-controls" aria-label="God mode controls">
      <div className="section-heading"><span>THE ELEMENTS</span><span>YOUR HAND, THEIR WORLD</span></div>
      <button id="bloom" className={`element-control ${world.mode === 'garden' && world.blooms > 0 ? 'active bloom' : ''}`} onClick={actions.bloom} aria-label="Spring Bloom / Terraforming" aria-pressed={world.mode === 'garden' && world.blooms > 0}><span className="control-icon"><Icon name="bloom" /></span><span className="control-copy"><strong>Spring bloom</strong><small>Plant a little possibility.</small></span><span className="control-key">01</span></button>
      <button id="meteor" className={`element-control ${world.mode === 'meteor' ? 'active meteor' : ''}`} onClick={() => actions.meteor()} aria-label="Meteor Strike"><span className="control-icon"><Icon name="meteor" /></span><span className="control-copy"><strong>Meteor strike</strong><small>Make a beautiful mess.</small></span><span className="control-key">02</span></button>
      <button id="ice" className={`element-control ${world.iceTarget > .5 ? 'active ice' : ''}`} onClick={actions.ice} aria-label="Polar Ice Age & Aurora" aria-pressed={world.iceTarget > .5}><span className="control-icon"><Icon name="ice" /></span><span className="control-copy"><strong>Polar ice age</strong><small>Let the auroras in.</small></span><span className="control-key">03</span></button>
      <div className="solar-control"><button id="solar" aria-label="Solar Dawn / Day-Night Astrolabe Dial" onClick={actions.solar}><Icon name="sun" /><strong>Chase the light</strong><span>04</span></button><label htmlFor="solar-dial" className="sr-only">Solar day night dial</label><input id="solar-dial" type="range" min="0" max="100" value={world.dial} onChange={event => actions.dial(Number(event.target.value))} aria-valuetext={world.dial > 65 ? 'Bioluminescent night' : 'Golden daylight'} /><div className="dial-labels"><span>GOLDEN DAWN</span><span>MIDNIGHT</span></div></div>
    </section>
    <aside className="field-notes"><span className="eyebrow">FIELD NOTES / LIVE</span><h2>A delicate<br /><em>balance.</em></h2><div className="metric"><span>Surface temperature</span><strong ref={temp}>23°</strong><small>CELSIUS</small></div><div className="metric biodiversity"><span>Vitality index</span><strong ref={life}>69%</strong><div className="life-track"><div ref={lifeBar} /></div><small>EVERY LITTLE LIFE COUNTS</small></div><div className="train-note"><span className="rail-symbol">╎ ▰ ▰ ▰ ┄┄┄</span><span>THE EQUATOR EXPRESS</span><p>Next stop: around the world.</p><strong ref={rail}>19 km/h</strong><i /></div><div className="specimen"><span>SPECIMEN PP–004</span><p>One planet. Infinite beginnings.</p><div className="specimen-lines">∣∣│∣│∣∣│∣│∣∣│∣∣│∣│∣</div></div></aside>
    <div className="specimen-tag"><span className="tiny-cross">+</span><span>VIVARIUM<br /><b>Ø 12.8 CM</b></span><i /></div>
    <div className="chapter" style={{ '--chapter-color': chapter.color } as React.CSSProperties}><span className="chapter-index">{chapter.num}<i>/ 04</i></span><div><span>{chapter.detail}</span><p>{chapter.title}</p></div></div>
    <footer><div className="interaction-hints"><span><Icon name="drag" /> DRAG TO TURN</span><b>·</b><span>SCROLL TO EXPLORE</span><b>·</b><span>CLICK TO IMPACT</span></div><button id="reset" onClick={actions.reset} aria-label="Reset the planet">↺ <span>BEGIN AGAIN</span></button><span className="footer-quote">Handle with curiosity.</span></footer>
  </main>;
}
function App() { return <><Scene /><HUD /></>; }
createRoot(document.getElementById('root')!).render(<App />);
