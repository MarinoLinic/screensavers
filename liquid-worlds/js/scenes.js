import * as T from '../vendor/three.module.min.js';
import { rng } from './settings.js';
import { LiquidSurface } from './water.js';
import { LiquidEffects } from './effects.js';
import { stone, rockGeometry, environment, glowTexture, instances, mesh, beam, barkMaterial } from './materials.js';

const TAU=Math.PI*2;
function lighting(scene,sky,ground,intensity,keyColor,keyPos,keyIntensity) {
  scene.add(new T.HemisphereLight(sky,ground,intensity));
  const key=new T.DirectionalLight(keyColor,keyIntensity);key.position.set(...keyPos);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-22;key.shadow.camera.right=22;key.shadow.camera.top=22;key.shadow.camera.bottom=-22;key.shadow.camera.near=1;key.shadow.camera.far=65;key.shadow.bias=-.0003;key.shadow.normalBias=.04;scene.add(key);
  return key;
}
function point(scene,color,intensity,p,distance=25) {const l=new T.PointLight(color,intensity,distance,2);l.position.set(...p);scene.add(l);return l;}
function sprite(scene,texture,color,p,size,opacity=.3) {const m=new T.SpriteMaterial({map:texture,color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false});const s=new T.Sprite(m);s.position.set(...p);s.scale.set(size,size,1);scene.add(s);return s;}
function dust(scene,random,kind,texture) {
  const n=kind==='forest'?90:70,pos=new Float32Array(n*3),origin=[];
  for(let i=0;i<n;i++){const p=[(random()-.5)*28,random()*8+.3,(random()-.5)*28];origin.push(p);pos.set(p,i*3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
  const m=new T.PointsMaterial({color:kind==='forest'?0xf8e6ae:kind==='grotto'?0x7bdcec:0xf1b883,size:kind==='forest'?.065:.045,map:texture,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending});
  const points=new T.Points(g,m);scene.add(points);
  return time=>{for(let i=0;i<n;i++){const p=origin[i];pos[i*3]=p[0]+Math.sin(time*.14+i)*.6;pos[i*3+1]=p[1]+Math.sin(time*.2+i*3)*.35;pos[i*3+2]=p[2]+Math.cos(time*.16+i)*.4;}g.attributes.position.needsUpdate=true;};
}

function grotto(w,random) {
  const s=w.scene;s.background=new T.Color(0x07121c);s.fog=new T.FogExp2(0x081824,.034);
  lighting(s,0x80b9d0,0x101021,.95,0xa5e4ff,[5,14,-8],3.1);
  const basalt=stone(0x596477),dark=stone(0x303743),g=rockGeometry(),rocks=[];
  // Broad chamber walls leave the central pool and a rear blue opening visible.
  for(let i=0;i<76;i++) {
    const a=(i/76)*TAU,r=13.3+random()*2;
    rocks.push({p:[Math.cos(a)*r,1+random()*5,Math.sin(a)*r],s:[2+random()*3,3+random()*4,2+random()*3],r:[random(),random()*6,random()]});
  }
  for(let i=0;i<80;i++) {
    const a=random()*TAU,r=11.7+random()*1.7;
    rocks.push({p:[Math.cos(a)*r,-.05+random()*.15,Math.sin(a)*r],s:[.4+random()*1.4,.25+random()*.7,.5+random()*1.4],r:[random(),random()*6,random()]});
  }
  instances(s,g,basalt,rocks);
  mesh(s,new T.CylinderGeometry(16,16,.7,64),dark,[0,-.65,0]);
  const teeth=[];
  for(let i=0;i<42;i++){
    const a=random()*TAU,r=9.8+random()*3.7,h=1.7+random()*4;
    teeth.push({p:[Math.cos(a)*r,9.7-h*.5,Math.sin(a)*r],s:[.3+random()*.6,h,.3+random()*.6],r:[Math.PI,0,(random()-.5)*.3]});
  }
  instances(s,new T.ConeGeometry(1,1,9),basalt,teeth);
  const crystalMat=new T.MeshPhysicalMaterial({color:0x8af5f3,emissive:0x41b7cf,emissiveIntensity:.8,metalness:.25,roughness:.19,clearcoat:1});
  const clusters=[[-8,0,-5],[7.5,0,-7],[-8.8,0,4.3],[4.5,0,-10.3]],crystals=[];
  clusters.forEach((p,k)=>{
    for(let j=0;j<9;j++){const h=.4+random()*1.7,x=p[0]+(random()-.5)*1.5,z=p[2]+(random()-.5)*1.5;crystals.push({p:[x,h*.5+.25,z],s:[.16+random()*.24,h,.16+random()*.24],r:[(random()-.5)*.5,random()*6,(random()-.5)*.6]});}
    point(s,k===2?0x7677ff:0x5febff,95,[p[0],1.7,p[2]],16);sprite(s,w.glow,0x6ccff2,[p[0],1.3,p[2]],4,.18);
  });
  instances(s,new T.ConeGeometry(1,1,6),crystalMat,crystals);
  // A warm seam opposite the cold crystal clusters gives the mercury contrasting reflections.
  point(s,0xe8b16e,125,[9,5,6],22);sprite(s,w.glow,0xe8b16e,[9,5,6],5,.13);
  point(s,0x59c4ee,220,[0,6,-11],28);sprite(s,w.glow,0x88ddff,[0,6,-12],8,.2);
  w.cameraHome={position:[3.7,3.8,8.9],target:[0,.8,-4.3],maxRadius:10.2,maxHeight:6.4};
  w.water=new LiquidSurface({scene:'grotto',quality:w.quality,color:0x31586a,lightDirection:[5,14,-8],lightColor:0xbfefff});
  w.sources=[{x:-3,z:-3,y:6.5},{x:4,z:1,y:6.9},{x:-1,z:5,y:7.5}];
}

function foundry(w,random) {
  const s=w.scene;s.background=new T.Color(0x101c25);s.fog=new T.FogExp2(0x192731,.023);
  lighting(s,0x92b4c5,0x10151d,.85,0xf9d2a7,[-8,17,2],2.4);
  const steel=stone(0x4e6169,false,true),rust=stone(0x6b4334,false,true),concrete=stone(0x637077),trim=new T.MeshStandardMaterial({color:0xd19b42,roughness:.5,metalness:.5});
  const box=new T.BoxGeometry(1,1,1);
  mesh(s,box,concrete,[0,-.65,0],[31,1,36]);
  mesh(s,box,steel,[-8,0,0],[1.5,1,24]);mesh(s,box,steel,[8,0,0],[1.5,1,24]);
  mesh(s,box,steel,[0,0,-11.6],[17.5,1,1.5]);mesh(s,box,steel,[0,0,11.6],[17.5,1,1.5]);
  mesh(s,box,concrete,[0,-1.7,0],[15,2,23]);
  // Visible structural depth: columns, pitched crossbeams, service catwalks and rails.
  const structures=[];
  for(const x of [-12,12])for(const z of [-14,-4,6,16]){
    structures.push({p:[x,6,z],s:[.45,12,.6]});structures.push({p:[x,11.7,z],s:[1.8,.3,1.1]});
    beam(s,[x,2,z],[x,7,z+4],.1,rust);
  }
  for(const z of [-14,-4,6])structures.push({p:[0,11.3,z],s:[25,.5,.5]});
  instances(s,box,steel,structures);
  for(const x of [-9.5,9.5]) {
    mesh(s,box,steel,[x,3,-4],[2,.22,24]);
    for(const side of [-.9,.9]){beam(s,[x+side,4,-16],[x+side,4,8],.045,trim);for(let z=-15;z<9;z+=3)beam(s,[x+side,3,z],[x+side,4,z],.035,trim);}
  }
  const ribs=[];for(let z=-15;z<9;z+=.5)for(const x of [-9.5,9.5])ribs.push({p:[x,3.13,z],s:[1.7,.03,.06]});instances(s,box,trim,ribs);
  const pipes=[{points:[[-13,8,-10],[-6,8,-10],[-5,7,-9],[-5,3.5,-7],[-4,3.5,-6]],r:.45},
    {points:[[13,10,-14],[7,10,-14],[6,9,-12],[6,5,-5],[5,4.3,-3],[4,4.3,-3]],r:.34},
    {points:[[-13,6,8],[-7,6,8],[-6,5.5,6],[-3,4.8,5],[-2,4.8,4]],r:.28}];
  pipes.forEach(({points,r})=>{
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));mesh(s,new T.TubeGeometry(curve,64,r,16,false),steel);
    const end=points.at(-1);mesh(s,new T.TorusGeometry(r*1.25,.075,8,24),trim,end,[1,1,1],[0,Math.PI/2,0]);
  });
  const amber=new T.MeshBasicMaterial({color:0xffac4b}),cyan=new T.MeshBasicMaterial({color:0x80e1ee});
  for(const x of [-11.65,11.65])for(const z of [-10,0,10]){
    mesh(s,box,amber,[x,7,z],[.13,1.1,.16]);sprite(s,w.glow,0xffad52,[x,7,z],3,.2);
  }
  for(const x of [-7.35,7.35])mesh(s,box,cyan,[x,.58,0],[.07,.04,20]);
  point(s,0xff9943,370,[-7,6,-8],30);point(s,0xffb766,240,[8,5,8],30);point(s,0x54dfff,170,[5,3,-8],28);
  // Rear reactor and illuminated windows anchor the perspective.
  mesh(s,box,concrete,[0,7,-19],[32,14,1]);
  for(let x=-12;x<14;x+=4){mesh(s,box,amber,[x,8,-18.4],[2.5,3,.05]);mesh(s,box,steel,[x,8,-18.2],[.09,3,.15]);}
  mesh(s,new T.CylinderGeometry(2.7,2.7,7,48),rust,[0,4.5,-15]);
  mesh(s,new T.TorusGeometry(2.72,.08,8,64),amber,[0,6.9,-15],[1,1,1],[Math.PI/2,0,0]);
  const bolts=[];for(let z=-10;z<=10;z+=2)for(const x of [-7.7,7.7])bolts.push({p:[x,.56,z],s:[.1,.05,.1]});instances(s,new T.CylinderGeometry(1,1,1,6),trim,bolts);
  w.cameraHome={position:[10.7,7.8,19],target:[0,1,-2]};
  w.water=new LiquidSurface({scene:'foundry',quality:w.quality,color:0x335369,lightDirection:[-8,17,2],lightColor:0xffd5a0,width:16,length:24});
  w.sources=[{x:-3.95,z:-6,y:3.5},{x:4,z:-3,y:4.3},{x:-2,z:4,y:4.8}];
}

