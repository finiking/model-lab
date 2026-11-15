// Hand coordinates are anatomical: the wrist is at the origin, fingers point down,
// the thumb faces -Z, and the back of the right hand faces +X.
const TAU = Math.PI * 2;
const radians = Math.PI / 180;
const gripAxis = [0, -.26, -Math.sqrt(1 - .26 * .26)];
const gripCenter = [-.026, -.116, -.002];
const gripBase = .155;

function surface(T, skinned = false) {
  const positions = [], colors = [], indices = [], joints = [], weights = [];
  const color = new T.Color();
  function vertex(p, tint, bone) {
    const i = positions.length / 3;
    positions.push(...p);
    color.set(tint);
    colors.push(color.r, color.g, color.b);
    if (skinned) { joints.push(bone,0,0,0); weights.push(1,0,0,0); }
    return i;
  }
  // Rings run from top to bottom; the seam shares vertices for a soft highlight.
  function loft(rows, tint, bone = 0, sides = 10) {
    let last;
    for (const [x,y,z,rx,rz] of rows) {
      const row = [];
      for (let j=0;j<sides;j++) {
        const a = TAU*j/sides;
        row.push(vertex([x+rx*Math.cos(a),y,z+rz*Math.sin(a)],tint,bone));
      }
      if (last) {
        for (let j=0;j<sides;j++) {
          const k=(j+1)%sides;
          indices.push(last[j],last[k],row[k],last[j],row[k],row[j]);
        }
      } else {
        for (let j=1;j<sides-1;j++) indices.push(row[0],row[j+1],row[j]);
      }
      last=row;
    }
    for (let j=1;j<sides-1;j++) indices.push(last[0],last[j],last[j+1]);
  }
  function oval(x,y,z,rx,ry,rz,tint,bone=0,sides=9) {
    loft([[x,y+ry,z,rx*.24,rz*.24],[x,y+ry*.78,z,rx*.66,rz*.68],
      [x,y+ry*.22,z,rx,rz],[x,y-ry*.38,z,rx*.95,rz*.93],
      [x,y-ry*.82,z,rx*.59,rz*.58],[x,y-ry,z,rx*.20,rz*.20]],tint,bone,sides);
  }
  function facet(points,tint,bone=0) {
    const ids=points.map(p=>vertex(p,tint,bone));
    for(let j=1;j<ids.length-1;j++) indices.push(ids[0],ids[j],ids[j+1]);
  }
  function geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    if(skinned) {
      g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
      g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    }
    g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  return {loft,oval,facet,geometry};
}

