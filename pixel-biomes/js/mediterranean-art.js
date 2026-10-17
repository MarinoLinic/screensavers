import {rng,rect,line,poly,ellipse,ramp,mix} from './pixels.js';
import {waterline,waterBounds} from './terrain.js';
import {inside,stoneFace,foliage,pine,olive} from './landscape-details.js';

export const MED_PALETTES={
 'med-cove':{sky:['#639ba9','#acd7d2','#e8eee0'],far:['#98bbb7','#7da8a6','#568994'],earth:['#174858','#2c929b','#98ded1'],leaf:['#204b41','#497550','#81985f','#b9bd86'],bark:['#697f79','#b6b9a0','#f0e7cb'],accent:'#cd9a88'},
 'med-islands':{sky:['#6f9fae','#c0ddd5','#f5edcf'],far:['#a6c1b3','#729d90','#527c73'],earth:['#256678','#53acb1','#b4e2d1'],leaf:['#274b40','#4c6e47','#889a66','#c2c28c'],bark:['#798b7b','#babba1','#e5dcc4'],accent:'#b385a1'},
 'med-harbour':{sky:['#303e66','#846e8c','#e5b39e'],far:['#9a8094','#706a87','#485777'],earth:['#263c61','#526c89','#b099a0'],leaf:['#304647','#506358','#899374','#bdb18e'],bark:['#766772','#b79891','#eed9b6'],accent:'#d99478'},
 'med-terraces':{sky:['#5d91a7','#afcacf','#ebd5ac'],far:['#b0b1a7','#839b9b','#5b818e'],earth:['#284f6c','#458aa4','#9ac5c4'],leaf:['#3e5b4e','#6c8060','#9da681','#d0c4a0'],bark:['#766f53','#b09e76','#e5cda1'],accent:'#c995ae'},
};
const uv=(W,H,pts)=>pts.map(([u,v])=>[u*W,v*H]);
const shape=(c,W,H,ink,pts)=>poly(c,ink,uv(W,H,pts));

