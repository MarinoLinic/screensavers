import * as T from '../vendor/three.module.min.js';

export function stone(color, moss = false, metal = false) {
  const m = new T.MeshStandardMaterial({ color, roughness: metal ? .45 : .88, metalness: metal ? .75 : .04 });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStone;\nvarying vec3 vStoneNormal;').replace('#include <project_vertex>', `#include <project_vertex>
      vec4 stoneP = vec4(transformed,1.);
      #ifdef USE_INSTANCING
      stoneP = instanceMatrix * stoneP;
      #endif
      vStone = (modelMatrix * stoneP).xyz;
      vStoneNormal = inverseTransformDirection(transformedNormal,viewMatrix);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', /* glsl */`#include <common>
      varying vec3 vStone, vStoneNormal;
      float stoneHash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float stoneNoise(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float grain = stoneNoise(vStone*2.)*.55 + stoneNoise(vStone*6.)*.3 + stoneNoise(vStone*18.)*.15;
        diffuseColor.rgb *= ${metal ? '.92 + grain*.12' : '.68 + grain*.55'};
        ${moss ? 'float moss=stoneNoise(vStone*1.8)*smoothstep(-.1,.75,normalize(vStoneNormal).y); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.085,.16,.033),moss*.8);' : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 q0=dFdx(vStone),q1=dFdy(vStone);
        float surf=stoneNoise(vStone*5.)*.65+stoneNoise(vStone*14.)*.35;
        vec3 a=cross(q1,normal),b=cross(normal,q0);
        float det=dot(q0,a); normal=normalize(abs(det)*normal-sign(det)*(dFdx(surf)*a+dFdy(surf)*b)*${metal ? '.004' : '.022'});`);
  };
  m.customProgramCacheKey = () => `stone-${moss}-${metal}`;
  return m;
}

export function rockGeometry() {
  const g = new T.IcosahedronGeometry(1, 5), p = g.attributes.position;
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const n=1+.12*Math.sin(x*5+y*3+z*4)+.08*Math.cos(z*7-x*4+y*3);
    p.setXYZ(i,x*n,y*n,z*n);
  }
  g.computeVertexNormals();
  // IcosahedronGeometry is non-indexed. Average duplicate vertex normals so
  // subdivided boulders have curved silhouettes instead of triangular facets.
  const sums=new Map(),keys=[],normals=g.attributes.normal;
  for(let i=0;i<p.count;i++) {
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');keys.push(key);
    if(!sums.has(key))sums.set(key,new T.Vector3());
    sums.get(key).add(new T.Vector3(normals.getX(i),normals.getY(i),normals.getZ(i)));
  }
  for(const n of sums.values())n.normalize();
  for(let i=0;i<p.count;i++){const n=sums.get(keys[i]);normals.setXYZ(i,n.x,n.y,n.z);}
  return g;
}

export function barkMaterial() {
  const m=stone(0x6d5542);
  const base=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{
    base(shader);
    shader.fragmentShader=shader.fragmentShader.replace('float grain = stoneNoise(vStone*2.)*.55 + stoneNoise(vStone*6.)*.3 + stoneNoise(vStone*18.)*.15;', 'float grain = stoneNoise(vStone*vec3(22.,1.5,22.))*.65 + stoneNoise(vStone*vec3(40.,3.,40.))*.35;');
  };
  m.customProgramCacheKey=()=> 'bark';return m;
}

export function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
  const c=canvas.getContext('2d'), g=c.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.15,'rgba(255,255,255,.7)'); g.addColorStop(.4,'rgba(255,255,255,.16)'); g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g;c.fillRect(0,0,64,64);return new T.CanvasTexture(canvas);
}

// Small procedural studio/sky cubemap provides PBR reflections on curved drops.
export function environment(kind) {
  const images = [];
  for (let f=0;f<6;f++) {
    const c=document.createElement('canvas');c.width=128;c.height=128;
    const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,128);
    const colors=kind==='forest'?['#d3dfc2','#899e69','#283628']:kind==='grotto'?['#536e88','#172630','#090f18']:['#a29b89','#333c40','#111b23'];
    g.addColorStop(0,colors[0]);g.addColorStop(.55,colors[1]);g.addColorStop(1,colors[2]);ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    ctx.fillStyle=kind==='foundry'?'#ffa349':kind==='grotto'?'#98eef5':'#fff6dc';
    ctx.fillRect(12+f*9,12,7,72);ctx.fillStyle='#ffffff';ctx.fillRect(82,22,4,45);
    images.push(c);
  }
  const tex=new T.CubeTexture(images);tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;return tex;
}

export function instances(scene, geometry, material, records) {
  const mesh=new T.InstancedMesh(geometry,material,records.length),o=new T.Object3D();
  records.forEach((r,i)=>{o.position.set(...r.p);o.scale.set(...(r.s||[1,1,1]));o.rotation.set(...(r.r||[0,0,0]));if(r.q)o.quaternion.set(...r.q);o.updateMatrix();mesh.setMatrixAt(i,o.matrix); if(r.color)mesh.setColorAt(i,new T.Color(r.color));});
  mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}

export function mesh(scene, geometry, material, p=[0,0,0], s=[1,1,1], r=[0,0,0]) {
  const m=new T.Mesh(geometry,material);m.position.set(...p);m.scale.set(...s);m.rotation.set(...r);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
export function beam(scene,a,b,r,material) {
  const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);
  const m=mesh(scene,new T.CylinderGeometry(r,r,d.length(),10),material,av.clone().add(bv).multiplyScalar(.5).toArray());
  m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;
}
