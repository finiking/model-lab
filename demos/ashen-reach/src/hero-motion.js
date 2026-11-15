import { gaitCadence, sampleGait, sampleFoot } from './hero-gait.js';
import { sampleCarry } from './hero-carry.js';

// Poses are in character space (+X sword hand, -Z forward). Each row describes
// phase, right wrist, blade direction, left wrist, then torso yaw/pitch/roll,
// lowered pelvis and forward weight transfer. Simulation owns world translation.
const stance = [
  .45,1.22,.025, .60,-.47,-.65, -.40,1.29,-.13,
  -.10,-.045,.018, .045,.0
];
const pose = (phase, ...values) => [phase,...values];
const idle = phase => [phase,...stance];

const lightCuts = [
  [
    idle(0),
    pose(.23, .64,1.72,.19, .63,.72,.35, -.38,1.49,-.30, -.65,.00,.08,.13,-.11),
    pose(.33, .71,1.73,-.15, .94,.26,-.18, -.37,1.49,-.34, -.38,-.09,.06,.12,.01),
    pose(.39, .31,1.56,-.62, .38,-.10,-.93, -.47,1.30,-.02, .30,-.18,-.075,.14,.22),
    pose(.50, -.30,1.30,-.48, -.80,-.35,-.47, -.49,1.25,.07, .68,-.17,-.10,.15,.25),
    pose(.70, -.22,1.29,-.55, -.58,-.42,-.69, -.45,1.29,.0, .47,-.12,-.04,.10,.16),
    idle(1)
  ],[
    idle(0),
    pose(.22, -.24,1.26,-.50, -.77,-.47,-.44, -.46,1.61,-.14, .60,-.12,-.095,.18,-.035),
    pose(.33, -.17,1.40,-.58, -.83,.0,-.56, -.44,1.56,-.22, .43,-.18,-.08,.17,.025),
    pose(.43, .37,1.57,-.70, .06,.24,-.97, -.32,1.44,-.24, -.12,-.21,.02,.14,.20),
    pose(.56, .79,1.79,-.11, .93,.34,-.18, -.24,1.36,-.30, -.64,-.065,.11,.10,.15),
    pose(.73, .73,1.71,.12, .88,.46,.06, -.34,1.36,-.26, -.48,-.03,.09,.08,.07),
    idle(1)
  ],[
    idle(0),
    pose(.25, .42,2.25,.04, .22,.72,.65, -.23,1.66,-.32, -.40,.07,.08,.16,-.10),
    pose(.38, .26,2.37,-.06, -.09,.30,.95, -.18,1.79,-.30, -.48,.12,.06,.16,-.14),
    pose(.46, .22,2.12,-.48, .03,.86,-.51, -.34,1.54,-.24, -.17,-.12,.015,.17,.04),
    pose(.52, .16,1.55,-.69, .04,-.05,-.998, -.50,1.28,.02, .25,-.32,-.08,.24,.28),
    pose(.62, .02,1.16,-.48, -.31,-.72,-.62, -.49,1.29,.09, .47,-.34,-.10,.25,.30),
    pose(.78, .10,1.24,-.49, -.23,-.62,-.75, -.47,1.32,-.06, .31,-.20,-.06,.16,.19),
    idle(1)
  ]
];
const special = {
  gale:[
    idle(0),
    pose(.18, .69,1.40,.18, .75,-.39,.53, -.42,1.53,-.22, -.76,-.07,.13,.22,-.08),
    pose(.32, .72,1.61,.19, .77,.10,.63, -.38,1.59,-.22, -.98,-.02,.16,.23,-.12),
    pose(.39, .72,1.68,-.18, .98,.17,-.10, -.47,1.47,-.13, -.49,-.16,.08,.19,.02),
    pose(.45, .26,1.63,-.70, .10,.0,-.995, -.47,1.31,.07, .34,-.21,-.08,.19,.26),
    pose(.54, -.40,1.48,-.35, -.97,-.10,-.21, -.29,1.29,.20, .98,-.19,-.16,.21,.28),
    pose(.67, -.42,1.55,-.18, -.74,.22,.64, -.35,1.36,.18, 1.10,-.10,-.11,.15,.20),
    pose(.80, -.22,1.56,-.41, -.81,.08,-.56, -.49,1.36,-.01, .51,-.11,-.07,.12,.11),
    idle(1)
  ],
  quake:[
    idle(0),
    pose(.16, .33,1.40,-.39, .12,.69,-.71, -.28,1.39,-.41, -.21,-.26,.06,.29,-.05),
    pose(.32, .25,2.32,-.13, .03,.88,.46, -.01,2.11,-.24, -.31,.09,.04,.08,-.10),
    pose(.43, .22,2.41,-.01, .03,.29,.96, .025,2.20,-.14, -.35,.15,.045,.045,-.12),
    pose(.49, .17,2.19,-.42, .025,.90,-.43, -.02,2.01,-.40, -.12,-.12,.02,.17,.02),
    pose(.55, .10,1.18,-.58, .06,-.91,-.41, -.11,1.38,-.54, .18,-.43,-.07,.34,.24),
    pose(.64, .11,1.19,-.50, .04,-.87,-.49, -.08,1.22,-.43, .26,-.47,-.07,.36,.26),
    pose(.78, .19,1.20,-.43, .12,-.87,-.47, -.18,1.32,-.42, .21,-.31,-.04,.23,.17),
    idle(1)
  ],
  heal:[
    idle(0),
    pose(.20, .49,1.26,.06, .59,-.62,-.52, -.28,1.19,.10, -.10,-.08,-.05,.10,-.025),
    pose(.39, .55,1.24,.10, .75,-.52,-.40, -.12,1.97,-.22, -.19,.0,-.04,.075,-.04),
    pose(.54, .53,1.26,.10, .72,-.55,-.42, -.065,2.11,-.24, -.17,.075,-.052,.06,-.04),
    pose(.68, .52,1.22,.08, .68,-.55,-.48, -.14,1.99,-.30, -.13,.025,-.05,.055,-.03),
    pose(.85, .49,1.22,.06, .63,-.51,-.59, -.30,1.49,-.29, -.11,-.035,-.015,.055,0),
    idle(1)
  ],
  dodge:[
    idle(0),
    pose(.14, .42,1.37,-.30, .66,.15,-.74, -.28,1.68,-.37, -.15,-.23,.09,.26,.06),
    pose(.32, .39,1.59,-.36, .49,.30,-.82, -.20,1.79,-.38, -.20,-.44,.15,.37,.07),
    pose(.62, .44,1.48,-.31, .70,.24,-.67, -.24,1.67,-.30, -.19,-.40,.13,.32,.04),
    pose(.82, .54,1.25,-.14, .73,-.25,-.64, -.48,1.28,-.30, -.17,-.28,.11,.23,.07),
    idle(1)
  ]
};

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const unit=v=>clamp(v,0,1);
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=unit(t);return t*t*(3-2*t);};
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const tau=Math.PI*2;

