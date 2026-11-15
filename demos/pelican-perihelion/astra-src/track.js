/* The race ribbon: a box deck on a triangular Warren girder.
   The treads, paint, spars, pylons and fixtures share the scene's curve frame. */
window.buildTrack = function buildTrack(THREE, scene, at) {
  const root = new THREE.Group();
  root.name = 'Heliograph • tidal velodrome';
  scene.add(root);

  const circ = Math.PI * 16;
  const low = -90;
  const high = 141;
  const pressedMetal = (color, roughness, metalness) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });

  const surfaces = {
    pavement: pressedMetal(0x384644, .92, .12),
    shoulder: pressedMetal(0x626057, .72, .24),
    oxblood: pressedMetal(0x923d2c, .56, .35),
    seam: pressedMetal(0x343e40, .74, .23),
    cream: pressedMetal(0xf3dfae, .63, .1),
    enamel: pressedMetal(0xe8a14d, .47, .32),
    shadow: pressedMetal(0x304346, .68, .35),
    steel: pressedMetal(0x77837b, .53, .41),
    brass: pressedMetal(0xc8a16d, .48, .48),
    pillar: pressedMetal(0x6c8582, .83, .15),
    foot: pressedMetal(0x515f5e, .92, .12)
  };
  const frameAt = new Map();
  function frame(s) {
    let f = frameAt.get(s);
    if (!f) {
      f = at(s);
      frameAt.set(s, f);
    }
    return f;
  }
  function point(s, lateral, altitude) {
    const f = frame(s);
    return f.p.clone().addScaledVector(f.z, lateral).addScaledVector(f.y, altitude);
  }
  const batches = new Map();
  function batch(name) {
    if (!batches.has(name)) batches.set(name, {p:[], ix:[]});
    return batches.get(name);
  }
  function vertex(b, v) {
    b.p.push(v.x, v.y, v.z);
    return b.p.length / 3 - 1;
  }
  function quad(name, a, b, c, d) {
    const g = batch(name);
    const n = vertex(g,a);
    vertex(g,b); vertex(g,c); vertex(g,d);
    g.ix.push(n,n+1,n+2,n,n+2,n+3);
  }
  const stations=[];
  function sampling(from,to,pitch,addFirst) {
    const steps=Math.ceil((to-from)/pitch);
    for(let i=addFirst?0:1; i<=steps; i++) stations.push(from+(to-from)*i/steps);
  }
  sampling(low,0,2.2,true);
  sampling(0,circ,.16,false);
  sampling(circ,high,2.2,false);
  // Profile runs clockwise round the top from the far lip towards the near one.
  function skin(name, z1, h1, z2, h2) {
    const b=batch(name), offset=b.p.length/3;
    for (const s of stations) {
      vertex(b,point(s,z1,h1)); vertex(b,point(s,z2,h2));
    }
    for (let i=0; i<stations.length-1; i++) {
      const n=offset+i*2;
      b.ix.push(n,n+1,n+3,n,n+3,n+2);
    }
  }
  skin('pavement',-.677,0,.677,0);
  for (const k of [-1,1]) {
    // On a straight this material profile is almost flush with the tyres.
    const profile=[
      [.677,0,.698,.001,'cream'],[.698,.001,.728,.002,'shoulder'],
      [.728,.002,.738,.002,'enamel'],[.738,.002,.793,.002,'shoulder'],
      [.793,.002,.818,-.021,'steel'],[.818,-.021,.818,-.119,'oxblood'],
      [.818,-.119,.816,-.134,'brass'],[.816,-.134,.789,-.183,'shadow'],
      [.789,-.183,.625,-.222,'shadow']
    ];
    for (const [za,ha,zb,hb,mat] of profile) {
      if(k>0) skin(mat,za,ha,zb,hb); else skin(mat,-zb,hb,-za,ha);
    }
  }
  skin('shadow',.625,-.222,-.625,-.222);
  // A narrow keel lets sunlight through the open web of diagonal members.
  skin('shadow',-.11,-.705,.11,-.705);
  skin('brass',.11,-.705,.11,-.792);
  skin('brass',-.11,-.792,-.11,-.705);
  skin('shadow',.11,-.792,-.11,-.792);

  const rodInstances={steel:[],brass:[],shadow:[]};
  const rodShape=new THREE.CylinderGeometry(1,1,1,6,1,false);
  const instanceScale=new THREE.Vector3();
  const vertical=new THREE.Vector3(0,1,0);
  function bar(a,b,rad,finish) {
    const delta=b.clone().sub(a), len=delta.length();
    if(len<.0001) return;
    const rotation=new THREE.Quaternion().setFromUnitVectors(vertical,delta.divideScalar(len));
    const transform=new THREE.Matrix4().compose(a.clone().lerp(b,.5), rotation, instanceScale.set(rad,len,rad));
    rodInstances[finish].push(transform);
  }
  function truss(start,end,pitch) {
    const count=Math.ceil((end-start)/pitch), step=(end-start)/count;
    for(let i=0; i<count; i++) {
      const a=start+i*step,b=a+step,c=(a+b)/2;
      for (const k of [-1,1]) {
        const left=point(a,k*.68,-.176), right=point(b,k*.68,-.176);
        const apex=point(c,k*.085,-.73);
        bar(left,apex,.037,'steel');
        bar(apex,right,.037,'steel');
        // Occasional tie beam keeps the repeating triangular section legible.
        if(i%3===0) bar(left,point(a,-k*.06,-.73),.028,'shadow');
      }
    }
  }
  truss(low,0,1.85); truss(0,circ,1.32); truss(circ,high,1.85);

  function patch(mat,start,end,za,zb,alt=.006) {
    quad(mat,point(start,za,alt),point(start,zb,alt),point(end,zb,alt),point(end,za,alt));
  }
  // Expansion joints have an inset brass tang only on the shoulder.
  for(let i=-35; i<61; i++) {
    const s=i*2.3;
    patch('seam',s,s+.014,-.675,.675,.003);
    for(const k of [-1,1]) {
      patch('brass',s-.034,s+.034,k*.755,k*.788,.006);
    }
  }
  // Small vernier-like station marks read as speed at tyre height.
  for (let i=-40;i<=99;i++) {
    const s=i*.76;
    patch(i%5===0?'enamel':'cream',s,s+(i%5===0?.092:.051),.603,.667);
    if(i%5===0) patch('enamel',s,s+.092,-.667,-.603);
  }
  // Crests and tangencies have clusters of four hand-painted timing marks.
  for(const s of [0,circ*.25,circ*.5,circ*.75,circ]) {
    for(const side of [-1,1]) {
      for(let j=0;j<4;j++) {
        const a=s-.30+j*.145;
        patch('cream',a,a+.057,side*(.39+j*.043),side*.585);
      }
    }
  }
  for(const s of [-5.8,circ+6]) {
    for(let row=0;row<2;row++) for(let i=0; i<12; i++) {
      if((row+i)%2===0) {
        const z=-.665+i*.111;
        patch('cream',s+row*.109,s+(row+1)*.109,z,z+.111);
      }
    }
  }

  // Cast-metal tapered pylons, a triangular cutout at the head, a flared
  // tide-stained foot. Baked meshes avoid hundreds of material submissions.
  function pier(s) {
    const {p,x,z}=frame(s);
    function world(dx,h,dz) {
      return new THREE.Vector3(p.x+x.x*dx+z.x*dz,h,p.z+x.z*dx+z.z*dz);
    }
    function tapered(y1,rx1,rz1,y2,rx2,rz2,mat) {
      const oct=[[1,.64],[.67,1],[-.67,1],[-1,.64],[-1,-.64],[-.67,-1],[.67,-1],[1,-.64]];
      for(let i=0;i<oct.length;i++) {
        const a=oct[i],b=oct[(i+1)%oct.length];
        quad(mat,world(a[0]*rx1,y1,a[1]*rz1),world(a[0]*rx2,y2,a[1]*rz2),
          world(b[0]*rx2,y2,b[1]*rz2),world(b[0]*rx1,y1,b[1]*rz1));
      }
    }
    tapered(-3.8,.59,.57,-2.38,.51,.49,'foot');
    tapered(-2.38,.51,.49,-2.29,.34,.36,'steel');
    tapered(-2.29,.34,.36,-1.16,.23,.28,'pillar');
    tapered(-1.16,.23,.28,-1.08,.25,.30,'brass');
    tapered(-1.08,.25,.30,-.87,.28,.31,'steel');
    for(const k of [-1,1]) {
      bar(world(0,-.93,k*.11),world(-.56,-.225,k*.59),.082,'steel');
      bar(world(0,-.93,k*.11),world(.56,-.225,k*.59),.082,'steel');
    }
  }
  for(let s=-85;s<=-.5;s+=8) pier(s);
  for(let s=circ+2.8;s<high;s+=8) pier(s);

  for(const [name,g] of batches) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
    geo.setIndex(g.ix);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const m=new THREE.Mesh(geo,surfaces[name]);
    m.name='Velodrome / '+name;
    m.receiveShadow=true;
    root.add(m);
  }
  for(const [name,matrices] of Object.entries(rodInstances)) {
    const m=new THREE.InstancedMesh(rodShape,surfaces[name],matrices.length);
    for(let i=0;i<matrices.length;i++) m.setMatrixAt(i,matrices[i]);
    m.instanceMatrix.needsUpdate=true;
    m.name='Velodrome / '+name+' lattice';
    m.receiveShadow=true;
    root.add(m);
  }
  return {group:root,update(){}};
};
