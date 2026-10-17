import {rng,rect,line,poly,ellipse,ramp,mix} from './pixels.js';
import {waterline} from './terrain.js';
import {palm,foliage,inside,stoneFace} from './landscape-details.js';

export const TROPICAL_PALETTES={
 'trop-beach':{sky:['#4a9fc0','#a1dcd9','#e5f0d8'],far:['#a5c9b1','#5e9b7e','#3b7963'],earth:['#176379','#29aaa9','#b3ece0'],leaf:['#164e42','#357b4b','#71a464','#b6cc80'],bark:['#647453','#a6a780','#f2e6bc'],accent:'#edac78'},
 'trop-atoll':{sky:['#5fadc4','#b5e1dc','#f1f1d7'],far:['#9ccebd','#75b4ab','#559791'],earth:['#1c6f94','#47c2bb','#b9eee0'],leaf:['#2a6650','#559267','#9fb96f','#ced99a'],bark:['#727d65','#b2ba99','#fff0cd'],accent:'#eab188'},
};
const uv=(W,H,pts)=>pts.map(([u,v])=>[u*W,v*H]);
const shape=(c,W,H,ink,pts)=>poly(c,ink,uv(W,H,pts));
function clouds(c,W,H) {
  for(const [u,v,s] of [[.68,.11,.18],[.24,.16,.12],[.91,.23,.11]]) {
    const x=W*u,y=H*v,w=Math.min(W*s,80);
    poly(c,'#e1f0dc',[[x-w*.6,y],[x-w*.4,y-3],[x-w*.25,y-3],[x-w*.16,y-6],[x+w*.14,y-6],[x+w*.23,y-3],[x+w*.5,y-2],[x+w*.65,y+1],[x-w*.7,y+1]]);
    line(c,'#c3dfd6',x-w*.58,y+2,x+w*.59,y+2);
  }
}
function water(c,W,H,h,p,seed) {
  const surf=waterline(h,H),r=rng(seed);
  ramp(c,W,H,[p.earth[2],p.earth[1],p.earth[0]],surf,H);
  if(h==='trop-atoll') {
    shape(c,W,H,'#70d8c6',[[0,.52],[.24,.48],[.4,.54],[.65,.51],[.85,.53],[1,.49],[1,.76],[.81,.8],[.65,.75],[.37,.84],[.16,.77],[0,.78]]);
    shape(c,W,H,'#8ae2ce',[[.13,.60],[.25,.57],[.49,.60],[.67,.64],[.85,.61],[1,.62],[1,.70],[.77,.72],[.57,.69],[.33,.77],[.15,.7]]);
    shape(c,W,H,'#b0e9d5',[[.53,.59],[.67,.54],[.86,.53],[1,.54],[1,.64],[.81,.66],[.64,.625]]);
  }
  for(let i=0;i<Math.ceil(W/3);i++) {
    const x=r()*W,y=surf+r()*(H-surf)*.92,xx=x+2+r()*9;
    line(c,i%3?'#65c8c2':'#b3eadd',x,y,xx,y);
  }
  shape(c,W,H,mix(p.earth[1],p.bark[1],.4),[[0,.967],[.15,.943],[.31,.973],[.46,.95],[.60,.975],[.81,.95],[1,.96],[1,1],[0,1]]);
}
function beach(c,W,H,p,seed) {
  // A volcanic Caribbean ridge, emerald jungle, and a close palm-framed beach.
  shape(c,W,H,'#9fc7b0',[[0,.35],[.13,.26],[.25,.32],[.36,.44],[.51,.51],[.65,.55],[0,.60]]);
  shape(c,W,H,'#5b977b',[[0,.44],[.08,.37],[.13,.385],[.24,.45],[.34,.51],[.46,.555],[0,.62]]);
  for(let i=0;i<13;i++) foliage(c,W*i*.032,H*(.495+Math.sin(i*.22)*.042),Math.min(23,W*.045),H*.023,p.leaf,seed+i*53);
  water(c,W,H,'trop-beach',p,seed);
  shape(c,W,H,'#519a75',[[0,.52],[.13,.54],[.26,.60],[.32,.65],[.37,.74],[.36,1],[0,1]]);
  const sand=uv(W,H,[[0,.59],[.17,.59],[.29,.635],[.38,.74],[.40,.85],[.36,1],[0,1]]);
  poly(c,'#dccfa4',sand);
  shape(c,W,H,'#f5e9c2',[[0,.608],[.15,.613],[.26,.655],[.355,.76],[.364,.86],[.327,1],[0,1]]);
  const r=rng(seed+91);for(let i=0;i<160;i++) {
    const x=r()*W*.36,y=H*(.64+r()*.36);
    if(inside(x,y,sand)) rect(c,i%5?'#dddbb1':'#fff3cd',x,y,1+r()*3,1);
  }
  for(let i=0;i<25;i++) {
    const u=i/24,xx=W*(.289+.11*Math.sin(u*2)),yy=H*(.654+u*.35);
    rect(c,'#e1f2d6',xx,yy,4+i%3,1);rect(c,'#78d1be',xx+5,yy+2,5,1);
  }
  // Separate coconut palms curve towards the water. Shadows lie on the sand.
  shape(c,W,H,'#c5c49b',[[.055,.91],[.32,.93],[.29,.94],[.04,.93]]);
  palm(c,W*.07,H*.93,Math.min(H*.52,W*.95),.20,seed+1);
  palm(c,W*.21,H*.70,Math.min(H*.33,W*.37),-.12,seed+9);
  palm(c,W*.025,H*.65,Math.min(H*.26,W*.27),.18,seed+19);
  foliage(c,W*.035,H*.976,Math.min(21,W*.065),H*.024,p.leaf,seed+102);
  // A pulled-up wooden skiff, shell clusters and a few coral heads below.
  shape(c,W,H,'#977c5a',[[.16,.84],[.25,.86],[.29,.875],[.26,.885],[.17,.86]]);
  line(c,'#e4c498',W*.165,H*.84,W*.278,H*.874,2);line(c,'#736c54',W*.18,H*.848,W*.255,H*.875);
  line(c,'#8e7c59',W*.18,H*.832,W*.28,H*.89);
  for(const u of [.12,.31]) {ellipse(c,'#edc5a4',W*u,H*(.95-u*.12),2,1);rect(c,'#fff0d1',W*u-1,H*(.95-u*.12)-1,2,1);}
  for(const [u,v] of [[.59,.97],[.86,.975]]) {
    stoneFace(c,uv(W,H,[[u-.025,v],[u-.027,v-.025],[u+.003,v-.037],[u+.035,v-.025],[u+.04,v]]),['#338b89','#236e78','#7ac0a7'],seed+u*167);
    for(let i=0;i<5;i++) {line(c,'#ac857e',W*(u+i*.006),H*(v-.02),W*(u+i*.008),H*(v-.045));rect(c,'#e6b198',W*(u+i*.008),H*(v-.048),2,1);}
  }
}
function bungalow(c,x,y,w,seed) {
  const h=w*.55;
  for(const dx of [.08,.72]) line(c,'#776f56',x+w*dx,y-1,x+w*dx,y+h*.31,2);
  rect(c,'#a99e77',x,y-h*.44,w,h*.45);rect(c,'#cfb68b',x+2,y-h*.43,w*.70,h*.40);
  poly(c,'#8b815f',[[x-w*.13,y-h*.43],[x+w*.50,y-h*1.05],[x+w*1.14,y-h*.42],[x+w*1.06,y-h*.33],[x-w*.08,y-h*.33]]);
  poly(c,'#c4b383',[[x-w*.13,y-h*.43],[x+w*.5,y-h*1.05],[x+w*.59,y-h*.96],[x+w*.78,y-h*.4]]);
  const r=rng(seed);for(let i=0;i<20;i++) {
    const xx=x+w*(-.04+r()*1.1),yy=y-h*(.43+r()*.2);
    if(!inside(xx,yy,[[x-w*.13,y-h*.43],[x+w*.50,y-h*1.05],[x+w*1.14,y-h*.42]])) continue;
    line(c,i%3?'#aa9b72':'#d0bc8a',xx,yy,xx-2,yy+3);
  }
  rect(c,'#416b68',x+w*.25,y-h*.34,w*.22,h*.31);rect(c,'#748e7b',x+w*.53,y-h*.30,w*.15,h*.13);
  line(c,'#e5cc9c',x-2,y,x+w+2,y,2);line(c,'#a6d3bf',x+2,y+h*.34,x+w*.8,y+h*.34);
}
function atoll(c,W,H,p,seed) {
  water(c,W,H,'trop-atoll',p,seed);
  // Horizon is high and level. The shallow turquoise lagoon fills the scene.
  line(c,'#c6e9d8',0,H*.332,W,H*.332);
  for(const [u,v,w] of [[.08,.345,.22],[.59,.338,.15],[.93,.35,.12]]) {
    shape(c,W,H,'#e8e8c3',[[u-w*.5,v],[u-w*.3,v-.01],[u+w*.3,v-.008],[u+w*.5,v],[u+w*.32,v+.005]]);
    foliage(c,W*u,H*(v-.008),W*w*.25,H*.005,p.leaf,seed+u*179);
  }
  const island=uv(W,H,[[.62,.54],[.70,.505],[.86,.499],[1,.525],[1,.603],[.87,.625],[.71,.61],[.59,.575]]);
  poly(c,'#f4ebc8',island);
  shape(c,W,H,'#c2cfa1',[[.65,.545],[.75,.514],[.89,.512],[1,.545],[1,.58],[.86,.581],[.73,.576]]);
  for(let i=0;i<8;i++) foliage(c,W*(.68+i*.05),H*(.54+Math.sin(i)*.007),Math.min(20,W*.035),H*.014,p.leaf,seed+i*17);
  for(const [u,v,h,l] of [[.73,.55,.17,.15],[.84,.546,.20,-.18],[.96,.566,.15,-.14]]) palm(c,W*u,H*v,Math.min(H*h,W*.21),l,seed+u*589);
  // A thin timber jetty follows a diagonal out across the lagoon.
  const a=[W*.66,H*.571],b=[W*.24,H*.654];
  line(c,'#8b9878',...a,...b,4);line(c,'#dac699',a[0],a[1]-1,b[0],b[1]-1,2);
  for(let i=0;i<12;i++) {
    const u=i/12,x=a[0]+(b[0]-a[0])*u,y=a[1]+(b[1]-a[1])*u;
    line(c,'#847f60',x,y-2,x+1,y+2);
    if(i%3===0) {line(c,'#777c65',x,y+2,x,y+9);rect(c,'#8ed2c2',x-2,y+10,5,1);}
  }
  for(const [u,v,w] of [[.28,.649,.078],[.40,.625,.071],[.52,.600,.065]]) bungalow(c,W*u,H*v,Math.max(9,W*w),seed+u*789);
  for(let i=0;i<28;i++) {
    const u=i/27;rect(c,'#fff5d8',W*(.59+u*.4),H*(.575+Math.sin(u*3)*.053),3+i%3,1);
  }
  // Shallow reef patches are organic islands of colour, with bright sand gaps.
  for(const [u,v,s] of [[.16,.85,.07],[.47,.92,.08],[.80,.82,.065],[.94,.93,.065]]) {
    const pal=['#459f9b','#68b7a6','#8cd0b6','#b0e3c6'];
    foliage(c,W*u,H*v,W*s,H*s*.35,pal,seed+u*989);
    for(let i=0;i<6;i++) rect(c,i%2?'#bcbea0':'#d8bfa4',W*(u-s*.4+i*s*.16),H*v+Math.sin(i)*3,2,2);
  }
}
export function paintTropical(c,W,H,h,seed) {
  const p=TROPICAL_PALETTES[h];ramp(c,W,H,p.sky);clouds(c,W,H);
  if(h==='trop-beach') beach(c,W,H,p,seed);else atoll(c,W,H,p,seed);
}