// Nonuniform Hermite interpolation keeps momentum through the contact frame.
function sample(track,p,out) {
  let i=0;
  while(i<track.length-2&&track[i+1][0]<p)i++;
  const a=track[i],b=track[i+1],prev=track[Math.max(0,i-1)],next=track[Math.min(track.length-1,i+2)];
  const span=b[0]-a[0],u=unit((p-a[0])/span),u2=u*u,u3=u2*u;
  for(let k=1;k<a.length;k++){
    const ma=(b[k]-prev[k])*span/(b[0]-prev[0]);
    const mb=(next[k]-a[k])*span/(next[0]-a[0]);
    out[k-1]=(2*u3-3*u2+1)*a[k]+(u3-2*u2+u)*ma+(-2*u3+3*u2)*b[k]+(u3-u2)*mb;
  }
}

export function createHeroMotion(T,bones) {
  const {rig,hips,spine,chest,neck,head,capeTop,capeMid,capeTip}=bones;
  const vec=()=>new T.Vector3(),quat=()=>new T.Quaternion();
  const rest=b=>b.userData.restPosition||b.position;
  const limbs=['L','R'].map((s,i)=>{
    const upper=bones['upperArm'+s],fore=bones['forearm'+s],hand=bones['hand'+s];
    const thigh=bones['thigh'+s],shin=bones['shin'+s],foot=bones['foot'+s];
    return {s:i*2-1,plant:vec(),planted:false,plantYaw:0,lastRoll:0,driftX:0,driftZ:0,twist:0,
      landingX:0,landingZ:0,landingYaw:0,ankle:vec(),pitch:0,bank:0,kneeTurn:0,
      upper,fore,hand,thigh,shin,foot,clavicle:bones['clavicle'+s],
      arm:{top:upper,mid:fore,end:hand,upper:rest(fore).length(),lower:rest(hand).length(),
           upperDir:rest(fore).clone().normalize(),lowerDir:rest(hand).clone().normalize()},
      leg:{top:thigh,mid:shin,end:foot,upper:rest(shin).length(),lower:rest(foot).length(),
           upperDir:rest(shin).clone().normalize(),lowerDir:rest(foot).clone().normalize()}};
  });
  const wTarget=vec(),wPole=vec(),along=vec(),across=vec(),first=vec(),second=vec();
  const inv=quat(),frame=quat(),weaponQ=quat(),rollQ=quat(),d=vec(),footQ=quat();
  const bladeTip=bones.handR.getObjectByName('bladeTip'),tipPosition=vec();
  const bladeRest=new T.Vector3(.592,-.551,-.587).normalize();
  const vialMouth=bones.handL.getObjectByName('potionMouth');
  const mouthOffset=new T.Vector3(.036,.025,-.145);
  if(vialMouth){vialMouth.getWorldPosition(mouthOffset);bones.handL.worldToLocal(mouthOffset);}
  const vialAxis=new T.Vector3(0,.62,-.78).normalize(),pourDirection=new T.Vector3(.43,-.12,.895).normalize();
  const vialBase=bones.handL.getObjectByName('potionBase');
  if(vialMouth&&vialBase){
    const baseOffset=vialBase.getWorldPosition(vec());bones.handL.worldToLocal(baseOffset);
    vialAxis.copy(mouthOffset).sub(baseOffset).normalize();
  }
  const lip=vec(),handFrame=quat(),pour=quat(),aim=quat();
  const bendAxis=new T.Vector3(1,0,0),rollCarry=new T.Vector3(.984,-.06,.166).normalize(),footEuler=new T.Euler();
  const work=new Float64Array(stance.length);
  const gait={},footSample={},carry={};
  const runner=rig.parent, contactPoint=vec();
  let phase=0,pace=0,fast=0,forward=1,side=0,fall=0,cloth=0,previousYaw=0,clock=0;
  let lastSpeed=4.65, lastHeading=runner.rotation.y, turnRate=0, cut=0,lookYaw=0,compression=0;


  // Solve within the parent frame; the pole describes the bend plane, keeping
  // elbows outside the ribcage and knees facing ahead during weight transfer.
  function reach(chain,x,y,z,px,py,pz){
    const {top,mid,upper,lower,upperDir,lowerDir}=chain;
    rig.localToWorld(wTarget.set(x,y,z));top.parent.worldToLocal(wTarget);wTarget.sub(top.position);
    rig.localToWorld(wPole.set(px,py,pz));top.parent.worldToLocal(wPole);wPole.sub(top.position);
    const raw=wTarget.length(),len=clamp(raw,Math.abs(upper-lower)+.003,upper+lower-.0003);
    along.copy(wTarget).divideScalar(Math.max(.0001,raw));
    across.copy(wPole).addScaledVector(along,-wPole.dot(along));
    if(across.lengthSq()<.00001)across.set(0,0,-1).addScaledVector(along,along.z);
    across.normalize();
    const projected=(upper*upper-lower*lower+len*len)/(2*len);
    first.copy(along).multiplyScalar(projected).addScaledVector(across,Math.sqrt(Math.max(0,upper*upper-projected*projected)));
    second.copy(along).multiplyScalar(len).sub(first).normalize();
    top.quaternion.setFromUnitVectors(upperDir,first.normalize());
    second.applyQuaternion(inv.copy(top.quaternion).invert());
    mid.quaternion.setFromUnitVectors(lowerDir,second);
  }
  function orientationInRig(joint,target,out) {
    joint.parent.getWorldQuaternion(inv).invert();
    rig.getWorldQuaternion(frame);out.copy(inv).multiply(frame).multiply(target);
  }
  function tiltFoot(foot,pitch,twist,bank) {
    footQ.setFromEuler(footEuler.set(pitch,twist,bank,'YXZ'));
    orientationInRig(foot,footQ,foot.quaternion);
  }
  // Track the ankle in world space. If the shin turns too far over a loaded
  // boot, roll the ankle around the actual contacting part of the outsole.
  function plantFoot(limb, foot, x, z, yaw, step, dt, inField) {
    if (!inField || step<.16) {
      limb.planted=false;
      const retain=Math.exp(-dt*26);
      limb.driftX*=retain;limb.driftZ*=retain;limb.twist=mix(yaw,limb.twist,retain);
      return;
    }
    if (limb.planted && Math.hypot(limb.plant.x-runner.position.x,limb.plant.z-runner.position.z)>1.65) {
      // Respawning or teleporting invalidates a contact from the previous place.
      limb.planted=false;limb.driftX=0;limb.driftZ=0;
    }
    if (foot.support) {
      const roll=foot.rollForward*step;
      if (!limb.planted) {
        limb.planted=true;limb.plantYaw=runner.rotation.y+yaw;
        limb.plant.copy(runner.localToWorld(contactPoint.set(x+limb.driftX,0,z+limb.driftZ)));
      } else {
        const prev=limb.plantYaw, relative=angle(prev-runner.rotation.y);
        limb.plantYaw=runner.rotation.y+clamp(relative,-.81,.81);
        const deltaRoll=roll-limb.lastRoll, toe=foot.contactForward*step;
        const dx=-Math.sin(prev),dz=-Math.cos(prev),nx=-Math.sin(limb.plantYaw),nz=-Math.cos(limb.plantYaw);
        limb.plant.x+=deltaRoll*(dx+nx)*.5+(dx-nx)*toe;
        limb.plant.z+=deltaRoll*(dz+nz)*.5+(dz-nz)*toe;
      }
      limb.lastRoll=roll;
      runner.worldToLocal(contactPoint.copy(limb.plant));
      limb.driftX=contactPoint.x-x;limb.driftZ=contactPoint.z-z;
      limb.twist=angle(limb.plantYaw-runner.rotation.y);
    } else {
      limb.planted=false;
      const retain=Math.exp(-dt*18);
      limb.driftX*=retain;limb.driftZ*=retain;limb.twist=mix(yaw,limb.twist,retain);
    }
  }
  function update(dt,state={},t) {
    dt=clamp(Number(dt)||0,0,.10);clock=Number.isFinite(t)?t:clock+dt;
    const follow=1-Math.exp(-dt*13),quick=1-Math.exp(-dt*18);
    const kindMoving=state.moving && !state.dead && state.actionKind!=='dodge';
    const measured=Number.isFinite(state.speed) ? state.speed : state.sprint ? 8.2 : 4.65;
    if (kindMoving) lastSpeed=Math.max(.1,measured);
    const speed=lastSpeed;
    const targetPace=kindMoving ? unit(measured/2.3) : 0;
    pace=mix(pace,targetPace,follow);
    if (pace < .0005 && !kindMoving) pace=0;
    fast=mix(fast,state.sprint?1:0,follow);
    if(kindMoving) {
      forward=mix(forward,Number.isFinite(state.moveForward)?state.moveForward:1,quick);
      side=mix(side,Number.isFinite(state.moveSide)?state.moveSide:0,quick);
    }
    phase=(phase+dt*gaitCadence(speed,fast)*pace)%1;
    sampleGait(phase,speed,fast,gait);
    const delta=angle(runner.rotation.y-lastHeading);
    lastHeading=runner.rotation.y;
    const yawSpeed=dt?delta/dt:0;
    turnRate=mix(turnRate,clamp(yawSpeed,-6,6),follow);
    const demand=kindMoving&&!state.actionKind?clamp(yawSpeed/6,-1,1):0;
    // The outside leg is still carrying the turn after the input heading settles.
    cut=mix(cut,demand,1-Math.exp(-dt*(Math.abs(demand)>Math.abs(cut)?24:5)));
    lookYaw=mix(lookYaw,kindMoving&&!state.actionKind?clamp(yawSpeed*.063,-1.05,1.05):0,1-Math.exp(-dt*34));
    const course=Math.atan2(-(state.moveSide||0),state.moveForward??1);
    const breath=Math.sin(clock*1.72),stride=Math.sin(phase*tau);
    const kind=state.actionKind||'',p=unit(state.actionPhase||0);
    const combo=clamp(Math.floor(state.comboIndex||0),0,2);
    const clip=kind==='attack'?lightCuts[combo]:special[kind];
    // The running carry trails behind the hip; give the wrist longer to come
    // back on guard before it enters the authored cut and after the follow-through.
    const carryBlend=kind==='attack' ? pace : 0;
    const weight=clip?smooth(p/(.105+.075*carryBlend))*smooth((1-p)/(.16+.10*carryBlend)):0;
    if(clip)sample(clip,p,work);else work.set(stance);
    fall=mix(fall,state.dead?1:0,1-Math.exp(-dt*6));
    const roll=kind==='dodge', rolling=roll?smooth((p-.09)/.74):0;
    const tuck=roll?Math.sin(Math.PI*rolling):0;
    const step=pace*(1-.76*weight)*(1-fall);
    const pitch=mix(stance[10],work[10],weight);
    const yaw=mix(stance[9],work[9],weight);
    const bank=mix(stance[11],work[11],weight);
    const drop=mix(stance[12],work[12],weight);
    const shift=work[13]*weight;
    const hit=unit(state.hit||0)*(1-weight*.6)*(1-fall);
    // Put most of the forward inclination below the ribcage so the whole
    // trunk travels over the support foot, with the eyes still on the path.
    const lean=gait.lean*(1+.16*fast)*step;
    const hipYaw=gait.hipYaw*step;
    const shoulderYaw=Math.cos((phase-.028)*tau)*(.096+.047*fast)*step;
    const loaded=1-smooth(Math.min(phase%0.5,.5-phase%0.5)/(.55*gait.duty));
    const transfer=cut*step*(1-weight);
    const corner=turnRate*(.025+.012*fast)*step;
    const pelvisHeight=mix(-drop,gait.hipY-rest(hips).y,step)+.008*breath*(1-step)-Math.abs(transfer)*(.035+.012*loaded);
    rig.position.copy(rest(rig));rig.rotation.set(0,0,0);
    if(roll){
      const angle=-tau*rolling,radius=1.02;
      rig.rotation.set(angle,0,.24*tuck,'ZXY');
      // Keep the somersault centered on the tucked body, not at the boot sole.
      rig.position.y+=radius*(1-Math.cos(angle))+.105*tuck;
      rig.position.z-=radius*Math.sin(angle);
    }
    if(fall>.001){
      rig.rotation.x=mix(rig.rotation.x,-1.52,fall);
      rig.rotation.z+=.32*fall;rig.position.y+=.11*fall;
    }
    hips.position.copy(rest(hips));
    hips.position.x+=-.019*(1-pace)+gait.hipSide*step+bank*.29-transfer*(.053+.017*loaded);
    hips.position.y+=pelvisHeight;
    hips.position.z-=shift+gait.hipForward*step;
    hips.rotation.set(pitch*.25+lean*.89,yaw*.39+hipYaw-transfer*.105,bank*.36+gait.hipRoll*step+corner*.32);
    spine.rotation.set(pitch*.43+lean*.23+.007*breath,yaw*.37+(shoulderYaw-hipYaw)*.52,bank*.42-gait.hipRoll*.50*step+corner*.43);
    chest.rotation.set(pitch*.32+lean*.06+.009*breath+.16*hit,yaw*.24+(shoulderYaw-hipYaw)*.48,bank*.22-gait.hipRoll*.45*step+corner*.25-.08*hit);
    neck.rotation.set(-.035-pitch*.21-lean*.57,-yaw*.33-shoulderYaw*.65,.018-corner*.37);
    head.rotation.set(.055+.014*Math.sin(clock*1.17)-pitch*.24-lean*.37+(kind==='heal'?.21*weight:0)-.23*tuck,
      -yaw*.37-shoulderYaw*.30+.024*Math.sin(clock*.76)*(1-pace),-.03-bank*.47-corner*.27);

    let loadDrop=0;
    for(const limb of limbs) {
      const sig=limb.s;
      const clockPhase=(phase+(sig>0?.5:0))%1;
      // A cutting step unloads and rolls off before the body straightens the
      // trailing knee. Rejoin the common cadence by the next heel strike.
      const release=smooth(clockPhase/(gait.duty*.68))*(1-smooth((clockPhase-gait.duty)/(.75-gait.duty)));
      const outside=Math.max(0,sig*transfer);
      const u=clockPhase+release*gait.duty*(Math.abs(transfer)*.25+outside*.15);
      const foot=sampleFoot(u,speed,fast,footSample);
      const lead=sig<0?.115:-.095;
      let footX=mix(sig*(.225+.055*weight),sig*foot.width+side*foot.forward,step);
      let footZ=mix(-lead,-forward*foot.forward,step)-(sig<0?shift*.80:-shift*.16);
      const naturalYaw=-sig*(.078+.045*weight-.043*step);
      let landingX=0,landingZ=0,landingYaw=0;
      if (Math.abs(transfer)>.0001) {
        // Look through the arc to touchdown. The outside foot sets a slightly
        // wider catching step while the inside leg takes a shorter way around.
        const steer=Math.abs(transfer), outside=sig*transfer;
        const approach=foot.support?1-smooth(u/gait.duty):smooth((foot.swing-.20)/.65);
        const timeToLand=foot.support?0:Math.min(.14,(1-u)/gait.cadence);
        const nextYaw=lookYaw*(.54+.46*smooth(timeToLand/.14));
        const landingCourse=course+angle(nextYaw-course)*.82;
        const leadDistance=(.36+.065*fast)*(1+.11*Math.max(0,outside)-.28*Math.max(0,-outside));
        const lookDistance=.36+.065*fast+speed*timeToLand*.34;
        const leadShift=leadDistance-(.36+.065*fast);
        landingX=approach*steer*((Math.sin(course)-Math.sin(landingCourse))*lookDistance-Math.sin(landingCourse)*leadShift+sig*(.022+.030*Math.max(0,outside)));
        landingZ=approach*steer*((Math.cos(course)-Math.cos(landingCourse))*lookDistance-Math.cos(landingCourse)*leadShift);
        landingYaw=approach*steer*clamp(landingCourse,-.94,.94);
      }
      // A new input may redirect the actor in one frame. An airborne boot can
      // change its landing plan, but cannot jump sideways along with that input.
      const dx=landingX-limb.landingX,dz=landingZ-limb.landingZ;
      const steerBlend=Math.min(1-Math.exp(-dt*29),dt*2.7/Math.max(.0001,Math.hypot(dx,dz)));
      limb.landingX+=dx*steerBlend;limb.landingZ+=dz*steerBlend;
      limb.landingYaw+=clamp((landingYaw-limb.landingYaw)*(1-Math.exp(-dt*26)),-dt*4,dt*4);
      footX+=limb.landingX;footZ+=limb.landingZ;
      const footYaw=naturalYaw+limb.landingYaw;
      plantFoot(limb,foot,footX,footZ,footYaw,step,dt,state.groundAt && !kind);
      footX+=limb.driftX; footZ+=limb.driftZ;
      let footY=mix(.142,foot.height,step),footPitch=foot.pitch*step;
      let groundBank=0;
      if(state.groundAt && !roll && !state.dead) {
        // The boot spans more than a third of a unit from heel to toe.
        const ankle=state.groundAt(footX,footZ);
        const slope=(state.groundAt(footX,footZ-.22)-ankle)/.22;
        const crossSlope=(state.groundAt(footX+.11,footZ)-ankle)/.11;
        footY+=clamp(ankle,-.26,.26);
        footPitch+=clamp(Math.atan(slope),-.35,.35);
        groundBank=clamp(Math.atan(crossSlope),-.30,.30);
      }
      limb.ankle.set(footX,footY,footZ);limb.pitch=footPitch;limb.bank=groundBank;
      limb.kneeTurn=angle(limb.twist-naturalYaw)*Math.abs(transfer);
      if (limb.planted && Math.abs(transfer)>.005) {
        // At low frame rates a whole part of the loading step may pass between
        // samples. Let the hips yield to the planted leg's reachable height.
        limb.thigh.getWorldPosition(contactPoint);rig.worldToLocal(contactPoint);
        const dx=footX-contactPoint.x,dz=footZ-contactPoint.z;
        const reachLength=limb.leg.upper+limb.leg.lower-.018;
        const height=Math.sqrt(Math.max(0,reachLength*reachLength-dx*dx-dz*dz));
        loadDrop=Math.max(loadDrop,contactPoint.y-footY-height);
      }
    }
    compression=Math.max(Math.min(.12,loadDrop),compression*Math.exp(-dt*14));
    hips.position.y-=compression;
    for(const limb of limbs) {
      const sig=limb.s,kneeTurn=limb.kneeTurn;
      const {x:footX,y:footY,z:footZ}=limb.ankle;
      reach(limb.leg,footX,footY,footZ,sig*.15+side*.32-.62*Math.sin(kneeTurn),.70,-.96+.62*(1-Math.cos(kneeTurn)));
      tiltFoot(limb.foot,limb.pitch,limb.twist,limb.bank);
      if(tuck>0){
        limb.thigh.quaternion.slerp(footQ.setFromEuler(footEuler.set(1.30+(sig<0?.23:0),0,sig*.15)),tuck);
        limb.shin.quaternion.slerp(footQ.setFromAxisAngle(bendAxis,-1.89),tuck);
        limb.foot.quaternion.slerp(footQ.setFromAxisAngle(bendAxis,.36),tuck);
      }
      const armed=sig>0, vx=armed?0:6;
      sampleCarry(sig,phase,fast,carry);
      const armSwing=sig*Math.cos(phase*tau)*step;
      limb.clavicle.rotation.set(-.025*step,sig*.028*armSwing,-sig*(.023+.009*breath));
      const baseX=mix(stance[vx]+sig*.014*breath,carry.wristX,pace);
      const baseY=mix(stance[vx+1]+.024*breath,carry.wristY,pace);
      const baseZ=mix(stance[vx+2],carry.wristZ,pace);
      const wristX=mix(baseX,work[vx],weight),wristY=mix(baseY,work[vx+1],weight),wristZ=mix(baseZ,work[vx+2],weight);
      const pump=pace*(1-weight);
      const poleX=mix(sig*(.85+.22*weight),carry.poleX,pump);
      const poleY=mix(1.47+.14*weight,carry.poleY,pump),poleZ=mix(.32+.12*weight,carry.poleZ,pump);
      reach(limb.arm,wristX,wristY,wristZ,poleX,poleY,poleZ);
      if(armed){
        d.set(mix(mix(stance[3],carry.bladeX,pace),work[3],weight),
          mix(mix(stance[4],carry.bladeY,pace),work[4],weight),
          mix(mix(stance[5],carry.bladeZ,pace),work[5],weight)).normalize();
        // On the shoulder roll the sword tracks beside the body, outside the arc of the head.
        if(tuck>0)d.lerp(rollCarry,tuck**.65).normalize();
        weaponQ.setFromUnitVectors(bladeRest,d);
        const edgeRoll=clip?(kind==='gale'?-.47:combo===1?.54:-.29)*Math.sin(Math.PI*p)*weight:0;
        rollQ.setFromAxisAngle(d,edgeRoll+carry.bladeRoll*pump);weaponQ.premultiply(rollQ);
        orientationInRig(limb.hand,weaponQ,limb.hand.quaternion);
        if(bladeTip && weight>0 && (kind==='quake'||kind==='attack')){
          // Seat the equipped blade at the impact plane. Different swords have
          // different lengths, so the elbow absorbs the last part of the stroke.
          bladeTip.getWorldPosition(tipPosition);rig.worldToLocal(tipPosition);
          const rise=.008-tipPosition.y;
          if(rise>0){
            reach(limb.arm,wristX,wristY+rise,wristZ,poleX,poleY,poleZ);
            orientationInRig(limb.hand,weaponQ,limb.hand.quaternion);
          }
        }
      } else {
        // Keep the support wrist aligned with the forearm in guard and when running.
        limb.hand.rotation.set(-.13+armSwing*.07+.20*tuck,-.12-.16*weight,.035+.09*weight);
        if(kind==='heal'){
          const sip=smooth((p-.29)/.13)*smooth((.76-p)/.12);
          if(sip>0){
            // Track the articulated head, preserving lip contact even as it tilts
            // back. Position and tilt the bottle together with the gripping hand.
            rig.getWorldQuaternion(inv).invert();limb.hand.getWorldQuaternion(handFrame).premultiply(inv);
            d.copy(vialAxis).applyQuaternion(handFrame);
            aim.setFromUnitVectors(d,pourDirection);
            pour.copy(handFrame).premultiply(aim);
            handFrame.slerp(pour,sip);
            head.localToWorld(lip.set(-.009,.060,-.131));rig.worldToLocal(lip);
            lip.sub(d.copy(mouthOffset).applyQuaternion(handFrame));
            reach(limb.arm,mix(wristX,lip.x,sip),mix(wristY,lip.y,sip),mix(wristZ,lip.z,sip),
              -.85,1.47+.14*weight,.32+.12*weight);
            orientationInRig(limb.hand,handFrame,limb.hand.quaternion);
          }
        }
      }
    }
    const turnSpeed=dt>0?clamp((yaw-previousYaw)/dt,-9,9):0;previousYaw=yaw;
    cloth=mix(cloth,turnSpeed+turnRate*.62,1-Math.exp(-dt*9));
    const breeze=Math.sin(clock*2.1+.63*stride), flutter=Math.sin(clock*4.0-phase*tau*.45);
    const trail=.04+.13*step+.16*fast*step+.16*weight+.14*tuck;
    capeTop.rotation.set(-trail-(.025+.02*step)*breeze,-cloth*.018,.024*breeze);
    capeMid.rotation.set(-.06-trail*.60+.055*Math.sin(clock*2.2-.7),-cloth*.030,-.032*breeze+.018*flutter);
    capeTip.rotation.set(-.05-trail*.36+.064*Math.sin(clock*2.6-1.4),-cloth*.041,.050*Math.sin(clock*2.7-.9));
  }
  update(0,{},0);
  return update;
}
