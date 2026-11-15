/* A hand-brazed, faired record machine. Distances in scene metres. */
window.buildMachine = function buildMachine(THREE) {
  const group = new THREE.Group();
  group.name = 'Aster 07 / pursuit machine';
  const V = (a) => new THREE.Vector3(...a);
  const frameRed = finish(0xe84b32, .46, .28);
  const enamelDark = finish(0x9b302b, .42, .36);
  const persimmon = finish(0xff8750, .38, .3);
  const steel = finish(0xbfcfc7, .78, .28);
  const polished = finish(0xf2ebc9, .68, .24);
  const brass = finish(0xd7a54e, .72, .32);
  const ochre = finish(0xb9783f, .13, .69);
  const cream = finish(0xf9e9bd, .21, .37);
  const carbon = finish(0x192d35, .28, .46);
  const rubber = finish(0x152126, .09, .76);
  const leather = finish(0x663828, .05, .54);
  const nearSpoke = finish(0xbab8a3, .58, .36);
  const farSpoke = finish(0x667f81, .59, .36);
  const up = V([0, 1, 0]);

  function finish(color, metalness, roughness) {
    return new THREE.MeshStandardMaterial({color, metalness, roughness});
  }

  // Bake each rigid assembly to one mesh per finish, so fine hardware is cheap to draw.
  function rigid(name, parent = group) {
    const assembly = new THREE.Group();
    assembly.name = name;
    parent.add(assembly);
    assembly.userData.parts = new Map();
    return assembly;
  }
  const allAssemblies = [];
  function part(name) {
    const assembly = rigid(name);
    allAssemblies.push(assembly);
    return assembly;
  }
  function add(assembly, geometry, material, position, quaternion, scale) {
    const matrix = new THREE.Matrix4().compose(position || new THREE.Vector3(), quaternion || new THREE.Quaternion(), scale || V([1,1,1]));
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.applyMatrix4(matrix);
    const batches = assembly.userData.parts;
    if (!batches.has(material)) batches.set(material, {p:[], n:[]});
    const batch = batches.get(material);
    batch.p.push(flat.getAttribute('position').array);
    batch.n.push(flat.getAttribute('normal').array);
    flat.dispose();
    if (flat !== geometry) geometry.dispose();
  }
  function finalize(assembly) {
    for (const [material, {p, n}] of assembly.userData.parts) {
      const geom = new THREE.BufferGeometry();
      for (const [key, chunks] of [['position',p],['normal',n]]) {
        const sum = chunks.reduce((s,a)=>s+a.length,0);
        const data = new Float32Array(sum);
        let offset=0;
        for (const a of chunks) {data.set(a,offset);offset+=a.length;}
        geom.setAttribute(key, new THREE.BufferAttribute(data,3));
      }
      const mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      assembly.add(mesh);
    }
    delete assembly.userData.parts;
  }
  function rod(assembly, a, b, r, material, rb = r, segments = 9) {
    const a3=V(a), b3=V(b), axis=b3.clone().sub(a3);
    const geom=new THREE.CylinderGeometry(rb,r,axis.length(),segments);
    const q=new THREE.Quaternion().setFromUnitVectors(up,axis.normalize());
    add(assembly,geom,material,a3.lerp(b3,.5),q);
  }
  function oval(assembly,p,r,m) {
    add(assembly, new THREE.SphereGeometry(1,18,10),m,V(p),null,V(r));
  }
  function box(assembly,p,d,m) {
    add(assembly, new THREE.BoxGeometry(...d),m,V(p));
  }
  function wire(assembly, coords, radius, material, segments=24) {
    const curve = new THREE.CatmullRomCurve3(coords.map(V),false,'centripetal');
    add(assembly,new THREE.TubeGeometry(curve,segments,radius,7,false),material);
  }
  function torus(assembly, radius, section, material, z=0, arc=2*Math.PI, offset=0,flatten=1) {
    const q=new THREE.Quaternion().setFromAxisAngle(V([0,0,1]),offset);
    const geo=new THREE.TorusGeometry(radius,section,9,Math.max(4,Math.ceil(80*arc/(Math.PI*2))),arc);
    add(assembly,geo,material,V([0,0,z]),q,V([1,1,flatten]));
  }
  // A smooth formed tube. Sections specify [x,y,z,height across the side profile,half width].
  function formed(assembly, sections, material) {
    const count=14, vertices=[], indices=[];
    for(let i=0;i<sections.length;i++) {
      const [x,y,z,h,w]=sections[i];
      const pre=sections[Math.max(0,i-1)], post=sections[Math.min(sections.length-1,i+1)];
      const dx=post[0]-pre[0],dy=post[1]-pre[1],length=Math.hypot(dx,dy)||1;
      for(let j=0;j<count;j++) {
        const a=j*2*Math.PI/count, cs=Math.cos(a),sn=Math.sin(a);
        vertices.push(x-dy/length*h*cs,y+dx/length*h*cs,z+w*sn);
      }
      if(i===0)continue;
      for(let j=0;j<count;j++) {
        const k=(j+1)%count, a=(i-1)*count+j,b=(i-1)*count+k,c=i*count+j,d=i*count+k;
        indices.push(a,b,c,b,d,c);
      }
    }
    // End rings close against their adjoining lugs.
    for(let j=1;j<count-1;j++) {
      indices.push(0,j+1,j);
      const end=(sections.length-1)*count;
      indices.push(end,end+j,end+j+1);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    add(assembly,geo,material);
  }
  function plaque(assembly,outline,z,thick,mat,bevel=.005) {
    const shape=new THREE.Shape();
    outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
    shape.closePath();
    const geom=new THREE.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:bevel>0,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:8});
    add(assembly,geom,mat,V([0,0,z]));
  }

  const frame = part('vermillion brazed frame');
  const rearX = -1.02, frontX = 1.06, axleY = .64, crankY = .65;
  const wheels = [part('rear rotating wheel'), part('front rotating wheel')];
  wheels.forEach((wheel,index) => {
    wheel.position.set(index===0?rearX:frontX,axleY,0);
    // Narrow dark tread, actual caramel sidewall crowns and polished box rim.
    torus(wheel,.608,.032,rubber,0,Math.PI*2,0,1.08);
    for(const sign of [-1,1]) {
      torus(wheel,.598,.014,ochre,sign*.023,Math.PI*2,0,.6);
      torus(wheel,.581,.010,polished,sign*.019,Math.PI*2,0,.6);
      torus(wheel,.573,.008,carbon,sign*.016);
      torus(wheel,.574,.006,steel,sign*.018,.36,index*.4+1.35);
      torus(wheel,.579,.0068,persimmon,sign*.021,.24,index*.4+.46);
    }
    rod(wheel,[0,0,-.11],[0,0,.11],.039,steel,.039,16);
    for(const sign of [-1,1]) {
      rod(wheel,[0,0,sign*.075],[0,0,sign*.085],.064,polished,.061,18);
      for(let s=0;s<12;s++) {
        const edge = Math.PI*2*s/12 + (sign<0?Math.PI/12:0);
        const hub = edge + (s%2?1.00:-1.00);
        rod(wheel,[Math.cos(hub)*.05,Math.sin(hub)*.05,sign*.081],[.568*Math.cos(edge),.568*Math.sin(edge),sign*.011],.0042,sign>0?nearSpoke:farSpoke,.0034,5);
      }
    }
    rod(wheel,[.0,-.568,0],[0,-.520,.003],.0065,brass,.0045,8);
    rod(wheel,[0,-.52,.003],[0,-.51,.003],.005,rubber);
  });

  // Lugged airfoil main triangle, its raised gilt/ivory darts are cut into the enamel.
  formed(frame,[[0,.65,0,.06,.082],[.12,.75,0,.086,.063],[.43,.95,0,.071,.057],[.72,1.17,0,.057,.055]],frameRed);
  formed(frame,[[-.34,1.29,0,.034,.040],[-.26,1.305,0,.06,.039],[.38,1.36,0,.045,.038],[.68,1.402,0,.035,.043]],frameRed);
  formed(frame,[[0,.65,0,.060,.066],[-.07,.83,0,.066,.058],[-.322,1.355,0,.058,.059]],frameRed);
  formed(frame,[[.76,1.15,0,.064,.070],[.70,1.375,0,.069,.067],[.687,1.435,0,.071,.073]],frameRed);
  for(const s of [-1,1]) {
    const a=s*.135;
    formed(frame,[[rearX,.64,a,.027,.016],[-.82,.665,a,.031,.020],[-.40,.647,.122*s,.044,.024],[0,.65,.068*s,.027,.026]],enamelDark);
    formed(frame,[[rearX,.64,a,.026,.018],[-.90,.77,a,.031,.015],[-.44,1.22,.074*s,.028,.015],[-.32,1.31,.041*s,.030,.018]],frameRed);
    formed(frame,[[frontX,.64,.111*s,.030,.023],[.975,.71,.111*s,.026,.021],[.82,1.00,s*.086,.045,.025],[.764,1.17,s*.057,.058,.037]],frameRed);
    formed(frame,[[frontX,.64,s*.124,.029,.009],[.982,.707,s*.126,.019,.008],[.918,.796,s*.129,.007,.006]],polished);
    plaque(frame,[[.167,.799],[.459,1.013],[.588,1.096],[.542,1.038],[.238,.819]],.055*s-.0015,.003,cream,.0014);
    plaque(frame,[[-.243,1.32],[.540,1.39],[.472,1.369],[-.232,1.305]],.037*s-.001,.002,cream,.001);
  }
  rod(frame,[.74,1.194,-.0],[.754,1.153,0],.077,polished,.078,16);
  rod(frame,[.688,1.43,0],[.68,1.463,0],.075,polished,.068,16);
  for(const x of [rearX,frontX]) {
    rod(frame,[x,axleY,-.157],[x,axleY,.159],.018,carbon,.018,10);
    for(const sign of [-1,1]) {
      rod(frame,[x,axleY,sign*.121],[x,axleY,sign*.155],.029,polished,.023,6);
    }
  }

  // The petit ceramic number panel is visible from both sides even under the rider.
  const signOutline=[[-.027,1.280],[.410,1.322],[.426,1.297],[.339,1.170],[.254,1.113],[.025,1.116],[-.046,1.173]];
  plaque(frame,signOutline,-.018,.036,brass,.006);
  const insert=[[-.01,1.268],[.390,1.307],[.303,1.185],[.243,1.132],[.041,1.132],[-.027,1.179]];
  plaque(frame,insert,-.026,.052,cream,.0015);
  for(const sign of [-1,1]) {
    const z=sign*.030;
    for(const [x,y] of [[-.009,1.247],[.345,1.275],[.04,1.148]])oval(frame,[x,y,z],[.009,.009,.005],brass);
    // Hand-laid italic racing numbers, mirrored in placement on the reverse.
    const digits=[
      [[.080,1.159],[.052,1.173],[.084,1.246],[.139,1.253],[.155,1.237],[.130,1.172],[.080,1.159]],
      [[.183,1.250],[.262,1.255],[.186,1.164]]
    ];
    for(const digit of digits) {
      const positions=digit.map(([x,y])=>[sign>0?x:.275-x,y,z]);
      for(let i=1;i<positions.length;i++)rod(frame,positions[i-1],positions[i],.0095,carbon,.0095,8);
      for(const p of positions)oval(frame,p,[.0093,.0093,.006],carbon);
    }
  }

  // Leather blade saddle over twin sprung rails.
  rod(frame,[-.317,1.327,0],[-.399,1.51,0],.035,steel,.030,12);
  for(const s of [-1,1]) {
    wire(frame,[[-.544,1.519,.078*s],[-.511,1.474,.063*s],[-.421,1.468,.061*s],[-.261,1.503,.050*s],[-.214,1.527,.029*s]],.010,polished,15);
  }
  formed(frame,[[-.600,1.545,0,.014,.031],[-.557,1.549,0,.026,.101],[-.463,1.546,0,.033,.134],[-.355,1.536,0,.027,.091],[-.241,1.528,0,.023,.048],[-.142,1.534,0,.019,.035],[-.126,1.540,0,.009,.016]],leather);
  for(const s of [-1,1]) {
    wire(frame,[[-.555,1.55,.10*s],[-.466,1.548,.133*s],[-.358,1.540,.089*s],[-.236,1.534,.048*s],[-.151,1.539,.034*s]],.0045,brass,18);
    oval(frame,[-.512,1.565,.08*s],[.008,.006,.008],polished);
  }
  // Twin pursuit drops; the upper hood clears the turn and is the wing's contact.
  rod(frame,[.680,1.462,0],[.655,1.563,0],.036,steel,.032);
  rod(frame,[.655,1.557,0],[.777,1.615,0],.037,polished,.030);
  wire(frame,[[.775,1.615,-.206],[.776,1.617,-.105],[.776,1.617,.105],[.775,1.615,.206]],.022,steel,12);
  for(const sign of [-1,1]) {
    const handZ=.235*sign;
    wire(frame,[[.775,1.616,.177*sign],[.784,1.619,.215*sign],[.770,1.642,handZ],[.724,1.655,handZ],[.655,1.657,handZ]],.0235,polished,18);
    wire(frame,[[.654,1.657,handZ],[.717,1.651,handZ],[.757,1.608,handZ],[.759,1.541,handZ],[.721,1.491,handZ],[.641,1.497,handZ]],.0245,leather,24);
    rod(frame,[.622,1.657,handZ],[.684,1.657,handZ],.029,carbon,.028,12);
    rod(frame,[.64,1.499,handZ],[.627,1.500,handZ],.026,polished,.024,12);
    for(const u of [.654,.668,.681])rod(frame,[u,1.657,handZ],[u+.0035,1.657,handZ],.0298,brass,.0298,9);
    wire(frame,[[.733,1.656,handZ],[.751,1.670,handZ],[.792,1.638,handZ],[.798,1.588,handZ]],.0095,steel,12);
  }
  wire(frame,[[.761,1.651,.237],[.839,1.56,.205],[.868,1.479,.144],[.805,1.373,.092],[.764,1.226,.067]],.006,carbon,20);

  // A true tangent chain loop between unlike sprockets, in the same drive plane.
  const chainZ=.151, frontR=.163, rearR=.078;
  const centersDist=Math.hypot(-rearX,crankY-axleY);
  const direction=Math.atan2(crankY-axleY,-rearX),normal=Math.acos((rearR-frontR)/centersDist);
  const upper=direction+normal,lower=direction-normal;
  function xyCircle(cx,cy,r,a) {return [cx+r*Math.cos(a),cy+r*Math.sin(a),chainZ];}
  const chainPoints=[xyCircle(rearX,axleY,rearR,upper),xyCircle(0,crankY,frontR,upper)];
  for(let i=1;i<=22;i++)chainPoints.push(xyCircle(0,crankY,frontR,upper+(lower-upper)*i/22));
  chainPoints.push(xyCircle(rearX,axleY,rearR,lower));
  for(let i=1;i<=13;i++)chainPoints.push(xyCircle(rearX,axleY,rearR,lower+(upper-2*Math.PI-lower)*i/13));
  for(let i=1;i<chainPoints.length;i++)rod(frame,chainPoints[i-1],chainPoints[i],.0083,carbon,.0083,6);
  // Individual steel roller glints laid along both straight chain runs.
  for(const side of [upper,lower]){
    const p1=V(xyCircle(rearX,axleY,rearR,side)),p2=V(xyCircle(0,crankY,frontR,side));
    for(let i=0;i<23;i++){
      const p=p1.clone().lerp(p2,(i+.5)/23);p.z+=.006;
      oval(frame,p.toArray(),[.007,.004,.0035],polished);
    }
  }
  torus(wheels[0],rearR-.007,.009,brass,chainZ);
  const crank=part('rotating crankset');
  crank.position.y=crankY;
  rod(crank,[0,0,-.213],[0,0,.214],.041,steel,.041,16);
  torus(crank,.154,.0105,brass,chainZ);
  torus(crank,.143,.0075,polished,chainZ);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5+.25;
    rod(crank,[.035*Math.cos(a+.24),.035*Math.sin(a+.24),chainZ],[.143*Math.cos(a),.143*Math.sin(a),chainZ],.015,polished,.010,7);
    oval(crank,[.126*Math.cos(a),.126*Math.sin(a),chainZ+.008],[.010,.010,.007],brass);
  }
  const pedals=[];
  for(const side of [-1,1]){
    const z=side*.193, x=side*.265;
    formed(crank,[[0,0,z,.036,.014],[x*.18,.002,z,.029,.018],[x*.81,0,z+side*.029,.016,.013],[x,0,z+side*.033,.024,.014]],steel);
    rod(crank,[x,0,side*.211],[x,0,side*.306],.016,carbon,.016,12);
    oval(crank,[0,0,z+side*.018],[.025,.025,.013],brass);
    const pedal=part(side>0?'right pedal':'left pedal');
    pedals.push([side,pedal]);
    box(pedal,[0,0,0],[.113,.027,.096],carbon);
    for(const edge of [-1,1]){
      box(pedal,[0,.014,edge*.044],[.118,.009,.009],steel);
      for(const k of [-1,0,1])box(pedal,[k*.043,.021,edge*.042],[.012,.008,.009],brass);
    }
  }
  for(const assembly of allAssemblies) finalize(assembly);
  function update(t,phase,roll) {
    wheels.forEach(w=>w.rotation.z=roll);
    crank.rotation.z=phase;
    for(const [side,pedal] of pedals){
      pedal.position.set(side*.265*Math.cos(phase),crankY+side*.265*Math.sin(phase),side*.285);
    }
  }
  update(0,0,0);
  return {group,update};
};
