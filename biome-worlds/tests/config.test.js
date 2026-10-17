import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, DEFAULTS, sanitize, nextBiome, random, clockStep, riverDistance, riverX, coastHeight, islandHeight } from '../js/config.js';

test('stored preferences recover from corrupt, unknown, or extreme values',()=>{
  assert.deepEqual(sanitize(null),DEFAULTS);
  const settings=sanitize({biome:'bogus',aesthetic:'bogus',camera:'spin',quality:'ultra',speed:100,tour:'true',interval:12,atmosphere:false});
  assert.equal(settings.biome,DEFAULTS.biome);assert.equal(settings.speed,2);assert.equal(settings.tour,false);assert.equal(settings.atmosphere,false);assert.equal(settings.interval,90);
  assert.equal(sanitize({speed:NaN}).speed,1);assert.equal(sanitize({speed:-5}).speed,.2);
});
test('tour visits every family once and wraps in both directions',()=>{
  let id=BIOMES[0].id;const visited=new Set();for(let i=0;i<10;i++){visited.add(id);id=nextBiome(id);}
  assert.equal(visited.size,10);assert.equal(id,BIOMES[0].id);assert.equal(nextBiome(id,-1),BIOMES.at(-1).id);
});
test('tour clock uses wall time independent of simulation speed and render clamping',()=>{
  const state={time:0,tourTime:0},settings={...DEFAULTS,tour:true,interval:45,speed:.2};
  assert.equal(clockStep(state,44,settings,false,false),false);assert.ok(Math.abs(state.time-.02)<1e-9);
  assert.equal(clockStep(state,2,settings,false,false),true);assert.equal(state.tourTime,1);
});
test('pause and background tabs consume neither simulation nor tour time',()=>{
  const state={time:3,tourTime:4},settings={...DEFAULTS,tour:true};
  clockStep(state,40,settings,true,false);clockStep(state,40,settings,false,true);assert.deepEqual(state,{time:3,tourTime:4});
});
test('seeded scenery stays deterministic and in the unit interval',()=>{
  const a=random(103),b=random(103),c=random(991);const first=a();assert.equal(first,b());assert.notEqual(first,c());
  for(let i=0;i<1000;i++){const n=a();assert.equal(n,b());assert.ok(n>=0&&n<1);}
});
test('river placements are separated from the channel by an explicit dry-bank setback',()=>{
  for(const z of[-8,-3,3,8])for(const side of[-1,1]){
    const x=riverX(z)+side*(4.4+(z%3)*.1);assert.ok(riverDistance(x,z)>3.2);
  }
  assert.equal(riverDistance(riverX(0),0),0);
});
test('coastal terrain has distinct submerged and dry zones',()=>{
  assert.ok(coastHeight(-7,0)<.38);assert.ok(coastHeight(4,3)>.6);
  assert.ok(islandHeight(0,0)>.9);assert.ok(islandHeight(10,0)<.53);
});
test('existing preferences migrate to the fixed landscape view unless diorama is selected',()=>{
  assert.equal(sanitize({camera:'orbit',aesthetic:'nocturne'}).mode,'landscape');
  assert.equal(sanitize({mode:'diorama'}).mode,'diorama');
  assert.equal(sanitize({mode:'invalid'}).mode,'landscape');
  assert.deepEqual(BIOMES.map(b=>b.id),['marine','desert','jungle','forest','tundra','mediterranean','steppe','river','moon','island']);
  for(const b of BIOMES)assert.equal(b.name,b.family);
});
