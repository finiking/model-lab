/* Perihelion · art-directed atmosphere, wave field and eroded sea stacks.
   The horizon is analytic, so a camera close to the water never exposes a plane edge. */
window.buildWorld = function buildWorld(THREE, scene) {
  const seaLevel = -2.7;
  const sunDirection = new THREE.Vector3(0, 0.23, -1).normalize();
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: sunDirection },
    uEye: { value: new THREE.Vector3() },
    uInverseProjection: { value: new THREE.Matrix4() },
    uCameraRotation: { value: new THREE.Matrix3() }
  };

  const atmosphere = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: `
      uniform mat4 uInverseProjection;
      uniform mat3 uCameraRotation;
      varying vec3 ray;
      void main() {
        vec4 p = uInverseProjection * vec4(position.xy, -1.0, 1.0);
        ray = uCameraRotation * p.xyz;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uSun, uEye;
      varying vec3 ray;

      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(.1031,.1129,.1217));
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float noise2(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x),
                   mix(hash(i+vec2(0.,1.)), hash(i+1.), f.x), f.y);
      }
      float cloud(vec2 p) {
        return noise2(p)*.56 + noise2(p*2.1)*.29 + noise2(p*4.2)*.15;
      }

      vec3 sky(vec3 d) {
        float elevation = max(d.y, 0.);
        float forward = pow(max(dot(d.xz, normalize(uSun.xz)),0.),3.);
        vec3 horizon = mix(vec3(.30,.52,.55), vec3(.98,.685,.41), forward);
        vec3 low = mix(vec3(.125,.35,.41), vec3(.61,.47,.38), forward);
        vec3 c = mix(horizon, low, smoothstep(0.,.19,elevation));
        c = mix(c, vec3(.055,.21,.28), smoothstep(.08,.48,elevation));
        c = mix(c, vec3(.016,.068,.12), smoothstep(.40,.94,elevation));
        float sd = length(d-uSun);
        c += vec3(.10,.047,.015)*exp(-sd*3.8);

        // Airborne salt and thin high-altitude veils, stretched with the wind.
        vec2 uv = d.xz / max(.06,d.y+.075);
        float streaks = cloud(vec2(uv.x*.90+uv.y*.16,uv.y*3.1)+vec2(uTime*.009,0.));
        float wisps = smoothstep(.56,.77,streaks)
                    * smoothstep(.006,.09,elevation)*(1.-smoothstep(.28,.56,elevation));
        c = mix(c,vec3(.94,.79,.65),wisps*(.08+.09*forward));
        // Occulted solar disk with a thick crescent and a faint chromosphere.
        vec3 vertical = normalize(cross(vec3(1.,0.,0.),uSun));
        vec2 s = vec2(d.x, dot(d,vertical)); // tangent-plane angular coordinates
        float radius=.094;
        float ds=length(s), dm=length(s-vec2(.020,.014));
        if(dot(d,uSun)>.88) {
          float lane=exp(-abs(ds-radius)*28.);
          // Radial braids follow the arch of the magnetic field. The glow fades
          // between the three large streamers instead of making a uniform halo.
          float theta=atan(s.y,s.x);
          float radial=max(0.,ds-radius);
          float warp=theta+.55*radial+1.5*radial*sin(theta*3.-radial*14.);
          float plumes=.24+.76*pow(.5+.5*cos(warp*3.-.85+.46*sin(warp*5.)),2.);
          float filaments=cloud(vec2(warp*24.+12.*radial,radial*20.+uTime*.016));
          float fans=(.19+.81*filaments)*plumes*exp(-radial*(26.+11.*sin(theta*2.)));
          fans*=smoothstep(radius-.002,radius+.003,ds);
          c+=vec3(.57,.245,.058)*fans;
          float activeLimb=pow(max(0.,cos(theta*7.+.37*sin(theta*5.)-.7)),7.);
          float archHeight=.001+.004*activeLimb;
          float hotArcs=exp(-abs(ds-radius-archHeight)*1150.)*activeLimb;
          c+=vec3(.65,.23,.045)*hotArcs;
          c += vec3(.25,.112,.023)*lane;
          c += vec3(.37,.19,.049)*exp(-abs(ds-radius)*116.);
          float sun = 1.-smoothstep(radius-.0007,radius+.0007,ds);
          float moon = 1.-smoothstep(radius*.98-.0008,radius*.98+.0008,dm);
          float rim = smoothstep(.50,1.,min(1.,ds/radius));
          float granules=noise2(s*660.)*.55+noise2(s*1800.)*.45;
          vec3 photosphere=mix(vec3(1.,.956,.70),vec3(1.,.74,.34),rim*.63);
          photosphere+=vec3(.020,.025,.029)*(granules-.5);
          c=mix(c,photosphere,sun);
          vec3 umbra=mix(vec3(.115,.156,.164),vec3(.24,.235,.201),smoothstep(.1,1.,dm/radius)*.8);
          c=mix(c,umbra,moon);
          c+=vec3(.73,.35,.11)*exp(-abs(dm-radius*.98)*720.)*smoothstep(.6,1.3,ds/radius)*.46;
        }
        return c;
      }

      // Value field and its analytic gradient in one evaluation. We layer rotated
      // patches with different wavelengths, so finite wave crests break and re-form.
      vec3 roughWater(vec2 p) {
        vec2 cell=floor(p), f=fract(p);
        vec2 q=f*f*(3.-2.*f), dq=6.*f*(1.-f);
        float a=hash(cell), b=hash(cell+vec2(1.,0.));
        float c=hash(cell+vec2(0.,1.)), e=hash(cell+1.);
        float k=a-b-c+e;
        return vec3(a+(b-a)*q.x+(c-a)*q.y+k*q.x*q.y,
                    dq*vec2(b-a+k*q.y,c-a+k*q.x));
      }
      void band(vec2 p,vec2 axis,vec2 frequency,vec2 drift,float amplitude,
                vec2 footprint,inout float height,inout vec2 slope) {
        mat2 frame=mat2(axis,vec2(-axis.y,axis.x));
        vec2 local=frequency*(p*frame)+drift*uTime;
        vec3 n=roughWater(local);
        float projectedWidth=max(frequency.x*dot(abs(frame[0]),footprint),
                                 frequency.y*dot(abs(frame[1]),footprint));
        float keep=1.-smoothstep(.22,.82,projectedWidth);
        height+=(n.x-.5)*amplitude*keep;
        slope+=frame*(n.yz*frequency)*(amplitude*keep);
      }
      float reflectedStack(vec2 point, vec3 direction, vec3 centre, vec3 size) {
        vec3 eye=(vec3(point.x,-2.7,point.y)-centre)/size;
        vec3 ray=direction/size;
        float t=-dot(eye,ray)/dot(ray,ray);
        float closest=length(eye+max(t,0.)*ray);
        return (1.-smoothstep(.66,1.16,closest))*smoothstep(0.,3.,t);
      }
      vec3 ocean(vec3 d) {
        float hit=max(0.,(uEye.y+2.7)/max(.00001,-d.y));
        vec2 p=uEye.xz+d.xz*hit;
        vec2 footprint=min(vec2(20.),fwidth(p));
        float reach=1.-smoothstep(42.,165.,hit);
        float longSwell=sin(.68*p.x+.35*p.y-uTime*.84+sin(.32*p.y));
        float windPatch=noise2(p*.20+vec2(.045,-.015)*uTime);
        vec2 coordinate=p+.50*vec2(sin(p.y*.61+.4*uTime),cos(p.x*.23-.3*uTime))
                             +vec2(1.15,-1.45)*(windPatch-.5);
        float height=longSwell*.045; vec2 slope=vec2(.025,.016)*longSwell;
        band(coordinate,vec2(.98,-.199),vec2(.14,.23),vec2(-.06,.08),.48,footprint,height,slope);
        band(coordinate,vec2(.80,.60),vec2(.74,1.12),vec2(-.19,.22),.18,footprint,height,slope);
        band(coordinate,vec2(-.52,.854),vec2(1.42,2.01),vec2(.40,.28),.081,footprint,height,slope);
        band(coordinate,vec2(.35,.937),vec2(3.09,4.47),vec2(-.73,.49),.036,footprint,height,slope);
        band(coordinate,vec2(.91,-.415),vec2(7.08,8.9),vec2(.89,-.66),.013,footprint,height,slope);
        slope*=.35+.65*reach;
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
        vec3 r=reflect(d,n);
        float facing=clamp(dot(-d,n),0.,1.);
        float azimuth=pow(max(-normalize(d.xz+vec2(.000001)).y,0.),3.);
        float freshwater=mix(.05,.95,windPatch);
        vec3 depths=mix(vec3(.019,.112,.192),vec3(.024,.282,.312),freshwater);
        float fresnel=.09+.47*pow(1.-facing,3.5);
        vec3 coolSky=mix(vec3(.025,.166,.259),vec3(.16,.43,.46),(1.-smoothstep(-.14,.46,r.y)));
        vec3 body=mix(depths,coolSky,fresnel);
        float flank=clamp(.32+dot(slope,vec2(-.48,.84))*1.37+height*.92,0.,1.);
        body+=vec3(.016,.074,.073)*flank;
        // Reflect the finite solar disc: sharp flecks on a broader copper wake.
        float incidence=max(0.,dot(r,uSun));
        float nearSun=pow(incidence,36.);
        float bright=pow(incidence,380.);
        float column=exp(-pow(abs(d.x)*3.95,2.))*smoothstep(.05,.88,-d.z);
        float glitter=bright*smoothstep(.05,.31,.18+height+dot(slope,vec2(-.71,.53)));
        vec3 c=mix(body,vec3(.45,.31,.235),.17*column+.20*nearSun);
        c=mix(c,vec3(.92,.48,.207),nearSun*.24);
        c=mix(c,vec3(1.,.79,.48),glitter*.93);
        float whitecap=smoothstep(.21,.27,height)*smoothstep(.45,.78,windPatch)*reach;
        c=mix(c,vec3(.41,.66,.64),whitecap*.68);
        float stoneReflection=max(reflectedStack(p,r,vec3(-37.,1.,-49.),vec3(7.,7.3,4.8)),
                                  reflectedStack(p,r,vec3(46.,1.,-68.),vec3(7.5,8.,4.5)));
        c=mix(c,vec3(.072,.19,.211),stoneReflection*.50);
        float shore=min(length((p-vec2(-37.,-49.))/vec2(6.0,4.0)),length((p-vec2(47.,-68.))/vec2(7.2,4.1)));
        float surf=1.-smoothstep(.025,.19,abs(shore-1.07+.12*sin(p.x*2.+uTime)+.19*(windPatch-.5)));
        c=mix(c,vec3(.59,.71,.67),surf*.53*windPatch);
        vec3 haze=mix(vec3(.30,.52,.55),vec3(.98,.685,.41),azimuth);
        haze+=vec3(.10,.047,.015)*exp(-length(vec3(normalize(d.xz+vec2(.000001)).x,0.,normalize(d.xz+vec2(.000001)).y)-uSun)*3.8);
        c=mix(c,haze,1.-exp(-.0055*hit));
        return c;
      }
      void main() {
        vec3 d=normalize(ray);
        vec3 color;
        if(d.y<0. && uEye.y>-2.69) { color=ocean(d); if(d.y>-.014){vec2 h=normalize(d.xz);color=mix(sky(vec3(h.x,0.,h.y)),color,smoothstep(0.,.014,-d.y));} }
        else color=sky(d);
        // Half a quantisation level of fixed grain prevents bands in the upper sky.
        color+=(hash(gl_FragCoord.xy)-.5)/255.;
        gl_FragColor=vec4(color,1.);
      }
    `
  });

  const dome = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), atmosphere);
  dome.name = "Salt haze and eclipse";
  dome.renderOrder = -10000;
  dome.frustumCulled = false;
  dome.onBeforeRender = function(renderer, currentScene, camera) {
    uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.uCameraRotation.value.setFromMatrix4(camera.matrixWorld);
    uniforms.uEye.value.setFromMatrixPosition(camera.matrixWorld);
  };
  scene.add(dome);

  const waterMask = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:true, side:THREE.DoubleSide}));
  waterMask.name = "Waterline depth";
  waterMask.rotation.x = -Math.PI/2;
  waterMask.position.y = seaLevel-.008;
  waterMask.renderOrder = -9000;
  scene.add(waterMask);

  let state = 192046;
  function random() { state = (Math.imul(state,1664525)+1013904223) >>> 0; return state/4294967296; }
  const stones=[],stoneColors=[];
  const color = hex => new THREE.Color(hex);
  const lowerStone=color('#173641'), dryStone=color('#455958'), topStone=color('#ae855e');
  const litStone=color('#bd8257'), air=color('#678c90');
  const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3();
  function triangle(a,b,c,group,base) {
    let n=tmpA.subVectors(b,a).cross(tmpB.subVectors(c,a)).normalize();
    const sideLight=Math.max(0.,n.x*(-.64)+n.y*.60-n.z*.48);
    const height=(a.y+b.y+c.y)/3;
    const wet=Math.min(1., Math.max(0.,(height-seaLevel)/2.1));
    let tint=lowerStone.clone().lerp(dryStone,wet*.70);
    tint.lerp(litStone,sideLight*(.22+.48*wet));
    if(group==='cap') tint.lerp(topStone,.45);
    tint.multiplyScalar(base);
    const depth=(Math.abs(a.z)+Math.abs(b.z)+Math.abs(c.z))/3;
    tint.lerp(air, Math.min(.40,depth/310));
    for(const v of [a,b,c]) {stones.push(v.x,v.y,v.z);stoneColors.push(tint.r,tint.g,tint.b);}
  }

  function stack(x,z,rx,rz,height,lean,seed) {
    const count=11, yStart=seaLevel-1;
    const radii=[],angles=[],top=[];
    for(let j=0;j<count;j++) {
      radii[j]=.83+random()*.32;
      angles[j]=j*2*Math.PI/count+(random()-.5)*.13+seed;
      top[j]=.95+.10*random()+.22*Math.cos(angles[j]+seed);
    }
    const levels=[[-.04,1.18],[.13,1.07],[.16,1.10],[.26,.96],[.31,1.01],
      [.45,.87],[.49,.92],[.62,.80],[.67,.84],[.80,.68],[.86,.72],[1.,.48]];
    const rows=levels.map(([t,scale],k)=> angles.map((a,j)=>{
      let jagged=(.96+random()*.075)*radii[j]*scale;
      return new THREE.Vector3(x+rx*(jagged*Math.cos(a)+lean*t),yStart+height*t*top[j],
        z+rz*(jagged*Math.sin(a)-.11*t));
    }));
    for(let k=1;k<rows.length;k++) for(let j=0;j<count;j++){
      let m=(j+1)%count, a=rows[k-1][j],b=rows[k][j],c=rows[k-1][m],d=rows[k][m];
      const shade=.88+random()*.14;
      triangle(a,b,c,'face',shade);
      triangle(b,d,c,'face',shade*(.98+.045*random()));
    }
    let summit=rows[rows.length-1];
    let centre=new THREE.Vector3(x+rx*lean,yStart+height*1.05,z-rz*.11);
    for(let j=0;j<count;j++) triangle(summit[j],centre,summit[(j+1)%count],'cap',.97);
  }
  const stacks=[
    [-37,-49,5.0,3.2,11.6,.27],[-42,-50,3.6,2.8,7.2,.36],[-32,-48,2.1,1.9,3.7,.14],
    [-47,-54,5.,2.6,4.,.28],[-56,-51,2.2,1.7,5.3,.22],
    [46,-68,4.8,3.2,12.7,-.48],[49,-68,3.7,2.7,9.1,-.38],
    [41,-67,2.3,2.,6.6,-.23],[55,-66,4.9,2.4,4.1,-.3],
    [-83,-117,28.,8.,6.4,.2],[-104,-115,17.,8.,9.,-.16],
    [88,-131,24.,6.3,7.8,-.30],[115,-124,25.,9.,10.9,.24],
    [-82,48,9.,5.,6.1,.24],[102,35,14.,6.,7.2,-.18]
  ];
  for(const s of stacks)stack(...s,random()*6.28);
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(stones,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(stoneColors,3));
  geom.computeBoundingSphere();
  const strataMaterial=new THREE.ShaderMaterial({
    vertexColors:true, side:THREE.DoubleSide, toneMapped:false,
    vertexShader:`
      varying vec3 rockPosition, rockTint;
      void main(){
        rockPosition=position;
        rockTint=color;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      varying vec3 rockPosition,rockTint;
      void main(){
        vec3 p=rockPosition;
        // Tilted bedding and two families of cross-joints divide the cliff faces.
        float bed=p.y+.29*p.x-.14*p.z+.23*sin(p.x*.42+p.z*.48)+.095*sin(p.x*1.82)+.04*sin(p.x*4.55-p.z*2.03);
        float layer=sin(bed*5.1+sin(bed*1.9));
        float ledge=smoothstep(.83,1.,layer)*(.55+.45*sin(p.x*.71+p.z*.6+bed*.43));
        float warm=smoothstep(-.5,.7,sin(bed*1.1+.68*sin(bed*.6)));
        float fault=abs(sin(p.x*2.3+p.z*.8+.21*p.y+sin(p.z*.83)))*3.;
        float crack=(1.-smoothstep(.0,.20,fault))*smoothstep(-.7,1.,sin(bed*1.45));
        vec3 tint=rockTint*(.87+.17*warm+.075*layer-.22*crack);
        tint+=vec3(.024,.010,.0035)*ledge;
        tint+=vec3(.012,.010,.005)*warm;
        gl_FragColor=vec4(pow(max(tint,0.),vec3(1./2.2)),1.);
      }`
  });
  const rock=new THREE.Mesh(geom,strataMaterial);
  rock.name="Eroded sea stacks";
  scene.add(rock);

  return {
    sunDirection,
    update(t) { uniforms.uTime.value=t; }
  };
};
