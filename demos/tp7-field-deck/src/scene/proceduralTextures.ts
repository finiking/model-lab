import * as THREE from 'three';

export interface BrushedMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(1664525, a) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

// Create Faceplate Brushed Aluminum maps mapped directly to body coordinates [-W/2..W/2, -H/2..H/2]
export function createFaceplateMaps(widthCm = 6.8, heightCm = 9.6): BrushedMaps {
  const cw = 1024;
  const ch = Math.round((cw * heightCm) / widthCm); // 1446
  const rng = seededRand(0x414c5531);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = cw;
  colorCanvas.height = ch;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = cw;
  roughCanvas.height = ch;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = cw;
  bumpCanvas.height = ch;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base bright natural silver anodized aluminum
  cCtx.fillStyle = '#e5e8ee';
  cCtx.fillRect(0, 0, cw, ch);

  rCtx.fillStyle = '#464646'; // ~0.27 roughness baseline
  rCtx.fillRect(0, 0, cw, ch);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, cw, ch);

  // Horizontal directional CNC brushed aluminum hairline grain
  for (let y = 0; y < ch; y++) {
    const band = (rng() - 0.5) * 9;
    const tone = Math.round(229 + band);
    cCtx.fillStyle = `rgb(${tone},${tone + 2},${tone + 5})`;
    cCtx.fillRect(0, y, cw, 1);

    const rTone = Math.round(68 + (rng() - 0.5) * 18);
    rCtx.fillStyle = `rgb(${rTone},${rTone},${rTone})`;
    rCtx.fillRect(0, y, cw, 1);

    const bTone = Math.round(128 + (rng() - 0.5) * 26);
    bCtx.fillStyle = `rgb(${bTone},${bTone},${bTone})`;
    bCtx.fillRect(0, y, cw, 1);
  }

  // Fine broken micro-scratches along X
  for (let i = 0; i < 4200; i++) {
    const x = rng() * cw;
    const y = rng() * ch;
    const len = 30 + rng() * 220;
    const alpha = 0.05 + rng() * 0.08;
    const bright = rng() > 0.5 ? 252 : 196;
    cCtx.fillStyle = `rgba(${bright},${bright + 1},${bright + 3},${alpha})`;
    cCtx.fillRect(x, y, len, 1);

    const rVal = rng() > 0.5 ? 85 : 38;
    rCtx.fillStyle = `rgba(${rVal},${rVal},${rVal},0.16)`;
    rCtx.fillRect(x, y, len, 1);

    const bVal = rng() > 0.5 ? 165 : 95;
    bCtx.fillStyle = `rgba(${bVal},${bVal},${bVal},0.18)`;
    bCtx.fillRect(x, y, len, 1);
  }

  // Subtle laser-etched silkscreen typography aligned to 3D hardware coordinates
  const toPxX = (cmX: number) => ((cmX + widthCm * 0.5) / widthCm) * cw;
  const toPxY = (cmY: number) => ((heightCm * 0.5 - cmY) / heightCm) * ch;

  cCtx.save();
  cCtx.fillStyle = 'rgba(38, 42, 48, 0.78)';
  cCtx.font = '700 22px ui-monospace, Menlo, Consolas, monospace';
  cCtx.textBaseline = 'middle';

  // Top jack labels aligned with jacks at x = -2.05, -1.2, -0.35
  cCtx.textAlign = 'center';
  cCtx.fillText('1', toPxX(-2.05), toPxY(4.46));
  cCtx.fillText('2', toPxX(-1.2), toPxY(4.46));
  cCtx.fillText('3', toPxX(-0.35), toPxY(4.46));

  // Brand micro-spec top left below mic perforations
  cCtx.textAlign = 'left';
  cCtx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
  cCtx.fillText('TP–7', toPxX(-2.85), toPxY(2.85));
  cCtx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
  cCtx.fillStyle = 'rgba(42, 46, 54, 0.78)';
  cCtx.fillText('FIELD RECORDER // 7.5 IPS', toPxX(-2.85), toPxY(2.54));

  // Subtle micro-etched "MIC" near acoustic mesh
  cCtx.fillText('MIC', toPxX(-2.85), toPxY(4.12));

  // Right side MEMO indicator label
  cCtx.textAlign = 'right';
  cCtx.fillText('MEMO / TAPE', toPxX(2.92), toPxY(2.62));

  // Orange accent registration dot near TP-7 badge
  cCtx.fillStyle = '#ff4f00';
  cCtx.beginPath();
  cCtx.arc(toPxX(-1.92), toPxY(2.85), 6.5, 0, Math.PI * 2);
  cCtx.fill();

  // Transport micro-labels right above the keybed (buttons sit around y = -3.48)
  cCtx.textAlign = 'center';
  cCtx.fillStyle = 'rgba(38, 42, 50, 0.84)';
  cCtx.font = '700 15px ui-monospace, Menlo, Consolas, monospace';
  cCtx.fillText('REC', toPxX(-1.78), toPxY(-2.48));
  cCtx.fillText('PLAY', toPxX(0.0), toPxY(-2.48));
  cCtx.fillText('STOP', toPxX(1.78), toPxY(-2.48));

  // Tiny engraved arrow for side rocker on left edge
  cCtx.textAlign = 'left';
  cCtx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  cCtx.fillStyle = 'rgba(42, 46, 54, 0.72)';
  cCtx.fillText('▲ CUE', toPxX(-3.16), toPxY(1.48));
  cCtx.fillText('▼ REW', toPxX(-3.16), toPxY(-1.08));
  cCtx.restore();

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 8;

  return { map, roughnessMap, bumpMap };
}