function makeGlove(T, wrist, side, material) {
  const outline=surface(T,true);
  const root=new T.Bone();
  root.name=side>0?'rightPalm':'leftPalm';
  const bones=[root], fingers=[];
  const frame = new T.Group();
  frame.name=root.name+'Frame';
  wrist.add(frame);
  if (side>0) frame.rotation.set(-.32,-.79,0,'YXZ');
  else frame.rotation.set(.02,.10,.02,'YXZ');
  const leather='#664334', grain='#8d6144', edging='#b88853', shade='#4a3330';
  const exposed='#b77d5e', tip='#d29972';
  // Palm narrows at the wrist and widens in the plane of the knuckle row.
  outline.loft([[0,.016,0,.039,.042],[0,-.012,.001,.043,.047],
    [0,-.046,-.002,.047,.065],[.002*side,-.080,-.002,.046,.078],
    [.003*side,-.104,-.006,.037,.075],[.005*side,-.119,-.012,.027,.062]],leather);
  // Thenar pad, arched heel, glove cuff, and reinforced dorsal shield.
  outline.oval(-side*.027,-.064,-.038,.030,.048,.037,grain);
  outline.oval(-side*.018,-.071,.037,.031,.045,.031,leather);
  outline.loft([[0,.015,0,.046,.048],[0,.011,0,.050,.053],[0,-.012,0,.052,.057],
    [0,-.018,0,.048,.054]],shade);
  outline.loft([[0,-.009,0,.052,.058],[0,-.015,0,.053,.059]],edging);
  const dorsal=[[.036,-.030,0],[.035,-.052,-.045],[.034,-.094,-.050],
    [.044,-.108,-.008],[.036,-.094,.053],[.037,-.052,.048]];
  for(let i=0;i<dorsal.length;i++) {
    const points=[dorsal[i],dorsal[(i+1)%dorsal.length],[.050,-.072,0]].map(([x,y,z])=>[x*side,y,z]);
    if(side<0)points.reverse();
    outline.facet(points,i%3===0?'#9f8055':'#74624f');
  }

  function joint(parent,name,x,y,z) {
    const bone = new T.Bone(); bone.name=root.name+'-'+name;
    bone.position.set(x,y,z); parent.add(bone); bones.push(bone);
    return {bone,index:bones.length-1};
  }

  const definitions=[
    ['index',-.057,-.121,.047,.036,.028,.017],
    ['middle',-.018,-.119,.054,.039,.031,.0185],
    ['ring',.020,-.112,.051,.036,.027,.0175],
    ['little',.055,-.102,.041,.029,.024,.015]
  ];
  for(const [name,z,y,a,b,c,r] of definitions) {
    const x=side*.010;
    const upper=joint(root,name+'MCP',x,y,z);
    const center=joint(upper.bone,name+'PIP',0,-a,0);
    const end=joint(center.bone,name+'DIP',0,-b,0);
    // Each articulated segment has a broad base and tapered tip. Leather welt and
    // exposed fingertips give the phalanges different thickness and surface color.
    outline.oval(x,y+.004,z,r*1.18,r*1.08,r*1.04,grain,upper.index);
    outline.loft([[x,y+.005,z,r*.86,r*.99],[x,y-.011,z,r,r*1.03],
      [x,y-a+.005,z,r*.83,r*.85],[x,y-a-.002,z,r*.78,r*.78]],leather,upper.index);
    outline.oval(x,y-a,z,r*.86,r*.84,r*.91,grain,center.index);
    outline.loft([[x,y-a+.004,z,r*.83,r*.85],[x,y-a-.010,z,r*.88,r*.86],
      [x,y-a-b+.004,z,r*.72,r*.76],[x,y-a-b,z,r*.66,r*.70]],exposed,center.index);
    outline.loft([[x,y-a-.0005,z,r*.94,r*.96],[x,y-a-.008,z,r*.95,r*.98]],edging,center.index);
    outline.oval(x,y-a-b-c*.37,z,r*.77,c*.66,r*.79,tip,end.index);
    fingers.push([upper.bone,center.bone,end.bone]);
  }
  // The thumb opposes the fingers from the palm side; it has its own basal swivel.
  const tx=-side*.021, ty=-.059, tz=-.055;
  const thumbBase=joint(root,'thumbCMC',tx,ty,tz);
  const thumbMid=joint(thumbBase.bone,'thumbMCP',0,-.043,0);
  const thumbEnd=joint(thumbMid.bone,'thumbIP',0,-.038,0);
  outline.oval(tx,ty-.016,tz,.026,.035,.029,grain,thumbBase.index);
  outline.oval(tx,ty-.056,tz,.023,.030,.023,leather,thumbMid.index);
  outline.oval(tx,ty-.091,tz,.020,.026,.020,tip,thumbEnd.index);
  const mesh=new T.SkinnedMesh(outline.geometry(),material);
  mesh.name=side>0?'Sword-hand glove':'Casting-hand glove';
  mesh.add(root);
  mesh.bind(new T.Skeleton(bones));
  frame.add(mesh);
  // The posed hand occupies under 25 cm; the body renderer handles world culling.
  mesh.frustumCulled=false;
  mesh.castShadow=true; mesh.receiveShadow=true;
  return {frame,fingers,thumb:[thumbBase.bone,thumbMid.bone,thumbEnd.bone]};
}