function leafTexture() {
  const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#ffffff';x.beginPath();x.moveTo(32,2);x.bezierCurveTo(58,16,59,46,32,62);x.bezierCurveTo(5,46,6,16,32,2);x.fill();
  x.strokeStyle='#b6c2a2';x.lineWidth=1.5;x.beginPath();x.moveTo(32,5);x.lineTo(32,59);x.stroke();
  for(let y=15;y<50;y+=8){x.beginPath();x.moveTo(32,y+5);x.lineTo(14,y-3);x.moveTo(32,y+5);x.lineTo(50,y-3);x.stroke();}
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
}
function forest(w,random) {
  const s=w.scene;s.background=new T.Color(0xb5cfc2);s.fog=new T.FogExp2(0x7f9f8b,.014);
  const sun=lighting(s,0xd8e7d1,0x26351a,.85,0xffecd0,[-10,19,-11],3.3);
  sun.shadow.mapSize.set(2048,2048);
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:/* glsl */`
    varying vec3 vDirection;
    void main(){vec3 d=normalize(vDirection);float h=smoothstep(-.1,.8,d.y);
      vec3 c=mix(vec3(.54,.66,.57),vec3(.31,.53,.66),h);
      float sun=pow(max(dot(d,normalize(vec3(-10.,19.,-11.))),0.),48.);c+=vec3(.7,.55,.28)*sun;
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`});
  const sky=mesh(s,new T.SphereGeometry(85,24,16),skyMat,[0,0,0]);sky.castShadow=false;sky.receiveShadow=false;sky.renderOrder=-5;
  const ground=stone(0x68684a,true),rock=stone(0x8e9281,true),bark=barkMaterial(),g=rockGeometry();
  const terrainHeight=(x,z)=>{
    const bank=5.2+Math.sin(z*.28)*.65+Math.sin(z*.6)*.25,land=Math.max(0,Math.abs(x)-bank+.4);
    return -.9+Math.min(land*1.2,2.5)+Math.sin(x*.6+z*.3)*.22+Math.cos(z*.8)*.16+(z<-10?3.5:0);
  };
  const terrain=new T.PlaneGeometry(52,64,90,100),p=terrain.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=-p.getY(i),y=terrainHeight(x,z);
    p.setZ(i,y);
  }
  terrain.computeVertexNormals();mesh(s,terrain,ground,[0,0,0],[1,1,1],[-Math.PI/2,0,0]);
  const rocks=[];
  for(let i=0;i<115;i++){
    const z=-18+random()*43,side=random()<.5?-1:1,x=side*(5.2+Math.sin(z*.28)*.65+random()*1.6);
    rocks.push({p:[x,.15+random()*.35,z],s:[.35+random()*1.2,.3+random()*.9,.4+random()*1.3],r:[random(),random()*6,random()]});
  }
  for(let i=0;i<24;i++){
    const x=(random()-.5)*18,z=-11-random()*3;
    if(Math.abs(x)<2.2)continue;
    rocks.push({p:[x,1.4+random(),z],s:[1+random()*1.8,1.5+random()*2,1+random()*1.5],r:[random()*.5,random()*6,0]});
  }
  for(let i=0;i<20;i++){
    const x=-16+i*1.7;
    if(Math.abs(x)<2.6)continue;
    rocks.push({p:[x,1.7,-11.7-random()],s:[1.5+random(),2+random()*.7,1.3+random()],r:[0,random()*6,random()*.2]});
  }
  // Riverbed stones remain visible through the moving refraction.
  for(let i=0;i<95;i++)rocks.push({p:[(random()-.5)*9,-.65,-9+random()*36],s:[.12+random()*.4,.12+random()*.18,.15+random()*.4],r:[random(),random()*6,random()]});
  instances(s,g,rock,rocks);
  const trunks=[],leaves=[];
  for(let i=0;i<35;i++){
    const side=i%2?-1:1,x=side*(8+random()*14),z=-30+random()*46,y=terrainHeight(x,z),h=9+random()*7,r=.23+random()*.34;
    trunks.push({p:[x,y+h*.5,z],s:[r,h,r],r:[(random()-.5)*.08,random()*6,(random()-.5)*.08]});
    for(let b=0;b<4;b++){
      const a=random()*TAU,len=2+random()*2.5,by=y+h*(.52+b*.1),bx=x+Math.cos(a)*len*.5,bz=z+Math.sin(a)*len*.5;
      const direction=new T.Vector3(Math.cos(a)*len,1.7,Math.sin(a)*len),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());
      trunks.push({p:[bx,by+.85,bz],s:[r*.42,direction.length(),r*.42],q:q.toArray()});
      const cx=x+Math.cos(a)*len,cy=by+1.7,cz=z+Math.sin(a)*len;
      for(let l=0;l<140;l++){
        const az=random()*TAU,u=random()*2-1,rr=2.8*Math.cbrt(random()),cp=Math.sqrt(1-u*u);
        leaves.push({p:[cx+Math.cos(az)*rr*cp,cy+u*rr*.65,cz+Math.sin(az)*rr*cp],s:[.4+random()*.6,.35+random()*.65,1],r:[random()*3,random()*6,random()*6],color:new T.Color().setHSL(.21+random()*.07,.52,.16+random()*.13).getHex()});
      }
    }
  }
  instances(s,new T.CylinderGeometry(.65,1,1,12,6),bark,trunks);
  const leafMap=leafTexture(),leafMat=new T.MeshStandardMaterial({color:0xffffff,map:leafMap,alphaTest:.5,side:T.DoubleSide,roughness:.85});
  const wind={value:0};w.wind=wind;
  leafMat.onBeforeCompile=sh=>{sh.uniforms.windTime=wind;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(windTime*.8+instanceMatrix[3].x*.6+instanceMatrix[3].z)*.09*uv.y;');};
  instances(s,new T.PlaneGeometry(1,1),leafMat,leaves);
  const ferns=[];
  for(let i=0;i<95;i++){
    const z=-9+random()*35,side=i%2?-1:1,x=side*(6.3+random()*1.6);
    for(let j=0;j<8;j++)ferns.push({p:[x+Math.sin(j)*.35,.6+random()*.35,z+Math.cos(j)*.35],s:[.16,.7+random()*.5,1],r:[-.5+random(),j*.8,Math.sin(j)*.9],color:0x68883c});
  }
  instances(s,new T.PlaneGeometry(1,1),leafMat,ferns);
  // Curved grass blades share one GPU batch along both riverbanks.
  const blades=new T.BufferGeometry();
  blades.setAttribute('position',new T.Float32BufferAttribute([-.045,0,0,.045,0,0,-.028,.35,.055,.028,.35,.055,0,.75,.19],3));
  blades.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],3));
  blades.setIndex([0,1,2,1,3,2,2,3,4]);
  const grass=[];
  for(let i=0;i<6500;i++){
    const z=-9+random()*37,bank=5.2+Math.sin(z*.28)*.65+Math.sin(z*.6)*.25,x=(i%2?1:-1)*(bank+.6+random()*6.5),h=.22+random()*.5;
    grass.push({p:[x,terrainHeight(x,z),z],s:[.7+random(),h,1],r:[0,random()*TAU,0],color:new T.Color().setHSL(.2+random()*.05,.45,.13+random()*.12).getHex()});
  }
  const grassMat=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide});
  const grasses=instances(s,blades,grassMat,grass);grasses.castShadow=false;
  // A mossy fallen trunk, partly submerged near the far bank.
  beam(s,[-7,1.3,-3],[-2,.1,-6],.33,bark);
  for(let i=0;i<4;i++)beam(s,[-6+i,1-i*.2,-3-i*.6],[-5+i,1.5-i*.2,-2.5-i*.6],.07,bark);
  point(s,0xffedb3,80,[-4,6,-8],25);
  // Subtle shafts of morning light, with transparent edges rather than opaque cones.
  const shafts=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv; void main(){ float a=pow(sin(vUv.x*3.14159),3.)*sin(vUv.y*3.14159)*.055;gl_FragColor=vec4(.98,.88,.59,a); }'});
  for(let i=0;i<4;i++)mesh(s,new T.PlaneGeometry(.7+random(),18),shafts,[-7+i*3,7,-9+i*2],[1,1,1],[0,0,-.5]);
  w.cameraHome={position:[4.2,4.6,18.7],target:[0,1,-6]};
  w.water=new LiquidSurface({scene:'forest',quality:w.quality,color:0x367b69,lightDirection:[-10,19,-11],lightColor:0xffefd3,width:14,length:48});
  w.sources=[{x:-1.3,z:-9,y:4.4},{x:0,z:-8.8,y:4.4},{x:1.3,z:-9,y:4.4}];
  const driftLeaves=[];
  const driftMat=new T.MeshStandardMaterial({color:0xca944d,map:leafMap,alphaTest:.4,side:T.DoubleSide,roughness:.7});
  for(let i=0;i<12;i++){const m=mesh(s,new T.PlaneGeometry(.24,.4),driftMat,[(random()-.5)*7,.07,-8+random()*28],[1,1,1],[-Math.PI/2,0,random()*6]);m.castShadow=false;driftLeaves.push({m,x:m.position.x,start:m.position.z});}
  w.updateLeaves=time=>{for(const l of driftLeaves){l.m.position.z=-8+((l.start+8+time*.35)%30);l.m.position.x=l.x+Math.sin(time*.5+l.start)*.4;l.m.position.y=.075+Math.sin(time+l.start)*.025;l.m.rotation.z=time*.06+l.start;}};
}

