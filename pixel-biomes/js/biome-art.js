import { rng,rect,line,poly,ellipse,ramp,mix,mod } from './pixels.js';
import { groundY,isCoast,isWetland,waterline,waterBounds } from './terrain.js';
import { MED_PALETTES,paintMediterranean } from './mediterranean-art.js';
import { TROPICAL_PALETTES,paintTropical } from './tropical-art.js';
import { paintForest,paintJungle,junglePlant } from './woodland-art.js';
import { willow } from './landscape-details.js';

const P={
 jungle:{sky:['#284c58','#5a8880','#bfd4a0'],far:['#48736d','#315b58','#254b49'],earth:['#203e38','#344d39','#67754a'],leaf:['#163e35','#2c6142','#518651','#9eb96a'],bark:['#283d34','#5d6044','#a09662'],accent:'#e99f8b'},
 forest:{sky:['#718e9b','#b3c4b6','#edddb4'],far:['#91a9a2','#688d85','#476f65'],earth:['#344d43','#576a49','#8c9560'],leaf:['#23493f','#41694a','#799553','#b4bb73'],bark:['#3b4540','#6b6951','#b19b71'],accent:'#d0a575'},
 tundra:{sky:['#536c96','#94b0c0','#d6dcd0'],far:['#9daebe','#778ba9','#586c8d'],earth:['#889daf','#bdcdc9','#e9ecdc'],leaf:['#4a6467','#6c867c','#99a786','#c4cfa7'],bark:['#455b6a','#738890','#c4cbb9'],accent:'#af8472'},
 steppe:{sky:['#688fa9','#a7c5c5','#ecdfb1'],far:['#b9b991','#9ca47d','#7e906a'],earth:['#78815a','#a4a570','#d0c58a'],leaf:['#526951','#7f915f','#b1b873','#e7d69a'],bark:['#4e6657','#88967b','#c2c6a3'],accent:'#b48ba5'},
 river:{sky:['#698b9a','#b6c7b5','#e0dab7'],far:['#98b3a3','#6e9782','#426f62'],earth:['#244f57','#3d7979','#a7b5a0'],leaf:['#244b3e','#3e7651','#7ba06b','#bbbd82'],bark:['#3c4d40','#6e7654','#b5a477'],accent:'#ddb0a1'},
 moon:{sky:['#101d30','#17243c','#1b2942'],far:['#3a475a','#4e5b6c','#657185'],earth:['#666f7f','#939caa','#c4c7c4'],leaf:['#354657','#52677a','#8298a8','#c2c8c7'],bark:['#39495b','#68798b','#bfc7c9'],accent:'#daa675'},
};
export const scenePalette=h=>MED_PALETTES[h]||TROPICAL_PALETTES[h]||P[h]||P.forest;

