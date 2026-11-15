// Local +Z is the back of each figure. Static details are batched per animated joint.
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, Number(x) || 0));
const ease = (current, target, rate, dt) => current + (target-current) * (1-Math.exp(-rate*dt));

function atelier(T) {
  const colors = new Map();
  const materials = {
    cloth: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.91, side: T.DoubleSide }),
    steel: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.34, side: T.DoubleSide }),
    rune: new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, toneMapped: false })
  };
  const batches = new Map();
  function joint(parent, x=0, y=0, z=0) {
    const g = new T.Group(); parent.add(g); g.position.set(x,y,z); return g;
  }
  function tint(color) {
    if (!colors.has(color)) colors.set(color, new T.Color(color));
    return colors.get(color);
  }
  function tri(g, layer, color, a,b,c, shade=1) {
    let buckets = batches.get(g); if (!buckets) batches.set(g,buckets={});
    const out = buckets[layer] ||= {pos:[],col:[]};
    const rgb=tint(color); out.pos.push(...a,...b,...c);
    for (let i=0;i<3;i++) out.col.push(rgb.r*shade,rgb.g*shade,rgb.b*shade);
  }
  function quad(g,layer,col,a,b,c,d,shade=1){tri(g,layer,col,a,b,c,shade);tri(g,layer,col,a,c,d,shade);}
  // Rings are [height, x-radius, z-radius, center-x, center-z, per-ring twist].
  function loft(g,layer,col,rings,n=8,phase=Math.PI/n,facets=0.035) {
    const vertices=rings.map(([y,rx,rz,dx=0,dz=0,twist=0])=>Array.from({length:n},(_,j)=>{
      const ang=phase+twist+TAU*j/n; return [dx+Math.sin(ang)*rx,y,dz+Math.cos(ang)*rz];
    }));
    for(let k=0;k<rings.length-1;k++) for(let j=0;j<n;j++) {
      const j2=(j+1)%n, f=1+facets*Math.sin(29.3*j+17.5*k);
      quad(g,layer,col,vertices[k][j],vertices[k][j2],vertices[k+1][j2],vertices[k+1][j],f);
    }
    for(let j=1;j<n-1;j++){
      tri(g,layer,col,vertices[0][0],vertices[0][j],vertices[0][j+1]);
      const last=vertices[vertices.length-1]; tri(g,layer,col,last[0],last[j+1],last[j]);
    }
  }
  // A raised, bevelled angular plate. Its outline is specified in the local XY plane.
  function plate(g,layer,col,outline,z,thickness=.025,ridge=.03) {
    const cx=outline.reduce((s,p)=>s+p[0],0)/outline.length, cy=outline.reduce((s,p)=>s+p[1],0)/outline.length;
    const faceDir=Math.sign(thickness)||1, middle=[cx,cy,z+thickness+faceDir*ridge];
    for(let i=0;i<outline.length;i++) {
      const [x,y]=outline[i], [xx,yy]=outline[(i+1)%outline.length];
      const a=[x,y,z+thickness], b=[xx,yy,z+thickness];
      tri(g,layer,col,a,b,middle,1+0.035*Math.sin(i*12.3));
      quad(g,layer,col,[x,y,z],[xx,yy,z],b,a,.76);
    }
  }
  function chip(g,layer,col,x,y,z,sx,sy,sz,angle=0,seed=0) {
    const n=6, levels=[[-.5,.62],[-.3,1],[.22,.97],[.5,.6]];
    const rings=levels.map(([h,r],i)=>Array.from({length:n},(_,j)=>{
      const theta=TAU*j/n+angle+.16*Math.sin(i*3+seed), noise=1+.12*Math.sin(4.91*j+seed*9+i*.3);
      return [x+Math.sin(theta)*sx*.5*r*noise,y+sy*(h+.07*Math.sin(j*3.7+seed+i*.4)),z+Math.cos(theta)*sz*.5*r*noise];
    }));
    for(let k=0;k<3;k++)for(let j=0;j<n;j++){
      const a=rings[k][j],b=rings[k][(j+1)%n],c=rings[k+1][(j+1)%n],d=rings[k+1][j];
      const f=1+.085*Math.sin(j*12.35+k*5.6+seed); tri(g,layer,col,a,b,c,f);tri(g,layer,col,a,c,d,f+.035*Math.sin(j+seed));
    }
    for(let j=1;j<n-1;j++){
      tri(g,layer,col,rings[0][0],rings[0][j],rings[0][j+1],.82);
      tri(g,layer,col,rings[3][0],rings[3][j+1],rings[3][j],1.08);
    }
  }
  function flush() {
    for(const [g,buckets] of batches) for(const [layer,b] of Object.entries(buckets)) {
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));
      geo.setAttribute('color',new T.Float32BufferAttribute(b.col,3));geo.computeVertexNormals();
      const m=new T.Mesh(geo,materials[layer]);m.castShadow=layer!=='rune';m.receiveShadow=true;g.add(m);
    }
    batches.clear();
  }
  return {joint,tri,quad,loft,plate,chip,flush,materials};
}

