import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, DEFAULTS, riverDistance } from '../js/config.js';
import { World } from '../js/world.js';

for(const biome of BIOMES)test(`${biome.family}: finite geometry, anchored trees, disposed resources`,()=>{
  const world=new World(biome,{...DEFAULTS,biome:biome.id});
  let vertices=0;
  for(const geometry of world.geometries){
    const attr=geometry.getAttribute('position');assert.ok(attr);vertices+=attr.count;
    for(const value of attr.array)assert.ok(Number.isFinite(value),'geometry contains a non-finite coordinate');
  }
  assert.ok(vertices>2000);world.update(1000000);
  world.root.traverse(o=>assert.ok([o.position.x,o.position.y,o.position.z].every(Number.isFinite)));
  for(const site of world.treeSites){
    assert.equal(site.y,world.height(site.x,site.z));
    if(biome.id==='river')assert.ok(riverDistance(site.x,site.z)>3.2);
    if(biome.id==='mediterranean')assert.ok(site.y>.6);
    if(biome.id==='island')assert.ok(site.y>.75);
  }
  if(biome.id==='tundra'||biome.id==='moon')assert.equal(world.treeSites.length,0);
  if(biome.id==='moon')assert.equal(world.waterUniforms.length,0);
  let disposalEvents=0;
  for(const g of world.geometries)g.addEventListener('dispose',()=>disposalEvents++);
  for(const m of world.materials.values())m.addEventListener('dispose',()=>disposalEvents++);
  const expected=world.geometries.size+world.materials.size;world.dispose();
  assert.equal(disposalEvents,expected);assert.equal(world.root.children.length,0);assert.equal(world.animations.length,0);
});
