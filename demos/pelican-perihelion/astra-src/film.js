/* PERIHELION — a miniature orbital velodrome, one saddle, two contact patches. */
(() => {
  const T = THREE, R = 8, turn = Math.PI * 2, lap = turn * R, end = 18;
  const capture = new URLSearchParams(location.search).has('capture');
  const canvas = document.querySelector('#stage');
  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false, preserveDrawingBuffer:capture, powerPreference:'high-performance'});
  renderer.setPixelRatio(1); renderer.setSize(1280,720,false);
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.04;
  renderer.autoClear=true;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(36,16/9,.055,560);
  const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
  const mix=(a,b,f)=>a+(b-a)*f;
  const worldUp=vec(0,1,0);
  function at(s) {
    const u=clamp(s/lap), a=u*turn;
    const p=s<0?vec(s,0,-1.45):s>lap?vec(s-lap,0,1.45):vec(R*Math.sin(a),R*(1-Math.cos(a)),mix(-1.45,1.45,ease(u)));
    const dx=vec(Math.cos(a),Math.sin(a),2.9*6*u*(1-u)/lap).normalize();
    const dy=vec(-Math.sin(a),Math.cos(a),0), dz=dx.clone().cross(dy).normalize();
    return {p,x:dx,y:dy,z:dz};
  }
  /* Resolve both axle centres on their offset rail. This keeps the rigid wheelbase
     tangent even when the back tyre is on the straight and the front is climbing. */
  function axle(s){const a=at(s);return a.p.addScaledVector(a.y,.64)}
  function pose(s) {
    let lo=.95,hi=1.4;
    for(let j=0;j<13;j++){const d=(lo+hi)*.5; if(axle(s-d).distanceTo(axle(s+d))<2.08)lo=d;else hi=d}
    const d=(lo+hi)*.5,A=axle(s-d),B=axle(s+d),x=B.clone().sub(A).normalize();
    const y=at(s).z.cross(x).normalize(),z=x.clone().cross(y).normalize();
    return {p:A.addScaledVector(x,1.02).addScaledVector(y,-.64),x,y,z};
  }
  function travel(t){
    const f=(t-5.55)/7, shoulder=1.37*lap/7;
    if(f<0) return (t-5.55)*shoulder;
    if(f>1) return lap+(t-12.55)*shoulder;
    return R*(turn*f+.37*Math.sin(turn*f));
  }
  // The camera stretches screen time through the apex. In world time the bicycle
  // carries 9.84 m/s through the loop; at the summit the playback rate is 0.46×.
  const physicalTime=s=>(s-travel(0))/(1.37*lap/7);
  function basis(o,b){o.matrixAutoUpdate=false;o.matrix.makeBasis(b.x,b.y,b.z).setPosition(b.p);o.matrixWorldNeedsUpdate=true}
  function local(b,x,y,z){return b.p.clone().addScaledVector(b.x,x).addScaledVector(b.y,y).addScaledVector(b.z,z)}
  function light(color,n,x,y,z){const l=new T.DirectionalLight(color,n);l.position.set(x,y,z);scene.add(l);return l}
  scene.add(new T.HemisphereLight(0xcde9f0,0x8b736d,.78));
  const softbox=light(0xffdfac,2.38,-4,7,5);
  softbox.castShadow=true;softbox.shadow.mapSize.set(1024,1024);
  Object.assign(softbox.shadow.camera,{left:-3.7,right:3.7,top:3.7,bottom:-3.7,near:.5,far:23});
  softbox.shadow.bias=-.00038;softbox.shadow.normalBias=.01;softbox.shadow.radius=2.8;scene.add(softbox.target);
  light(0xffaf68,2.5,2,4,-7);light(0xa3dcf6,.63,1,1.5,6);
  // Reflected broad studio cards keep bare metal legible against the bright sea.
  const ew=128,eh=64,envData=new Float32Array(ew*eh*4);
  for(let j=0;j<eh;j++)for(let i=0;i<ew;i++){
    const az=(i+.5)/ew*turn-Math.PI,el=(j+.5)/eh*Math.PI-Math.PI/2;
    const d=vec(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az));
    const sun=Math.pow(Math.max(0,d.dot(vec(-.28,.61,.74).normalize())),28);
    const rim=Math.pow(Math.max(0,d.dot(vec(.2,.2,-.97).normalize())),32);
    const p=(j*ew+i)*4,h=clamp(d.y*.7+.5);
    envData.set([.09+.53*h+sun*4.5+rim*2,.13+.52*h+sun*3.65+rim*1.13,.13+.59*h+sun*2.25+rim*.55,1],p);
  }
  const env=new T.DataTexture(envData,ew,eh,T.RGBAFormat,T.FloatType);env.mapping=T.EquirectangularReflectionMapping;env.needsUpdate=true;
  const pm=new T.PMREMGenerator(renderer), envMap=pm.fromEquirectangular(env);scene.environment=envMap.texture;scene.environmentIntensity=.47;pm.dispose();env.dispose();
  const world=buildWorld(T,scene), road=buildTrack(T,scene,at), bird=buildRider(T), cycle=buildMachine(T), rig=new T.Group();
  rig.add(bird.group,cycle.group);scene.add(rig);
  rig.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.layers.enable(1)}});
  scene.traverse(o=>{if(o.isLight)o.layers.enable(1)});
  road.group.traverse(m=>{if(m.isMesh)m.receiveShadow=true});
  const shoal=typeof buildShoal==='function'?buildShoal(T,scene):null;
  // Soft occlusion is projected along the curved track, including the inverted summit.
  const shadowMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:'varying vec2 v;void main(){vec2 p=v*2.-1.;float a=.28*exp(-2.7*p.x*p.x-5.*p.y*p.y);a+=.48*exp(-90.*pow(abs(p.x)-.58,2.)-34.*p.y*p.y);gl_FragColor=vec4(.038,.064,.07,a);}'});
  const sg=new T.PlaneGeometry(1,1,20,1),spos=sg.attributes.position,shad=new T.Mesh(sg,shadowMat);shad.frustumCulled=false;shad.renderOrder=1;scene.add(shad);
  function contact(s){for(let j=0;j<spos.count;j++){const u=sg.attributes.uv.getX(j),v=sg.attributes.uv.getY(j),b=at(s+(u-.5)*3.52);
    const q=b.p.addScaledVector(b.y,.017).addScaledVector(b.z,(v-.5)*1.02);spos.setXYZ(j,q.x,q.y,q.z)}spos.needsUpdate=true}
  // Chronophotographic exposures of the real articulated sculpture, fixed in space.
  // Each carries its own pedal phase; they appear only as the camera reveals the loop.
  const expTimes=[6.23,6.78,7.37,8.02,8.76,9.51,10.12];
  const ghosts=[];
  for(let k=0;k<expTimes.length;k++){
    const t=expTimes[k],s=travel(t),phase=-s/(.64*2.18)+.7;
    bird.update(physicalTime(s),phase);cycle.update(physicalTime(s),phase,-s/.64);rig.updateMatrixWorld(true);
    const pts=[];rig.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;
      const g=o.geometry,pos=g.attributes.position,idx=g.index,v=vec();
      for(let i=0,n=idx?idx.count:pos.count;i<n;i++){v.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld);pts.push(v.x,v.y,v.z)}
    });
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));
    const mat=new T.MeshBasicMaterial({color:new T.Color().lerpColors(new T.Color(0xffc56c),new T.Color(0x9cfdf0),k/6),transparent:true,opacity:0,depthWrite:true,toneMapped:false});
    const ghost=new T.Mesh(geo,mat);basis(ghost,pose(s));ghost.visible=false;scene.add(ghost);ghosts.push(ghost);
  }
  function expose(t){const strength=ease((t-10.12)/.43)*(1-ease((t-12.05)/.75));
    ghosts.forEach((g,k)=>{g.material.opacity=strength*(.15+.17*(k/6))*(.85+.15*Math.cos(2*t));g.visible=g.material.opacity>.008})}
  function camShot(t,b) {
    let eye,tar,up=worldUp,fov=35,shift=0;const P=b.p;
    if(t<1.98){
      const f=ease(t/1.98);eye=local(b,mix(3.86,2.72,f),mix(1.44,1.69,f),mix(4.68,5.00,f));
      tar=local(b,.04,1.50,0);fov=36;shift=.055;
    } else if(t<2.93){
      const f=ease((t-1.98)/.95);
      eye=local(b,.43+.06*f,2.87+.025*f,1.62-.29*f);tar=local(b,.26,2.79,.12);fov=mix(33,26.5,f);
    } else if(t<5.25){
      const f=ease((t-2.93)/2.32);
      eye=local(b,mix(-4.85,-3.8,f),mix(1.35,1.49,f),mix(3.55,4.65,f));
      tar=local(b,.55,1.50,-.18);fov=38;shift=.065;
    } else if(t<7.75){
      const f=ease((t-5.25)/2.50);eye=local(b,mix(1.66,1.95,f),mix(1.05,1.7,f),mix(6.45,6.0,f));tar=local(b,.12,1.52,0);
      const bank=clamp((t-5.55)/7)*turn*.30;up=vec(-Math.sin(bank),Math.cos(bank),0);fov=38;shift=.03;
    } else if(t<10.14){
      const f=(t-9.05);tar=local(b,.07,1.55,0);eye=tar.clone().add(vec(f*1.85,-1.95+.14*f,8.15));fov=34;shift=0;
    } else if(t<13.28){
      const f=ease((t-10.14)/3.14);eye=vec(mix(9,6,f),mix(7.2,5.8,f),mix(27.0,29.2,f));tar=vec(.08,7.78,0);
      fov=39.8;shift=0;
    } else {
      const f=ease((t-13.28)/4.72),a=ease((t-13.60)/2.57);
      const az=mix(.73,-.66,a),radius=mix(6.85,9.0,f);
      eye=local(b,Math.sin(az)*radius,mix(.48,2.72,f),Math.cos(az)*radius);
      tar=local(b,.16,mix(.77,1.52,ease((t-14.02)/2.10)),0);fov=mix(43,35.5,f);shift=.30*ease((t-15.1)/1.85);
    }
    camera.fov=fov;camera.up.copy(up);camera.position.copy(eye);camera.lookAt(tar);
    if(shift){const right=vec(1,0,0).applyQuaternion(camera.quaternion);tar.addScaledVector(right,-eye.distanceTo(tar)*Math.tan(fov*Math.PI/360)*camera.aspect*shift);camera.lookAt(tar)}
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }
  // Screenprinted film typography is drawn at delivery resolution and composited in WebGL.
  // The diagnostic view hides these film titles when the user takes the camera.
  const overlay=new T.Scene(),oc=new T.OrthographicCamera(-640,640,360,-360,0,10);oc.position.z=2;
  function plate(width,height,draw,x,y){
    const c=document.createElement('canvas');c.width=width*2;c.height=height*2;const q=c.getContext('2d');q.scale(2,2);draw(q,width,height);
    const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.minFilter=T.LinearFilter;tx.generateMipmaps=false;
    const mat=new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
    const m=new T.Mesh(new T.PlaneGeometry(width,height),mat);m.position.set(x-640+width/2,360-y-height/2,0);overlay.add(m);return m;
  }
  const optics=new T.Mesh(new T.PlaneGeometry(1280,720),new T.ShaderMaterial({
    uniforms:{moment:{value:0}},transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 uvFilm; void main(){uvFilm=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float moment;varying vec2 uvFilm;float h(vec2 p){vec3 a=fract(vec3(p.xyx)*.1013);a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}void main(){vec2 q=(uvFilm-.50)*vec2(1.,.92);float v=smoothstep(.15,.72,length(q));float n=h(gl_FragCoord.xy+floor(moment*24.)*19.);gl_FragColor=vec4(.014,.034,.048,v*.17+.004+.015*n);}'
  }));optics.position.z=-1;optics.renderOrder=-100;overlay.add(optics);
  const cream='#fff3d9',gold='#f6bb6b';
  function orbitGlyph(ctx,x,y,r){
    ctx.save();ctx.translate(x,y);ctx.strokeStyle=cream;ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,0,r,0,turn);ctx.stroke();
    ctx.strokeStyle=gold;ctx.lineWidth=1.75;ctx.beginPath();ctx.ellipse(0,0,r*1.48,r*.39,-.6,0,turn);ctx.stroke();
    ctx.fillStyle=cream;ctx.beginPath();ctx.arc(r*.99,-r*.66,2.2,0,turn);ctx.fill();ctx.restore()
  }
  function caps(q,s,x,y,size,spacing,color=cream){q.fillStyle=color;q.font='600 '+size+'px Arial, sans-serif';for(const ch of s){q.fillText(ch,x,y);x+=q.measureText(ch).width+spacing}}
  const opening=plate(450,100,(q)=>{orbitGlyph(q,18,32,12); caps(q,'TIDAL VELODROME',46,29,13,2.3);caps(q,'ORBITAL TRIAL    /    No. 07',47,48,9,1.8,gold);},43,34);
  const apexLabel=plate(295,56,q=>{q.fillStyle=gold;q.fillRect(1,7,22,1.5);caps(q,'APOGEE',0,29,11,2.2);caps(q,'TIME STRETCH    /    0.46×',0,46,8,1.5);},45,616);
  const chrono=plate(396,62,q=>{q.fillStyle=gold;q.fillRect(1,10,28,2);caps(q,'CHRONOPHOTOGRAPH',0,32,11,2.4);caps(q,'07 EXPOSURES     /     ONE ORBIT',0,49,8,1.7);},45,614);
  const title=plate(510,208,q=>{
    orbitGlyph(q,18,21,10);caps(q,'ORBITAL TRIAL  /  07',46,25,11,2.5,gold);
    q.fillStyle=cream;q.font='italic 65px Georgia, serif';q.fillText('Perihelion',-1,96);q.fillStyle=gold;q.fillRect(2,120,32,1.4);
    q.fillStyle=cream;q.font='500 24px "PingFang SC","Hiragino Sans GB",sans-serif';q.fillText('近日点',44,128);
  },52,442);
  // The macro lens resolves the eye, while objects many metres behind it
  // form a disc-of-confusion. Composite the sharply lit rider after the sea pass.
  const backdrop=new T.WebGLRenderTarget(640,360,{type:T.UnsignedByteType,depthBuffer:true});
  const defocusScene=new T.Scene(),screenCamera=new T.Camera();
  const defocusMat=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{plate:{value:backdrop.texture},radius:{value:12}},
    vertexShader:'varying vec2 tx;void main(){tx=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D plate;uniform float radius;varying vec2 tx;void main(){vec3 c=vec3(0.);for(int i=0;i<40;i++){float k=float(i)+.5;float a=k*2.399963;vec2 off=vec2(cos(a),sin(a))*sqrt(k/40.)*radius/vec2(1280.,720.);c+=texture2D(plate,tx+off).rgb;}gl_FragColor=vec4(c/40.,1.);}'});
  const screen=new T.Mesh(new T.PlaneGeometry(2,2),defocusMat);screen.frustumCulled=false;defocusScene.add(screen);
  function exposeFrame(t) {
    const macro=!free&&t>=1.98&&t<2.93;
    if(!macro){renderer.render(scene,camera);return}
    rig.visible=false;renderer.setRenderTarget(backdrop);renderer.render(scene,camera);renderer.setRenderTarget(null);rig.visible=true;
    defocusMat.uniforms.radius.value=10+8*ease((t-1.98)/.65);
    renderer.render(defocusScene,screenCamera);renderer.autoClear=false;renderer.clearDepth();camera.layers.set(1);
    renderer.render(scene,camera);camera.layers.set(0);renderer.autoClear=true;
  }
  let filmTime=0,free=false,azimuth=.65,elevation=.16,distance=6.4;
  function draw(t){
    t=clamp(t,0,end);filmTime=t;const s=travel(t),b=pose(s),ph=-s/(.64*2.18)+.7;
    const lampTarget=local(b,0,1.35,0);softbox.target.position.copy(lampTarget);softbox.position.copy(lampTarget).add(vec(-4,7,5));
    optics.material.uniforms.moment.value=t;
    basis(rig,b);bird.update(physicalTime(s),ph);cycle.update(physicalTime(s),ph,-s/.64);contact(s);road.update(t,s);if(shoal)shoal.update(t,s,at);expose(free?-1:t);
    if(free){let look=local(b,0,1.48,0);camera.position.copy(look).add(vec(distance*Math.sin(azimuth)*Math.cos(elevation),distance*Math.sin(elevation),distance*Math.cos(azimuth)*Math.cos(elevation)));
      camera.up.copy(worldUp);camera.fov=38;camera.lookAt(look);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    } else camShot(t,b);
    world.update(physicalTime(s),camera);exposeFrame(t);
    if(!free){apexLabel.material.opacity=.86*ease((t-8.26)/.32)*(1-ease((t-9.61)/.32));opening.material.opacity=ease(t/.35)*(1-ease((t-1.52)/.42));chrono.material.opacity=ease((t-10.19)/.3)*(1-ease((t-12.59)/.55));title.material.opacity=ease((t-15.15)/1.13);
      renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,oc);renderer.autoClear=true}
    return t;
  }
  window.drawFilm=draw;
  // Local player: the HTML embeds the scene, library and soundtrack.
  const play=document.querySelector('#play'),angle=document.querySelector('#angle'),bar=document.querySelector('#scrub'),clock=document.querySelector('#clock'),sound=document.querySelector('#sound'),audio=document.querySelector('audio');
  let playing=!capture,last=0,audioOn=false;
  function syncUI(){bar.value=filmTime;clock.textContent=filmTime.toFixed(1).padStart(4,'0')+' / 18.0';play.textContent=playing?'暂停':'播放';angle.textContent=free?'返回电影镜头':'自由视角';angle.setAttribute('aria-pressed',String(free));sound.textContent=audioOn?'声音 开':'声音 关';}
  function startAudio(){if(audioOn&&playing){audio.currentTime=filmTime;audio.play().catch(()=>{audioOn=false;syncUI()})}else audio.pause()}
  function seek(t){draw(t);if(audioOn)audio.currentTime=t;last=performance.now();syncUI()}
  function toggle(){if(!playing&&filmTime>=end-.02)seek(0);playing=!playing;last=performance.now();startAudio();syncUI()}
  function changeAngle(){free=!free;canvas.classList.toggle('orbit',free);draw(filmTime);syncUI()}
  play.onclick=toggle;angle.onclick=changeAngle;bar.oninput=()=>seek(+bar.value);sound.onclick=()=>{audioOn=!audioOn;startAudio();syncUI()};
  canvas.ondblclick=changeAngle;let drag=null;
  canvas.onpointerdown=e=>{if(!free)changeAngle();drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag)return;azimuth-=(e.clientX-drag[0])*.008;elevation=clamp(elevation+(e.clientY-drag[1])*.006,-1.32,1.32);drag=[e.clientX,e.clientY];draw(filmTime)};
  canvas.onpointerup=canvas.onpointercancel=()=>{drag=null};
  canvas.addEventListener('wheel',e=>{if(!free)return;e.preventDefault();distance=clamp(distance*Math.exp(e.deltaY*.001),2.9,19);draw(filmTime)},{passive:false});
  window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
    if(e.code==='Space'){e.preventDefault();toggle()}if(e.key.toLowerCase()==='v')changeAngle();if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(clamp(filmTime+(e.key==='ArrowRight'?.1:-.1),0,end))}});
  function tick(stamp){if(playing){const d=last?Math.min(.16,(stamp-last)/1000):0;let t=audioOn&&!audio.paused?audio.currentTime:filmTime+d;
    if(t>=end-.006){t=end;playing=false;audio.pause()}draw(t);syncUI()}last=stamp;requestAnimationFrame(tick)}
  draw(0);syncUI();window.filmReady=true;if(!capture)requestAnimationFrame(tick);
})();
