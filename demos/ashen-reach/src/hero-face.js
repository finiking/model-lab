// Base topology and male morph: MakeHuman / MPFB, CC0. Attribution in art/hero-face-license.txt.
import {positions, uvs, faces, blinkOffsets, skinMap} from './art/hero-face-data.js';

function decode(text, Type) {
  const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
  return new Type(bytes.buffer);
}

function headSurface(T) {
  const geometry = new T.BufferGeometry();
  const coords = Float32Array.from(decode(positions, Int16Array), p => p / 80000);
  const triangles = decode(faces, Uint16Array);
  geometry.setAttribute('position', new T.BufferAttribute(coords, 3));
  geometry.setAttribute('uv', new T.BufferAttribute(Float32Array.from(decode(uvs, Uint16Array), p => p / 65535), 2));
  geometry.setIndex(new T.BufferAttribute(triangles, 1));
  geometry.computeVertexNormals();
  const eyelid = new Float32Array(coords.length);
  const deltas=decode(blinkOffsets,Int16Array);
  for(let i=0;i<deltas.length;i+=4){
    const dest=deltas[i]*3;
    for(let k=0;k<3;k++)eyelid[dest+k]=deltas[i+1+k]/500000;
  }
  geometry.morphAttributes.position=[new T.BufferAttribute(eyelid,3)];
  geometry.morphTargetsRelative=true;

  // Project small details onto the true facial relief. Screen-space decorations drift off the temples.
  const cache = new Map();
  function frontDepth(x, y) {
    const key = Math.round(x * 3000) + ',' + Math.round(y * 3000);
    if (cache.has(key)) return cache.get(key);
    let depth = .18;
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i] * 3, b = triangles[i + 1] * 3, c = triangles[i + 2] * 3;
      const ax = coords[a], ay = coords[a + 1];
      const bx = coords[b], by = coords[b + 1], cx = coords[c], cy = coords[c + 1];
      if (x < Math.min(ax, bx, cx) || x > Math.max(ax, bx, cx) || y < Math.min(ay, by, cy) || y > Math.max(ay, by, cy)) continue;
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-12) continue;
      const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const wc = 1 - wa - wb;
      if (wa < -.00001 || wb < -.00001 || wc < -.00001) continue;
      depth = Math.min(depth, wa * coords[a + 2] + wb * coords[b + 2] + wc * coords[c + 2]);
    }
    if (depth === .18) depth = -.044;
    cache.set(key, depth);
    return depth;
  }
  function blinkAt(p) {
    let best=Infinity, nearest=-1;
    for(let i=0;i<deltas.length;i+=4) {
      const k=deltas[i]*3;
      const distance=(coords[k]-p.x)**2+(coords[k+1]-p.y)**2+(coords[k+2]-p.z)**2;
      if(distance<best) {best=distance;nearest=k;}
    }
    return nearest<0 ? [0,0,0] : [eyelid[nearest],eyelid[nearest+1],eyelid[nearest+2]];
  }
  return {geometry, frontDepth, blinkAt};
}