function ridge(c,W,H,ink,base,amp,seed) {
  const points=[[0,H]];
  for(let x=0;x<=W+4;x+=4) points.push([x,H*base+Math.sin(x/W*9+seed)*H*amp+Math.sin(x/W*23+seed*.1)*H*amp*.35]);
  points.push([W,H]); poly(c,ink,points);
}
function cloud(c,x,y,size,ink) {
  poly(c,ink,[[x-size*.5,y+4],[x-size*.4,y],[x-size*.18,y],[x-size*.09,y-3],[x+size*.11,y-3],[x+size*.2,y],[x+size*.36,y],[x+size*.45,y+3],[x+size*.6,y+4]]);
  line(c,ink,x-size*.7,y+5,x+size*.65,y+5);
}
// Irregular overlapping leaf clusters with a consistent light direction.
function crown(c,x,y,rx,ry,p,seed,detail=true) {
  const r=rng(seed);
  const blob=[[-1,.32],[-.95,-.05],[-.84,-.13],[-.89,-.38],[-.65,-.58],[-.54,-.51],[-.43,-.81],[-.14,-.92],[.02,-.79],[.24,-1],[.50,-.88],[.58,-.65],[.83,-.56],[.78,-.35],[.98,-.17],[1,.12],[.84,.3],[.91,.55],[.64,.7],[.45,.63],[.3,.85],[.05,.83],[-.13,.94],[-.39,.78],[-.68,.83],[-.73,.57],[-.92,.56]];
  const shape=(xx,yy,ww,hh,ink)=>poly(c,ink,blob.map(([u,v])=>[xx+u*ww,yy+v*hh]));
  shape(x,y,rx,ry,p[0]);
  // Overlapping irregular masses; highlights form leaves rather than circles.
  for(const [u,v,s] of [[-.48,-.16,.44],[-.16,-.49,.46],[.34,-.37,.47],[.58,.1,.35],[.16,.22,.48],[-.40,.35,.39]]) {
    const xx=x+rx*u,yy=y+ry*v;
    shape(xx,yy,rx*s,ry*s,p[1]);
    if(v<0) shape(xx-rx*.05,yy-ry*.16,rx*s*.85,ry*s*.65,p[2]);
  }
  if(detail) {
    // Leaf clusters use little hooked/stepped strokes, in patches of light.
    for(let i=0;i<Math.min(340,rx*ry/7);i++) {
      const u=(r()-.5)*1.65,v=(r()-.5)*1.6;
      if(u*u+v*v>.75) continue;
      const xx=x+u*rx,yy=y+v*ry;
      const ink=v<-.10&&(u<.25||r()>.7)?p[2]:v>.40?p[0]:p[1];
      rect(c,ink,xx,yy,3,1);rect(c,ink,xx+2,yy-1,2,1);
      if(v<-.4&&r()<.45) {rect(c,p[3],xx-1,yy-2,2,1);rect(c,p[3],xx-2,yy-1,2,1);}
    }
    for(let i=0;i<8;i++) {
      const xx=x+(r()-.5)*rx*1.2,yy=y+ry*(.22+r()*.36);
      line(c,p[0],xx,yy,xx+rx*.08,yy-2,2);
    }
  }
}
function tree(c,x,y,h,p,seed,style='oak') {
  const trunk=Math.max(3,h*.075);
  if(style==='aleppo') {
    poly(c,p.bark[0],[[x-trunk*.5,y],[x-trunk*.15,y-h*.62],[x+trunk*.25,y-h*.71],[x+trunk*.4,y]]);
    line(c,p.bark[1],x-1,y,x+1,y-h*.67,2);
    line(c,p.bark[0],x,y-h*.45,x-h*.28,y-h*.76,2);
    line(c,p.bark[0],x,y-h*.49,x+h*.26,y-h*.79,2);
    crown(c,x-h*.03,y-h*.81,h*.46,h*.18,p.leaf,seed);
    return;
  }
  if(style==='pine') {
    poly(c,p.bark[0],[[x-trunk*.5,y],[x-trunk*.3,y-h*.85],[x+trunk*.3,y-h*.85],[x+trunk*.6,y]]);
    line(c,p.bark[1],x,y-h*.8,x,y,Math.max(1,Math.round(trunk*.3)));
    for(let i=0;i<6;i++) {
      const yy=y-h*(.94-i*.115), ww=h*(.12+i*.034);
      poly(c,p.leaf[0],[[x,yy-h*.16],[x+ww*.35,yy-h*.03],[x+ww*.27,yy],[x+ww*.64,yy+h*.05],[x+ww*.55,yy+h*.065],[x+ww,yy+h*.13],[x+ww*.55,yy+h*.14],[x+ww*.75,yy+h*.19],[x-ww*.87,yy+h*.18],[x-ww,yy+h*.12],[x-ww*.64,yy+h*.045],[x-ww*.73,yy+h*.03],[x-ww*.28,yy-h*.04]]);
      poly(c,p.leaf[1],[[x-1,yy-h*.13],[x+ww*.50,yy+h*.055],[x+ww*.30,yy+h*.085],[x-ww*.78,yy+h*.11],[x-ww*.5,yy+h*.025]]);
      line(c,p.leaf[2],x-ww*.6,yy+h*.09,x-ww*.1,yy+h*.03);
      const needles=rng(seed+i);
      for(let j=0;j<Math.round(ww*.6);j++) {
        const u=(needles()-.5)*1.4,xx=x+u*ww,v=yy+h*(.05+needles()*.09);
        line(c,p.leaf[j%4===0?2:1],xx,v,xx+(u>0?2:-2),v+2);
      }
    }
    return;
  }
  poly(c,p.bark[0],[[x-trunk,y],[x-trunk*.45,y-h*.75],[x+trunk*.25,y-h*.78],[x+trunk*.65,y-h*.25],[x+trunk*1.4,y]]);
  poly(c,p.bark[1],[[x-trunk*.55,y],[x-trunk*.3,y-h*.7],[x+trunk*.05,y-h*.7],[x+trunk*.3,y]]);
  for(let i=0;i<7;i++) line(c,p.bark[i%2?0:2],x-trunk*.3,y-h*(.1+i*.09),x+trunk*.18,y-h*(.15+i*.09));
  for(const dir of [-1,1]) {
    line(c,p.bark[0],x,y-h*.44,x+dir*h*.21,y-h*.7,Math.max(2,Math.round(trunk*.5)));
    line(c,p.bark[1],x-1,y-h*.44,x+dir*h*.21-1,y-h*.7,Math.max(1,Math.round(trunk*.23)));
  }
  if(style==='olive') {
    for(const [u,v,s] of [[-.2,-.72,.8],[.18,-.77,.9],[0,-.92,1]]) crown(c,x+h*u,y+h*v,h*.24*s,h*.13*s,p.leaf,seed+v*1000);
  } else crown(c,x,y-h*.78,h*.36,h*.25,p.leaf,seed);
}
function rock(c,x,y,w,h,p,seed) {
  poly(c,p[0],[[x-w*.5,y],[x-w*.6,y-h*.42],[x-w*.33,y-h*.9],[x+w*.08,y-h],[x+w*.46,y-h*.65],[x+w*.55,y]]);
  poly(c,p[1],[[x-w*.53,y-h*.42],[x-w*.3,y-h*.85],[x+w*.08,y-h*.92],[x+w*.26,y-h*.55],[x-w*.08,y-h*.18]]);
  line(c,p[2],x-w*.3,y-h*.84,x+w*.05,y-h*.92,2);
  const r=rng(seed); for(let i=0;i<7;i++) rect(c,p[i%3],x+(r()-.5)*w*.7,y-r()*h*.65,2+r()*4,1);
}
function grass(c,x,y,h,p,phase=0,flower) {
  for(let i=-2;i<=2;i++) {
    const sway=Math.sin(phase+i)*1.5;
    line(c,p[i%2===0?1:0],x+i*2,y,x+i*3+sway,y-h*(1-Math.abs(i)*.12));
    rect(c,p[2],x+i*3+sway,y-h*(1-Math.abs(i)*.12),2,1);
    if(flower&&i%2===0) { rect(c,flower,x+i*3+sway-1,y-h*(1-Math.abs(i)*.12)-2,3,2); rect(c,'#efd6a2',x+i*3+sway,y-h*(1-Math.abs(i)*.12)-2); }
  }
}
function fern(c,x,y,h,p,phase=0) {
  for(const d of [-1,1]) for(let k=0;k<3;k++) {
    const reach=h*(.5+k*.18), yy=y-h*(.12+k*.18), tip=x+d*reach+Math.sin(phase)*1;
    line(c,p[0],x,y,tip,yy-h*.2,2);
    line(c,p[1],x,y-1,tip,yy-h*.2-1);
    for(let j=1;j<8;j++) {
      const u=j/8, xx=x+(tip-x)*u, v=y+(yy-h*.2-y)*u, len=h*.13*(1-u*.7);
      line(c,p[1],xx,v,xx-d*len*.4,v-len,2);
      line(c,p[2],xx,v,xx+d*len*.4,v+len*.55,1);
    }
  }
}
function mushrooms(c,x,y,p) {
  for(const [dx,dy,s] of [[0,0,1],[9,2,.7],[-6,3,.55]]) {
    rect(c,'#b8b592',x+dx,y-7*s,2,7*s);
    ellipse(c,'#814f48',x+dx,y-8*s,6*s,3*s);
    ellipse(c,'#c98b62',x+dx-1,y-9*s,4*s,2*s);
    rect(c,'#ead0a0',x+dx-2,y-10*s,2,1);
  }
}
function textureFloor(c,W,H,h,p,seed) {
  const r=rng(seed);
  for(let i=0;i<Math.min(650,W*H/380);i++) {
    const x=r()*W,y=groundY(h,W,H,x,r());
    rect(c,i%3===0?p.earth[2]:p.earth[0],x,y,1+r()*3,1);
    if(i%11===0) rect(c,p.earth[2],x+1,y-1,2,1);
  }
}
function tundra(c,W,H,p,seed) {
  for(let layer=0;layer<3;layer++) {
    const base=.60+layer*.055;
    const points=[[0,H],[0,H*base]];
    for(let i=0;i<8;i++) points.push([W*i/7,H*(base-.17*Math.abs(Math.sin(i*1.8+layer)))]);
    points.push([W,H]);poly(c,p.far[layer],points);
    for(let i=1;i<7;i++) {
      const x=W*i/7,yy=H*(base-.17*Math.abs(Math.sin(i*1.8+layer)));
      poly(c,layer===2?'#dce3da':'#bfcbd1',[[x,yy],[x+W*.044,yy+H*.05],[x+W*.008,yy+H*.036],[x-W*.006,yy+H*.05],[x-W*.035,yy+H*.066]]);
    }
  }
  ridge(c,W,H,p.earth[1],.73,.017,.8);
  ridge(c,W,H,p.earth[2],.83,.025,2.2);
  for(let i=0;i<11;i++) {
    const x=W*(i/10),y=groundY('tundra',W,H,x,.5);
    line(c,'#afc4c6',x-11,y,x+16,y-2);
  }
  for(const [u,v] of [[.05,.9],[.23,.83],[.79,.89],[.94,.97]]) {
    rock(c,W*u,H*v,H*.12,H*.05,p.bark,seed+u*97);
    ellipse(c,p.earth[2],W*u-4,H*v-H*.045,H*.037,2);
    rect(c,'#b1b992',W*u,H*v-3,5,2);rect(c,'#888965',W*u+4,H*v-2,3,1);
  }
  textureFloor(c,W,H,'tundra',p,seed);
}
function steppe(c,W,H,p,seed) {
  ridge(c,W,H,p.far[0],.62,.018,2);
  ridge(c,W,H,p.far[1],.68,.021,4);
  ridge(c,W,H,p.far[2],.73,.012,.8);
  textureFloor(c,W,H,'steppe',p,seed);
  const r=rng(seed+19);
  for(let i=0;i<Math.ceil(W/7);i++) {const x=r()*W;grass(c,x,groundY('steppe',W,H,x,r()*.85),3+r()*5,p.leaf,0,i%9===0?p.accent:null);}
  // A single wind-bent tree keeps the large sky and grassland legible.
  const x=W*.84,y=H*.735,ht=H*.16;
  line(c,p.bark[0],x,y,x-ht*.15,y-ht*.78,3);
  crown(c,x-ht*.2,y-ht,ht*.42,ht*.21,p.leaf,seed+28);
  rock(c,W*.11,H*.89,H*.07,H*.045,p.bark,seed);
}
function river(c,W,H,p,seed) {
  ridge(c,W,H,p.far[0],.45,.012,1);
  for(let i=0;i<12;i++) tree(c,W*i/11,H*.54,H*(.2+.12*Math.sin(i*2)**2),{...p,leaf:[p.far[2],p.far[1],p.far[1],p.far[0]]},seed+i,'oak');
  const surf=waterline('river',H);
  ramp(c,W,H,['#8db9b0','#447e80','#244c5b'],surf,H);
  // Rock shelves remain above the swimmers. Underwater riverbed stays open.
  poly(c,'#456450',[[0,H*.51],[W*.27,H*.53],[W*.32,surf],[W*.22,surf+6],[0,surf+10]]);
  poly(c,'#638363',[[W*.68,surf],[W*.75,H*.51],[W,H*.49],[W,surf+13],[W*.83,surf+7]]);
  line(c,'#bbd0ad',0,surf+9,W*.22,surf+6,2);
  line(c,'#a3c1a8',W*.83,surf+7,W,surf+12,2);
  willow(c,W*.07,H*.56,Math.min(H*.43,W*.42),seed+3);
  willow(c,W*.94,H*.56,Math.min(H*.38,W*.37),seed+13);
  ridge(c,W,H,'#586f62',.925,.012,2);
  textureFloor(c,W,H,'river',{...p,earth:['#425e58','#667b69','#a3ae8c']},seed);
  for(const u of [.12,.3,.79,.92]) rock(c,W*u,H*.98,H*.07,H*.04,p.bark,seed+u*100);
  for(let i=0;i<35;i++) {const r=rng(seed+i),x=r()*W,y=H*(.6+r()*.21);line(c,'#74a7a0',x,y,x+3+r()*7,y+1);}
}
function crater(c,x,y,rx,ry,p) {
  ellipse(c,p.earth[0],x,y,rx,ry);
  ellipse(c,p.earth[2],x-1,y-2,rx*.92,ry*.93);
  ellipse(c,p.earth[0],x+1,y,rx*.79,ry*.73);
  ellipse(c,p.earth[1],x+rx*.14,y+ry*.22,rx*.56,ry*.48);
  line(c,p.earth[2],x-rx*.5,y+ry*.65,x+rx*.5,y+ry*.65);
}
function moon(c,W,H,p,seed) {
  const r=rng(seed);
  for(let i=0;i<Math.ceil(W/5);i++) rect(c,i%7?'#9cacc0':'#eee9d0',r()*W,r()*H*.64,1,1);
  const x=W*.70,y=H*.19,rr=Math.min(W*.073,H*.085);
  ellipse(c,'#82b6c5',x,y,rr,rr);
  ellipse(c,'#477eab',x+2,y+1,rr*.9,rr*.94);
  poly(c,'#9eb4a3',[[x-rr*.8,y-rr*.3],[x-rr*.35,y-rr*.6],[x+rr*.1,y-rr*.5],[x+rr*.23,y-rr*.15],[x-rr*.08,y+rr*.25],[x-rr*.27,y+rr*.77],[x-rr*.42,y+rr*.35]]);
  poly(c,'#c3cbb1',[[x+rr*.5,y+rr*.1],[x+rr*.8,y+rr*.33],[x+rr*.45,y+rr*.5],[x+rr*.2,y+rr*.35]]);
  for(let i=0;i<5;i++) {
    const yy=y-rr*.6+i*rr*.22;
    line(c,'#e1e5d6',x-rr*.6,yy,x-rr*.12,yy-1);
    line(c,'#c5d7d4',x+rr*.03,yy+2,x+rr*.5,yy+1);
  }
  ridge(c,W,H,p.far[0],.65,.025,2);
  ridge(c,W,H,p.far[1],.70,.021,4);
  ridge(c,W,H,p.earth[1],.74,.014,.8);
  for(const [u,v,s] of [[.12,.78,.08],[.75,.80,.10],[.48,.72,.03],[.29,.92,.08],[.85,.97,.12],[.02,.98,.15]]) crater(c,W*u,H*v,H*s,H*s*.26,p);
  textureFloor(c,W,H,'moon',p,seed);
  // Survey station: gold foil lander, pixel solar cells, tracks and dishes.
  const xx=W*.12,yy=H*.85;
  poly(c,'#4a5b6c',[[xx-13,yy-14],[xx+13,yy-14],[xx+18,yy-3],[xx-18,yy-3]]);
  rect(c,'#ba9664',xx-10,yy-21,20,17);rect(c,'#e2bf7e',xx-10,yy-21,13,12);
  rect(c,'#334d69',xx-6,yy-18,10,6);rect(c,'#8badbf',xx-5,yy-18,6,2);
  for(const d of [-1,1]) {line(c,'#45556a',xx+d*9,yy-8,xx+d*22,yy,2);rect(c,'#bdc5c6',xx+d*22-4,yy,8,2);}
  line(c,'#bdc5c6',xx,yy-21,xx,yy-34,1);ellipse(c,'#adbcc2',xx+2,yy-34,6,2);
  rect(c,'#30475f',xx+29,yy-13,28,10);
  for(let i=0;i<4;i++) {line(c,'#7190a7',xx+30+i*7,yy-12,xx+30+i*7,yy-4);line(c,'#547992',xx+30,yy-11+i*2,xx+55,yy-11+i*2);}
  line(c,'#536478',xx+43,yy-3,xx+43,yy+3,2);
  for(let i=0;i<12;i++) {rect(c,'#788494',W*.29+i*5,H*.88+i%3,3,1);rect(c,'#788494',W*.29+i*5,H*.9+i%3,3,1);}
}

