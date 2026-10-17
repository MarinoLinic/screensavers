import * as T from '../vendor/three.module.min.js';
const vertex = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
export class Post {
  constructor(renderer, samples) {
    this.renderer = renderer;
    this.target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples });
    this.a = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, depthBuffer: false });
    this.b = this.a.clone();
    this.scene = new T.Scene(); this.camera = new T.Camera();
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2)); this.scene.add(this.quad);
    this.blur = new T.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: vertex, uniforms: { image: { value: null }, direction: { value: new T.Vector2() }, extract: { value: 0 } }, fragmentShader: /* glsl */`
      uniform sampler2D image; uniform vec2 direction; uniform float extract; varying vec2 vUv;
      vec3 sampleAt(vec2 uv){ vec3 c=texture2D(image,uv).rgb; return extract>.5 ? c*max(0.,max(c.r,max(c.g,c.b))-.9)/max(.001,max(c.r,max(c.g,c.b))) : c; }
      void main(){ vec3 c=sampleAt(vUv)*.227027; c+=(sampleAt(vUv+direction*1.384615)+sampleAt(vUv-direction*1.384615))*.316216; c+=(sampleAt(vUv+direction*3.230769)+sampleAt(vUv-direction*3.230769))*.070270; gl_FragColor=vec4(c,1.); }` });
    this.compose = new T.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: vertex, uniforms: { image: { value: this.target.texture }, glow: { value: this.b.texture }, strength: { value: .32 }, fade: { value: 0 }, exposure: { value: 1 } }, fragmentShader: /* glsl */`
      uniform sampler2D image,glow; uniform float strength,fade,exposure; varying vec2 vUv;
      #include <common>
      #include <tonemapping_pars_fragment>
      void main(){ vec3 c=(texture2D(image,vUv).rgb+texture2D(glow,vUv).rgb*strength)*exposure;
        c=ACESFilmicToneMapping(c);
        float vignette=1.-.16*pow(length((vUv-.5)*vec2(1.,.85)),1.5);
        gl_FragColor=vec4(c*vignette*(1.-fade),1.);
        #include <colorspace_fragment>
      }` });
  }
  resize(w, h) { this.target.setSize(w, h); this.a.setSize(Math.max(1,w>>2),Math.max(1,h>>2)); this.b.setSize(Math.max(1,w>>2),Math.max(1,h>>2)); }
  render(scene, camera, { bloom = true, fade = 0, exposure = 1 } = {}) {
    const r = this.renderer;
    r.setRenderTarget(this.target); r.render(scene, camera);
    if (bloom) {
      this.quad.material = this.blur;
      this.blur.uniforms.image.value = this.target.texture; this.blur.uniforms.extract.value = 1;
      this.blur.uniforms.direction.value.set(1 / this.a.width, 0);
      r.setRenderTarget(this.a); r.render(this.scene, this.camera);
      this.blur.uniforms.image.value = this.a.texture; this.blur.uniforms.extract.value = 0;
      this.blur.uniforms.direction.value.set(0,1 / this.a.height);
      r.setRenderTarget(this.b); r.render(this.scene,this.camera);
    }
    this.quad.material = this.compose;
    this.compose.uniforms.strength.value = bloom ? .32 : 0;
    this.compose.uniforms.fade.value = fade; this.compose.uniforms.exposure.value = exposure;
    r.setRenderTarget(null); r.render(this.scene,this.camera);
  }
  dispose() { for (const t of [this.target,this.a,this.b]) t.dispose(); this.quad.geometry.dispose(); this.blur.dispose(); this.compose.dispose(); }
}
