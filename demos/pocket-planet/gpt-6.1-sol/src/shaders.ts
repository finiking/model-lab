export const landGLSL = `
float land(vec3 p) {
 return sin(p.x*3.7+p.z*2.1)*.23 + sin(p.z*4.8-p.y*3.1)*.18
 + sin(p.y*6.7+p.x*2.8)*.11 + sin(p.x*13.1+p.y*7.2)*cos(p.z*9.1)*.045
 + cos(p.z*17.+p.x*11.+p.y*9.)*.022-.015;
}`;
export const terrainVert = `
uniform vec3 uImpact; uniform float uAge;
attribute vec3 color; varying vec3 vColor; varying vec3 vNormal; varying vec3 vDir;
void main() {
 vec3 p=position; vDir=normalize(p); vColor=color;
 float d=acos(clamp(dot(vDir,uImpact),-1.,1.));
 if(uAge>.92) { p+=vDir*(-.17*(1.-smoothstep(.06,.22,d))+.075*exp(-pow((d-.23)*26.,2.))); }
 vNormal=normalize(mat3(modelMatrix)*normal);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
export const terrainFrag = `
uniform float uT; uniform float uIce; uniform float uNight; uniform float uAge;
uniform vec3 uImpact; uniform vec3 uSun;
varying vec3 vColor; varying vec3 vNormal; varying vec3 vDir;
void main() {
 vec3 c=mix(vColor,vec3(.62,.83,.84),uIce*.8);
 float light=max(dot(normalize(vNormal),uSun),0.);
 c*=mix(.23,.10,uNight)+(1.-uNight*.55)*light*1.05;
 c+=vec3(.018,.065,.073)*(1.-light);
 float d=acos(clamp(dot(vDir,uImpact),-1.,1.));
 if(uAge>.92) {
  float crater=1.-smoothstep(.18,.225,d);
  float veins=pow(.5+.5*sin(vDir.x*150.+sin(vDir.y*90.)*3.+uT),7.);
  vec3 lava=mix(vec3(.10,.018,.008),vec3(3.8,.51,.026),veins*.8+.2);
  c=mix(c,lava,crater);
  c+=vec3(2.1,.35,.025)*exp(-pow((d-.22)*70.,2.))*.65;
 }
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const oceanVert = `
uniform float uT; uniform float uIce;
varying vec3 vDir; varying vec3 vNormal; varying vec3 vWorld;
void main(){
 vDir=normalize(position); vec3 p=position;
 p+=vDir*sin(vDir.x*35.+uT*.8)*sin(vDir.z*32.+uT*.6)*.004*(1.-uIce);
 vNormal=normalize(mat3(modelMatrix)*normal); vWorld=(modelMatrix*vec4(p,1.)).xyz;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
export const oceanFrag = `
uniform float uT; uniform float uIce; uniform float uNight; uniform float uAge;
uniform vec3 uImpact; uniform vec3 uSun;
varying vec3 vDir; varying vec3 vNormal; varying vec3 vWorld;
${landGLSL}
void main(){
 float h=land(vDir);
 float impactD=acos(clamp(dot(vDir,uImpact),-1.,1.));
 if(uAge>.92 && impactD<.205) discard;
 float shallow=smoothstep(-.22,.01,h);
 vec3 c=mix(vec3(.012,.20,.27),vec3(.035,.67,.62),shallow);
 float w=sin(vDir.x*120.+uT*1.7+sin(vDir.z*70.+uT)*2.)*sin(vDir.y*110.-uT);
 c+=vec3(.025,.08,.09)*pow(max(w,0.),4.);
 float foam=(1.-smoothstep(.008,.034,abs(h-.008)))*(.65+.35*sin(h*1100.-uT*2.));
 c=mix(c,vec3(.55,.95,.85),foam*.7);
 float facets=sin(vDir.x*80.+vDir.z*41.)*sin(vDir.z*76.-vDir.y*47.);
 float cracks=pow(1.-abs(facets),25.);
 vec3 ice=mix(vec3(.35,.66,.74),vec3(.72,.93,.94),floor(facets*3.)*.18+.6);
 ice+=cracks*vec3(.22,.4,.46);
 c=mix(c,ice,uIce);
 vec3 n=normalize(vNormal+vec3(w*.025,0.,w*.018)*(1.-uIce));
 float light=max(dot(n,uSun),0.);
 c*=mix(.28,.16,uNight)+(1.-uNight*.38)*light*.8;
 vec3 view=normalize(cameraPosition-vWorld);
 float spec=pow(max(dot(n,normalize(uSun+view)),0.),85.);
 c+=vec3(1.,.8,.45)*spec*(1.-uNight*.85)*.9;
 c+=vec3(.008,.035,.07)*uNight;
 if(uAge>.92 && uAge<9.) {
  float dist=acos(clamp(dot(vDir,uImpact),-1.,1.))*1.625;
  float age=uAge-.92;
  float ripple=exp(-pow((dist-age*.65)*15.,2.));
  ripple+=exp(-pow((dist-age*.65+.18)*19.,2.))*.6;
  ripple+=exp(-pow((dist-age*.65+.35)*20.,2.))*.3;
  c+=vec3(.42,1.45,1.5)*ripple*(1.-smoothstep(4.,7.,age));
 }
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const glassVert = `
varying vec3 vNormal; varying vec3 vWorld;
void main(){vNormal=normalize(mat3(modelMatrix)*normal);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const glassFrag = `
varying vec3 vNormal; varying vec3 vWorld;
void main(){
 vec3 view=normalize(cameraPosition-vWorld); float f=pow(1.-abs(dot(normalize(vNormal),view)),3.8);
 float streak=pow(max(dot(normalize(vNormal),normalize(vec3(-.65,.8,.8))),0.),90.);
 vec3 c=mix(vec3(.19,.52,.57),vec3(.92,.78,.49),max(vNormal.x,0.));
 gl_FragColor=vec4(c+streak*.6,f*.42+streak*.17);
}`;
export const auroraVert = `
uniform float uT; varying vec2 vUv;
void main(){vUv=uv;vec3 p=position;p.xz*=1.+sin(uv.x*25.+uT*.8+uv.y*3.)*.12;p.y+=sin(uv.x*22.+uT)*.10;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
export const auroraFrag = `
uniform float uT; uniform float uPower; varying vec2 vUv;
void main(){
 float rays=pow(.5+.5*sin(vUv.x*180.+sin(vUv.x*23.+uT)*3.),3.);
 float fade=pow(sin(vUv.y*3.14159),1.4);
 float folds=.5+.5*sin(vUv.x*34.+uT*.7+vUv.y*3.);
 vec3 c=mix(vec3(.015,1.8,.28),vec3(.65,.025,2.3),smoothstep(.3,.9,vUv.y+sin(vUv.x*10.)*.12));
 gl_FragColor=vec4(c,fade*(.12+rays*.42)*folds*uPower);
}`;
