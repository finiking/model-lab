"""Perihelion, a miniature score for wheels, air and a bowed chamber ensemble.

Render with Python 3 and NumPy. All waveforms and the stereo room are synthesized.
"""
from pathlib import Path
import math
import wave
import numpy as np

RATE = 48000
LENGTH = 18
COUNT = RATE * LENGTH
TAU = math.tau
rng = np.random.default_rng(19740322)
dry = np.zeros((COUNT, 2))
send = np.zeros_like(dry)
clock = np.arange(COUNT) / RATE


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def gate(x, attack, release, length):
    return np.sin(np.pi / 2 * np.clip(x / attack, 0, 1)) ** 2 * np.sin(
        np.pi / 2 * np.clip((length - x) / release, 0, 1)) ** 2


def noise_band(n, low, high):
    """Band-limited colored noise with soft skirts, with a reproducible seed."""
    spectrum = np.fft.rfft(rng.normal(size=n))
    freq = np.fft.rfftfreq(n, 1 / RATE)
    hp = 1 - np.exp(-(freq / low) ** 2)
    lp = np.exp(-(freq / high) ** 2)
    signal = np.fft.irfft(spectrum * hp * lp, n=n)
    return signal / max(signal.std(), 1e-6)


def put(at, signal, gain=1, pan=0, room=.16):
    start = int(round(at * RATE))
    stop = min(COUNT, start + len(signal))
    if start < 0 or stop <= start:
        return
    angle = math.pi * .25 * (1 + pan)
    stereo = (signal[:stop - start] * gain)[:, None] * [math.cos(angle), math.sin(angle)]
    dry[start:stop] += stereo
    send[start:stop] += stereo * room


def bowed(at, note, length, level, pan, voice, swell=.28):
    """Rosined string or euphonium: unstable onset, vibrato and shifting partials."""
    x = np.arange(round(length * RATE)) / RATE
    f = hz(note)
    vibrato = (0.0012 if voice == 'horn' else .0024) * np.sin(TAU * (4.36 * x + .14 * np.sin(2*x)))
    vibrato *= 1 - np.exp(-2.8*x)
    drift = .0008*np.sin(4.1*x + note) - .004*np.exp(-x/.067)
    phase = TAU * f * np.cumsum(1 + vibrato + drift) / RATE
    timbre = np.zeros_like(x)
    for h in range(1, 15):
        pitch = h*f
        if voice == 'horn':
            form = .16 + .83*np.exp(-((pitch - 490)/490)**2) + .45*np.exp(-((pitch-1040)/360)**2)
            amp = form / h**1.14
        else:
            form = .3 + .75*np.exp(-((pitch - 630)/480)**2) + .54*np.exp(-((pitch-1700)/780)**2)
            amp = form / h**1.08
        onset = (1 - .66*np.exp(-x/(.07+.008*h))) if h > 2 else 1
        timbre += amp * onset * np.sin(h*phase + .23*np.sin(h*4.7))
    env = gate(x, swell, min(.45, length*.27), length)
    arch = .79 + .21*np.sin(np.pi*x/length)
    if voice == 'bow':
        timbre += .016*noise_band(len(x), 600, 3200) * (.35 + .65*np.exp(-x/.15))
    put(at, timbre * env * arch, level, pan, .33 if voice=='bow' else .27)


def pluck(at, note, level, pan=0, dark=False):
    x = np.arange(int(RATE*1.55)) / RATE
    f = hz(note)
    signal = np.zeros_like(x)
    strike_at = .213 if dark else .177
    for h in range(1, 13):
        mode = abs(np.sin(math.pi*h*strike_at)) / h**1.5
        partial = TAU*f*h * (1+.00007*h*h)*x
        signal += mode*np.exp(-x*(3.0 if dark else 2.55)*h**.54)*np.sin(partial)
    signal *= (1 - np.exp(-x/.004))
    put(at, signal, level, pan, .24)


def thud(at, strength):
    x = np.arange(int(.41*RATE)) / RATE
    phase = TAU*(53*x+1.35*(1-np.exp(-x/.042)))
    impulse = ((np.sin(phase)+.16*np.sin(2*phase))*np.exp(-x*11)
               + .095*noise_band(len(x), 170, 1100)*np.exp(-x*71))
    put(at, impulse*(1-np.exp(-x/.004)), strength, -.04, .10)


