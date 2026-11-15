import { createHeroFace } from './hero-face.js';
import { createHeroHands } from './hero-hands.js';
import { createHeroMotion } from './hero-motion.js';

const TAU=Math.PI*2;
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=t=>Math.min(1,Math.max(0,t));

// All vertices are authored in the same bind space. Sockets and joint pivots stay
// independent of equipment and body geometry.
function createArmature(T,root){
  const bones={}, list=[], indices={};
  function add(name,parent,x,y,z){
    const bone=new T.Bone(); bone.name=name; indices[name]=list.length;
    bones[name]=bone; list.push(bone); (bones[parent]||root).add(bone);
    const p=parent?bones[parent].userData.bindPoint:new T.Vector3();
    bone.userData.bindPoint=new T.Vector3(x,y,z);
    bone.position.copy(bone.userData.bindPoint).sub(p);
    bone.userData.restPosition=bone.position.clone();
    return bone;
  }
  add('rig',null,0,0,0);add('hips','rig',0,1.18,0);add('spine','hips',0,1.39,0);
  add('chest','spine',0,1.67,0);add('neck','chest',0,1.99,-.011);add('head','neck',0,2.095,-.022);
  for(const [side,s] of [['L',-1],['R',1]]){
    add('clavicle'+side,'chest',s*.090,1.908,.002);
    add('upperArm'+side,'clavicle'+side,s*.32,1.91,0);
    add('forearm'+side,'upperArm'+side,s*.37,1.53,-.018);
    add('hand'+side,'forearm'+side,s*.38,1.20,-.032);
    add('thigh'+side,'hips',s*.137,1.18,.002);
    add('shin'+side,'thigh'+side,s*.147,.65,-.015);
    add('foot'+side,'shin'+side,s*.151,.14,.012);
  }
  add('capeTop','chest',0,1.87,.15);add('capeMid','capeTop',0,1.35,.25);add('capeTip','capeMid',0,.87,.35);
  root.updateMatrixWorld(true);
  return {bones,list,indices,skeleton:new T.Skeleton(list)};
}

function mantleTexture(T){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=512;c.height=768;
  const ctx=c.getContext('2d'), {width:w,height:h}=c;
  const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#456d76');grad.addColorStop(.36,'#315a68');grad.addColorStop(.78,'#284e5a');grad.addColorStop(1,'#2e555d');
  ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  let seed=16421;const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const image=ctx.getImageData(0,0,w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4, grain=(rnd()-.5)*7+((x+y)%3===0?2:0)+Math.sin(x*.055+y*.014)*1.9;
    image.data[i]+=grain*.75;image.data[i+1]+=grain;image.data[i+2]+=grain;
  }
  ctx.putImageData(image,0,0);ctx.lineCap='round';ctx.lineJoin='round';
  function line(points,color,width,close=false,fill=false){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));if(close)ctx.closePath();
    if(fill){ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  }
  // Embroidered bird and glacial peak, built from nested folded wing motifs.
  const bright='#d6ba77',gold='#b08f55',shade='#7d6e48';
  for(const s of [-1,1]){
    const path=p=>p.map(([x,y])=>[.5+s*x,y]);
    line(path([[.014,.277],[.094,.259],[.188,.207],[.268,.13],[.22,.235],[.146,.292],[.064,.323],[.009,.366]]),gold,1,true,true);
    line(path([[.035,.278],[.133,.242],[.248,.149],[.156,.247],[.056,.291]]),bright,1,true,true);
    line(path([[.059,.318],[.169,.281],[.21,.251],[.169,.312],[.079,.353],[.038,.35]]),bright,1,true,true);
    line(path([[.02,.356],[.119,.332],[.151,.325],[.093,.367],[.042,.379],[0,.412]]),gold,1,true,true);
    line(path([[.20,.15],[.104,.196],[.137,.162],[.074,.202],[.051,.187],[.013,.233]]),shade,2.2);
    line(path([[.453,.13],[.457,.36],[.46,.61],[.461,.92],[.26,.923],[.076,.927]]),gold,3.4);
    line(path([[.438,.14],[.442,.37],[.445,.61],[.446,.906],[.26,.911],[.076,.914]]),bright,1.5);
    for(let i=0;i<25;i++){
      const v=.18+i*.028;line(path([[.45,v],[.449,v+.008]]),'#99885c',1.2);
    }
  }
  line([[.5,.215],[.528,.257],[.5,.317],[.472,.257]],bright,1,true,true);
  line([[.5,.237],[.509,.256],[.5,.278],[.491,.256]],'#53645c',1,true,true);
  line([[.5,.383],[.514,.407],[.5,.441],[.486,.407]],gold,1,true,true);
  for(let i=0;i<190;i++){const x=rnd()*w,y=rnd()*h;ctx.fillStyle='rgba(220,213,167,.13)';ctx.fillRect(x,y,.7+rnd()*1.7,.9+rnd()*3);}
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.flipY=false;tex.anisotropy=4;return tex;
}