function detailMesh(T, parent, name, pos, colors, indices, material = {}) {
  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new T.Mesh(geom, new T.MeshStandardMaterial({vertexColors: true, roughness: .83, side: T.DoubleSide, ...material}));
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function eyes(T, head) {
  for (const side of [-1, 1]) {
    const center = [side * .03888, .1538, -.0902];
    const radii = [.0229, .0206, .0215];
    const pos = [], col = [], indices = [];
    const angles = [0, .113, .125, .19, .255, .315, .33, .352, .39, .49, .63, .8, 1.05, 1.35, 1.6, 2.1, 2.65, Math.PI];
    const segments = 48;
    for (let row = 0; row < angles.length; row++) {
      const a = angles[row];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments * Math.PI * 2;
        pos.push(center[0] + radii[0] * Math.sin(a) * Math.cos(t), center[1] + radii[1] * (Math.sin(a) * Math.sin(t) - Math.cos(a)*.103), center[2] - radii[2] * Math.cos(a));
        let tint = '#bcae96';
        if (a <= .113) tint = '#080e0c';
        else if (a <= .125) tint = '#2c2819';
        else if (a <= .315) tint = '#655333';
        else if (a <= .33) tint = '#554e36';
        else if (a <= .352) tint = '#272f28';
        else if (a <= .49) tint = '#bbb2a5';
        const c = new T.Color(tint);
        const fibers = Math.sin(t * 19 + Math.sin(t * 5) * 2);
        c.multiplyScalar(a > .125 && a < .33 ? 1 + fibers * .32 : 1);
        col.push(c.r, c.g, c.b);
        if (i < segments && row < angles.length - 1) {
          const j = row * (segments + 1) + i, k = j + segments + 1;
          indices.push(j, j + 1, k, j + 1, k + 1, k);
        }
      }
    }
    detailMesh(T, head, 'Eye • amber iris / limbal ring / sclera', pos, col, indices, {roughness: .27});
    const glint = new T.Mesh(new T.SphereGeometry(.00125, 8, 6), new T.MeshBasicMaterial({color: '#ebe3c6'}));
    glint.scale.set(1, .75, .65);
    glint.position.set(center[0] + .0032, center[1] + .0012, center[2] - radii[2] + .0004);
    glint.name='Eye glint';
    head.add(glint);
  }
}

function continuousHair(T, parent, surface) {
  const base=surface.geometry, coords=base.getAttribute('position'), normals=base.getAttribute('normal'), triangles=base.getIndex().array;
  const pos=[], nrm=[], uv=[], indices=[];
  function hairVertex(p,n) {
    // The occiput is covered farther down than the forehead.
    const theta=Math.atan2(p.x,.012-p.z);
    const f=Math.max(0,Math.cos(theta)), side=Math.abs(Math.sin(theta));
    let hairline=.085+.139*Math.pow(f,.4)-.007*side + .003*Math.sin(theta*4+.5);
    if(Math.abs(p.x)>.083 && p.z<.068) {
      const ear = Math.exp(-((p.z-.004)**2)/.0029);
      hairline=Math.max(hairline,.088+.09*ear);
    }
    if(f>0) hairline-=.014*Math.exp(-((p.x+.057)**2)/.00019);
    return {p,n,theta,d:p.y-hairline};
  }
  function clipped(a,b) {
    const t=a.d/(a.d-b.d);
    return hairVertex(a.p.clone().lerp(b.p,t),a.n.clone().lerp(b.n,t).normalize());
  }
  const original=Array.from({length:coords.count},(_,i)=>hairVertex(new T.Vector3().fromBufferAttribute(coords,i),new T.Vector3().fromBufferAttribute(normals,i)));
  for (let j=0;j<triangles.length;j+=3) {
    const tri=[original[triangles[j]],original[triangles[j+1]],original[triangles[j+2]]];
    const polygon=[];
    for(let k=0;k<3;k++){
      const a=tri[k],b=tri[(k+1)%3];
      if(a.d>=0)polygon.push(a);
      if((a.d>=0)!==(b.d>=0))polygon.push(clipped(a,b));
    }
    if(polygon.length<3)continue;
    const start=pos.length/3;
    // Keep the UV seam outside the face opening.
    const crosses=polygon.some(v=>v.theta>2.6)&&polygon.some(v=>v.theta< -2.6);
    for(const v of polygon){
      const lift=.0027+.0019*Math.min(1,Math.max(0,v.d)/.027);
      const p=v.p.clone().addScaledVector(v.n,lift);
      pos.push(p.x,p.y,p.z);
      nrm.push(v.n.x,v.n.y,v.n.z);
      let angle=v.theta/(Math.PI*2)+.5;
      if(crosses&&angle<.5)angle+=1;
      uv.push(angle,p.y/.30);
    }
    for(let k=1;k<polygon.length-1;k++)indices.push(start,start+k,start+k+1);
  }
  // Cylindrical hair direction follows the sweep of the crown. The small texture stays
  // on the geometry and filters naturally when seen from the player's camera.
  const width=512,height=128, pixels=new Uint8Array(width*height*4);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const u=i/width,v=j/height;
    const wave=i+13*Math.sin(v*3+u*6.28)+5*Math.sin(v*5-u*11)+.23*Math.sin(i*1.73+j*.17);
    const fine=(Math.sin(wave*2.5)+Math.sin(wave*1.75+2)*.7+2)/3.7;
    const broad=(Math.sin(wave*.28+2.9)*.5+.5);
    const amt=fine*.7+broad*.3;
    const o=4*(j*width+i);
    pixels[o]=32+amt*39; pixels[o+1]=23+amt*29; pixels[o+2]=19+amt*19;pixels[o+3]=255;
  }
  const tex=new T.DataTexture(pixels,width,height);
  tex.colorSpace=T.SRGBColorSpace;
  tex.wrapS=T.RepeatWrapping;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;
  tex.generateMipmaps=true;tex.needsUpdate=true;
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(nrm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  const hair=new T.Mesh(geo,new T.MeshStandardMaterial({map:tex,roughness:.83,side:T.DoubleSide}));
  hair.name='Continuous rooted hair cap';
  parent.add(hair);
}

