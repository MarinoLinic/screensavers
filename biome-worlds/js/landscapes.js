import * as THREE from '../vendor/three.module.min.js';
import { TAU, vec, clamp, hill, terrainNoise } from './landscape.js';

const mix=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),clamp(t,0,1)).getStyle();
const riverCenter=z=>5*Math.sin(z*.065)+3*Math.sin(z*.024)-2;
export const channelDistance=(x,z)=>Math.abs(x-riverCenter(z));

function trees(w,count,predicate,range=[-55,55,-120,15],scale=1,kind='oak'){
  const[a,b,c,d]=range;
  for(let i=0;i<count;i++){const x=a+w.rng()*(b-a),z=c+w.rng()*(d-c);if(predicate(x,z))w.tree(x,z,scale*(.7+w.rng()*.65),kind);}
}
function ferns(w,count,predicate,range=[-28,28,-30,22],scale=1){const[a,b,c,d]=range;for(let i=0;i<count;i++){const x=a+w.rng()*(b-a),z=c+w.rng()*(d-c);if(predicate(x,z))w.fern(x,z,scale*(.5+w.rng()));}}
function logs(w,x,z,length=6){const y=w.height(x,z);w.segment(vec(x,y+.35,z),vec(x+length,y+.35,z+1),.45,'#79644c');for(let i=0;i<12;i++)w.solid('soft',w.palette.dark,x+w.rng()*length,y+.75,z+.1+w.rng()*.5,.3,.1,.3);for(let i=0;i<6;i++)w.segment(vec(x+i,y+.45,z+.3),vec(x+i+.5,y+1.2,z-.5),.09,'#79644c');}
function reeds(w,count,predicate,range=[-30,30,-55,20]){
  const[a,b,c,d]=range;
  for(let i=0;i<count;i++){const x=a+w.rng()*(b-a),z=c+w.rng()*(d-c);if(!predicate(x,z))continue;const y=w.height(x,z),h=1.3+w.rng();w.solid('trunk','#75905b',x,y+h/2,z,.023,h,.023);w.solid('soft','#775c3e',x,y+h,z,.085,.28,.085);for(let j=0;j<2;j++)w.solid('leaf','#709367',x,y+.4,z,.3,.3,.35,j*2.4,null,{side:THREE.DoubleSide});}
}
function duck(w,x,z,s=.8,trajectory=null){
  const g=new THREE.Group();w.root.add(g);const y=.17;
  w.solid('soft','#baa98a',0,.06,0,.5*s,.25*s,.3*s,0,g);w.solid('soft','#355d56',.32*s,.4*s,0,.18*s,.23*s,.18*s,0,g);w.solid('soft','#dfb65c',.51*s,.36*s,0,.16*s,.06*s,.1*s,0,g);
  w.solid('sphere','#11262a',.4*s,.46*s,.16*s,.025,.025,.02,0,g);w.solid('soft','#637680',-.1*s,.25*s,.22*s,.32*s,.07*s,.12*s,0,g);
  const phase=w.rng()*TAU;w.animations.push(t=>{const p=trajectory?trajectory(t+phase):[x+Math.sin(t*.07+phase)*2,z+Math.cos(t*.07+phase)];g.position.set(p[0],y+Math.sin(t*.8+phase)*.02,p[1]);g.rotation.y=-t*.07-phase;});w.creatures.push('duck');
}
function hare(w,x,z,s=1,color='#a99378'){
  const g=new THREE.Group();w.root.add(g);const y=w.height(x,z);g.position.set(x,y,z);g.rotation.y=-.6;
  w.solid('soft',color,0,.3*s,0,.42*s,.3*s,.23*s,0,g);w.solid('soft',color,.32*s,.52*s,0,.2*s,.18*s,.16*s,0,g);
  for(const sign of[-1,1]){w.solid('soft',color,.28*s,.9*s,sign*.09*s,.055*s,.36*s,.075*s,[0,0,-.16],g);w.solid('soft','#c6b0a6',.3*s,.91*s,sign*.09*s,.026*s,.27*s,.045*s,0,g);w.solid('sphere','#182e30',.4*s,.56*s,sign*.145*s,.025,.025,.02,0,g);}
  w.solid('sphere','#e4dfce',-.39*s,.3*s,0,.12*s,.12*s,.12*s,0,g);const phase=w.rng()*TAU;w.animations.push(t=>{g.position.y=y+Math.max(0,Math.sin(t*.7+phase))*.055;g.rotation.y=-.6+Math.sin(t*.12+phase)*.12;});w.creatures.push('hare');
}
function building(w,x,z,s=2,angle=0,tower=false){
  w.house(x,z,s,angle,tower);const base=w.height(x,z),h=tower?4.7:1.8,g=new THREE.Group();w.root.add(g);g.position.set(x,base,z);g.rotation.y=angle;
  const window=tower?3.4:1.24;
  for(const xx of[-.44,.44])for(const sign of[-1,1])w.solid('box','#4e786e',(xx+sign*.19)*s,window*s,.68*s,.12*s,.46*s,.06*s,0,g);
  w.solid('box','#b5aa8d',0,.05,0,1.7*s,.13*s,1.38*s,0,g);
  // Roof tiles sit on each roof slope in overlapping rows.
  for(const sign of[-1,1])for(let row=0;row<5;row++)for(let col=0;col<7;col++){
    const xx=sign*(.1+row*.17)*s,yy=(h+.69-row*.13)*s,zz=(-.66+col*.22)*s;
    w.solid('cylinder',row%2?'#b27156':'#be7d60',xx,yy,zz,.045*s,.27*s,.045*s,[Math.PI/2,0,sign*.55],g);
  }
  if(tower){for(const xx of[-.25,.25])w.solid('trunk','#d7c29f',xx*s,4*s,.66*s,.07*s,.8*s,.07*s,0,g);w.solid('sphere','#536566',0,4*s,.68*s,.17*s,.3*s,.045,0,g);}
  else{
    w.solid('box','#b5aa93',0,.93*s,.95*s,1.05*s,.08*s,.5*s,0,g);for(let i=0;i<7;i++)w.solid('trunk','#79745e',(-.45+i*.15)*s,1.14*s,1.2*s,.012*s,.38*s,.012*s,0,g);w.solid('box','#79745e',0,1.34*s,1.2*s,1*s,.035*s,.03*s,0,g);
  }
  w.bake(g);
}
function stoneWall(w,points,height=.8){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>vec(x,w.height(x,z),z)));
  const count=Math.ceil(curve.getLength()/.55);
  for(let i=0;i<count;i++){const p=curve.getPoint(i/count);for(let j=0;j<2;j++)w.solid('soft','#aaa28a',p.x,p.y+(j+.5)*height/2,p.z,.34,height*.3,.3,[0,i*.5,0]);}
}
function bridge(w,cx,cz,width=11){
  for(let i=0;i<=36;i++){const x=cx-width/2+i*width/36,y=1.25+Math.sin(i/36*Math.PI)*.7;w.solid('box','#ad8c62',x,y,cz,width/36*.92,.18,2.4);}
  for(const sign of[-1,1])for(let i=0;i<10;i++){const x=cx-width/2+i*width/9,y=1.25+Math.sin(i/9*Math.PI)*.7;w.solid('trunk','#826546',x,y+.55,cz+sign*1.2,.05,1.2,.05);if(i<9)w.segment(vec(x,y+1.05,cz+sign*1.2),vec(x+width/9,1.25+Math.sin((i+1)/9*Math.PI)*.7+1.05,cz+sign*1.2),.045,'#826546');}
}
function waterfall(w,x,z,top,bx,bz,width=4){
  const p=[],uv=[],ind=[],segments=70;
  for(let i=0;i<=segments;i++){const t=i/segments,zz=z+(bz-z)*t,yy=.16+(top-.16)*(1-t)**1.6;for(const sign of[-1,1]){p.push(x+(bx-x)*t+sign*width/2,yy,zz);uv.push(sign<0?0:1,t);}if(i<segments){const k=i*2;ind.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  const t={value:0};w.waterUniforms.push({time:t});
  const m=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{time:t,base:{value:w.color('#8ac3bd')}},vertexShader:'varying vec2 f;void main(){f=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
    varying vec2 f;uniform float time;uniform vec3 base;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),a=fract(p);a=a*a*(3.-2.*a);return mix(mix(hash(i),hash(i+vec2(1,0)),a.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),a.x),a.y);}
    void main(){
      float n=noise(vec2(f.x*23.,f.y*14.-time*2.5));
      float detail=noise(vec2(f.x*64.,f.y*43.-time*7.));
      float streak=pow(noise(vec2(f.x*38.,f.y*3.-time*.65)),3.);
      float foam=smoothstep(.72,1.,f.y)*(.25+n*.3);
      float edge=smoothstep(0.,.07,min(f.x,1.-f.x)-detail*.025);
      vec3 col=mix(base,vec3(.88,.94,.89),.14+n*.27+streak*.5+foam);
      gl_FragColor=vec4(col,edge*(.7+detail*.25));
      #include <colorspace_fragment>
    }`});w.materials.set('fall',m);w.mesh(g,m).castShadow=false;
  for(let i=0;i<45;i++){const obj=w.solid('sphere','#e5eee4',0,0,0,.045,.045,.045,0,w.atmosphere),phase=w.rng();w.animations.push(t=>{const a=(t*.6+phase)%1;obj.position.set(bx+(phase-.5)*width*1.1,.15+Math.sin(a*Math.PI)*1.1,bz+(a-.5)*3);obj.scale.setScalar(.045*(1-a)+.01);});}
  w.foam([[bx-width/2,.17,bz],[bx,.2,bz+1],[bx+width/2,.17,bz]],.13);
}
function lightShafts(w,count,color,height,bottom,start,step,angle){
  // Fade the cone at its silhouette and both ends so it has no visible hard boundary.
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(color)}},vertexShader:'varying vec2 v;varying vec3 n;varying vec3 eye;void main(){v=uv;n=normalMatrix*normal;vec4 p=modelViewMatrix*vec4(position,1.);eye=-p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec2 v;varying vec3 n;varying vec3 eye;uniform vec3 color;void main(){float side=pow(abs(dot(normalize(n),normalize(eye))),2.);float a=side*sin(v.y*3.14159)*.036;gl_FragColor=vec4(color,a);\n#include <colorspace_fragment>\n}'});
  w.materials.set('shafts',m);
  for(let i=0;i<count;i++){const o=w.mesh(new THREE.CylinderGeometry(.3,bottom,height,24,1,true),m,w.atmosphere);o.position.set(start+i*step,height*.48,-12-i*5);o.rotation.z=angle;o.castShadow=false;o.receiveShadow=false;}
}
function strata(w,x,z,radius,height){
  const pos=[],cols=[],ind=[],steps=28,layers=14,base=w.height(x,z);
  for(let l=0;l<=layers;l++)for(let j=0;j<steps;j++){
    const a=j/steps*TAU,r=radius*(.75+.18*Math.sin(l*.75)+.08*Math.sin(a*5+l*.2)),yy=base+l/layers*height;
    pos.push(x+Math.cos(a)*r,yy,z+Math.sin(a)*r*.65);const c=w.color(l%3===0?'#a76649':l%3===1?'#c68a61':'#bd805b').multiplyScalar(.85+.2*Math.cos(a));cols.push(c.r,c.g,c.b);
    if(l<layers){const i=l*steps+j,k=l*steps+(j+1)%steps;ind.push(i,k,i+steps,k,k+steps,i+steps);}
  }
  const center=pos.length/3;pos.push(x,base+height,z);cols.push(...w.color('#d7a074').toArray());for(let j=0;j<steps;j++)ind.push(center,layers*steps+j,layers*steps+(j+1)%steps);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.setIndex(ind);g.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:w.grain('stone'),bumpMap:w.grain('stone'),bumpScale:.2,side:THREE.DoubleSide});w.materials.set('strata'+w.materials.size,mat);w.mesh(g,mat);
}
function arch(w,x,z,width=14,height=13){
  const pos=[],col=[],ind=[],steps=64,base=w.height(x,z);
  for(let i=0;i<=steps;i++){
    const a=i/steps*Math.PI;
    for(const[outer,depth]of[[0,-1.7],[0,1.7],[1,-2.1],[1,2.1]]){
      const rough=1+.035*Math.sin(a*17),rx=(width/2+outer*2.5)*rough,yy=Math.sin(a)*(height+outer*2.4)+base;
      pos.push(x+Math.cos(a)*rx,yy,z+depth);const c=w.color('#c18a60').multiplyScalar(.85+.11*Math.sin(yy*3)+outer*.12);col.push(c.r,c.g,c.b);
    }
    if(i<steps){const k=i*4;for(const[u,v]of[[0,1],[1,3],[3,2],[2,0]])ind.push(k+u,k+v,k+4+u,k+v,k+4+v,k+4+u);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ind);g.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:w.grain('stone'),bumpMap:w.grain('stone'),bumpScale:.18,side:THREE.DoubleSide});w.materials.set('arch',mat);w.mesh(g,mat);
}
function cactus(w,x,z,s=1){const y=w.height(x,z);w.solid('trunk','#6e8b68',x,y+2*s,z,.33*s,4*s,.33*s);for(const sign of[-1,1]){w.segment(vec(x,y+1.7*s,z),vec(x+sign*s,y+1.7*s,z),.2*s,'#6e8b68');w.solid('trunk','#739b74',x+sign*s,y+2.5*s,z,.2*s,1.7*s,.2*s);}for(let i=0;i<8;i++){const a=i/8*TAU;w.segment(vec(x+Math.cos(a)*.34*s,y+.7*s,z+Math.sin(a)*.34*s),vec(x+Math.cos(a)*.35*s,y+3.8*s,z+Math.sin(a)*.35*s),.012,'#aec18c');}}
function camel(w,x,z,s=2){
  const g=new THREE.Group();w.root.add(g);g.position.set(x,w.height(x,z),z);g.rotation.y=.6;
  w.solid('soft','#be9670',0,1.5*s,0,1.15*s,.55*s,.4*s,0,g);w.solid('soft','#caa27b',-.22*s,2*s,0,.5*s,.55*s,.32*s,0,g);
  w.segment(vec(.85*s,1.6*s,0),vec(1.1*s,2.8*s,0),.2*s,'#be9670',g);w.solid('soft','#c3a17b',1.35*s,2.85*s,0,.38*s,.2*s,.21*s,0,g);
  for(const xx of[-.75,.7])for(const zz of[-.25,.25]){w.segment(vec(xx*s,1.4*s,zz*s),vec((xx+.1)*s,.1*s,zz*s),.09*s,'#ad8563',g);w.solid('soft','#947c61',(xx+.1)*s,.06*s,zz*s,.18*s,.06*s,.12*s,0,g);}
  w.solid('sphere','#362c24',1.42*s,2.91*s,.195*s,.038,.038,.025,0,g);const phase=w.rng()*TAU;w.animations.push(t=>g.rotation.z=Math.sin(t*.8+phase)*.008);w.creatures.push('camel');
}
function reefFish(w,index){
  const g=new THREE.Group();w.root.add(g);const s=index<5?1.15:.65+(index%5)*.11;
  const colors=[['#cf9b4c','#f1e4be'],['#779caf','#dec974'],['#bf827a','#ebdba8'],['#6b9c9d','#dbd6a3']][index%4];
  const data=new Uint8Array(64*32*4);for(let y=0;y<32;y++)for(let x=0;x<64;x++){const c=new THREE.Color((Math.floor(x/(index%2?10:16))%2)?colors[0]:colors[1]).convertLinearToSRGB();const i=(y*64+x)*4;data[i]=c.r*255;data[i+1]=c.g*255;data[i+2]=c.b*255;data[i+3]=255;}
  const key='fish'+index%4;let texture=w.textures.get(key);if(!texture){texture=new THREE.DataTexture(data,64,32,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;w.textures.set(key,texture);}
  const mat=w.mat('#ffffff',{map:texture,roughness:.52});
  w.solid('sphere',mat,0,0,0,.93*s,.48*s,.22*s,0,g);
  const tail=w.solid('cone',colors[0],-.98*s,0,0,.4*s,.7*s,.055*s,[0,0,Math.PI/2],g);
  w.solid('cone',colors[1],-.1*s,.51*s,0,.31*s,.32*s,.035*s,0,g);w.solid('cone',colors[0],.1*s,-.42*s,0,.26*s,.3*s,.04*s,[0,0,Math.PI],g);
  for(const sign of[-1,1]){w.solid('sphere','#eee6c3',.56*s,.15*s,sign*.18*s,.12*s,.12*s,.035*s,0,g);w.solid('sphere','#18252b',.58*s,.15*s,sign*.212*s,.065*s,.065*s,.025*s,0,g);w.solid('soft',colors[1],.05*s,-.02*s,sign*.23*s,.32*s,.05*s,.18*s,[0,sign*.4,0],g);}
  const phase=index*.77,z=-5-index%5*6,r=10+index%7*1.7,y=3+index%6*1.2;
  w.animations.push(t=>{const a=t*(.055+index%3*.007)+phase;g.position.set(Math.sin(a)*r,y+Math.sin(t*.4+phase)*.25,z+Math.cos(a)*2);g.rotation.y=Math.cos(a)>0?0:Math.PI;tail.rotation.y=Math.sin(t*4+phase)*.28;});w.creatures.push('fish');
}
function jelly(w,x,z,y,s=1){
  const g=new THREE.Group();w.root.add(g);const mat=w.mat('#c1bbdb',{transparent:true,opacity:.62,emissive:'#687999',emissiveIntensity:.3});const bell=w.mesh(new THREE.SphereGeometry(s,24,14,0,TAU,0,Math.PI*.56),mat,g);bell.castShadow=false;
  const tentacles=[];for(let i=0;i<10;i++){const a=i/10*TAU,points=[];for(let j=0;j<14;j++)points.push(vec(Math.cos(a)*s*.7+Math.sin(j*.6)*.12,-j*.23*s,Math.sin(a)*s*.7));const curve=new THREE.CatmullRomCurve3(points);const mesh=w.mesh(new THREE.TubeGeometry(curve,30,.025*s,4,false),mat,g);mesh.castShadow=false;tentacles.push(mesh);}
  const phase=w.rng()*TAU;w.animations.push(t=>{g.position.set(x+Math.sin(t*.12+phase),y+Math.sin(t*.4+phase)*.65,z);bell.scale.set(1+Math.sin(t*1.4+phase)*.07,1-Math.sin(t*1.4+phase)*.045,1+Math.sin(t*1.4+phase)*.07);tentacles.forEach((m,i)=>m.rotation.z=Math.sin(t*.7+i)*.035);});w.creatures.push('jellyfish');
}
function branchingCoral(w,x,z,s,color){
  const base=w.height(x,z);const branch=(a,len,angle,depth)=>{const b=vec(a.x+Math.cos(angle)*len*.48,a.y+len*.8,a.z+Math.sin(angle)*len*.4);w.segment(a,b,.13*s*(depth+1)/4,color);if(depth>0)for(const delta of[-.85,.7])branch(b,len*.67,angle+delta,depth-1);else w.solid('sphere',color,b.x,b.y,b.z,.09*s);};
  for(let i=0;i<3;i++)branch(vec(x,base,z),s*(1.3+i*.2),i*2.1,3);
}
function marine(w){
  w.view={position:[0,5.4,25],target:[0,5,-20],fov:51};w.light={sun:[-18,65,12],intensity:2.3,ambient:1.45};w.fog.density=.014;
  w.surface((x,z)=>-.4+terrainNoise(x,z)*.5+hill(x,z,-22,-8,10,25,2)+hill(x,z,20,-24,15,22,3),{color:'#8aa197',shade:(x,z,y)=>mix('#a4b5a0','#476f6d',clamp((Math.abs(x)-8)/24,0,1))});
  w.sky('#347d87','#0c3b5f');w.fog.color.set(w.night?'#153c59':'#2f7b85');w.background=w.fog.color.clone();w.interaction='bubbles';
  for(const[x,z,s]of[[-25,-18,8],[26,-33,10],[-34,-48,12],[15,-75,9]])w.ridge(x,z,s,s*1.3,s*1.2,'#426a70');
  w.scatterRocks(180,()=>true,[-36,36,-65,18],1.7);
  const coralColors=['#b97791','#c69570','#969ec4','#72a29c','#c4afa0','#9e81ac'];
  for(let i=0;i<100;i++){
    const x=(w.rng()-.5)*65,z=-60+w.rng()*78;if(Math.abs(x)<6&&z>-20)continue;const s=.7+w.rng()*2.1,color=coralColors[i%6];
    if(i%3===0)branchingCoral(w,x,z,s,color);
    else if(i%3===1)for(let k=0;k<5;k++)w.solid('soft',color,x+Math.cos(k*2)*s*.3,w.height(x,z)+.3+k*.28,z+Math.sin(k*2)*s*.3,s,.18,s*.75);
    else{w.solid('sphere',w.mat(color,{map:w.grain('bark'),bumpMap:w.grain('bark'),bumpScale:.19}),x,w.height(x,z)+s*.48,z,s*.65,s*.65,s*.65);}
  }
  for(let i=0;i<55;i++){
    const x=(w.rng()-.5)*70,z=-70+w.rng()*80;if(Math.abs(x)<13&&z>-20)continue;const h=6+w.rng()*9,y=w.height(x,z);
    for(let j=0;j<10;j++){const xx=x+Math.sin(j*.6)*.7;w.segment(vec(xx,y+j*h/10,z),vec(x+Math.sin((j+1)*.6)*.7,y+(j+1)*h/10,z),.07,'#356f62');w.solid('leaf',j%2?'#568e75':'#437a6f',xx,y+j*h/10,z,.75,.7,.7,j*2.1,null,{side:THREE.DoubleSide});}
  }
  w.grass(4200,()=>true,{range:[-40,40,-80,20],height:.65,color:'#52867b'});
  for(let i=0;i<24;i++)reefFish(w,i);jelly(w,-10,-12,10,1.1);jelly(w,13,-27,8,.8);jelly(w,5,-40,11,1.2);
  lightShafts(w,7,'#9ad8d2',44,4,-28,9,-.23);
}
function desert(w){
  w.view={position:[0,4.6,32],target:[0,6,-25],fov:51};w.light={sun:[-55,45,35],intensity:3.5,ambient:1.4};w.fog.density=.006;
  const h=(x,z)=>.2+terrainNoise(x,z)*.7+hill(x,z,-30,-2,25,20,4)+hill(x,z,28,-32,20,30,5)+Math.sin(x*.08+z*.12)*.9;
  w.surface(h,{color:'#d5b182',shade:(x,z)=>mix('#dcc18e','#b78d69',.35+.2*Math.sin(x*.06+z*.05))});w.sky('#e8c59d','#7196ad',[-65,62,-210]);
  arch(w,-7,-28,18,16);strata(w,-33,-28,7,22);strata(w,27,-39,8,25);strata(w,19,-77,12,31);strata(w,-30,-90,17,28);
  for(let i=0;i<9;i++)w.ridge(-100+i*24,-160,20,18+w.rng()*19,30,'#b79580');
  w.scatterRocks(260,(x,z)=>Math.abs(x)>5||z>3,[-45,45,-100,23],.85);
  [[-14,6,1.3],[16,2,.8],[21,-18,1.1],[-24,-5,.9],[-8,15,.65],[12,-44,.9]].forEach(p=>cactus(w,...p));
  w.grass(600,()=>true,{height:.4,color:'#a5a178'});camel(w,8,-7,1.55);camel(w,12,-12,1.2);w.flyers(5,'#515956',.9);w.interaction='dust';
}
function jungle(w){
  w.view={position:[0,4.3,28],target:[0,6.5,-20],fov:51};w.light={sun:[-20,65,5],intensity:2.6,ambient:1.3};w.fog.density=.012;
  const h=(x,z)=>-.6+terrainNoise(x,z)*.5+hill(x,z,0,-35,18,8,13)+5*clamp((Math.abs(x)-13)/16,0,1)-hill(x,z,0,-3,13,18,.6);
  w.surface(h,{color:'#637e56'});w.sky('#c5d5b8','#6c9a9a');w.water(.02,{width:55,depth:80,z:-7,color:'#497f72'});
  for(const[x,z,s]of[[-25,-24,9],[24,-28,10],[-34,-54,13],[33,-62,13]])w.ridge(x,z,s,18,s*.7,'#4d6860');
  trees(w,72,(x,z)=>Math.abs(x)>14||z<-50,[-48,48,-110,14],1.4,'oak');trees(w,36,(x,z)=>Math.abs(x)>10&&w.height(x,z)>.4,[-34,34,-60,20],1.05,'palm');
  for(const[x,z,s]of[[-16,14,1.8],[17,9,1.65],[-20,-6,1.5]]){w.tree(x,z,s);for(let i=0;i<8;i++)w.vines(x+(i-4)*.9,z,w.height(x,z)+10*s,4+w.rng()*5);}
  waterfall(w,0,-29,h(0,-29)+.1,0,-11,4.3);
  for(const sign of[-1,1])for(let i=0;i<8;i++)w.boulder(sign*(3+i%3*1.1),-28-i*.85,1.25+i%3*.45,'#536b60',h(sign*3,-28-i*.85)-.7);
  w.grass(8000,(x,z)=>h(x,z)>.25,{height:1,flowers:true});ferns(w,120,(x,z)=>h(x,z)>.15,[-30,30,-40,22],1.4);w.scatterRocks(160,(x,z)=>h(x,z)>.1,[-36,36,-60,22],1.1);
  w.insects(22);w.flyers(7,'#b8cdb3',.7);
  for(let i=0;i<8;i++){const x=-10+i*3,z=-6-i%2*3;if(h(x,z)>.03){w.solid('soft','#668955',x,h(x,z)+.18,z,.25,.18,.3);for(const sign of[-1,1])w.solid('sphere','#b8c792',x+sign*.13,h(x,z)+.31,z-.13,.045);}}
}
function forest(w){
  w.view={position:[0,3.8,25],target:[0,4,-25],fov:51};w.light={sun:[-35,62,15],intensity:3,ambient:1.4};w.fog.density=.012;
  const h=(x,z)=>.5+terrainNoise(x,z)*.5-hill(x,z,-7,-7,5.5,13,1.8)+hill(x,z,27,-50,30,32,3);
  w.surface(h,{color:'#798f58'});w.sky('#dbe3c5','#91b5b6');w.water(0,{width:22,depth:46,x:-7,z:-8,color:'#5b8e81'});
  trees(w,140,(x,z)=>z<-38||Math.abs(x)>19,[-75,75,-150,15],1.5,'oak');trees(w,42,(x,z)=>z<-68,[-60,60,-140,-60],2,'pine');
  for(const[x,z,s]of[[-16,10,1.8],[17,4,1.7],[-21,-15,1.65],[20,-20,1.4]])w.tree(x,z,s);
  w.path([[5,22],[3,9],[6,-5],[8,-18],[2,-36],[0,-65]],1.6,'#bcac7c');
  const pathDist=(x,z)=>Math.abs(x-(z>-18?5:2));w.grass(15000,(x,z)=>h(x,z)>.07&&pathDist(x,z)>1.4,{height:.6,flowers:true});
  ferns(w,95,(x,z)=>h(x,z)>.1,[-27,27,-35,23],1.1);w.scatterRocks(135,(x,z)=>h(x,z)>.2&&Math.hypot(x-5,z+6)>4,[-35,35,-60,23],.8);
  logs(w,10,9,7);logs(w,-13,-17,5);w.creaturesOnLand([[4,-7,2],[7,-12,1.65]],'deer');hare(w,12,8,1.1);hare(w,-3,11,.8);w.insects(16);w.flyers(7,'#b99468',.65);
  lightShafts(w,5,'#fff1cb',35,2.5,-15,9,-.45);
}
function tundra(w){
  w.view={position:[0,4.5,28],target:[0,6,-36],fov:52};w.light={sun:[-45,55,20],intensity:2.9,ambient:1.6};w.fog.density=.0055;
  const h=(x,z)=>.55+terrainNoise(x,z)*.8-hill(x,z,0,-25,17,25,2)+hill(x,z,-25,5,16,21,2);
  w.surface(h,{color:'#cdd6c9',shade:(x,z,y)=>mix('#acbcb0','#e0e4d9',.75+.2*Math.sin(x*.2+z*.18))});w.sky('#cadcdd','#6c9ab5');w.water(0,{width:55,depth:100,z:-29,color:'#80b3bf'});
  for(let i=0;i<11;i++)w.ridge(-100+i*21,-105-i%3*20,18+w.rng()*9,24+w.rng()*27,26,'#788c94',true);
  for(const[x,z,s]of[[-29,-34,9],[30,-53,12]])w.ridge(x,z,s,20,s,'#8c9a9c',true);
  w.scatterRocks(170,(x,z)=>h(x,z)>.15&&Math.hypot(x+8,z+4)>5,[-42,42,-65,23],1.2);w.grass(1500,(x,z)=>h(x,z)>.25,{height:.15,color:'#8c9980'});
  w.creaturesOnLand([[-8,-5,2.1],[-12,-12,1.7],[13,-38,1.5]],'deer');hare(w,8,13,1,'#e2e6dc');
  for(let i=0;i<17;i++){const x=(w.rng()-.5)*30,z=-10-w.rng()*50;w.solid('rock','#c3e0df',x,.04,z,.8+w.rng()*1.5,.12,.6+w.rng());}
  if(w.night){
    for(let j=0;j<3;j++){const positions=[],uv=[],indices=[];for(let i=0;i<=100;i++){const x=-110+i*2.2,z=-150+Math.sin(i*.09+j)*15;positions.push(x,36+Math.sin(i*.08+j)*6,z,x,65+Math.sin(i*.08+j)*12,z);uv.push(i/100,0,i/100,1);if(i<100){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);const t={value:0};w.waterUniforms.push({time:t});const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:t,c:{value:new THREE.Color(j===1?'#8e7ab0':'#6bd3bb')}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float time;uniform vec3 c;void main(){float a=sin(v.y*3.14159)*(.35+.15*sin(v.x*120.+time*.15));gl_FragColor=vec4(c,a);\n#include <colorspace_fragment>\n}'});w.materials.set('aurora'+j,mat);w.mesh(g,mat,w.atmosphere).castShadow=false;}
  }
}
function mediterranean(w){
  w.view={position:[-2,8,33],target:[0,5,-38],fov:50};w.light={sun:[-65,65,25],intensity:3.3,ambient:1.6};w.fog.density=.0045;
  const h=(x,z)=>-1.3+clamp((x-3)/6,0,1)*(1.4+.13*Math.max(0,-z)) +hill(x,z,-31,12,11,14,6)+hill(x,z,37,-80,28,35,8)+terrainNoise(x,z)*.16;
  w.surface(h,{color:'#b9b48e',shade:(x,z,y)=>y<.6?'#d2c6a4':mix('#a0a377','#c9c0a0',.5+.2*Math.sin(z*.18))});w.sky('#dce0cd','#709faf');w.water(0,{color:'#559cac'});
  for(let i=0;i<7;i++)w.ridge(-110+i*15,-125-i%2*20,14,13+w.rng()*11,18,'#a3b3a9');
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){
    const x=10+col*5.3+row*.6,z=-12-row*13+(col%2)*2;building(w,x,z,1.9+w.rng()*.6,-.2+w.rng()*.4);
  }
  building(w,14,-29,1.55,0,true);
  for(const z of[-7,-23,-40,-57])stoneWall(w,[[7,z],[18,z-2],[33,z]],.8);
  w.path([[9,19],[10,4],[8,-13],[13,-34],[19,-57]],1.5,'#d5c7a3');
  trees(w,35,(x,z)=>x>30||z<-75,[7,50,-120,18],.8,'cypress');trees(w,24,(x,z)=>x>28,[18,48,-78,20],.7,'oak');
  w.tree(-20,15,1.6,'pine');w.tree(29,18,1.2,'oak');w.tree(21,9,1.05,'cypress');
  w.grass(4200,(x,z)=>h(x,z)>.4&&x>25,{height:.4,flowers:true});w.scatterRocks(190,(x,z)=>h(x,z)>.01&&h(x,z)<1,[-25,35,-70,23],.4);
  // Stone quay and a timber pier attach to the inhabited bank.
  for(let i=0;i<23;i++)w.solid('box','#a9aa96',7,Math.max(.65,h(7,-5-i*1.3)),-5-i*1.3,1.4,.45,1.25);
  for(let i=0;i<16;i++){const x=7-i*.65;w.solid('box','#a68a63',x,.6,-16,.62,.14,2);if(i%3===0)for(const z of[-16.8,-15.2])w.solid('trunk','#756952',x,.2,z,.08,1.2,.08);}
  w.boat(-8,-22,.16,2.8);w.boat(-23,-63,.16,2);w.boat(1,-9,.16,1.5);w.flyers(9,'#e5e6d5',1.05);
  for(let z=-72;z<22;z+=7){const points=[];for(let i=0;i<5;i++){const zz=z+i,lo0=0,hi0=12;let lo=lo0,hi=hi0;for(let j=0;j<15;j++){const mid=(lo+hi)/2;if(h(mid,zz)<0)lo=mid;else hi=mid;}points.push([(lo+hi)/2-.15,.035,zz]);}w.foam(points,.03);}
  if(w.night){for(const[x,z]of[[8,-11],[8,-25],[10,-38]]){const lamp=w.solid('sphere',w.mat('#ffdb91',{emissive:'#f4ac58',emissiveIntensity:2}),x,h(x,z)+2.2,z,.15);const light=new THREE.PointLight('#ffc780',10,8,2);light.position.copy(lamp.position);w.root.add(light);}}
}
function steppe(w){
  w.view={position:[0,7.8,30],target:[0,3.5,-52],fov:53};w.light={sun:[-40,55,35],intensity:3.1,ambient:1.6};w.fog.density=.006;
  const h=(x,z)=>.7+terrainNoise(x,z)*.5+2.6*Math.sin(x*.028+z*.043)+hill(x,z,29,-32,23,28,3);
  w.surface(h,{color:'#a6a16a',shade:(x,z)=>mix('#a5a263','#c7b981',.5+.3*Math.sin(x*.055+z*.025))});w.sky('#e1dfc4','#6a9fad');
  w.path([[-6,24],[-3,11],[5,-5],[8,-22],[1,-45],[-12,-87]],1.4,'#baa57b');
  w.grass(32000,(x,z)=>Math.abs(x-(-3+Math.sin(z*.08)*7))>1.1,{range:[-85,85,-150,30],height:1.2,flowers:true,color:'#a7a36a'});
  for(const[x,z,s]of[[22,-15,3.1],[25,-19,2.8],[18,-21,2.1]])w.boulder(x,z,s,'#968f76');w.scatterRocks(90,(x,z)=>Math.abs(x)>12,[-50,50,-100,20],.65);
  w.creaturesOnLand([[-3,-8,1.7],[-8,-15,1.5],[3,-20,1.6],[8,-33,1.4],[-13,-30,1.3],[3,3,1.8]],'saiga');w.flyers(10,'#796e55',1.25);w.interaction='pollen';
}
function river(w){
  w.view={position:[0,3.7,29],target:[0,3,-38],fov:52};w.light={sun:[-25,60,30],intensity:2.8,ambient:1.6};w.fog.density=.009;
  const h=(x,z)=>-.8+1.8*clamp((channelDistance(x,z)-3.7)/2.4,0,1)+terrainNoise(x,z)*.25*clamp((channelDistance(x,z)-6)/2,0,1);
  w.surface(h,{color:'#76915d'});w.sky('#d1dfc8','#789da9');w.water(0,{width:100,depth:220,z:-65,color:'#5b9392',flow:.7});
  trees(w,95,(x,z)=>channelDistance(x,z)>9,[-55,55,-130,21],1.1,'willow');trees(w,35,(x,z)=>channelDistance(x,z)>18,[-65,65,-145,-45],1.6,'oak');
  for(const[x,z,s]of[[-14,14,1.55],[17,6,1.35],[-18,-18,1.1]])if(channelDistance(x,z)>9)w.tree(x,z,s,'willow');
  w.grass(12000,(x,z)=>channelDistance(x,z)>6.4,{height:.7,flowers:true});reeds(w,440,(x,z)=>channelDistance(x,z)>5.8&&channelDistance(x,z)<7.1);
  w.scatterRocks(170,(x,z)=>channelDistance(x,z)>5.9,[-35,35,-75,23],.65);ferns(w,70,(x,z)=>channelDistance(x,z)>8);bridge(w,riverCenter(-30),-30,14);
  logs(w,11,10,6);w.path([[11,23],[13,4],[10,-14],[riverCenter(-30)+8,-30],[11,-50]],1,'#b9ae83');
  for(let i=0;i<8;i++)duck(w,0,0,.85,t=>{const z=12-((t*.1+i*4)%72);return[riverCenter(z)+Math.sin(i)*1.5,z];});
  w.flyers(7,'#77a2ad',.7);w.insects(10);
}
function island(w){
  w.view={position:[0,3.9,30],target:[0,2.8,-44],fov:52};w.light={sun:[-35,70,30],intensity:3.2,ambient:1.9};w.fog.density=.0038;
  const shore=x=>5+Math.sin(x*.08)*8;
  const h=(x,z)=>clamp((z-shore(x))*.13,-1.8,2.6)+hill(x,z,-35,11,18,20,4)+terrainNoise(x,z)*.09;
  w.surface(h,{color:'#ded0a1',shade:(x,z,y)=>y>2?'#a4b28c':'#e1d5ad'});w.sky('#d4e8de','#5babc0');w.water(0,{color:'#53b8b9',z:-90,flow:.22});
  for(const[x,z,s]of[[-15,18,1.25],[15,15,1.15],[-22,10,1.2],[25,10,1.1],[-30,3,1.05],[29,0,.85],[-38,-4,.85]])if(h(x,z)>.2)w.tree(x,z,s,'palm');
  trees(w,27,(x,z)=>h(x,z)>1&&Math.hypot(x,z-30)>18,[-55,55,5,23],.85,'palm');
  for(const[x,z,s]of[[-90,-135,35],[-130,-165,40],[-55,-165,30]])w.ridge(x,z,s,30,s*.8,'#799d8e');
  w.grass(3600,(x,z)=>h(x,z)>1.7,{range:[-48,48,5,40],height:.4,color:'#96b582'});w.scatterRocks(100,(x,z)=>h(x,z)>.08&&h(x,z)<.5,[-48,48,-1,23],.25);
  const foam=[];for(let x=-65;x<=65;x+=3)foam.push([x,.03,shore(x)]);w.foam(foam,.13);
  for(let i=0;i<45;i++){const x=(w.rng()-.5)*55,z=shore(x)+.5+w.rng()*10;w.solid('soft',i%3?'#dfcba4':'#bcbfa5',x,h(x,z)+.03,z,.08,.025,.12,w.rng()*TAU);}
  // Beach shelter, a distant jetty, and sailboats keep the center and horizon open.
  const shelter=new THREE.Group();w.root.add(shelter);shelter.position.set(31,h(31,6),6);for(const x of[-1.8,1.8])for(const z of[-1.4,1.4])w.solid('trunk','#947b55',x,1.6,z,.12,3.2,.12,0,shelter);w.solid('cone','#b89b66',0,3.9,0,3.4,2,2.9,Math.PI/4,shelter);w.bake(shelter);
  for(let i=0;i<23;i++){const z=8-i*.8;w.solid('box','#a98c62',28,.65,z,2.5,.16,.74);if(i%4===0)for(const x of[27,29])w.solid('trunk','#876d4a',x,.1,z,.09,1.1,.09);}
  w.boat(-18,-78,.12,3.5);w.boat(27,-39,.12,2.3);w.flyers(8,'#e4e8dd',.95);
  for(const[x,z]of[[-5,16],[8,15]]){const g=new THREE.Group();w.root.add(g);g.position.set(x,h(x,z)+.12,z);w.solid('soft','#b5775c',0,0,0,.25,.12,.2,0,g);for(const sign of[-1,1])for(let i=0;i<3;i++)w.segment(vec(sign*.2,0,(i-1)*.12),vec(sign*.42,-.09,(i-1)*.2),.025,'#a57558',g);w.animations.push(t=>g.rotation.y=Math.sin(t*.2)*.4);w.creatures.push('crab');}
}
function moon(w){
  w.view={position:[0,3.6,29],target:[0,4.2,-40],fov:52};w.light={sun:[-65,38,25],intensity:3.7,ambient:.55};w.fog.density=0;
  const craters=[[-12,-17,9],[25,-40,12],[-39,-62,15],[8,-83,20],[38,6,9],[-22,21,6]];
  const h=(x,z)=>{let y=.1+terrainNoise(x,z)*.24;for(const[cx,cz,r]of craters){const d=Math.hypot(x-cx,z-cz)/r;y-=r*.12*Math.exp(-d*d*2.5);y+=r*.09*Math.exp(-(((d-1)*5)**2));}return y;};
  w.surface(h,{color:'#8f959b',shade:(x,z)=>mix('#727c84','#aaaeb0',.5+.22*Math.sin(x*.2+z*.13))});w.sky('#111929','#030914',[-100,60,-240]);
  for(let i=0;i<9;i++)w.ridge(-100+i*24,-155-i%3*15,17,17+w.rng()*16,24,'#69757e');w.scatterRocks(360,(x,z)=>Math.hypot(x+4,z+10)>8&&Math.hypot(x-9,z-1)>7,[-50,50,-100,24],.9);
  const lander=new THREE.Group();w.root.add(lander);lander.position.set(-6,h(-6,-19),-19);const gold=w.mat('#b6a16c',{metalness:.25,roughness:.55,map:w.grain('stone'),bumpMap:w.grain('stone'),bumpScale:.1});
  w.solid('box',gold,0,2.4,0,4,2.5,4,Math.PI/4,lander);w.solid('cylinder','#d7d9d8',0,4.45,0,1.8,1.7,1.8,0,lander);w.solid('cone','#bbc6cb',0,5.7,0,1.8,.85,1.8,0,lander);w.solid('box','#486a83',0,4.7,1.82,1.05,.63,.08,0,lander);
  for(let i=0;i<4;i++){const a=i/4*TAU,xx=Math.cos(a)*4,zz=Math.sin(a)*4;w.segment(vec(Math.cos(a)*1.6,2,Math.sin(a)*1.6),vec(xx,.16,zz),.09,'#c7c8bb',lander);w.solid('cylinder',gold,xx,.12,zz,.55,.13,.55,0,lander);}
  for(let i=0;i<8;i++)w.solid('box','#c5c6b6',0,.5+i*.35,2.9-i*.07,.85,.05,.15,0,lander);
  for(const sign of[-1,1]){
    w.segment(vec(sign*.48,.5,2.9),vec(sign*.48,3,2.35),.045,'#c5c6b6',lander);
    w.solid('box','#727f83',sign*1.5,4.35,.25,.18,.8,1.2,0,lander);
    w.solid('trunk','#c7cdd0',sign*1.3,5.4,0,.045,2.5,.045,0,lander);
    for(let i=0;i<5;i++)w.solid('sphere','#d9d1ae',sign*1.45,1.3+i*.38,1.47,.045,.045,.045,0,lander);
  }
  w.solid('cone','#3e484c',0,.75,0,.9,1,.9,0,lander);
  w.solid('sphere','#c2ccd0',-1.3,6.65,0,.65,.12,.65,[.3,0,-.4],lander);
  w.segment(vec(-1.3,6.65,0),vec(-1.2,7.2,.1),.025,'#ccd3d0',lander);
  for(let i=0;i<4;i++){const a=i/4*TAU,b=(i+1)/4*TAU;w.segment(vec(Math.cos(a)*1.5,2.8,Math.sin(a)*1.5),vec(Math.cos(b)*4,.2,Math.sin(b)*4),.035,'#d9ccb0',lander);}
  w.bake(lander);
  for(const[x,z]of[[-10,-4],[-4,-4],[3,-6]]){w.solid('trunk','#b5bbc0',x,h(x,z)+.6,z,.06,1.2,.06);w.solid('box','#325570',x,h(x,z)+1.1,z,4.8,.1,2.7,[.2,0,0]);for(let i=0;i<10;i++)w.solid('box','#9cb8c4',x-2.2+i*.49,h(x,z)+1.17,z,.022,.022,2.6,[.2,0,0]);}
  const rover=new THREE.Group();w.root.add(rover);rover.position.set(10,h(10,1)+.35,1);rover.rotation.y=-.45;w.solid('box','#c8c6ae',0,.6,0,2.8,.9,1.8,0,rover);w.solid('box',gold,-.5,1.22,0,1.6,.25,1.5,0,rover);
  for(const x of[-1,.1,1.1])for(const sign of[-1,1]){w.solid('cylinder','#39464f',x,.1,sign*1.1,.42,.25,.42,[Math.PI/2,0,0],rover);w.solid('cylinder','#97a2a5',x,.1,sign*1.24,.19,.04,.19,[Math.PI/2,0,0],rover);}
  w.solid('trunk','#c2c8c8',.5,2.1,0,.055,2.7,.055,0,rover);w.solid('sphere','#bac5c9',.5,3.3,0,.55,.1,.55,[.3,0,0],rover);w.solid('sphere','#415e73',.3,2.7,.15,.15,.13,.13,0,rover);
  const astronaut=new THREE.Group();w.root.add(astronaut);astronaut.position.set(1,h(1,4),4);w.solid('soft','#d9ddda',0,1,0,.42,.63,.27,0,astronaut);w.solid('sphere','#e1e5df',0,1.85,0,.43,.43,.43,0,astronaut);w.solid('sphere',gold,0,1.87,.32,.31,.26,.15,0,astronaut);w.solid('box','#d2d5ca',0,1.1,-.37,.65,.9,.35,0,astronaut);
  for(const sign of[-1,1]){w.segment(vec(sign*.3,1.3,0),vec(sign*.7,.7,.16),.14,'#d9ddda',astronaut);w.solid('trunk','#d9ddda',sign*.23,.36,0,.17,.75,.17,0,astronaut);w.solid('soft','#b2bcb9',sign*.23,.07,.14,.19,.1,.34,0,astronaut);}w.creatures.push('astronaut');
  for(let i=0;i<18;i++)w.solid('soft','#697781',1+Math.sin(i*.5)*.5,h(1+Math.sin(i*.5)*.5,4-i*.6)+.013,4-i*.6,.08,.015,.16,.1);
  const earth=new THREE.Group();w.root.add(earth);earth.position.set(-30,35,-135);
  const continents=[
    [[-10,36],[3,60],[20,72],[45,65],[75,72],[140,50],[160,65],[170,48],[120,15],[106,5],[78,7],[55,25],[40,40],[25,35]],
    [[-18,35],[0,37],[20,33],[38,10],[50,0],[32,-28],[20,-35],[10,-25],[-8,5]],
    [[-168,70],[-135,72],[-125,55],[-125,32],[-102,18],[-83,9],[-65,45],[-54,58],[-72,80],[-100,82]],
    [[-80,9],[-50,4],[-34,-8],[-46,-24],[-68,-55],[-77,-20]],
    [[112,-11],[139,-10],[154,-25],[147,-39],[116,-33]],
    [[-53,83],[-24,76],[-45,60],[-60,62]]
  ];
  const inside=(x,y,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
  const data=new Uint8Array(256*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<256;x++){
    const lat=y/128*180-90,lon=x/256*360-180,land=continents.some(p=>inside(lon,lat,p)),cloud=Math.sin(lon*.08+Math.sin(lat*.14)*2)*Math.cos(lat*.11+lon*.08)>.76;
    const c=new THREE.Color(Math.abs(lat)>76?'#dbe5df':cloud?'#b4d2d5':land?'#91ad89':'#467f9f').convertLinearToSRGB(),i=(y*256+x)*4;data[i]=c.r*255;data[i+1]=c.g*255;data[i+2]=c.b*255;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,256,128,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;w.textures.set('earth',map);
  w.solid('sphere',w.mat('#ffffff',{map,emissive:'#315e75',emissiveIntensity:.35,roughness:1}),0,0,0,8,8,8,0,earth);
  earth.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});w.animations.push(t=>earth.rotation.y=.75+t*.006);w.interaction='surface';
}

export const BUILDERS={marine,desert,jungle,forest,tundra,mediterranean,steppe,river,moon,island};