export { createHero } from './hero.js';

export function createMonster(T, kind='sentinel') {
  const {joint,loft,plate,chip,tri,flush,materials}=atelier(T);
  const boss=kind==='boss', elite=kind==='elite'||boss;
  const root=new T.Group(), rig=joint(root), body=joint(rig,0,1.15,0), neck=joint(body,0,1.00,-.047);
  const size=boss?1.49:elite?1.13:1;root.scale.setScalar(size);
  const stone=boss?'#424e51':elite?'#677678':'#70837e', slate=boss?'#374249':elite?'#526869':'#526863';
  const light=boss?'#687875':elite?'#839493':'#96a59a', deep='#303d3b', moss=boss?'#777344':elite?'#849151':'#8a9955';
  const mossDark=boss?'#656135':'#626f41', rune=boss?'#ff7543':elite?'#ffab40':'#ffc05b', gold=boss?'#ae6944':'#a58a51';
  function turf(g,x,y,z,w,h,d,seed=0){
    chip(g,'cloth',mossDark,x,y,z,w,h,d,.06,seed);
    chip(g,'cloth',moss,x-.025*w,y+h*.12,z-.024*d,w*.86,h*.89,d*.94,.16,seed);
    for(let i=0;i<7;i++){
      const a=TAU*i/7+seed,xx=x+w*.29*Math.sin(a),zz=z+d*.30*Math.cos(a),off=.06+.045*Math.sin(7*i+seed);
      tri(g,'cloth',i%2?moss:'#aab46b',[xx-.015,y+h*.15,zz],[xx+.025,y+h*.15,zz+.013],[xx+off*.48,y+h*.48+off,zz-.026]);
    }
  }
  // Basalt spike with an uneven silhouette and a mossy/dusty tip.
  function spur(g,x,y,z,h,w,dx,dz,color=light){
    loft(g,'cloth',color,[[y,w,w*.72,x,z],[y+h*.36,w*.78,w*.68,x+dx*.23,z+dz*.23],[y+h,w*.07,w*.055,x+dx,z+dz]],5,.51,.1);
  }
  function mark(g,points,z,col=rune,thick=-.015){plate(g,'rune',col,points,z,thick,0);}
  chip(body,'cloth',deep,0,.02,0,.82,.53,.53,.25,2);
  chip(body,'cloth',slate,0,.42,.025,1.12,.89,.66,.01,3);
  chip(body,'cloth',stone,0,.67,.018,1.25,.64,.74,.15,6);
  chip(body,'cloth',stone,0,.14,.019,.89,.29,.62,.06,4);
  // Fractured cuiras from both sides reveal the power stone in the centre.
  for(const s of [-1,1]){
    plate(body,'cloth',light,[[s*.08,.70],[s*.28,.89],[s*.57,.86],[s*.66,.62],[s*.38,.38],[s*.19,.43]],-.18,-.14,.08);
    plate(body,'cloth',slate,[[s*.16,.38],[s*.40,.44],[s*.43,.28],[s*.26,.12],[s*.03,.14]],-.20,-.078,.028);
    mark(body,[[s*.215,.824],[s*.27,.814],[s*.18,.65],[s*.307,.686],[s*.28,.65],[s*.115,.553],[s*.155,.70]],-.346);
    chip(body,'cloth',light,s*.39,.68,.218,.39,.4,.34,.21,s+1);
    turf(body,s*.46,.89,.06,.37,.084,.45,9+s);
  }
  plate(body,'cloth',deep,[[0,.80],[.206,.60],[.124,.423],[0,.34],[-.13,.424],[-.207,.60]],-.24,-.094,.035);
  mark(body,[[0,.741],[.115,.578],[0,.408],[-.117,.578]],-.365);
  mark(body,[[0,.675],[.049,.578],[0,.504],[-.05,.578]],-.387,'#fff2ad');
  // Face sits low between the enormous shoulders, with a projecting brow and jaw.
  chip(neck,'cloth',deep,0,.05,0,.48,.40,.49,0,1);
  chip(neck,'cloth',stone,0,.20,-.015,.69,.57,.53,.08,5);
  chip(neck,'cloth',light,-.011,.36,-.04,.73,.245,.56,.2,3);
  plate(neck,'cloth',deep,[[-.262,.28],[.259,.28],[.218,.132],[.088,.065],[-.127,.097],[-.226,.15]],-.21,-.07,.012);
  for(const s of [-1,1]){
    mark(neck,[[s*.046,.192],[s*.248,.24],[s*.205,.161],[s*.069,.133]],-.296);
    plate(neck,'cloth',light,[[s*.025,.214],[s*.24,.304],[s*.30,.292],[s*.245,.248],[s*.034,.18]],-.237,-.076,.015);
    plate(neck,'cloth',stone,[[s*.097,.12],[s*.221,.158],[s*.244,.076],[s*.174,-.002],[s*.051,.003]],-.21,-.065,.025);
    spur(neck,s*.18,.399,.018,elite?.28:.16,.092,s*.074,-.015,light);
  }
  plate(neck,'cloth',light,[[0,.245],[.06,.143],[.048,.08],[0,.048],[-.057,.087],[-.043,.177]],-.264,-.07,.03);
  turf(neck,-.055,.432,.039,.43,.072,.36,3);
  if(elite) {spur(neck,.001,.44,.082,boss?.45:.27,.122,.019,.012,stone);}
  if(boss){
    for(const s of [-1,1]){
      spur(neck,s*.30,.25,.035,.47,.115,s*.26,.105,stone);
      mark(body,[[s*.37,.79],[s*.53,.75],[s*.455,.625],[s*.51,.635],[s*.39,.48],[s*.411,.62],[s*.373,.61]],-.382,rune);
      chip(body,'cloth',gold,s*.345,.42,-.273,.145,.14,.11,.1,s);
    }
  }
  const legs=[],arms=[];
  for(const s of [-1,1]){
    const hip=joint(rig,s*.274,1.17,0), knee=joint(hip,0,-.47,.005);
    chip(hip,'cloth',deep,0,-.08,0,.34,.29,.34,.24,s+1);
    chip(hip,'cloth',stone,s*.025,-.23,-.016,.43,.48,.45,.13,s+4);
    chip(knee,'cloth',deep,0,-.03,-.005,.285,.31,.33,.04,s+2);
    chip(knee,'cloth',light,s*.01,.004,-.112,.37,.26,.36,.26,s+6);
    chip(knee,'cloth',slate,s*.022,-.279,.025,.43,.50,.49,.24,s+1);
    chip(knee,'cloth',stone,s*.045,-.563,-.099,.55,.264,.62,.11,s+6);
    chip(knee,'cloth',light,s*.067,-.606,-.246,.54,.17,.48,.12,s+2);
    turf(knee,s*.095,-.403,-.092,.32,.055,.32,4+s);
    mark(knee,[[s*.04,-.16],[s*.083,-.153],[s*.027,-.32],[s*.073,-.35],[s*.005,-.417],[s*.015,-.344],[-s*.024,-.32]],-.174,rune);
    legs.push([s,hip,knee]);
    const upper=joint(body,s*.625,.764,-.0), fore=joint(upper,s*.109,-.486,-.034), fist=joint(fore,s*.014,-.433,-.065);
    chip(upper,'cloth',deep,s*.035,-.20,0,.36,.49,.35,.21,s+7);
    chip(upper,'cloth',stone,s*.011,-.023,-.004,.65,.52,.61,.07,s+9);
    chip(upper,'cloth',light,s*.068,.069,.027,.59,.39,.57,.3,s+3);
    turf(upper,s*.10,.214,.029,.56,.12,.47,s+8);
    if(elite){spur(upper,s*.133,.196,.012,boss?.59:.31,.139,s*.17,-.045);spur(upper,-s*.043,.172,.145,boss?.43:.22,.11,s*.02,.075,slate);}
    if(boss){spur(upper,s*.22,.099,.084,.30,.127,s*.254,.085,slate);}
    chip(upper,'cloth',slate,s*.10,-.328,0,.38,.31,.42,.37,s+8);
    chip(fore,'cloth',deep,0,-.057,0,.29,.28,.34,.16,s+3);
    chip(fore,'cloth',stone,s*.024,-.228,.01,.51,.49,.54,.21,s+1);
    chip(fore,'cloth',light,s*.014,-.14,-.09,.46,.36,.44,.03,s+2);
    chip(fist,'cloth',slate,s*.031,-.051,0,.60,.46,.54,.05,s+3);
    for(let k=0;k<3;k++)chip(fist,'cloth',stone,(k-1)*.131+s*.019,-.128,-.141,.174,.25,.30,.23,k+s);
    chip(fist,'cloth',light,-s*.183,-.017,-.127,.211,.225,.281,.09,s+4);
    mark(fore,[[s*.038,-.08],[s*.115,-.12],[s*.046,-.19],[s*.121,-.24],[s*.029,-.30],[s*.047,-.236],[-s*.03,-.208],[s*.059,-.133]],-.232,rune);
    arms.push([s,upper,fore,fist]);
  }
  flush();let phase=0,motion=0,fall=0;
  function update(dt,state={},t=0){
    const attack=clamp01(state.attack), hurt=clamp01(state.hit), dead=clamp01(state.dead);
    motion=ease(motion,clamp01(state.moving),7,dt);fall=ease(fall,dead,5.8,dt);
    phase+=dt*(elite?5.4:6.5)*motion;
    const step=Math.sin(phase),swipe=attack?Math.sin((1-attack)*Math.PI):0;
    rig.position.y=Math.abs(Math.cos(phase))*.088*motion-.095*swipe-.40*fall;
    rig.rotation.x=-.042*motion+.165*hurt-1.32*fall;rig.rotation.z=.077*step*motion-.36*fall;
    body.position.y=1.15+.021*Math.sin(t*1.5)+.035*step*motion;
    body.rotation.y=.13*step*motion+(1.46*attack-.66)*swipe;
    neck.rotation.x=.025*Math.sin(t*1.9)+.17*swipe;neck.rotation.y=-body.rotation.y*.37;
    for(const [s,hip,knee] of legs){hip.rotation.x=s*step*.41*motion; knee.rotation.x=-Math.max(0,-s*step)*.42*motion;}
    for(const [s,upper,fore,fist] of arms){
      upper.rotation.x=.06-s*step*.38*motion+.04*Math.sin(t*1.53+s)+(s===1?2.1:.48)*swipe;
      upper.rotation.z=s*(.177+.04*Math.sin(t*1.3+s)+(s===1?.42:.12)*swipe);
      fore.rotation.x=.13+.08*motion+swipe*(s===1?.61:.24); fist.rotation.z=s*(.055+swipe*.13);
    }
    materials.cloth.color.setRGB(1+hurt*.51,1-hurt*.22,1-hurt*.36);
  }
  update(0,{},0);return {root,update};
}