function cuirassFinish(T){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const ctx=c.getContext('2d'),grad=ctx.createLinearGradient(0,0,512,60);
  grad.addColorStop(0,'#bcc5c5');grad.addColorStop(.26,'#f2f3ef');grad.addColorStop(.46,'#d9e0df');
  grad.addColorStop(.51,'#f9f8ef');grad.addColorStop(.78,'#d7dddd');grad.addColorStop(1,'#bdcace');
  ctx.fillStyle=grad;ctx.fillRect(0,0,512,256);
  const stroke=(pts,color,width)=>{
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  };
  for(let y=1;y<256;y+=2)stroke([[0,y],[512,y+.6]],y%6?'rgba(255,255,255,.065)':'rgba(56,58,54,.08)',.7);
  for(const s of [-1,1]){
    const line=(pts,c,w)=>stroke(pts.map(([x,y])=>[256+x*s,y]),c,w);
    const flutes=[[[6,20],[13,57],[22,94],[38,120],[61,143],[87,154]],[[32,33],[58,74],[89,99],[124,119],[162,128]],[[54,37],[94,65],[133,81],[173,85]]];
    for(const path of flutes){line(path,'#abbbb9',2);line(path.map(([x,y])=>[x,y+2]),'#faf9e9',1.2);}
    line([[2,201],[20,195],[54,201],[98,215],[146,222],[214,220]],'#a39473',2);
    line([[2,204],[20,198],[54,204],[98,218],[146,225],[214,223]],'#f3e9c8',1.3);
    line([[2,17],[23,18],[80,30],[149,49],[215,49]],'#eef0e1',1.6);
    for(let x=44;x<187;x+=25){const y=202+Math.min(15,(x-40)*.14);line([[x,y],[x+4,y+1],[x+2,y+4],[x,y]],'#a49b80',1.4);}
  }
  const tex=new T.CanvasTexture(c);tex.flipY=false;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

function surfaceGrain(T,style){
  const n=128, bytes=new Uint8Array(n*n*4);
  let seed=style==='weave'?25117:961;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const grain=style==='weave'?((y%4<2) !== (x%4<2)?4:-4)+4*Math.sin(TAU*(3*x+2*y)/n):
      5*Math.sin(TAU*(3*x+y)/n)+4*Math.cos(TAU*(2*y-x)/n)+Math.pow(rand(),12)*21;
    const q=Math.round(221+(rand()-.5)*19+grain),i=(y*n+x)*4;
    bytes[i]=bytes[i+1]=bytes[i+2]=q;bytes[i+3]=255;
  }
  const texture=new T.DataTexture(bytes,n,n,T.RGBAFormat);texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  texture.repeat.set(2,2);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

function costumeAtelier(T,root,armature){
  const {indices,skeleton}=armature;
  const palette=new Map(), chunks=new Map(), output={};
  const weave=surfaceGrain(T,'weave'),hide=surfaceGrain(T,'hide');
  const surfaces={
    wool:{roughness:.95,map:weave},leather:{roughness:.76,map:hide},steel:{roughness:.44,metalness:.38},
    cuirass:{roughness:.41,metalness:.31,map:cuirassFinish(T)},
    silver:{roughness:.31,metalness:.30},brass:{roughness:.39,metalness:.38},
    mantle:{roughness:.96,map:mantleTexture(T)},gem:{roughness:.24,emissive:0x804126,emissiveIntensity:.5}
  };
  function chunk(channel,slot='base'){
    const id=slot+'/'+channel; if(!chunks.has(id))chunks.set(id,{channel,slot,p:[],uv:[],colors:[],si:[],sw:[],faces:[]});
    return chunks.get(id);
  }
  function col(value){if(!palette.has(value))palette.set(value,new T.Color(value));return palette.get(value);}
  function v(bucket,pt,color,binding,uv=[0,0],shade=1){
    const i=bucket.p.length/3,c=col(color);bucket.p.push(...pt);bucket.uv.push(...uv);
    bucket.colors.push(c.r*shade,c.g*shade,c.b*shade);
    const weights=typeof binding==='string'?[[binding,1]]:binding;
    for(let k=0;k<4;k++){const pair=weights[k];bucket.si.push(pair?indices[pair[0]]:0);bucket.sw.push(pair?pair[1]:0);}
    return i;
  }
  function blendStops(y,stops){
    for(let i=1;i<stops.length;i++)if(y<=stops[i][0]){
      const f=clamp((y-stops[i-1][0])/(stops[i][0]-stops[i-1][0]));
      return [[stops[i-1][1],1-f],[stops[i][1],f]];
    }
    return stops.at(-1)[1];
  }
  // A sculpted closed contour at several anatomical landmarks. Profiles are
  // [height, half-width, half-depth, centre-x, centre-z].
  function loft(channel,color,rows,bind,opt={}){
    const b=chunk(channel,opt.slot), sides=opt.sides||32, ids=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],ring=[];
      for(let j=0;j<sides;j++){
        const a=j*TAU/sides,si=Math.sin(a),co=Math.cos(a);
        const p=[(row[3]||0)+si*row[1],row[0],(row[4]||0)+co*row[2]];
        if(opt.shape)opt.shape(p,a,i,si,co);
        const weight=typeof bind==='function'?bind(p[1],p[0],a):bind;
        const sh=opt.shade?opt.shade(a,i,p):1;
        ring.push(v(b,p,typeof color==='function'?color(a,i):color,weight,[j/sides,i/(rows.length-1)],sh));
      }
      ids.push(ring);
    }
    for(let i=0;i<ids.length-1;i++)for(let j=0;j<sides;j++){
      const n=(j+1)%sides, a=ids[i][j],z=ids[i][n],c=ids[i+1][n],d=ids[i+1][j];
      b.faces.push(a,z,c,a,c,d);
    }
    for(let j=1;j<sides-1;j++){
      const l=ids.length-1;b.faces.push(ids[0][0],ids[0][j+1],ids[0][j],ids[l][0],ids[l][j],ids[l][j+1]);
    }
  }
  // An open curved shell follows the convex outline of a limb without cutting into it.
  function shell(channel,color,rows,angle,halfAngle,bind,shape){
    const b=chunk(channel), n=26,ids=[];
    for(let i=0;i<rows.length;i++){
      const [y,w,d,x=0,z=0]=rows[i], ring=[];
      for(let j=0;j<=n;j++){
        const u=j/n*2-1,a=angle+halfAngle*u, p=[x+w*Math.sin(a),y,z+d*Math.cos(a)];
        if(shape)shape(p,u,i);
        ring.push(v(b,p,color,typeof bind==='function'?bind(p[1]):bind,[j/n,i/(rows.length-1)]));
      }
      ids.push(ring);
    }
    for(let i=1;i<ids.length;i++)for(let j=0;j<n;j++)
      b.faces.push(ids[i-1][j],ids[i-1][j+1],ids[i][j+1],ids[i-1][j],ids[i][j+1],ids[i][j]);
  }
  function patch(channel,color,outline,peak,binding,opt={}){
    const b=chunk(channel,opt.slot), center=v(b,peak,color,binding), verts=outline.map(pt=>v(b,pt,color,binding));
    for(let i=0;i<verts.length;i++)b.faces.push(verts[i],verts[(i+1)%verts.length],center);
  }
  // Build a narrow raised seam, belt or sculpted applique over a polyline.
  function strip(channel,color,path,width,binding,opt={}){
    const b=chunk(channel,opt.slot), normals=opt.normals, dir=new T.Vector3(), normal=new T.Vector3(), perp=new T.Vector3(), rings=[];
    for(let i=0;i<path.length;i++){
      const p=path[i],a=path[Math.max(0,i-1)],z=path[Math.min(path.length-1,i+1)];
      dir.set(z[0]-a[0],z[1]-a[1],z[2]-a[2]).normalize();normal.fromArray(normals?normals[i]:opt.normal||[0,0,-1]).normalize();
      perp.crossVectors(normal,dir).normalize().multiplyScalar((Array.isArray(width)?width[i]:width)*.5);
      const bindingAt=typeof binding==='function'?binding(p[1],p[0]):binding;
      rings.push([-1,1].map(sign=>v(b,[p[0]+sign*perp.x,p[1]+sign*perp.y,p[2]+sign*perp.z],color,bindingAt)));
    }
    for(let i=1;i<rings.length;i++)b.faces.push(rings[i-1][0],rings[i-1][1],rings[i][1],rings[i-1][0],rings[i][1],rings[i][0]);
  }
  function rivet(channel,color,x,y,z,r,bind,opt={}){
    loft(channel,color,[[y-r*.8,r*.42,r*.45,x,z],[y-r*.43,r*.87,r*.77,x,z],[y,r,r*.88,x,z],[y+r*.59,r*.81,r*.68,x,z],[y+r*.87,r*.33,r*.36,x,z]],bind,{...opt,sides:10});
  }
  function finish(){
    for(const {channel,slot,p,uv,colors,si,sw,faces} of chunks.values()){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));
      g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));g.setIndex(faces);g.computeVertexNormals();g.computeBoundingSphere();
      const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,...surfaces[channel]});
      const obj=new T.SkinnedMesh(g,mat);obj.name=slot+'-'+channel;obj.castShadow=true;obj.receiveShadow=true;obj.frustumCulled=false;
      root.add(obj);obj.bind(skeleton);(output[slot]||=[]).push(obj);
    }
    return output;
  }
  return {chunk,v,loft,shell,patch,strip,rivet,blendStops,finish};
}

