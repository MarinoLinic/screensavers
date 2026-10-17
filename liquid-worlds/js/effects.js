import * as T from '../vendor/three.module.min.js';

export class LiquidEffects {
  constructor(scene, surface, random, kind, sources) {
    this.surface=surface;this.random=random;this.kind=kind;this.sources=sources;
    this.object=new T.Object3D();
    const metal=kind!=='forest';
    this.material=new T.MeshStandardMaterial({color:metal?0xddebf0:0xc8efe4,metalness:metal?1:.15,roughness:metal?.08:.2,envMapIntensity:1.5});
    this.drops=new T.InstancedMesh(new T.SphereGeometry(1,12,8),this.material,64);
    this.spray=new T.InstancedMesh(new T.SphereGeometry(1,8,6),this.material,192);
    for(const m of [this.drops,this.spray]){m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;scene.add(m);}
    this.particles=Array.from({length:192},()=>({born:-100,x:0,z:0,vx:0,vz:0,vy:0,size:0}));this.cursor=0;
    this.falls=Array.from({length:64},(_,i)=>({source:sources[i%sources.length],offset:random()*10,period:(metal?2.8:1.3)+random()*3,radius:(metal?.055:.035)+random()*.04,cycle:null}));
    this.lastPulse=-1;
    this.jets=[];
    if(kind==='foundry') for(const s of sources) {
      const geo=new T.CylinderGeometry(.14,.1,s.y,16,40);
      const mat=this.material.clone(),u={value:0};
      mat.onBeforeCompile=sh=>{sh.uniforms.jetTime=u;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float jetTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(position.y*9.-jetTime*7.)*.025; transformed.z += cos(position.y*11.-jetTime*8.)*.023; transformed.xz *= .9+.14*sin(position.y*15.-jetTime*10.);');};
      const jet=new T.Mesh(geo,mat);jet.position.set(s.x,s.y*.5,s.z);scene.add(jet);this.jets.push(u);
    }
    if(kind==='forest') {
      const geo=new T.PlaneGeometry(4.2,4.7,36,50);
      this.fallUniform={value:0};
      const mat=new T.ShaderMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,uniforms:{uTime:this.fallUniform},vertexShader:/* glsl */`
        uniform float uTime; varying vec2 vUv;
        void main(){vUv=uv;vec3 p=position; p.z+=sin(uv.y*17.+uv.x*12.+uTime*3.)*.12+sin(uv.x*31.+uTime*1.7)*.045;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader:/* glsl */`
        uniform float uTime; varying vec2 vUv;
        void main(){float s=sin(vUv.x*98.+sin(vUv.y*8.-uTime*4.))*sin(vUv.x*57.-vUv.y*7.+uTime*2.);
        float edge=smoothstep(0.,.13,vUv.x)*smoothstep(0.,.13,1.-vUv.x);
        float strands=.45+.45*pow(.5+.5*s,2.);float speed=sin(vUv.y*50.-uTime*16.+vUv.x*17.);
        vec3 c=mix(vec3(.23,.48,.43),vec3(.88,1.05,.98),strands+speed*.1);gl_FragColor=vec4(c,edge*(.52+strands*.4));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`});
      const fall=new T.Mesh(geo,mat);fall.position.set(0,2.27,-9.5);scene.add(fall);
    }
  }
  burst(x,z,time,strength=1) {
    this.surface.impact(x,z,time,strength);
    for(let i=0;i<12;i++) {
      const a=this.random()*Math.PI*2,s=.35+this.random()*1.1;
      Object.assign(this.particles[this.cursor],{born:time,x,z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:1+this.random()*1.5,size:.022+this.random()*.055});
      this.cursor=(this.cursor+1)%this.particles.length;
    }
  }
  update(time,activity) {
    const o=this.object;
    this.falls.forEach((d,i)=>{
      const period=d.period/Math.sqrt(activity),t=(time+d.offset)%period,cycle=Math.floor((time+d.offset)/period);
      const fallDuration=Math.sqrt(d.source.y/4.9);
      const falling=t<fallDuration;
      const jitter=this.kind==='forest'?.8:.08;
      const x=d.source.x+Math.sin(i*18.3)*jitter,z=d.source.z+Math.cos(i*6.4)*jitter;
      if(d.wasFalling&&!falling&&i%3===0)this.burst(x,z,time,.55);
      d.wasFalling=falling;
      d.cycle=cycle;
      o.position.set(x,Math.max(.02,d.source.y-4.9*t*t),z);
      o.scale.setScalar(falling?d.radius:0);if(falling)o.scale.y*=1+Math.min(1,t*.5);
      o.updateMatrix();this.drops.setMatrixAt(i,o.matrix);
    });
    const pulse=Math.floor(time/(this.kind==='foundry'?.38:this.kind==='forest'?.45:1.1)/Math.sqrt(1/activity));
    if(pulse!==this.lastPulse) { const s=this.sources[pulse%this.sources.length];this.burst(s.x,s.z,time,this.kind==='grotto'?1.4:.9);this.lastPulse=pulse; }
    this.particles.forEach((p,i)=>{
      const a=time-p.born,y=.08+p.vy*a-4.9*a*a,alive=a>=0&&a<1.2&&y>-.02;
      o.position.set(p.x+p.vx*a,Math.max(.01,y),p.z+p.vz*a);o.scale.setScalar(alive?p.size:0);o.updateMatrix();this.spray.setMatrixAt(i,o.matrix);
    });
    this.drops.instanceMatrix.needsUpdate=true;this.spray.instanceMatrix.needsUpdate=true;
    for(const u of this.jets)u.value=time;
    if(this.fallUniform)this.fallUniform.value=time;
  }
}