function eyebrowsAndHair(T, head, surface) {
  const pos = [], cols = [], indices = [];
  function lock(p0, p1, p2, width, tint, depth = .0016) {
    const offset = pos.length / 3;
    const c = new T.Color(tint), steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, q = 1 - t;
      const x = q*q*p0[0] + 2*q*t*p1[0] + t*t*p2[0];
      const y = q*q*p0[1] + 2*q*t*p1[1] + t*t*p2[1];
      const dx = q*(p1[0]-p0[0]) + t*(p2[0]-p1[0]);
      const dy = q*(p1[1]-p0[1]) + t*(p2[1]-p1[1]);
      const size = width * (.08 + .92 * Math.sin(Math.PI * (.08 + t*.91)) ** .75);
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length * size, ny = dx / length * size;
      for (let j = -1; j <= 1; j++) {
        const xx = x + nx*j, yy = y + ny*j;
        pos.push(xx, yy, surface.frontDepth(xx, yy) - depth - (j === 0 ? width * .45 : 0));
        const light = [1.13, 1.24, .8][j+1];
        cols.push(c.r*light, c.g*light, c.b*light);
      }
      if (i < steps) {
        const j = offset + i*3;
        indices.push(j,j+1,j+3, j+1,j+4,j+3, j+1,j+2,j+4, j+2,j+5,j+4);
      }
    }
  }

  for (const sign of [-1,1]) {
    // Two tapered brow masses, overlaid with groups of fine hairs oriented along their growth.
    lock([sign*.014,.170], [sign*.043,.183], [sign*.069,.171], .0033, '#33241c', .0018);
    for (let i=0; i<35; i++) {
      const t=i/34, a=Math.sin(t*Math.PI), x=sign*(.015+.053*t);
      const y=.1694+.0073*a+.0017*t;
      const vary=Math.sin(i*12.14+sign)*.0011;
      lock([x,y-.0021+vary],[x+sign*.002,y+.0026+vary],[x+sign*(.003+.004*t),y+.0047-.002*t],.00061, i%4===0?'#60442c':'#30221a', .0026);
    }
  }

  // Overlapping small locks descend from a continuous layer over the scalp.
  // The part is off centre and the ends across the forehead have unequal lengths.
  for (let i=0;i<83;i++) {
    const r = n => (Math.sin((i+1)*n*78.233)*43758.5453)%1;
    const x = -.085 + .17*i/82;
    const side = x < .038 ? -1 : 1;
    const rootY = .25+.016*(1-Math.abs(x/.10))+.002*r(2);
    const tipX = x + side*(.009+.009*(1-Math.abs(x/.11))) + r(5)*.0017;
    const tipY = .219 - .022*Math.pow(Math.abs(x/.09),1.7) + .005*Math.sin(x*87+.9) - .007*Math.abs(r(3));
    const midX = x + side*(.004+.005*Math.cos(x*30)) + r(4)*.002;
    const midY = (rootY+tipY)*.5-.005*r(8);
    const w = .0021+.0019*Math.abs(r(9));
    const shade = ['#291f19','#37291f','#3b2c20','#30231b','#37271d','#483325'][i%6];
    const offset = .0025+.0015*Math.abs(r(1));
    lock([x,rootY],[midX,midY],[tipX,tipY],w,shade,offset);
    if (i%3!==0) lock([x+w*.14,rootY-.002],[midX+w*.18,midY],[tipX,tipY+.0011],w*.11,'#654a35',offset+.0012);
  }
  // A side part sweeps over the short forehead layers in a broken, tapered wave.
  for (let j=0;j<44;j++) {
    const s=j/43, ripple=Math.sin(j*11.9);
    const root=[.013+.056*s,.259-.004*s+ripple*.0012];
    const mid=[-.005+.059*s,.239+.003*Math.sin(s*4)];
    const tip=[-.066+.064*s+ripple*.0022,.204+.008*Math.sin(s*6)+.003*ripple];
    const w=.0015+.0012*Math.abs(ripple), offset=.006+.0015*Math.sin(j*1.3);
    lock(root,mid,tip,w,j%4===0?'#4d3627':'#38281e',offset);
    if(j%3===1) lock([root[0]+w*.2,root[1]],[mid[0]+w*.2,mid[1]],[tip[0],tip[1]+.002],w*.16,'#654a35',offset+.0013);
  }
  const lash=[ [.0270,.1519,-.1096],[.0303,.1546,-.1116],[.035,.1565,-.1132],[.040,.1574,-.1146],[.045,.1573,-.1141],[.050,.15555,-.1114],[.054,.1537,-.1083] ];
  for (const direction of [-1,1]) {
    const curve=new T.CatmullRomCurve3(lash.map(([x,y,z])=>new T.Vector3(x*direction,y,z)));
    const lashGeo=new T.TubeGeometry(curve,18,.00048,4,false);
    const lashPos=lashGeo.getAttribute('position'), closed=[];
    for(let j=0;j<lashPos.count;j++)closed.push(...surface.blinkAt(new T.Vector3().fromBufferAttribute(lashPos,j)));
    lashGeo.morphAttributes.position=[new T.Float32BufferAttribute(closed,3)];
    lashGeo.morphTargetsRelative=true;
    const lashMesh=new T.Mesh(lashGeo,new T.MeshStandardMaterial({color:'#513a31',roughness:.85}));
    lashMesh.name='Upper lash margin';
    head.add(lashMesh);
  }
  detailMesh(T, head, 'Layered chestnut fringe and arched eyebrows', pos, cols, indices);
}

