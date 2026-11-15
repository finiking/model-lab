// Sword impact. A fault propagates along the actual ground; lifted plates and dust detach from the same trace.
const TAU = Math.PI * 2;
const LIFETIME = 1.9;
const ROCKS = 34;
const PUFFS = 41;
const MAX_VERTICES = 9000;
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = (a, b, x) => { const t = clamp01((x-a)/(b-a)); return t*t*(3-2*t); };

function randomStream(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state,1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function rubbleStone(T, tall) {
  const pos = [], colors = [];
  const rnd = randomStream(tall ? 7833 : 4615);
  const faceTones = ['#76664e','#696051','#907957','#574e42','#8c7861','#685d4d','#ad9470'];
  const corners = [], count = 6;
  for (let i=0; i<count; i++) {
    const a = i / count * TAU + rnd()*.38, r = .68+rnd()*.39;
    corners.push({
      base:[Math.sin(a)*r*.71,-.40-rnd()*.10,Math.cos(a)*r*.78],
      edge:[Math.sin(a)*r,.03+rnd()*.36,Math.cos(a)*r],
      top:[Math.sin(a)*r*(tall ? .27 : .76)-(tall ? .40 : .17),.39+rnd()*(tall ? 1.20 : .28),Math.cos(a)*r*(tall ? .42 : .65)+.14]
    });
  }
  function facet(a,b,c,color) {
    pos.push(...a,...b,...c);
    const tint = new T.Color(color);
    for(let i=0;i<3;i++) colors.push(tint.r,tint.g,tint.b);
  }
  for (let i=0;i<count;i++) {
    const p=corners[i],q=corners[(i+1)%count];
    facet(p.base,q.base,p.edge,faceTones[(i+1)%6]);
    facet(p.edge,q.base,q.edge,faceTones[(i+1)%6]);
    facet(p.edge,q.edge,q.top,faceTones[i%6]);
    facet(p.edge,q.top,p.top,faceTones[i%6]);
    facet(p.top,q.top,[tall ? -.36 : -.08,tall ? 1.16 : .61,.10],i%3===0?'#ceb282':'#b69b72');
    facet(q.base,p.base,[0,-.52,0],'#544c40');
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  return g;
}

const crackVertex = `
uniform float uAge;
attribute float birth;
attribute float upheaval;
attribute float heat;
varying float vBirth;
varying float vHeat;
varying vec3 vInk;
void main(){
  vBirth=birth;vHeat=heat;vInk=color;
  vec3 p=position;
  float t=max(0.,uAge-birth);
  p.y+=upheaval*smoothstep(0.,.12,t)*(1.-.69*smoothstep(.24,1.25,t));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const crackFragment = `
uniform float uAge;
varying float vBirth;
varying float vHeat;
varying vec3 vInk;
void main(){
  float local=uAge-vBirth;
  if(local<=0.) discard;
  float newly=smoothstep(0.,.022,local);
  float hot=exp(-local*2.55);
  vec3 cooled=mix(vInk*.68,vec3(.103,.042,.019),vHeat*.65);
  vec3 color=mix(cooled,vInk*(.92+.14*hot),min(1.,hot*1.55));
  float fade=1.-smoothstep(.61,1.76,uAge);
  gl_FragColor=vec4(color,newly*fade*.96);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const particleVertex = `
attribute vec3 center;
attribute vec4 appearance;
varying vec2 vLocal;
varying vec3 vStamp;
void main(){
  vLocal=position.xy;
  vStamp=vec3(appearance.zw,uv.x);
  vec4 mv=modelViewMatrix*vec4(center,1.);
  mv.xy += position.xy*appearance.xy;
  gl_Position=projectionMatrix*mv;
}`;
const particleFragment = `
varying vec2 vLocal;
varying vec3 vStamp;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float grain(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
void main(){
  vec2 p=vLocal;
  float seed=vStamp.y*51.;
  float billow=grain(p*2.6+seed)*.61+grain(p*5.9-seed)*.27+grain(p*12.3+.7*seed)*.12;
  p.x+=.14*(p.y+.22)*sin(seed);
  float mask=1.-dot(p,p)+(.46-billow)*1.22;
  float a=vStamp.x*smoothstep(.03,.73,mask)*(.48+.52*billow);
  if(a<.012)discard;
  vec3 coal=vec3(.111,.082,.061);
  vec3 clay=vec3(.48,.365,.235);
  float lit=clamp(.28+.34*p.y+.48*billow+.11*sin(seed),0.,1.);
  gl_FragColor=vec4(mix(coal,clay,lit),a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function dustMesh(T) {
  const geo=new T.InstancedBufferGeometry();
  // Vertex z is unused; the plane always faces the camera and its thickness stays ankle-high.
  geo.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0],3));
  geo.setAttribute('uv',new T.Float32BufferAttribute([0,0, 1,0, 0,1, 1,1],2));
  geo.setIndex([0,1,2,2,1,3]);
  for(const [key,n] of [['center',3],['appearance',4]]) {
    const attr=new T.InstancedBufferAttribute(new Float32Array(PUFFS*n),n);
    attr.setUsage(T.DynamicDrawUsage); geo.setAttribute(key,attr);
  }
  geo.instanceCount=PUFFS;
  const mat=new T.ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false});
  const mesh=new T.Mesh(geo,mat);
  mesh.name='Quake • drifting soil';
  mesh.frustumCulled=false;
  mesh.renderOrder=5;
  return mesh;
}

function faultMesh(T) {
  const geo=new T.BufferGeometry();
  for(const [key,n] of [['position',3],['color',3],['birth',1],['heat',1],['upheaval',1]]) {
    const attr=new T.BufferAttribute(new Float32Array(MAX_VERTICES*n),n);
    attr.setUsage(T.DynamicDrawUsage); geo.setAttribute(key,attr);
  }
  geo.setDrawRange(0,0);
  const mat=new T.ShaderMaterial({
    vertexShader:crackVertex,fragmentShader:crackFragment,uniforms:{uAge:{value:0}},vertexColors:true,
    transparent:true,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
  });
  const mesh=new T.Mesh(geo,mat);
  mesh.frustumCulled=false;mesh.renderOrder=2;mesh.name='Quake • ruptured ground';
  return mesh;
}

function traceFaults(T, mesh, origin, yaw, radius, ground, rnd) {
  // A few long shear lines carry most of the impact. Short secondary fractures start
  // at displaced points on their parents, not on equally spaced rays around the blade.
  const anchors=[], trunks=[], g=mesh.geometry, attr=g.attributes;
  const scale=radius/4.7;
  const relief=Math.max(...[[0,0],[.7,.8],[-.8,.3],[.45,-1.0]].map(([x,z])=>Math.abs(ground(origin.x+x,origin.z+z)-ground(origin.x,origin.z))));
  const lift=relief<.0001 ? .012 : .082;
  const palette=['#71553c','#30211d','#9a461e','#f9ae3a','#ffe397','#514136','#b09166'].map(c=>new T.Color(c));
  const h=(x,z)=>ground(x,z)+lift;
  let cursor=0;
  function vertex(pt) {
    const i=cursor++, [x,y,z,c,b,k,lift=0]=pt;
    attr.position.setXYZ(i,x,y,z); attr.color.setXYZ(i,c.r,c.g,c.b);
    attr.birth.setX(i,b); attr.heat.setX(i,k); attr.upheaval.setX(i,lift);
  }
  function strip(a,b) {
    for(let i=0;i<a.length-1;i++){
      vertex(a[i]);vertex(b[i]);vertex(a[i+1]);
      vertex(a[i+1]);vertex(b[i]);vertex(b[i+1]);
    }
  }
  function branch(start,angle,length,width,depth) {
    const count=Math.max(3,Math.ceil(length/((depth ? .27 : .33)*scale)));
    const path=[{...start,a:angle}], heading=angle;
    let a=angle;
    for(let i=1;i<=count;i++) {
      // Alternate strong facet bends with longer straight break planes.
      const kink=(rnd()-.5)*(i%2 ? .88 : .41);
      a+=kink+(heading-a)*.46;
      const d=length/count*(.71+.61*rnd()),last=path[i-1];
      path.push({x:last.x+Math.sin(a)*d,z:last.z-Math.cos(a)*d,a,distance:last.distance+d});
    }
    let previous;
    path.forEach((p,i)=>{
      const t=i/count, prev=path[Math.max(0,i-1)],next=path[Math.min(count,i+1)];
      const dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;
      const nx=-dz/len,nz=dx/len;
      const w=width * (.54+.83*rnd()) * (i===count ? .012 : Math.pow(1-t,.57));
      const left=w*(.69+.36*rnd()),right=w*(.64+.58*rnd());
      const coreOffset=(rnd()-.5)*w*.30;
      const birth=-.035+p.distance/(radius*4.65)+depth*.018;
      const lum=(rnd()>.28 ? palette[4] : palette[3]);
      const lanes=[
        [-left*1.19,palette[0],0,0],[-left*.91,palette[1],0,.010],[-left*.47,palette[2],.2,.006],
        [coreOffset-left*.23,palette[3],1,.004],[coreOffset+right*.20,lum,1,.004],
        [right*.40,palette[2],.3,.006],[right*.83,palette[1],0,.010],[right*1.12,palette[6],0,.003]
      ];
      const row=lanes.map(([e,col,heat,rise])=>{
        const x=p.x+nx*e,z=p.z+nz*e;
        return [x,h(x,z)+rise*scale,z,col,birth,heat];
      });
      if(previous)strip(previous,row);
      previous=row;
      if(i>0 && i<count)anchors.push({...p,nx,nz,width:w,depth,birth});
    });
    return path;
  }
  const start={x:origin.x,z:origin.z,distance:0};
  const fan=[
    [-.27,.98,.205], [.88,.84,.145],[-1.57,.83,.17], [2.10,.75,.132],[-2.60,.52,.12],[.30,.62,.11]
  ];
  for(const [base,d,w] of fan){
    const angle=yaw+base+(rnd()-.5)*.32;
    const path=branch(start,angle,radius*d*(.88+.22*rnd()),w*scale,0);
    trunks.push(path);
  }
  for(const path of trunks) {
    const sign=rnd()<.5?-1:1;
    const n=path.length;
    for(const [frac,side] of [[.29,sign],[.64,-sign]]){
      const node=path[Math.max(1,Math.min(n-2,Math.round((n-1)*(frac+.06*rnd()))))];
      const length=radius*(.15+rnd()*.20);
      const b=branch(node,node.a+side*(.51+rnd()*.66),length,scale*(.068+rnd()*.048),1);
      if(b.length>5 && rnd()>.38){
        const joint=b[Math.floor(b.length*.52)];
        branch(joint,joint.a-side*(.44+.32*rnd()),radius*(.07+.08*rnd()),scale*.036,2);
      }
    }
  }
  // Torn bedrock on one lip hinges up, exposing the warm, rough fracture below.
  const near=anchors.filter(p=>!p.depth && p.distance<radius*.66);
  const capTones=['#927f5e','#a18a63','#8c795d','#aa8c64'].map(c=>new T.Color(c));
  for(let i=0;i<19&&near.length;i++){
    const p=near.splice(Math.floor(rnd()*near.length),1)[0];
    const side=rnd()>.5?1:-1, tx=Math.sin(p.a),tz=-Math.cos(p.a);
    const reach=(.11+.31*rnd())*scale, len=(.12+.38*rnd())*scale;
    const lift=(.09+.21*rnd())*scale, face=capTones[i%4];
    function pt(along,across,tint,raise,heat=0){
      const x=p.x+tx*along+p.nx*side*across, z=p.z+tz*along+p.nz*side*across;
      return [x,h(x,z)+.005,z,tint,p.birth,heat,raise];
    }
    const heel=p.width*.81;
    const a=pt(-len*.52,heel,face,lift*.52), b=pt(-len*.16,heel*.86,face,lift), c=pt(len*.54,heel,face,lift*.67);
    const d=pt(len*.19,heel+reach,face,.003), e=pt(-len*.67,heel+reach*.77,face,.002);
    const underA=pt(-len*.52,heel,palette[2],0,.43), underB=pt(-len*.16,heel*.86,palette[3],0,.8),underC=pt(len*.54,heel,palette[2],0,.43);
    for(const tri of [[a,b,e],[b,d,e],[b,c,d],[a,underA,underB],[a,underB,b],[b,underB,underC],[b,underC,c]])for(const v of tri)vertex(v);
  }
  g.setDrawRange(0,cursor);
  for (const v of Object.values(attr)) {
    v.clearUpdateRanges();v.addUpdateRange(0,cursor*v.itemSize);v.needsUpdate=true;
  }
  return anchors;
}

export function createQuakeFx(T, scene, heightAt) {
  const ground=(x,z)=>heightAt(x,z);
  const stoneGeos=[rubbleStone(T,false),rubbleStone(T,true)];
  const stoneMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.98,metalness:0});
  const dummy=new T.Object3D(),tint=new T.Color();
  const slots=[];
  let generation=0, disposed=false;
  function newSlot() {
    const group=new T.Group(); group.name='Quake impact';group.visible=false;scene.add(group);
    const cracks=faultMesh(T),cloud=dustMesh(T);
    const chunks=stoneGeos.map((g,i)=>{
      const m=new T.InstancedMesh(g,stoneMat,Math.ceil(ROCKS/2));
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;
      m.name=i?'Quake • lifted slabs':'Quake • broken stones';
      return m;
    });
    group.add(cracks,cloud,...chunks);
    const slot={group,cracks,cloud,chunks,age:LIFETIME,rocks:[],puffs:[]};
    slots.push(slot);return slot;
  }
  function selectSlot() {
    return slots.find(s=>!s.group.visible) || (slots.length<2 ? newSlot() : slots.reduce((a,b)=>a.age>b.age?a:b));
  }
  function compose(slot) {
    const age=slot.age;
    slot.cracks.material.uniforms.uAge.value=age;
    for(let i=0;i<slot.rocks.length;i++){
      const s=slot.rocks[i],local=age-s.delay,u=clamp01(local/s.flight);
      const after=Math.max(0,local-s.flight),settle=clamp01(after/s.bounceTime);
      const arc=4*u*(1-u)*s.apex+4*settle*(1-settle)*s.apex*.12;
      const travel=s.reach*(u+(1-(1-settle)**2)*.15);
      const x=s.x+s.dx*travel,z=s.z+s.dz*travel;
      const size=s.size*smooth(-.018,.055,local)*(1-smooth(.68,1.40,local));
      dummy.position.set(x,ground(x,z)+size*.34+arc,z);
      const spin=s.flight*u+s.bounceTime*settle*.54;
      dummy.rotation.set(s.pitch+spin*s.wx,s.turn+spin*s.wy,s.roll+spin*s.wz);
      dummy.scale.set(size*s.width,size*s.height,size*s.depth);
      dummy.updateMatrix();slot.chunks[i%2].setMatrixAt(Math.floor(i/2),dummy.matrix);
    }
    slot.chunks.forEach(m=>{m.instanceMatrix.needsUpdate=true;});
    const {center,appearance}=slot.cloud.geometry.attributes;
    slot.puffs.forEach((p,i)=>{
      const u=clamp01((age-p.delay)/p.life),dist=p.travel*(1-(1-u)**2);
      const x=p.x+p.dx*dist+p.dz*Math.sin(u*2.45)*p.curl,z=p.z+p.dz*dist-p.dx*Math.sin(u*2.45)*p.curl;
      const high=p.base+p.rise*u**.63;
      const width=p.size*(.32+1.08*Math.sqrt(u));
      const opacity=p.opacity*smooth(0,.13,u)*(1-smooth(.26,1,u));
      center.setXYZ(i,x,ground(x,z)+high,z);
      appearance.setXYZW(i,width,width*p.flat,opacity,p.seed);
    });
    center.needsUpdate=true;appearance.needsUpdate=true;
  }
  function strike(origin,yaw=0,radius=4.7) {
    if(disposed || !origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.z))return;
    radius=Math.max(.35,Math.min(16,Number.isFinite(radius)?radius:4.7));
    const slot=selectSlot(), rnd=randomStream(19439+(++generation*7127));
    const scale=radius/4.7,anchors=traceFaults(T,slot.cracks,origin,yaw,radius,ground,rnd);
    const main=anchors.filter(a=>a.depth===0 && a.distance<radius*.80);
    const core=main.filter(a=>a.distance<radius*.39);
    const choose=a=>a[Math.floor(rnd()*a.length)];
    slot.rocks=[];
    for(let i=0;i<ROCKS;i++){
      const m=choose(i<11?core:main);
      const angle=m.a+(rnd()-.5)*1.5;
      const heavy=i<10, size=(heavy ? .18+rnd()*.16 : .055+rnd()*.12)*Math.sqrt(scale);
      const span=m.width*(rnd()-.5)*1.5;
      const piece={
        x:m.x+m.nx*span,z:m.z+m.nz*span,dx:Math.sin(angle),dz:-Math.cos(angle),
        size,width:.67+rnd()*.61,height:(i%2 ? .65 : .27)+rnd()*(i%2 ? .71 : .42),depth:.36+rnd()*.51,
        apex:(heavy ? .49+rnd()*.67 : .32+rnd()*.78)*Math.sqrt(scale),
        reach:(heavy ? .30+rnd()*.71 : .56+rnd()*1.4)*scale,delay:m.birth+.02*rnd(),
        flight:.39+rnd()*.38,bounceTime:.13+rnd()*.14,
        pitch:rnd()*TAU,turn:rnd()*TAU,roll:rnd()*TAU,
        wx:(rnd()-.5)*12,wy:(rnd()-.5)*11,wz:(rnd()-.5)*13
      };
      slot.rocks.push(piece);
      tint.set(['#e6d9bf','#ddc4a0','#d1c9a2','#cab8a4','#e9c899'][i%5]);
      slot.chunks[i%2].setColorAt(Math.floor(i/2),tint);
    }
    for(const m of slot.chunks)m.instanceColor.needsUpdate=true;
    slot.puffs=[];
    for(let i=0;i<PUFFS;i++){
      const p=choose(i%4===0?core:main), angle=p.a+(rnd()-.5)*1.6;
      const side=(rnd()<.5?-1:1)*p.width*.74;
      slot.puffs.push({
        x:p.x+p.nx*side,z:p.z+p.nz*side,dx:Math.sin(angle),dz:-Math.cos(angle),curl:(rnd()-.5)*.39*scale,
        base:.045+.07*rnd(),rise:(.065+.24*rnd())*Math.sqrt(scale),
        travel:(.38+1.18*rnd())*scale,delay:p.birth+.018+.16*rnd(),life:.61+.55*rnd(),
        size:(.28+.41*rnd())*Math.sqrt(scale),flat:.33+.26*rnd(),opacity:.46+.23*rnd(),seed:rnd()
      });
    }
    slot.age=.001; slot.group.visible=true;compose(slot);
  }
  function update(dt){
    if(disposed || !Number.isFinite(dt) || dt<0)return;
    for(const slot of slots){
      if(!slot.group.visible)continue;
      slot.age+=dt;
      if(slot.age>=LIFETIME)slot.group.visible=false;
      else compose(slot);
    }
  }
  function reset(){for(const s of slots){s.group.visible=false;s.age=LIFETIME;}}
  function dispose(){
    if(disposed)return;
    reset();disposed=true;
    for(const s of slots){
      scene.remove(s.group);
      for(const m of [s.cracks,s.cloud]){m.geometry.dispose();m.material.dispose();}
      for(const m of s.chunks)m.dispose();
    }
    for(const g of stoneGeos)g.dispose();
    stoneMat.dispose();slots.length=0;
  }
  return {strike,update,reset,dispose};
}
