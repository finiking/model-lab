/* Two local schools of Exocoetidae break the water as the racer passes.
   Each crossing is integrated from a fixed point on the sea, in world space. */
window.buildShoal = function buildShoal(THREE, scene) {
  const sea = -2.7;
  const group = new THREE.Group();
  group.name = 'Exocoetidae • flying-fish shoals';
  scene.add(group);
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  const paint = n => new THREE.Color(n);

  function builder() {
    const p=[], colors=[], ids=[];
    function vertex(x,y,z,c) {
      p.push(x,y,z); colors.push(c.r,c.g,c.b);
      return p.length/3-1;
    }
    function tri(a,b,c) { ids.push(a,b,c); }
    function geom() {
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      g.setIndex(ids);g.computeVertexNormals();
      return g;
    }
    return {vertex,tri,geom};
  }
  const body=builder(), fin=builder();
  const col={
    back:paint(0x126f79), side:paint(0x81d5d4), silver:paint(0xf4e8c6),
    belly:paint(0xe69274), rib:paint(0x4d9a99), wing:paint(0xa6ecdf),
    warm:paint(0xffba58), eye:paint(0x102e35)
  };
  // Streamlined taper: the lower lobe of an exocoetid's forked tail is longer.
  const sections=[[-.47,.013,.024],[-.37,.033,.040],[-.24,.056,.068],[-.05,.081,.1],
                  [.14,.092,.102],[.31,.067,.078],[.406,.045,.051],[.48,.008,.012]];
  const sides=14;
  for(let j=0;j<sections.length;j++) {
    const [x,ry,rz]=sections[j];
    for(let i=0;i<sides;i++) {
      const a=i*Math.PI*2/sides, sy=Math.cos(a);
      const c=sy>.22 ? col.side.clone().lerp(col.back,Math.min(1,(sy-.22)*1.6)) :
        sy>-.42 ? col.silver.clone().lerp(col.side,(sy+.42)/.64) :
        col.silver.clone().lerp(col.belly,(-sy-.42)*1.4);
      c.multiplyScalar(1+Math.cos(a*2+j*.7)*.045);
      body.vertex(x,ry*sy,rz*Math.sin(a),c);
      if(j>0) {
        const b=(j-1)*sides+i,l=(j-1)*sides+(i+1)%sides;
        body.tri(b,l,l+sides);body.tri(b,l+sides,b+sides);
      }
    }
  }
  function fan(g,center,boundary) {
    const a=g.vertex(...center);
    const path=boundary.map(q=>g.vertex(...q));
    for(let j=0;j<path.length;j++)g.tri(a,path[j],path[(j+1)%path.length]);
  }
  // Vertical tail, dorsal fin and ventral stabiliser.
  fan(body,[-.44,.002,0,col.side],[
    [-.421,.024,0,col.side],[-.588,.142,0,col.warm],[-.556,.069,0,col.rib],
    [-.50,.009,0,col.back],[-.641,-.211,0,col.warm],[-.548,-.168,0,col.wing],
    [-.447,-.05,0,col.side],[-.408,-.021,0,col.silver]]);
  fan(body,[-.171,.044,0,col.back],[
    [-.258,.047,0,col.back],[-.265,.127,0,col.rib],[-.246,.143,0,col.warm],
    [-.11,.081,0,col.back],[-.084,.056,0,col.side]]);
  fan(body,[-.239,-.042,0,col.rib],[
    [-.29,-.043,0,col.side],[-.307,-.099,0,col.warm],[-.17,-.062,0,col.belly]]);
  // Small raised eyes inlaid on both faces.
  for(const sign of [-1,1]) {
    for(const [r,depth,c] of [[.032,.077,col.warm],[.017,.08,col.eye],[.005,.083,col.silver]]) {
      const path=[];
      for(let j=0;j<12;j++){
        const a=j*Math.PI/6;path.push([.326+r*Math.cos(a),.017+r*Math.sin(a),sign*depth,c]);
      }
      fan(body,[.326,.017,sign*depth,c],path);
    }
  }
  // Two pairs of ray-supported pectoral membranes and a faceted, amber-tipped
  // leading edge. The wings are set in anhedral when first breaking the surface.
  for(const sign of [-1,1]) {
    const verts=[
      [.235,.009,.037,col.side],[.133,.032,.225,col.wing],[-.027,.062,.421,col.wing],
      [-.201,.078,.565,col.warm],[-.363,.068,.64,col.warm],[-.302,.044,.48,col.wing],
      [-.265,.025,.37,col.rib],[-.242,.021,.318,col.wing],[-.177,.008,.218,col.wing],
      [-.147,.004,.158,col.rib],[-.13,-.002,.066,col.side],
    ];
    const vertex=(x,y,z,c)=>[x,y,z*sign,c];
    fan(fin,vertex(.07,.031,.155,col.wing),verts.map(p=>vertex(...p)));
    // The rays run from the collar into the membrane, including a gold leading spar.
    for(const [i,shade] of [[2,col.silver],[3,col.silver],[5,col.rib],[7,col.rib],[9,col.rib]]){
      const tip=verts[i];
      const a=fin.vertex(.104,.035,sign*.101,shade);
      const b=fin.vertex(.091,.035,sign*.103,shade);
      const c=fin.vertex(tip[0],tip[1]+.003,sign*tip[2],tip[3]);
      fin.tri(a,b,c);
    }
    // Smaller, separate ventral flight foil.
    fan(fin,vertex(-.186,-.027,.073,col.side),[
      vertex(-.134,-.021,.052,col.side),vertex(-.203,-.029,.155,col.wing),
      vertex(-.363,-.041,.316,col.warm),vertex(-.327,-.041,.178,col.wing),
      vertex(-.279,-.026,.054,col.rib)]);
  }
  const entries=[];
  function school(size,t0,x0,dt,exit) {
    for(let i=0;i<size;i++) {
      const a=i*2.39996+(exit?.73:.11), b=(i*7%11)/11;
      entries.push({
        t:t0+dt*i+.105*Math.sin(a),
        x:x0+(exit?1.24:1.12)*i+Math.sin(a*.7)*.74,
        z:(exit?2.35:.89)+2.2*b+Math.sin(a)*.31,
        span:1.4+.46*b+.22*(.5+.5*Math.cos(a)),
        vx:3.1+b*2.6, vz:-.83+.65*Math.sin(a*.7),
        h:1.94+.96*b+(exit&&i%6===1?1.13:0)+(i===1?.22:0),
        k:.61+.31*(.5+.5*Math.cos(a*.83)), a
      });
    }
  }
  school(7,1.81,-35.5,.179,false);
  school(14,12.37,3.0,.183,true);
  const matBody = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.29,side:THREE.DoubleSide});
  const matWing = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.16,transparent:true,opacity:.86,side:THREE.DoubleSide});
  function inst(geo,mat,n,name) {
    const m=new THREE.InstancedMesh(geo,mat,n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.name=name;m.frustumCulled=false;m.count=0;
    group.add(m);return m;
  }
  const bodies=inst(body.geom(),matBody,entries.length,'Shearwater / bodies');
  const wings=inst(fin.geom(),matWing,entries.length,'Shearwater / paired sail fins');
  const droplets=inst(new THREE.IcosahedronGeometry(1,0),
    new THREE.MeshStandardMaterial({color:0xa3dcd9,emissive:0x306f71,emissiveIntensity:.18,roughness:.2,metalness:.2}),
    entries.length*10,'Salt flecks');
  const foam=inst(new THREE.TorusGeometry(1,.028,4,32,Math.PI*1.66),
    new THREE.MeshBasicMaterial({color:0xa3cdc0,transparent:true,opacity:.56,depthWrite:false,side:THREE.DoubleSide}),
    entries.length*2,'Rising rings');
  const position=v(0,0,0),direction=v(0,0,0),zaxis=v(0,0,1),up=v(0,1,0);
  const sideways=v(0,0,1),normal=v(0,1,0),scale=v(1,1,1);
  const basis=new THREE.Matrix4(), pose=new THREE.Matrix4();
  const q=new THREE.Quaternion(),bank=new THREE.Quaternion(),euler=new THREE.Euler();
  const unitX=v(1,0,0);
  function update(t) {
    let fish=0, spray=0, rings=0;
    for(const f of entries) {
      const dt=t-f.t,u=dt/f.span;
      if(u>=0&&u<=1) {
        const s=Math.sin(Math.PI*u);
        position.set(f.x+f.vx*dt,sea+4*f.h*u*(1-u),f.z+f.vz*dt+.11*s*Math.cos(f.a));
        direction.set(f.vx,4*f.h*(1-2*u)/f.span,f.vz+.11*Math.cos(Math.PI*u)*Math.PI/f.span*Math.cos(f.a)).normalize();
        sideways.crossVectors(direction,up).normalize();normal.crossVectors(sideways,direction);
        basis.makeBasis(direction,normal,sideways);
        q.setFromRotationMatrix(basis);
        bank.setFromAxisAngle(unitX,.32*Math.sin(f.a+u*2)+.11*Math.sin(f.a+u*8));
        q.multiply(bank);
        pose.compose(position,q,scale.setScalar(f.k));
        bodies.setMatrixAt(fish,pose);
        const spread=.23+.77*Math.min(1,3.8*s);
        scale.set(f.k,f.k,f.k*spread);
        pose.compose(position,q,scale);
        wings.setMatrixAt(fish,pose);fish++;
      }
      for(let impact=0;impact<2;impact++) {
        const tau=dt-(impact?f.span:0);
        if(tau<0||tau>.68)continue;
        const baseX=f.x+(impact?f.vx*f.span:0),baseZ=f.z+(impact?f.vz*f.span:0);
        const growth=.045+.64*tau;
        position.set(baseX,sea+.009,baseZ);
        q.setFromEuler(euler.set(Math.PI/2,0,f.a));
        pose.compose(position,q,scale.set(growth*1.17,growth,1));
        foam.setMatrixAt(rings++,pose);
        for(let k=0;k<5;k++) {
          const ang=f.a+k*2.42, vy=1.52+1.42*(.5+.5*Math.sin(3.3*k+f.a));
          const y=vy*tau-5.5*tau*tau;
          if(y<=.006)continue;
          position.set(baseX+Math.cos(ang)*(.09+tau*.85)-.22*tau,sea+y,baseZ+Math.sin(ang)*(.095+tau*.84));
          scale.set(.019+.004*k,.034+.004*k,.017+.003*k);
          q.setFromEuler(euler.set(Math.cos(ang)*.55,ang,Math.sin(ang)*.55));
          pose.compose(position,q,scale);droplets.setMatrixAt(spray++,pose);
        }
      }
    }
    for(const [m,n] of [[bodies,fish],[wings,fish],[droplets,spray],[foam,rings]]) {
      m.count=n; m.instanceMatrix.needsUpdate=true;
    }
  }
  return {group,update};
};