function openHood(T, head) {
  // Each ring is a cross-section of the open cowl, from the rolled collar to the crown.
  const rows = [
    [-.043,.128,.139,.042,35],[-.025,.131,.149,.041,40],[.012,.133,.149,.036,44],
    [.051,.144,.155,.037,54],[.096,.148,.158,.034,61],[.140,.145,.164,.028,63],
    [.183,.145,.167,.025,60],[.220,.141,.166,.022,51],[.250,.134,.163,.021,41],
    [.273,.123,.151,.019,33],[.292,.106,.135,.018,24],[.307,.079,.110,.021,14],
    [.318,.044,.071,.030,4],[.323,.009,.023,.040,0]
  ];
  const pos=[],col=[],indices=[], edges=[[],[]], spine=[];
  const segs=56;
  rows.forEach(([height,rx,rz,offset,angle],j)=>{
    const v=j/(rows.length-1);
    for(let i=0;i<=segs;i++){
      const u=i/segs, beta=angle*Math.PI/180, a=beta+u*(Math.PI*2-beta*2);
      const pleats=(.0033*Math.sin(a*10+v*4)+.0022*Math.sin(a*17-v*3))*(1-.64*v);
      const x=(rx+pleats)*Math.sin(a), z=offset-(rz+pleats)*Math.cos(a);
      const y=height + .0031*Math.sin(a*4+v*2)*(1-v);
      pos.push(x,y,z);
      const tint=new T.Color('#244a51').multiplyScalar(.95+.13*Math.cos(a*10+v*4)+.1*Math.sin(a*3+v*.9));
      col.push(tint.r,tint.g,tint.b);
      if(i===0 || i===segs)edges[i===0?0:1].push(new T.Vector3(x,y,z));
      if(i===segs/2)spine.push(new T.Vector3(x,y,z+.001));
      if(i<segs && j<rows.length-1){
        const m=j*(segs+1)+i,n=m+segs+1;
        indices.push(m,n,m+1, n,n+1,m+1);
      }
    }
  });
  // Close the apex with the same wool, including the final seam across the forehead.
  const end=(rows.length-1)*(segs+1), crown=pos.length/3;
  pos.push(0,.324,.039);const cc=new T.Color('#244a51');col.push(cc.r,cc.g,cc.b);
  for(let i=0;i<segs;i++)indices.push(end+i,crown,end+i+1);
  const hood=detailMesh(T,head,'Open spruce-wool hood',pos,col,indices);
  hood.castShadow=true;
  // A modeled facing and leather welt keep the hood opening substantial in profile.
  function piping(points,radius,tint) {
    const shape=new T.CatmullRomCurve3(points);
    const mesh=new T.Mesh(new T.TubeGeometry(shape,50,radius,5,false),new T.MeshStandardMaterial({color:tint,roughness:.81}));
    head.add(mesh);
  }
  edges.forEach(edge=>{
    const p=[],c=[],ix=[];
    edge.forEach((pt,i)=>{
      const dark=new T.Color('#172e36'), hem=new T.Color('#486564');
      p.push(pt.x,pt.y,pt.z, pt.x*.95,pt.y-.0045,pt.z+.0045);
      c.push(hem.r,hem.g,hem.b,dark.r,dark.g,dark.b);
      if(i<edge.length-1){const k=i*2;ix.push(k,k+1,k+2,k+1,k+3,k+2);}
    });
    detailMesh(T,head,'Lined cowl facing',p,c,ix);
    piping(edge,.0019,'#827757');
  });
  piping(spine,.0009,'#536d6a');
}

