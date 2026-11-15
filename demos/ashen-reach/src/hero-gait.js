// One cycle is left heel strike to the next left heel strike. Distances are in
// world units, +forward is character -Z, pitch is a Three.js rotation about X.
const TAU=Math.PI*2;
const mix=(a,b,t)=>a+(b-a)*t;
const limit=(v,a,b)=>Math.min(b,Math.max(a,v));
const wrap=p=>p-Math.floor(p);
const smooth=t=>t*t*(3-2*t);
const normalizedSpeed=v=>Math.max(0,Number(v)||0);
// The body can accelerate before the sprint animation blend has caught up.
const effort=(speed,fast)=>Math.max(limit(fast,0,1),smooth(limit((speed-4.65)/3.55,0,1)));

export function gaitCadence(speed,fast=0) {
  // Cycles per second, two steps per cycle. Cadence changes much less than stride length.
  const v=normalizedSpeed(speed);
  return 1.13+.32*Math.min(v/4.65,1)+.18*effort(v,fast)+.065*Math.max(0,v-8.2);
}

function dutyFactor(speed,fast,cadence){
  return Math.min(mix(.343,.242,fast),mix(1.060,1.135,fast)*cadence/Math.max(.01,speed));
}

// Sagittal support hull sampled from the actual outsole, not a rectangular foot.
// For each shoe pitch the lowest sole point sets ankle height and the rolling
// contact point. Integrating this height over angle gives the non-slipping
// horizontal ankle displacement around the instantaneous contact.
const sole=[];
for(const [y,rz,z] of [[.008,.158,-.054],[.016,.168,-.055],[.032,.171,-.054],[.040,.169,-.054]]){
  for(let j=0;j<36;j++){
    const co=Math.cos(j*TAU/36), toe=Math.max(0,-co)**3;
    sole.push([.012-z-co*rz+.015*toe,.14-y-.011*toe-.007*Math.max(0,.5-Math.abs(co))]);
  }
}
const P_MIN=-1.5,P_MAX=.55,N=512,D=(P_MAX-P_MIN)/N;
const heights=new Float64Array(N+1), offsets=new Float64Array(N+1), contacts=new Float64Array(N+1);
for(let i=0;i<=N;i++){
  const p=P_MIN+i*D,c=Math.cos(p),s=Math.sin(p);
  let max=-Infinity,x=0;
  for(const [forward,depth] of sole){
    const h=depth*c-forward*s;
    if(h>max){max=h;x=forward*c+depth*s;}
  }
  heights[i]=max;contacts[i]=x;
  offsets[i]=i?offsets[i-1]-.5*D*(max+heights[i-1]):0;
}
function at(table,p){
  const n=limit((p-P_MIN)/D,0,N),i=Math.min(N-1,Math.floor(n));
  return mix(table[i],table[i+1],n-i);
}
const zeroOffset=at(offsets,0);
const rocker=p=>at(offsets,p)-zeroOffset;

// Positions and derivatives are prescribed at touchdown and toe-off; the same
// tangent on both sides matters more than how many samples a renderer takes.
function cubic(u,a,b,da,db,span){
  const u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a+(u3-2*u2+u)*span*da+(-2*u3+3*u2)*b+(u3-u2)*span*db;
}
function between(x,t0,t1,a,b,da=0,db=0){
  return cubic(limit((x-t0)/(t1-t0),0,1),a,b,da,db,t1-t0);
}

export function sampleGait(phase,speed,fast=0,out={}){
  const f=effort(speed,fast),p=wrap(phase),half=wrap(2*p);
  const touch=mix(1.079,1.066,f), compressed=mix(1.026,1.016,f), high=mix(1.119,1.143,f);
  const load=mix(.24,.19,f), apex=mix(.84,.75,f), landing=-mix(.14,.22,f);
  if(half<load)out.hipY=between(half,0,load,touch,compressed,landing,0);
  else if(half<apex)out.hipY=between(half,load,apex,compressed,high);
  else out.hipY=between(half,apex,1,high,touch,0,landing);
  out.hipForward=mix(.042,.084,f);
  out.hipSide=-mix(.038,.026,f)*Math.cos(TAU*(p-.105));
  out.hipYaw=-mix(.067,.089,f)*Math.cos(TAU*(p-.012));
  out.hipRoll=-mix(.036,.028,f)*Math.cos(TAU*(p-.095));
  out.lean=-mix(.084,.173,f);
  out.cadence=gaitCadence(speed,f);out.duty=dutyFactor(speed,f,out.cadence);
  out.support=p<out.duty?'left':p>=.5&&p<.5+out.duty?'right':null;
  return out;
}

export function sampleFoot(legPhase,speed,fast=0,out={}){
  const p=wrap(legPhase),v=normalizedSpeed(speed),f=effort(v,fast);
  const cadence=gaitCadence(v,f),stride=v/cadence, duty=dutyFactor(v,f,cadence),aerial=1-duty;
  const lead=mix(.385,.426,f)*Math.min(1,v/3.7);
  const collision=mix(.225,.105,f), toeOff=-mix(.92,1.145,f);
  const rollStart=mix(.43,.29,f), flat=mix(.30,.18,f);
  let pitch,forward,clearance=0;
  if(p<duty){
    const s=p/duty;
    if(s<flat)pitch=collision*(1-smooth(s/flat));
    else if(s<=rollStart)pitch=0;
    else pitch=toeOff*smooth((s-rollStart)/(1-rollStart));
    forward=lead-stride*p+rocker(pitch);
    out.swing=0;
  }else{
    const q=(p-duty)/aerial;
    const leave=lead-stride*duty+rocker(toeOff),land=lead+rocker(collision);
    const terminalSlope=-stride*aerial;
    const trail=leave-mix(.078,.095,f), front=land+mix(.104,.114,f);
    // Heel folds toward the hamstring before the ankle is carried forward.
    // The lower leg opens in front and retracts before touching the ground.
    if(q<.13)forward=between(q,0,.13,leave,trail,terminalSlope,0);
    else if(q<.43)forward=between(q,.13,.43,trail,mix(-.238,-.315,f),0,2.26);
    else if(q<.84)forward=between(q,.43,.84,mix(-.238,-.315,f),front,2.26,0);
    else forward=between(q,.84,1,front,land,0,terminalSlope);
    if(q<.24)pitch=between(q,0,.24,toeOff,mix(-1.10,-1.32,f));
    else if(q<.83)pitch=between(q,.24,.83,mix(-1.10,-1.32,f),collision+.027);
    else pitch=between(q,.83,1,collision+.027,collision);
    const peak=mix(.325,.490,f), terminalHeight=mix(.131,.173,f);
    if(q<.31)clearance=between(q,0,.31,0,peak);
    else if(q<.805)clearance=between(q,.31,.805,peak,terminalHeight,0,-1.24);
    else if(q<.920)clearance=between(q,.805,.920,terminalHeight,mix(.051,.083,f),-1.24,-.95);
    else clearance=between(q,.920,1,mix(.051,.083,f),0,-.95,0);
    out.swing=q;
  }
  out.forward=forward;out.pitch=pitch;
  out.height=at(heights,pitch)+.0025+clearance;
  out.width=mix(.129,.109,f)+.010*Math.sin(Math.PI*out.swing)**2;
  out.support=p<duty;out.contactForward=at(contacts,pitch);out.rollForward=rocker(pitch);
  return out;
}
