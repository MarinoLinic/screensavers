import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, DEFAULTS } from '../js/config.js';
import { Landscape } from '../js/landscape.js';
import { channelDistance } from '../js/landscapes.js';

for(const biome of BIOMES)test(`Landscape ${biome.family}: fixed view, complete geometry, dry trunks, and disposal`,()=>{
  const world=new Landscape(biome,DEFAULTS),view=JSON.stringify(world.view);
  let vertices=0;
  for(const g of world.geometries){const a=g.getAttribute('position');assert.ok(a);vertices+=a.count;for(const v of a.array)assert.ok(Number.isFinite(v));}
  assert.ok(vertices>30000);world.update(3600);assert.equal(JSON.stringify(world.view),view);
  assert.ok(world.view.position[2]>world.view.target[2]);
  for(const site of world.treeSites){assert.equal(site.y,world.height(site.x,site.z));if(biome.id==='river')assert.ok(channelDistance(site.x,site.z)>9);}
  if(['moon','tundra'].includes(biome.id))assert.equal(world.treeSites.length,0);
  for(const site of world.landAnimalSites||[])if(site.water)assert.ok(world.height(site.x,site.z)>.2,'land animal is standing in water');
  if(biome.id==='moon')assert.equal(world.reflections.length,0);
  const owned=new Set(world.materials.values());world.root.traverse(o=>{if(o.material)assert.ok(owned.has(o.material),'mesh material must be owned for disposal');});
  const geometryCount=world.geometries.size,materialCount=world.materials.size,textureCount=world.textures.size;let disposed=0,targetsDisposed=0;
  for(const g of world.geometries)g.addEventListener('dispose',()=>disposed++);
  for(const m of world.materials.values())m.addEventListener('dispose',()=>disposed++);
  for(const t of world.textures.values())t.addEventListener('dispose',()=>disposed++);
  for(const r of world.reflections)r.getRenderTarget().addEventListener('dispose',()=>targetsDisposed++);
  world.dispose();assert.equal(disposed,geometryCount+materialCount+textureCount);assert.equal(targetsDisposed,world.reflections.length);assert.equal(world.root.children.length,0);
});
test('landscape click effects and ripple history have fixed resource bounds',()=>{
  const world=new Landscape(BIOMES.find(b=>b.id==='river'),DEFAULTS);const count=world.geometries.size;
  for(let i=0;i<20;i++)world.click(new world.root.position.constructor(i,0,-3));
  assert.equal(world.effects.length,6);assert.equal(world.ripples.length,8);assert.equal(world.geometries.size,count+6);
  world.click(new world.root.position.constructor(20,4,-3));assert.equal(world.ripples.length,8,'dry-bank clicks must not add a water ripple');
  world.update(3);assert.equal(world.effects.length,0);assert.equal(world.geometries.size,count);world.dispose();
});