function makeBody(A){
  const {loft,shell,patch,strip,rivet,blendStops}=A;
  const wool='#315565',quilt='#293e49',leather='#704832',leatherEdge='#9b704a',brass='#bf9d60',silver='#a9bbc0',darkMetal='#60737b';
  const torso=y=>blendStops(y,[[1.19,'hips'],[1.45,'spine'],[1.69,'chest']]);
  const stitch=(x,scale)=>.013*Math.cos(x*7)+.005*Math.sin(scale*3+x*11);
  loft('wool',wool,[
    [1.095,.23,.145],[1.16,.25,.152],[1.245,.237,.148],[1.315,.207,.132],[1.40,.203,.14],[1.49,.218,.15],
    [1.61,.246,.164],[1.70,.266,.175],[1.79,.291,.169],[1.848,.305,.149],[1.888,.279,.128],[1.915,.210,.103],[1.942,.097,.079]
  ],torso,{sides:44,shape(p,a,i,si,co){
    const f=stitch(a,i)*.45;p[2]+=co*f;
    if(i>=5&&i<=9&&co<0)p[2]-=.018*Math.sin(Math.PI*Math.abs(si))*(-co);
  },shade:(a,i)=>.94+.04*Math.cos(a*8+i*.53)+.03*Math.sin(a*3-i*.56)});
  // The split skirt is tailored around the walker's hips instead of forming a tube over both legs.
  for(const s of [-1,1]){
    const points=[[s*.038,1.35,-.134],[s*.188,1.33,-.098],[s*.237,1.17,-.079],[s*.244,.988,-.081],[s*.137,.925,-.161],[s*.044,1.024,-.171]];
    patch('leather','#584639',points,[s*.147,1.155,-.169],'hips');
    strip('brass','#ab8958',[[s*.043,1.025,-.174],[s*.137,.931,-.163],[s*.241,.989,-.084]],.01,'hips');
    for(let k=0;k<2;k++)strip('wool','#686451',[[s*(.038+k*.085),1.30,-.137],[s*(.071+k*.085),1.15,-.173],[s*(.090+k*.085),1.015,-.162]],.009,'hips');
  }
  // A continuous sprung breastplate, over interlocking plackart lames. The
  // bottom edges flare away from the layer underneath at the centre and sides.
  const breastShape=(p,a,i,si,co)=>{
    const front=Math.max(0,-co);
    p[1]-=Math.max(0,1-i/5)*.051*front**3;
    p[2]-=front*(.012*Math.exp(-si*si*40)+.008*Math.sin(Math.PI*Math.abs(si)));
  };
  for(let k=0;k<4;k++){
    const y=1.370+k*.059, w=.224+k*.011, d=.165+k*.006;
    shell('steel',k%2?'#778b91':'#84979b',[
      [y,w*.986,d*.99],[y+.006,w*1.015,d*1.05],[y+.014,w*1.017,d*1.058],
      [y+.039,w*1.015,d*1.013],[y+.068,w*1.008,d*.993],[y+.078,w*.985,d*.96]
    ],Math.PI,1.58,torso,(p,u)=>{const a=Math.PI+u*1.58, front=Math.max(0,-Math.cos(a));
      p[1]-=.024*front**2;p[2]-=.008*front*Math.exp(-30*Math.sin(a)**2);});
  }
  shell('cuirass','#9aaeb2',[[1.609,.257,.185],[1.616,.263,.195],[1.630,.266,.196],[1.66,.271,.194],
    [1.71,.282,.194],[1.759,.294,.190],[1.798,.299,.184],[1.836,.307,.167],[1.859,.300,.147],[1.874,.267,.138],[1.882,.234,.127]],
    Math.PI,1.61,torso,(p,u,i)=>{const a=Math.PI+1.61*u;breastShape(p,a,i,Math.sin(a),Math.cos(a));});
  for(const s of [-1,1]){
    strip('brass','#c2aa79',[[s*.030,1.802,-.191],[s*.079,1.818,-.181],[s*.129,1.835,-.155],[s*.184,1.842,-.136]],.006,'chest');
    for(const i of [0,1,2])rivet('brass','#b09c75',s*(.204+.008*i),1.424+.057*i,-.098,.008,torso(1.424+.057*i));
  }
  // Waist belt is thicker at the back; second narrow belt and diagonal baldric carry pouches.
  loft('leather','#50372a',[[1.272,.218,.144],[1.283,.221,.15],[1.353,.214,.15],[1.363,.210,.143]],'spine',{shape:(p,a)=>p[1]+=.011*Math.sin(a-.4)});
  loft('leather',leatherEdge,[[1.276,.220,.148],[1.285,.221,.152]],'spine',{shape:(p,a)=>p[1]+=.011*Math.sin(a-.4)});
  loft('leather',leatherEdge,[[1.348,.216,.15],[1.357,.214,.148]],'spine',{shape:(p,a)=>p[1]+=.011*Math.sin(a-.4)});
  const buckle=[[-.058,1.294,-.155],[-.06,1.344,-.155],[.063,1.342,-.157],[.060,1.291,-.156],[-.058,1.294,-.155]];
  strip('brass',brass,buckle,.014,'spine');strip('brass',brass,[[-.008,1.344,-.162],[-.001,1.298,-.162]],.009,'spine');
  const path=[[-.197,1.331,-.089],[-.167,1.394,-.143],[-.102,1.495,-.183],[-.034,1.600,-.220],[.039,1.704,-.224],[.119,1.799,-.198],[.201,1.874,-.146],[.210,1.920,-.050],[.194,1.923,.042],[.124,1.854,.122],[-.012,1.65,.179],[-.139,1.45,.14],[-.200,1.33,.067]];
  const normals=path.map((p,i)=>i<7?[0,0,-1]:i<9?[0,1,0]:[0,0,1]);
  strip('leather','#765139',path.slice(0,10),.061,torso,{normals:normals.slice(0,10)});
  strip('leather','#765139',path.slice(9),.061,torso,{normals:normals.slice(9),slot:'undercloak'});
  for(const k of [4,5])rivet('brass',brass,path[k][0],path[k][1],path[k][2]-.008,.010,'chest');
  // Wool fills the gap between the chin and breastplate. High folds follow
  // the neck pivot while the outer shoulder folds stay with the chest.
  loft('wool','#31535c',[[1.840,.286,.151],[1.856,.277,.173],[1.876,.256,.159],[1.890,.232,.165],
    [1.902,.224,.168],[1.918,.203,.146],[1.930,.195,.149],[1.944,.181,.147],[1.959,.161,.126],
    [1.969,.153,.127],[1.985,.142,.127],[2.000,.134,.121],[2.013,.125,.106],[2.035,.115,.106],[2.062,.108,.102],[2.082,.103,.096]],
    y=>blendStops(y,[[1.965,'chest'],[2.065,'neck']]),
    {sides:44,shape(p,a,i){p[1]+=(i<12?.013:.005)*Math.sin(a*1.0+i*.21);p[2]+=.006*Math.cos(a*3+i*.54);},
      shade:(a,i)=>.92+.035*Math.sin(a*3-i*.23)+.055*Math.cos(i*2.37)});
  // Small pin fastening the mantle.
  rivet('brass','#cfb276',-.134,1.901,-.128,.032,'chest');
  rivet('steel','#64777a',-.134,1.901,-.143,.018,'chest');
  for(const s of [-1,1]){
    const x=s*.227;loft('leather',leather,[[1.107,.044,.053,x,.019],[1.12,.063,.066,x,.018],[1.19,.072,.069,x,.014],[1.24,.069,.060,x,.013],[1.26,.054,.052,x,.014]],'hips',{sides:18});
    loft('leather',leatherEdge,[[1.199,.073,.070,x,.016],[1.216,.074,.07,x,.016],[1.25,.067,.063,x,.014]],'hips',{sides:18});
    rivet('brass',brass,x,1.204,-.051,.014,'hips');
  }
}

