// Rig-space locomotion targets for a right-handed ranger. +Z is behind him.
// Phase zero is left heel contact; the half-cycle exchanges support. The free
// arm flexes at the elbow while the sword hand keeps a low, trailing carry.
const TAU=Math.PI*2;
const radians=Math.PI/180;
const mix=(a,b,t)=>a+(b-a)*t;

// Rotating a blade onto its new axis still leaves the hand free to roll around
// the hilt. Choose that roll so the long axis of the glove follows the forearm.
function alignGlove(dx,dy,dz,fx,fy,fz) {
  const rx=.5930,ry=-.5505,rz=-.5876;
  let qx=ry*dz-rz*dy,qy=rz*dx-rx*dz,qz=rx*dy-ry*dx,qw=1+rx*dx+ry*dy+rz*dz;
  const inv=1/Math.hypot(qx,qy,qz,qw);
  qx*=inv;qy*=inv;qz*=inv;qw*=inv;
  // The knuckles are down and slightly inward from the neutral right wrist.
  const hx=-.20,hy=-.978,hz=.05;
  const tx=2*(qy*hz-qz*hy),ty=2*(qz*hx-qx*hz),tz=2*(qx*hy-qy*hx);
  const x=hx+qw*tx+qy*tz-qz*ty,y=hy+qw*ty+qz*tx-qx*tz,z=hz+qw*tz+qx*ty-qy*tx;
  const onBlade=x*dx+y*dy+z*dz;
  const alignment=x*fx+y*fy+z*fz-onBlade*(dx*fx+dy*fy+dz*fz);
  const turn=dx*(y*fz-z*fy)+dy*(z*fx-x*fz)+dz*(x*fy-y*fx);
  return Math.atan2(turn,alignment);
}

export function sampleCarry(side,phase,fast,out) {
  const right=side>0,f=Math.max(0,Math.min(1,fast));
  const sign=right?1:-1,a=phase*TAU;
  // The hand reaches its endpoint just after the opposing heel meets the ground.
  // A small second harmonic gives the backward drive a quicker acceleration.
  const wave=Math.cos(a-.085)+.056*Math.sin(2*a-.17);
  const drive=sign*wave;
  const forward=(drive+1)*.5;
  const upperAngle=right ? mix(-13,-21,f)+drive*mix(9,11,f) :
    mix(-9,-10,f)+drive*mix(33,48,f)-forward*mix(8,18,f);
  const elbowFlex=right ? mix(35,44,f)+forward*mix(7,8,f) :
    mix(70,82,f)+forward*mix(17,10,f);
  const upper=upperAngle*radians,fore=(upperAngle+elbowFlex)*radians;
  const sway=.023*Math.sin(a-.2);
  const shoulderX=sign*.32+sway;
  const shoulderY=1.83-.025*f-.027*Math.sin(2*a-.24);
  const shoulderZ=-.042-.085*f-sign*(.025+.017*f)*wave;

  // Preserve the humerus/forearm lengths in the sagittal plane. A gently
  // tucked elbow leaves the front of the torso open at the top of the upswing.
  const elbowX=shoulderX+sign*(right?.066:.045+.014*(1-forward));
  const elbowY=shoulderY-.372*Math.cos(upper),elbowZ=shoulderZ-.372*Math.sin(upper);
  const handX=right ? .480+.016*f+.016*(1-forward)+.26*sway :
    elbowX+.024+.058*forward+.026*f*forward;
  // The airborne pelvis rises past its rest average. Reserve elbow flex at
  // that apex instead of letting the sword arm lock straight.
  const handY=elbowY-.327*Math.cos(fore)+(right?.012+.040*f:0);
  const handZ=elbowZ-.327*Math.sin(fore);
  out.wristX=handX;out.wristY=handY;out.wristZ=handZ;
  // Extend the elbow's anatomical bend plane for a stable IK pole even when the
  // torso leans or twists. Do not pull the joint sideways to manufacture flex.
  out.poleX=elbowX+.25*(2*elbowX-shoulderX-handX);
  out.poleY=elbowY+.55*(2*elbowY-shoulderY-handY);
  out.poleZ=elbowZ+.70*(2*elbowZ-shoulderZ-handZ);

  // The point trails behind and outside the right boot. Most shoulder travel
  // is absorbed by the elbow; the blade only responds by a few degrees.
  const dx=.49-.085*f+.022*wave;
  const dy=-.45+.13*f+.032*wave;
  const dz=.77+.13*f-.020*wave;
  const n=1/Math.hypot(dx,dy,dz);
  out.bladeX=dx*n;out.bladeY=dy*n;out.bladeZ=dz*n;
  out.bladeRoll=right?alignGlove(out.bladeX,out.bladeY,out.bladeZ,
    handX-elbowX,handY-elbowY,handZ-elbowZ):0;
  return out;
}
