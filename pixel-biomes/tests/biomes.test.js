import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BiomeWorld} from '../js/engine.js';
import {DEFAULTS,HABITATS,HABITAT_ORDER,validateSettings} from '../js/settings.js';
import {SPECIES,paintBackdrop,createVegetation,paintVegetation} from '../js/art.js';
import {paintBiomeAtmosphere} from '../js/biome-art.js';
import {groundY,waterline,isWetland} from '../js/terrain.js';

const NEW=HABITAT_ORDER.filter(h=>!['reef','kelp','lagoon','abyss','desert'].includes(h));
test('every new scene keeps its own resident and visitor cast across time and communities',()=>{
  for(const habitat of NEW) for(const community of ['mixed','reef','jellies']) {
    const w=new BiomeWorld({...DEFAULTS,habitat,community,population:48},130,282);
    assert.equal(w.count,48,habitat);
    for(const t of [0,12,50,120,250,10000]) {
      w.simTime=t;
      for(const r of w.sample()) {
        assert.ok(SPECIES[r.species].habitats.includes(habitat),`${habitat} emitted ${r.species}`);
        assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.y));
        if(r.anchor==='feet'&&habitat!=='med-terraces') assert.equal(r.groundY,groundY(habitat,w.width,w.height,r.x,r.depth));
        if(isWetland(habitat)&&r.motion==='swim') assert.ok(r.y>waterline(habitat,w.height));
      }
    }
  }
});
test('new scene paths remain independent of frame rate',()=>{
  for(const habitat of NEW) {
    const a=new BiomeWorld({...DEFAULTS,habitat}),b=new BiomeWorld({...DEFAULTS,habitat});
    a.step(14);for(let i=0;i<420;i++) b.step(1/30);
    a.sample().forEach((r,i)=>{const other=b.sample()[i];assert.ok(Math.abs(r.x-other.x)<1e-8&&Math.abs(r.y-other.y)<1e-8,habitat);});
  }
});
test('new backdrop, plants and atmosphere draw only valid integer-grid pixels, including portrait',()=>{
  for(const habitat of NEW) for(const [width,height] of [[480,300],[720,450],[130,282],[195,422],[360,225]]) {
    let n=0;
    const ctx={canvas:{width,height},globalAlpha:1,fillStyle:'#000000',fillRect(x,y,w,h){
      n++;assert.ok([x,y,w,h].every(Number.isInteger),`${habitat}: fractional rectangle`);
      assert.ok(w>0&&h>0);assert.match(this.fillStyle,/^#[a-f0-9]{6}$/i);
    }};
    paintBackdrop(ctx,width,height,habitat,1995);
    paintVegetation(ctx,createVegetation(width,height,habitat,1995),12);
    paintBiomeAtmosphere(ctx,width,height,habitat,12,1995,DEFAULTS);
    assert.ok(n>300,habitat);
  }
});
test('Moon has no terrestrial vegetation or air effects; new settings reject invalid values',()=>{
  assert.deepEqual(createVegetation(480,300,'moon',1995),[]);
  let draws=0;
  paintBiomeAtmosphere({fillRect(){draws++;}},480,300,'moon',12,1995,DEFAULTS);
  assert.equal(draws,0);
  assert.equal(validateSettings({frameRate:144,tourScope:'bogus'}).settings.frameRate,30);
  assert.equal(validateSettings({tourScope:'family',frameRate:60}).settings.tourScope,'family');
});

test('Marine residents keep native sprite scale instead of filling the view with doubled fish',()=>{
  for(const habitat of ['reef','kelp','lagoon','abyss']) for(const seed of [7,1995,2147483647]) {
    const w=new BiomeWorld({...DEFAULTS,habitat,seed,population:48,visitors:false});
    for(const r of w.sample()) assert.equal(r.scale,1,`${habitat}: ${r.species}`);
  }
});

test('terrace soil stays on the hillside, including narrow portrait compositions',()=>{
  for(const [width,height] of [[480,300],[130,282],[720,450]]) for(const seed of [7,1995,4242]) {
    const ctx={canvas:{width,height},fillStyle:'#000000',globalAlpha:1,fillRect(x,y,w,h){
      if(!['#a6ab7a','#c7bc89'].includes(this.fillStyle)) return;
      // The far upper-right quadrant is open sky, above the olive slope.
      assert.ok(!(x>width*.4&&y<height*.40),'soil texture escaped into the sky');
    }};
    paintBackdrop(ctx,width,height,'med-terraces',seed);
  }
});