const blades = [
  {name:'巡林短剑',length:1.10,width:.068,guard:.17,shoulder:1.12,metal:'#c9d5d5',flank:'#8b9ca9',trim:'#b98f56',edging:'#f2e4bf',leather:'#4a3330',gem:'#426f70'},
  {name:'守望者长剑',length:1.20,width:.079,guard:.211,shoulder:1.21,metal:'#d6e5e4',flank:'#8498a2',trim:'#bc9654',edging:'#f3de9d',leather:'#3b3531',gem:'#68a694'},
  {name:'风蚀重刃',length:1.28,width:.104,guard:.218,shoulder:1.33,metal:'#accad1',flank:'#577a8d',trim:'#aa8654',edging:'#e2c999',leather:'#344b51',gem:'#80ccc8'},
  {name:'铭誓之刃',length:1.30,width:.098,guard:.228,shoulder:1.28,metal:'#d2e4ef',flank:'#737e99',trim:'#cc9f59',edging:'#f4dfa5',leather:'#444050',gem:'#b6a0d6'}
];

function makeBlade(T, profile, tier, material) {
  const s=surface(T),{width:w,length,guard:g,trim,edging,leather,metal,flank,gem}=profile;
  // Blade axis is local +Y. Its spine, recessed fuller and cutting bevels
  // are real, separate facets visible from either side of the weapon.
  const levels=[[0,.74,.020],[.075,profile.shoulder,.025],[.145,1,.024],
    [length*.70,.78,.019],[length*.85,.58,.014],[length,.014,.001]];
  const across=[-1,-.74,-.16,0,.16,.74,1];
  const depth=[0,.62,1,.74,1,.62,0];
  for(const face of [-1,1]) {
    const palette=[edging,flank,metal,flank,metal,'#f1f2df'];
    for(let n=0;n<levels.length-1;n++) {
      const point=(row,j)=>[across[j]*w*row[1],gripBase+row[0],face*depth[j]*row[2]];
      for(let j=0;j<across.length-1;j++) {
        const points=[point(levels[n],j),point(levels[n],j+1),point(levels[n+1],j+1),point(levels[n+1],j)];
        if(face<0)points.reverse();
        s.facet(points,palette[j]);
      }
    }
    const collarY=gripBase+.042;
    s.facet([[-w*.60,gripBase,face*.028],[w*.60,gripBase,face*.028],
      [w*.50,collarY,face*.028],[0,collarY+.049,face*.028],[-w*.50,collarY,face*.028]],trim);
    // Short, chased chevrons stand above the ricasso. Avoid markings on the cutting edge.
    for(let k=0;k<=tier;k++) {
      const y=gripBase+.155+.043*k, d=.0255*face;
      s.facet([[-.012,y+.008,d],[0,y-.003,d],[.012,y+.008,d],[0,y+.003,d]],edging);
    }
  }
  // Quillons sweep toward the blade and have a distinct central ridge.
  for(const side of [-1,1]) {
    const rows=[[0,-.060,.024],[g*.38,-.047,.023],[g*.79,.004,.018],[g,.027,.011]];
    for(let i=0;i<rows.length-1;i++) {
      const a=rows[i],b=rows[i+1];
      const point=(r,edge,z)=>[side*r[0],gripBase+r[1]+edge*r[2],z*r[2]];
      for(const face of [-1,1]) {
        s.facet([point(a,-1,0),point(b,-1,0),point(b,0,face*1.25),point(a,0,face*1.25)],trim);
        s.facet([point(a,0,face*1.25),point(b,0,face*1.25),point(b,1,0),point(a,1,0)],edging);
      }
    }
  }
  // A narrow oval grip leaves room for four folded fingers to close around it.
  s.loft([[0,.113,0,.031,.030],[0,.092,0,.029,.023],[0,.036,0,.025,.022],
    [0,-.070,0,.027,.024],[0,-.118,0,.030,.026]],leather);
  for(let j=0;j<8;j++) {
    const y=-.11+j*.029, r=.027+Math.abs(j-3.5)*.0008;
    const seg=12;
    for(let k=0;k<seg;k++) {
      const a=k*TAU/seg,b=(k+1)*TAU/seg;
      const p=(az,dy)=>[r*1.03*Math.cos(az),y+.014*az/TAU+dy,r*.92*Math.sin(az)];
      s.facet([p(a,0),p(b,0),p(b,.004),p(a,.004)],j%3===0?trim:'#836e54');
    }
  }
  s.loft([[0,.116,0,.035,.029],[0,.106,0,.035,.030]],edging);
  s.loft([[0,-.117,0,.033,.032],[0,-.129,0,.034,.032],[0,-.141,0,.025,.024]],trim);
  s.loft([[0,-.136,0,.021,.019],[0,-.151,0,.044,.034],[0,-.177,0,.047,.035],
    [0,-.203,0,.024,.021],[0,-.212,0,.009,.009]],trim,0,8);
  for(const face of [-1,1]) {
    const gemFace=(y,rx,ry,z)=>s.facet([[0,y+ry,face*z],[rx,y,face*z],[0,y-ry,face*z],[-rx,y,face*z]],gem);
    gemFace(-.165,.018,.021,.035);
    gemFace(gripBase+.026,.015,.022,.029);
  }
  const mesh=new T.Mesh(s.geometry(),material);
  mesh.name=profile.name; mesh.castShadow=true; mesh.receiveShadow=true;
  return mesh;
}

