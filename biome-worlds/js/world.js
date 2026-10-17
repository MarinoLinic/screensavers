import * as THREE from '../vendor/three.module.min.js';
import { random, riverX, riverDistance, coastHeight, islandHeight } from './config.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const noise = (x, z) => .12 * Math.sin(x * 1.8 + z * .6) + .08 * Math.cos(z * 2.2 - x);

export class World {
  constructor(biome, settings, deferBuild=false) {
    this.biome = biome; this.settings = settings; this.rng = random(biome.seed);
    this.root = new THREE.Group(); this.root.name = biome.id;
    this.geometries = new Set(); this.materials = new Map(); this.shapes = new Map();
    this.batches = new Map(); this.animations = []; this.waterUniforms = [];
    this.treeSites = []; this.creatures = []; this.atmosphere = new THREE.Group();
    this.root.add(this.atmosphere); this.height = () => 0; this.time = 0;
    this.palette = this.colors();
    if(deferBuild)return;
    this[biome.id]();
    this.batch();
    this.weather();
    this.atmosphere.visible = settings.atmosphere;
  }
  colors() {
    const palettes = {
      mediterranean: { land:'#a1aa75', stone:'#c2b89d', foliage:'#64835e', dark:'#455940', water:'#4dabae', deep:'#398690', flower:'#b7a0c7' },
      forest: { land:'#91a763', stone:'#87927b', foliage:'#557b4d', dark:'#355b45', water:'#65a5a2', deep:'#397c83', flower:'#bba5dc' },
      desert: { land:'#dcb17a', stone:'#bd8058', foliage:'#6b927a', dark:'#426b61', water:'#54a3a3', deep:'#497d86', flower:'#cc796c' },
      jungle: { land:'#66845e', stone:'#526f69', foliage:'#387662', dark:'#23594c', water:'#65b7b1', deep:'#388985', flower:'#d898a9' },
      tundra: { land:'#dce5db', stone:'#819397', foliage:'#7d957c', dark:'#576f71', water:'#82c5cf', deep:'#5e9cab', flower:'#c2a1b9' },
      steppe: { land:'#b2ad6e', stone:'#aca18b', foliage:'#b5a968', dark:'#7e9258', water:'#6faba2', deep:'#5b928e', flower:'#cebc8d' },
      river: { land:'#93a56d', stone:'#9ca48a', foliage:'#749263', dark:'#426958', water:'#6caead', deep:'#4b979b', flower:'#c7adcb' },
      marine: { land:'#668b8c', stone:'#4e777f', foliage:'#559d93', dark:'#3b7978', water:'#448c9c', deep:'#316573', flower:'#d28ba1' },
      island: { land:'#efe0b4', stone:'#bab298', foliage:'#64a56f', dark:'#397c63', water:'#72c9c6', deep:'#43aeb6', flower:'#e79b92' },
      moon: { land:'#a8acb0', stone:'#797f8d', foliage:'#96adbf', dark:'#525d70', water:'#6a96b1', deep:'#4e718b', flower:'#c7af74' }
    };
    return palettes[this.biome.id];
  }
  color(value) {
    const c = new THREE.Color(value);
    if (this.settings.aesthetic === 'porcelain') c.lerp(new THREE.Color('#eaded8'), .42);
    if (this.settings.aesthetic === 'nocturne') {
      c.lerp(new THREE.Color('#54618d'), .38);
      c.multiplyScalar(.86);
    }
    return c;
  }
  mat(value, options = {}) {
    const key = value + JSON.stringify(Object.fromEntries(Object.entries(options).map(([k,v])=>[k,v?.isTexture?v.uuid:v])));
    if (!this.materials.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color:this.color(value), roughness:.85, flatShading:true, ...options });
      this.materials.set(key,m);
    }
    return this.materials.get(key);
  }
  geometry(kind) {
    if (!this.shapes.has(kind)) {
      const shapes = {
        rock:()=>new THREE.IcosahedronGeometry(1,0), soft:()=>new THREE.IcosahedronGeometry(1,1),
        sphere:()=>new THREE.SphereGeometry(1,14,9), box:()=>new THREE.BoxGeometry(1,1,1),
        cone:()=>new THREE.ConeGeometry(1,1,9), cylinder:()=>new THREE.CylinderGeometry(1,1,1,10),
        trunk:()=>new THREE.CylinderGeometry(.72,1,1,8), leaf:()=>this.leafGeometry(),
        grass:()=>this.grassGeometry()
      };
      const g = shapes[kind](); this.shapes.set(kind,g); this.geometries.add(g);
    }
    return this.shapes.get(kind);
  }
  mesh(geo, material, parent = this.root) {
    this.geometries.add(geo);
    const m = new THREE.Mesh(geo,material); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  solid(kind, color, x, y, z, sx=1, sy=sx, sz=sx, rotation=0, parent=null, options={}) {
    const geo = this.geometry(kind); const mat = typeof color === 'string' ? this.mat(color,options) : color;
    const obj = new THREE.Object3D(); obj.position.set(x,y,z); obj.scale.set(sx,sy,sz);
    if (Array.isArray(rotation)) obj.rotation.set(...rotation); else obj.rotation.y = rotation;
    obj.updateMatrix();
    if (parent) { const m = this.mesh(geo,mat,parent); m.position.copy(obj.position); m.scale.copy(obj.scale); m.rotation.copy(obj.rotation); return m; }
    const key = geo.uuid + mat.uuid;
    if (!this.batches.has(key)) this.batches.set(key,{geo,mat,matrices:[]});
    this.batches.get(key).matrices.push(obj.matrix.clone());
    return obj;
  }
  batch() {
    for (const {geo,mat,matrices} of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(geo,mat,matrices.length);
      matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); this.root.add(mesh);
    }
    this.batches.clear();
  }
  segment(a,b,r,color,parent=null) {
    const mid = a.clone().add(b).multiplyScalar(.5), delta = b.clone().sub(a);
    const obj = new THREE.Object3D(); obj.position.copy(mid); obj.scale.set(r,delta.length(),r);
    obj.quaternion.setFromUnitVectors(v3(0,1,0),delta.normalize()); obj.updateMatrix();
    const geo = this.geometry('trunk'), mat = this.mat(color);
    if (parent) { const mesh = this.mesh(geo,mat,parent); mesh.position.copy(mid); mesh.scale.copy(obj.scale); mesh.quaternion.copy(obj.quaternion); }
    else { const key=geo.uuid+mat.uuid; if (!this.batches.has(key)) this.batches.set(key,{geo,mat,matrices:[]}); this.batches.get(key).matrices.push(obj.matrix.clone()); }
  }
  leafGeometry() {
    const positions=[],indices=[];
    for(let i=0;i<=10;i++) {
      const t=i/10, width=.27*Math.sin(Math.PI*t)**.7;
      positions.push(t*3, .7*Math.sin(t*Math.PI)-t*t*.7, -width, t*3,.7*Math.sin(t*Math.PI)-t*t*.7,width);
      if(i<10){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  grassGeometry() {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.09,0,0,.09,0,0,.08,.9,0,0,.6,-.07,0,.6,.07,.13,.95,0],3));g.computeVertexNormals();return g;
  }
  terrain(height, land=this.palette.land, radius=13, variation=.09) {
    this.height=height; this.radius=radius;
    const positions=[],colors=[],indices=[]; const rings=28,steps=96;
    const center=this.color(land);
    for(let r=0;r<=rings;r++) for(let a=0;a<steps;a++) {
      const theta=a/steps*TAU, dist=r/rings*radius;
      const x=Math.cos(theta)*dist,z=Math.sin(theta)*dist,y=height(x,z);
      positions.push(x,y,z);
      const c=center.clone().multiplyScalar(1 + variation*Math.sin(x*1.2+z*1.8) + variation*.5*Math.cos(z*3.4-x*.7));
      colors.push(c.r,c.g,c.b);
      if(r<rings){const i=r*steps+a,j=r*steps+(a+1)%steps,k=i+steps,l=j+steps;indices.push(i,j,k,j,l,k);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});this.materials.set('terrain',mat);this.mesh(g,mat);
    const sidePos=[],sideCol=[],sideIndices=[];const stone=this.color(this.palette.stone);
    for(let layer=0;layer<=4;layer++) for(let i=0;i<steps;i++) {
      const t=i/steps*TAU,x=Math.cos(t)*radius,z=Math.sin(t)*radius;
      const top=height(x,z), y=layer===0?top:Math.min(top-.08,-.45-layer*.52);
      // Keep the upper cliff vertical so the water cap cannot peek through a dry bank.
      const radial=layer<2?1:1-(layer-1)*(.088/3);
      sidePos.push(x*radial,y,z*radial);
      const c=stone.clone().multiplyScalar([.95,.83,.91,.76,.65][layer]);sideCol.push(c.r,c.g,c.b);
      if(layer<4){const a=layer*steps+i,b=layer*steps+(i+1)%steps;sideIndices.push(a,b,a+steps,b,b+steps,a+steps);}
    }
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sidePos,3));sg.setAttribute('color',new THREE.Float32BufferAttribute(sideCol,3));sg.setIndex(sideIndices);sg.computeVertexNormals();this.mesh(sg,mat);
    this.solid('cylinder',this.palette.stone,0,-2.55,0,radius*.912,.18,radius*.912);
  }
  water(y=.38,radius=12.96,center=[0,0],color=this.palette.water) {
    const g=new THREE.CircleGeometry(radius,96);g.rotateX(-Math.PI/2);
    const uniforms={time:{value:0},a:{value:this.color(color)},b:{value:this.color(this.palette.deep)}};
    const mat = new THREE.MeshStandardMaterial({color:this.color(color),roughness:.3,metalness:.18,side:THREE.DoubleSide});
    mat.onBeforeCompile = shader => {
      shader.uniforms.uTime=uniforms.time; shader.uniforms.waterA=uniforms.a;shader.uniforms.waterB=uniforms.b;
      shader.vertexShader='uniform float uTime; varying vec3 wPos;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += .024*sin(position.x*1.4+uTime*.7)*sin(position.z*1.7-uTime*.5); wPos=transformed;');
      shader.fragmentShader='uniform float uTime; uniform vec3 waterA; uniform vec3 waterB; varying vec3 wPos;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float n=sin(wPos.x*.45+sin(wPos.z*.55+uTime*.14))*cos(wPos.z*.5-uTime*.12);
        float shimmer=pow(max(0.,sin(wPos.x*2.4+wPos.z*3.1+uTime*.65)*sin(wPos.z*4.2-uTime*.7)),18.);
        diffuseColor.rgb=mix(waterA,waterB,.24+.23*n)+vec3(shimmer*.15);`);
    };
    this.materials.set('water'+this.waterUniforms.length,mat);this.waterUniforms.push(uniforms);
    const m=this.mesh(g,mat);m.position.set(center[0],y,center[1]);m.castShadow=false;
    return m;
  }
  path(points,width,color, yOffset=.04) {
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>v3(x,this.height(x,z)+yOffset,z)));
    const pos=[],indices=[];
    for(let i=0;i<=100;i++){
      const p=curve.getPoint(i/100), tangent=curve.getTangent(i/100), side=v3(-tangent.z,0,tangent.x).normalize().multiplyScalar(width/2);
      for(const sign of [-1,1]){const x=p.x+side.x*sign,z=p.z+side.z*sign;pos.push(x,this.height(x,z)+yOffset,z);}
      if(i<100){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();this.mesh(g,this.mat(color,{side:THREE.DoubleSide})).castShadow=false;
  }
  rocks(count=45, predicate=()=>true,size=.55) {
    for(let i=0;i<count;i++) {
      const x=(this.rng()-.5)*24,z=(this.rng()-.5)*24;
      if(Math.hypot(x,z)>12.6||!predicate(x,z))continue;
      const s=size*(.4+this.rng());this.solid('rock',this.palette.stone,x,this.height(x,z)+s*.28,z,s,s*.65,s*.8,[this.rng(),this.rng()*TAU,this.rng()*.3]);
    }
  }
  tree(x,z,s=1,kind='oak') {
    const y=this.height(x,z); this.treeSites.push({x,z,y,kind});
    const p=this.palette,wood=this.biome.id==='jungle'?'#776954':'#867059';
    if(kind==='palm'){
      const tilt=.6*s;this.segment(v3(x,y,z),v3(x+tilt,y+4.1*s,z),.15*s,wood);
      for(let a=0;a<9;a++)this.solid('leaf',a%2?p.foliage:p.dark,x+tilt,y+4.1*s,z,s,s,s,a/9*TAU,null,{side:THREE.DoubleSide});
      for(let a=0;a<3;a++)this.solid('sphere','#a28862',x+tilt+Math.cos(a*2)*.2*s,y+3.9*s,z+Math.sin(a*2)*.2*s,.14*s);
      return;
    }
    if(kind==='cypress'||kind==='pine'){
      this.solid('trunk',wood,x,y+1.6*s,z,.12*s,3.2*s,.12*s);
      if(kind==='cypress')this.solid('soft',p.dark,x,y+2.8*s,z,.58*s,2.1*s,.58*s);
      else for(let i=0;i<4;i++)this.solid('cone',i%2?p.foliage:p.dark,x,y+(1.4+i*.72)*s,z,(1.3-i*.22)*s,1.7*s,(1.3-i*.22)*s);
      return;
    }
    const tall=kind==='willow'?3.5:3.1;
    this.segment(v3(x,y,z),v3(x+.2*s,y+tall*s,z),.21*s,wood);
    const branches=kind==='willow'?7:5;
    for(let a=0;a<branches;a++){
      const angle=a/branches*TAU + .4,reach=(kind==='willow'?1.4:1.1)*s;
      const tx=x+Math.cos(angle)*reach,tz=z+Math.sin(angle)*reach,ty=y+(tall-.2+this.rng()*.7)*s;
      this.segment(v3(x,y+2*s,z),v3(tx,ty,tz),.09*s,wood);
      this.solid('soft',a%2?p.foliage:p.dark,tx,ty+.35*s,tz,1.13*s,kind==='willow'?1.22*s:.98*s,1.08*s,angle);
      if(kind==='willow')for(let j=0;j<3;j++){
        const dx=Math.cos(angle+j)*.55*s,dz=Math.sin(angle+j)*.55*s;
        this.solid('soft',p.foliage,tx+dx,ty-.85*s,tz+dz,.28*s,1.16*s,.28*s);
      }
    }
    this.solid('soft',p.foliage,x,y+(tall+.7)*s,z,1.3*s,1.15*s,1.25*s);
  }
  vegetation(count,predicate=()=>true,tall=.4,flowers=false) {
    const mat=this.mat(this.palette.foliage,{side:THREE.DoubleSide});
    mat.onBeforeCompile=shader=>{
      const uniform={value:0};shader.uniforms.uWind=uniform;this.windUniforms??=[];this.windUniforms.push(uniform);
      shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uWind*1.5 + instanceMatrix[3].x*.9 + instanceMatrix[3].z*.7)*.13*position.y*position.y;');
    };
    for(let i=0;i<count;i++){
      const x=(this.rng()-.5)*25,z=(this.rng()-.5)*25;
      if(Math.hypot(x,z)>12.5||!predicate(x,z))continue;
      const y=this.height(x,z),s=tall*(.5+this.rng());
      this.solid('grass',mat,x,y+.01,z,s,s,s,this.rng()*TAU);
      if(flowers&&i%9===0){this.solid('soft',this.palette.flower,x,y+s*.8,z,.095,.065,.095);}
    }
  }
  fern(x,z,s=1) {
    const y=this.height(x,z);
    for(let i=0;i<7;i++)this.solid('leaf',i%2?this.palette.dark:this.palette.foliage,x,y+.1,z,s*.35,s*.55,s*.65,i/7*TAU,null,{side:THREE.DoubleSide});
  }
  fauna(x,z,kind='deer',s=.55) {
    const group=new THREE.Group();this.root.add(group);const y=this.height(x,z);group.position.set(x,y,z);group.rotation.y=this.rng()*TAU;
    const color=kind==='saiga'?'#ad9573':'#a8856c';
    this.solid('soft',color,0,.67*s,0,.62*s,.32*s,.26*s,0,group);
    this.segment(v3(.42*s,.65*s,0),v3(.65*s,1.15*s,0),.14*s,color,group);
    this.solid('soft',color,.73*s,1.12*s,0,.24*s,.18*s,.15*s,0,group);
    this.solid('soft','#efe2c3',.91*s,1.08*s,0,.15*s,.12*s,.13*s,0,group);
    const legs=[];
    for(const dx of [-.37,.35])for(const dz of [-.18,.18])legs.push(this.solid('trunk','#6d6153',dx*s,.31*s,dz*s,.055*s,.62*s,.055*s,0,group));
    for(const sign of [-1,1]){
      this.segment(v3(.72*s,1.24*s,sign*.12*s),v3(.67*s,1.55*s,sign*.21*s),.025*s,'#65584d',group);
      if(kind==='deer')this.segment(v3(.7*s,1.42*s,sign*.17*s),v3(.51*s,1.52*s,sign*.25*s),.019*s,'#65584d',group);
      this.solid('soft',color,.55*s,1.25*s,sign*.18*s,.14*s,.05*s,.08*s,0,group);
    }
    const phase=this.rng()*TAU;
    this.animations.push(t=>{group.rotation.z=Math.sin(t*.8+phase)*.015; legs.forEach((leg,i)=>leg.rotation.z=Math.sin(t*.9+phase+i*Math.PI)*.04);});
    this.creatures.push(kind);
  }
  birds(count=5) {
    for(let i=0;i<count;i++){
      const group=new THREE.Group();this.atmosphere.add(group);
      const left=this.solid('cone','#e8e5cf',-.17,0,0,.22,.04,.09,[0,0,-.16],group);
      const right=this.solid('cone','#e8e5cf',.17,0,0,.22,.04,.09,[0,0,.16],group);
      const phase=this.rng()*TAU,r=5+this.rng()*5;
      this.animations.push(t=>{const a=t*.045+phase;group.position.set(Math.cos(a)*r,6.2+i*.45,Math.sin(a)*r);group.rotation.y=-a-Math.PI/2;left.rotation.z=-.2+Math.sin(t*2.8+phase)*.3;right.rotation.z=-left.rotation.z;});
    }
  }
  butterflies(count=7) {
    for(let i=0;i<count;i++){
      const group=new THREE.Group();this.atmosphere.add(group);const phase=this.rng()*TAU;
      const x=(this.rng()-.5)*15,z=(this.rng()-.5)*15;
      const l=this.solid('sphere',i%2?'#d3ba7b':'#8ccbd0',-.08,0,0,.1,.025,.16,0,group),r=this.solid('sphere',i%2?'#d3ba7b':'#8ccbd0',.08,0,0,.1,.025,.16,0,group);
      this.animations.push(t=>{group.position.set(x+Math.sin(t*.45+phase),Math.max(this.height(x,z),.4)+1.3+Math.sin(t*.7+phase)*.5,z+Math.cos(t*.4+phase));group.rotation.y=t*.3+phase;l.rotation.z=Math.sin(t*10+phase)*.85;r.rotation.z=-l.rotation.z;});
    }
  }
  house(x,z,s=1,angle=0,tower=false) {
    const group=new THREE.Group();group.position.set(x,this.height(x,z),z);group.rotation.y=angle;this.root.add(group);
    const h=tower?4.7:1.8;
    this.solid('box','#e8d6b5',0,h*s/2,0,1.55*s,h*s,1.25*s,0,group);
    // A gabled roof, authored as a triangular prism rather than a cone.
    const roof=new THREE.BufferGeometry();const w=.94*s,d=.8*s,base=h*s,peak=base+.72*s;
    roof.setAttribute('position',new THREE.Float32BufferAttribute([-w,base,-d,w,base,-d,0,peak,-d,-w,base,d,w,base,d,0,peak,d],3));
    roof.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);roof.computeVertexNormals();this.mesh(roof,this.mat('#bc7c65'),group);
    this.solid('box','#655f51',0,.53*s,.632*s,.3*s,1.06*s,.035,0,group);
    const windowMaterial=this.settings.aesthetic==='nocturne'?this.mat('#ffe1a1',{emissive:'#efb764',emissiveIntensity:1.2}):this.mat('#578187');
    for(const wx of [-.44,.44])this.solid('box',windowMaterial,wx*s,(tower?3.4:1.24)*s,.638*s,.27*s,.4*s,.035,0,group);
    if(!tower){this.solid('box','#9c826a',.45*s,(h+.15)*s,-.25*s,.18*s,.8*s,.2*s,0,group);}
    // Move static village meshes into global instance batches, including their group transform.
    group.updateMatrixWorld(true);
    for(const m of [...group.children])if(m.isMesh&&this.shapes.has('box')&&m.geometry===this.shapes.get('box')){
      const key=m.geometry.uuid+m.material.uuid;if(!this.batches.has(key))this.batches.set(key,{geo:m.geometry,mat:m.material,matrices:[]});this.batches.get(key).matrices.push(m.matrixWorld.clone());group.remove(m);
    }
  }
  boat(x,z,y=.55,s=1) {
    const group=new THREE.Group();this.root.add(group);group.position.set(x,y,z);group.rotation.y=.5;
    this.solid('soft','#ead5b3',0,0,0,.95*s,.16*s,.3*s,0,group);
    this.solid('trunk','#86725c',0,.85*s,0,.025,1.8*s,.025,0,group);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,.25*s,0,0,1.65*s,0,-.8*s,.25*s,0],3));g.computeVertexNormals();this.mesh(g,this.mat('#f0e7cd',{side:THREE.DoubleSide}),group);
    this.animations.push(t=>{group.position.y=y+Math.sin(t*.8)*.04;group.rotation.z=Math.sin(t*.7)*.035;group.position.x=x+Math.sin(t*.03)*.65;});
  }
  mediterranean() {
    const h=(x,z)=>Math.max(-.65,coastHeight(x,z)+noise(x,z)*.38);
    this.terrain(h);this.water();
    this.path([[1,-10],[2,-6],[5,-3],[6,1],[5,7]],.58,'#d5c8a1');
    // Dry-stone terraces follow the inland slope. No tree is allowed below the shore.
    for(const z of [3,6,8])for(let x=1;x<9;x+=.6)if(Math.hypot(x,z)<11.5)this.solid('rock','#b6b09a',x,h(x,z)+.18,z,.37,.22,.3);
    [[4,-3,1.05],[6,-2,.8],[7,1,.9],[5,2,.8],[3,0,.72],[7,4,.68],[8,-4,.68]].forEach(([x,z,s],i)=>this.house(x,z,s,-.25+(i%3)*.35));
    this.house(4.6,-.6,.62,-.25,true);
    for(const [x,z,s,kind] of [[9,0,.8,'cypress'],[2,4,.65,'oak'],[4,6,.6,'oak'],[7,7,.6,'oak'],[2,8,.63,'oak'],[9,-5,.72,'pine'],[0,7,.65,'cypress'],[8,3,.75,'cypress'],[1,-5,.55,'oak']])if(h(x,z)>.6)this.tree(x,z,s,kind);
    this.vegetation(800,(x,z)=>h(x,z)>.65 && (x<1||z>4||x>8),.28,true);
    this.rocks(95,(x,z)=>h(x,z)>.28,.5);this.boat(-5,-3,.5,.85);this.birds(5);
    for(let i=0;i<5;i++)this.solid('box','#b5aa91',1+i*.37,h(1+i*.37,-8)+.13,-8,.35,.14,.6);
  }
  forest() {
    const h=(x,z)=>.7 + .3*Math.sin(x*.35)*Math.cos(z*.28) - 1.05*Math.exp(-((x+1.5)**2+(z+1.5)**2)/7)+noise(x,z)*.2;
    this.terrain(h);this.water(.22,2.7,[-1.5,-1.5]);
    this.path([[-4,-11],[-5,-6],[-4,-2],[-5,3],[0,6],[5,9]],.62,'#c3b58b');
    const trees=[[-9,-3,.95],[-7,1,1.1],[-9,5,.95],[-4,6,.85],[1,7,.78],[6,6,1.1],[8,2,.95],[7,-4,.9],[3,-7,.8],[-8,-8,.8],[10,-1,.8]];
    trees.forEach(([x,z,s],i)=>this.tree(x,z,s,i%4===0?'pine':'oak'));
    this.vegetation(2000,(x,z)=>Math.hypot(x+1.5,z+1.5)>3.1,.45,true);
    for(let i=0;i<32;i++){const x=(this.rng()-.5)*21,z=(this.rng()-.5)*21;if(Math.hypot(x,z)<11&&Math.hypot(x+1.5,z+1.5)>3.4)this.fern(x,z,.5+this.rng()*.5);}
    this.segment(v3(2,h(2,1)+.2,1),v3(5,h(5,2)+.2,2),.28,'#86735d');
    this.fauna(3,-2,'deer',.8);this.fauna(4,-.6,'deer',.57);this.rocks(60,(x,z)=>Math.hypot(x+1.5,z+1.5)>2.8,.43);this.butterflies(9);
  }
  desert() {
    const h=(x,z)=>.38+Math.sin(x*.35+z*.24)*.43+Math.sin(z*.6-x*.22)*.32+Math.exp(-((x-3)**2+(z-3)**2)/30)*.8;
    this.terrain(h,this.palette.land,13,.035);
    // Arch is a contiguous open-bottom rock ribbon, with faceted stratified bands.
    const pos=[],col=[],ind=[],steps=32;
    for(let i=0;i<=steps;i++){
      const a=i/steps*Math.PI;
      for(const [radius,depth] of [[3.15,-.65],[3.15,.65],[4.38,-.85],[4.38,.85]]){
        const x=Math.cos(a)*radius+1.2,y=Math.sin(a)*radius+1.2,z=depth+2.1;
        pos.push(x,y,z);const c=this.color(this.palette.stone).multiplyScalar(.9+.14*Math.sin(y*6));col.push(c.r,c.g,c.b);
      }
      if(i<steps){const k=i*4;for(const [u,v]of[[0,1],[1,3],[3,2],[2,0]])ind.push(k+u,k+v,k+4+u,k+v,k+4+v,k+4+u);}
    }
    ind.push(0,2,1,1,2,3,steps*4,steps*4+1,steps*4+2,steps*4+1,steps*4+3,steps*4+2);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ind);g.computeVertexNormals();const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1});this.materials.set('arch',m);this.mesh(g,m);
    for(const [x,z,s]of[[-8,4,2.6],[8,5,2.3],[6,8,1.9],[-4,8,2.1]]){
      for(let i=0;i<4;i++)this.solid('rock',i%2?'#c38d61':'#be835a',x,h(x,z)+i*.72*s,z,s*(1-i*.13),.58*s,s*(1-i*.1),[.08,i*.2,.1]);
    }
    const cactus=(x,z,s)=>{const y=h(x,z);this.solid('trunk',this.palette.foliage,x,y+s,z,.19*s,2*s,.19*s);for(const sign of[-1,1]){this.segment(v3(x,y+.8*s,z),v3(x+sign*.55*s,y+.8*s,z),.12*s,this.palette.foliage);this.solid('trunk',this.palette.foliage,x+sign*.55*s,y+1.12*s,z,.12*s,.7*s,.12*s);}};
    [[-6,-5,.85],[5,-6,.6],[8,-1,.65],[-3,-8,.5],[-9,0,.65]].forEach(p=>cactus(...p));
    this.rocks(100,()=>true,.32);this.vegetation(130,()=>true,.2);
    this.birds(3);
  }
  jungle() {
    const h=(x,z)=>.5+4.6*Math.exp(-((x-1)**2/22+(z+4.5)**2/6))+.5*Math.sin(x*.35+z*.2)-.8*Math.exp(-((x-.4)**2+(z-2.1)**2)/10)+noise(x,z)*.4;
    this.terrain(h);this.water(.35,3.2,[.4,2.1]);
    for(const[x,z,s]of[[-8,1,1.1],[-6,5,1.05],[-3,7,1.1],[5,7,.9],[8,3,1.1],[7,-3,1.1],[-7,-5,.95],[-3,-7,.8],[4,-8,.8]])this.tree(x,z,s,'palm');
    for(const[x,z,s]of[[-9,-1,1.05],[6,1,1.2],[-5,2,.85]])this.tree(x,z,s);
    this.vegetation(1800,(x,z)=>h(x,z)>.5,.65,true);
    for(let i=0;i<55;i++){const x=(this.rng()-.5)*22,z=(this.rng()-.5)*22;if(Math.hypot(x,z)<12&&h(x,z)>.5)this.fern(x,z,.8);}
    this.rocks(90,(x,z)=>h(x,z)>.3,.6);
    this.cascade(1,-3.2,h(1,-3.2)+.06,.4,2.1);
    this.butterflies(12);this.birds(4);
  }
  cascade(x,z,top,bx,bz) {
    const p=[],uv=[],indices=[];const segments=40;
    for(let i=0;i<=segments;i++){
      const t=i/segments,yy=.37+(top-.37)*(1-t),zz=z+(bz-z)*t*t,xx=x+(bx-x)*t;
      p.push(xx-.55,yy,zz,xx+.55,yy,zz);uv.push(0,t,1,t);if(i<segments){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const uniform={value:0};this.waterUniforms.push({time:uniform});
    const mat=new THREE.MeshStandardMaterial({color:this.color('#a9e1d8'),roughness:.28,side:THREE.DoubleSide,emissive:this.color('#477f79'),emissiveIntensity:.18});
    // Standard materials only provide vUv when a texture is present. Supply UV explicitly.
    mat.onBeforeCompile=shader=>{shader.uniforms.uTime=uniform;shader.vertexShader='varying vec2 fallUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfallUv=uv;');shader.fragmentShader='uniform float uTime; varying vec2 fallUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat streak=pow(.5+.5*sin(fallUv.x*57.+sin(fallUv.y*11.-uTime*4.)*2.),5.); diffuseColor.rgb += vec3(streak*.28);');};
    this.materials.set('cascade',mat);this.mesh(g,mat).castShadow=false;
    for(let i=0;i<34;i++){
      const m=this.solid('sphere','#c0e5d9',0,0,0,.055,.13,.055,0,this.atmosphere),phase=this.rng(),dx=(this.rng()-.5)*1.1;
      this.animations.push(t=>{const f=(t*.48+phase)%1;m.position.set(bx+dx,.4+Math.sin(f*Math.PI)*.7,bz+(f-.5)*1.2);m.scale.setScalar(.07*(1-f)+.015);});
    }
    this.solid('soft','#a9d8ce',bx,.42,bz,1,.025,.6);
  }
  tundra() {
    const h=(x,z)=>.65+5.4*Math.exp(-((x+3)**2/14+(z+5.5)**2/7))+4.1*Math.exp(-((x-5)**2/11+(z+5)**2/8))-.82*Math.exp(-((x-1)**2+(z-2)**2)/15)+noise(x,z)*.3;
    this.terrain(h);this.water(.28,4.15,[1,2]);
    this.rocks(100,(x,z)=>h(x,z)>.55&&Math.hypot(x+4,z)>1.5&&Math.hypot(x+5,z-1)>1.3,.6);
    for(const[x,z,s]of[[-3,-6,2.8],[5,-5,2.35],[-8,-3,1.5]]){
      this.solid('rock',this.palette.stone,x,h(x,z)-s*.5,z,s,s*.7,s);
      this.solid('rock','#e7ebe3',x,h(x,z)+s*.1,z,s*.82,s*.45,s*.84);
    }
    this.vegetation(360,(x,z)=>h(x,z)<1.3&&h(x,z)>.55,.16);
    this.fauna(-4,0,'deer',.8);this.fauna(-5,1,'deer',.55);
    for(const[x,z]of[[-1,1],[2,4],[4,1]])this.solid('rock','#c3e1e2',x,.34,z,.7,.12,.45);
  }
  steppe() {
    const h=(x,z)=>.7+.55*Math.sin(x*.24+z*.16)+.33*Math.cos(z*.43)+noise(x,z)*.15;
    this.terrain(h);this.path([[-10,-6],[-5,-4],[1,-2],[3,3],[7,9]],.46,'#d1bd91');
    this.vegetation(4900,(x,z)=>Math.abs(x-z*.7)>1,.6,true);
    this.rocks(65,(x,z)=>z>5||x<-7,.42);
    for(const[x,z,s]of[[-8,4,1.6],[-7,5,1.2],[-9,6,.95]])this.solid('rock',this.palette.stone,x,h(x,z)+s*.28,z,s,s*.8,s);
    [[-2,-4,.8],[-3,-2,.65],[1,2,.7],[3,-5,.65],[-4,0,.45]].forEach(([x,z,s])=>this.fauna(x,z,'saiga',s));this.birds(7);
  }
  river() {
    const h=(x,z)=>{const d=riverDistance(x,z);return -.5+1.25*clamp((d-1.3)/1.65,0,1)+.24*Math.sin(x*.4+z*.15)*clamp((d-2.4)/1,0,1)+noise(x,z)*.1;};
    this.terrain(h);this.water(.28);
    // Banks are a single continuous terrain; all trunks and roots are set back from the wet channel.
    for(const z of[-8,-3,3,8])for(const side of[-1,1]){const x=riverX(z)+side*(4.4+(z%3)*.1);if(Math.hypot(x,z)<11)this.tree(x,z,.7+this.rng()*.25,'willow');}
    this.vegetation(2200,(x,z)=>riverDistance(x,z)>3.25,.4,true);
    this.vegetation(450,(x,z)=>riverDistance(x,z)>2.7&&riverDistance(x,z)<3.2,.95);
    this.rocks(120,(x,z)=>riverDistance(x,z)>2.45,.4);
    const cz=1.3,cx=riverX(cz); // Bridge crosses at one fixed section, above both banks.
    for(let i=0;i<=22;i++){const x=cx-3.4+i*.31;this.solid('box','#a08764',x,1.02+Math.sin(i/22*Math.PI)*.3,cz,.3,.14,1.03);}
    for(const sign of[-1,1]){
      for(const dx of[-3.3,-2.1,-.8,.8,2.1,3.3])this.solid('trunk','#8b755a',cx+dx,1.4,cz+sign*.54,.045,.95,.045);
      this.segment(v3(cx-3.4,1.7,cz+sign*.54),v3(cx+3.4,1.7,cz+sign*.54),.045,'#8b755a');
    }
    this.path([[cx-3.7,1.3],[-6,3],[-8,7]],.5,'#c3b893');
    // Ducks follow the centerline rather than crossing through solid banks.
    for(let i=0;i<4;i++){
      const g=new THREE.Group();this.root.add(g);this.solid('sphere','#bbae8a',0,0,0,.22,.14,.12,0,g);this.solid('sphere','#477766',.16,.14,0,.09,.1,.09,0,g);this.solid('cone','#d5b773',.25,.13,0,.055,.14,.045,[0,0,-Math.PI/2],g);
      this.animations.push(t=>{const z=-8+((t*.12+i*1.4)%16);g.position.set(riverX(z)+Math.sin(i)*.6,.35,z);g.rotation.y=-Math.atan2(.84*Math.cos(z*.31),1)+Math.PI/2;});this.creatures.push('duck');
    }
    this.birds(5);
  }
  marine() {
    const h=(x,z)=>.25+noise(x,z)*.3+.9*Math.exp(-((x+4)**2+(z-4)**2)/30);
    this.terrain(h);
    this.rocks(150,()=>true,.7);
    const coralColors=['#cc94a6','#d4ad79','#9babc7','#83b5aa'];
    for(let i=0;i<43;i++){
      const x=(this.rng()-.5)*22,z=(this.rng()-.5)*22;if(Math.hypot(x,z)>11.8)continue;const y=h(x,z),s=.5+this.rng()*.8,color=coralColors[i%4];
      if(i%3===0){for(let j=0;j<4;j++)this.solid('soft',color,x+Math.cos(j*2)*s*.3,y+.3+j*.19,z+Math.sin(j*2)*s*.3,s*.5,.18,s*.5);}
      else{const tip=v3(x,y+1.5*s,z);this.segment(v3(x,y,z),tip,.12*s,color);for(let j=0;j<4;j++){const a=j/4*TAU;this.segment(v3(x,y+.6*s,z),v3(x+Math.cos(a)*.6*s,y+(1.1+j*.15)*s,z+Math.sin(a)*.6*s),.075*s,color);}}
    }
    for(let i=0;i<21;i++){
      const x=(this.rng()-.5)*23,z=(this.rng()-.5)*23;if(Math.hypot(x,z)>12||Math.hypot(x,z)<5)continue;const height=3+this.rng()*2;
      this.segment(v3(x,h(x,z),z),v3(x+.3,h(x,z)+height,z),.045,this.palette.dark);
      for(let j=1;j<6;j++)this.solid('leaf',this.palette.foliage,x+j*.05,h(x,z)+j*height/6,z,.33,.35,.7,j*.9,null,{side:THREE.DoubleSide});
    }
    for(let i=0;i<22;i++)this.fish(i);
    for(let i=0;i<4;i++)this.jelly(i);
    this.vegetation(950,()=>true,.3);
    // Transparent tapered shafts are geometry, confined to the underwater scene.
    const beamMat=this.mat('#b9e2df',{transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide,emissive:'#a4d8d9',emissiveIntensity:.35});
    for(let i=0;i<4;i++){const m=this.mesh(new THREE.CylinderGeometry(.15,1.2,10,16,1,true),beamMat,this.atmosphere);m.position.set(-6+i*4,5,4);m.rotation.z=-.25;m.castShadow=false;m.receiveShadow=false;}
  }
  fish(index) {
    const group=new THREE.Group();this.root.add(group);const colors=['#dfbf7d','#89bfca','#d19d9c','#a2b4d3'];
    const s=.3+(index%4)*.05;
    this.solid('sphere',colors[index%4],0,0,0,s*1.15,s*.43,s*.28,0,group);
    const tail=this.solid('cone',colors[index%4],-s*1.26,0,0,s*.35,s*.68,s*.15,[0,0,Math.PI/2],group);
    this.solid('sphere','#334853',s*.65,s*.12,s*.23,.035,.035,.02,0,group);
    const phase=index*.6,r=3.8+index%6*.7;
    this.animations.push(t=>{const a=t*(.08+(index%3)*.01)+phase;group.position.set(Math.cos(a)*r,2+(index%5)*.65+Math.sin(t*.7+phase)*.16,Math.sin(a)*r*.75);group.rotation.y=-a-Math.PI/2;tail.rotation.y=Math.sin(t*5+phase)*.3;});this.creatures.push('fish');
  }
  jelly(index) {
    const group=new THREE.Group();this.root.add(group);const phase=index*1.7;
    const m=this.mesh(new THREE.SphereGeometry(.46,14,9,0,TAU,0,Math.PI*.62),this.mat('#d1c0d7',{transparent:true,opacity:.65,emissive:'#bfa8cc',emissiveIntensity:.3}),group);m.castShadow=false;
    const legs=[];for(let j=0;j<7;j++){
      const a=j/7*TAU;legs.push(this.solid('trunk','#c1b5d3',Math.cos(a)*.28,-.75,Math.sin(a)*.28,.016,1.35,.016,0,group));
    }
    this.animations.push(t=>{group.position.set(Math.cos(phase)*6.5,4.1+Math.sin(t*.38+phase)*.45,Math.sin(phase)*5);m.scale.setScalar(1+Math.sin(t*1.8+phase)*.06);legs.forEach((leg,i)=>leg.rotation.z=Math.sin(t*.9+phase+i)*.15);});this.creatures.push('jelly');
  }
  island() {
    const h=(x,z)=>islandHeight(x,z)+noise(x,z)*.06;
    this.terrain(h);this.water(.53);
    for(const[x,z,s]of[[-2,0,.8],[.3,1,1.1],[2,3,.85],[-3,3,.9],[2,-2,.7],[-2,-2,.7]])if(h(x,z)>.75)this.tree(x,z,s,'palm');
    this.vegetation(650,(x,z)=>h(x,z)>1,.23,true);this.rocks(45,(x,z)=>h(x,z)>.5&&h(x,z)<.85,.4);
    const hut=new THREE.Group();hut.position.set(-1,h(-1,1),1);hut.rotation.y=.3;this.root.add(hut);
    for(const x of[-.65,.65])for(const z of[-.5,.5])this.solid('trunk','#ac8b60',x,.65,z,.07,1.3,.07,0,hut);
    this.solid('box','#c6a578',0,.5,0,1.6,.14,1.3,0,hut);
    this.solid('cone','#ba9c6b',0,1.7,0,1.4,1.1,1.25,Math.PI/4,hut);
    // A small jetty runs off the sandy edge into the lagoon.
    for(let i=0;i<12;i++){const z=-3-i*.38;this.solid('box','#bd9e70',.7,.86,z,1.1,.12,.34);if(i%3===0)for(const x of[.2,1.2])this.solid('trunk','#917755',x,.43,z,.055,.85,.055);}
    this.boat(3.5,-6,.61,.68);this.birds(6);
    for(let i=0;i<26;i++){const a=i/26*TAU,r=5.55+.2*Math.sin(a*3);const x=Math.cos(a)*r*1.16-.5,z=Math.sin(a)*r/1.13;this.solid('soft','#c9e7d9',x,.553,z,.21,.013,.08,-a);}
  }
  moon() {
    const craters=[[-4,-3,2.1],[4,3,2.5],[-7,5,1.6],[6,-5,1.4],[0,8,1.35]];
    const h=(x,z)=>{let y=.65+noise(x,z)*.35;for(const[cx,cz,r]of craters){const d=Math.hypot(x-cx,z-cz)/r;y-=.6*Math.exp(-d*d*2.5);y+=.32*Math.exp(-(((d-1)*5)**2));}return y;};
    this.terrain(h);this.rocks(170,()=>true,.44);
    const y=h(1,-1),gold='#bd9f65';
    this.solid('box',gold,1,y+1.05,-1,1.35,1.25,1.35,Math.PI/4);
    this.solid('cylinder','#dbdfe0',1,y+1.9,-1,.65,.53,.65);
    this.solid('cone','#d2d8dc',1,y+2.36,-1,.65,.4,.65);
    this.solid('box','#426378',1.48,y+1.85,-1.42,.5,.23,.045,-Math.PI/4);
    for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const end=v3(1+Math.cos(a)*1.5,y+.09,-1+Math.sin(a)*1.5);this.segment(v3(1+Math.cos(a)*.5,y+.8,-1+Math.sin(a)*.5),end,.045,'#d6d4c8');this.solid('cylinder',gold,end.x,end.y,end.z,.24,.08,.24);
    }
    for(const[x,z]of[[-2,2],[0,3]]){
      this.solid('trunk','#a2a5aa',x,h(x,z)+.55,z,.04,1,.04);
      this.solid('box','#47647f',x,h(x,z)+1,z,1.6,.06,1,[.2,0,0]);
      for(let i=0;i<5;i++)this.solid('box','#8aa4b8',x-.65+i*.32,h(x,z)+1.04,z,.015,.02,.94,[.2,0,0]);
    }
    const rover=new THREE.Group();rover.position.set(4,h(4,-2)+.2,-2);this.root.add(rover);
    this.solid('box','#d1cbb5',0,.2,0,.85,.3,.65,0,rover);
    for(const x of[-.3,.3])for(const z of[-.45,.45])this.solid('cylinder','#566170',x,0,z,.16,.1,.16,[Math.PI/2,0,0],rover);
    this.solid('trunk','#d7d5c3',0,.75,0,.025,.8,.025,0,rover);
    this.solid('sphere','#d7d5c3',0,1.1,0,.23,.06,.23,[.5,0,0],rover);
    // Earth is a geometry-only globe with low-poly continents, outside the diorama.
    const earth=new THREE.Group();earth.position.set(-5,10.6,-11);this.root.add(earth);
    this.solid('sphere','#719ac1',0,0,0,1.28,1.28,1.28,0,earth);
    const continents=[
      [[-10,36],[3,60],[20,72],[45,65],[75,72],[140,50],[160,65],[170,48],[120,15],[106,5],[78,7],[55,25],[40,40],[25,35]],
      [[-18,35],[0,37],[20,33],[38,10],[50,0],[32,-28],[20,-35],[10,-25],[-8,5]],
      [[-168,70],[-135,72],[-125,55],[-125,32],[-102,18],[-83,9],[-65,45],[-54,58],[-72,80],[-100,82]],
      [[-80,9],[-50,4],[-34,-8],[-46,-24],[-68,-55],[-77,-20]],
      [[112,-11],[139,-10],[154,-25],[147,-39],[116,-33]],
      [[-53,83],[-24,76],[-45,60],[-60,62]]
    ];
    const inside=(x,y,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
    const globe=(lon,lat)=>{const a=lon*Math.PI/180,b=lat*Math.PI/180,r=1.292;return[r*Math.cos(b)*Math.sin(a),r*Math.sin(b),r*Math.cos(b)*Math.cos(a)];};
    const patch=[],patchIndices=[];
    for(let lon=-180;lon<180;lon+=3)for(let lat=-87;lat<87;lat+=3)if(continents.some(poly=>inside(lon+1.5,lat+1.5,poly))){
      const i=patch.length/3;patch.push(...globe(lon,lat),...globe(lon+3,lat),...globe(lon,lat+3),...globe(lon+3,lat+3));patchIndices.push(i,i+1,i+2,i+1,i+3,i+2);
    }
    const continentsGeometry=new THREE.BufferGeometry();continentsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(patch,3));continentsGeometry.setIndex(patchIndices);continentsGeometry.computeVertexNormals();this.mesh(continentsGeometry,this.mat('#93b29f',{side:THREE.DoubleSide}),earth);
    const polar=new THREE.SphereGeometry(1.295,20,5,0,TAU,0,.31);this.mesh(polar,this.mat('#dce3de'),earth);
    earth.traverse(m=>{if(m.isMesh){m.castShadow=false;m.receiveShadow=false;}});
    this.animations.push(t=>earth.rotation.y=t*.008);
  }
  weather() {
    if(this.biome.id==='moon'||this.settings.aesthetic==='nocturne'){
      const positions=[];for(let i=0;i<120;i++)positions.push((this.rng()-.5)*70,8+this.rng()*25,-12-this.rng()*15);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.geometries.add(g);
      const mat=new THREE.PointsMaterial({color:'#eef1e8',size:.055,transparent:true,opacity:.65});this.materials.set('stars',mat);this.atmosphere.add(new THREE.Points(g,mat));
      if(this.biome.id==='moon')return;
    }
    const count=this.biome.id==='tundra'?220:this.biome.id==='marine'?130:65;
    const positions=new Float32Array(count*3),base=new Float32Array(count*3);
    for(let i=0;i<count;i++){base[i*3]=(this.rng()-.5)*26;base[i*3+1]=this.rng()*9+.3;base[i*3+2]=(this.rng()-.5)*26;}
    positions.set(base);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));this.geometries.add(g);
    const nocturne=this.settings.aesthetic==='nocturne';
    const mat=new THREE.PointsMaterial({color:this.biome.id==='tundra'?'#ffffff':nocturne?'#efe4a3':'#faf2d8',size:this.biome.id==='tundra'?.065:.045,transparent:true,opacity:this.biome.id==='tundra'?.65:.5,depthWrite:false});this.materials.set('particles',mat);
    this.atmosphere.add(new THREE.Points(g,mat));
    this.animations.push(t=>{if(!this.atmosphere.visible)return;for(let i=0;i<count;i++){positions[i*3]=base[i*3]+Math.sin(t*.17+i)*.4;positions[i*3+1]=this.biome.id==='tundra'?(base[i*3+1]-t*.18%10+10)%10:(base[i*3+1]+t*.065)%9;positions[i*3+2]=base[i*3+2]+Math.cos(t*.15+i)*.3;}g.attributes.position.needsUpdate=true;});
    if(['desert','marine','tundra'].includes(this.biome.id))return;
    const cloudMat=this.mat('#f3f2e7',{transparent:true,opacity:.7,depthWrite:false});
    for(let i=0;i<3;i++){
      const group=new THREE.Group();this.atmosphere.add(group);
      for(let j=0;j<4;j++){const m=this.solid('soft',cloudMat,j*.8,Math.sin(j*2)*.15,0,.9,.3,.5,0,group);m.castShadow=false;m.receiveShadow=false;}
      const x=-8+i*6,z=5+i*.7;
      this.animations.push(t=>group.position.set(x+Math.sin(t*.035+i)*1.2,8.5+i*.4,z));
    }
  }
  update(t) {
    this.time=t;for(const uniform of this.waterUniforms)uniform.time.value=t;
    for(const uniform of this.windUniforms||[])uniform.value=t;
    for(const animate of this.animations)animate(t);
  }
  dispose() {
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials.values())material.dispose();
    this.geometries.clear();this.materials.clear();this.animations.length=0;
    this.root.clear();
  }
}
