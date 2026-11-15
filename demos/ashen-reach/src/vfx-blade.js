// Angles, reversals and arcs are measured from the weapon. Each narrow lane
// follows a different point between the guard and the tip of the actual blade.
const STYLES = {
  cut:  {life:.16,lead:.105,follow:.155,spacing:.036, flecks:9, tint:[0x985322,0xf3a343,0xffe19a], lanes:[[.91,.085],[.73,.038],[.983,.018],[.60,.022]]},
  lift: {life:.226,lead:.142,follow:.188,spacing:.050, flecks:13,tint:[0x95481e,0xf6a342,0xffdc82], lanes:[[.954,.092],[.742,.087],[.599,.032],[.851,.017],[.496,.020]]},
  cleave:{life:.235,lead:.135,follow:.145,spacing:.030,flecks:19,tint:[0x994021,0xee852c,0xffce72], lanes:[[.86,.135],[.989,.030],[.625,.074],[.492,.026],[.736,.016]]},
  gale: {life:.215,lead:.135,follow:.220,spacing:.031,flecks:14,tint:[0x186063,0x55c9b4,0xc9f9c3], lanes:[[.91,.100],[.72,.057],[.995,.021],[.57,.030],[.825,.018]]},
  quake:{life:.205,lead:.115,follow:.135,spacing:.028,flecks:20,tint:[0x913316,0xec7a26,0xffcc78], lanes:[[.89,.110],[.987,.024],[.69,.073],[.505,.035],[.59,.018]]}
};
const CUTS=['cut','lift','cleave'];
const SAMPLES=104, LANES=5, MAX_FLECKS=56;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

const pathVertex=/* glsl */`
  attribute vec4 stroke;
  attribute vec4 edgeFrame;
  attribute vec3 radial;
  varying vec4 vStroke;
  void main(){
    vStroke=stroke;
    // A small volume of lit filings around the streak keeps a descending cut
    // visible when the true sword arc is seen almost edge-on.
    vec3 axis=cross(edgeFrame.xyz,normalize(cameraPosition-position));
    axis/=max(length(axis),.001);
    if(dot(axis,radial)<0.)axis=-axis;
    vec3 point=position+axis*stroke.y*edgeFrame.w;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.0);
  }
`;
const colors=/* glsl */`
  uniform vec3 uInk;
  uniform vec3 uGold;
  uniform vec3 uLight;
`;
const pathFragment=/* glsl */`
  ${colors}
  varying vec4 vStroke;
  float hash(float p){return fract(sin(p*127.1+5.73)*43758.5453);}
  float noise1(float x){float f=fract(x);return mix(hash(floor(x)),hash(floor(x)+1.0),f*f*(3.0-2.0*f));}
  void main(){
    float s=vStroke.x,r=vStroke.y,power=vStroke.z,k=vStroke.w;
    float ns=noise1(s*12.0+k*73.0), tooth=noise1(s*37.0+r*2.2+k*17.0);
    float rim=abs(r+(ns-.5)*.21);
    float shape=1.0-smoothstep(.42+ns*.17,1.0,rim+(.50-tooth)*.22);
    float trailing=clamp((1.0-power)*1.28,0.0,1.0);
    float streak=noise1(s*(5.8+k*.7)+r*.72+k*9.);
    // The core is a solid streak; its flanks and satellites break into dry-brush chips.
    float fleck=smoothstep(.13,.36,streak+.43-.46*trailing+.28*(1.0-rim)-min(k,.99)*.23);
    float alpha=shape*power*fleck*(k<.3?.94:.82);
    if(alpha<.022)discard;
    float linePat=1.0-smoothstep(.07,.43,abs(r-(-.41+.10*ns)));
    float fine=max(linePat*.97,(1.0-rim)*(.29+tooth*.16));
    vec3 color=mix(uInk,uGold,.18+.82*smoothstep(.26,.88,1.0-rim));
    color=mix(color,uLight,clamp(fine*(.82+.18*streak),0.,1.));
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;
const chargeVertex=/* glsl */`
  uniform vec3 uBase;uniform vec3 uTip;uniform float uWidth;
  varying vec2 vUV;
  void main(){
    vUV=uv;vec3 center=mix(uBase,uTip,uv.y);
    vec3 axis=normalize(uTip-uBase);
    vec3 right=cross(axis,normalize(cameraPosition-center));
    right/=max(length(right),.001);
    float width=uWidth*(.25+.75*sin(3.14159*pow(uv.y,.83)));
    vec3 world=center+right*(uv.x*2.0-1.0)*width;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
  }