export function createHeroFace(T, head) {
  const group = new T.Group();
  group.name = 'Ranger • head';
  const surface = headSurface(T);
  const skin = new T.MeshStandardMaterial({color:'#b88c71',roughness:.76});
  if (typeof document !== 'undefined') {
    new T.TextureLoader().load(skinMap, map => {
      map.colorSpace=T.SRGBColorSpace;
      map.anisotropy=4;
      skin.color.set('#f3e6da');
      skin.map=map;
      skin.needsUpdate=true;
    });
  }
  const face = new T.Mesh(surface.geometry, skin);
  face.name='Adult male head • sculpted hm08 surface';
  group.add(face);
  eyes(T, group);
  continuousHair(T, group, surface);
  eyebrowsAndHair(T, group, surface);
  openHood(T, group);
  const movingLids=group.children.filter(m=>m.morphTargetInfluences);
  const eyeballs=group.children.filter(m=>m.name.startsWith('Eye'));
  group.userData.updateFace=(time,dead=false)=>{
    const cycle=Math.floor(time/7.9), phase=time-cycle*7.9;
    const blinkAt=2.4+1.3*Math.sin(cycle*2.3);
    const blink=(since)=>since<0 || since>.22 ? 0 : since<.075 ? Math.sin(since/.075*Math.PI/2) : .5+.5*Math.cos((since-.075)/.145*Math.PI);
    const amount=dead ? 1 : Math.max(blink(phase-blinkAt), cycle%3===1 ? blink(phase-blinkAt-.38) : 0);
    for (const part of movingLids)part.morphTargetInfluences[0]=amount;
    for (const eye of eyeballs)eye.visible=amount<.96;
  };
  if (head) head.add(group);
  return group;
}
