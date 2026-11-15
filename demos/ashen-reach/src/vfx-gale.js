// A flying, split brushstroke. Positions use a 3.8 m impact radius and -Z forward.
// Each stroke has its own irregular width, launch point, travel and dissolution.
const life=.57;
const clamp=(a,min,max)=>Math.min(max,Math.max(min,a));
const cubic=(a,b,c,d,t)=>{
  const r=1-t;
  return r*r*r*a+3*r*r*t*b+3*r*t*t*c+t*t*t*d;
};

function makeStrokes(T){
  const vertices=[],destination=[],uv=[],ink=[],indices=[];
  function stroke(curve,width,style,delay,end,seed,tilt=.78){
    const segments=48, rows=4, offset=vertices.length/3;
    for(let i=0;i<=segments;i++){
      const u=i/segments;
      const point=[0,1,2].map(k=>cubic(curve[0][k],curve[1][k],curve[2][k],curve[3][k],u));
      const profile=Math.pow(Math.sin(Math.PI*u),.61+.22*seed)*(1.16-.42*u);
      const rib=1+.11*Math.sin(u*15+seed*6)+.055*Math.sin(u*37+seed*4);
      for(let j=0;j<=rows;j++){
        const v=j/rows, edge=v-.5;
        const y=point[1]+edge*width*profile*rib;
        const z=point[2]-edge*width*profile*tilt+Math.sin(v*Math.PI)*width*profile*.10;
        // At the instant of contact the wind peels off beside the right wrist.
        // Rear wakes start outboard, so nothing luminous spawns inside the body.
        const front=style<2.5;
        const x0=front?point[0]*.22+.16:point[0]*.48;
        const y0=front?1.37+(y-1.37)*.56:y*.78+.16;
        const z0=front?z*.23-.57:z*.45;
        vertices.push(x0,y0,z0);destination.push(point[0],y,z);
        uv.push(u,v);ink.push(style,delay,end,seed);
        if(i<segments && j<rows){
          const a=offset+i*(rows+1)+j,b=a+rows+1;
          indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
  }
  // The backlit face, cleft upper tongue, and thin pressure edge share an origin,
  // but end at different heights and depths. This keeps the outline forked.
  stroke([[2.85,.48,-.94],[2.05,.45,-3.65],[-.25,1.32,-4.0],[-3.02,2.01,-2.37]],.85,0,0,.97,.24,.86);
  stroke([[.91,.90,-2.98],[-.29,1.31,-3.48],[-1.57,1.88,-3.00],[-2.64,2.57,-1.78]],.36,1,.022,.95,.53,.68);
  stroke([[2.64,.53,-1.15],[1.61,.71,-3.43],[-.67,1.57,-3.78],[-2.79,2.06,-2.44]],.057,2,.004,.87,.36,.70);
  stroke([[2.38,.56,-.62],[2.28,.61,-2.11],[1.54,.80,-2.96],[.89,.97,-3.12]],.11,1,.053,.78,.41,.74);
  stroke([[-.40,.82,-3.25],[-1.12,1.00,-3.22],[-2.22,1.37,-2.61],[-3.26,1.74,-1.52]],.19,1,.064,1,.80,.94);
  stroke([[-1.35,1.47,-3.15],[-2.03,1.65,-3.00],[-2.49,1.83,-2.72],[-3.14,1.97,-2.33]],.054,2,.091,.90,.73,.58);
  // A short-lived close slash overlaps the true sword reach before the airborne
  // bow travels on. Splinters split off the accelerating left tip.
  stroke([[.95,.92,-.85],[.44,1.18,-1.72],[-.20,1.48,-1.83],[-1.05,1.72,-1.30]],.28,1,0,.36,.22,.62);
  stroke([[.60,1.10,-1.08],[.11,1.27,-1.67],[-.37,1.61,-1.74],[-.69,1.96,-1.45]],.13,2,0,.30,.74,.68);
  stroke([[-.88,1.42,-3.47],[-1.46,1.61,-3.54],[-2.02,1.93,-3.33],[-2.30,2.23,-3.02]],.10,1,.080,.80,.34,.65);
  // Three discontinuous return eddies mark the area behind and beside the cut.
  // Their disconnected pointed tails leave the ground and target readable.
  stroke([[-2.85,1.38,-1.42],[-3.20,1.06,-.48],[-3.12,.52,-.21],[-2.64,.34,.29]],.23,3,.047,.82,.16,1.15);
  stroke([[1.59,.24,2.08],[2.12,.32,1.72],[2.68,.62,1.62],[2.82,1.35,.97]],.20,3,.056,.82,.63,1.06);
  stroke([[-1.85,.19,2.08],[-1.62,.23,2.43],[-1.20,.53,2.58],[-1.33,1.20,2.50]],.13,3,.097,.89,.87,.91);
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setAttribute('destination',new T.Float32BufferAttribute(destination,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setAttribute('ink',new T.Float32BufferAttribute(ink,4));geo.setIndex(indices);
  geo.boundingSphere=new T.Sphere(new T.Vector3(0,1,0),5.3);
  return geo;
}

const windVertex=`
attribute vec3 destination;
attribute vec4 ink;
uniform float beat;
varying vec2 tex;
varying vec4 brush;
void main(){
  tex=uv;brush=ink;
  float age=clamp((beat-ink.y)/(ink.z-ink.y),0.,1.);
  float travel=1.-pow(1.-age,2.35);
  vec3 p=mix(position,destination,travel);
  // Light shear gives the spliced tips different rates of lift and drift.
  float shear=sin(uv.x*8.+ink.w*8.+age*3.9);
  p.y+=sin(age*3.14159)*(.075+.085*shear);
  p.x-=sin(age*3.14159)*uv.x*.16;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const windFragment=`
uniform float beat;
varying vec2 tex;
varying vec4 brush;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
void main(){
  float a=(beat-brush.y)/(brush.z-brush.y);
  if(a<=0.||a>=1.)discard;
  float u=tex.x,v=tex.y,seed=brush.w;
  float n=noise2(vec2(u*11.-a*4.,seed*19.));
  float small=noise2(vec2(u*45.-a*10.,v*10.+seed*8.));
  float crest=.83+.041*sin(u*17.+seed*3.)+.025*(n-.5);
  float rise=smoothstep(0.,.075,a);
  float open=smoothstep(-.13,.08,(a*6.5+.05)-u);
  float fade=1.-smoothstep(.37,1.,a);
  // The tail separates into narrow threads; holes erode *through* the inner
  // sheet rather than fading the entire mesh into a transparent crescent.
  float w=v+.085*sin(u*8.2+seed*6.)+.054*(n-.5);
  float lanes=.5+.5*sin(w*48.+5.2*n-a*11.);
  float tear=noise2(vec2(u*8.-a*2.4,w*17.+seed*12.))*.73+lanes*.27;
  float holes=smoothstep(.20+.46*a,.43+.46*a,tear);
  float edge=smoothstep(.025,.16,v)*(1.-smoothstep(.91,1.,v));
  float endMask=smoothstep(0.,.041,u)*(1.-smoothstep(.958,1.,u));
  float pressure=exp(-pow((v-crest)/.115,2.));
  float thread=exp(-pow((v-(.35+.10*sin(u*9.)))/.038,2.));
  vec3 deep=vec3(.006,.132,.18),jade=vec3(.015,.53,.50);
  vec3 pearl=vec3(.73,1.0,.92);
  vec3 c=mix(deep,jade,smoothstep(.10,.75,v)*(.78+.22*n));
  c=mix(c,pearl,pressure*(.89+.11*n));
  c+=vec3(.12,.18,.12)*thread*small;
  float alpha=edge*endMask*(.39+.61*holes)*(.78+.22*pressure);
  if(brush.x>.5&&brush.x<1.5){
    c=mix(vec3(.02,.33,.37),vec3(.40,.91,.81),.23+.64*v+.13*small);
    alpha=edge*endMask*(.42+.48*holes)*(.72+.23*pressure);
  }
  if(brush.x>1.5&&brush.x<2.5){
    c=mix(vec3(.23,.78,.68),vec3(.91,1.,.91),.64+.32*n);
    alpha=edge*endMask*(.57+.40*holes);
  }
  if(brush.x>2.5){
    c=mix(vec3(.03,.42,.44),vec3(.56,.93,.82),.18+.64*v+.18*n);
    alpha=edge*endMask*(.21+.57*holes);
  }
  alpha*=rise*open*fade;
  if(alpha<.018)discard;
  gl_FragColor=vec4(c,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeLeaf(T){
  const g=new T.BufferGeometry(),p=[],c=[];
  const palette=['#cfc680','#dfd69b','#9caf62','#748b50'].map(hex=>new T.Color(hex));
  const root=[-.43,0,0],left=[-.03,.07,-.21],right=[.11,-.025,.18],mid=[.065,.09,0],tip=[.60,.055,-.015];
  for(const [i,tri] of [[0,[root,left,mid]],[1,[left,tip,mid]],[2,[root,mid,right]],[3,[mid,tip,right]]]){
    p.push(...tri.flat());const {r,g,b}=palette[i];for(let n=0;n<3;n++)c.push(r,g,b);
  }
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));
  return g;
}

export function createGaleFx(T,scene){
  const brushGeo=makeStrokes(T),leafGeo=makeLeaf(T);
  const leafMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,depthWrite:false});
  const holder=new T.Object3D(),count=22,pool=[];
  let seed=1823,next=0,disposed=false;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const leaves=Array.from({length:count},(_,i)=>{
    const angle=(i+.55*random())*2.39996;
    return {angle,delay:random()*.17,start:.55+random()*.65,
      reach:2.1+random()*1.65,lo:.19+random()*.32,lift:.33+random()*.87,
      stir:.25+random()*.53,twirl:4.1+random()*7.7,size:.09+random()*.13};
  });
  for(let i=0;i<2;i++){
    const material=new T.ShaderMaterial({vertexShader:windVertex,fragmentShader:windFragment,
      uniforms:{beat:{value:0}},side:T.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true});
    const group=new T.Group();group.name='破风斩 · 岚流';group.visible=false;
    const cut=new T.Mesh(brushGeo,material);cut.renderOrder=10;group.add(cut);
    const flecks=new T.InstancedMesh(leafGeo,leafMaterial,count);
    flecks.instanceMatrix.setUsage(T.DynamicDrawUsage);flecks.frustumCulled=false;flecks.renderOrder=9;group.add(flecks);
    scene.add(group);pool.push({group,material,flecks,age:0});
  }
  function paint(slot){
    const p=slot.age/life;slot.material.uniforms.beat.value=p;
    leaves.forEach((leaf,index)=>{
      const u=clamp((p-leaf.delay)/(1-leaf.delay),0,1),ease=1-(1-u)**2;
      const angle=leaf.angle+leaf.stir*ease,r=leaf.start+(leaf.reach-leaf.start)*ease;
      holder.position.set(Math.sin(angle)*r,leaf.lo+Math.sin(Math.PI*u)*leaf.lift,-Math.cos(angle)*r);
      holder.rotation.set(u*leaf.twirl+angle,angle+u*leaf.twirl*.7,angle*.73+u*leaf.twirl,'YXZ');
      const size=leaf.size*Math.min(1,u*12)*Math.min(1,(1-u)*4.5);
      holder.scale.setScalar(size);holder.updateMatrix();slot.flecks.setMatrixAt(index,holder.matrix);
    });
    slot.flecks.instanceMatrix.needsUpdate=true;
  }
  function strike(origin,yaw=0,radius=3.8){
    if(disposed)return;
    const slot=pool[next];next=(next+1)%pool.length;
    slot.age=.006;slot.group.position.copy(origin);
    slot.group.rotation.y=-yaw;
    const scale=Math.max(.15,radius/3.8);slot.group.scale.set(scale,1,scale);
    slot.group.visible=true;paint(slot);
  }
  function update(dt){
    if(disposed||!Number.isFinite(dt)||dt<=0)return;
    for(const slot of pool)if(slot.group.visible){
      slot.age+=dt;if(slot.age>=life)slot.group.visible=false;else paint(slot);
    }
  }
  function reset(){for(const slot of pool){slot.group.visible=false;slot.age=0;}}
  function dispose(){
    if(disposed)return;disposed=true;reset();
    for(const slot of pool){scene.remove(slot.group);slot.material.dispose();slot.flecks.dispose();}
    brushGeo.dispose();leafGeo.dispose();leafMaterial.dispose();
  }
  return {strike,update,reset,dispose};
}