function makeLimbs(A){
  const {loft,shell,strip,rivet,blendStops}=A;
  for(const [side,s] of [['L',-1],['R',1]]){
    const arm='upperArm'+side,fore='forearm'+side,thigh='thigh'+side,shin='shin'+side,foot='foot'+side;
    const armBind=y=>blendStops(y,[[1.475,fore],[1.54,fore],[1.596,arm],[1.945,arm]]);
    const legBind=y=>blendStops(y,[[.59,shin],[.694,thigh],[1.09,thigh],[1.225,'hips']]);
    const sideRows=rows=>rows.map(([y,w,d,x,z])=>[y,w,d,x*s,z]);
    // A continuous sleeve models the triceps, the crook of the elbow and the taper along the radius.
    loft('wool','#325361',sideRows([
      [1.201,.045,.042,.38,-.032],[1.244,.053,.048,.38,-.03],[1.30,.064,.063,.38,-.03],[1.37,.085,.074,.379,-.032],
      [1.428,.088,.081,.374,-.036],[1.472,.076,.072,.372,-.03],[1.515,.065,.069,.369,-.012],[1.548,.072,.078,.364,-.014],
      [1.61,.083,.084,.356,-.007],[1.675,.101,.099,.351,-.019],[1.737,.101,.105,.346,-.014],[1.793,.098,.104,.338,-.001],
      [1.85,.095,.106,.324,.002],[1.901,.084,.095,.316,.003],[1.926,.056,.067,.308,.003],[1.941,.022,.029,.305,.002]
    ]),armBind,{sides:32,shape(p,a,i){p[2]+=.003*Math.sin(i*2+a*3);},shade:(a,i)=>.93+.07*Math.cos(a*6-i*1.28)});
    // Supple quilted under-sleeve at the elbow and two staggered bands high on the arm.
    for(const [y,r] of [[1.511,.077],[1.537,.079],[1.561,.081]])
      loft('leather','#524b43',sideRows([[y-.004,r,r*.96,.365,-.014],[y+.004,r+.002,r*.98,.365,-.014]]),armBind,{sides:24,shape:(p,a)=>p[1]+=.006*Math.cos(a)});
    for(const [y,r] of [[1.69,.110],[1.73,.111]]){
      loft('leather','#6e503a',sideRows([[y-.01,r,r*.99,.347,-.014],[y+.011,r+.002,r,.347,-.014]]),armBind,{sides:28,shape:(p,a)=>p[1]+=.014*s*Math.sin(a)});
    }
    loft('leather','#72503b',sideRows([[1.213,.053,.052,.38,-.032],[1.225,.060,.056,.38,-.032],[1.267,.061,.059,.38,-.032],
      [1.316,.073,.07,.379,-.030],[1.38,.092,.082,.377,-.033],[1.438,.091,.083,.373,-.035],[1.461,.082,.077,.372,-.030]]),fore,{sides:30});
    // Steel vambrace follows the ulna; the inner side remains flexible.
    const bracerAngle=s>0?2.08:4.20;
    shell('steel','#889fa5',sideRows([[1.238,.060,.061,.38,-.032],[1.252,.066,.066,.38,-.032],[1.32,.082,.082,.38,-.031],
      [1.385,.104,.094,.377,-.033],[1.444,.103,.098,.373,-.033],[1.465,.096,.094,.371,-.031]]),
      bracerAngle,1.04,fore,(p,u,i)=>{p[1]+=(i>3?.022:.009)*(1-u*u);});
    for(const [y,r] of [[1.22,.056],[1.30,.071],[1.427,.091]]){
      loft('leather','#624635',sideRows([[y-.009,r*1.19,r*1.17,.378,-.031],[y+.010,r*1.19,r*1.17,.378,-.031]]),fore,{sides:26});
      rivet('brass','#c4a76b',s*(.377+r*1.17),y,-.031,.012,fore);
    }
    // Three overlapping shoulder lames, largest above the shield-side arm.
    const b=side==='L'?1:.91, slot=side==='L'?'armor':'base';
    for(let k=0;k<3;k++){
      const y=1.775+k*.056,cx=s*(.345-k*.006),width=(.11+k*.023)*b,depth=(.119+k*.024)*b;
      loft('steel',k===2?'#acbfc4':k===1?'#879da5':'#71878e',[
        [y,width*.85,depth*.89,cx,.001],[y+.009,width,depth,cx,.001],[y+.041,width*.98,depth*.99,cx,.001],
        [y+.071,width*.86,depth*.90,cx-s*.006,.001],[y+.094,width*.70,depth*.71,cx-s*.012,.001],[y+.112,width*.46,depth*.49,cx-s*.019,0],[y+.124,width*.195,depth*.207,cx-s*.022,0],[y+.127,width*.016,depth*.019,cx-s*.024,0]
      ],arm,{slot,sides:36,shape(p,a,i){p[1]-=s*.040*Math.sin(a)*Math.max(0,1-i/7);}});
      loft('brass',k===2?'#bda878':'#96825b',[[y+.009,width*1.02,depth*1.018,cx,.001],[y+.015,width*1.022,depth*1.020,cx,.001]],arm,{slot,sides:36,shape(p,a){p[1]-=s*.035*Math.sin(a);}});
    }
    for(const z of [-.105,.108])rivet('brass','#ceb47a',s*.396,1.865,z,.014,arm,{slot});
    // Leg blend continuously spans the quadriceps, kneecap, hamstrings and the small of the calf.
    loft('wool','#3c4647',sideRows([
      [.125,.052,.062,.151,.009],[.203,.060,.066,.153,.009],[.276,.065,.070,.155,.012],[.373,.078,.088,.154,.019],
      [.46,.089,.099,.154,.020],[.536,.087,.094,.151,.009],[.593,.076,.081,.150,-.007],[.635,.083,.085,.147,-.020],
      [.679,.093,.092,.147,-.020],[.734,.092,.101,.146,-.011],[.816,.105,.112,.147,-.005],[.923,.117,.132,.148,.001],
      [1.038,.127,.141,.146,.001],[1.125,.131,.144,.137,.004],[1.179,.127,.14,.13,.002],[1.226,.113,.115,.122,.002]
    ]),legBind,{sides:32,shape(p,a,i){p[1]+=.008*Math.sin(a*2+i*.4);},shade:(a,i)=>.96+.048*Math.cos(a*5+i*.85)});
    // Worn riding boots: sculpted heel, pinched waist, extended asymmetrical toe and separate outsole.
    loft('leather','#45342d',sideRows([
      [.023,.073,.159,.151,-.054],[.037,.079,.170,.151,-.055],[.060,.081,.167,.151,-.055],[.086,.082,.151,.151,-.047],
      [.112,.078,.125,.151,-.031],[.149,.068,.089,.151,.003],[.182,.065,.075,.151,.008],[.210,.067,.075,.151,.01]
    ]),foot,{sides:36,shape(p,a,i,si,co){if(i<5){p[2]-=.015*Math.pow(Math.max(0,-co),3);p[0]-=s*.011*Math.max(0,-co);p[1]+=i*.0015*Math.max(0,co);}}});
    loft('leather','#282826',sideRows([[.008,.073,.158,.151,-.054],[.016,.080,.168,.151,-.055],[.032,.081,.171,.151,-.054],[.040,.080,.169,.151,-.054]]),
      foot,{sides:36,shape(p,a,i,si,co){p[2]-=.015*Math.max(0,-co)**3;p[1]+=.011*Math.max(0,-co)**3+.007*Math.max(0,.5-Math.abs(co));}});
    loft('leather','#6c4935',sideRows([
      [.154,.067,.076,.151,.008],[.188,.071,.077,.152,.009],[.242,.070,.077,.153,.01],[.30,.077,.082,.154,.013],
      [.36,.079,.09,.154,.018],[.425,.089,.099,.154,.020],[.495,.095,.101,.153,.019],[.545,.092,.097,.151,.008],
      [.574,.091,.095,.15,.002],[.606,.085,.09,.15,-.008]
    ]),shin,{sides:30,shade:(a,i)=>.94+.035*Math.sin(a*7+i)});
    loft('leather','#845e42',sideRows([[.538,.095,.101,.151,.009],[.548,.099,.104,.151,.009],[.591,.092,.099,.15,-.002],[.603,.085,.093,.15,-.006]]),shin,{sides:32,shape:(p,a)=>p[1]+=.018*Math.cos(a)});
    // Knee-cop and tapered ridged greave, with a dark blued steel outer edge.
    const steelRows=sideRows([[.258,.070,.091,.153,.008],[.282,.082,.099,.153,.009],[.38,.095,.108,.154,.014],
      [.46,.102,.117,.154,.016],[.527,.106,.117,.151,.008],[.553,.101,.111,.151,.004]]);
    shell('steel','#8da4ac',steelRows,Math.PI,.84,shin,(p,u,i)=>{
      p[2]-=.012*(1-Math.abs(u));if(i===0||i===5)p[1]+=(i===0?-.018:.022)*(1-u*u);
    });
    shell('steel','#85999d',sideRows([[.605,.078,.105,.148,-.010],[.619,.091,.111,.148,-.012],
      [.646,.099,.115,.147,-.015],[.670,.098,.116,.147,-.015],[.693,.089,.107,.147,-.016],[.702,.078,.101,.147,-.016]]),
      Math.PI,1.10,shin,(p,u,i)=>{p[1]+=(i<2?-.027:i>3?.018:0)*(1-u*u);p[2]-=.011*(1-u*u);});
    // Outside seam and reinforced thigh panel give the riding trousers a legible grain line.
    const thighAngle=s>0?1.53:4.74;
    shell('wool','#495657',sideRows([[.723,.096,.106,.146,-.011],[.81,.113,.117,.147,-.004],
      [.92,.124,.138,.148,.001],[1.035,.132,.147,.146,.001],[1.105,.136,.149,.139,.003]]),
      thighAngle,.33,legBind,(p,u,i)=>{if(i===0)p[1]+=.039*u*u;});
    for(const [y,r,d] of [[.224,.075,.082],[.353,.094,.108],[.505,.104,.118]]){
      loft('leather','#523e30',sideRows([[y-.010,r,d,.153,.011],[y+.012,r,d,.153,.011]]),shin,{sides:30,shape:(p,a)=>p[1]+=.011*s*Math.sin(a)});
      rivet('brass','#c09d68',s*(.151+r),y,.010,.012,shin);
    }
    strip('leather','#ac8159',[[s*.169,.229,.086],[s*.174,.336,.104],[s*.174,.452,.121],[s*.164,.534,.110]],.009,shin,{normal:[0,0,1]});
  }
}

