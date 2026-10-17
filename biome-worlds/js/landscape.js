import * as THREE from '../vendor/three.module.min.js';
import { Reflector } from '../vendor/Reflector.js';
import { World } from './world.js';
import { BUILDERS } from './landscapes.js';

export const TAU=Math.PI*2;
export const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const hill=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-((x-cx)**2/rx**2+(z-cz)**2/rz**2));
export const terrainNoise=(x,z)=>Math.sin(x*.16+z*.12)*.45+Math.cos(z*.24-x*.08)*.28+Math.sin(x*.69+z*.48)*.08;

export class Landscape extends World {
  constructor(biome,settings){
    super(biome,settings,true);
    this.mode='landscape';this.textures=new Map();this.reflections=[];this.ripples=[];this.effects=[];this.windUniforms=[];
    this.view={position:[0,4.5,28],target:[0,4,-22],fov:49};
    this.light={sun:[-35,65,30],intensity:3,ambient:1.7};
    this.night=settings.aesthetic==='nocturne'||biome.id==='moon';
    this.fog=new THREE.FogExp2(this.night?'#172736':'#9bb7ad',.009);
    this.interaction=biome.id==='moon'?'surface':biome.id==='desert'?'dust':'pollen';
    BUILDERS[biome.id](this);
    this.batch();this.weather();this.atmosphere.visible=settings.atmosphere;this.update(0);
  }
  mat(color,options={}){
    return super.mat(color,{flatShading:this.settings.aesthetic==='porcelain',roughness:.91,...options});
  }
  geometry(kind){
    if(!['grass','broadleaf'].includes(kind))return super.geometry(kind);
    if(this.shapes.has(kind))return this.shapes.get(kind);
    const positions=[],indices=[];
    if(kind==='grass'){
      for(let blade=0;blade<3;blade++){
        const angle=blade*2.1,h=.75+blade*.13,lean=.12+blade*.045,k=positions.length/3;
        for(const[x,y,z]of[[-.025,0,0],[.025,0,0],[-.014,h*.62,lean*.45],[.014,h*.62,lean*.45],[0,h,lean]])positions.push(x*Math.cos(angle)-z*Math.sin(angle),y,x*Math.sin(angle)+z*Math.cos(angle));
        indices.push(k,k+1,k+2,k+1,k+3,k+2,k+2,k+3,k+4);
      }
    }else{
      positions.push(0,0,0,.3,.06,-.17,.3,.12,0,.3,.06,.17,.7,.08,-.17,.7,.16,0,.7,.08,.17,1,0,0);
      indices.push(0,1,2,0,2,3,1,4,2,2,4,5,2,5,3,3,5,6,4,7,5,5,7,6);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();this.shapes.set(kind,g);this.geometries.add(g);return g;
  }
  grain(kind='stone'){
    if(this.textures.has(kind))return this.textures.get(kind);
    const size=128,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const n=Math.sin(x*12.9898+y*78.233)*43758.5453,f=n-Math.floor(n);
      const stripes=kind==='bark'?(Math.sin(x*.41+Math.sin(y*.09))*.15):kind==='sand'?Math.sin(y*.33+Math.sin(x*.05)*2)*.08:0;
      const value=Math.round(clamp(.8+(f-.5)*.25+stripes,.3,1)*255),i=(y*size+x)*4;data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;
    }
    const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;this.textures.set(kind,t);return t;
  }
  surface(height,{width=220,depth=240,z=-65,color=this.palette.land,shade=null}={}){
    this.height=height;this.bounds={width,depth,z};
    const g=new THREE.PlaneGeometry(width,depth,180,160);g.rotateX(-Math.PI/2);g.translate(0,0,z);
    const a=g.attributes.position,colors=[];
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),zz=a.getZ(i),y=height(x,zz);a.setY(i,y);
      const c=this.color(shade?shade(x,zz,y):color).multiplyScalar(.92+.06*Math.sin(x*.72+zz*.51)+.04*Math.cos(x*1.7-zz*.9));colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:this.grain(this.biome.id==='desert'?'sand':'stone'),bumpMap:this.grain('stone'),bumpScale:.14});this.materials.set('ground',mat);
    const m=this.mesh(g,mat);m.castShadow=false;
  }
  sky(low='#d8ddd0',high='#6f9cba',sun=[-80,75,-220]){
    if(this.night){low=this.biome.id==='moon'?'#101724':'#25324d';high='#050f21';}
    this.fog.color.set(this.night?'#1a2c42':low);this.background=this.fog.color.clone();
    const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{low:{value:new THREE.Color(low)},high:{value:new THREE.Color(high)}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 low;uniform vec3 high;varying vec3 p;void main(){float h=normalize(p).y;gl_FragColor=vec4(mix(low,high,smoothstep(-.06,.55,h)),1.); #include <colorspace_fragment> }'.replace(' #include','\n#include')});
    this.materials.set('sky',mat);const m=this.mesh(new THREE.SphereGeometry(550,32,20),mat);m.castShadow=false;m.receiveShadow=false;m.renderOrder=-100;
    if(!['marine','moon'].includes(this.biome.id)){
      const disc=this.mesh(new THREE.SphereGeometry(this.night?7:9,24,16),new THREE.MeshBasicMaterial({color:this.night?'#e2e7da':'#fff2ce',fog:false}));this.materials.set('sun',disc.material);disc.position.set(...sun);disc.castShadow=false;
    }
    if(this.night){const positions=[];for(let i=0;i<700;i++)positions.push((this.rng()-.5)*500,15+this.rng()*260,-100-this.rng()*190);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.geometries.add(g);const mat=new THREE.PointsMaterial({color:'#e8eff3',size:.32,transparent:true,opacity:.8,fog:false});this.materials.set('stars',mat);this.atmosphere.add(new THREE.Points(g,mat));}
  }
  ridge(x,z,width,height,depth,color=this.palette.stone,snow=false){
    const g=new THREE.PlaneGeometry(width*2.6,depth*2.4,38,30);g.rotateX(-Math.PI/2);const a=g.attributes.position,cols=[];
    const peaks=[[-width*.32,-depth*.15,1],[width*.17,depth*.1,.84],[width*.55,-depth*.08,.63]];
    for(let i=0;i<a.count;i++){
      const xx=a.getX(i),zz=a.getZ(i);let h=0;
      for(const[px,pz,s]of peaks){const r=Math.hypot((xx-px)/(width*.85),(zz-pz)/depth);h=Math.max(h,Math.max(0,1-r)**1.25*height*s);}
      h*=1+.055*Math.sin(xx*1.3+zz*.7)+.04*Math.sin(xx*2.8-zz*1.8);a.setXYZ(i,xx+x,this.height(xx+x,zz+z)+h,zz+z);
      const c=this.color(snow&&h>height*.55?'#dde5df':color).multiplyScalar(.88+.1*Math.sin(xx*.6+zz*.2));cols.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,map:this.grain('stone')});this.materials.set('ridge'+this.materials.size,mat);this.mesh(g,mat);
  }
  boulder(x,z,s=1,color=this.palette.stone,y=this.height(x,z)){
    const mat=this.mat(color,{map:this.grain('stone'),bumpMap:this.grain('stone'),bumpScale:.15});
    this.solid('soft',mat,x,y+s*.35,z,s,s*.65,s*.75,[this.rng()*.35,this.rng()*TAU,this.rng()*.4]);
    if(this.biome.id==='forest'||this.biome.id==='jungle'||this.biome.id==='river')this.solid('soft',this.palette.dark,x,y+s*.72,z,s*.82,s*.08,s*.54);
  }
  scatterRocks(count,predicate=()=>true,range=[-35,35,-65,20],size=1){
    const [x1,x2,z1,z2]=range;for(let i=0;i<count;i++){const x=x1+this.rng()*(x2-x1),z=z1+this.rng()*(z2-z1);if(predicate(x,z))this.boulder(x,z,size*(.25+this.rng()));}
  }
  bake(group){
    group.updateMatrixWorld(true);
    for(const mesh of [...group.children])if(mesh.isMesh){const key=mesh.geometry.uuid+mesh.material.uuid;if(!this.batches.has(key))this.batches.set(key,{geo:mesh.geometry,mat:mesh.material,matrices:[]});this.batches.get(key).matrices.push(mesh.matrixWorld.clone());group.remove(mesh);}
    this.root.remove(group);
  }
  water(y=0,{width=240,depth=280,x=0,z=-80,color=this.palette.water,flow=.3}={}){
    const shader=THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms);
    shader.uTime={value:0};shader.uBase={value:this.color(color)};shader.uNight={value:this.night?1:0};shader.uRipples={value:Array.from({length:8},()=>new THREE.Vector4(0,0,-100,0))};
    const vertex='uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 waterWorld;void main(){vUv=textureMatrix*vec4(position,1.);waterWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
    const fragment=`uniform sampler2D tDiffuse;uniform vec3 uBase;uniform float uTime;uniform float uNight;uniform vec4 uRipples[8];varying vec4 vUv;varying vec3 waterWorld;
      void main(){vec2 p=waterWorld.xz;float wave=sin(p.x*.43+uTime*.55)*sin(p.y*.7-uTime*${flow.toFixed(2)});float r=0.;
      for(int i=0;i<8;i++){float age=uTime-uRipples[i].z;float dist=length(p-uRipples[i].xy);r+=sin(dist*7.-age*4.)*exp(-abs(dist-age*2.)*1.7)*max(0.,1.-age/6.)*step(0.,age);}
      vec4 uv=vUv;uv.xy+=vec2(wave+r,wave*.5)*.0018*uv.w;vec3 reflection=texture2DProj(tDiffuse,uv).rgb;
      float f=clamp(.26+length(p)*.004,.26,.68);
      float glint=pow(max(0.,sin(p.y*2.3+p.x*.08+sin(p.x*.47+uTime*.2)*.35-uTime*.9)),24.);
      glint*=.018+.028*pow(.5+.5*sin(p.x*.93+p.y*.11),8.);
      vec3 col=mix(uBase,reflection,f)+vec3(glint+r*.035);gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`;
    const g=new THREE.PlaneGeometry(width,depth);const size={low:384,balanced:640,high:1024}[this.settings.quality];
    const m=new Reflector(g,{textureWidth:size,textureHeight:size,clipBias:.005,multisample:0,shader:{uniforms:shader,vertexShader:vertex,fragmentShader:fragment}});
    this.geometries.add(g);this.materials.set('reflection'+this.reflections.length,m.material);this.root.add(m);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=false;m.castShadow=false;
    this.reflections.push(m);this.waterUniforms.push({time:m.material.uniforms.uTime});this.interaction='water';return m;
  }
  foam(points,width=.12,color='#d7e9db'){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>vec(...p)));const m=this.mesh(new THREE.TubeGeometry(curve,90,width,3,false),this.mat(color,{transparent:true,opacity:.5,depthWrite:false}));m.castShadow=false;
  }
  grass(count,predicate=()=>true,{range=[-38,38,-80,24],height=.65,flowers=false,color=this.palette.foliage}={}){
    const geo=this.geometry('grass');const mat=this.mat(color,{side:THREE.DoubleSide});
    if(!mat.userData.wind){mat.userData.wind=true;mat.onBeforeCompile=shader=>{const t={value:0};this.windUniforms.push(t);shader.uniforms.uWind=t;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(uWind*1.3+instanceMatrix[3].x*.7+instanceMatrix[3].z*.3)*.24*position.y*position.y;');};}
    const [a,b,c,d]=range;
    for(let i=0;i<count;i++){
      const x=a+this.rng()*(b-a),z=c+this.rng()*(d-c);if(!predicate(x,z))continue;const y=this.height(x,z),s=height*(.45+this.rng()*.9);this.solid('grass',mat,x,y+.015,z,s*.8,s,s*.8,this.rng()*TAU);
      if(flowers&&i%12===0){this.solid('trunk',this.palette.dark,x,y+s*.5,z,.018,s,.018);for(let j=0;j<4;j++)this.solid('sphere',i%24===0?'#8e8dc4':'#d5c19a',x+Math.cos(j*1.57)*.07,y+s,z+Math.sin(j*1.57)*.07,.08,.055,.08);}
    }
  }
  fern(x,z,s=1){
    const y=this.height(x,z);for(let j=0;j<8;j++){
      const a=j/8*TAU,length=(1+this.rng()*.2)*s;
      for(let k=1;k<10;k++){const t=k/10,dx=Math.cos(a)*length*t,dz=Math.sin(a)*length*t,yy=y+.1+Math.sin(t*Math.PI)*s*.5;for(const sign of[-1,1])this.solid('broadleaf',k%2?this.palette.foliage:this.palette.dark,x+dx,yy,z+dz,s*(1-t)*.55,s*.3,s*.4,[.15,a+sign*1.2,sign*.13],null,{side:THREE.DoubleSide});}
    }
  }
  tree(x,z,s=1,kind='oak'){
    if(kind==='palm')return this.palm(x,z,s);
    const y=this.height(x,z),wood=this.mat('#716047',{map:this.grain('bark'),bumpMap:this.grain('bark'),bumpScale:.18});
    this.treeSites.push({x,z,y,kind});const trunkHeight=(kind==='pine'?8:kind==='cypress'?8:7)*s;
    this.solid('trunk',wood,x,y+trunkHeight/2,z,.42*s,trunkHeight,.42*s);
    if(kind==='pine'){
      for(let i=0;i<6;i++){const h=(2+i)*s;this.solid('cone',i%2?this.palette.foliage:this.palette.dark,x,y+h,z,(3-i*.42)*s,3*s,(3-i*.42)*s);}
      return;
    }
    if(kind==='cypress'){for(let i=0;i<4;i++)this.solid('soft',this.palette.dark,x,y+(3.7+i*1.3)*s,z,(.9-i*.12)*s,2*s,(.9-i*.12)*s);return;}
    for(let i=0;i<5;i++){const a=i/5*TAU;this.segment(vec(x,y+.8*s,z),vec(x+Math.cos(a)*1.9*s,y+.1,z+Math.sin(a)*1.9*s),.17*s,'#716047');}
    const count=kind==='willow'?8:9;
    for(let j=0;j<count;j++){
      const a=j/count*TAU,reach=(2.1+this.rng())*s,tx=x+Math.cos(a)*reach,tz=z+Math.sin(a)*reach,ty=y+(5.5+this.rng()*2)*s;
      this.segment(vec(x,y+3.4*s,z),vec(tx,ty,tz),.17*s,'#716047');
      this.solid('soft',j%2?this.palette.foliage:this.palette.dark,tx,ty+.5*s,tz,2.2*s,1.25*s,2*s,a);
      // Small leaf clusters break the silhouette and add depth inside the canopy.
      for(let k=0;k<40;k++){const aa=k*2.399,latitude=(k/40-.5)*2,rr=Math.sqrt(1-latitude*latitude);this.solid('broadleaf',k%3?'#779c60':this.palette.foliage,tx+Math.cos(aa)*rr*2.2*s,ty+.45*s+latitude*1.25*s,tz+Math.sin(aa)*rr*2*s,.65*s,.5*s,.7*s,[Math.sin(aa)*.6,aa,latitude*.5],null,{side:THREE.DoubleSide});}
      if(kind==='willow')for(let k=0;k<7;k++){
        const aa=a+k*.7,dx=Math.cos(aa)*1.5*s,dz=Math.sin(aa)*1.5*s;
        this.segment(vec(tx+dx,ty,tz+dz),vec(tx+dx+.25*s,ty-3.5*s,tz+dz),.013*s,this.palette.dark);
        for(let n=0;n<9;n++)for(const sign of[-1,1])this.solid('broadleaf',this.palette.foliage,tx+dx+n*.026*s,ty-n*.38*s,tz+dz,.44*s,.35*s,.65*s,[sign*.4,aa,-Math.PI/2+sign*.27],null,{side:THREE.DoubleSide});
      }
    }
    this.solid('soft',this.palette.foliage,x,y+8*s,z,2.7*s,1.55*s,2.5*s);
  }
  palm(x,z,s=1){
    const y=this.height(x,z);this.treeSites.push({x,z,y,kind:'palm'});const top=vec(x+1.8*s,y+10*s,z),wood=this.mat('#9c8565',{map:this.grain('bark')});
    for(let i=0;i<9;i++){
      const t=i/9,a=vec(x+1.8*s*t*t,y+10*s*t,z),b=vec(x+1.8*s*(t+1/9)**2,y+10*s*(t+1/9),z);this.segment(a,b,(.31-t*.12)*s,'#9c8565');
      this.solid('cylinder',wood,a.x,a.y,a.z,(.33-t*.12)*s,.065*s,(.33-t*.12)*s);
    }
    for(let j=0;j<11;j++){
      const angle=j/11*TAU,len=(4.1+this.rng())*s;
      for(let k=1;k<14;k++){
        const t=k/14,xx=top.x+Math.cos(angle)*len*t,zz=top.z+Math.sin(angle)*len*t,yy=top.y+Math.sin(t*Math.PI)*s-len*t*t*.26;
        for(const sign of[-1,1])this.solid('broadleaf',j%2?this.palette.foliage:this.palette.dark,xx,yy,zz,1.25*s*(1-t*.7),.5*s,.75*s,[.15,angle+sign*1.12,sign*.12],null,{side:THREE.DoubleSide});
      }
      this.segment(top,vec(top.x+Math.cos(angle)*len,top.y-len*.26,top.z+Math.sin(angle)*len),.035*s,this.palette.dark);
    }
    for(let i=0;i<5;i++)this.solid('sphere','#977857',top.x+Math.cos(i*1.3)*.4*s,top.y-.3*s,top.z+Math.sin(i*1.3)*.4*s,.23*s);
  }
  vines(x,z,y,len=6){
    const points=[];for(let i=0;i<12;i++)points.push(vec(x+Math.sin(i*.7)*.16,y-i/11*len,z+Math.cos(i*.6)*.13));this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),25,.035,4,false),this.mat(this.palette.dark));
    for(let i=0;i<9;i++)this.solid('soft',this.palette.foliage,x+Math.sin(i*.8)*.15,y-i/9*len,z,.14,.09,.22,i*.7);
  }
  creaturesOnLand(points,kind='deer'){
    for(const[originalX,z,s=1]of points){
      let x=originalX;if(this.reflections.length)for(let i=0;i<10&&this.height(x,z)<.3;i++)x+=x<0?-1.5:1.5;
      super.fauna(x,z,kind,s);const group=this.root.children.at(-1);const phase=this.rng()*TAU;
      // Detailed face, hooves, tail and grazing motion supplement the shared articulated body.
      this.solid('sphere','#243b36',.78*s,1.17*s,.133*s,.025,.025,.016,0,group);
      this.solid('soft','#d9c9a4',-.52*s,.76*s,0,.14*s,.055*s,.11*s,.2,group);
      for(const xx of[-.37,.35])for(const zz of[-.18,.18])this.solid('box','#514b40',xx*s,.045*s,zz*s,.1*s,.09*s,.09*s,0,group);
      this.landAnimalSites??=[];this.landAnimalSites.push({x,z,water:this.reflections.length>0});
      this.animations.push(t=>{let xx=x+Math.sin(t*.04+phase)*.65,zz=z+Math.sin(t*.03+phase)*.45;if(this.reflections.length&&this.height(xx,zz)<.2){xx=x;zz=z;}group.position.set(xx,this.height(xx,zz),zz);group.rotation.y=Math.sin(t*.045+phase)*.25+phase;});
    }
  }
  flyers(count=7,color='#d9e4d8',scale=1){
    for(let i=0;i<count;i++){
      const g=new THREE.Group();this.atmosphere.add(g);const left=this.solid('soft',color,-.32,0,0,.4,.045,.16,0,g),right=this.solid('soft',color,.32,0,0,.4,.045,.16,0,g);this.solid('soft',color,0,0,0,.08,.09,.25,0,g);g.scale.setScalar(scale);
      const phase=this.rng()*TAU,r=9+this.rng()*15,z=-12-this.rng()*32;
      this.animations.push(t=>{const a=t*.06+phase;g.position.set(Math.sin(a)*r,9+Math.sin(a*.7)*2+i*.55,z+Math.cos(a)*6);g.rotation.y=-a;left.rotation.z=Math.sin(t*2.8+phase)*.45;right.rotation.z=-left.rotation.z;});this.creatures.push('bird');
    }
  }
  insects(count=12){
    for(let i=0;i<count;i++){
      const g=new THREE.Group();this.atmosphere.add(g);const color=i%2?'#8cb8d2':'#d9b783';const l=this.solid('sphere',color,-.1,0,0,.12,.02,.16,0,g),r=this.solid('sphere',color,.1,0,0,.12,.02,.16,0,g);const x=(this.rng()-.5)*28,z=(this.rng()-.5)*24,phase=this.rng()*TAU,y=this.height(x,z)+1.5;
      this.animations.push(t=>{g.position.set(x+Math.sin(t*.6+phase),y+Math.sin(t*.7+phase)*.6,z+Math.cos(t*.5+phase));l.rotation.z=Math.sin(t*12+phase);r.rotation.z=-l.rotation.z;});
    }
  }
  clouds(count=12){
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(this.night?'#697a96':'#f0eddf')}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 v;uniform vec3 color;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      void main(){vec2 p=v*2.-1.;float n=noise(v*8.)*.6+noise(v*17.)*.25;float shape=0.;for(int i=0;i<5;i++){float f=float(i);vec2 c=vec2(-.65+f*.32,-.15+sin(f*2.)*.16);shape=max(shape,1.-length((p-c)/vec2(.4,.5)));}float a=smoothstep(.12,.5,shape+n*.1)*.73;a*=smoothstep(0.,.04,v.x)*smoothstep(0.,.04,1.-v.x)*smoothstep(0.,.04,v.y)*smoothstep(0.,.04,1.-v.y);gl_FragColor=vec4(color*(.84+.16*v.y),a);\n#include <colorspace_fragment>\n}`});this.materials.set('clouds',mat);
    for(let i=0;i<count;i++){
      const x=(this.rng()-.5)*240,z=-100-this.rng()*160,yy=43+this.rng()*27,s=2+this.rng()*3,m=this.mesh(new THREE.PlaneGeometry(s*10,s*3),mat,this.atmosphere);m.castShadow=false;m.receiveShadow=false;
      this.animations.push(t=>m.position.set(x+Math.sin(t*.008+i)*8,yy,z));
    }
  }
  weather(){
    const biome=this.biome.id;if(biome==='moon')return;
    const count=biome==='tundra'?650:biome==='marine'?500:180,positions=new Float32Array(count*3),base=new Float32Array(count*3);
    for(let i=0;i<count;i++){base[i*3]=(this.rng()-.5)*70;base[i*3+1]=this.rng()*20;base[i*3+2]=this.rng()*75-50;}positions.set(base);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));this.geometries.add(g);const mat=new THREE.PointsMaterial({color:biome==='tundra'?'#f5f9fa':this.night?'#ebd997':'#efe4c8',size:biome==='tundra'?.065:.045,transparent:true,opacity:biome==='marine'?.32:.55,depthWrite:false});this.materials.set('motes',mat);this.atmosphere.add(new THREE.Points(g,mat));
    this.animations.push(t=>{if(!this.atmosphere.visible)return;for(let i=0;i<count;i++){positions[i*3]=base[i*3]+Math.sin(t*.3+i)*.3;positions[i*3+1]=biome==='tundra'?(base[i*3+1]-t*.32%20+20)%20:(base[i*3+1]+t*.045)%20;positions[i*3+2]=base[i*3+2]+Math.cos(t*.2+i)*.3;}g.attributes.position.needsUpdate=true;});
    if(!['marine','jungle','forest'].includes(biome))this.clouds(biome==='steppe'?15:8);
  }
  click(point){
    const onWater=this.interaction==='water'&&this.reflections.some(r=>Math.abs(point.y-r.position.y)<.15);
    if(onWater){
      this.ripples.push(new THREE.Vector4(point.x,point.z,this.time,1));if(this.ripples.length>8)this.ripples.shift();
      for(const r of this.reflections){const values=r.material.uniforms.uRipples.value;for(let i=0;i<8;i++)values[i].copy(this.ripples[i]||new THREE.Vector4(0,0,-100,0));}
    }
    const color=onWater||this.interaction==='bubbles'?'#c6eef0':this.interaction==='surface'?'#a8b1b7':this.interaction==='dust'?'#e4bd86':'#d7dab0';
    const g=new THREE.BufferGeometry(),positions=new Float32Array(54);g.setAttribute('position',new THREE.BufferAttribute(positions,3));this.geometries.add(g);const m=new THREE.PointsMaterial({color,size:.11,transparent:true,opacity:.8,depthWrite:false});this.materials.set('effect'+m.uuid,m);
    const points=new THREE.Points(g,m);this.root.add(points);const velocities=Array.from({length:18},()=>vec((this.rng()-.5)*1.8,1+this.rng()*1.5,(this.rng()-.5)*1.8));this.effects.push({points,origin:point.clone(),start:this.time,velocities});
    if(this.effects.length>6)this.releaseEffect(this.effects.shift());
  }
  releaseEffect(e){this.root.remove(e.points);e.points.geometry.dispose();e.points.material.dispose();this.geometries.delete(e.points.geometry);this.materials.delete('effect'+e.points.material.uuid);}
  update(t){
    super.update(t);
    for(const effect of [...this.effects]){const age=t-effect.start;if(age>2.5){this.releaseEffect(effect);this.effects.splice(this.effects.indexOf(effect),1);continue;}const a=effect.points.geometry.attributes.position;effect.velocities.forEach((v,i)=>a.setXYZ(i,effect.origin.x+v.x*age,effect.origin.y+v.y*age-age*age*.65,effect.origin.z+v.z*age));a.needsUpdate=true;effect.points.material.opacity=.8*(1-age/2.5);}
  }
  dispose(){for(const r of this.reflections)r.getRenderTarget().dispose();for(const texture of this.textures.values())texture.dispose();this.textures.clear();this.effects.length=0;super.dispose();}
}
