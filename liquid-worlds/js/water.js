import * as T from '../vendor/three.module.min.js';
import { Reflector } from '../vendor/Reflector.js';
import { Ripples } from './settings.js';

const waves = /* glsl */`
uniform float uTime, uActivity, uNature, uScene;
uniform vec4 uRipples[16];
vec3 surfaceAt(vec2 p) {
  float t=uTime;
  vec2 k=vec2(.72,.48);float phase=dot(p,k)-t*1.1;
  float h=sin(phase)*.065;vec2 gradient=cos(phase)*.065*k;
  k=vec2(-.48,1.12);phase=dot(p,k)-t*1.47;
  h+=sin(phase)*.045;gradient+=cos(phase)*.045*k;
  k=vec2(1.85,.3);phase=dot(p,k)+t*1.6;
  h+=sin(phase)*.022;gradient+=cos(phase)*.022*k;
  k=vec2(.9,2.4);phase=dot(p,k)-t*2.1;
  h+=sin(phase)*.012;gradient+=cos(phase)*.012*k;
  if (uScene<.5) {
    vec2 swell=p-vec2(-2.+sin(t*.31)*2.,-1.+cos(t*.23)*3.);
    float mound=exp(-dot(swell,swell)*1.5)*pow(.5+.5*sin(t*1.7),4.)*.5;
    h+=mound;gradient-=mound*3.*swell;
  }
  for(int i=0;i<16;i++) {
    vec4 r=uRipples[i];float age=t-r.z;
    if(age>=0.&&age<6.) {
      vec2 delta=p-r.xy;float d=length(delta),front=d-age*2.6;
      float envelope=exp(-front*front*1.1-age*.65)*.085*r.w;
      h+=sin(front*8.)*envelope;
      gradient+=(8.*cos(front*8.)-2.2*front*sin(front*8.))*envelope*delta/max(d,.001);
    }
  }
  if(uScene>.5&&uScene<1.5) {
    vec2 v=p-vec2(1.5,-1.5);float d=length(v);
    float phase=d*5.-t*3.+atan(v.y,v.x)*2.,envelope=.09*exp(-d*.24);
    h+=sin(phase)*envelope-.18*exp(-d*d*.6);
    gradient+=envelope*(cos(phase)*(5.*v/max(d,.001)+2.*vec2(-v.y,v.x)/max(d*d,.001))-.24*sin(phase)*v/max(d,.001));
    gradient+=.216*exp(-d*d*.6)*v;
  }
  return vec3(h,gradient)*uActivity;
}
float heightAt(vec2 p) { return surfaceAt(p).x; }
`;