function makePotion(T,palm) {
  const flask=new T.Group();
  flask.name='healingFlask';
  // A flattened field bottle fits between the heel of the thumb and curled fingers.
  flask.position.set(.052,-.121,-.013);
  flask.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), new T.Vector3(0,.63,-.777).normalize());
  palm.add(flask);
  const profile=[
    [.173,.022,.020],[.166,.022,.020],[.162,.017,.015],[.103,.017,.015],
    [.089,.024,.020],[.071,.045,.032],[.045,.055,.040],[.010,.059,.043],
    [-.036,.068,.052],[-.064,.069,.054],[-.088,.055,.045],[-.104,.039,.033]
  ];
  function mesh(rows,color,material) {
    const outline=surface(T);
    outline.loft(rows.map(([y,rx,rz])=>[0,y,0,rx,rz]),color,0,12);
    const part=new T.Mesh(outline.geometry(),material);
    flask.add(part);
    return part;
  }
  const glass=new T.MeshStandardMaterial({vertexColors:true,roughness:.18,transparent:true,opacity:.34,
    depthWrite:false,metalness:.08,side:T.FrontSide});
  const trim=new T.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:.45});
  const tincture=new T.MeshStandardMaterial({vertexColors:true,roughness:.26,emissive:0x62151a,emissiveIntensity:.39});
  mesh(profile,'#a6d8d1',glass);
  // Open neck with a thick lip and collar around its base.
  const rim=new T.Mesh(new T.TorusGeometry(.019,.0036,6,14),trim.clone());
  rim.material.vertexColors=false; rim.material.color.set('#d3b26c');
  rim.rotation.x=Math.PI/2; rim.position.y=.173; flask.add(rim);
  mesh([[.123,.020,.018],[.116,.021,.019],[.107,.020,.018]],'#bd9552',trim);
  const foot=new T.Mesh(new T.TorusGeometry(.039,.003,6,14),rim.material);
  foot.rotation.x=Math.PI/2; foot.scale.y=.84; foot.position.y=-.103; flask.add(foot);
  const fill=mesh([[.050,.051,.036],[.010,.055,.039],[-.036,.064,.048],[-.064,.065,.050],
    [-.088,.051,.041],[-.099,.037,.030]],'#d43345',tincture);
  fill.name='crimsonDraught';
  const mouth=new T.Object3D(), base=new T.Object3D();
  mouth.name='potionMouth'; base.name='potionBase';
  mouth.position.y=.173; base.position.y=-.108; flask.add(mouth,base);
  flask.visible=false;
  return {flask,fill};
}

