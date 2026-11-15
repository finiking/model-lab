// All sounds are synthesized locally. Nothing is fetched or started on page load.
const PREFERENCE = 'ashen-reach.sound.v1';
const GESTURES = ['pointerdown', 'touchend', 'keydown'];

export function createAudio() {
  let enabled = true;
  try { enabled = localStorage.getItem(PREFERENCE) !== 'off'; } catch {}
  let context, master, ambience, effects, echo, windBuffer, musicTimer;
  let granted = false, paused = false, disposed = false, pageHidden = false;
  const sources = new Set();
  const lastPlayed = new Map();
  let phrase = 0;

  function retain(source, ...nodes) {
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      nodes.forEach(node => node.disconnect());
    };
    return source;
  }

  function init() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    context = new Context();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    effects = context.createGain();
    effects.gain.value = 0.48;
    effects.connect(master);
    ambience = context.createGain();
    ambience.gain.value = 0.42;
    ambience.connect(master);

    // Single faint reflection gives the strings and steel some open-air distance.
    echo = context.createDelay();
    echo.delayTime.value = 0.27;
    const reflection = context.createGain();
    reflection.gain.value = 0.12;
    const air = context.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 1700;
    echo.connect(air).connect(reflection).connect(ambience);

    const samples = Math.floor(context.sampleRate * 3);
    windBuffer = context.createBuffer(1, samples, context.sampleRate);
    const data = windBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const wind = context.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    const trees = context.createBiquadFilter();
    trees.type = 'bandpass';
    trees.frequency.value = 505;
    trees.Q.value = 0.31;
    const breeze = context.createGain();
    breeze.gain.value = 0.058;
    wind.connect(trees).connect(breeze).connect(ambience);
    const gust = context.createOscillator(), depth = context.createGain();
    gust.frequency.value = 0.075;
    depth.gain.value = 0.022;
    gust.connect(depth).connect(breeze.gain);
    retain(wind, trees, breeze).start();
    retain(gust, depth).start();
    return true;
  }

  function tone(freq, length, volume, options = {}) {
    const t = context.currentTime + (options.delay || 0);
    const oscillator = context.createOscillator(), envelope = context.createGain();
    const attack = Math.min(length / 3, options.attack || 0.008);
    oscillator.type = options.wave || 'sine';
    oscillator.frequency.setValueAtTime(freq, t);
    if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, t + length);
    envelope.gain.setValueAtTime(0.00001, t);
    envelope.gain.exponentialRampToValueAtTime(volume, t + attack);
    envelope.gain.exponentialRampToValueAtTime(0.00001, t + length);
    oscillator.connect(envelope).connect(options.ambient ? ambience : effects);
    if (options.echo) envelope.connect(echo);
    retain(oscillator, envelope).start(t);
    oscillator.stop(t + length + 0.012);
  }

  function sweep(from, to, length, volume, delay = 0, q = 0.8) {
    const t = context.currentTime + delay;
    const src = context.createBufferSource(), filter = context.createBiquadFilter();
    const envelope = context.createGain();
    src.buffer = windBuffer;
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + length);
    envelope.gain.setValueAtTime(0.00001, t);
    envelope.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.00001, t + length);
    src.connect(filter).connect(envelope).connect(effects);
    retain(src, filter, envelope).start(t, Math.random() * 1.5);
    src.stop(t + length + 0.015);
  }

  function chime(freq, delay, volume) {
    tone(freq, 0.72, volume, {delay, echo: true});
    tone(freq * 2.72, 0.16, volume * 0.17, {delay});
  }

  function schedulePhrase() {
    clearTimeout(musicTimer);
    if (!context || !enabled || paused || document.hidden || pageHidden || disposed) return;
    musicTimer = setTimeout(() => {
      if (context.state === 'running') {
        const notes = [[146.83, 220], [196, 293.66], [164.81, 246.94], [130.81, 196]];
        const [bass, higher] = notes[phrase++ % notes.length];
        tone(bass, 2.8, 0.067, {ambient: true, wave: 'triangle', attack: 0.09, echo: true});
        tone(bass * 2, 1.1, 0.018, {ambient: true, echo: true});
        tone(higher, 2.2, 0.042, {ambient: true, delay: 0.47, echo: true});
      }
      schedulePhrase();
    }, (phrase === 0 ? 3200 : 7500) + Math.random() * 4600);
  }

  function sync() {
    clearTimeout(musicTimer);
    if (!context || disposed || context.state === 'closed') return;
    if (!enabled || !granted || pageHidden || document.hidden) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.value = 0;
      if (context.state !== 'suspended') context.suspend().catch(() => {});
      return;
    }
    const t = context.currentTime;
    master.gain.setTargetAtTime(0.69, t, 0.05);
    ambience.gain.setTargetAtTime(paused ? 0.16 : 0.42, t, 0.20);
    if (context.state !== 'running') {
      context.resume().then(() => {
        if (disposed || !enabled || document.hidden || pageHidden) return;
        if (context.state === 'running') detachGestures();
      }).catch(() => {});
    } else detachGestures();
    schedulePhrase();
  }

  function detachGestures() {
    for (const name of GESTURES) window.removeEventListener(name, unlock, true);
  }

  function unlock(event) {
    if (disposed || event?.isTrusted === false) return;
    if (!granted && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    granted = true;
    if (!enabled || document.hidden || pageHidden) return;
    try {
      if (!context && !init()) return;
      if (context.state !== 'running' || master.gain.value === 0) sync();
    } catch {}
  }

  function toggle() {
    if (disposed) return false;
    enabled = !enabled;
    try { localStorage.setItem(PREFERENCE, enabled ? 'on' : 'off'); } catch {}
    if (enabled) unlock();
    sync();
    return enabled;
  }

  function setPaused(value) {
    if (Boolean(value) === paused) return;
    paused = Boolean(value);
    sync();
  }

  function play(name) {
    if (!enabled || !granted || disposed || document.hidden || pageHidden || context?.state !== 'running') return;
    if (paused && !['ui','equip','learn','stat','save'].includes(name)) return;
    const now = context.currentTime;
    if (now - (lastPlayed.get(name) ?? -1) < 0.065) return;
    lastPlayed.set(name, now);
    switch (name) {
      case 'attack':
        sweep(560, 2550, 0.115, 0.51);
        sweep(1470, 430, 0.12, 0.31, 0.06);
        break;
      case 'sword2':
        sweep(2450, 570, 0.125, 0.45);
        sweep(780, 1940, 0.085, 0.25, 0.045);
        break;
      case 'sword3':
        sweep(1320, 280, 0.19, 0.51, 0, 0.55);
        sweep(2650, 710, 0.095, 0.31, 0.032);
        break;
      case 'quake':
        // Rock shears at contact, followed by the low shock and scattered grit.
        sweep(1900, 290, 0.105, 0.49);
        tone(112, 0.29, 0.41, {to: 46, wave: 'triangle'});
        sweep(510, 105, 0.27, 0.39, 0.018, 0.52);
        sweep(2380, 690, 0.13, 0.22, 0.092, 0.66);
        break;
      case 'hit':
      case 'impact':
      case 'hurt':
        tone(102, 0.16, 0.35, {to: 42, wave: 'triangle'});
        sweep(1520, 260, 0.11, 0.52);
        break;
      case 'dodge':
        sweep(1440, 320, 0.245, 0.41, 0, 0.48);
        break;
      case 'skill':
        sweep(330, 3000, 0.28, 0.52, 0, 1.15);
        tone(220, 0.35, 0.145, {to: 587.33, wave: 'triangle', echo: true});
        chime(880, 0.19, 0.095);
        break;
      case 'pickup':
      case 'loot':
      case 'equip':
        chime(783.99, 0, 0.12);
        chime(1174.66, 0.073, 0.1);
        break;
      case 'levelup':
      case 'learn':
      case 'victory':
        [293.66, 392, 493.88, 587.33].forEach((f, i) => chime(f, i * 0.145, 0.17));
        break;
      case 'death':
        tone(146.83, 1.7, 0.20, {wave: 'triangle', to: 73.41, echo: true});
        tone(110, 1.4, 0.095, {delay: 0.23, to: 55});
        break;
      case 'heal':
        tone(349.23, 0.50, 0.12, {attack: 0.06, echo: true});
        tone(523.25, 0.80, 0.10, {delay: 0.115, attack: 0.08, echo: true});
        break;
      case 'save':
      case 'stat':
      case 'ui':
        tone(440, 0.08, 0.09, {to: 349.23, wave: 'triangle'});
        break;
    }
  }

  function pageHide(event) {
    pageHidden = true;
    if (event.persisted) sync();
    else destroy();
  }
  function pageShow() { pageHidden = false; sync(); }

  function destroy() {
    if (disposed) return;
    disposed = true;
    clearTimeout(musicTimer);
    detachGestures();
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pagehide', pageHide);
    window.removeEventListener('pageshow', pageShow);
    for (const source of sources) {
      try { source.stop(); } catch {}
    }
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }

  for (const name of GESTURES) window.addEventListener(name, unlock, {passive: true, capture: true});
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('pageshow', pageShow);
  return {unlock, toggle, get enabled() { return enabled; }, play, setPaused, destroy};
}