function makeMantle(A){
  const {chunk,v,loft,rivet,blendStops}=A;
  const b=chunk('mantle','cloak'),nu=56,nv=39, ids=[];
  for(let j=0;j<=nv;j++){
    const t=j/nv,rs=[];
    for(let i=0;i<=nu;i++){
      const u=i/nu*2-1,edge=Math.abs(u),wind=t*t,cut=.165*Math.exp(-54*Math.abs(u-.21))+.063*Math.exp(-60*Math.abs(u+.48));
      const chord=.255+.096*t+.125*wind,flute=(.009+.038*t)*Math.sin(u*17+.7+1.85*t+.60*Math.cos(u*4-t*.6));
      const x=u*chord-.136*wind-.045*t+.019*Math.sin(u*4+t*2.6)*wind;
      const y=1.94-.055*edge*edge-t*(1.17-.22*edge**1.7-.10*Math.max(0,u)+.040*Math.sin(u*8-.4)-cut);
      const z=.215-.170*edge**1.9+.141*t+.18*wind-.049*Math.sin(t*Math.PI)+flute+.105*wind*Math.max(0,-u);
      const binding=blendStops(t,[[0,'chest'],[.16,'capeTop'],[.54,'capeMid'],[1,'capeTip']]);
      const sh=.965+.045*Math.sin(u*20.5+t*2.4)+.015*Math.cos(u*7-t);
      rs.push(v(b,[x,y,z],0xffffff,binding,[i/nu,t],sh));
    }
    ids.push(rs);
  }
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++)b.faces.push(ids[j][i],ids[j+1][i],ids[j+1][i+1],ids[j][i],ids[j+1][i+1],ids[j][i+1]);
  // The charm clips onto the baldric; it sits above the collar and reads from both sides.
  const x=.13;
  loft('brass','#b39661',[[1.802,.009,.009,x,-.201],[1.812,.019,.014,x,-.199],[1.865,.015,.012,x,-.176]],'chest',{sides:14,slot:'charm'});
  rivet('gem','#f4a649',x,1.823,-.205,.022,'chest',{slot:'charm'});
  rivet('brass','#ceb77d',-.155,1.868,.164,.025,'chest',{slot:'charm'});
  rivet('gem','#efa83f',-.155,1.871,.182,.014,'chest',{slot:'charm'});
}

