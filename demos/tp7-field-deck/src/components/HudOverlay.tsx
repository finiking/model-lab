import React, { useEffect, useState } from 'react';
import { tp7Audio } from '../audio/tp7AudioEngine';
import { setCameraPreset, subscribeTP7, tp7State, type CameraPreset } from '../state/tp7Store';

interface HudSnapshot {
  tapeVelocity: number;
  isPlaying: boolean;
  isScratching: boolean;
  isRecArmed: boolean;
  tapeDirtMode: boolean;
  rockerState: string;
  cameraPreset: CameraPreset;
  audioUnlocked: boolean;
  audioMuted: boolean;
  vuMax: number;
}

function takeSnapshot(): HudSnapshot {
  return {
    tapeVelocity: tp7State.tapeVelocity,
    isPlaying: tp7State.isPlaying,
    isScratching: tp7State.isScratching,
    isRecArmed: tp7State.isRecArmed,
    tapeDirtMode: tp7State.tapeDirtMode,
    rockerState: tp7State.rockerState,
    cameraPreset: tp7State.cameraPreset,
    audioUnlocked: tp7State.audioUnlocked,
    audioMuted: tp7State.audioMuted,
    vuMax: Math.max(tp7State.vuLeft, tp7State.vuRight),
  };
}

const pillStyle: React.CSSProperties = {
  background: 'rgba(248, 250, 252, 0.78)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(26, 29, 34, 0.14)',
  borderRadius: '8px',
  boxShadow: '0 4px 16px rgba(15, 20, 28, 0.08)',
};

export const HudOverlay: React.FC = () => {
  const [snap, setSnap] = useState<HudSnapshot>(() => takeSnapshot());

  useEffect(() => {
    const sync = () => setSnap(takeSnapshot());
    const unsub = subscribeTP7(sync);
    const id = window.setInterval(sync, 66);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const absV = Math.abs(snap.tapeVelocity);
  const velLabel = snap.isScratching && absV < 0.08
    ? 'BRAKE'
    : `${snap.tapeVelocity < -0.02 ? '-' : '+'}${absV.toFixed(2)}x`;

  const velColor =
    snap.tapeVelocity < -0.05
      ? '#ff4f00'
      : absV < 0.08
        ? '#d97706'
        : '#0f766e';

  const presets: Array<{ id: CameraPreset; label: string }> = [
    { id: 'hero', label: 'HERO' },
    { id: 'reel', label: 'REEL' },
    { id: 'rocker', label: 'ROCKER' },
    { id: 'top', label: 'TOP' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '18px 22px',
        zIndex: 10,
      }}
    >
      {/* Top Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        {/* Left Identity & Live Telemetry Badge */}
        <div
          style={{
            ...pillStyle,
            pointerEvents: 'auto',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: snap.isRecArmed ? '#ff3d00' : '#ff4f00',
                boxShadow: snap.isRecArmed ? '0 0 10px #ff3d00' : 'none',
                display: 'inline-block',
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', color: '#181b20' }}>
              TP–7 // FIELD DECK
            </span>
          </div>

          <span style={{ width: '1px', height: '16px', background: 'rgba(24,27,32,0.16)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 700 }}>
            <span style={{ color: velColor, minWidth: '58px' }}>{velLabel}</span>
            <span style={{ color: '#4b5563' }}>
              {snap.tapeDirtMode ? '78 TAPE' : '84 BPM LO-FI'}
            </span>
          </div>
        </div>

        {/* Right Controls: Audio Toggle & Camera Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => {
              tp7Audio.unlock();
              if (snap.audioUnlocked) {
                tp7Audio.setMuted(!snap.audioMuted);
              }
            }}
            style={{
              ...pillStyle,
              cursor: 'pointer',
              padding: '9px 13px',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 700,
              color: !snap.audioUnlocked ? '#ff4f00' : snap.audioMuted ? '#6b7280' : '#181b20',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: !snap.audioUnlocked ? '#ff4f00' : snap.audioMuted ? '#9ca3af' : '#10b981',
              }}
            />
            {!snap.audioUnlocked ? 'ENABLE AUDIO' : snap.audioMuted ? 'MUTED' : 'AUDIO ON'}
          </button>

          <div
            style={{
              ...pillStyle,
              padding: '4px',
              display: 'flex',
              gap: '3px',
            }}
          >
            {presets.map((p) => {
              const active = snap.cameraPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCameraPreset(p.id)}
                  style={{
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    background: active ? '#1c2026' : 'transparent',
                    color: active ? '#f8fafc' : '#4b5563',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Minimal Hint Strip */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            ...pillStyle,
            padding: '7px 14px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#374151',
            letterSpacing: '0.03em',
          }}
        >
          DRAG METAL REEL: BRAKE &amp; SCRATCH · ORANGE KEYS: REC / PLAY / STOP · LEFT ROCKER: CUE / REW · DRAG DESK: ORBIT
        </div>
      </div>
    </div>
  );
};