`;
const chargeFragment=/* glsl */`
  ${colors}
  uniform float uPower;uniform float uPhase;varying vec2 vUV;
  void main(){
    float x=abs(2.0*vUV.x-1.0),y=vUV.y;
    float rim=exp(-7.5*abs(x-.43))+.42*exp(-7.*abs(x-.68));
    float run=pow(max(0.,1.-abs(y-(uPhase*2.25-.16))*4.5),2.);
    float streak=.4+.6*pow(.5+.5*sin(y*26.-uPhase*29.),2.);
    float alpha=(rim*(.32+.5*streak)+.8*run*exp(-x*4.))*(1.-smoothstep(.80,1.,x));
    alpha*=uPower*smoothstep(.0,.1,y)*(1.-smoothstep(.96,1.,y));
    if(alpha<.012)discard;
    gl_FragColor=vec4(mix(uGold,uLight,clamp(run+rim*.35,0.,1.)),alpha);
    #include <colorspace_fragment>
  }
`;

function makeTrail(T,scene) {
  const geometry=new T.BufferGeometry();
  const positions=new T.Float32BufferAttribute(new Float32Array(LANES*SAMPLES*2*3),3).setUsage(T.DynamicDrawUsage);
  const stroke=new T.Float32BufferAttribute(new Float32Array(LANES*SAMPLES*2*4),4).setUsage(T.DynamicDrawUsage);
  const edgeFrame=new T.Float32BufferAttribute(new Float32Array(LANES*SAMPLES*2*4),4).setUsage(T.DynamicDrawUsage);
  const radial=new T.Float32BufferAttribute(new Float32Array(LANES*SAMPLES*2*3),3).setUsage(T.DynamicDrawUsage);
  const faces=[];
  // Rows interleave lanes so one contiguous upload/draw range covers every active strip.
  for(let j=0;j<SAMPLES-1;j++)for(let k=0;k<LANES;k++){
    const i=(j*LANES+k)*2, n=i+LANES*2;
    faces.push(i,i+1,n+1,i,n+1,n);
  }
  geometry.setAttribute('position',positions);geometry.setAttribute('stroke',stroke);geometry.setAttribute('edgeFrame',edgeFrame);geometry.setAttribute('radial',radial);geometry.setIndex(faces);
  geometry.setDrawRange(0,0);
  const colors={uInk:{value:new T.Color()},uGold:{value:new T.Color()},uLight:{value:new T.Color()}};
  const common={transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,forceSinglePass:true};
  const material=new T.ShaderMaterial({...common,uniforms:colors,vertexShader:pathVertex,fragmentShader:pathFragment});
  const mesh=new T.Mesh(geometry,material);mesh.name='Sword / split edge trails';mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=12;
  const chargeUniforms={...colors,uBase:{value:new T.Vector3()},uTip:{value:new T.Vector3()},uWidth:{value:.075},uPower:{value:0},uPhase:{value:0}};
  const lightMesh=new T.Mesh(new T.PlaneGeometry(1,1,1,16),new T.ShaderMaterial({...common,uniforms:chargeUniforms,vertexShader:chargeVertex,fragmentShader:chargeFragment}));
  lightMesh.name='Sword / channelled edge';lightMesh.frustumCulled=false;lightMesh.renderOrder=13;lightMesh.visible=false;
  scene.add(mesh,lightMesh);
  return {mesh,lightMesh,positions,stroke,edgeFrame,radial,colors,chargeUniforms};
}

export function createBladeFx(T,scene) {
  const {mesh,lightMesh,positions,stroke,edgeFrame,radial,colors,chargeUniforms}=makeTrail(T,scene);
  const knots=Array.from({length:SAMPLES},()=>({base:new T.Vector3(),ray:new T.Vector3(),length:0,born:0,distance:0,weight:0}));
  const bits=Array.from({length:MAX_FLECKS},()=>({p:new T.Vector3(),v:new T.Vector3(),life:0,age:1,width:0,stretch:0,tone:0}));
  const shards=new T.InstancedMesh(new T.OctahedronGeometry(1,0), new T.MeshBasicMaterial({toneMapped:false}), MAX_FLECKS);
  shards.name='Sword / loose filings';shards.count=0;shards.instanceMatrix.setUsage(T.DynamicDrawUsage);shards.frustumCulled=false;shards.renderOrder=11;scene.add(shards);
  const fleckPose=new T.Object3D(),fleckColor=new T.Color(),up=new T.Vector3(0,1,0);
  const base=new T.Vector3(),tip=new T.Vector3(),ray=new T.Vector3(),oldBase=new T.Vector3(),oldRay=new T.Vector3();
  const sampleBase=new T.Vector3(),sampleRay=new T.Vector3(),sampleTip=new T.Vector3(),oldTip=new T.Vector3(),tangent=new T.Vector3();
  const quaternion=new T.Quaternion(),turn=new T.Quaternion(),identity=new T.Quaternion(),dir=new T.Vector3();
  let start=0,size=0,poolCursor=0,clock=0,oldPhase=-1,oldLength=1,hasPrevious=false,styleName='',lastKind='',lastCombo=-1,disposed=false;
  let lastBaseSocket=null,lastTipSocket=null,seed=0x414e4752,along=0,carry=0,spawned=0;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function visible(obj){for(let it=obj;it;it=it.parent)if(!it.visible)return false;return !!obj;}
  function setStyle(key){
    styleName=key;const [a,b,c]=STYLES[key].tint;
    colors.uInk.value.set(a);colors.uGold.value.set(b);colors.uLight.value.set(c);
  }
  function reset(){
    size=0;start=0;along=0;carry=0;spawned=0;hasPrevious=false;oldPhase=-1;lastKind='';lastCombo=-1;styleName='';
    lastBaseSocket=null;lastTipSocket=null;mesh.visible=lightMesh.visible=false;mesh.geometry.setDrawRange(0,0);
    for(const bit of bits)bit.life=0;shards.count=0;
  }
  function addFleck(position,velocity,bladeRay,style,minRadius){
    const f=bits[poolCursor++%MAX_FLECKS], r=minRadius+rand()*(1-minRadius);
    f.p.copy(position).addScaledVector(bladeRay,-(1-r)*oldLength);
    const toss=.30+rand()*1.0, sign=rand()<.36?-1:1;
    f.v.copy(velocity).multiplyScalar((.6+rand()*1.50)*sign).addScaledVector(bladeRay,.40+rand()*1.1);
    f.v.x+=(rand()-.5)*toss;f.v.y+=(.30+rand())*toss;f.v.z+=(rand()-.5)*toss;
    f.age=0;f.life=.11+rand()*.16+(style===STYLES.cleave?.07:0);f.width=(.009+rand()*.012)*(style===STYLES.cleave?1.30:1);
    f.stretch=.030+rand()*.062;f.tone=rand();spawned++;
  }
  function append(p,d,length,born,phase,begin,end,style){
    sampleTip.copy(p).addScaledVector(d,length);
    let distance=0;
    if(size){
      const prev=knots[(start+size-1)%SAMPLES];oldTip.copy(prev.base).addScaledVector(prev.ray,prev.length);
      tangent.subVectors(sampleTip,oldTip);distance=tangent.length();
      // A held pose must not paint a solid patch or spray stationary particles.
      if(distance<.007)return;
      tangent.multiplyScalar(1/distance);along+=distance;
      carry+=distance;
      const threshold=(style===STYLES.cleave?.105:.15)*(1.05+Math.sin(along*9.)*.16);
      if(carry>threshold && spawned<style.flecks){carry%=threshold;addFleck(sampleTip,tangent,d,style,.59);}
    }
    const idx=(start+size)%SAMPLES;
    if(size===SAMPLES)start=(start+1)%SAMPLES;else size++;
    const node=knots[idx];node.base.copy(p);node.ray.copy(d);node.length=length;node.born=born;node.distance=along;
    const progress=clamp((phase-begin)/(end-begin));
    const ramp=style===STYLES.lift?.085:.16;
    node.weight=.14+.86*Math.min(smooth(progress/ramp),smooth((1-progress)/.4));
  }
  function drawPath(style){
    while(size&&clock-knots[start].born>=style.life){start=(start+1)%SAMPLES;size--;}
    mesh.visible=size>=2;
    if(!mesh.visible)return;
    for(let j=0;j<size;j++){
      const n=knots[(start+j)%SAMPLES],fresh=clamp(1-(clock-n.born)/style.life);
      const fade=smooth(fresh), power=Math.sqrt(fade)*n.weight,point=(j*LANES)*2;
      const before=knots[(start+Math.max(0,j-1))%SAMPLES],after=knots[(start+Math.min(size-1,j+1))%SAMPLES];
      tangent.copy(after.base).addScaledVector(after.ray,after.length).sub(before.base).addScaledVector(before.ray,-before.length).normalize();
      for(let k=0;k<LANES;k++){
        const lane=style.lanes[k],idx=point+k*2;
        const baseRadius=lane?lane[0]:.8;
        const wobble=(k===0?.010:.019)*Math.sin(n.distance*(5.2+k*1.5)+k*5.1)*(1-fade*.74);
        const r=baseRadius+wobble, w=lane?lane[1]*(.16+.84*Math.sqrt(power))*(.88+.12*Math.sin(n.distance*8.7+k)):0;
        for(let side=0;side<2;side++){
          const edge=side?1:-1,dist=n.length*(r+edge*w);
          positions.setXYZ(idx+side,n.base.x+n.ray.x*dist,n.base.y+n.ray.y*dist,n.base.z+n.ray.z*dist);
          stroke.setXYZW(idx+side,n.distance,edge,lane?power:0,k);
          const liftBoost=style===STYLES.lift&&k<2?1.26:1;
          const width=lane?(.006+(k===0?.34:.18)*lane[1])*liftBoost*(.12+power*.88):0;
          edgeFrame.setXYZW(idx+side,tangent.x,tangent.y,tangent.z,width);
          radial.setXYZ(idx+side,n.ray.x,n.ray.y,n.ray.z);
        }
      }
    }
    positions.needsUpdate=true;stroke.needsUpdate=true;edgeFrame.needsUpdate=true;radial.needsUpdate=true;mesh.geometry.setDrawRange(0,(size-1)*LANES*6);
  }
  function drawFlecks(dt){
    let count=0;
    for(const f of bits){
      if(f.age>=f.life)continue;
      f.age+=dt;if(f.age>=f.life)continue;
      const ratio=f.age/f.life,fade=Math.max(.02,1-ratio*ratio);
      f.p.addScaledVector(f.v,dt);f.v.y-=3.9*dt;
      dir.copy(f.v).normalize();fleckPose.position.copy(f.p);fleckPose.quaternion.setFromUnitVectors(up,dir);
      fleckPose.scale.set(f.width*fade,f.stretch*(.48+.52*fade),f.width*.64*fade);fleckPose.updateMatrix();
      shards.setMatrixAt(count,fleckPose.matrix);fleckColor.copy(colors.uGold.value).lerp(colors.uLight.value,(1-ratio)*.73+f.tone*.21);
      shards.setColorAt(count++,fleckColor);
    }
    shards.count=count;
    if(count){shards.instanceMatrix.needsUpdate=true;shards.instanceColor.needsUpdate=true;}
  }
  function update(dt,action,bladeBase,bladeTip){
    if(disposed)return;
    const step=Number.isFinite(dt)?Math.max(0,dt):0;
    if(step>.35){reset();return;}
    clock+=step;
    if(!visible(bladeBase)||!visible(bladeTip)){if(hasPrevious||size||shards.count)reset();return;}
    if(lastBaseSocket!==bladeBase||lastTipSocket!==bladeTip){reset();lastBaseSocket=bladeBase;lastTipSocket=bladeTip;}
    const kind=action?.kind||'',combo=clamp(Math.trunc(action?.comboIndex)||0,0,2);
    const key=kind==='attack'?CUTS[combo]:(kind==='gale'||kind==='quake'?kind:'');
    const phase=clamp(Number(action?.phase)||0),contact=Number.isFinite(action?.contact)?action.contact:(kind==='attack'?[.39,.43,.52][combo]:kind==='gale'?.45:.55);
    if(key){
      bladeBase.getWorldPosition(base);bladeTip.getWorldPosition(tip);ray.subVectors(tip,base);
      const len=ray.length();
      if(!Number.isFinite(len)||len<.07){reset();return;}
      ray.multiplyScalar(1/len);
      const newMove=lastKind!==kind||lastCombo!==combo||phase<oldPhase-.004||!styleName;
      if(newMove){size=0;start=0;along=0;carry=0;spawned=0;setStyle(key);hasPrevious=false;}
      if(hasPrevious&&(Math.abs(len-oldLength)>.02||base.distanceToSquared(oldBase)>6)){
        size=0;hasPrevious=false;along=0;carry=0;spawned=0;
        for(const f of bits)f.life=0;shards.count=0;
      }
      const style=STYLES[key],begin=contact-style.lead,end=contact+style.follow;
      const powered=key==='gale'||key==='quake';
      const charge=powered?smooth((phase-.07)/.23)*smooth((contact+.18-phase)/.16):
        (key==='cleave'?.60:.28)*smooth((phase-contact+.10)/.075)*smooth((contact+.085-phase)/.07);
      lightMesh.visible=charge>.006;
      if(lightMesh.visible){
        chargeUniforms.uBase.value.copy(base);chargeUniforms.uTip.value.copy(tip);
        chargeUniforms.uPhase.value=phase;chargeUniforms.uPower.value=charge;
        chargeUniforms.uWidth.value=powered?.136:key==='cleave'?.10:.076;
      }
      if(hasPrevious&&phase>oldPhase&&phase>=begin&&oldPhase<=end){
        const lo=clamp((begin-oldPhase)/(phase-oldPhase)),hi=clamp((end-oldPhase)/(phase-oldPhase));
        const arc=Math.acos(clamp(oldRay.dot(ray),-1,1))*len;
        const subdivisions=clamp(Math.ceil((arc+oldBase.distanceTo(base))*(hi-lo)/style.spacing),1,42);
        turn.setFromUnitVectors(oldRay,ray);
        for(let i=0;i<=subdivisions;i++){
          const f=lo+(hi-lo)*i/subdivisions;
          sampleBase.lerpVectors(oldBase,base,f);
          quaternion.copy(identity).slerp(turn,f);sampleRay.copy(oldRay).applyQuaternion(quaternion);
          append(sampleBase,sampleRay,oldLength+(len-oldLength)*f,clock-step*(1-f),oldPhase+(phase-oldPhase)*f,begin,end,style);
        }
      }else if(!hasPrevious&&phase>=begin&&phase<=end){append(base,ray,len,clock,phase,begin,end,style);}
      oldBase.copy(base);oldRay.copy(ray);oldLength=len;oldPhase=phase;hasPrevious=true;
    }else{lightMesh.visible=false;hasPrevious=false;oldPhase=-1;}
    lastKind=kind;lastCombo=combo;
    if(styleName){drawPath(STYLES[styleName]);drawFlecks(step);}
  }
  function dispose(){
    if(disposed)return;reset();disposed=true;
    for(const obj of [mesh,lightMesh,shards]){obj.removeFromParent();obj.geometry.dispose();obj.material.dispose();}
    shards.dispose();
  }
  return {update,reset,dispose};
}
