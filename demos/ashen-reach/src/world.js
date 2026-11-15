// Ashen Reach. All wilderness assets are seeded, original meshes built at launch.
export function createWorld(THREE, scene) {
  let seed = 151733;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const between = (a, b) => a + (b - a) * rand();
  const clamp = THREE.MathUtils.clamp;
  const tau = Math.PI * 2;
  const color = (hex, variation = 1) => new THREE.Color(hex).multiplyScalar(variation);
  const blend = (a, b, t) => color(a).lerp(color(b), clamp(t, 0, 1));
  const materials = new Map();
  const mat = (data = 'lit') => {
    if (!materials.has(data)) {
      const options = {vertexColors: true, side: THREE.DoubleSide};
      materials.set(data, data === 'unlit' ? new THREE.MeshBasicMaterial(options) :
        new THREE.MeshLambertMaterial({...options, flatShading: true}));
    }
    return materials.get(data);
  };
  const buffer = () => ({p: [], c: []});
  const tri = (batch, a, b, c, tint) => {
    batch.p.push(...a, ...b, ...c);
    batch.c.push(tint.r,tint.g,tint.b,tint.r,tint.g,tint.b,tint.r,tint.g,tint.b);
  };
  function geometry(batch) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(batch.c, 3));
    geo.computeVertexNormals();
    return geo;
  }
  function finish(batch, material = mat(), name = 'Scenery') {
    if (!batch.p.length) return;
    const mesh = new THREE.Mesh(geometry(batch), material);
    mesh.name = name;
    scene.add(mesh);
    return mesh;
  }
  function hash(x, z) {
    const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }
  function noise(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    let u = x-i, v = z-j;
    u = u*u*(3-2*u); v = v*v*(3-2*v);
    const a = hash(i,j), b = hash(i+1,j), c = hash(i,j+1), d = hash(i+1,j+1);
    return a + u*(b-a) + v*(c-a) + u*v*(a-b-c+d);
  }

  scene.fog = new THREE.Fog(0xc2d4d1, 38, 196);
  scene.background = new THREE.Color(0xb2ced2);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(360, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {high: {value: color('#397e9d')}, low: {value: color('#ffedc9')},
      middle: {value: color('#a0c9d0')}, cloud: {value: color('#ffefd8')}},
    vertexShader: 'varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;}',
    fragmentShader: `varying vec3 dir;
      uniform vec3 high,low,middle,cloud;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec3 d=normalize(dir); float h=max(0.,d.y);
      vec3 c=mix(low,middle,smoothstep(-.02,.23,h));c=mix(c,high,smoothstep(.11,.8,h));
      vec2 p=d.xz/max(.08,d.y)*vec2(2.3,5.)+vec2(8.,2.);
      float t=n(p)*.53+n(p*2.)*.29+n(p*4.)*.14+n(p*8.)*.04;
      float wisps=smoothstep(.54,.75,t)*smoothstep(.045,.2,h)*(1.-.47*smoothstep(.5,.9,h));
      c=mix(c,cloud,wisps*.69);
      float sun=max(0.,dot(d,normalize(vec3(-.39,.22,-1.))));
      c+=vec3(.34,.15,.035)*pow(sun,33.)+vec3(.34,.22,.08)*pow(sun,230.);c=mix(c,vec3(2.0,1.7,1.12),smoothstep(.99971,.99984,sun));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }));
  sky.name = 'Dawn over the pass'; sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);
  const ambient = new THREE.HemisphereLight(0xd1eaf7, 0x86a498, 1.47);
  const sunlight = new THREE.DirectionalLight(0xffe4bf, 2.78);
  sunlight.position.set(-79,53,-28);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048,2048);
  Object.assign(sunlight.shadow.camera,{left:-72,right:72,bottom:-68,top:68,near:1,far:235});
  sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.normalBias=.065;
  sunlight.shadow.bias=-.00016;
  sunlight.shadow.radius=.78;
  const bounce = new THREE.DirectionalLight(0xd0e8f0, .58);
  bounce.position.set(36,19,45);
  scene.add(ambient, sunlight, bounce);

  // A stepped, irregular rock face has its own ridges, shoulders and snowline.
  const ranges = buffer();
  function peak(cx, cz, base, w, depth, h, far, snowy = true) {
    const n = 15, angles = [], ridges = [];
    const slant = between(-.29,.29)*w;
    for (let k=0;k<n;k++) {
      angles.push((k+between(-.22,.22))*tau/n);
      ridges.push(between(.68,1.19));
    }
    let previous;
    const scale = [.009,.12,.25,.39,.59,.79,1.02], heights = [1,.88,.76,.62,.45,.24,0];
    for (let layer=0;layer<scale.length;layer++) {
      const ring=[];
      for(let k=0;k<n;k++){
        const a = angles[k]+(layer === 0 ? 0 : .07*Math.sin(k*3+layer));
        const r = scale[layer]*ridges[k]*(layer===0?1:between(.87,1.1));
        ring.push([cx+slant*heights[layer]+w*Math.cos(a)*r,
          base+h*(heights[layer]+(layer===0?0:between(-.085,.085))),
          cz+depth*Math.sin(a)*r]);
      }
      if(previous) for(let i=0;i<n;i++){
        const j=(i+1)%n;
        const lit = .48+.28*Math.cos(angles[i]+2.25)+between(-.17,.13);
        const snow = snowy && (layer<=2 || layer===3 && Math.sin(angles[i]*3+cx)>.2);
        let tint = snow ? blend(far?'#a3bbc2':'#8babb4',far?'#ffe9c9':'#fff0d3',lit+.08) :
          blend(far?'#6b919e':'#486e79',far?'#b9c4b6':'#9bada4',lit);
        tri(ranges,previous[i],ring[i],previous[j],tint);
        if(layer===3 && snowy && rand()<.48) tint=blend('#71939c','#bdc9bb',lit);
        tri(ranges,previous[j],ring[i],ring[j],tint.clone().multiplyScalar(between(.90,1.02)));
      }
      previous=ring;
    }
  }
  for(let x=-205;x<235;x+=24) {
    const saddle=1-.28*Math.exp(-((x+58)**2)/460);
    peak(x,between(-164,-152),-4,between(31,51),between(21,32),between(28,45)*saddle,true);
  }
  [[-116,-97,37,36],[-89,-107,47,43],[-66,-113,34,25],[-45,-115,30,18],[-22,-124,36,28],
   [7,-123,42,26],[35,-114,43,42],[58,-108,40,32],[90,-104,49,40],[115,-93,35,34]]
    .forEach(([x,z,w,h])=>peak(x,z,-6,w,w*.81,h,false));
  for(let side of [-1,1]) for(let z=-52;z<145;z+=24)
    peak(side*between(93,110),z,-4,between(31,50),between(30,49),between(29,54),false,rand()<.28);
  for(let x=-105;x<140;x+=23) peak(x,125,-6,between(32,44),29,between(29,49),true,true);
  // A lower wooded ridge overlaps the rock ranges at the mouth of the valley.
  for(let x=-185;x<185;x+=4) {
    function ridge(x){
      const top=2.5+noise(x*.048,9)*7+Math.min(13,Math.abs(x)*.13)+2.2*Math.sin(x*.073);
      return [x,top,-77-noise(x*.065,17)*6];
    }
    const a=ridge(x),b=ridge(x+4),aa=[x,-5,-70],bb=[x+4,-5,-70];
    const tint=blend('#779a9c','#a2b3a9',.25+.30*noise(x*.064,8));
    tri(ranges,a,aa,b,tint);tri(ranges,aa,bb,b,tint.clone().multiplyScalar(.98));
  }
  finish(ranges,mat('unlit'),'Folded mountains');

  function terrainFunction(x,z) {
    const rolls = (noise(x*.047+4,z*.047+7)-.5)*2.5 + (noise(x*.12,z*.12)-.5)*.48;
    const shoulder = (Math.max(0,Math.abs(x)-12)*.092) + Math.max(0,-z-23)*.066;
    const hill = 3.4*Math.exp(-((x+34)**2/300+(z+27)**2/350)) +
      2.6*Math.exp(-((x-35)**2/245+(z+32)**2/120));
    const pool = 4.6*Math.exp(-((x-21)**2/58+(z-1)**2/126));
    return rolls + shoulder + hill - pool + .5*Math.sin(z*.12) + .5;
  }
  const cell = 1.8;
  // Exact triangle interpolation keeps props, footsteps and path strips on the mesh.
  function height(x,z) {
    const ix=Math.floor(x/cell), iz=Math.floor(z/cell);
    const a=x/cell-ix, b=z/cell-iz;
    const s=terrainFunction(ix*cell,iz*cell);
    const e=terrainFunction((ix+1)*cell,iz*cell);
    const n=terrainFunction(ix*cell,(iz+1)*cell);
    if(a+b<1) return s+(e-s)*a+(n-s)*b;
    const d=terrainFunction((ix+1)*cell,(iz+1)*cell);
    return d+(n-d)*(1-a)+(e-d)*(1-b);
  }
  const ground=buffer();
  for(let iz=-47;iz<47;iz++) for(let ix=-47;ix<47;ix++) {
    const x=ix*cell,z=iz*cell;
    const points=[[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].map(([a,b])=>[a,terrainFunction(a,b),b]);
    const meadow=noise(x*.115,z*.115)*.43+noise(x*.051+9,z*.051)*.50+noise(x*.4,z*.4)*.07;
    const base=blend('#507749','#a8b769',meadow);
    if(x>10 && x<33 && z>-17 && z<18 && points[0][1]<-1) base.lerp(color('#7c9376'),.5);
    tri(ground,points[0],points[2],points[1],base.clone().multiplyScalar(between(.94,1.035)));
    tri(ground,points[2],points[3],points[1],base.clone().multiplyScalar(between(.94,1.035)));
  }
  finish(ground,mat(),'Ochre and sage meadow').receiveShadow=true;

  const routes=[], road=buffer(), gravel=buffer();
  function path(coords, width) {
    const curve=new THREE.CatmullRomCurve3(coords.map(([x,z])=>new THREE.Vector3(x,0,z)));
    const points=curve.getSpacedPoints(Math.ceil(curve.getLength()/.92));
    const route={points,width}; routes.push(route);
    let prev;
    points.forEach((p,i)=>{
      const dir=points[Math.min(points.length-1,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize();
      const ac=[dir.z,-dir.x], row=[];
      const wav=1+.09*Math.sin(i*.34)+.045*Math.sin(i*1.27);
      const tint=blend('#b6a47f','#d6bb90',noise(p.x*.15,p.z*.15));
      [-1.06,-.81,-.28,.22,.77,1.06].forEach((f,k)=>{
        const d=width*(wav*f+between(-.075,.075)), x=p.x+ac[0]*d,z=p.z+ac[1]*d;
        row.push([x,height(x,z)+.041+(.018*(1-Math.abs(f))),z]);
        if(prev && k>0) {
          const tone=(k===1||k===5) ? tint.clone().lerp(color('#92a569'),between(.24,.47)):tint.clone().multiplyScalar(k===3?.984:1);
          tri(road,prev[k-1],row[k-1],prev[k],tone);
          tri(road,prev[k],row[k-1],row[k],tone.clone().multiplyScalar(between(.975,1.025)));
        }
      });
      prev=row;
    });
  }
  path([[3,61],[5,40],[2.2,27],[-.3,15],[-1.8,7],[.4,-2],[3.9,-11],[.3,-24],[-.4,-41],[-4,-61]],2.05);
  path([[.5,-4],[-8,-11],[-20,-17],[-28,-31],[-28,-38]],1.12);
  path([[3.8,-11],[11,-15],[20,-18],[30,-14],[41,-19]],1.13);
  finish(road,mat(),'Three old pilgrim roads').receiveShadow=true;

  // Embedded slivers, weathered wheel ruts and fragments of an older paved road.
  // An independent stream keeps foliage placement stable when the trail is dressed.
  let roadSeed=34573;
  const grain=()=>((roadSeed=(Math.imul(roadSeed,1664525)+1013904223)>>>0)/4294967296);
  function roadChip(cx,cz,rx,rz,angle,tone) {
    const n=5,c=Math.cos(angle),s=Math.sin(angle),cy=height(cx,cz)+.083;
    for(let j=0;j<n;j++) {
      const a=j*tau/n,b=(j+1)*tau/n;
      const corner=(v)=>{
        const px=Math.cos(v)*rx*(1+.17*Math.sin(v*3+.7)),pz=Math.sin(v)*rz;
        const x=cx+px*c+pz*s,z=cz+pz*c-px*s;
        return [x,height(x,z)+.081,z];
      };
      tri(gravel,[cx,cy,cz],corner(b),corner(a),tone);
    }
  }
  for(const {points,width} of routes) for(let i=1;i<points.length;i++) {
    const p=points[i],v=p.clone().sub(points[i-1]).normalize(),yaw=Math.atan2(v.x,v.z);
    for(let j=0;j<12;j++) {
      const lateral=(grain()*2-1)*width*.95,forward=(grain()-.5)*.96;
      const cx=p.x+v.z*lateral+v.x*forward,cz=p.z-v.x*lateral+v.z*forward;
      const r=.014+grain()**2*.084;
      const tone=blend('#a29376','#d1c19a',grain()).multiplyScalar(.95+grain()*.11);
      roadChip(cx,cz,r*(1+grain()),r*(.54+grain()*.37),yaw+grain()*3,tone);
    }
    if(i%7===2 || i%11===1) {
      const lateral=(grain()-.5)*width*1.32;
      roadChip(p.x+v.z*lateral,p.z-v.x*lateral,.16+grain()*.24,.025+grain()*.05,yaw+(grain()-.5)*.6,
        blend('#a39679','#c8b895',.3+grain()*.45));
    }
  }
  finish(gravel,mat(),'Weathered shale in the track').receiveShadow=true;
  function nearRoad(x,z,extra=0) {
    for(const {points,width} of routes) {
      const threshold=(width+extra+.28)**2;
      for(let i=0;i<points.length;i+=2) if((x-points[i].x)**2+(z-points[i].z)**2<threshold)return true;
    }
    return false;
  }

  const instGroups=[], temp=new THREE.Object3D();
  function addInstances(geo,material,name) {
    const batch={geo,material,name,records:[]};instGroups.push(batch);return batch;
  }
  function instance(batch,x,y,z,sx,sy,sz,rot=0,tint=null,tilt=0) {
    temp.position.set(x,y,z); temp.scale.set(sx,sy,sz);temp.rotation.set(tilt,rot,0);temp.updateMatrix();
    batch.records.push([temp.matrix.clone(),tint]);
  }
  // Draw soft contact shadows directly onto uneven ground.
  const shade=buffer();
  function shadow(x,z,r,stretch=1) {
    const n=9; const center=[x,height(x,z)+.047,z];
    for(let i=0;i<n;i++) {
      const a=i*tau/n,b=(i+1)*tau/n;
      const p=[x+Math.cos(a)*r,0,z+Math.sin(a)*r*stretch];
      const q=[x+Math.cos(b)*r,0,z+Math.sin(b)*r*stretch];
      p[1]=height(p[0],p[2])+.039;q[1]=height(q[0],q[2])+.039;
      tri(shade,center,p,q,color('#ffffff'));
    }
  }
  const obstacle=[];
  const block=(x,z,r)=>obstacle.push([x,z,r]);

  const buildings=buffer(), masks=buffer(), glyphs=buffer();
  function axisBox(x,y,z,w,h,d,tint,batch=buildings,yaw=0) {
    const co=Math.cos(yaw),si=Math.sin(yaw);
    const pts=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]]
      .map(([a,b,c])=>[x+a*w*.5*co+c*d*.5*si,y+b*h,z+c*d*.5*co-a*w*.5*si]);
    [[0,3,2,1],[4,7,6,5],[3,7,4,0],[1,5,6,2],[2,6,7,3],[0,4,5,1]].forEach(([a,b,c,d])=>{
      tri(batch,pts[a],pts[b],pts[c],tint);tri(batch,pts[a],pts[c],pts[d],tint);
    });
  }
  const stone=()=>blend('#818b7f','#c8bca0',between(.16,.88));
  // Radial stones form actual arched openings, with a raised keystone and two faces.
  function arch(x,z,y,inner,width,spring,depth) {
    const arcN=13,outer=inner+width;
    for(let i=0;i<arcN;i++){
      const a=Math.PI*i/arcN+.009,b=Math.PI*(i+1)/arcN-.009;
      const cap=i===6?.22:0;
      const pts=[];
      for(const zz of [-depth*.5,depth*.5]) for(const [angle,r] of [[a,inner],[a,outer+cap],[b,outer+cap],[b,inner]])
        pts.push([x+Math.cos(angle)*r,y+spring+Math.sin(angle)*r,z+zz+cap*.2]);
      const tint=stone();
      [[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]].forEach(([a,b,c,d])=>{
        tri(buildings,pts[a],pts[b],pts[c],tint);tri(buildings,pts[a],pts[c],pts[d],tint);
      });
    }
    for(let side of [-1,1]) {
      for(let i=0;i<Math.ceil(spring/.74);i++) {
        const by=i*.74,hh=Math.min(.725,spring-by);
        axisBox(x+side*(inner+width*.5),y+by,z,width+between(-.02,.1),hh,depth+between(-.05,.03),stone());
      }
      axisBox(x+side*(inner+width*.5),y+spring-.24,z,width+.32,.26,depth+.32,stone());
      block(x+side*(inner+width*.5),z,width*.62);
    }
  }
  function tower(x,z,r,h,intact=false) {
    const y=height(x,z)-.3,n=7;
    const ring=(rr,v)=>Array.from({length:n},(_,i)=>{
      const a=(i+.5)*tau/n;return [x+Math.sin(a)*rr,v,z+Math.cos(a)*rr];
    });
    const trim=(bottom,top,rr1,rr2,tint)=>{
      const A=ring(rr1,bottom),B=ring(rr2,top);
      for(let i=0;i<n;i++){let j=(i+1)%n;tri(buildings,A[i],A[j],B[i],tint);tri(buildings,A[j],B[j],B[i],tint);}
    };
    const rows=Math.ceil(h/.80);
    for(let k=0;k<rows;k++) {
      const lo=y+k*h/rows,hi=y+(k+1)*h/rows, rr=r*(1-.13*k/rows);
      const A=ring(rr,lo),B=ring(rr,hi);
      for(let i=0;i<n;i++) {
        const j=(i+1)%n,t=stone();
        tri(buildings,A[i],A[j],B[i],t);
        tri(buildings,A[j],B[j],B[i],t.clone().multiplyScalar(between(.98,1.009)));
      }
    }
    trim(y+.03,y+.48,r*1.24,r*1.22,stone()); trim(y+.48,y+.82,r*1.22,r,stone());
    trim(y+h*.53,y+h*.53+.23,r*.98,r*.98,stone());
    trim(y+h-.45,y+h-.18,r*.89,r*1.04,stone()); trim(y+h-.18,y+h+.22,r*1.04,r*1.04,stone());
    const roof=ring(r*1.03,y+h+.18);
    for(let i=0;i<n;i++) tri(buildings,[x,y+h+.18,z],roof[i],roof[(i+1)%n],color('#778078'));
    for(let i=0;i<n;i++){
      const a=(i+.5)*tau/n;
      if(!intact && i===4)continue;
      const hh=intact?.8:between(.3,1.45);
      axisBox(x+Math.sin(a)*r*.87,y+h+.18,z+Math.cos(a)*r*.87,r*.61,hh,r*.43,stone(),buildings,a);
    }
    // Arrow loops cut a dark tapered slot into the tower silhouette.
    for(const a of [0,Math.PI*.5,Math.PI,-Math.PI*.5]){
      axisBox(x+Math.sin(a)*r*.89,y+h*.70,z+Math.cos(a)*r*.89,.19,h*.15,.12,color('#455755'),masks,a);
    }
    block(x,z,r*1.08);shadow(x,z,r*1.24);
    return y+h;
  }

  const banners=[];
  const flagFront=color('#a64529'),flagBack=color('#793c2c'), gold=color('#e3b569');
  function banner(x,y,z,w,h,angle=0) {
    const data=buffer(),N=5,M=7;
    const cut=(u)=> h*(u>.50 ? (u-.5)*.5 : (.5-u)*.5);
    const pt=(i,j)=>{const u=i/N,v=j/M;return [(u-.5)*w,-v*h+v**4*cut(u),Math.sin(u*4.1+v*1.25)*.10*v];};
    for(let j=0;j<M;j++)for(let i=0;i<N;i++){
      const tint=j===1 || j===M-2 ? (i===0||i===N-1?gold:flagFront) : (i===0||i===4 ? flagBack : flagFront);
      tri(data,pt(i,j),pt(i+1,j),pt(i,j+1),tint);
      tri(data,pt(i+1,j),pt(i+1,j+1),pt(i,j+1),tint);
    }
    // A simple golden lozenge on each standard.
    const yy=-h*.39,ww=w*.16,hh=h*.115,zz=.135;
    tri(data,[0,yy+hh,zz],[-ww,yy,zz],[0,yy-hh,zz],gold);
    tri(data,[0,yy+hh,zz],[0,yy-hh,zz],[ww,yy,zz],gold);
    const obj=finish(data,mat(),'Tattered copper standard');obj.position.set(x,y,z);obj.rotation.y=angle;
    banners.push({obj,base:new Float32Array(data.p),h,phase:rand()*tau});
    axisBox(x,y,z,w*1.26,.095,.11,color('#6b5035'),buildings,angle);
  }
  const gateY=Math.max(height(-3.4,-40),height(3.4,-40))-.3;
  arch(0,-40,gateY,3.18,1.16,4.24,2.5);
  const westCrown=tower(-6.4,-40.6,2.22,10.7);
  const eastCrown=tower(6.55,-40.9,2.6,14.1,true);
  // A broken bridge crosses the face of the western ridge.
  for(let i=0;i<3;i++) {
    const x=-11.25-i*6.35,z=-40.8-i*.16;
    const base=gateY+.06;arch(x,z,base,2.48,.68,2.12,1.65);
    axisBox(x,base+5.06,z,6.35,.44,1.72,stone());
    for(let k=0;k<3;k++) axisBox(x+(k-1)*1.7,base+5.5,z+.62,1.75,.36,.32,stone());
  }
  for(const [x,z,h] of [[-22,-39.3,5.2],[-32,-33,6.7],[-25.5,-31.6,2.15]]) tower(x,z,1.45,h);
  banner(-6.4,westCrown-1.3,-38.44,1.36,3.8);
  banner(6.55,eastCrown-1.24,-38.39,1.72,4.45);
  axisBox(6.55,eastCrown+.18,-40.9,.12,4.15,.12,color('#61533f'));
  banner(7.27,eastCrown+3.86,-40.9,1.34,1.32);
  for(let side of [-1,1]) {
    const x=side*3.6,z=-20.3+side*1.1,y=height(x,z);
    axisBox(x,y,z,.19,4.65,.19,color('#69543c'));
    axisBox(x,y-.07,z,.54,.52,.55,stone());
    banner(x+side*.67,y+4.48,z,1.34,2.20,side*.16);
  }
  // A fragment of an old waymarker is visible before the valley forks.
  const mileX=-6.6,mileZ=.3,mileY=height(mileX,mileZ);
  axisBox(mileX,mileY-.05,mileZ,1.15,.36,.92,stone(),buildings,-.19);
  axisBox(mileX,mileY+.28,mileZ,.56,1.05,.50,stone(),buildings,-.19);
  axisBox(mileX+.02,mileY+1.32,mileZ,.67,.14,.59,stone(),buildings,-.19);
  const shrineY=height(30,-14);
  for(let k=0;k<3;k++) axisBox(30,shrineY+k*.25-.17,-14,4.4-k*.75,.33,4.4-k*.75,stone(),buildings,Math.PI/4);
  for(const [dx,dz,h] of [[-2.6,-2,4.25],[2.7,-1.55,3.2],[1.8,2.5,1.68]]) tower(30+dx,-14+dz,.72,h);
  const crystalTint=color('#8be0cd');
  for(let k=0;k<6;k++){
    const a=k*tau/6,b=(k+1)*tau/6;
    const p=[30+Math.cos(a)*.62,shrineY+2.28,-14+Math.sin(a)*.62];
    const q=[30+Math.cos(b)*.62,shrineY+2.28,-14+Math.sin(b)*.62];
    tri(glyphs,[30,shrineY+3.61,-14],p,q,crystalTint.clone().multiplyScalar(between(.76,1.25)));
    tri(glyphs,q,p,[30,shrineY+1.03,-14],color('#497e7a'));
  }
  const masonry = finish(buildings,mat(),'Ruined gate, aqueduct, wayshrines');
  masonry.castShadow=true; masonry.receiveShadow=true;
  finish(masks,mat('unlit'),'Arrow slits');
  finish(glyphs,mat('unlit'),'Shrine crystal');

  // The mountain tarn sits in a depression, its edge follows the terrain rather than a circular decal.
  const water=buffer(),ripples=buffer(),waterY=-.53;
  const inTarn=(x,z)=> x>9 && x<33 && z>-16 && z<18 && height(x,z)<waterY+.10;
  // Clip a grid of horizontal water triangles against the actual meadow height.
  function wetTriangle(verts) {
    const poly=[];
    for(let i=0;i<3;i++){
      const a=verts[i],b=verts[(i+1)%3],wet=a[1]<waterY;
      if(wet) poly.push([a[0],waterY,a[2]]);
      if(wet !== (b[1]<waterY)){
        const f=(waterY-a[1])/(b[1]-a[1]);
        poly.push([a[0]+f*(b[0]-a[0]),waterY,a[2]+f*(b[2]-a[2])]);
      }
    }
    if(poly.length<3)return;
    const h=(verts[0][1]+verts[1][1]+verts[2][1])/3;
    const tone=blend('#4c9393','#99b9a0',clamp((h+3.35)/3.3,0,1)*.85+.08*rand());
    for(let i=1;i<poly.length-1;i++)tri(water,poly[0],poly[i],poly[i+1],tone);
  }
  for(let iz=-10;iz<10;iz++)for(let ix=5;ix<19;ix++){
    const x=ix*cell,z=iz*cell;
    const pts=[[x,z],[x+cell,z],[x,z+cell],[x+cell,z+cell]].map(([x,z])=>[x,height(x,z),z]);
    wetTriangle([pts[0],pts[2],pts[1]]);wetTriangle([pts[2],pts[3],pts[1]]);
  }
  for(let i=0;i<125;i++){
    const x=between(12,29),z=between(-12,14);
    if(height(x,z)>waterY-.25)continue;
    const w=between(.13,.74),d=between(.025,.075);
    tri(ripples,[x-w,waterY+.014,z],[x+w,waterY+.014,z-.08],[x+w*.15,waterY+.014,z+d],color('#b4d5bd',between(.82,1.03)));
  }
  finish(water,mat('unlit'),'Glacier tarn');finish(ripples,mat('unlit'),'Water glints');

  const treeGroups=[];
  // Each tier is made up of overlapping lateral boughs with jagged, drooping ends.
  function spruce(variant) {
    const g=buffer(),n=8;
    const trunkBase=color('#5b5142'),trunkTop=color('#806d51');
    const pt=(a,r,y)=>[Math.cos(a)*r,y,Math.sin(a)*r];
    for(let i=0;i<n;i++) {
      const a=i*tau/n,b=(i+1)*tau/n;
      tri(g,pt(a,.023,0),pt(b,.024,0),pt(a,.012,.78),trunkBase);
      tri(g,pt(b,.024,0),pt(b,.012,.78),pt(a,.012,.78),trunkTop);
    }
    const dark=['#306152','#326862','#376754','#326764','#3b6854'][variant%5];
    const light=['#739675','#759b7a','#82a17b','#709877','#819e76'][variant%5];
    const levels=7;
    for(let l=0;l<levels;l++){
      const base=.14+l*.114, rr=(1-l*.121)*between(.17,.198), phase=l*2.25+variant*.7;
      const N=l>4?8:12;
      const tip=pt(phase,between(.002,.012),Math.min(1.03,base+(.36-.012*l)));
      for(let k=0;k<N;k++){
        const a=k*tau/N+phase,b=(k+1)*tau/N+phase;
        const uneven=k%2 ? .77 : 1.14;
        const uneven2=(k+1)%2 ? .77 : 1.14;
        const r1=rr*uneven,r2=rr*uneven2;
        const dip=k%2 ? .029 : -.018, dip2=(k+1)%2 ? .029 : -.018;
        const p=pt(a,r1,base+dip),q=pt(b,r2,base+dip2);
        const t=blend(dark,light,.18+.5*l/levels+between(-.12,.22));
        tri(g,p,q,tip,t);
        if(l<5)tri(g,q,p,[0,base+.046,0],color(dark,.74));
        if(l<5 && k%2===variant%2) {
          const mid=(a+b)*.5,reach=rr*(1.12+.14*Math.sin(k*3+l+variant));
          const end=pt(mid,reach,base-.035);
          const spine=pt(mid,rr*.43,base+.12);
          tri(g,pt(a,rr*.69,base+.038),end,spine,t.clone().multiplyScalar(.94));
          tri(g,end,pt(b,rr*.72,base+.018),spine,t.clone().multiplyScalar(1.12));
        }
      }
    }
    return addInstances(geometry(g),mat(),'Silver fir '+variant);
  }
  for(let i=0;i<5;i++)treeGroups.push(spruce(i));
  const treeSites=[];
  const minDistSq=(x,z,px,pz)=>(x-px)**2+(z-pz)**2;
  function clearLandmarks(x,z,gap) {
    return minDistSq(x,z,0,15)>(4.6+gap)**2 && minDistSq(x,z,0,6)>(3.1+gap)**2 &&
      minDistSq(x,z,-28,-35)>(4.2+gap)**2 && minDistSq(x,z,30,-14)>(4.5+gap)**2 &&
      !(x>-30-gap && x<10+gap && z<-36+gap && z>-45-gap);
  }
  function tree(x,z,h,sz=1,solid=true) {
    const shadeTint=color('#ffffff',between(.80,1.07)),w=h*sz*between(.84,1.14);
    instance(treeGroups[Math.floor(rand()*5)],x,height(x,z)-.035,z,w,h,w,rand()*tau,shadeTint);
    if(solid && Math.abs(x)<55 && Math.abs(z)<57){
      treeSites.push([x,z]); if(h>3.5)block(x,z,Math.min(.48,h*.047));
      shadow(x,z,w*.165,1.06);
    }
  }
  // Deliberate framing keeps the travel corridor and first enemy readable.
  [[-11,9,7.9],[-10,3.9,5.7],[-13,13,9.4],[-15.8,-2,8.3],[-17,-10,7.7],[-13.6,-8.5,4.5],
   [15.2,6.5,7.3],[14,10.5,6.3],[17,13.7,8.1],[11.2,-2.7,5.25],[16,-8,5.3],
   [-9,-18,6.55],[-12.5,-17,4.8],[14.5,-25,7.0],[16,-26.8,4.9],[10.2,-30,6.0],[-13.5,-29,6.3],
   [-22,2.4,10.2],[22,-22,7.8],[4.4,-52,7.0],[-2.2,-50,4.8]].forEach(([x,z,h])=>tree(x,z,h));
  for(let k=0;k<115;k++) {
    const cx=between(-72,72),cz=between(-70,73),count=3+Math.floor(rand()*6);
    for(let j=0;j<count;j++){
      const a=rand()*tau,r=between(0,6.8),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
      if(!clearLandmarks(x,z,1)||nearRoad(x,z,1.9)||inTarn(x,z))continue;
      if(Math.abs(x)<9.7 && z>-35 && z<34)continue;
      if(x>-32 && x<-14 && z<-26 && z>-41)continue;
      if(treeSites.some(([px,pz])=>minDistSq(x,z,px,pz)<2.7))continue;
      tree(x,z,between(3.3,9.8),between(.79,1.08));
    }
  }
  // Close the horizon at the roots of the distant peaks with a varied forest line.
  for(let n=0;n<360;n++){
    const side=n%4,p=between(-100,100),d=between(61,82);
    const x=side===0||side===1?p:(side===2?-d:d),z=side===0?-d:side===1?d:p;
    tree(x,z,between(4.5,10),between(.78,1),false);
  }

  // Low, fractured granite boulders are colored by facet with occasional moss on their caps.
  function rock(variant) {
    const b=buffer(),count=6+(variant%3),ring1=[],ring2=[],ring3=[];
    for(let k=0;k<count;k++){
      const a=k*tau/count+between(-.12,.12),r=between(.81,1.06);
      ring1.push([Math.cos(a)*r*.82,-.08,Math.sin(a)*r*.73]);
      ring2.push([Math.cos(a)*r,between(.21,.47),Math.sin(a)*r*.8]);
      ring3.push([Math.cos(a)*r*between(.3,.7)-.09,between(.62,.82),Math.sin(a)*r*.5+.04]);
    }
    const dark=variant===2?'#65716a':'#697872',bright=variant===2?'#b0a68c':'#b4b3a0';
    for(let k=0;k<count;k++){
      const j=(k+1)%count;
      const side=blend(dark,bright,between(.06,.64));
      tri(b,ring1[k],ring1[j],ring2[k],side);
      tri(b,ring1[j],ring2[j],ring2[k],side);
      tri(b,ring2[k],ring2[j],ring3[k],side.clone().multiplyScalar(1.04));
      tri(b,ring2[j],ring3[j],ring3[k],blend(dark,bright,between(.35,.86)));
      tri(b,ring3[k],ring3[j],[.018,.85,-.10],blend(bright,variant===1?'#8c9d68':'#a5ae9c',between(.06,.7)));
    }
    return addInstances(geometry(b),mat(),'Granite '+variant);
  }
  const stones=[rock(0),rock(1),rock(2),rock(3)];
  function placeRock(x,z,r,flatten=1,solid=true) {
    const rot=rand()*tau,sy=r*flatten;
    instance(stones[Math.floor(rand()*4)],x,height(x,z)-.06*Math.min(r,1),z,r,sy,r*between(.65,1.18),rot,
      color('#ffffff',between(.8,1.08)));
    if(r>.72){if(solid && r>1.0)block(x,z,r*.60);shadow(x,z,r*.78);}
  }
  for(let k=0;k<170;k++){
    let x=between(-63,63),z=between(-64,62);
    if(nearRoad(x,z,1.1)||!clearLandmarks(x,z,.3)||inTarn(x,z)||Math.abs(x)<5&&z>-.1&&z<28)continue;
    const size=between(.6,2.45);
    placeRock(x,z,size,between(.78,1.25));
    if(rand()<.63)placeRock(x+between(-2,2),z+between(-2,2),size*between(.26,.63));
  }
  [[-6.8,7,1.64],[-5.7,7.48,.55],[7.8,4.55,1.44],[9.2,3.6,.76],[-12,-1.7,2.1],
    [13.5,-6,1.65],[-8.3,-17,.75],[-21,-6,2.6],[-20.1,-6.4,1.1],[12.3,18.5,2.2],[-9.5,18.9,1.6]]
    .forEach(([x,z,r])=>placeRock(x,z,r,between(.67,.91)));
  // Small stones settle along the worn edges of each road.
  for (const route of routes) {
    route.points.forEach((p,i)=>{
      if(i%2===0) return;
      const dir=route.points[Math.min(i+1,route.points.length-1)].clone().sub(p).normalize(),sgn=rand()<.5?-1:1;
      const d=(route.width+between(-.62,.35))*sgn;
      const x=p.x+dir.z*d,z=p.z-dir.x*d;
      placeRock(x,z,between(.09,.29),between(.36,.64),false);
      if(rand()<.35)placeRock(x+.23,z-.13,between(.06,.13),.5,false);
    });
  }

  // Hand-shaped meadow clumps, heather and golden seedheads add readable foreground texture.
  const grassGroups=[];
  function grassy(variant) {
    const g=buffer(),reeds=variant===3;
    const palette=variant===0?['#647a47','#9aa65a','#adb270']:variant===1?['#84914b','#b4ac58','#c6b96b']:
      variant===2?['#657c58','#8b9d63','#b4b878']:['#8d8b52','#a69d5d','#c5ba75'];
    const blades=7+variant;
    for(let i=0;i<blades;i++){
      const a=rand()*tau, r=between(.02,.23), x=Math.cos(a)*r,z=Math.sin(a)*r,h=between(.16,.53)*(reeds?1.4:1);
      const tx=x+Math.cos(a)*h*between(.24,.65),tz=z+Math.sin(a)*h*between(.24,.65);
      const w=between(.022,.056),dx=Math.cos(a+1.55)*w,dz=Math.sin(a+1.55)*w;
      const left=[x-dx,0,z-dz],right=[x+dx,0,z+dz];
      const mid=[x+(tx-x)*.38+dx*.22,h*.48,z+(tz-z)*.38+dz*.22],tip=[tx,h,tz];
      tri(g,left,mid,tip,color(palette[0]));tri(g,mid,right,tip,color(palette[2]));
      tri(g,left,right,mid,color(palette[1]));
      if(reeds&&i%3===0) {
        tri(g,[tx,h,tz],[tx+.015,h+.16,tz],[tx+.037,h+.18,tz+.025],color('#ae9160'));
      }
    }
    return addInstances(geometry(g),mat(),'Meadow tufts '+variant);
  }
  for(let i=0;i<4;i++)grassGroups.push(grassy(i));
  function grassClump(x,z,s,index) {
    instance(grassGroups[index],x,height(x,z)+.021,z,s,s*between(.76,1.18),s,rand()*tau,color('#ffffff',between(.88,1.06)));
  }
  // Dense patches and open gaps follow soil moisture, with extra strands on the road shoulders.
  for(let i=0;i<12200;i++){
    const x=between(-54,54),z=between(-54,55);
    if(noise(x*.25,z*.27)<.33 && rand()<.75 || nearRoad(x,z,-.08) || inTarn(x,z))continue;
    grassClump(x,z,between(.63,1.53),Math.floor(rand()*3));
  }
  for (let {points,width} of routes) for(let i=1;i<points.length;i++) {
    const p=points[i],prev=points[i-1],dir=p.clone().sub(prev).normalize();
    for(const side of [-1,1]){
      const d=(width+between(.17,1.3))*side;
      if(rand()<.76)grassClump(p.x+dir.z*d,p.z-dir.x*d,between(.65,1.29),Math.floor(rand()*3));
    }
  }
  for(let i=0;i<400;i++){
    const x=between(12,30),z=between(-13,14),h=height(x,z);
    if(h>waterY-.4&&h<waterY+.5)grassClump(x,z,between(1.0,1.75),3);
  }
  const flowers=[];
  for(let variant=0;variant<3;variant++){
    const g=buffer(), petals=variant===0?'#e8c75e':variant===1?'#e9dccc':'#aa91ae';
    const c=color(petals),st=color('#6c804c'),core=color(variant===0?'#9b7944':'#bf9f4c');
    for(let f=0;f<5;f++){
      const x=between(-.22,.22),z=between(-.22,.22),h=between(.21,.46),cx=x+.035;
      tri(g,[x-.012,0,z],[x+.012,0,z],[cx,h,z+.015],st);
      const n=5,mid=[cx,h,z+.015];
      for(let k=0;k<n;k++){
        const a=k*tau/n+.45,b=(k+.72)*tau/n+.45;
        tri(g,mid,[cx+Math.cos(a)*.083,h+.02,z+.015+Math.sin(a)*.083],
          [cx+Math.cos(b)*.066,h+.016,z+.015+Math.sin(b)*.066],c);
      }
      tri(g,[cx-.024,h+.021,z-.01],[cx+.027,h+.021,z],[cx,h+.026,z+.043],core);
    }
    flowers.push(addInstances(geometry(g),mat(),'Wildflowers '+variant));
  }
  for(let i=0;i<270;i++){
    let cx=between(-35,36),cz=between(-43,43);
    const variant=Math.floor(rand()*3);
    for(let j=0;j<between(4,13);j++){
      let x=cx+between(-2.2,2.2),z=cz+between(-2.2,2.2);
      if(nearRoad(x,z,-.08)||inTarn(x,z))continue;
      const s=between(.78,1.5);
      instance(flowers[variant],x,height(x,z)+.013,z,s,s,s,rand()*tau);
    }
  }
  // Warm juniper thickets, built from tiny fractured leafy masses.
  const shrubs=[];
  for(let i=0;i<3;i++) {
    const g=buffer(),pal=i===0?['#657e51','#a1ac66']:i===1?['#6d7951','#b9a261']:['#687e5b','#9dae76'];
    for(let k=0;k<7;k++){
      const x=between(-.48,.48),z=between(-.35,.35),r=between(.2,.42),y=between(.05,.23);
      const upper=[x+between(-.07,.07),y+r*1.4,z+between(-.07,.07)];
      for(let j=0;j<6;j++) {
        const a=j*tau/6,b=(j+1)*tau/6;
        const p=[x+Math.cos(a)*r,y+r*.24,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y+r*.24,z+Math.sin(b)*r];
        tri(g,p,q,upper,blend(pal[0],pal[1],between(.22,.84)));
        tri(g,q,p,[x,0,z],color(pal[0]));
      }
    }
    shrubs.push(addInstances(geometry(g),mat(),'Juniper shrubs '+i));
  }
  for(let i=0;i<480;i++){
    let x=between(-56,56),z=between(-56,56);
    if(nearRoad(x,z,.6)||inTarn(x,z)||!clearLandmarks(x,z,.3))continue;
    const s=between(.63,1.80);
    instance(shrubs[i%3],x,height(x,z)-.03,z,s,s*between(.75,1.18),s,rand()*tau);
    if(s>1.38)shadow(x,z,s*.53);
  }

  const shadowMesh=finish(shade,new THREE.MeshBasicMaterial({
    color:'#374b45',side:THREE.DoubleSide,transparent:true,opacity:.16,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  }),'Ground contact shadows');
  if(shadowMesh)shadowMesh.renderOrder=1;
  for(const {geo,material,name,records} of instGroups){
    if(!records.length)continue;
    const sectors=new Map();
    for(const record of records) {
      const e=record[0].elements;
      const sector=Math.floor((e[12]+32)/64)+','+Math.floor((e[14]+32)/64);
      if(!sectors.has(sector))sectors.set(sector,[]);
      sectors.get(sector).push(record);
    }
    for(const sector of sectors.values()){
      const mesh=new THREE.InstancedMesh(geo,material,sector.length);
      mesh.name=name;
      mesh.castShadow=name.startsWith('Silver fir')||name.startsWith('Granite')||name.startsWith('Juniper');
      mesh.receiveShadow=true;
      sector.forEach(([matrix,tint],i)=>{mesh.setMatrixAt(i,matrix);if(tint)mesh.setColorAt(i,tint);});
      mesh.computeBoundingSphere();scene.add(mesh);
    }
  }
  // Windborne motes catch the dawn light; their group moves slowly rather than per-particle per-frame.
  const dustPositions=[];
  for(let i=0;i<72;i++) {
    const x=between(-30,30),z=between(-34,36);
    dustPositions.push(x,height(x,z)+between(.6,4.8),z);
  }
  const dustGeo=new THREE.BufferGeometry();
  dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3));
  const motes=new THREE.Points(dustGeo,new THREE.PointsMaterial({
    color:0xffe7ab,size:.045,transparent:true,opacity:.62,depthWrite:false,sizeAttenuation:true
  }));
  scene.add(motes);

  function constrain(x,z) {
    x=clamp(x,-56,56);z=clamp(z,-56,56);
    for(let pass=0;pass<2;pass++)for(const [cx,cz,r] of obstacle){
      let dx=x-cx,dz=z-cz;
      const d2=dx*dx+dz*dz,rr=r+.25;
      if(d2>=rr*rr)continue;
      if(d2<.0001){dx=0;dz=1;}else{const norm=1/Math.sqrt(d2);dx*=norm;dz*=norm;}
      x=cx+dx*rr; z=cz+dz*rr;
    }
    return {x:clamp(x,-56,56),z:clamp(z,-56,56)};
  }
  let elapsed=0;
  function update(dt,t) {
    elapsed=Number.isFinite(t)?t:elapsed+dt;
    for(const {obj,base,h,phase} of banners) {
      const attr=obj.geometry.getAttribute('position');
      for(let i=0;i<attr.count;i++){
        const x=base[i*3],y=base[i*3+1],v=Math.max(0,-y/h);
        attr.setZ(i,base[i*3+2]+v*(.19*Math.sin(elapsed*2.45+x*2.18+y*.72+phase)+.10*Math.sin(elapsed*3.7-y*1.4+phase)));
      }
      attr.needsUpdate=true;
    }
    motes.position.set(Math.sin(elapsed*.13)*.95,Math.sin(elapsed*.22)*.16,Math.sin(elapsed*.10)*.63);
  }
  return {height,update,constrain};
}
