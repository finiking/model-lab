/* The Solar Courier. Sculpted cross-sections, enamel colors, a cloth scarf and a pedal rig. */
window.buildRider = function buildRider(THREE) {
  const V = (x,y,z) => new THREE.Vector3(x,y,z);
  const group = new THREE.Group();
  group.name = "The Solar Courier";
  const plumage = new THREE.Group();
  const facePivot = new THREE.Group();
  const face = new THREE.Group();
  facePivot.position.set(.055,2.67,0);
  face.position.copy(facePivot.position).multiplyScalar(-1);
  facePivot.add(face);
  group.add(plumage,facePivot);
  const satin = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .87, metalness: .005, side:THREE.DoubleSide
  });
  // Local-space casein brushmarks stay attached while the maquette tumbles. At distance
  // derivative filtering quietly removes these strokes before they can shimmer.
  satin.onBeforeCompile = shader => {
    shader.vertexShader=shader.vertexShader.replace("#include <common>",
      "#include <common>\nvarying vec3 vCourierSurface;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvCourierSurface=position;");
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
      "#include <common>\nvarying vec3 vCourierSurface;")
      .replace("#include <color_fragment>",`#include <color_fragment>
      vec3 p=vCourierSurface;
      float filament=p.x*393.0+p.y*285.0+5.0*sin(p.x*12.0-p.y*8.0+p.z*7.0)+2.8*sin(p.y*19.0+p.x*6.0);
      float shown=1.0-smoothstep(.42,2.3,fwidth(filament));
      float chalk=(smoothstep(.58,.95,sin(filament))-.23)*shown;
      float pale=smoothstep(.46,.72,diffuseColor.g)*smoothstep(.58,.79,diffuseColor.r);
      float fleckMask=smoothstep(-.6,.75,sin(p.y*18.0+p.x*12.0)+.60*cos(p.x*22.0-p.z*19.0));
      diffuseColor.rgb*=1.0-.061*chalk*pale*fleckMask;
      float pouch=(1.0-smoothstep(.36,.59,diffuseColor.g))*smoothstep(.63,.88,diffuseColor.r)
        *smoothstep(.27,.40,p.x)*(1.0-smoothstep(2.675,2.74,p.y));
      float wrinkle=p.x*85.0+p.y*150.0+5.0*sin(p.x*4.3+p.y*7.0)+2.0*sin(p.z*9.0+p.x*12.0);
      float lines=(smoothstep(.48,.96,sin(wrinkle))-.28)*(1.0-smoothstep(.75,2.9,fwidth(wrinkle)));
      float leather=.035*sin(p.x*25.0+p.y*7.0)*sin(p.y*29.0-p.x*8.0)+.067*lines;
      diffuseColor.rgb*=1.0-pouch*leather;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.92,.80,.84),pouch*(1.0-smoothstep(2.38,2.60,p.y))*.62);
      `);
  };
  const palette = {
    bone:0xfff0cc, white:0xfff7de, straw:0xe6d8ad, shade:0xb6bda8,
    slate:0x4e686c, navy:0x233a46, ink:0x162c3a, red:0xcf372c, hot:0xf1583f,
    scarlet:0x9e2729, gold:0xf2ab42, pink:0xde7050, darkPink:0xb84f42,
    mint:0x80cbc5, teal:0x327e80, black:0x10232d
  };
  function mesh(parent, geometry, color){
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3) {
      colors[i]=rgb.r; colors[i+1]=rgb.g; colors[i+2]=rgb.b;
    }
    geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
    const o=new THREE.Mesh(geometry,satin);
    parent.add(o);
    return o;
  }
  function oval(parent, xyz, size, color, rotation=0){
    const o=mesh(parent,new THREE.SphereGeometry(1,18,12),color);
    o.position.set(...xyz); o.scale.set(...size); o.rotation.z=rotation;
    return o;
  }
  // Rings perpendicular to a curved centreline. The first radius lies in the profile plane.
  function quill(parent, knots, color, sides=14){
    const pos=[], idx=[];
    const centers=knots.map(k=>V(k[0],k[1],k[2]));
    for(let i=0;i<knots.length;i++){
      const tangent=centers[Math.min(i+1,centers.length-1)].clone().sub(centers[Math.max(0,i-1)]).normalize();
      const n=V(-tangent.y,tangent.x,0).normalize();
      if(n.lengthSq()<.01)n.set(0,1,0);
      const b=new THREE.Vector3().crossVectors(tangent,n).normalize();
      for(let j=0;j<sides;j++){
        const a=j*2*Math.PI/sides;
        const p=centers[i].clone().addScaledVector(n,Math.cos(a)*knots[i][3])
          .addScaledVector(b,Math.sin(a)*knots[i][4]);
        pos.push(p.x,p.y,p.z);
        if(i<knots.length-1){
          const u=i*sides+j,v=i*sides+(j+1)%sides;
          idx.push(u,v,u+sides,v,v+sides,u+sides);
        }
      }
    }
    const last=(knots.length-1)*sides;
    for(let j=1;j<sides-1;j++){idx.push(0,j+1,j,last,last+j,last+j+1);}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    geo.setIndex(idx);geo.computeVertexNormals();
    return mesh(parent,geo,color);
  }
  function smoothQuill(parent,knots,color,sides=26){
    const curve=new THREE.CatmullRomCurve3(knots.map(k=>V(k[0],k[1],k[2])));
    const radii=new THREE.CatmullRomCurve3(knots.map((k,i)=>V(k[3],k[4],i*.1)));
    const sampled=[];
    for(let i=0;i<=(knots.length-1)*4;i++){
      const f=i/((knots.length-1)*4),p=curve.getPoint(f),r=radii.getPoint(f);
      sampled.push([p.x,p.y,p.z,Math.max(.0007,r.x),Math.max(.0007,r.y)]);
    }
    return quill(parent,sampled,color,sides);
  }
  function stroke(parent, points, radius, color){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
    return mesh(parent,new THREE.TubeGeometry(curve,Math.max(5,points.length*2),radius,6,false),color);
  }
  function bake(parent){
    // Bake the rigid sculpt's painted details to one draw call per articulated piece.
    parent.updateWorldMatrix(true,true);
    const worldToLocal=parent.matrixWorld.clone().invert(), verts=[], normals=[], colors=[];
    for(const part of [...parent.children]){
      if(!part.isMesh)continue;
      const mat=new THREE.Matrix4().multiplyMatrices(worldToLocal,part.matrixWorld);
      const g=part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      g.applyMatrix4(mat);
      for(const [attr,target] of [["position",verts],["normal",normals],["color",colors]]){
        const array=g.getAttribute(attr).array;
        for(let i=0;i<array.length;i++)target.push(array[i]);
      }
      parent.remove(part); part.geometry.dispose();g.dispose();
    }
    if(!verts.length)return;
    const g=new THREE.BufferGeometry();
    for(const [a,v] of [["position",verts],["normal",normals],["color",colors]])
      g.setAttribute(a,new THREE.Float32BufferAttribute(v,3));
    g.computeBoundingSphere();
    const joined=new THREE.Mesh(g,satin);
    joined.castShadow=true; joined.receiveShadow=true;parent.add(joined);
  }
  // A single smooth surface from the saddle to the nape. Horizontal contour rings
  // carry the deep hull of the chest through the S-bend with no intersecting barrels.
  (function makeBreastAndNeck(){
    const sections=[
      [1.568,-.47,.025,.04],[1.605,-.47,.23,.226],[1.67,-.47,.367,.306],
      [1.78,-.49,.467,.365],[1.895,-.492,.525,.390],[1.99,-.465,.529,.375],
      [2.067,-.407,.463,.326],[2.126,-.337,.403,.282],[2.187,-.252,.330,.23],
      [2.247,-.171,.260,.187],[2.305,-.107,.191,.159],[2.395,-.095,.148,.135],
      [2.487,-.089,.143,.132],[2.573,-.063,.151,.140],[2.65,-.016,.158,.15],
      [2.72,.032,.155,.158],[2.778,.073,.143,.148],[2.816,.105,.121,.130],
      [2.855,.126,.08,.089],[2.879,.133,.012,.02]];
    const pos=[],idx=[],colors=[],sides=38,rows=(sections.length-1)*3;
    const cream=new THREE.Color(palette.bone),white=new THREE.Color(palette.white),umber=new THREE.Color(0xd9cbab);
    const current=new THREE.Color();
    for(let row=0;row<=rows;row++){
      const j=Math.min(Math.floor(row/3),sections.length-2),u=(row-j*3)/3;
      const a=sections[Math.max(j-1,0)],b=sections[j],c=sections[j+1],d=sections[Math.min(j+2,sections.length-1)];
      const interpolate=k=>.5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u*u+(-a[k]+3*b[k]-3*c[k]+d[k])*u*u*u);
      const y=interpolate(0),center=interpolate(1),radius=interpolate(2),width=interpolate(3);
      for(let j2=0;j2<sides;j2++){
        const theta=j2*2*Math.PI/sides,co=Math.cos(theta),si=Math.sin(theta);
        pos.push(center+radius*co,y,width*si);
        current.copy(cream).lerp(white,THREE.MathUtils.smoothstep(y,1.91,2.61)*.94)
          .lerp(umber,(1-THREE.MathUtils.smoothstep(y,1.56,1.90))*.19);
        colors.push(current.r,current.g,current.b);
        const u0=row*sides+j2,u1=row*sides+(j2+1)%sides;
        if(row<rows)idx.push(u0,u0+sides,u1,u1,u0+sides,u1+sides);
      }
    }
    const g=new THREE.BufferGeometry();g.setIndex(idx);g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();plumage.add(new THREE.Mesh(g,satin));
  })();
  for(const s of [-1,1]){
    // Dark tail primaries below pale overlapping coverts. Paint continues around both sides.
    for(let i=0;i<4;i++){
      const z=s*(.028+i*.073), k=i*.035;
      quill(plumage,[[-.52,1.85+k,z,.085,.055],[-.73,1.86+k,z+s*.021,.079,.055],
        [-.99,1.88+k,z+s*.025,.053,.032],[-1.20+k*.9,1.92+k,z+s*.004,.005,.008]],
        [palette.ink,palette.navy,palette.slate,palette.shade][i],13);
    }
    for(let i=0;i<3;i++){
      quill(plumage,[[-.29-i*.125,2.10-i*.025,s*(.26+i*.011),.064,.045],
        [-.52-i*.08,2.04-i*.026,s*(.345-i*.012),.078,.048],
        [-.88-i*.09,1.98+i*.037,s*(.23-i*.03),.012,.012]],
        [palette.straw,palette.bone,palette.white][i],12);
    }
    // A bent steering wing; dark primaries fan under the pale secondaries toward the grip.
    quill(plumage,[[-.61,2.08,s*.16,.08,.12],[-.47,2.105,s*.275,.160,.151],
      [-.265,2.075,s*.373,.183,.113],[-.055,1.986,s*.392,.137,.08],
      [.17,1.893,s*.352,.103,.06],[.35,1.795,s*.292,.072,.043],
      [.51,1.728,s*.236,.042,.03],[.62,1.685,s*.226,.013,.017]],
      palette.straw,18);
    for(let i=0;i<5;i++){
      const h=i*.024;
      quill(plumage,[[-.199+i*.025,1.995+h,s*(.356+i*.004),.057,.045],
        [.085,1.892+h,s*(.385+i*.002),.064,.043],
        [.325,1.781+h*.65,s*(.34-i*.004),.052,.04],
        [.518+i*.014,1.693+h*.37,s*(.277-i*.012),.036,.032],
        [.618+i*.012,1.645+h*.17,s*(.26-i*.012),.012,.013]],
        [palette.ink,palette.navy,palette.slate,palette.shade,palette.bone][i],12);
    }
    // Three scalloped coverts communicate feather direction even in a tight tracking shot.
    for(let i=0;i<4;i++){
      const x=-.45+i*.095;
      quill(plumage,[[x,2.104+i*.006,s*.386,.057,.035],
        [x+.10,2.058+i*.002,s*(.436-i*.005),.063,.027],
        [x+.208,1.987-i*.005,s*(.419-i*.003),.028,.016],
        [x+.25,1.973-i*.007,s*(.401-i*.004),.005,.007]],
        i%2?palette.bone:palette.white,12);
    }
  }
  // Enamel feather inlays are raised just above the near and far faces of the wing.
  // Each tapers into a separate primary instead of reading as a single solid arm.
  for(const s of [-1,1]){
    const fan=[
      [[-.17,2.008,.464,.038],[.01,1.940,.448,.046],[.218,1.846,.392,.041],[.413,1.753,.329,.028],[.602,1.669,.268,.004],palette.navy],
      [[-.185,2.047,.468,.028],[-.012,1.993,.47,.036],[.206,1.893,.417,.037],[.405,1.792,.352,.023],[.623,1.681,.267,.003],palette.slate],
      [[-.23,2.095,.465,.025],[-.046,2.045,.495,.031],[.169,1.944,.434,.034],[.351,1.844,.379,.022],[.548,1.730,.302,.003],0x98aaa0],
      [[-.32,2.132,.461,.024],[-.137,2.113,.490,.035],[.054,2.027,.469,.033],[.235,1.926,.422,.022],[.391,1.824,.361,.002],palette.bone]
    ];
    for(const [a,b,c,d,e,color] of fan){
      quill(plumage,[a,b,c,d,e].map(v=>[v[0],v[1],v[2]*s,v[3],Math.max(.003,v[3]*.37)]),color,12);
    }
    // Three shoulder coverts make an overlapping scalloped edge, with pale shafts.
    for(let i=0;i<3;i++){
      const x=-.46+i*.078,y=2.15-i*.009,z=.417+i*.018;
      quill(plumage,[[x,y,s*z,.026,.018],[x+.083,y-.012,s*(z+.044),.037,.019],
        [x+.17,y-.074,s*(z+.052),.029,.013],[x+.225,y-.127,s*(z+.043),.003,.003]],
        [0xe0d4ad,0xf5e7c0,0xfff9da][i],12);
    }
    // Nape and breast carry tiny green-grey pendant markings from the captain's livery.
    for(let i=0;i<3;i++){
      const y=2.51+i*.044,x=-.115+i*.018,z=.133+i*.007;
      quill(plumage,[[x-.014,y-.035,z*s,.001,.002],[x,y-.012,(z+.006)*s,.009,.004],
        [x+.021,y+.023,z*s,.006,.003],[x+.024,y+.036,(z-.004)*s,.001,.001]],
        0xb9c7b2,9);
    }
  }
  // The gular sac and mandibles use different convex upper/lower profiles at each station.
  function bill(sections,color){
    const pos=[], idx=[], count=22;
    for(let i=0;i<sections.length;i++){
      const [x,high,low,width,mid]=sections[i];
      for(let j=0;j<count;j++){
        const a=2*Math.PI*j/count, c=Math.cos(a), h=c>=0?(high-mid):(mid-low);
        pos.push(x,mid+c*h,Math.sin(a)*width);
        if(i<sections.length-1){const u=i*count+j,v=i*count+(j+1)%count;
          idx.push(u,v,u+count,v,v+count,u+count);}
      }
    }
    const last=(sections.length-1)*count;
    for(let j=1;j<count-1;j++){idx.push(0,j+1,j,last,last+j,last+j+1);}
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    g.setIndex(idx);g.computeVertexNormals();mesh(face,g,color);
  }
  const skull=smoothQuill(face,[[-.09,2.725,0,.095,.095],[-.04,2.78,0,.149,.14],
    [.075,2.831,0,.171,.164],[.196,2.834,0,.153,.163],
    [.292,2.797,0,.102,.139],[.37,2.758,0,.053,.08]],palette.white,24);
  // Tuft cut with three pointed blades, visible from below and in silhouette.
  for(const s of [-1,0,1]){
    quill(face,[[.065,2.88,s*.045,.052,.044],[-.07,2.85,s*.057,.063,.039],
      [-.18,2.80+s*.018,s*.066,.015,.012],[-.226,2.783+s*.022,s*.053,.002,.003]],
      s===0?palette.white:palette.straw,12);
  }
  bill([[.195,2.755,2.64,.07,2.704],[.28,2.786,2.49,.135,2.685],
    [.42,2.775,2.385,.172,2.662],[.59,2.760,2.35,.183,2.64],
    [.80,2.743,2.386,.181,2.632],[1.0,2.725,2.447,.153,2.627],
    [1.23,2.70,2.515,.11,2.62],[1.411,2.675,2.571,.064,2.615],[1.51,2.65,2.615,.018,2.637]],
    0xf38a4d);
  bill([[.245,2.791,2.718,.091,2.746],[.32,2.809,2.72,.14,2.748],
    [.44,2.813,2.718,.172,2.747],[.64,2.793,2.707,.178,2.736],
    [.86,2.769,2.69,.164,2.717],[1.10,2.745,2.673,.132,2.70],
    [1.33,2.717,2.651,.084,2.677],[1.48,2.692,2.635,.044,2.656],
    [1.545,2.661,2.607,.024,2.632],[1.557,2.63,2.581,.013,2.604],[1.539,2.599,2.578,.004,2.59]],
    0xffc054);
  for(const s of [-1,1]){
    stroke(face,[[.33,2.739,s*.142],[.48,2.737,s*.175],[.74,2.719,s*.17],
      [1.02,2.692,s*.143],[1.28,2.669,s*.094],[1.475,2.65,s*.041],[1.54,2.626,s*.022]],
      .010,0x965443);

  }
  // Project the pigments onto the skull. The orbital mask is paint on a broad
  // teardrop of bare skin rather than a separate rounded piece sitting on the face.
  const scalp=skull.clone();scalp.position.set(0,0,0);scalp.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  function cheekPoint(x,y,s,lift=.0009){
    ray.set(V(x,y,s*.55),V(0,0,-s));
    const hit=ray.intersectObject(scalp,false)[0];
    return [x,y,(hit?hit.point.z:s*.135)+s*lift];
  }
  function faceMark(s,contour,color,lift){
    const center=contour.reduce((c,v)=>[c[0]+v[0]/contour.length,c[1]+v[1]/contour.length],[0,0]);
    const pos=[],idx=[];
    const outline=new THREE.CatmullRomCurve3(contour.map(([x,y])=>V(x,y,0)),true);
    contour=outline.getPoints(contour.length*4).slice(0,-1).map(p=>[p.x,p.y]);
    const steps=11,len=contour.length;
    for(let i=0;i<=steps;i++)for(let j=0;j<len;j++){
      const amt=i/steps,pt=contour[j];
      pos.push(...cheekPoint(center[0]+(pt[0]-center[0])*amt,center[1]+(pt[1]-center[1])*amt,s,lift));
      if(i<steps){const a=i*len+j,b=i*len+(j+1)%len;
        if(s>0)idx.push(a,a+len,b,b,a+len,b+len);else idx.push(a,b,a+len,b,b+len,a+len);}
    }
    const geo=new THREE.BufferGeometry();geo.setIndex(idx);geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    geo.computeVertexNormals();mesh(face,geo,color);
  }
  for(const s of [-1,1]){
    faceMark(s,[[.104,2.875],[.145,2.890],[.193,2.890],[.230,2.881],[.260,2.865],[.283,2.842],
      [.300,2.814],[.272,2.808],[.237,2.817],[.203,2.820],[.165,2.826],[.146,2.846],[.135,2.863]],0xbba47c,.0021);
    faceMark(s,[[.125,2.873],[.164,2.886],[.200,2.882],[.234,2.869],[.258,2.849],[.267,2.834],
      [.250,2.827],[.218,2.831],[.192,2.834],[.161,2.844],[.150,2.859]],0x8a9f8d,.0045);
  }
  // Shallow flush ridges follow the measured surface of the flexible throat skin.
  const bagRows=[[.28,2.685,2.49,.135],[.42,2.662,2.385,.172],[.59,2.64,2.35,.183],[.80,2.632,2.386,.181],[1.0,2.627,2.447,.153],[1.23,2.62,2.515,.11],[1.411,2.615,2.571,.064]];
  function bagSurface(x,f,s){
    let i=0;
    while(i<bagRows.length-2&&bagRows[i+1][0]<x)i++;
    const a=bagRows[i],b=bagRows[i+1],u=(x-a[0])/(b[0]-a[0]);
    const v=j=>a[j]+(b[j]-a[j])*u;
    return [x,v(1)-f*(v(1)-v(2)),s*(v(3)*Math.sqrt(1-f*f)+.002)];
  }
  for(const s of [-1,1]){
    for(let j=0;j<4;j++){
      const start=.335+.083*j,end=.66+.164*j,knots=[];
      for(let k=0;k<=10;k++){
        const u=k/10, f=.15+.59*Math.sin(u*Math.PI*.67);
        const point=bagSurface(start+(end-start)*u,f,s),r=.001+.004*Math.sin(Math.PI*u);
        knots.push([...point,r,r*.65]);
      }
      quill(face,knots,j===3?0xf4a766:0xdb7848,8);
    }
  }
  const eyes=[];
  for(const s of [-1,1]){
    const eye=new THREE.Group();
    const eyeCenter=cheekPoint(.205,2.851,s,.0059);
    eye.position.set(...eyeCenter);
    face.add(eye);
    const ex=.205,ey=2.851;
    function eyeDepth(x,y){
      const z=cheekPoint(ex+x,ey+y,s,.0058)[2]-eyeCenter[2];
      const r=Math.min(1,(x*x)/(.039*.039)+(y*y)/(.023*.023));
      return z+s*(.0065*(1-r));
    }
    function paintEyeLayer(rx,ry,cx,cy,almond,colorFor,lift){
      const edges=92,rings=26,v=[],col=[],idx=[];
      for(let i=0;i<=rings;i++)for(let j=0;j<edges;j++){
        const f=i/rings,angle=j*2*Math.PI/edges,co=Math.cos(angle),sn=Math.sin(angle);
        const x=cx+rx*f*co;
        const y=cy+ry*f*sn*(almond?(.68+.32*Math.abs(sn)):1)-(almond?x*.12:0);
        v.push(x,y,eyeDepth(x,y)+s*lift);
        const rgb=colorFor(f,angle,x,y);
        col.push(rgb.r,rgb.g,rgb.b);
        if(i<rings){
          const a=i*edges+j,b=i*edges+(j+1)%edges;
          if(s>0)idx.push(a,a+edges,b,b,a+edges,b+edges);
          else idx.push(a,b,a+edges,b,b+edges,a+edges);
        }
      }
      const g=new THREE.BufferGeometry();g.setIndex(idx);g.setAttribute("position",new THREE.Float32BufferAttribute(v,3));
      g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
      eye.add(new THREE.Mesh(g,satin));
    }
    const scleraHi=new THREE.Color(0xf1ce91),scleraLo=new THREE.Color(0xb29665);
    paintEyeLayer(.037,.022,0,0,true,(f,a,x,y)=>scleraHi.clone().lerp(scleraLo,.10+.65*f*f+.11*Math.max(0,y/.021)),.0007);
    const amber=new THREE.Color(0xc09955),jade=new THREE.Color(0x6d8971),limbus=new THREE.Color(0x354d44),pupil=new THREE.Color(0x1e2d29);
    paintEyeLayer(.0178,.0175,.003,-.0005,false,(r,theta)=>{
      const fibers=.48+.26*Math.sin(44*theta+3.1*r+1.6*Math.sin(3*theta))+.17*Math.sin(71*theta-4*r)+.08*Math.cos(102*theta+r);
      const c=jade.clone().lerp(amber,.2+.76*fibers*(1-.47*r));
      c.lerp(limbus,THREE.MathUtils.smoothstep(r,.82,.995)*.95);
      c.lerp(pupil,1-THREE.MathUtils.smoothstep(r,.53,.58));
      return c;
    },.0012);
    const crescent=new THREE.Shape();
    crescent.moveTo(-.0024,.0107);
    crescent.bezierCurveTo(-.0059,.0069,-.0046,.0019,-.0014,-.0001);
    crescent.bezierCurveTo(.0007,-.00155,.00355,-.0017,.0061,-.00043);
    crescent.bezierCurveTo(.0018,.00042,-.0025,.0044,-.0024,.0107);
    const solarGeometry=new THREE.ShapeGeometry(crescent,18);
    const positions=solarGeometry.attributes.position;
    for(let j=0;j<positions.count;j++){
      const x=positions.getX(j),y=positions.getY(j);
      positions.setZ(j,eyeDepth(x,y)+s*.0018);
    }
    solarGeometry.computeVertexNormals();mesh(eye,solarGeometry,0xffcf67);
    oval(eye,[.0105,.005,eyeDepth(.0105,.005)+s*.0018],[.0017,.0017,.0005],0xfff3d8);
    bake(eye);eyes.push(eye);
    const brow=[[.155,2.873],[.169,2.876],[.193,2.876],[.220,2.869],[.243,2.861]];
    smoothQuill(face,brow.map((p,i)=>[...cheekPoint(...p,s,.006),[.0008,.0025,.004,.0026,.0007][i],.0025]),0x70624a,14);
    const lower=[[.174,2.838],[.191,2.830],[.212,2.830],[.227,2.834]];
    smoothQuill(face,lower.map((p,i)=>[...cheekPoint(...p,s,.0056),i===1||i===2?.003:.001,.002]),0x947d5f,9);
  }
  // A fitted leather aviator racing cap with a sewn cream centre panel and crimson visor.
  smoothQuill(face,[[-.092,2.915,0,.028,.048],[-.055,2.933,0,.073,.122],
    [.014,2.946,0,.085,.161],[.10,2.946,0,.080,.167],
    [.185,2.926,0,.061,.157],[.243,2.911,0,.031,.124]],palette.red,24);
  smoothQuill(face,[[-.072,2.959,0,.011,.030],[.009,3.012,0,.011,.035],
    [.093,3.016,0,.011,.036],[.167,2.991,0,.009,.030],[.224,2.949,0,.006,.026]],
    0xffda8b,14);
  smoothQuill(face,[[.077,2.916,0,.016,.129],[.2,2.914,0,.020,.164],
    [.302,2.927,0,.015,.126],[.365,2.947,0,.012,.064],[.382,2.955,0,.004,.016]],
    palette.hot,18);
  for(const s of [-1,1]){
    stroke(face,[[-.055,2.928,s*.126],[.027,2.912,s*.162],[.142,2.904,s*.157],[.227,2.907,s*.13]],.010,palette.scarlet);
  }
  // Gold saddle stitching follows the handmade leather panel join.
  for(const s of [-1,1]){
    const seam=[[-.055,2.944,.113],[-.018,2.981,.121],[.055,2.992,.122],[.127,2.978,.119],[.183,2.948,.121]];
    const curve=new THREE.CatmullRomCurve3(seam.map(([x,y,z])=>V(x,y,s*z)));
    for(let i=0;i<12;i++){
      const a=curve.getPoint(i/12),b=curve.getPoint((i+.51)/12),m=a.clone().lerp(b,.5);
      quill(face,[[a.x,a.y,a.z,.0014,.0014],[m.x,m.y,m.z,.0021,.0021],[b.x,b.y,b.z,.0013,.0013]],0xedba80,8);
    }
  }
  // Two crossed folds anchor the silk to the lower neck.
  oval(plumage,[-.083,2.344,0],[.178,.075,.175],palette.red,.29);
  oval(plumage,[-.202,2.346,.015],[.079,.061,.122],palette.hot,-.37);
  const ribbons=[];
  for(let layer=0;layer<2;layer++){
    const steps=28,cols=5,positions=new Float32Array((steps+1)*cols*3), colors=[],index=[];
    const c=new THREE.Color();
    for(let i=0;i<=steps;i++)for(let j=0;j<cols;j++){
      const f=i/steps;
      c.setHex(f>.82&&f<.88&&layer===0?0xffd27c:(layer===0?(j===0?0xb92c2e:0xf04f39):(j===0?0xa82d33:0xc63733)));
      colors.push(c.r,c.g,c.b);
      if(i<steps&&j<cols-1){const k=i*cols+j;index.push(k,k+1,k+cols,k+1,k+cols+1,k+cols);}
    }
    const g=new THREE.BufferGeometry();g.setIndex(index);
    g.setAttribute("position",new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    const cloth=new THREE.Mesh(g,satin);cloth.frustumCulled=false;plumage.add(cloth);
    ribbons.push({cloth,g,steps,cols,positions,layer});
  }
  // Keep dynamic silk separate while consolidating the rest of the body.
  for(const r of ribbons)plumage.remove(r.cloth);
  bake(plumage);bake(face);
  for(const r of ribbons)plumage.add(r.cloth);

  const legs=[];
  for(const s of [1,-1]){
    const thigh=new THREE.Group(),shin=new THREE.Group(),foot=new THREE.Group();
    const upper=.645, lower=.693;
    // Each limb is authored down positive local Y, with IK rotating it at each frame.
    quill(thigh,[[0,0,0,.086,.082],[.01,.12,0,.09,.079],[.013,.23,0,.070,.06],
      [.005,.34,0,.044,.041],[0,upper*.78,0,.033,.030],[0,upper,0,.039,.036]],0xdb9867,14);
    quill(thigh,[[.008,-.012,0,.079,.09],[.007,.06,0,.104,.094],[.008,.15,0,.094,.083],
      [.004,.236,0,.067,.061],[0,.292,0,.036,.044],[0,.321,0,.010,.018]],
      s>0?palette.bone:palette.straw,14);
    quill(shin,[[0,-.018,0,.03,.028],[0,.014,0,.041,.04],[.002,.11,0,.034,.031],
      [0,lower*.76,0,.025,.026],[0,lower*.95,0,.033,.031],[0,lower,0,.034,.032]],0xe8a566,14);
    for(const f of [.17,.23,.76,.82,.90]){
      oval(shin,[0,lower*f,.001],[f<.3?.034:.028,.009,.030],0xbd8158);
    }
    // Pedal contact is beneath the metatarsal pad. Four toes are interlinked by a thick,
    // scalloped membrane with an ochre dorsal face. Feet are mirrored across the bike.
    quill(foot,[[-.126,.072,0,.026,.029],[-.094,.054,0,.034,.037],
      [-.052,.030,0,.033,.046],[.005,.020,0,.019,.066],
      [.062,.019,0,.015,.067],[.128,.014,0,.006,.009]],0xeaa45e,15);
    for(let j=0;j<4;j++){
      const z=s*[-.068,-.025,.022,.070][j],length=[.090,.131,.145,.10][j];
      quill(foot,[[-.07,.043,.0,.025,.02],[-.018,.033,z*.42,.022,.027],
        [.047,.024,z*.8,.014,.020],[length,.018,z,.006,.009],[length+.012,.013,z,.002,.003]],
        j%2?0xeab06a:0xd58c55,10);
    }
    bake(thigh);bake(shin);bake(foot);group.add(thigh,shin,foot);
    legs.push({s,thigh,shin,foot,upper,lower});
  }
  const axis=V(0,1,0), tmp=new THREE.Vector3();
  function span(object,start,end){object.position.copy(start);object.quaternion.setFromUnitVectors(axis,tmp.subVectors(end,start).normalize());}
  function update(t,phase){
    const beat=Math.sin(phase-.32);
    const rock=.014*beat+.007*Math.sin(phase*2+.8);
    // The body rocks around the midpoint between the grips.
    plumage.rotation.z=rock;
    const cos=Math.cos(rock),sin=Math.sin(rock);
    const gripX=.65, gripY=1.66;
    const bx=gripX-cos*gripX+sin*gripY,by=gripY-sin*gripX-cos*gripY;
    plumage.position.set(bx,by,0);
    facePivot.position.set(bx+cos*.055-sin*2.67,by+sin*.055+cos*2.67,0);
    facePivot.rotation.z=rock+.017*Math.sin(phase*.5-.9)+.012*Math.cos(phase-.4);
    const blinkCycle=((t+1.13)%3.85+3.85)%3.85;
    const open=1-.94*Math.exp(-Math.pow((blinkCycle-2.62)/.065,2));
    eyes.forEach(e=>e.scale.y=open);
    for(const {s,thigh,shin,foot,upper,lower} of legs){
      const a=phase+(s<0?Math.PI:0),px=.265*Math.cos(a),py=.65+.265*Math.sin(a);
      const tilt=.074*Math.cos(a-.50);
      const hip=V(bx+cos*(-.365)-sin*1.68,by+sin*(-.365)+cos*1.68,s*.238);
      const ankle=V(px-.118*Math.cos(tilt)-.070*Math.sin(tilt),py-.118*Math.sin(tilt)+.070*Math.cos(tilt),s*.285);
      const d=ankle.clone().sub(hip),dist=d.length();d.divideScalar(dist);
      const mid=(upper*upper-lower*lower+dist*dist)/(2*dist);
      const offset=Math.sqrt(Math.max(0,upper*upper-mid*mid));
      const bend=V(d.y,-d.x,0).normalize();
      const hock=hip.clone().addScaledVector(d,mid).addScaledVector(bend,offset);
      span(thigh,hip,hock);span(shin,hock,ankle);
      foot.position.set(px,py,s*.285);foot.rotation.z=tilt;
    }
    for(const {g,steps,cols,positions,layer} of ribbons){
      for(let i=0;i<=steps;i++)for(let j=0;j<cols;j++){
        const u=i/steps,row=(j/(cols-1)-.5)*2,crest=Math.sin(u*9.3-t*8.1+layer*.7);
        const width=(layer?.05:.061)*(.66+.5*Math.sin(Math.PI*u))*(1-.65*Math.max(0,(u-.83)/.17));
        const wave=u*(.068*crest+.035*Math.sin(u*17.2-t*10.2+1.1*layer));
        const k=(i*cols+j)*3;
        positions[k]=-.205-u*(layer?.82:1.04)+(u>.85?.055*Math.pow((u-.85)/.15,2)*Math.abs(row):0);
        positions[k+1]=2.351+(layer?-.10:.10)*u+wave+row*width;
        positions[k+2]=(layer?-.026:.048)+(layer?.11:-.05)*u+.038*crest*u+width*.59*(1-row*row);
      }
      g.attributes.position.needsUpdate=true;g.computeVertexNormals();
    }
  }
  update(0,0);
  return {group,update,nearEye:eyes[1]};
};