export class Landscape {
  constructor(kind,seed,quality) {
    this.kind=kind;this.quality=quality;this.scene=new T.Scene();this.scene.environment=environment(kind);this.glow=glowTexture();
    const random=rng(seed ^ (kind==='forest'?1451:kind==='foundry'?6293:19));
    ({grotto,foundry,forest})[kind](this,random);
    this.scene.add(this.water.mesh);
    this.effects=new LiquidEffects(this.scene,this.water,random,kind,this.sources);
    this.updateDust=dust(this.scene,random,kind,this.glow);
    if(kind==='forest'){
      this.refraction=new T.WebGLRenderTarget(quality.reflection,quality.reflection,{type:T.HalfFloatType});
      this.water.uniforms.uRefract.value=this.refraction.texture;this.water.uniforms.uHasRefraction.value=1;
    }
  }
  update(time,activity) {
    this.effects.update(time,activity);this.water.update(time,activity);this.updateDust(time);
    if(this.wind)this.wind.value=time;if(this.updateLeaves)this.updateLeaves(time);
  }
  refract(renderer,camera) {
    if(!this.refraction)return;
    const previous=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate;
    this.water.mesh.visible=false;renderer.shadowMap.autoUpdate=false;
    renderer.setRenderTarget(this.refraction);renderer.render(this.scene,camera);
    renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadow;this.water.mesh.visible=true;
  }
  dispose() {
    this.water.dispose();this.refraction?.dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set([this.glow,this.scene.environment]);
    this.scene.traverse(o=>{
      if(o===this.water.mesh)return;
      if(o.geometry)geometries.add(o.geometry);
      if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}
      if(o.shadow)o.shadow.dispose();
      if(o.isInstancedMesh)o.dispose();
    });
    for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}
    for(const g of geometries)g.dispose();for(const t of textures)t?.dispose();this.scene.clear();
  }
}