// Generic chassis side/back brushed aluminum maps
export function createChassisMetalMaps(): BrushedMaps {
  const size = 512;
  const rng = seededRand(0x43484153);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = '#e1e5eb';
  cCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#484848';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const tone = Math.round(224 + (rng() - 0.5) * 9);
    cCtx.fillStyle = `rgb(${tone},${tone + 2},${tone + 5})`;
    cCtx.fillRect(0, y, size, 1);

    const r = Math.round(70 + (rng() - 0.5) * 18);
    rCtx.fillStyle = `rgb(${r},${r},${r})`;
    rCtx.fillRect(0, y, size, 1);

    const b = Math.round(128 + (rng() - 0.5) * 26);
    bCtx.fillStyle = `rgb(${b},${b},${b})`;
    bCtx.fillRect(0, y, size, 1);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap, bumpMap };
}

// Lathe-turned concentric brushed aluminum platter + strobe markings + index dot
export function createReelPlatterMaps(): BrushedMaps {
  const size = 1024;
  const cx = size / 2;
  const cy = size / 2;
  const rng = seededRand(0x5245454c);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Radial butterfly anisotropic sheen baked cleanly onto turned metal
  const cImg = cCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const dy = y - cy;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      // Concentric machining rings + subtle radial brushed modulation
      const ringNoise = Math.sin(dist * 1.65) * 4 + Math.sin(dist * 0.48) * 3;
      const butterfly = Math.cos(angle * 2 - 0.6) * 11;
      const fine = (rng() - 0.5) * 6;

      const base = Math.max(198, Math.min(252, Math.round(230 + butterfly + ringNoise + fine)));
      const idx = (y * size + x) * 4;
      cImg.data[idx] = base;
      cImg.data[idx + 1] = Math.min(255, base + 2);
      cImg.data[idx + 2] = Math.min(255, base + 4);
      cImg.data[idx + 3] = 255;

      const rVal = Math.max(36, Math.min(115, Math.round(62 + Math.abs(Math.sin(angle * 2)) * 20 + ringNoise * 1.3)));
      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;

      const bVal = Math.max(80, Math.min(180, Math.round(128 + Math.sin(dist * 2.1) * 20)));
      bImg.data[idx] = bVal;
      bImg.data[idx + 1] = bVal;
      bImg.data[idx + 2] = bVal;
      bImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  // Outer stroboscope ticks & index lines so spin & reverse scratch read crisply
  cCtx.save();
  cCtx.translate(cx, cy);

  // Thin engraved circle tracks
  cCtx.strokeStyle = 'rgba(42, 46, 54, 0.28)';
  cCtx.lineWidth = 2;
  cCtx.beginPath();
  cCtx.arc(0, 0, size * 0.445, 0, Math.PI * 2);
  cCtx.stroke();

  cCtx.beginPath();
  cCtx.arc(0, 0, size * 0.245, 0, Math.PI * 2);
  cCtx.stroke();

  // 60 radial strobe tick marks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const isMajor = i % 5 === 0;
    const r0 = size * (isMajor ? 0.422 : 0.436);
    const r1 = size * 0.456;
    cCtx.strokeStyle = isMajor ? 'rgba(30, 34, 40, 0.65)' : 'rgba(55, 60, 68, 0.36)';
    cCtx.lineWidth = isMajor ? 3 : 1.5;
    cCtx.beginPath();
    cCtx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    cCtx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    cCtx.stroke();
  }

  // 3 milled radial hairlines (120 degrees apart)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    cCtx.strokeStyle = 'rgba(45, 50, 58, 0.35)';
    cCtx.lineWidth = 2.5;
    cCtx.beginPath();
    cCtx.moveTo(Math.cos(a) * size * 0.14, Math.sin(a) * size * 0.14);
    cCtx.lineTo(Math.cos(a) * size * 0.38, Math.sin(a) * size * 0.38);
    cCtx.stroke();
  }

  // Crisp Signal Orange index dot & marker stripe (high-contrast visual anchor during scratch)
  cCtx.fillStyle = '#ff4f00';
  cCtx.beginPath();
  cCtx.arc(size * 0.34, 0, 14, 0, Math.PI * 2);
  cCtx.fill();

  cCtx.strokeStyle = '#ff4f00';
  cCtx.lineWidth = 5;
  cCtx.beginPath();
  cCtx.moveTo(size * 0.39, 0);
  cCtx.lineTo(size * 0.465, 0);
  cCtx.stroke();

  // Micro etched curved text on platter
  cCtx.fillStyle = 'rgba(38, 42, 50, 0.68)';
  cCtx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
  cCtx.textAlign = 'center';
  cCtx.textBaseline = 'middle';
  cCtx.fillText('SERVO · 7.5 IPS', 0, -size * 0.175);
  cCtx.fillText('TP-7 TAPE REEL', 0, size * 0.175);

  cCtx.restore();

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 8;

  return { map, roughnessMap, bumpMap };
}

