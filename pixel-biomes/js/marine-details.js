import {rng,rect,line,poly,ellipse} from './pixels.js';

/** Broken merchant ship. All beams, rigging and planks follow its tilted hull. */
export function paintShipwreck(c,W,H,seed) {
  const w=Math.min(W*.65,H*1.04),x=W*.5-w*.49,y=H*.884,r=rng(seed^0x731e);
  const at=(u,v)=>[x+w*u,y+w*v];
  const shape=(ink,pts)=>poly(c,ink,pts.map(([u,v])=>at(u,v)));
  const stroke=(ink,a,b,t=1)=>line(c,ink,...at(...a),...at(...b),t);
  const dark='#263c54',wood='#506073',light='#819092',edge='#a8b4ac',moss='#467778';
  // Two fractured masts and their rigging are drawn behind the hull.
  stroke(dark,[.32,-.085],[.24,-.56],4);stroke(light,[.31,-.085],[.237,-.557],1);
  stroke(dark,[.68,-.075],[.74,-.43],3);stroke(light,[.673,-.08],[.738,-.43]);
  stroke(wood,[.12,-.36],[.44,-.41],3);stroke(light,[.12,-.365],[.43,-.415]);
  stroke(wood,[.57,-.28],[.85,-.245],3);stroke(light,[.57,-.285],[.85,-.25]);
  for(const [a,b] of [[[.24,-.53],[.09,-.13]],[[.24,-.53],[.58,-.105]],[[.74,-.415],[.56,-.075]],[[.74,-.415],[.90,-.09]],[[.14,-.36],[.20,-.08]]]) stroke('#526e7d',a,b);
  // Torn linen sail: the lower edge has missing panels and frayed threads.
  shape('#6e8992',[[.18,-.37],[.41,-.405],[.45,-.25],[.42,-.23],[.40,-.235],[.393,-.19],[.36,-.205],[.34,-.19],[.30,-.205],[.28,-.16],[.235,-.19],[.23,-.22],[.205,-.215]]);
  shape('#90a6a6',[[.19,-.373],[.37,-.396],[.40,-.282],[.355,-.269],[.348,-.247],[.29,-.256],[.26,-.22],[.23,-.232]]);
  for(const u of [.23,.29,.36,.41]) stroke('#536d7b',[u,-.36],[u+.023,-.24]);
  for(const u of [.27,.34,.40]) stroke('#90a5a4',[u,-.203],[u+.008,-.173]);
  shape('#496b78',[[.615,-.274],[.81,-.247],[.76,-.13],[.71,-.145],[.696,-.12],[.663,-.14]]);
  // Stern castle, exposed deck, raised bow and broken gunwale.
  shape(dark,[[0,-.22],[.13,-.23],[.19,-.12],[.35,-.10],[.41,-.11],[.48,-.065],[.54,-.11],[.84,-.105],[.91,-.20],[1,-.255],[.96,-.13],[.925,-.015],[.85,.047],[.68,.055],[.38,.061],[.20,.027],[.095,-.02],[.04,-.105]]);
  shape(wood,[[.05,-.206],[.125,-.208],[.17,-.115],[.38,-.084],[.475,-.049],[.53,-.087],[.83,-.082],[.91,-.16],[.98,-.225],[.925,-.015],[.845,.025],[.62,.031],[.31,.033],[.17,-.005],[.092,-.06]]);
  shape('#627479',[[.08,-.13],[.36,-.073],[.475,-.04],[.83,-.073],[.905,-.137],[.87,-.044],[.61,-.018],[.25,-.022],[.13,-.051]]);
  stroke(edge,[.02,-.22],[.12,-.225],2);stroke(light,[.135,-.20],[.18,-.115],2);
  stroke(edge,[.18,-.114],[.385,-.099],2);stroke(light,[.54,-.108],[.83,-.10],2);stroke(edge,[.85,-.115],[.977,-.236],2);
  // Wood strakes and interrupted ribs replace a featureless hull polygon.
  for(let i=0;i<5;i++) {
    const v=-.072+i*.020;
    stroke(i%2?'#3b4f64':'#778684',[.16+i*.018,v],[.83-i*.009,v-.027]);
  }
  for(const u of [.19,.28,.38,.60,.70,.81]) stroke('#344d60',[u,-.09],[u-.025,.029],2);
  // A jagged missing hull panel exposes the frames, with darkness behind.
  shape('#1c344c',[[.43,-.066],[.457,-.045],[.49,-.062],[.516,-.028],[.57,-.049],[.594,-.012],[.57,.03],[.533,.026],[.51,.036],[.49,.015],[.45,.025],[.43,.002]]);
  for(const u of [.46,.51,.56]) stroke('#9ca79a',[u,-.053],[u+.01,.03],2);
  for(const u of [.23,.335,.67,.775]) {
    const [xx,yy]=at(u,-.068);ellipse(c,'#98a59e',xx,yy,w*.015,w*.015);ellipse(c,'#233b53',xx,yy,w*.009,w*.009);
    rect(c,'#bcc1aa',xx-1,yy-w*.013,2,1);
  }
  // Stern cabin windows and its broken transom rail.
  shape('#46566b',[[.04,-.196],[.115,-.20],[.146,-.138],[.064,-.145]]);
  for(const u of [.06,.09,.12]) {stroke('#8b9a98',[u,-.185],[u+.012,-.147]);}
  for(const u of [.018,.048,.083,.116]) stroke(wood,[u,-.22],[u-.004,-.265],2);
  stroke(light,[.012,-.263],[.107,-.276],2);
  // Collapsed spar, scattered planks, anchor, and encrusting marine growth.
  stroke('#506c76',[.02,.065],[.28,.041],3);stroke('#819c96',[.04,.062],[.24,.04]);
  for(const [u,v] of [[.10,.075],[.81,.068],[.64,.075]]) stroke(wood,[u,v],[u+.09,v-.012],2);
  stroke('#637f88',[.79,-.05],[.84,.12]);stroke('#9aa99f',[.813,.053],[.852,.051]);
  stroke('#8a9e99',[.823,.10],[.844,.12],2);stroke('#8a9e99',[.844,.12],[.867,.087],2);
  for(let i=0;i<24;i++) {
    const u=.1+r()*.80,v=.01+r()*.045,[xx,yy]=at(u,v);
    rect(c,i%3?moss:'#78a294',xx,yy,2+r()*4,2);
    if(i%4===0) line(c,'#4d8284',xx,yy,xx+2,yy-5-r()*6);
  }
  for(const u of [.07,.84,.95]) {
    const [xx,yy]=at(u,-.04),ht=Math.max(7,w*.06);
    line(c,'#725c7b',xx,yy,xx,yy-ht,2);line(c,'#a27f9e',xx-1,yy,xx-1,yy-ht);
    for(const d of [-1,1]) {line(c,'#a27f9e',xx,yy-ht*.45,xx+d*ht*.5,yy-ht*.8);rect(c,'#d4a2b2',xx+d*ht*.5,yy-ht*.8,2,1);}
  }
}
