import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, STORAGE_KEY, validate, load, save, rng, Ripples, SceneClock } from '../js/settings.js';

test('untrusted settings cannot create invalid GPU budgets or runaway motion',()=>{
  for(const raw of [null,false,42,{},[],{quality:'__proto__',scene:'unknown',speed:Infinity,activity:NaN,seed:-1,interval:0,camera:'orbit',cycle:'yes',bloom:null}]){
    const s=validate(raw);assert.equal(s.quality,'balanced');assert.equal(s.scene,'grotto');assert.ok(s.speed>=.25&&s.speed<=2);assert.ok(s.seed>=0);assert.equal(s.interval,90);assert.equal(s.cycle,false);
  }
  const s=validate({speed:500,activity:-4,seed:2**53});assert.equal(s.speed,2);assert.equal(s.activity,.25);assert.equal(s.seed,2147483647);
});
test('blocked and malformed browser storage remain usable',()=>{
  assert.deepEqual(load({getItem:()=>'{broken'}),DEFAULTS);
  assert.deepEqual(load({getItem:()=>{throw Error('denied');}}),DEFAULTS);
  assert.doesNotThrow(()=>save({setItem:()=>{throw Error('quota');}},DEFAULTS));
  let stored;save({setItem:(key,value)=>{assert.equal(key,STORAGE_KEY);stored=value;}},{...DEFAULTS,paused:true,panelOpen:true,activity:99});
  const s=JSON.parse(stored);assert.equal(s.activity,2);assert.ok(!Object.hasOwn(s,'paused'));assert.ok(!Object.hasOwn(s,'panelOpen'));
});
test('same seed generates the same landscape without Math.random',()=>{
  const a=rng(2001),b=rng(2001),c=rng(2002);
  const x=Array.from({length:1000},a),y=Array.from({length:1000},b),z=Array.from({length:1000},c);
  assert.deepEqual(x,y);assert.notDeepEqual(x,z);assert.ok(x.every(v=>v>=0&&v<1));
});
test('100,000 liquid impacts keep exactly sixteen ripple objects',()=>{
  const r=new Ripples(),objects=[...r.events];
  for(let i=0;i<100000;i++)r.add(i%5,i%7,i*.1,1);
  assert.equal(r.events.length,16);assert.ok(r.events.every((e,i)=>e===objects[i]));assert.equal(r.cursor,0);
  assert.equal(r.sample(1,1,10020),0);
});
test('impacts travel outward and decay to zero',()=>{
  const r=new Ripples();r.add(0,0,0,1);
  assert.equal(r.sample(1,1,-1),0);assert.equal(r.sample(1,1,7),0);
  assert.ok(Math.abs(r.sample(3,0,1))>.001);
  assert.ok(Math.abs(r.sample(20,0,1))<1e-10);
});
test('pause and hidden tabs freeze simulation and the scene timer',()=>{
  const c=new SceneClock();c.step(.05,{speed:2,cycle:true});assert.equal(c.time,.1);
  const before={time:c.time,cycle:c.cycleTime};
  for(let i=0;i<10000;i++){c.step(.05,{paused:true,cycle:true});c.step(.05,{hidden:true,cycle:true});}
  assert.equal(c.time,before.time);assert.equal(c.cycleTime,before.cycle);
  c.step(Infinity);c.step(-1);assert.equal(c.time,before.time);
});
test('scene cycling uses active elapsed time independently of liquid speed',()=>{
  const c=new SceneClock();let transitions=0;
  for(let i=0;i<601;i++)if(c.step(.05,{speed:.25,cycle:true,interval:30}))transitions++;
  assert.equal(transitions,1);assert.ok(c.time<8);c.resetCycle();assert.equal(c.cycleTime,0);
});
test('slow frames keep the travel timer accurate while limiting simulation jumps',()=>{
  const c=new SceneClock();assert.equal(c.step(31,{cycle:true,interval:30}),true);assert.equal(c.time,.05);
});