// Precision charcoal wool/elastomer desk mat with ruler scale
export function createDeskMatTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 768;
  const rng = seededRand(0x4d415431);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#24272d';
  ctx.fillRect(0, 0, w, h);

  // Subtle matte acoustic felt/rubber micro-speckle
  for (let i = 0; i < 24000; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const v = rng() > 0.5 ? 46 : 28;
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 5},0.32)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Minimal TE precision architectural border & ruler ticks
  ctx.strokeStyle = 'rgba(185, 194, 206, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, w - 64, h - 64);

  // Millimeter/CM ruler along bottom edge
  ctx.fillStyle = 'rgba(195, 202, 214, 0.42)';
  ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 40; i++) {
    const x = 64 + (i / 40) * (w - 128);
    const major = i % 5 === 0;
    ctx.fillRect(x - 0.5, h - 32 - (major ? 16 : 8), 1.5, major ? 16 : 8);
    if (major) {
      ctx.fillText(String(i * 5), x, h - 56);
    }
  }

  // Top-left minimal spec label
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(195, 202, 214, 0.35)';
  ctx.fillText('TE // FIELD DESK PAD 180×135MM', 48, 56);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Live OLED Display Drawer
export interface OledCanvasBundle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

export function createOledBundle(): OledCanvasBundle {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

export function drawOledDisplay(
  bundle: OledCanvasBundle,
  params: {
    displayTimeSec: number;
    tapeVelocity: number;
    isPlaying: boolean;
    isScratching: boolean;
    isRecArmed: boolean;
    tapeDirtMode: boolean;
    vuL: number;
    vuR: number;
    oledPage: 0 | 1 | 2;
  }
): void {
  const { ctx, canvas, texture } = bundle;
  const w = canvas.width;
  const h = canvas.height;

  // Deep matte OLED black background
  ctx.fillStyle = '#07090d';
  ctx.fillRect(0, 0, w, h);

  // Subtle OLED pixel grid hairline
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < h; y += 8) {
    ctx.fillRect(0, y, w, 1);
  }

  const absV = Math.abs(params.tapeVelocity);
  let statusText = 'PLAY';
  let statusColor = '#e6f4ea';
  if (params.isScratching) {
    if (absV < 0.08) {
      statusText = 'BRAKE';
      statusColor = '#ff9d2e';
    } else if (params.tapeVelocity < 0) {
      statusText = 'SCRATCH ◀';
      statusColor = '#ff5a1f';
    } else {
      statusText = 'SCRATCH ▶';
      statusColor = '#66f5b4';
    }
  } else if (params.tapeVelocity < -0.2) {
    statusText = '◀◀ REW';
    statusColor = '#ff9d2e';
  } else if (params.tapeVelocity > 1.35) {
    statusText = '▶▶ CUE';
    statusColor = '#66f5b4';
  } else if (!params.isPlaying) {
    statusText = 'STOP ■';
    statusColor = '#9aa3b2';
  }

  // Top status pill bar
  ctx.fillStyle = statusColor;
  ctx.fillRect(18, 16, 152, 34);
  ctx.fillStyle = '#07090d';
  ctx.font = '800 21px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statusText, 94, 34);

  // REC badge if armed
  if (params.isRecArmed) {
    ctx.fillStyle = '#ff3d00';
    ctx.beginPath();
    ctx.arc(204, 33, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6d3d';
    ctx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('REC', 222, 34);
  } else {
    ctx.fillStyle = '#8b95a5';
    ctx.font = '700 18px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('84 BPM', 192, 34);
  }

  // Right corner tape mode badge
  ctx.textAlign = 'right';
  ctx.fillStyle = params.tapeDirtMode ? '#ffad42' : '#9fe7ff';
  ctx.font = '700 18px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(params.tapeDirtMode ? '78 TAPE' : 'LO-FI HI', w - 18, 34);

  // Timecode readout
  const sec = Math.max(0, params.displayTimeSec);
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2f6fc';
  ctx.font = '800 58px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(tc, 18, 108);

  // Pitch / Speed multiplier badge
  const sign = params.tapeVelocity < -0.02 ? '-' : '+';
  const velStr = `${absV < 0.02 ? '0.00' : sign + absV.toFixed(2)}x`;
  ctx.textAlign = 'right';
  ctx.fillStyle = params.tapeVelocity < -0.05 ? '#ff6428' : absV < 0.05 ? '#ffaa33' : '#70f5ba';
  ctx.font = '800 34px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(velStr, w - 18, 108);

  // Lower waveform / scope strip
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 152, w - 36, 84);

  const scopeW = w - 52;
  const baseY = 194;
  const barCount = 36;
  const amp = 0.25 + 0.75 * Math.min(1, (params.vuL + params.vuR) * 0.65);

  for (let i = 0; i < barCount; i++) {
    const x = 26 + (i / barCount) * scopeW;
    const phase = i * 0.42 + params.displayTimeSec * (params.tapeVelocity >= 0 ? 7.5 : -7.5);
    const wave =
      Math.abs(Math.sin(phase) * 0.6 + Math.cos(phase * 1.7 + i) * 0.4) *
      amp *
      (params.oledPage === 2 ? 1.15 : 0.95);
    const bh = Math.max(4, Math.min(68, wave * 64));
    ctx.fillStyle = bh > 46 ? '#ff5a1f' : bh > 30 ? '#ffc145' : '#e6eef8';
    ctx.fillRect(x, baseY - bh / 2, Math.max(5, scopeW / barCount - 4), bh);
  }

  texture.needsUpdate = true;
}
