// World-space contact only. The caller supplies the point on the struck surface
// and the direction of travel from attacker to target.
const styles = {
  forehand: { sparks: 17, chips: 6, speed: 4.6, size: .77, arc: [-.88, -.47], ink: 0x753b22, hot: 0xffe9aa, embers: [0xffde8c, 0xffa442, 0xfff5cc] },
  backhand: { sparks: 19, chips: 7, speed: 5.1, size: .85, arc: [.69, .72], ink: 0x774027, hot: 0xffefb3, embers: [0xffd080, 0xff9a37, 0xfff2bf] },
  finisher: { sparks: 27, chips: 12, speed: 5.8, size: 1.03, arc: [-.18, -.98], ink: 0x74331e, hot: 0xffedab, embers: [0xffac43, 0xffffc4, 0xffdb6d] },
  gale: { sparks: 23, chips: 6, speed: 6.2, size: 1.03, arc: [-.98, .17], ink: 0x275b58, hot: 0xc9fff2, embers: [0x7debd0, 0xf5ffde, 0x8cdbf7] },
  quake: { sparks: 16, chips: 14, speed: 4.8, size: .88, arc: [.17, .99], ink: 0x6e381d, hot: 0xffe4a0, embers: [0xffa038, 0xffdf79, 0xffeab5] },
  guard: { sparks: 8, chips: 0, speed: 3.1, size: .52, arc: [.86, -.51], ink: 0x712b21, hot: 0xffb074, embers: [0xff944c, 0xd05532, 0xffba85] }
};

const sample = (lo, hi) => lo + (hi - lo) * Math.random();
const choose = a => a[Math.floor(Math.random() * a.length)];

function geometry(T, coordinates, colors) {
  const mesh = new T.BufferGeometry();
  mesh.setAttribute('position', new T.Float32BufferAttribute(coordinates, 3));
  if (colors) mesh.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  mesh.computeVertexNormals();
  return mesh;
}

// A tapered three-sided streak. The narrow tail turns amber while the leading edge burns bright.
function makeStreak(T) {
  const vertices = [], colors = [];
  const corners = [[1, .39, 0], [-.5, .39, .866], [-.5, .39, -.866]];
  for (let i = 0; i < 3; i++) {
    const a = corners[i], b = corners[(i + 1) % 3];
    vertices.push(0, -.50, 0, ...b, ...a, ...a, ...b, 0, .50, 0);
    colors.push(.44, .20, .08, .98, .79, .48, 1, .92, .63, 1, .92, .63, .98, .79, .48, 1, 1, 1);
  }
  return geometry(T, vertices, colors);
}

// The upper edge breaks into an off-centre barb. All strokes are open-ended.
function makeScar(T, capacity) {
  const vertices = [];
  function stroke(sections) {
    for (let i = 1; i < sections.length; i++) {
      const [x0, y0, w0] = sections[i - 1], [x1, y1, w1] = sections[i];
      vertices.push(x0, y0-w0, 0, x1, y1-w1, 0, x1, y1+w1, 0,
                    x0, y0-w0, 0, x1, y1+w1, 0, x0, y0+w0, 0);
    }
  }
  stroke([[-.64,.010,0],[-.26,-.010,.033],[-.055,.025,.044],[.16,-.010,.026],[.63,.045,0]]);
  stroke([[-.07,.018,.021],[.12,.075,.014],[.27,.15,0]]);
  stroke([[-.19,-.115,0],[-.095,-.010,.022],[-.045,.025,.020],[.006,.145,0]]);
  const strokeVertices = vertices.length / 3;
  // Uneven points radiate from a compact patch of hot metal. These triangles
  // share the scar draw and collapse to its centre after the contact flash.
  const hub = [-.11,-.015, -.035,-.080, .075,-.037, .064,.048, -.040,.087];
  const spikes = [[-.35,-.20],[.18,-.29],[.52,.10],[.19,.39],[-.42,.24]];
  for (let i=0; i<spikes.length; i++) {
    const j=(i+1)%spikes.length;
    const ax=hub[i*2], ay=hub[i*2+1], bx=hub[j*2], by=hub[j*2+1];
    vertices.push(0,0,0, ax,ay,0, bx,by,0, ax,ay,0, bx,by,0, ...spikes[i],0);
  }
  const shape = geometry(T, vertices);
  const tooth = new Float32Array(vertices.length / 3);
  tooth.fill(1,strokeVertices);
  shape.setAttribute('tooth',new T.BufferAttribute(tooth,1));
  const flash = new T.InstancedBufferAttribute(new Float32Array(capacity),1);
  flash.setUsage(T.DynamicDrawUsage);
  shape.setAttribute('contactPulse',flash);
  return shape;
}

