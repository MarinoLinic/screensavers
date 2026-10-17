import {rng,rect,line,poly,ellipse,ramp,mix} from './pixels.js';
import {groundY} from './terrain.js';
import {foliage,tropicalLeaf,stoneFace} from './landscape-details.js';

const uv=(W,H,pts)=>pts.map(([u,v])=>[W*u,H*v]);
const shape=(c,W,H,ink,pts)=>poly(c,ink,uv(W,H,pts));
function floor(c,W,H,h,p,seed) {
  const pts=[[0,H]];
  for(let x=0;x<=W+3;x+=3) pts.push([x,groundY(h,W,H,x,0)]);
  pts.push([W,H]);poly(c,p.earth[0],pts);
  const r=rng(seed);
  for(let i=0;i<Math.min(500,W*H/280);i++) {
    const x=r()*W,y=groundY(h,W,H,x,r());
    rect(c,i%4?p.earth[1]:p.earth[2],x,y,1+r()*3,1);
    if(i%11===0) line(c,p.leaf[1],x,y,x-2,y-3);
  }
}
function oak(c,x,y,h,p,seed) {
  // Twisting branches and the split trunk have their own lit planes.
  const w=h*.085;
  poly(c,p.bark[0],[[x-w*.85,y],[x-w*.45,y-h*.38],[x-w*.72,y-h*.62],[x-w*.2,y-h*.79],[x+w*.32,y-h*.82],[x+w*.22,y-h*.55],[x+w*.6,y-h*.27],[x+w*1.25,y]]);
  poly(c,p.bark[1],[[x-w*.55,y],[x-w*.3,y-h*.36],[x-w*.58,y-h*.61],[x-w*.11,y-h*.73],[x+w*.03,y-h*.49],[x+w*.23,y]]);
  const branches=[[-.3,-.83,-.06,-.56],[.32,-.72,.02,-.43],[-.44,-.65,-.03,-.49],[.47,-.91,.17,-.7]];
  for(const [u,v,a,b] of branches) {
    line(c,p.bark[0],x+h*a,y+h*b,x+h*u,y+h*v,Math.max(2,Math.round(w*.58)));
    line(c,p.bark[1],x+h*a-1,y+h*b,x+h*u-1,y+h*v,Math.max(1,Math.round(w*.22)));
  }
  for(const [u,v,rx,ry] of [[-.31,-.83,.28,.15],[.24,-.91,.29,.17],[-.03,-1.06,.31,.16],[.44,-.77,.20,.12],[-.44,-.69,.20,.12]]) foliage(c,x+h*u,y+h*v,h*rx,h*ry,p.leaf,seed+u*981);
  for(let i=0;i<10;i++) {
    const yy=y-h*(.04+i*.054),xx=x-w*.19+Math.sin(i*1.4)*w*.18;
    line(c,i%3?p.bark[0]:p.bark[2],xx,yy,xx+2,yy-5);
  }
  for(const d of [-1,1]) {
    poly(c,p.bark[0],[[x,y-h*.12],[x+d*h*.08,y-3],[x+d*h*.18,y+5],[x+d*h*.08,y+4],[x,y+1]]);
    line(c,p.bark[1],x,y-h*.06,x+d*h*.14,y+3,2);
  }
  // Moss climbs the damp side of the trunk, rather than random floor pixels.
  for(let i=0;i<7;i++) rect(c,p.leaf[i%2?1:2],x+w*.35+Math.sin(i)*2,y-i*3,2+i%3,2);
}
function log(c,x,y,w,p) {
  poly(c,p.bark[0],[[x-w*.5,y-1],[x-w*.51,y-10],[x+w*.48,y-14],[x+w*.54,y-5],[x+w*.48,y+1]]);
  line(c,p.bark[1],x-w*.48,y-8,x+w*.47,y-11,2);
  ellipse(c,p.bark[2],x+w*.48,y-6,4,6);ellipse(c,p.bark[0],x+w*.49,y-6,2,4);ellipse(c,p.bark[1],x+w*.49,y-6,1,2);
  for(let i=0;i<6;i++) rect(c,p.leaf[i%2?2:1],x-w*.4+i*w*.15,y-10-i%2,Math.max(3,w*.12),2);
  line(c,p.bark[0],x-w*.21,y-9,x-w*.28,y-18,3);
  for(const dx of [-w*.24,0,w*.13]) {rect(c,'#c9c3a0',x+dx,y-16,1,5);ellipse(c,'#a87b5c',x+dx,y-16,4,2);rect(c,'#e3c59a',x+dx-2,y-17,3,1);}
}
export function paintForest(c,W,H,p,seed) {
  const r=rng(seed);
  ramp(c,W,H,['#9eb7bc','#d5d3b4','#a1b398']);
  // An open, warm woodland clearing. Distant oaks dissolve into morning mist.
  for(let layer=0;layer<3;layer++) {
    const ink=['#a7bcb0','#88a89b','#648e7d'][layer];
    const leaf=[ink,ink,mix(ink,'#b8c6a8',.17),mix(ink,'#e1d9b3',.25)];
    for(let i=0;i<Math.ceil(W/37);i++) {
      const x=i*39+r()*20,h=H*(.18+r()*.22),base=H*(.69+layer*.035);
      line(c,ink,x,base,x-2,base-h*.75,2+layer);
      line(c,ink,x,base-h*.35,x-h*.2,base-h*.72,1+layer);
      foliage(c,x-h*.06,base-h*.8,h*.34,h*.24,leaf,seed+i+layer*188);
    }
    rect(c,mix(ink,'#a9ba9b',.12),0,H*(.67+layer*.035),W,H*.11);
  }
  // Light falls across the clearing; the serpentine leaf-strewn path leads in.
  floor(c,W,H,'forest',p,seed+3);
  shape(c,W,H,'#647c55',[[.23,.74],[.50,.72],[.70,.78],[.83,.92],[.69,1],[.26,1],[.20,.9]]);
  shape(c,W,H,'#a39b6b',[[.43,.746],[.485,.74],[.53,.77],[.48,.81],[.53,.85],[.61,.9],[.66,1],[.50,1],[.46,.9],[.415,.85],[.427,.81],[.47,.779]]);
  shape(c,W,H,'#b7aa77',[[.453,.75],[.478,.75],[.515,.77],[.454,.81],[.471,.845],[.56,.90],[.59,1],[.546,1],[.505,.90],[.434,.85],[.438,.808],[.488,.77]]);
  // Trees frame the path asymmetrically; no jungle waterfall or canopy wall.
  oak(c,W*.125,H*.84,Math.min(H*.59,W*.96),p,seed+14);
  oak(c,W*.875,H*.84,Math.min(H*.67,W*1.08),p,seed+38);
  const rear={...p,leaf:['#446c53','#6d8a5f','#a0af76','#c5c38c'],bark:['#546b56','#829371','#a9a584']};
  oak(c,W*.68,H*.754,Math.min(H*.32,W*.30),rear,seed+97);
  log(c,W*.25,H*.918,Math.min(83,W*.22),p);
  // Grouped bluebells, tiny leaf rosettes, stones and copper fallen leaves.
  for(const [u,v] of [[.04,.91],[.15,.96],[.73,.92],[.87,.97]]) for(let i=0;i<9;i++) {
    const x=W*u+(r()-.5)*Math.min(40,W*.13),y=H*v+(r()-.5)*9;
    line(c,'#547656',x,y,x+Math.sin(i)*2,y-5-r()*4);
    rect(c,i%3?'#a495bc':'#c0add1',x-1,y-8,2,2);rect(c,'#e1d5da',x,y-9,1,1);
  }
  for(let i=0;i<70;i++) {
    const x=r()*W,y=groundY('forest',W,H,x,r());
    if(x>W*.4&&x<W*.64) rect(c,['#bc9c65','#d3b278','#7b7553'][i%3],x,y,2,1);
  }
  for(const [u,v] of [[.08,.88],[.80,.92]]) {
    stoneFace(c,uv(W,H,[[u-.035,v],[u-.03,v-.027],[u+.007,v-.04],[u+.04,v-.024],[u+.05,v]]),['#637969','#536b61','#a6af86'],seed+u*281);
    rect(c,p.leaf[2],W*(u-.012),H*(v-.034),Math.min(12,W*.03),2);
  }
}
function buttress(c,x,y,h,p,seed) {
  const w=h*.088;
  poly(c,p.bark[0],[[x-w*.9,y],[x-w*.5,y-h*.4],[x-w*.5,y-h],[x+w*.1,y-h*1.03],[x+w*.35,y-h*.5],[x+w*.6,y-h*.2],[x+w*1.3,y]]);
  poly(c,p.bark[1],[[x-w*.6,y],[x-w*.3,y-h*.44],[x-w*.34,y-h],[x-w*.10,y-h],[x+w*.02,y-h*.45],[x+w*.5,y]]);
  for(const d of [-1,1]) {
    poly(c,p.bark[0],[[x,y-h*.23],[x+d*h*.08,y-h*.1],[x+d*h*.18,y+5],[x+d*h*.22,y+7],[x+d*h*.10,y+8],[x,y+1]]);
    line(c,p.bark[2],x-1,y-h*.17,x+d*h*.14,y+3,2);
    line(c,p.bark[1],x-1,y-h*.12,x+d*h*.20,y+5);
  }
  for(let i=0;i<12;i++) line(c,p.bark[i%3===0?2:0],x-w*.1+Math.sin(i)*2,y-h*(.12+i*.065),x-w*.1+Math.sin(i)*2,y-h*(.15+i*.065));
  // Clinging epiphytes and vines are attached to the trunk.
  for(const v of [.33,.60]) {
    const xx=x+w*.32,yy=y-h*v;
    tropicalLeaf(c,xx,yy,h*.075,-h*.04,h*.013,['#225a44','#46844f','#9ab769']);
    tropicalLeaf(c,xx,yy,-h*.07,-h*.07,h*.012,['#225a44','#46844f','#9ab769']);
    for(let i=0;i<3;i++) rect(c,'#ce839a',xx+1+i,yy-4-i,2,2);
  }
  const r=rng(seed);for(let i=0;i<5;i++) {
    const xx=x+(r()-.5)*h*.75,yy=y-h*(.98+r()*.1);
    foliage(c,xx,yy,h*.28,h*.13,p.leaf,seed+i*47);
  }
}
export function junglePlant(c,x,y,h,phase=0) {
  const pal=['#123e35','#2f7451','#84a864'];
  for(const [u,v,s] of [[-.8,-.46,1],[-.4,-.92,.75],[.34,-1,.8],[.82,-.55,1],[.24,-.44,.6]]) {
    const tipX=h*u+Math.sin(phase)*1.3;
    tropicalLeaf(c,x,y,tipX,h*v,h*.13*s,pal);
  }
  line(c,'#688d53',x,y,x+2,y-h*.58,2);
  for(let i=0;i<3;i++) {
    poly(c,'#c26853',[[x+2,y-h*(.3+i*.10)],[x+9,y-h*(.35+i*.1)],[x+7,y-h*(.4+i*.1)],[x+2,y-h*(.36+i*.1)]]);
    rect(c,'#e6ac66',x+7,y-h*(.39+i*.1),2,1);
  }
}
export function paintJungle(c,W,H,p,seed) {
  const r=rng(seed);
  ramp(c,W,H,['#2b6a6a','#6a9d87','#afc8a0'],0,H*.76);
  // Tropical ravine: sheer mossy escarpments and a three-stage cascade.
  for(let layer=0;layer<3;layer++) {
    const ink=['#639782','#3d7c6b','#2b5d52'][layer];
    for(let i=0;i<Math.ceil(W/28);i++) {
      const x=i*29+r()*12,base=H*(.63+layer*.05),ht=H*(.33+r()*.17);
      line(c,ink,x,base,x+4,base-ht,Math.max(2,layer+2));
      foliage(c,x,base-ht,ht*.24,ht*.13,[ink,ink,ink,mix(ink,'#9eba8b',.08)],seed+i+layer*341);
    }
  }
  stoneFace(c,uv(W,H,[[0,.32],[.15,.36],[.20,.43],[.34,.49],[.34,.59],[.47,.66],[.47,.80],[0,.86]]),['#244e46','#315b4c','#416a54'],seed+87,.65);
  stoneFace(c,uv(W,H,[[.64,.35],[.82,.32],[1,.37],[1,.85],[.69,.81],[.60,.72],[.60,.59],[.64,.55]]),['#345e4f','#3e6c55','#558168'],seed+93,.7);
  for(const [u,v,w] of [[.20,.48,.16],[.13,.59,.22],[.64,.45,.27],[.62,.57,.27],[.60,.68,.30]]) {
    shape(c,W,H,'#54826a',[[u,v],[u+w,v-.017],[u+w,v+.025],[u+.015,v+.03]]);
    line(c,'#719679',W*u,H*v,W*(u+w*.90),H*(v-.016),2);
    for(let i=0;i<4;i++) line(c,'#284f44',W*(u+.015+i*w*.2),H*(v+.025),W*(u+.027+i*w*.2),H*(v+.065));
  }
  // Cascading water broadens into a blue-green pool at the foot of the ravine.
  for(const [u,v,w,hh] of [[.54,.32,.065,.245],[.512,.56,.095,.123],[.48,.68,.12,.075]]) {
    shape(c,W,H,'#4e9993',[[u,v],[u+w,v],[u+w*.86,v+hh],[u-w*.20,v+hh]]);
    shape(c,W,H,'#8bc6b0',[[u+w*.16,v],[u+w*.65,v],[u+w*.40,v+hh],[u-w*.1,v+hh]]);
    for(let i=0;i<7;i++) {
      const xx=W*(u+w*(.05+i*.12));
      line(c,i%2?'#c7e2c1':'#a5d4b9',xx,H*v,xx-W*w*.1,H*(v+hh),1);
    }
    ellipse(c,'#9bc8ac',W*(u+w*.4),H*(v+hh),W*w*.65,H*.012);
    line(c,'#d9e6bf',W*(u-w*.12),H*(v+hh),W*(u+w*.7),H*(v+hh));
  }
  shape(c,W,H,'#37796f',[[.35,.756],[.46,.742],[.62,.752],[.70,.763],[.61,.778],[.43,.78],[.31,.776]]);
  for(let i=0;i<23;i++) {const x=W*(.34+r()*.32),y=H*(.75+r()*.024);rect(c,i%3?'#75ad93':'#bdd7b4',x,y,3+r()*7,1);}
  floor(c,W,H,'jungle',p,seed+88);
  buttress(c,W*.10,H*.88,H*.92,p,seed+14);
  buttress(c,W*.89,H*.92,H*.94,p,seed+44);
  // Overhead lianas sweep across the gap; pendent roots have leafy joints.
  for(const [u,v,len] of [[.02,.06,.54],[.17,.0,.49],[.30,-.03,.34],[.79,.02,.56],[.98,.04,.39]]) {
    const pts=[];for(let i=0;i<=16;i++) pts.push([W*u+Math.sin(i*.15+u)*W*.025,H*(v+i/16*len)]);
    for(let i=1;i<pts.length;i++) line(c,'#183f36',...pts[i-1],...pts[i],2);
    for(let i=3;i<pts.length;i+=3) tropicalLeaf(c,...pts[i],i%2?7:-8,-5,2,['#23523b','#4a8150','#8ca761']);
  }
  for(let i=0;i<8;i++) foliage(c,W*(i/7),H*(.03+r()*.03),Math.max(22,W*.13),H*.055,p.leaf,seed+i*181);
  junglePlant(c,W*.04,H*.995,Math.min(58,H*.19),0);junglePlant(c,W*.94,H*.995,Math.min(65,H*.22),1);
  junglePlant(c,W*.24,H*.87,Math.min(27,W*.13),2);
  log(c,W*.71,H*.925,Math.min(67,W*.20),p);
  for(const [u,v] of [[.31,.9],[.57,.945],[.83,.86]]) {
    stoneFace(c,uv(W,H,[[u-.036,v],[u-.027,v-.033],[u+.005,v-.042],[u+.04,v-.02],[u+.045,v]]),['#406956','#294f45','#71946a'],seed+u*78);
    foliage(c,W*u,H*(v-.03),Math.min(8,W*.023),3,p.leaf,seed+v*441);
  }
}