export function createHero(T){
  const root=new T.Group();root.name='苍岚游侠';
  const armature=createArmature(T,root), {bones,skeleton}=armature;
  const atelier=costumeAtelier(T,root,armature);
  makeBody(atelier);makeLimbs(atelier);makeMantle(atelier);
  const pieces=atelier.finish();
  const face=createHeroFace(T,bones.head);
  const hands=createHeroHands(T,{handL:bones.handL,handR:bones.handR});
  const motion=createHeroMotion(T,bones);
  root.userData.rigVersion=2;
  function equip({weapon,armor,charm}={}){
    hands.equip(weapon||null);
    for(const obj of pieces.cloak)obj.visible=!!armor;
    for(const obj of pieces.undercloak)obj.visible=!armor;
    for(const obj of pieces.armor){
      obj.visible=!!armor;
      obj.material.color.set(armor?.rarity==='稀有'?0xc9e5ff:armor?.rarity==='精良'?0xc2c9a7:0xffffff);
    }
    for(const obj of pieces.charm){
      obj.visible=!!charm;
      obj.material.color.set(charm?.rarity==='史诗'?0xe0b8ff:0xffffff);
    }
  }
  function update(dt,state={},time=0){
    motion(dt,state,time);
    hands.update?.(dt,state,time);
    face.userData.updateFace?.(time,Boolean(state.dead));
  }
  equip({weapon:{name:'巡林短剑',rarity:'普通'},armor:{name:'行者披风',rarity:'普通'}});
  update(0,{},0);
  return {root,bones,skeleton,equip,update,bladeBase:hands.bladeBase,bladeTip:hands.bladeTip};
}