// Faceted, broken slivers with a fresh, lighter fracture face.
function makeChip(T) {
  const coordinates = [], colors = [];
  const top = [[-.52,.36,-.27],[.28,.47,-.43],[.66,.23,.04],[.08,.30,.53],[-.64,.19,.22]];
  const bottom = top.map(([x,,z],i) => [x*.65+.09, -.24-(i%2)*.14, z*.70]);
  const triangle = (a,b,c,brightness) => {
    coordinates.push(...a,...b,...c);
    for (let j=0; j<3; j++) colors.push(brightness,brightness,brightness);
  };
  for (let i=0; i<top.length; i++) {
    const j=(i+1)%top.length;
    triangle([.04,.55,-.02],top[j],top[i],.98-i*.025);
    triangle(top[i],top[j],bottom[j],.72+(i%3)*.06);
    triangle(top[i],bottom[j],bottom[i],.61+(i%3)*.06);
    triangle([.08,-.46,.02],bottom[i],bottom[j],.56);
  }
  return geometry(T,coordinates,colors);
}

export function createImpactFx(T, scene) {
  const group = new T.Group(); group.name = 'weapon contacts'; scene.add(group);
  const up = new T.Vector3(0,1,0), normal = new T.Vector3(), right = new T.Vector3(), vertical = new T.Vector3();
  const along = new T.Vector3(), across = new T.Vector3(), tangent = new T.Vector3();
  const basis = new T.Matrix4(), transform = new T.Object3D(), tint = new T.Color();
  const axis = new T.Vector3(), localY = new T.Vector3(0,1,0);
  const stoneColors = [0x999c83, 0x858773, 0xb1aa8c, 0x706e60, 0x9a947d];
  let disposed = false, active = false;

  function instances(name, geo, material, capacity) {
    const mesh = new T.InstancedMesh(geo, material, capacity);
    mesh.name = name; mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.setColorAt(0, tint.set(0xffffff));
    mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    group.add(mesh);
    return mesh;
  }
  function pool(capacity, make) {
    return { slots: Array.from({length:capacity}, () => ({ age: -1, life: 0, ...make() })), next: 0 };
  }
  const sparkPool = pool(196, () => ({pos:new T.Vector3(),vel:new T.Vector3()}));
  const chipPool = pool(96, () => ({pos:new T.Vector3(),vel:new T.Vector3(),spin:new T.Vector3(),rot:new T.Vector3()}));
  const scarPool = pool(16, () => ({pos:new T.Vector3(),orientation:new T.Quaternion(),normal:new T.Vector3()}));
  const sparks = instances('hot mineral streaks',makeStreak(T),new T.MeshBasicMaterial({
    vertexColors:true,side:T.DoubleSide,toneMapped:false
  }),sparkPool.slots.length);
  const chips = instances('stone splinters',makeChip(T),new T.MeshStandardMaterial({
    roughness:.94,metalness:.06,vertexColors:true,flatShading:true,side:T.DoubleSide
  }),chipPool.slots.length);
  const scarGeometry = makeScar(T,scarPool.slots.length);
  const contactPulse = scarGeometry.getAttribute('contactPulse');
  function scarLayer(name, order) {
    const layer = instances(name,scarGeometry,new T.MeshBasicMaterial({
      side:T.DoubleSide,depthWrite:false,transparent:true,toneMapped:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-3
    }),scarPool.slots.length);
    layer.material.forceSinglePass = true;
    layer.material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float tooth;\nattribute float contactPulse;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xy *= mix(1.0, contactPulse, tooth);');
    };
    layer.renderOrder = order;
    return layer;
  }
  const seams = scarLayer('fractured contact edge',3), cores = scarLayer('incandescent cutting edge',4);

  function take(p) {
    const slot = p.slots[p.next]; p.next = (p.next + 1) % p.slots.length;
    slot.age = 0; return slot;
  }
  function hit(point, direction, kind='attack', comboIndex=0) {
    if (disposed) return;
    const style = kind === 'attack' ? [styles.forehand,styles.backhand,styles.finisher][comboIndex] || styles.forehand : styles[kind] || styles.forehand;
    normal.copy(direction).negate();
    if (normal.lengthSq()<.0001) normal.set(0,0,1);
    normal.normalize(); right.crossVectors(up,normal);
    if (right.lengthSq()<.0001) right.set(1,0,0);
    right.normalize(); vertical.crossVectors(normal,right).normalize();
    along.copy(right).multiplyScalar(style.arc[0]).addScaledVector(vertical,style.arc[1]).normalize();
    across.crossVectors(normal,along).normalize();
    const scar = take(scarPool);
    scar.pos.copy(point).addScaledVector(normal,.046); scar.normal.copy(normal);
    basis.makeBasis(along,across,normal); scar.orientation.setFromRotationMatrix(basis);
    scar.size = style.size; scar.life = kind === 'guard' ? .13 : .19;
    scar.flash = kind !== 'guard';
    scar.ink = style.ink; scar.hot = style.hot;

    for (let i=0;i<style.sparks;i++) {
      const s = take(sparkPool);
      const principal = i%4 !== 0;
      const a = principal ? sample(-.82,.82) : sample(1.65,4.65);
      tangent.copy(along).multiplyScalar(Math.cos(a)).addScaledVector(across,Math.sin(a));
      const speed = style.speed * (principal ? sample(.58,1.33) : sample(.32,.85));
      s.pos.copy(point).addScaledVector(normal,sample(.04,.12)).addScaledVector(tangent,sample(.015,.11));
      s.vel.copy(tangent).multiplyScalar(speed).addScaledVector(normal,sample(.32,2.7));
      s.life = sample(.105,.265) + (i%5===0 ? .08 : 0);
      s.width = kind==='guard' ? sample(.011,.023) : sample(.014,.030);
      s.length = speed * sample(.039,.088); s.color = choose(style.embers);
    }
    for (let i=0;i<style.chips;i++) {
      const c=take(chipPool);
      const fan=sample(-Math.PI,Math.PI), speed=sample(.65,2.75);
      c.pos.copy(point).addScaledVector(normal,sample(.025,.08));
      c.vel.copy(right).multiplyScalar(Math.cos(fan)*speed).addScaledVector(vertical,Math.sin(fan)*speed+.8)
        .addScaledVector(normal,sample(1.1,3.3)).addScaledVector(along,sample(.25,.95));
      if (kind==='quake') c.vel.y+=sample(1,2.1);
      c.rot.set(sample(-3,3),sample(-3,3),sample(-3,3));
      c.spin.set(sample(-10,10),sample(-12,12),sample(-9,9));
      c.size=sample(.055,.15)*(style===styles.finisher||kind==='quake'?1.27:1);
      c.life=sample(.27,.51); c.color=choose(stoneColors);
    }
    active=true;
  }

  function write(mesh,index,color) {
    transform.updateMatrix(); mesh.setMatrixAt(index,transform.matrix);
    mesh.setColorAt(index,tint.setHex(color));
  }
  function commit(mesh,count) {
    mesh.count=count;
    if (count) { mesh.instanceMatrix.needsUpdate=true; mesh.instanceColor.needsUpdate=true; }
  }
  function update(dt) {
    if (!active || disposed) return;
    let n=0;
    for (const s of sparkPool.slots) {
      if (s.age<0) continue;
      s.age+=dt;
      if (s.age>=s.life) { s.age=-1; continue; }
      const u=s.age/s.life, taper=Math.sqrt(1-u);
      s.pos.addScaledVector(s.vel,dt); s.vel.multiplyScalar(Math.exp(-2.4*dt)); s.vel.y-=5.3*dt;
      axis.copy(s.vel).normalize();
      transform.position.copy(s.pos); transform.quaternion.setFromUnitVectors(localY,axis);
      transform.scale.set(s.width*taper,s.length*(1-.75*u),s.width*taper);
      write(sparks,n++,s.color);
    }
    commit(sparks,n);
    n=0;
    for (const c of chipPool.slots) {
      if (c.age<0) continue;
      c.age+=dt;
      if (c.age>=c.life) { c.age=-1; continue; }
      const u=c.age/c.life;
      c.pos.addScaledVector(c.vel,dt); c.vel.y-=11*dt; c.rot.addScaledVector(c.spin,dt);
      transform.position.copy(c.pos); transform.rotation.set(c.rot.x,c.rot.y,c.rot.z);
      const size=c.size*(1-Math.max(0,(u-.57)/.43));
      transform.scale.set(size*1.17,size*.73,size);
      write(chips,n++,c.color);
    }
    commit(chips,n);
    n=0;
    for (const s of scarPool.slots) {
      if (s.age<0) continue;
      s.age+=dt;
      if (s.age>=s.life) { s.age=-1; continue; }
      const u=s.age/s.life, length=s.size*(.78+.22*Math.min(u*5,1))*(1-.24*u);
      const width=1-u*u;
      const flashAge=Math.min(1,s.age/.092);
      contactPulse.setX(n,s.flash ? (1-flashAge**3)*Math.min(1,.66+s.age/.014) : 0);
      transform.position.copy(s.pos).addScaledVector(s.normal,-.046*u);
      transform.quaternion.copy(s.orientation);
      transform.scale.set(length,1.48*s.size*width,1);
      write(seams,n,s.ink);
      transform.position.addScaledVector(s.normal,.003);
      transform.scale.set(length*(.89-.32*u),s.size*.9*width,1);
      write(cores,n,s.hot); n++;
    }
    if (n) contactPulse.needsUpdate=true;
    commit(seams,n); commit(cores,n);
    active=Boolean(sparks.count||chips.count||seams.count);
  }
  function reset() {
    for (const p of [sparkPool,chipPool,scarPool]) {
      for (const slot of p.slots) slot.age=-1;
      p.next=0;
    }
    group.children.forEach(mesh=>{mesh.count=0;});
    active=false;
  }
  function dispose() {
    if (disposed) return;
    reset(); disposed=true; scene.remove(group);
    for (const mesh of group.children) { mesh.dispose(); mesh.material.dispose(); }
    sparks.geometry.dispose(); chips.geometry.dispose(); scarGeometry.dispose();
  }
  return {hit,update,reset,dispose};
}