def ratchet(at, level, pan, pitch):
    x = np.arange(int(.088*RATE)) / RATE
    body = np.sin(TAU*pitch*x)*np.exp(-x*177) + .38*np.sin(TAU*2.47*pitch*x)*np.exp(-x*225)
    tip = noise_band(len(x), 900, 4200) * np.exp(-x*344)
    put(at, (body+.69*tip)*(1-np.exp(-x/.0007)), level, pan, .13)


def glock(at, note, intensity, pan):
    x = np.arange(round(3.95*RATE)) / RATE
    f = hz(note)
    tone = sum(a*np.sin(TAU*f*r*x)*np.exp(-x/d) for r,a,d in
               [(1,.71,1.35),(2.69,.22,.83),(3.96,.12,.51),(5.24,.07,.23),(8.12,.03,.14)])
    put(at, tone*(1-np.exp(-x/.006)), intensity, pan, .43)


# Wind rises around the camera on the approach, then leaves space for the exposed chord.
for pan in (-.79,.74):
    air = noise_band(COUNT, 175, 1890)
    curtain = np.interp(clock,[0,.8,3,4.4,7.1,7.95,9.6,11.4,13.8,15.2,17,18],
                         [0,.020,.029,.024,.054,.009,.009,.035,.055,.025,.023,0])
    grains = .69+.19*np.sin(clock*2.16+pan*2.4)+.12*np.sin(clock*4.1+pan)
    put(0, air*curtain*grains, .82, pan, .08)

# The lowest register has string harmonics, so the line survives on small speakers.
for at,note,length,level in [(0,38,4.35,.26),(3.93,34,2.03,.26),(5.76,43,2.22,.23),
                              (7.68,38,2.42,.34),(9.71,35,1.93,.28),(11.43,43,1.89,.26),
                              (13.08,38,3.44,.29)]:
    bowed(at,note,length,level,-.07,'horn',.45)

# A small three-note gesture climbs from underneath the wheels, through D minor and Bb.
# Individual parts breathe across barlines. The F# heard at totality is the first major third.
for at,note,length,level,pan in [
    (.49,57,1.54,.084,-.21),(1.75,60,1.09,.10,-.19),(2.55,62,1.65,.15,-.13),
    (4.04,62,1.39,.13,-.24),(5.10,65,1.22,.12,-.18),(5.90,67,1.46,.15,-.16),
    (7.02,69,1.0,.16,-.15),(7.76,74,2.40,.20,-.07),
    (9.87,73,.82,.16,-.13),(10.46,69,1.00,.15,-.21),(11.30,71,1.08,.17,-.14),
    (12.18,74,1.34,.18,-.09),(13.27,78,1.70,.16,-.10),(14.48,74,2.78,.17,-.06)]:
    bowed(at,note,length,level,pan,'horn',min(.25,length*.23))

# Divisi strings are played separately, panned as a little ensemble.
for at,length,notes,weight in [(1.3,2.89,[50,53,64],.070),(4.03,1.95,[53,57,60],.082),
    (5.79,2.18,[55,62,65],.088),(7.64,2.68,[54,57,64,71],.12),
    (9.86,1.83,[54,59,62],.086),(11.43,1.97,[55,59,66],.094),
    (13.23,3.68,[54,57,64,71],.092)]:
    for i,note in enumerate(notes):
        bowed(at+.036*i,note,length-.046*i,weight*(1-.068*i),
              [-.55,.40,-.30,.63][i],'bow',.65 if at<7.5 else .40)

# Muted piano and pizzicato cello imply the rotating crank, with gaps to breathe.
for times,notes,weight in [
    ([.34,.98,1.57,1.88,2.46,3.08,3.38,3.68],[38,50,57,55,38,50,57,60],.23),
    ([4.0,4.50,4.75,5.02,5.53],[46,53,58,62,65],.25),
    ([5.80,6.27,6.51,6.75,6.99,7.23,7.47],[43,55,62,67,65,67,69],.26),
    ([9.83,10.29,10.51,10.74,11.20],[47,54,59,62,66],.25),
    ([11.42,11.86,12.07,12.29,12.51,12.73,12.95],[43,50,55,62,66,67,71],.27),
    ([13.20,13.65,13.88,14.11,14.56,15.02],[50,57,62,66,69,74],.25)]:
    for i,(at,note) in enumerate(zip(times,notes)):
        pluck(at,note,weight*(1 if i==0 else .85), .19*np.sin(i*1.9),note<56)