function cloud(c,x,y,w,ink) {
  poly(c,ink,[[x-w*.6,y],[x-w*.43,y-2],[x-w*.3,y-2],[x-w*.22,y-5],[x+w*.05,y-5],[x+w*.18,y-2],[x+w*.40,y-2],[x+w*.55,y],[x+w*.72,y+1],[x-w*.7,y+1]]);
}
function mountain(c,W,H,ink,base,peak,phase) {
  const pts=[[0,H],[0,H*base]];
  for(let i=0;i<=18;i++) pts.push([i/18*W,H*(base-peak*Math.abs(Math.sin(i*.81+phase)))]);
  pts.push([W,H]);poly(c,ink,pts);
}
function sea(c,W,H,h,p,seed) {
  const surf=waterline(h,H),r=rng(seed^0x517b);
  ramp(c,W,H,[p.earth[2],p.earth[1],p.earth[0]],surf,H);
  const [lo,hi]=waterBounds(h,W);
  for(let i=0;i<Math.ceil(W/4);i++) {
    const x=lo+r()*(hi-lo),y=surf+r()*(H-surf)*.78;
    const k=(y-surf)/(H-surf);
    const ink=mix(p.earth[1],p.earth[2],.36+(1-k)*.25);
    line(c,ink,x,y,x+2+r()*(5+12*k),y);
    if(i%4===0) line(c,mix(ink,p.earth[2],.45),x+3,y+2,x+6,y+2);
  }
  // Pale sand channels between darker Posidonia beds, visible through water.
  shape(c,W,H,mix(p.earth[1],p.bark[1],.30),[[0,.95],[.16,.93],[.27,.96],[.4,.93],[.53,.97],[.74,.945],[.87,.965],[1,.94],[1,1],[0,1]]);
  for(let i=0;i<Math.ceil(W/8);i++) {
    const x=lo+r()*(hi-lo),y=H*(.965+r()*.033);
    rect(c,i%3===0?mix(p.bark[2],p.earth[2],.6):p.earth[0],x,y,1+r()*3,1);
  }
}
function sail(c,x,y,s,night=false) {
  poly(c,night?'#384a63':'#526c71',[[x-10*s,y],[x+12*s,y],[x+8*s,y+3*s],[x-7*s,y+3*s]]);
  line(c,'#e6d0ac',x-9*s,y,x+10*s,y);
  line(c,'#8d8e7d',x,y,x,y-22*s);
  poly(c,night?'#c6babb':'#fbf0d1',[[x-s,y-21*s],[x-s,y-3*s],[x-10*s,y-3*s]]);
  poly(c,night?'#9e9fac':'#c3d4c9',[[x+2*s,y-17*s],[x+10*s,y-3*s],[x+2*s,y-3*s]]);
  line(c,'#8aaeb1',x-6*s,y+5*s,x+7*s,y+5*s);
}
const surfHeight=H=>waterline('med-cove',H);
function cove(c,W,H,p,seed) {
  // A sheltered blue inlet. The cave is carved within one connected rock face.
  mountain(c,W,H,p.far[0],.56,.06,1.9);mountain(c,W,H,p.far[1],.58,.055,3);
  sea(c,W,H,'med-cove',p,seed);
  const light=['#d9d4b6','#b8b9a0','#efe7ce'],shade=['#84978e','#758c85','#a7afa0'];
  const left=uv(W,H,[[0,.17],[.08,.18],[.15,.21],[.15,.25],[.21,.26],[.24,.32],[.22,.39],[.28,.43],[.27,.5],[.30,.55],[.29,.69],[.21,.76],[0,.75]]);
  stoneFace(c,left,shade,seed+1);
  stoneFace(c,uv(W,H,[[0,.17],[.08,.18],[.14,.21],[.14,.25],[.20,.27],[.22,.34],[.19,.42],[.23,.46],[.19,.52],[.22,.63],[.16,.69],[0,.67]]),light,seed+2);
  shape(c,W,H,'#f0e9cf',[[0,.17],[.08,.18],[.14,.21],[.14,.23],[.07,.20],[0,.20]]);
  // Broad stone strata and fissures follow the cliff's stepped planes.
  for(let i=0;i<9;i++) {
    const y=H*(.24+i*.043),x=W*(i%3*.018);
    line(c,'#9aab99',x,y,W*(.11+(i%3)*.026),y+1);
    line(c,'#f1e8c9',x,y-1,W*(.075+(i%3)*.024),y-1);
  }
  for(const [u,v] of [[.05,.30],[.115,.41],[.07,.53],[.16,.3]]) {
    line(c,'#929e8b',W*u,H*v,W*(u+.015),H*(v+.06));
    line(c,'#aeb29a',W*(u+.015),H*(v+.06),W*(u+.01),H*(v+.11));
  }
  // The cave keeps its natural arch proportions even on a narrow viewport.
  const caveX=W*.071,caveW=W*.15,caveH=Math.min(H*.20,caveW*.95),caveBase=surfHeight(H)+caveH*.30;
  const mouth=(ink,pts)=>poly(c,ink,pts.map(([u,v])=>[caveX+caveW*u,caveBase-caveH+caveH*v]));
  mouth('#83968b',[[0,1],[0,.44],[.09,.2],[.24,.04],[.48,0],[.71,.10],[.91,.31],[1,.54],[.94,.98]]);
  mouth('#203e49',[[.08,1],[.07,.49],[.17,.28],[.30,.15],[.43,.19],[.51,.13],[.63,.18],[.69,.23],[.85,.41],[.89,.61],[.85,1]]);
  mouth('#405e5e',[[.08,.94],[.07,.49],[.17,.28],[.30,.15],[.31,.33],[.22,.46],[.20,.95]]);
  mouth('#2d545c',[[.73,.30],[.85,.41],[.89,.61],[.85,1],[.73,.96],[.75,.57]]);
  mouth('#357c7f',[[.20,.70],[.77,.70],[.85,.94],[.85,1],[.09,1],[.1,.83]]);
  mouth('#569e98',[[.14,.86],[.8,.86],[.85,1],[.09,1]]);
  for(let i=0;i<4&&i*2<caveH*.27;i++) line(c,i%2?'#5eaaa0':'#a5d6c2',caveX+caveW*(.15+i%2*.13),surfHeight(H)+i*2,caveX+caveW*(.66+i%2*.11),surfHeight(H)+i*2);
  mouth('#445d59',[[.32,.17],[.37,.25],[.38,.17],[.44,.18],[.46,.30],[.48,.17]]);
  line(c,'#566e65',caveX,caveBase-caveH*.54,caveX+caveW*.09,caveBase-caveH*.78,2);
  // Dark underwater continuation gives the face weight instead of a floating stump.
  stoneFace(c,uv(W,H,[[0,.70],[.21,.71],[.285,.67],[.28,.76],[.22,.84],[.10,.88],[0,.87]]),['#30656c','#326c70','#477f7e'],seed+114,.55);
  stoneFace(c,uv(W,H,[[.88,.34],[.92,.29],[1,.25],[1,.85],[.93,.80],[.90,.69],[.89,.58],[.86,.49]]),shade,seed+11);
  stoneFace(c,uv(W,H,[[.93,.33],[1,.27],[1,.67],[.96,.66],[.94,.55],[.91,.46]]),light,seed+12);
  stoneFace(c,uv(W,H,[[.89,.62],[.96,.66],[1,.67],[1,.85],[.93,.80],[.90,.69]]),['#4c8283','#578e88','#6a9f93'],seed+122,.65);
  foliage(c,W*.055,H*.172,W*.085,H*.03,p.leaf,seed+17);
  pine(c,W*.045,H*.18,Math.min(H*.16,W*.17),seed+8,p.leaf);
  foliage(c,W*.98,H*.295,W*.07,H*.045,p.leaf,seed+18);
  sail(c,W*.66,H*.582,Math.min(1,W/430));
  for(const [u,v] of [[.305,.71],[.86,.76]]) {
    line(c,'#afdbcf',W*u,H*v,W*(u+.07),H*v);
    line(c,'#68aaa4',W*(u+.02),H*(v+.009),W*(u+.06),H*(v+.009));
  }
}
function beach(c,W,H,p,seed) {
  mountain(c,W,H,p.far[0],.47,.09,1);mountain(c,W,H,p.far[1],.53,.055,2.4);
  sea(c,W,H,'med-islands',p,seed);
  // Rocky pine shore and a long crescent of sunlit Adriatic pebbles.
  shape(c,W,H,'#658a71',[[0,.35],[.15,.38],[.24,.41],[.33,.49],[.42,.55],[.46,.62],[.40,.73],[0,.82]]);
  shape(c,W,H,'#9ca58c',[[0,.50],[.20,.51],[.32,.55],[.47,.62],[.50,.70],[.45,.79],[.42,1],[0,1]]);
  const shore=uv(W,H,[[0,.575],[.23,.58],[.34,.61],[.47,.65],[.495,.72],[.47,.80],[.42,1],[0,1]]);
  poly(c,'#ddd9c1',shore);
  shape(c,W,H,'#ede5cb',[[0,.585],[.21,.592],[.32,.629],[.447,.666],[.461,.739],[.42,.81],[.38,1],[0,1]]);
  const r=rng(seed+21);
  for(let i=0;i<Math.min(750,W*H/140);i++) {
    const x=r()*W*.50,y=H*(.60+r()*.40);
    if(!inside(x,y,shore)||!inside(x+3,y,shore)) continue;
    const size=1+(y/H-.6)*4*r();
    rect(c,['#b7bba5','#f7edcf','#98a89c','#c5bcaa'][i%4],x,y,size+1,1);
    if(i%7===0) rect(c,'#f7ecd0',x,y-1,size,1);
  }
  for(let i=0;i<29;i++) {
    const u=i/28,yy=H*(.646+u*.354),xx=W*(.492-.073*u+Math.sin(u*6)*.008);
    rect(c,i%3?'#def2da':'#fff0d2',xx,yy,3+(i%4),1);
    rect(c,'#6bbdb4',xx+4,yy+2,5,1);
  }
  // Framing trees grow from the backshore, leaving the beach and sea open.
  for(const [u,v,s] of [[.03,.58,.30],[.17,.55,.28],[.30,.56,.21]]) pine(c,W*u,H*v,Math.min(H*s,W*(s+.1)),seed+u*811,p.leaf);
  for(const [u,v] of [[.09,.60],[.26,.58],[.34,.63]]) foliage(c,W*u,H*v,Math.min(W*.08,31),H*.025,p.leaf,seed+u*1400);
  // A weathered shoreline stone, a driftwood branch and low violet flowers.
  stoneFace(c,uv(W,H,[[.09,.85],[.1,.81],[.14,.79],[.18,.82],[.185,.865],[.12,.87]]),['#a1aca0','#84988b','#dddac1'],seed+7);
  line(c,'#968e71',W*.22,H*.90,W*.34,H*.876,3);line(c,'#c2b99a',W*.22,H*.895,W*.34,H*.873);
  line(c,'#968e71',W*.29,H*.886,W*.285,H*.861,2);
  for(let i=0;i<12;i++) {const x=W*(.02+r()*.12),y=H*(.93+r()*.065);line(c,'#708465',x,y,x-1,y-4);rect(c,'#b68ca6',x-2,y-5,3,2);}
  sail(c,W*.79,H*.60,Math.min(.58,W/480));
}
function roof(c,x,y,w,h) {
  poly(c,'#734858',[[x-2,y],[x+w*.49,y-h],[x+w+2,y],[x+w*.80,y+3]]);
  poly(c,'#bd776c',[[x-2,y],[x+w*.49,y-h],[x+w*.66,y-h*.72],[x+w*.82,y+1]]);
  line(c,'#e4a085',x-2,y,x+w*.49,y-h);
  for(let i=1;i<5;i++) line(c,'#955c5f',x+w*i/6,y-i%2,x+w*(i/6+.13),y-h*.3);
}
function house(c,x,y,w,h,seed) {
  h=Math.min(h,w*1.65);const r=rng(seed);
  rect(c,'#8d8290',x,y-h,w,h);rect(c,'#dfc5ac',x,y-h,w*.78,h);
  rect(c,'#ecd6b6',x,y-h,w*.07,h);roof(c,x,y-h,w,Math.max(4,w*.24));
  for(let row=0;row<Math.max(1,Math.floor((h-6)/12));row++) for(let k=0;k<2;k++) {
    const xx=x+w*(.19+k*.35),yy=y-h+5+row*12;
    rect(c,'#71647b',xx,yy,Math.max(2,w*.16),6);
    if(r()>.3) rect(c,'#f5d18e',xx+1,yy+1,Math.max(1,w*.10),4);
    line(c,'#efe0bf',xx-1,yy+6,xx+w*.18,yy+6);
    if(k===0) rect(c,'#507276',xx-2,yy,2,6);
  }
  rect(c,'#665b70',x+w*.35,y-9,Math.max(3,w*.2),9);
  line(c,'#c09d92',x+1,y-2,x+w*.77,y-2);
  if(w>18) {rect(c,'#8f735e',x+w*.70,y-h-7,3,5);rect(c,'#d2b29a',x+w*.70,y-h-8,4,1);}
}
function fishingBoat(c,x,y,s) {
  poly(c,'#384c62',[[x-17*s,y],[x+19*s,y],[x+13*s,y+6*s],[x-10*s,y+6*s]]);
  line(c,'#efd1a7',x-16*s,y,x+18*s,y,2);
  rect(c,'#b59883',x-8*s,y-9*s,13*s,8*s);rect(c,'#dfceb0',x-9*s,y-10*s,16*s,2);
  rect(c,'#435e77',x-6*s,y-8*s,4*s,4*s);rect(c,'#e3c792',x,y-8*s,3*s,4*s);
  line(c,'#8e8f96',x+7*s,y,x+7*s,y-25*s);
  line(c,'#93878d',x+7*s,y-23*s,x+15*s,y-6*s);
  line(c,'#586e82',x-12*s,y+8*s,x+12*s,y+8*s);
}
function harbour(c,W,H,p,seed) {
  mountain(c,W,H,p.far[0],.59,.11,2.1);mountain(c,W,H,p.far[1],.64,.07,3.4);
  sea(c,W,H,'med-harbour',p,seed);
  // Town wraps a whole headland, layered from the ridge down to its quay.
  shape(c,W,H,'#656979',[[0,.46],[.10,.39],[.24,.40],[.36,.49],[.55,.51],[.69,.61],[.75,.67],[.73,.704],[0,.704]]);
  for(const [u,v,w,h] of [[.02,.48,.07,.15],[.10,.46,.066,.17],[.18,.46,.068,.14],[.29,.52,.075,.14],[.38,.53,.066,.11],[.49,.585,.065,.11],[.58,.615,.066,.10],[.04,.60,.078,.12],[.14,.59,.074,.12],[.24,.60,.082,.11],[.34,.625,.075,.11],[.44,.65,.09,.105],[.57,.672,.075,.085],[.68,.69,.05,.06],[.07,.688,.085,.09],[.18,.688,.08,.085],[.28,.69,.08,.075],[.39,.69,.074,.065]]) {
    house(c,W*u,H*v,Math.max(7,W*w),H*h,seed+u*1487+v*983);
  }
  // Stone bell tower: arched belfry, clock face, tiles and a tiny cross.
  const x=W*.26,y=H*.52,w=Math.max(7,Math.min(W*.033,H*.066)),ht=Math.min(H*.30,w*5.5);
  rect(c,'#928797',x,y-ht,w,ht);rect(c,'#e6c8ad',x,y-ht,w*.72,ht);
  rect(c,'#b9a59c',x-2,y-ht+8,w+4,2);rect(c,'#f2d4b3',x-2,y-ht-1,w+4,2);
  rect(c,'#5c5674',x+w*.2,y-ht+4,w*.38,6);ellipse(c,'#5c5674',x+w*.39,y-ht+4,w*.18,2);
  ellipse(c,'#eee0bf',x+w*.42,y-ht+21,w*.23,w*.23);
  line(c,'#827084',x+w*.42,y-ht+21,x+w*.42,y-ht+18);
  roof(c,x-1,y-ht,w+2,w*.65);line(c,'#807282',x+w*.45,y-ht-w*.6,x+w*.45,y-ht-w*.6-5);
  // Quay masonry, stairs, bollards and lamps keep buildings grounded.
  rect(c,'#aaa2a0',0,H*.696,W*.745,H*.023);line(c,'#ead0b0',0,H*.696,W*.74,H*.696,2);
  for(let i=0;i<Math.ceil(W*.745/9);i++) {rect(c,'#737a8d',i*9,H*.711,7,1);if(i%2===0) rect(c,'#c3b4ab',i*9+3,H*.703,4,1);}
  for(const u of [.09,.36,.61]) {
    line(c,'#5b5f77',W*u,H*.695,W*u,H*.651,1);rect(c,'#6b637c',W*u-2,H*.65,5,3);
    rect(c,'#ffdf9b',W*u-1,H*.651,3,2);rect(c,'#606274',W*u+4,H*.696,3,3);
  }
  for(let i=0;i<6;i++) rect(c,i%2?'#91888d':'#d7beaa',W*.735-i*2,H*.69+i*2,W*.035,1);
  for(const u of [.12,.34,.49,.64]) for(let j=0;j<14;j++) {
    const yy=H*.725+j*2.2,xx=W*u+Math.sin(j*1.8+u)*j*.32;
    rect(c,j%3===0?'#caa89a':'#817e93',xx,yy,2+j*.12,1);
  }
  fishingBoat(c,W*.43,H*.79,Math.min(1.1,W/360));fishingBoat(c,W*.79,H*.765,Math.min(.74,W/500));
  sail(c,W*.9,H*.705,Math.min(.55,W/500),true);
  // Crescent moon over the open side of the harbour, replacing the generic sun.
  ellipse(c,'#f4dcba',W*.83,H*.17,Math.min(11,W*.035),Math.min(11,W*.035));
  ellipse(c,mix(p.sky[0],p.sky[1],.46),W*.84,H*.16,Math.min(10,W*.032),Math.min(10,W*.032));
  const r=rng(seed);for(let i=0;i<26;i++) rect(c,'#bfbac4',r()*W,H*(.04+r()*.27),1,1);
}
function wall(c,W,H,y,width,seed) {
  const r=rng(seed),hh=Math.max(7,H*.034);
  rect(c,'#7c8064',0,y,width,hh);rect(c,'#dfc8a0',0,y,width,2);
  for(let row=0;row<3;row++) for(let x=-8+(row%2)*5;x<width-4;x+=8+r()*5) {
    const w=5+r()*5;rect(c,row===0?'#bbb38b':'#a79f7d',x,y+2+row*3,w,2);
    rect(c,'#d4c19a',x,y+2+row*3,w-1,1);
  }
  line(c,'#536f59',0,y+hh,width,y+hh);
}
function terraces(c,W,H,p,seed) {
  mountain(c,W,H,p.far[0],.57,.12,1.8);mountain(c,W,H,p.far[1],.62,.055,3.7);
  sea(c,W,H,'med-terraces',p,seed);
  // A warm olive hillside occupies the picture; the sea is a distant view.
  const hill=uv(W,H,[[0,.27],[.13,.28],[.29,.37],[.44,.42],[.60,.53],[.68,.61],[.70,.70],[.64,.78],[.54,.86],[.50,1],[0,1]]);
  poly(c,'#8c9b72',hill);
  shape(c,W,H,'#b3b17d',[[0,.38],[.19,.41],[.33,.46],[.46,.52],[.54,.61],[.59,.70],[.54,.82],[0,.95]]);
  const soil=rng(seed^0x34ad);
  for(let i=0;i<180;i++) {
    const x=soil()*W*.49,y=H*(.34+soil()*.39);
    if(!inside(x,y,hill)||!inside(x+6,y,hill)) continue;
    rect(c,i%4?'#a6ab7a':'#c7bc89',x,y,2+soil()*5,1);
  }
  for(const [v,width] of [[.43,.34],[.575,.46],[.735,.50]]) {
    wall(c,W,H,H*v,W*width,seed+v*981);
    for(const [u,s] of [[.07,.19],[.235,.18],[.405,.16]]) if(u<width-.035) {
      olive(c,W*u,H*v-2,Math.min(H*s,W*.22),seed+v*510+u*1300);
      // Soft ground shadow, and herbs around each trunk.
      line(c,'#7e8b64',W*(u-.027),H*v-1,W*(u+.037),H*v-1,2);
    }
  }
  // A tiny stone farmhouse and cypress, scaled with its surrounding grove.
  const x=W*.08,base=H*.325,w=Math.max(9,W*.073),hh=Math.min(H*.10,w*1.1);
  rect(c,'#8c9376',x,base-hh,w,hh);rect(c,'#dcc8a2',x,base-hh,w*.74,hh);
  roof(c,x,base-hh,w,Math.max(3,w*.25));rect(c,'#667364',x+w*.30,base-7,4,7);
  rect(c,'#7c8066',x+w*.53,base-hh+5,3,4);
  poly(c,'#355b49',[[W*.21,H*.328],[W*.19,H*.3],[W*.195,H*.18],[W*.205,H*.145],[W*.216,H*.20],[W*.225,H*.30]]);
  line(c,'#55755b',W*.205,H*.31,W*.204,H*.20,2);
  const r=rng(seed+17);
  for(let i=0;i<75;i++) {
    const x=r()*W*.45,y=H*(.79+r()*.20);
    line(c,'#75805c',x,y,x-1,y-3);if(i%7===0) rect(c,'#c695b2',x-1,y-5,2,2);
    if(i%5===0) rect(c,'#dcc39c',x+2,y,3,1);
  }
  // A narrow descending footpath on the warm slope; no repeated giant cliff.
  shape(c,W,H,'#d5c29b',[[.47,.79],[.49,.80],[.44,.87],[.40,.92],[.37,1],[.33,1],[.375,.916],[.421,.864]]);
  sail(c,W*.85,H*.72,Math.min(.6,W/500));
}
export function paintMediterranean(c,W,H,h,seed) {
  const p=MED_PALETTES[h];ramp(c,W,H,p.sky);
  if(h!=='med-harbour') {
    const ink=mix(p.sky[2],p.sky[1],.28);
    for(const [u,v,s] of [[.46,.12,.16],[.76,.23,.11],[.16,.085,.1]]) cloud(c,W*u,H*v,Math.min(75,W*s),ink);
  }
  if(h==='med-cove') cove(c,W,H,p,seed);
  else if(h==='med-islands') beach(c,W,H,p,seed);
  else if(h==='med-harbour') harbour(c,W,H,p,seed);
  else terraces(c,W,H,p,seed);
}