export function paintBiomeBackdrop(c,W,H,h,seed) {
  const p=scenePalette(h);
  c.globalAlpha=1;
  if(isCoast(h)) {
    if(h.startsWith('trop-')) paintTropical(c,W,H,h,seed);
    else paintMediterranean(c,W,H,h,seed);
    return;
  }
  if(h==='jungle') {paintJungle(c,W,H,p,seed);return;}
  if(h==='forest') {paintForest(c,W,H,p,seed);return;}
  ramp(c,W,H,p.sky);
  if(h!=='moon') {
    for(let i=0;i<4;i++) cloud(c,W*(.13+i*.26),H*(.10+i%2*.11),Math.min(W*.16,65),mix(p.sky[2],p.sky[1],.3));
    ellipse(c,h==='med-harbour'?'#f0cca0':'#f1e3b8',W*.69,H*.21,Math.min(W*.023,H*.04),Math.min(W*.023,H*.04));
  }
  if(h==='tundra') tundra(c,W,H,p,seed);
  else if(h==='steppe') steppe(c,W,H,p,seed);
  else if(h==='river') river(c,W,H,p,seed);
  else if(h==='moon') moon(c,W,H,p,seed);

}
export function createBiomeVegetation(W,H,h,seed) {
  const r=rng(seed^0x59ae201),p=scenePalette(h),out=[];
  if(h==='moon') return out;
  const add=(kind,x,y,height)=>out.push({biome:h,kind,x,y,height,pal:p.leaf,accent:p.accent,phase:r()*6,seed,palette:p});
  if(isWetland(h)) {
    const [lo,hi]=waterBounds(h,W);
    for(let i=0;i<Math.ceil(W/22);i++) {const x=lo+r()*(hi-lo);add('weed',x,H*(.965+r()*.035),H*(.03+r()*.04));}
    if(h==='river') for(const u of [.015,.10,.86,.96]) add('reed',W*u,H*.59,H*(.08+r()*.06));
    return out;
  }
  for(let i=0;i<Math.ceil(W/(h==='steppe'?13:28));i++) {
    const x=r()*W;
    if(x>W*.3&&x<W*.7&&r()<.8) continue;
    add(h==='jungle'?'tropical':h==='forest'?'fern':'grass',x,groundY(h,W,H,x,.9+r()*.08),H*(.023+r()*.03));
  }
  if(h==='jungle') for(const u of [.0,.055,.92,1]) add('tropical',W*u,H*.995,H*.12);
  if(h==='forest') for(const u of [.03,.92]) add('fern',W*u,H*.99,H*.08);
  return out.sort((a,b)=>a.y-b.y);
}
export function paintBiomeVegetation(c,plants,t) {
  for(const p of plants) {
    const phase=t*.4+p.phase;
    if(p.kind==='tropical') junglePlant(c,p.x,p.y,p.height,phase);
    else if(p.kind==='fern') fern(c,p.x,p.y,p.height,p.pal,phase);
    else if(p.kind==='reed') {
      grass(c,p.x,p.y,p.height,p.pal,phase);
      for(let i=0;i<3;i++) {const xx=p.x+i*4+Math.sin(phase);line(c,p.pal[1],xx,p.y,xx,p.y-p.height);rect(c,'#826647',xx-1,p.y-p.height,3,6);}
    } else grass(c,p.x,p.y,p.height,p.pal,phase,p.kind==='grass'&&p.seed%3===0?p.accent:null);
  }
}
export function paintBiomeAtmosphere(c,W,H,h,t,seed,s) {
  const p=scenePalette(h),r=rng(seed^0x972821);
  if(h==='moon') return; // vacuum: no gusts, pollen, weather or rays
  if(h==='jungle') {
    // Moving water ribbons and foam, contained in each cascade tier.
    for(const [u,v,width,height] of [[.54,.32,.065,.245],[.512,.56,.095,.123],[.48,.68,.12,.075]]) for(let i=0;i<8;i++) {
      const yy=H*(v+mod(i/8*height+t*.085,height)),xx=W*(u+width*(.16+(i%4)*.12));
      rect(c,i%3?'#aedac0':'#d2e9c9',xx,yy,1,2);
    }
  }
  if(isWetland(h)) {
    if(s.bubbles) {
      const y=waterline(h,H);
      const [lo,hi]=waterBounds(h,W);
      for(let i=0;i<22;i++) {
        const x=lo+mod(r()*(hi-lo)+t*(.7+r()),hi-lo), yy=y+Math.floor(r()*8);
        if(h==='med-harbour'&&x<W*.75) continue;
        if(h==='med-terraces'&&x<W*.70) continue;
        if(h==='river'&&(x<W*.31||x>W*.72)) continue;
        rect(c,i%3===0?'#d7dfbb':'#aad0c3',x,yy,3+r()*9,1);
      }
    }
  } else if(s.bubbles) {
    c.globalAlpha=.16;
    for(let i=0;i<6;i++) rect(c,p.leaf[3],mod(r()*W+t*10,W),H*(.5+r()*.3),6,1);
  }
  if(s.sunRays&&(h==='forest'||h==='jungle')) {
    c.globalAlpha=h==='forest'?.07:.035;
    for(const u of (h==='forest'?[.37,.55]:[.51])) poly(c,p.sky[2],[[W*u,0],[W*(u+.02),0],[W*(u+.29),H*.84],[W*(u+.17),H*.85]]);
  }
  if(s.sunRays&&h!=='forest'&&h!=='jungle'&&h!=='med-harbour') {
    c.globalAlpha=.045;
    poly(c,p.sky[2],[[W*.64,H*.14],[W*.75,H*.14],[W*.92,H*.50],[W*.83,H*.51]]);
    if(isWetland(h)) {
      const [lo,hi]=waterBounds(h,W);
      c.globalAlpha=.25;
      for(let i=0;i<9;i++) {
        const xx=lo+(hi-lo)*(.16+r()*.72),yy=waterline(h,H)+H*(.075+r()*.25);
        rect(c,'#dce5c3',xx+Math.sin(t*.3+i)*2,yy,2,1);
      }
    }
  }
  if(s.plankton) for(let i=0;i<Math.min(90,Math.ceil(W/10));i++) {
    const x=mod(r()*W+t*(h==='tundra'?2:1.2),W),y=mod(r()*H+t*(h==='tundra'?3:.4),H);
    c.globalAlpha=h==='tundra'?.58:.34;
    rect(c,h==='tundra'?'#e9eede':p.leaf[3],x,y,1,1);
  }
  if(s.sunRays&&h==='med-harbour') {
    c.globalAlpha=.18;
    for(let i=0;i<12;i++) rect(c,'#f4d49b',W*.83+Math.sin(i*2+t*.2)*i*1.3,waterline(h,H)+i*3,2+i*.8,1);
  }
  c.globalAlpha=1;
}