for at,level in [(1.57,.16),(2.46,.12),(4,.21),(5.04,.11),(5.80,.20),(6.75,.16),
                 (7.23,.12),(7.78,.17),(9.83,.22),(10.74,.16),(11.42,.23),(12.29,.14),
                 (12.73,.15),(13.20,.28),(14.11,.13)]:
    thud(at,level)

# Asymmetry distinguishes the bicycle ratchet from the underlying musical pulse.
at=.035
while at<15.3:
    active=np.interp(at,[0,.5,3.8,6.7,7.72,7.87,9.65,10.25,12.9,14.1,15.3],
                      [.08,.86,.68,.93,.85,.02,.05,.94,1,.5,0])
    speed=np.interp(at,[0,2.1,4.2,7.8,9.6,13,15.3],[8.6,10.4,11,17.6,11,19.3,15])
    level=.043*active*(.72+.28*math.cos(at*6.82))*(.78+.4*rng.random())
    ratchet(at, level, -.39+.52*math.sin(.64*at), 1320+rng.uniform(-300,410))
    if rng.random()<.30:
        ratchet(at+.012,.39*level,-.4+.5*math.sin(.64*at),890+rng.uniform(30,360))
    at+=(1+.065*rng.normal())/speed

# Mechanical release: short shifting pitched air, then a warm bike bell with long space.
x = np.arange(round(2.65*RATE)) / RATE
whoosh=np.exp(-((x-1.13)/.49)**2)
pitch=98+110*(.5-.5*np.tanh((x-1.13)/.25))
phase=TAU*np.cumsum(pitch)/RATE
fly=whoosh*(.33*np.sin(phase)+.10*np.sin(3*phase)+.55*noise_band(len(x),140,1490))
pan=.82*np.tanh((x-1.13)/.4)
for c,angle in enumerate([np.cos((1+pan)*np.pi/4),np.sin((1+pan)*np.pi/4)]):
    start=round(12.75*RATE)
    dry[start:start+len(x),c]+=fly*.15*angle
glock(7.84,81,.074,.24)
glock(14.53,86,.079,-.32)

# A small early-reflection room opens into an asymmetric, low-passed sea-cliff echo.
wet=np.zeros_like(dry)
for delay,gain,cross in [(.037,.22,False),(.058,.16,True),(.094,.12,False),
                         (.133,.100,True),(.193,.08,False),(.264,.055,True)]:
    d=round(delay*RATE)
    wet[d:]+=send[:-d,::-1] * gain if cross else send[:-d] * gain
room_n=round(2.65*RATE)
rt=np.arange(room_n)/RATE
padding=1<<(COUNT+room_n-2).bit_length()
for side in range(2):
    room=noise_band(room_n,160,2900)*np.exp(-rt*3.1)*(1-np.exp(-rt/.029))
    room *= .41/np.linalg.norm(room)
    source=send[:,side]*.81+send[:,1-side]*.19
    wet[:,side] += np.fft.irfft(np.fft.rfft(source,n=padding)*np.fft.rfft(room,n=padding),n=padding)[:COUNT]

mix=dry+wet
mix*=np.clip(clock/.022,0,1)[:,None]
mix*=np.clip((LENGTH-clock)/.52,0,1)[:,None]
mix=np.tanh(1.37*mix)/1.37
# Leave space above the main ensemble for the accented release and the picture.
dynamics = np.interp(clock,[0,2.5,4.0,7.65,8.1,9.5,12.8,13.9,15,18],
                     [.67,.75,.81,1,.87,.89,.97,1,.89,.67])
mix *= .62 * dynamics[:,None] / np.max(np.abs(mix))
output=Path(__file__).resolve().parents[1]/'qa'/'score.wav'
output.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(output),'wb') as destination:
    destination.setparams((2,2,RATE,COUNT,'NONE','not compressed'))
    destination.writeframes(np.round(mix*32767).astype('<i2').tobytes())
print(f'{output}  |  {LENGTH}s / {RATE} Hz / 2ch  |  peak {20*np.log10(np.max(abs(mix))):.2f} dBFS')