export class LiquidSurface {
  constructor({ scene, quality, color, lightDirection, lightColor, width = 28, length = 30 }) {
    this.ripples = new Ripples();
    this.kind = scene;
    const shader = {
      name: 'LiquidWorldsSurface',
      uniforms: {
        color: { value: new T.Color(color) }, tDiffuse: { value: null }, textureMatrix: { value: new T.Matrix4() },
        uTime: { value: 0 }, uActivity: { value: 1 }, uNature: { value: scene === 'forest' ? 1 : 0 },
        uScene: { value: scene === 'grotto' ? 0 : scene === 'foundry' ? 1 : 2 },
        uRipples: { value: Array.from({ length: 16 }, () => new T.Vector4(0, 0, -100, 0)) },
        uLight: { value: new T.Vector3(...lightDirection).normalize() }, uLightColor: { value: new T.Color(lightColor) },
        uRefract: { value: null }, uHasRefraction: { value: 0 },
      },
      vertexShader: /* glsl */`
        ${waves}
        uniform mat4 textureMatrix;
        varying vec4 vReflect, vScreen;
        varying vec3 vWorld;
        void main() {
          vec3 p = position; p.z += heightAt(vec2(p.x,-p.y));
          vReflect = textureMatrix * vec4(position,1.);
          vWorld = (modelMatrix * vec4(p,1.)).xyz;
          vScreen = projectionMatrix * modelViewMatrix * vec4(p,1.);
          gl_Position = vScreen;
        }`,
      fragmentShader: /* glsl */`
        ${waves}
        uniform sampler2D tDiffuse, uRefract;
        uniform float uHasRefraction;
        uniform vec3 color, uLight, uLightColor;
        varying vec4 vReflect, vScreen;
        varying vec3 vWorld;
        #include <common>
        #include <fog_pars_fragment>
        float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main() {
          vec2 p = vWorld.xz;
          if (uScene < .5 && dot(p/vec2(12.4,11.4),p/vec2(12.4,11.4)) > 1.) discard;
          if (uScene > .5 && uScene < 1.5 && (abs(p.x)>7.2 || abs(p.y)>10.8)) discard;
          float bank = 5.2 + sin(p.y*.28)*.65 + sin(p.y*.6)*.25;
          if (uScene > 1.5 && abs(p.x)>bank) discard;
          vec2 slope = surfaceAt(p).yz;
          slope += vec2(sin(p.x*16.+p.y*13.-uTime*3.),cos(p.y*18.-p.x*9.+uTime*2.))*.018*uActivity;
          vec3 n = normalize(vec3(-slope.x,1.,-slope.y));
          vec3 v = normalize(cameraPosition-vWorld);
          float fresnel = .035 + .965*pow(1.-max(dot(n,v),0.),5.);
          vec2 uv = vReflect.xy/vReflect.w + slope*.025;
          vec3 reflected = texture2D(tDiffuse,clamp(uv,.002,.998)).rgb;
          vec3 metal = reflected*vec3(.87,.94,1.03) + color*.065;
          vec2 screenUV = vScreen.xy/vScreen.w*.5+.5;
          vec3 bed = color;
          if (uHasRefraction>.5) bed = texture2D(uRefract,clamp(screenUV+slope*.015,.002,.998)).rgb;
          vec3 clearWater = mix(bed*vec3(.62,.86,.79), color, .24);
          vec3 result = mix(metal, mix(clearWater,reflected,clamp(fresnel+.14,.0,.96)), uNature);
          vec3 halfway = normalize(uLight+v);
          float spec = pow(max(dot(n,halfway),0.),160.)*.9 + pow(max(dot(n,halfway),0.),22.)*.09;
          result += uLightColor*spec;
          if (uNature>.5) {
            float flow = sin(p.x*12.+sin(p.y*3.-uTime)*2.)*sin(p.y*9.-uTime*3.);
            float edge = 1.-smoothstep(.0,.65,bank-abs(p.x));
            float fallFoam = exp(-length((p-vec2(0.,-8.7))*vec2(.36,.9)));
            float fleck = smoothstep(.58,.9,flow);
            float foam = (edge*.5 + fallFoam*.75)*fleck;
            result = mix(result,vec3(.88,.99,.92),foam*.7);
            float caustic = pow(.5+.5*sin(p.x*8.+sin(p.y*6.+uTime))*sin(p.y*7.-uTime),8.);
            result += vec3(.09,.16,.09)*caustic;
          }
          gl_FragColor = vec4(result,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    };
    this.mesh = new Reflector(new T.PlaneGeometry(width, length, quality.segments, quality.segments), {
      shader, color, textureWidth: quality.reflection, textureHeight: quality.reflection, multisample: 0, clipBias: .004,
    });
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0;
    this.mesh.material.side = T.FrontSide;
    this.uniforms = this.mesh.material.uniforms;
    this.mesh.name = 'Living liquid surface';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }
  update(time, activity) {
    this.uniforms.uTime.value = time; this.uniforms.uActivity.value = activity;
    this.ripples.events.forEach((r, i) => this.uniforms.uRipples.value[i].set(r.x, r.z, r.born, r.strength));
  }
  impact(x, z, time, strength) { this.ripples.add(x, z, time, strength); }
  dispose() { this.mesh.geometry.dispose(); this.mesh.dispose(); }
}