export function createHeroHands(T,{handL,handR}) {
  const gloveMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.79,side:T.DoubleSide});
  const swordMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.38,metalness:.55,side:T.DoubleSide});
  const left=makeGlove(T,handL,-1,gloveMaterial), right=makeGlove(T,handR,1,gloveMaterial);
  const potion=makePotion(T,left.frame);
  const sword=new T.Group();
  sword.name='weaponGrip'; right.frame.add(sword);
  sword.position.set(...gripCenter);
  const y=new T.Vector3(...gripAxis);
  const x=new T.Vector3(.46,0,0).addScaledVector(new T.Vector3(0,-y.z,y.y),Math.sqrt(1-.46*.46));
  sword.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,new T.Vector3().crossVectors(x,y)));
  const bladeBase=new T.Object3D(),bladeTip=new T.Object3D();
  bladeBase.name='bladeBase'; bladeTip.name='bladeTip';
  bladeBase.position.y=gripBase;
  sword.add(bladeBase,bladeTip);
  const weapons=new Map();
  let armed=true;
  function equip(weapon) {
    armed=Boolean(weapon); sword.visible=armed;
    if (!armed) return;
    let n=blades.findIndex(b=>b.name===(weapon.name || weapon));
    if(n<0)n=({'普通':0,'精良':1,'稀有':2,'史诗':3,common:0,fine:1,rare:2,epic:3})[weapon.rarity] ?? 0;
    if(!weapons.has(n)) { const mesh=makeBlade(T,blades[n],n,swordMaterial); weapons.set(n,mesh); sword.add(mesh); }
    for(const [i,mesh] of weapons) mesh.visible=i===n;
    bladeTip.position.y=gripBase+blades[n].length;
  }

  // In a sword grip the thumb opposes the index instead of closing parallel to it.
  // Compose the three desired directions into relative phalanx rotations once.
  const down=new T.Vector3(0,-1,0);
  const thumbAim=[[-.55,-.68,-.49],[-.39,-.73,.56],[0,-.60,.80]]
    .map(d=>new T.Quaternion().setFromUnitVectors(down,new T.Vector3(...d).normalize()));
  const thumbGrip=thumbAim.map((q,i)=>i?thumbAim[i-1].clone().invert().multiply(q):q);
  const hold=[30,75,52], relaxed=[11,20,15], guard=[25,43,33], casting=[-5,7,5], bottleGrip=[22,46,40];
  function pose(hand,side,from,to,mix,spread,armedSide,pulse) {
    for(let i=0;i<4;i++) {
      const chain=hand.fingers[i];
      for(let j=0;j<3;j++) {
        const flex=(from[j]+(to[j]-from[j])*mix+(armedSide?i*.8:i*(3+2*pulse)))*radians;
        chain[j].rotation.z=-side*flex;
        chain[j].rotation.x=j===0?(1.45-i)*spread:0;
      }
    }
    // Thumb starts in radial abduction and folds across the first two fingers.
    if(armedSide) {
      for(let i=0;i<3;i++) hand.thumb[i].quaternion.copy(thumbGrip[i]);
      return;
    }
    const clench=Math.min(1,(from[1]+(to[1]-from[1])*mix)/90);
    const [base,mid,end]=hand.thumb;
    base.rotation.set(.46+spread*.3,-side*(.28+.51*clench),-side*(.39+.58*clench),'YXZ');
    mid.rotation.set(-.60-.36*clench,0,-side*.26);
    end.rotation.set(-.30-.40*clench,0,-side*.12);
  }
  function update(dt,state={},t=0) {
    const phase=Math.max(0,Math.min(1,Number(state.actionPhase)||0));
    const envelope=Math.sin(phase*Math.PI);
    const drinking=state.actionKind==='heal'&&!state.dead&&phase>=.08&&phase<=.88;
    potion.flask.visible=drinking;
    if(drinking){
      // The liquid line falls during the sip; keep the glass floor in the same place.
      const sip=Math.max(0,Math.min(1,(phase-.44)/.19));
      potion.fill.scale.y=1-.72*sip;
      potion.fill.position.y=-.099*(1-potion.fill.scale.y);
    }
    const spell=state.actionKind==='gale'||state.actionKind==='quake';
    const braced=state.actionKind==='attack'||state.actionKind==='dodge';
    const breath=Math.sin(t*1.8)*.32;
    if(armed) pose(right,1,hold,hold,0,.014,true,0);
    else pose(right,1,relaxed,guard,braced?envelope:.15,.035,false,breath);
    if(drinking) pose(left,-1,bottleGrip,bottleGrip,1,.012,false,0);
    else pose(left,-1,relaxed,spell?casting:guard,spell||braced?envelope:.23,
      .049+(spell?.18*envelope:0),false,breath);
  }
  equip({name:'巡林短剑'}); update(0);
  return {equip,update,bladeBase,bladeTip};
}
