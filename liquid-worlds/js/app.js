import * as T from '../vendor/three.module.min.js';
import { SCENES, QUALITY, DEFAULTS, validate, load, save, SceneClock } from './settings.js';
import { Landscape } from './scenes.js';
import { Post } from './post.js';
import { View } from './camera.js';
const $=id=>document.getElementById(id),canvas=$('canvas');
let storage;try{storage=localStorage;}catch{storage=null;}
let settings=load(storage),paused=false,panelOpen=false,hiddenControls=false,world,renderer,post,view;
let dirty=true,transition=null,fade=0,frameCount=0,frameElapsed=0,fps=60,dprScale=1,slowWindows=0;
let last=performance.now(),lastInteraction=last,toastUntil=0,sceneGeneration=0,renderCount=0;
const clock=new SceneClock();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced){settings.camera='fixed';paused=true;}
const params=new URLSearchParams(location.search);
if(SCENES.some(s=>s.id===params.get('scene')))settings.scene=params.get('scene');
if(Object.hasOwn(QUALITY,params.get('quality')))settings.quality=params.get('quality');
if(params.has('seed'))settings.seed=validate({seed:Number(params.get('seed'))}).seed;

function toast(text){$('toast').textContent=text;toastUntil=performance.now()+2600;$('toast').classList.add('visible');}
function persist(){save(storage,settings);}
function wake(){lastInteraction=performance.now();if(!hiddenControls)document.body.classList.remove('quiet');}
function toggleControls(){
  hiddenControls=!document.body.classList.contains('quiet');
  document.body.classList.toggle('quiet',hiddenControls);
  if(hiddenControls)canvas.focus({preventScroll:true});
  else wake();
}
$('restore').addEventListener('click',()=>{hiddenControls=false;wake();canvas.focus({preventScroll:true});});
function sync(){
  const current=SCENES.find(s=>s.id===settings.scene),index=SCENES.indexOf(current);
  document.documentElement.style.setProperty('--accent',current.color);
  $('sceneTitle').textContent=current.name;$('sceneSubtitle').textContent=current.subtitle;$('sceneNumber').textContent=`0${index+1} / 03`;
  for(const id of ['scene','quality','speed','activity','camera','interval','seed'])if($(id))$(id).value=settings[id];
  for(const id of ['bloom','cycle'])$(id).checked=settings[id];
  $('speedOut').textContent=`${settings.speed.toFixed(2)}×`;$('activityOut').textContent=`${settings.activity.toFixed(2)}×`;
  $('interval').disabled=!settings.cycle;$('pause').setAttribute('aria-pressed',String(paused));$('pauseLabel').textContent=paused?'Resume':'Pause';$('pauseIcon').textContent='[Space]';
  for(const b of $('scenes').children)b.setAttribute('aria-pressed',String(b.dataset.scene===settings.scene));
}
function fail(message){$('loading').hidden=true;$('failure').hidden=false;if(message)$('failureText').textContent=message;canvas.hidden=true;}
function resize(){
  if(!renderer)return;
  const q=QUALITY[settings.quality],dpr=Math.min(devicePixelRatio||1,q.dpr)*dprScale;
  renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);
  post.resize(Math.max(1,Math.floor(innerWidth*dpr)),Math.max(1,Math.floor(innerHeight*dpr)));
  view.camera.aspect=innerWidth/innerHeight;view.camera.updateProjectionMatrix();view.dirty=true;dirty=true;
}
function rebuild(){
  world?.dispose();renderer.renderLists.dispose();
  world=new Landscape(settings.scene,settings.seed,QUALITY[settings.quality]);
  view.setHome(world.cameraHome);clock.time=0;clock.resetCycle();world.update(0,settings.activity);
  // First main pass builds the shadow atlas before the reflection/refraction passes use it.
  renderer.compile(world.scene,view.camera);sceneGeneration++;dirty=true;
  renderer.shadowMap.needsUpdate=true;
}
function travel(scene){
  if(!renderer)return;
  settings.scene=scene;persist();sync();clock.resetCycle();
  if(transition){transition.next=scene;if(transition.phase==='in'){transition.phase='out';transition.elapsed=fade*.6;}return;}
  transition={phase:'out',elapsed:0,next:scene};dirty=true;wake();
}
function next(delta=1){const i=SCENES.findIndex(s=>s.id===settings.scene);travel(SCENES[(i+delta+3)%3].id);}
function togglePause(){paused=!paused;dirty=true;sync();toast(paused?'Time stands still':'The water moves again');wake();}
function setPanel(open){
  panelOpen=open;$('panel').hidden=!open;$('backdrop').hidden=!open;
  $('stage').inert=open;$('chrome').inert=open;
  if(open){document.body.classList.remove('quiet');$('close').focus();}else{hiddenControls=false;wake();canvas.focus({preventScroll:true});}
}
async function fullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{toast('Fullscreen is unavailable in this browser');}
}
function draw(){
  view.update(clock.time,settings.camera==='drift'&&!paused,view.camera.aspect);
  renderer.info.reset();world.refract(renderer,view.camera);
  post.render(world.scene,view.camera,{bloom:settings.bloom,fade,exposure:settings.scene==='grotto'?1.08:settings.scene==='forest'?.93:1.03});
  dirty=false;renderCount++;
}
function snapshot(){
  if(!renderer||!world)return;draw();
  canvas.toBlob(blob=>{if(!blob){toast('Snapshot unavailable');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`liquid-worlds-${world.kind}-${settings.seed}-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Snapshot saved');},'image/png');
}
function splash(x,z){
  if(!world)return;
  const valid=world.kind==='grotto'?x*x/153.76+z*z/129.96<1:world.kind==='foundry'?Math.abs(x)<7.2&&Math.abs(z)<10.8:Math.abs(x)<5&&Math.abs(z)<24;
  if(!valid)return;
  world.effects.burst(x,z,clock.time,2.2);world.update(clock.time,settings.activity);dirty=true;
}
for(const [i,s] of SCENES.entries()){
  const b=document.createElement('button');b.className='scene-card';b.dataset.scene=s.id;
  const gradients=['radial-gradient(ellipse at 65% 70%,#a8eef1 0%,#344d65 25%,#08121d 75%)','linear-gradient(130deg,#101d2b 15%,#da9559 48%,#596978 65%,#18232c)','linear-gradient(130deg,#bfc790,#537c49 40%,#88c9bd 65%,#1a4949)'];
  b.innerHTML=`<span class="swatch" style="background:${gradients[i]}"></span><span><strong>${s.name}</strong><small>${s.subtitle}</small></span>`;b.addEventListener('click',()=>travel(s.id));$('scenes').append(b);
}
for(const [id,fn] of Object.entries({prev:()=>next(-1),next:()=>next(),pause:togglePause,settingsButton:()=>setPanel(true),close:()=>setPanel(false),fullscreen,snapshot,hide:toggleControls,applySeed:()=>{settings.seed=validate({seed:Number($('seed').value)}).seed;persist();sync();travel(settings.scene);},newSeed:()=>{settings.seed=(settings.seed+7919)%2147483648;persist();sync();travel(settings.scene);},resetCamera:()=>{view?.reset();dirty=true;toast('View restored');}}))$(id).addEventListener('click',fn);
$('backdrop').addEventListener('click',()=>setPanel(false));
for(const id of ['quality','speed','activity','camera','interval','bloom','cycle']){
  $(id).addEventListener(['speed','activity'].includes(id)?'input':'change',()=>{
    const el=$(id);settings[id]=el.type==='checkbox'?el.checked:['speed','activity','interval'].includes(id)?Number(el.value):el.value;
    persist();sync();clock.resetCycle();dirty=true;
    if(id==='camera')view?.reset();
    if(id==='quality'&&renderer){dprScale=1;slowWindows=0;post.dispose();post=new Post(renderer,QUALITY[settings.quality].samples);resize();travel(settings.scene);}
    if(id==='activity'&&world)world.update(clock.time,settings.activity);
  });
}
document.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    if(!panelOpen){hiddenControls=false;wake();return;}
    const focus=[...$('panel').querySelectorAll('button,input,select,summary')].filter(x=>!x.disabled&&x.getClientRects().length);
    const first=focus[0],end=focus.at(-1);
    if(e.shiftKey&&document.activeElement===first){end.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===end){first.focus();e.preventDefault();}
    return;
  }
  if(e.key==='Escape'){setPanel(false);return;}
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  const tag=e.target.tagName;
  if(['INPUT','TEXTAREA','SELECT'].includes(tag)||e.target.isContentEditable)return;
  if(e.code==='Space'&&['BUTTON','SUMMARY'].includes(tag))return;
  const k=e.key.toLowerCase();
  if(k==='o'){setPanel(!panelOpen);e.preventDefault();return;}
  if(panelOpen)return;
  if(k===' '){togglePause();e.preventDefault();}
  else if(k==='f')fullscreen();else if(k==='s')snapshot();else if(k==='h')toggleControls();
  else if(k==='a'){settings.camera=settings.camera==='drift'?'fixed':'drift';view?.reset();persist();sync();dirty=true;toast(settings.camera==='drift'?'Camera drifting':'Viewpoint held');}
  else if(k==='r')$('newSeed').click();else if((k==='['||k==='p'))next(-1);else if((k===']'||k==='n'))next();else if(['1','2','3'].includes(k))travel(SCENES[Number(k)-1].id);
  wake();
});
document.addEventListener('pointermove',wake,{passive:true});document.addEventListener('pointerdown',wake,{passive:true});
document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;});
window.addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The graphics context was interrupted. Reload to return to the landscape.');renderer=null;});
sync();
try{
  renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;
  post=new Post(renderer,QUALITY[settings.quality].samples);
  const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,110);
  view=new View(camera,canvas,splash,()=>{dirty=true;});resize();rebuild();draw();$('loading').hidden=true;last=performance.now();
}catch(err){console.error('Liquid Worlds initialization',err);fail();renderer=null;}

function frame(now){
  requestAnimationFrame(frame);
  if(now-last<1000/60-.5)return;
  const realDt=Math.max(0,(now-last)/1000),dt=Math.min(.05,realDt);last=now;
  if(!renderer||document.hidden)return;
  if(clock.step(realDt,{paused,speed:settings.speed,cycle:settings.cycle&&!transition,interval:settings.interval}))next();
  if(transition){
    transition.elapsed+=dt;
    const progress=Math.min(1,transition.elapsed/.6);fade=transition.phase==='out'?progress:1-progress;
    if(progress>=1){
      if(transition.phase==='out'){settings.scene=transition.next;sync();rebuild();transition.phase='in';transition.elapsed=0;}
      else {transition=null;fade=0;}
    }
    dirty=true;
  }
  if(!paused){world.update(clock.time,settings.activity);dirty=true;}
  if(dirty||(!paused&&settings.camera==='drift'))draw();
  if(!panelOpen&&!hiddenControls&&now-lastInteraction>7000&&!$('chrome').contains(document.activeElement))document.body.classList.add('quiet');
  if(now>toastUntil)$('toast').classList.remove('visible');
  if(!paused&&!transition){frameCount++;frameElapsed+=realDt;}
  if(frameElapsed>=3){
    fps=frameCount/frameElapsed;frameElapsed=0;frameCount=0;
    if(settings.quality==='balanced'&&fps<32){slowWindows++;if(slowWindows>=2&&dprScale>.65){dprScale=Math.max(.65,dprScale*.85);resize();slowWindows=0;}}
    else slowWindows=0;
    if(panelOpen){const i=renderer.info;$('diagnostics').textContent=`${Math.round(fps)} fps · ${canvas.width} × ${canvas.height} · ${i.render.calls} draw calls across all passes · ${i.memory.geometries} geometries · ${i.memory.textures} textures. Rendering stops while paused or the tab is hidden.`;}
  }
}
requestAnimationFrame(frame);
window.LIQUID_WORLDS={
  get settings(){return {...settings};},get world(){return world;},get renderer(){return renderer;},get time(){return clock.time;},get paused(){return paused;},get generation(){return sceneGeneration;},get panelOpen(){return panelOpen;},
  travel,splash,diagnostics:()=>({fps,time:clock.time,generation:sceneGeneration,renders:renderCount,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,calls:renderer?.info.render.calls,programs:renderer?.info.programs.length,ripples:world?.water.ripples.capacity}),
};
