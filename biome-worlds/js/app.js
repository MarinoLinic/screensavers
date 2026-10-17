import * as THREE from '../vendor/three.module.min.js';
import { BIOMES, DEFAULTS, sanitize, nextBiome, clockStep } from './config.js';
import { World } from './world.js';
import { Landscape } from './landscape.js';

const $=id=>document.getElementById(id),KEY='biome-worlds.v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
let settings=sanitize(saved);
const params=new URLSearchParams(location.search);for(const key of['biome','mode','aesthetic','quality','camera'])if(params.has(key))settings=sanitize({...settings,[key]:params.get(key)});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced)settings.camera='still';
let paused=reduced,panelOpen=false,world,renderer,scene,camera,keyLight,hemi,rim,ground;
let dirty=true,renders=0,generation=0,lastRender=0,lastTick=performance.now(),idleAt=lastTick,lastToast,previousFocus;
const clock={time:0,tourTime:0},pointers=new Map();let yaw=-.65,pitch=.63,zoom=1,manualYaw=0,manualPitch=0,dragging=false,lastPointer,pinchDistance=0;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{toast('Settings could not be saved.');}}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(lastToast);lastToast=setTimeout(()=>$('toast').hidden=true,2500);}
function wake(){idleAt=performance.now();document.body.classList.remove('idle');}
function quiet(value){document.body.classList.toggle('quiet',value);wake();if(!value)$('world').focus({preventScroll:true});}
function setPause(value){paused=value;$('pause').innerHTML=paused?'<b>[Space]</b> Resume':'<b>[Space]</b> Pause';$('pause').setAttribute('aria-pressed',String(paused));lastTick=performance.now();dirty=true;}
function labels(){
  const b=BIOMES.find(b=>b.id===settings.biome);
  $('habTag').textContent=`${b.family.toUpperCase()} / ${settings.mode.toUpperCase()}`;
  document.body.classList.toggle('diorama',settings.mode==='diorama');
  document.querySelectorAll('[data-biome]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.biome===settings.biome)));
  for(const key of['biome','mode','aesthetic','camera','quality','interval','speed'])$(key).value=settings[key];
  for(const key of['tour','atmosphere'])$(key).checked=settings[key];
  $('speedValue').value=settings.speed.toFixed(1)+'×';$('interval').disabled=!settings.tour;$('cameraRow').hidden=settings.mode!=='diorama';
  $('atmosphereLabel').textContent=settings.biome==='moon'?'Stars':settings.biome==='marine'?'Light shafts & particles':'Atmosphere';
  $('modeHint').textContent=settings.mode==='landscape'?'Click for an effect. The landscape camera stays fixed.':'Drag to orbit. Scroll or pinch to zoom. R resets the view.';
  $('world').setAttribute('aria-label',settings.mode==='landscape'?`${b.family}. Animated 3D scene with a fixed camera. Click for an effect.`:`${b.family} diorama. Drag to orbit and scroll to zoom.`);
}
function palette(){
  const night=settings.aesthetic==='nocturne'||settings.biome==='moon';
  const diorama=settings.mode==='diorama';
  if(diorama){
    const colors={desert:['#dfc4a2','#f0dfbd'],jungle:['#afc7b9','#deead8'],tundra:['#c7dbe1','#edf0e3'],forest:['#bccab5','#e8ecd9'],steppe:['#d1c7a7','#ede9cf'],marine:['#93bac0','#c2dee0'],island:['#bddbd5','#e6efdb'],river:['#bbd0c3','#e7edd9'],mediterranean:['#c2d7cf','#eeecdb']};
    const [bg,glow]=night?['#131d33','#344057']:settings.aesthetic==='porcelain'?['#dce2e4','#f3eae4']:colors[settings.biome]||colors.mediterranean;
    document.body.style.background=`radial-gradient(ellipse at 48% 34%,${glow},${bg} 75%)`;scene.background=null;scene.fog=null;ground.visible=true;
    hemi.color.set(night?'#b8c9e9':'#fff8e4');hemi.groundColor.set(night?'#354d64':'#839e86');hemi.intensity=night?1.3:2.6;keyLight.color.set(night?'#a7c9ec':'#fff0cc');keyLight.intensity=night?2.1:3.6;keyLight.position.set(-12,22,10);keyLight.target.position.set(0,0,0);
    keyLight.shadow.camera.left=-18;keyLight.shadow.camera.right=18;keyLight.shadow.camera.top=18;keyLight.shadow.camera.bottom=-18;keyLight.shadow.camera.far=60;
  }else{
    document.body.style.background='#11232d';scene.background=world.background;scene.fog=world.fog;ground.visible=false;
    hemi.color.set(night?'#93abc7':'#e5efda');hemi.groundColor.set(night?'#243640':'#57674d');hemi.intensity=night?world.light.ambient*.65:world.light.ambient;
    const lunar=settings.biome==='moon';
    keyLight.color.set(lunar?'#fff3df':night?'#9bbce1':'#fff1d8');keyLight.intensity=night&&!lunar?world.light.intensity*.58:world.light.intensity;keyLight.position.set(...world.light.sun);keyLight.target.position.set(0,0,-25);
    keyLight.shadow.camera.left=-48;keyLight.shadow.camera.right=48;keyLight.shadow.camera.top=48;keyLight.shadow.camera.bottom=-48;keyLight.shadow.camera.far=180;
  }
  keyLight.shadow.camera.updateProjectionMatrix();rim.intensity=night?.45:diorama?1.1:.7;renderer.toneMappingExposure=settings.aesthetic==='porcelain'?1.1:1;
}
function quality(){
  if(!renderer)return;const budget={low:{ratio:.9,shadow:512},balanced:{ratio:1.15,shadow:1536},high:{ratio:1.6,shadow:2048}}[settings.quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio,budget.ratio));renderer.shadowMap.enabled=settings.quality!=='low';
  if(keyLight.shadow.mapSize.x!==budget.shadow){keyLight.shadow.map?.dispose();keyLight.shadow.map=null;keyLight.shadow.mapSize.set(budget.shadow,budget.shadow);}
  resize();
}
function resetCamera(){zoom=1;manualYaw=0;manualPitch=0;yaw=-.65;pitch=.63;dirty=true;}
function build(resetView=false){
  if(!scene)return;
  if(world){scene.remove(world.root);world.dispose();renderer.renderLists.dispose();}
  const biome=BIOMES.find(b=>b.id===settings.biome);world=settings.mode==='landscape'?new Landscape(biome,settings):new World(biome,settings);scene.add(world.root);
  camera=settings.mode==='landscape'?new THREE.PerspectiveCamera(world.view.fov,innerWidth/innerHeight,.15,700):new THREE.OrthographicCamera(-20,20,13,-13,.1,180);
  generation++;clock.tourTime=0;if(resetView)resetCamera();palette();labels();quality();dirty=true;
  renderer.domElement.getAnimations().forEach(a=>a.cancel());if(!paused&&!reduced&&generation>1)renderer.domElement.animate([{opacity:.25},{opacity:1}],{duration:550,easing:'ease-out'});
}
function selectBiome(id){if(!BIOMES.some(b=>b.id===id))return;settings.biome=id;build(true);persist();wake();}
function selectLook(id){if(!['natural','porcelain','nocturne'].includes(id))return;settings.aesthetic=id;build();persist();wake();}
function selectMode(mode){if(!['landscape','diorama'].includes(mode))return;settings.mode=mode;build(true);persist();wake();}
function updateCamera(){
  if(settings.mode==='landscape'){camera.position.set(...world.view.position);camera.lookAt(...world.view.target);camera.updateMatrixWorld();return;}
  const drift=settings.camera==='drift'&&!dragging?Math.sin(clock.time*.055)*.14:0,orbit=settings.camera==='orbit'&&!dragging?clock.time*.028:0;
  const a=yaw+manualYaw+drift+orbit,p=THREE.MathUtils.clamp(pitch+manualPitch,.16,1.25),r=36,target=settings.biome==='moon'?2.5:1.7;
  camera.position.set(Math.sin(a)*Math.cos(p)*r,target+Math.sin(p)*r,Math.cos(a)*Math.cos(p)*r);camera.lookAt(0,target,0);camera.updateMatrixWorld();
}
function resize(){
  if(!renderer||!camera)return;renderer.setSize(innerWidth,innerHeight,false);const aspect=innerWidth/innerHeight;
  if(camera.isPerspectiveCamera){camera.aspect=aspect;camera.fov=aspect<.9?Math.min(71,world.view.fov+15):world.view.fov;}
  else{const height=Math.max(26,30/aspect)/zoom;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;}camera.updateProjectionMatrix();dirty=true;
}
function render(){if(!world)return;updateCamera();world.update(clock.time);renderer.render(scene,camera);renders++;dirty=false;}
function frame(now){
  requestAnimationFrame(frame);const dt=(now-lastTick)/1000;lastTick=now;if(document.hidden)return;
  if(clockStep(clock,dt,settings,paused,false)&&!panelOpen)selectBiome(nextBiome(settings.biome));if(panelOpen)clock.tourTime=0;
  if(!panelOpen&&!document.body.classList.contains('quiet')&&now-idleAt>8000)document.body.classList.add('idle');
  const fps=settings.quality==='high'?60:30;if((dirty||!paused)&&now-lastRender>=1000/fps-1){lastRender=now;render();}
}
function panel(value){
  panelOpen=value;$('panel').hidden=!value;$('veil').hidden=!value;wake();
  if(value){previousFocus=document.activeElement;document.body.classList.remove('quiet');$('world').inert=true;document.querySelectorAll('.chrome').forEach(el=>el.inert=true);$('restore').inert=true;$('close').focus();}
  else{$('world').inert=false;document.querySelectorAll('.chrome').forEach(el=>el.inert=false);$('restore').inert=false;(previousFocus||$('world')).focus({preventScroll:true});}
}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen unavailable.');}}
function snapshot(){
  if(!renderer)return;render();const image=document.createElement('canvas');image.width=renderer.domElement.width;image.height=renderer.domElement.height;const ctx=image.getContext('2d');
  if(settings.mode==='diorama'){const night=settings.aesthetic==='nocturne'||settings.biome==='moon';ctx.fillStyle=night?'#243449':'#dce5d5';ctx.fillRect(0,0,image.width,image.height);}ctx.drawImage(renderer.domElement,0,0);
  image.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`biome-worlds-${settings.mode}-${settings.biome}-${settings.aesthetic}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Snapshot saved.');},'image/png');
}
function clickEffect(event){
  if(settings.mode!=='landscape'||!world)return;updateCamera();const point=new THREE.Vector2(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1),ray=new THREE.Raycaster();ray.setFromCamera(point,camera);
  const hits=ray.intersectObjects(world.root.children,true).filter(hit=>hit.object.material?.type!=='ShaderMaterial'||hit.object.isReflector);
  const target=hits.find(hit=>hit.object.type!=='Points');const p=target?.point||ray.ray.at(25,new THREE.Vector3());world.click(p);dirty=true;
}
function controls(){
  for(const b of BIOMES){const option=document.createElement('option');option.value=b.id;option.textContent=b.family;$('biome').append(option);const button=document.createElement('button');button.dataset.biome=b.id;button.style.setProperty('--dot',b.accent);button.innerHTML=`<i aria-hidden="true"></i>${b.family}`;button.onclick=()=>selectBiome(b.id);$('biomeChoices').append(button);}
  $('previous').onclick=()=>selectBiome(nextBiome(settings.biome,-1));$('next').onclick=()=>selectBiome(nextBiome(settings.biome));$('settingsButton').onclick=()=>panel(true);$('close').onclick=()=>panel(false);$('veil').onclick=()=>panel(false);
  $('pause').onclick=()=>setPause(!paused);$('fullscreen').onclick=fullscreen;$('snapshot').onclick=snapshot;$('hide').onclick=()=>quiet(true);$('restore').onclick=()=>quiet(false);
  $('biome').onchange=()=>selectBiome($('biome').value);$('mode').onchange=()=>selectMode($('mode').value);$('aesthetic').onchange=()=>selectLook($('aesthetic').value);
  for(const key of['camera','quality','interval'])$(key).onchange=()=>{settings[key]=key==='interval'?Number($(key).value):$(key).value;if(key==='quality')build();if(key==='camera')resetCamera();clock.tourTime=0;persist();labels();dirty=true;};
  $('speed').oninput=()=>{settings.speed=Number($('speed').value);$('speedValue').value=settings.speed.toFixed(1)+'×';persist();};
  for(const key of['tour','atmosphere'])$(key).onchange=()=>{settings[key]=$(key).checked;if(key==='atmosphere'&&world)world.atmosphere.visible=settings.atmosphere;clock.tourTime=0;persist();labels();dirty=true;};
  $('reset').onclick=()=>{settings={...DEFAULTS};if(reduced)settings.camera='still';setPause(reduced);build(true);persist();};
  document.addEventListener('keydown',e=>{
    wake();if(panelOpen&&e.key==='Tab'){const all=[...$('panel').querySelectorAll('button,select,input')].filter(el=>!el.disabled&&el.getClientRects().length),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
    if(e.key==='Escape'){if(panelOpen)panel(false);else quiet(false);return;}if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(panelOpen){if(key==='o')panel(false);return;}
    if(key===' '){e.preventDefault();setPause(!paused);}else if(key==='arrowright'||key==='n'||key==='b')selectBiome(nextBiome(settings.biome));else if(key==='arrowleft'||key==='p')selectBiome(nextBiome(settings.biome,-1));else if(key==='o')panel(true);else if(key==='h')quiet(!document.body.classList.contains('quiet'));else if(key==='f')fullscreen();else if(key==='s')snapshot();else if(key==='r'&&settings.mode==='diorama')resetCamera();else if(/^[0-9]$/.test(key))selectBiome(BIOMES[key==='0'?9:Number(key)-1].id);
  });
  document.addEventListener('pointermove',wake,{passive:true});document.addEventListener('pointerdown',wake,{passive:true});const canvas=$('world');
  canvas.addEventListener('pointerdown',e=>{if(settings.mode==='landscape'){clickEffect(e);return;}pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);dragging=true;lastPointer=[e.clientX,e.clientY];if(pointers.size===2){const[a,b]=[...pointers.values()];pinchDistance=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
  canvas.addEventListener('pointermove',e=>{if(settings.mode!=='diorama'||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const[a,b]=[...pointers.values()],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinchDistance>0)zoom=THREE.MathUtils.clamp(zoom*dist/pinchDistance,.7,1.6);pinchDistance=dist;resize();}else if(lastPointer){manualYaw-=(e.clientX-lastPointer[0])*.005;manualPitch=THREE.MathUtils.clamp(manualPitch+(e.clientY-lastPointer[1])*.003,-.42,.6);dirty=true;}lastPointer=[e.clientX,e.clientY];});
  function release(e){pointers.delete(e.pointerId);dragging=pointers.size>0;lastPointer=pointers.size?[...pointers.values()][0]:null;pinchDistance=0;dirty=true;}canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('wheel',e=>{if(settings.mode!=='diorama')return;e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.7,1.6);resize();wake();},{passive:false});canvas.addEventListener('dblclick',()=>{if(settings.mode==='diorama')resetCamera();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);$('failure').hidden=false;});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{lastTick=performance.now();dirty=true;});
}
function diagnostics(){return{mode:settings.mode,biome:settings.biome,aesthetic:settings.aesthetic,time:clock.time,tourTime:clock.tourTime,paused,panelOpen,renders,generation,calls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,programs:renderer?.info.programs?.length,trees:world?.treeSites.length,creatures:world?.creatures.length,water:world?.waterUniforms.length,reflections:world?.reflections?.length||0,effects:world?.effects?.length||0,ripples:world?.ripples?.length||0,zoom,manualYaw,manualPitch,cameraPosition:camera?.position.toArray(),cameraMatrix:camera?.matrixWorld.elements.slice(),atmosphere:world?.atmosphere.visible};}
controls();labels();setPause(paused);
try{
  renderer=new THREE.WebGLRenderer({canvas:$('world'),alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();hemi=new THREE.HemisphereLight();scene.add(hemi);keyLight=new THREE.DirectionalLight();keyLight.castShadow=true;keyLight.shadow.camera.near=1;keyLight.shadow.normalBias=.06;keyLight.shadow.bias=-.00015;scene.add(keyLight,keyLight.target);rim=new THREE.DirectionalLight('#b8d2dc',.7);rim.position.set(20,15,-35);scene.add(rim);
  ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.ShadowMaterial({opacity:.15}));ground.rotation.x=-Math.PI/2;ground.position.y=-2.72;ground.receiveShadow=true;scene.add(ground);build(true);requestAnimationFrame(frame);
}catch(error){console.error(error);$('failure').hidden=false;}
window.BIOME_WORLDS={get world(){return world;},get renderer(){return renderer;},get settings(){return{...settings};},get paused(){return paused;},get clock(){return clock;},selectBiome,selectLook,selectMode,setPause,diagnostics,render,resetCamera,snapshot};
