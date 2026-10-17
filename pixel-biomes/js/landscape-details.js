// Reusable pixel drawing primitives, not shared landscape compositions.
import {rng,rect,line,poly,ellipse} from './pixels.js';

export function inside(x,y,points) {
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [a,b]=points[i],[d,e]=points[j];
    if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a) hit=!hit;
  }
  return hit;
}
export function stoneFace(c,points,pal,seed,density=1) {
  poly(c,pal[0],points);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),r=rng(seed);
  const n=Math.min(650,Math.round((x1-x0)*(y1-y0)/45*density));
  for(let i=0;i<n;i++) {
    const x=x0+r()*(x1-x0),y=y0+r()*(y1-y0),w=2+r()*7;
    if(!inside(x,y,points)||!inside(x+w,y+1,points)) continue;
    rect(c,pal[i%5===0?2:1],x,y,w,1);
    if(i%9===0&&inside(x+2,y+4,points)) line(c,pal[1],x,y,x+2,y+4);
  }
}
export function foliage(c,x,y,rx,ry,pal,seed) {
  const r=rng(seed),pts=[];
  for(let i=0;i<26;i++) {
    const a=i/26*Math.PI*2,m=.85+r()*.18;
    pts.push([x+Math.cos(a)*rx*m,y+Math.sin(a)*ry*m]);
  }
  poly(c,pal[0],pts);
  for(let i=0;i<12;i++) {
    const u=(r()-.5)*1.3,v=(r()-.5)*1.2,xx=x+u*rx,yy=y+v*ry;
    const w=rx*(.2+r()*.14),h=ry*(.26+r()*.14);
    poly(c,pal[v<-.1?2:1],[[xx-w,yy],[xx-w*.8,yy-h*.7],[xx-w*.3,yy-h],[xx+w*.35,yy-h*.8],[xx+w,yy-h*.15],[xx+w*.8,yy+h*.5],[xx+w*.3,yy+h*.6],[xx-w*.8,yy+h*.5]]);
  }
  for(let i=0;i<Math.min(230,rx*ry/5);i++) {
    const xx=x+(r()-.5)*rx*1.7,yy=y+(r()-.5)*ry*1.6;
    if(!inside(xx,yy,pts)) continue;
    const ink=yy<y-ry*.23?pal[3]:yy>y+ry*.25?pal[0]:pal[2];
    rect(c,ink,xx,yy,2+r()*2,1);
    if(i%3===0) rect(c,ink,xx+1,yy-1,2,1);
  }
}
export function pine(c,x,y,h,seed,pal=['#24463f','#42664b','#719365','#b4b87f']) {
  const bark=['#555c48','#8b8560','#c4b08a'];
  poly(c,bark[0],[[x-3,y],[x-2,y-h*.6],[x+2,y-h*.76],[x+3,y-h*.6],[x+4,y]]);
  line(c,bark[1],x,y,x+1,y-h*.67,2);
  for(const [u,v,s] of [[-.3,-.8,.64],[.27,-.91,.72],[-.03,-1,.94]]) {
    line(c,bark[0],x,y-h*.42,x+h*u,y+h*v,2);
    line(c,bark[1],x,y-h*.45,x+h*u,y+h*v);
    foliage(c,x+h*u,y+h*v,h*.35*s,h*.14*s,pal,seed+u*700);
  }
  for(let i=0;i<5;i++) line(c,bark[0],x,y-h*(.08+i*.08),x+2,y-h*(.13+i*.08));
}
export function olive(c,x,y,h,seed) {
  const leaf=['#405b50','#6d8262','#9baa7c','#d0c7a0'];
  poly(c,'#686c51',[[x-4,y],[x-2,y-h*.41],[x-h*.08,y-h*.62],[x+2,y-h*.75],[x+5,y-h*.42],[x+3,y]]);
  line(c,'#a49972',x-1,y,x+1,y-h*.58,2);
  for(const [u,v,s] of [[-.23,-.68,.84],[.23,-.8,.82],[-.04,-.93,1]]) {
    line(c,'#676d51',x,y-h*.36,x+h*u,y+h*v,2);
    foliage(c,x+h*u,y+h*v,h*.28*s,h*.16*s,leaf,seed+u*1000);
  }
}
export function willow(c,x,y,h,seed) {
  const pal=['#315a46','#578664','#8bac79','#c3c797'];
  poly(c,'#405748',[[x-5,y],[x-3,y-h*.6],[x+1,y-h*.70],[x+5,y-h*.3],[x+9,y]]);
  line(c,'#8d9671',x-1,y,x-1,y-h*.58,2);
  for(const [u,v] of [[-.27,-.73],[.25,-.8],[-.02,-.91]]) {
    line(c,'#405748',x,y-h*.4,x+h*u,y+h*v,3);
    foliage(c,x+h*u,y+h*v,h*.29,h*.17,pal,seed+u*397);
  }
  const r=rng(seed);
  for(let i=0;i<25;i++) {
    const u=(i/24-.5)*.94,xx=x+h*u,top=y-h*(.77+.13*(1-Math.abs(u))),len=h*(.25+r()*.26);
    let old=[xx,top];
    for(let j=1;j<=8;j++) {
      const yy=top+len*j/8,bx=xx+Math.sin(j*.16+u)*h*.025;
      line(c,pal[i%3===0?2:1],...old,bx,yy);
      rect(c,pal[i%4===0?3:2],bx-1,yy,2,2);old=[bx,yy];
    }
  }
}
export function tropicalLeaf(c,x,y,dx,dy,width,pal) {
  const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const pts=[[x,y],[x+dx*.27+nx*width,y+dy*.27+ny*width],[x+dx*.68+nx*width*.75,y+dy*.68+ny*width*.75],[x+dx,y+dy],[x+dx*.6-nx*width*.7,y+dy*.6-ny*width*.7],[x+dx*.17-nx*width*.65,y+dy*.17-ny*width*.65]];
  poly(c,pal[0],pts);
  poly(c,pal[1],[[x,y],[x+dx*.27+nx*width,y+dy*.27+ny*width],[x+dx*.68+nx*width*.75,y+dy*.68+ny*width*.75],[x+dx,y+dy]]);
  line(c,pal[2],x,y,x+dx,y+dy);
  for(let j=2;j<8;j++) {
    const u=j/9,spread=Math.sin(u*Math.PI)*width*.7;
    line(c,pal[0],x+dx*u,y+dy*u,x+dx*(u-.08)-nx*spread,y+dy*(u-.08)-ny*spread);
  }
}
export function palm(c,x,y,h,lean,seed) {
  const topX=x+lean*h,topY=y-h;
  const pts=[];
  for(let i=0;i<=10;i++) {const u=i/10;pts.push([x+lean*h*u*u,y-h*u]);}
  for(let i=1;i<pts.length;i++) {
    line(c,'#695f47',...pts[i-1],...pts[i],Math.max(2,Math.round(h*.043*(1-i/22))));
    line(c,'#bcac7b',pts[i-1][0]-1,pts[i-1][1],pts[i][0]-1,pts[i][1]);
    rect(c,'#887b53',pts[i][0]-1,pts[i][1],3,1);
  }
  const pal=['#174d3f','#34815a','#8fb976'];
  for(const [u,v] of [[-.71,.29],[-.64,-.07],[-.4,-.37],[.1,-.43],[.52,-.27],[.78,.1],[.67,.38]]) {
    const dx=h*u,dy=h*v;
    const frond=[];
    for(let j=0;j<=12;j++) {
      const q=j/12,xx=topX+dx*q,yy=topY+dy*q+h*.25*q*q;
      const spread=Math.sin(q*Math.PI)*h*.058*(j%2?.74:1);
      frond.push([xx-dx*.07*Math.sin(q*Math.PI),yy-spread]);
    }
    for(let j=12;j>=0;j--) {
      const q=j/12,xx=topX+dx*q,yy=topY+dy*q+h*.25*q*q;
      const spread=Math.sin(q*Math.PI)*h*.10*(j%2?.78:1);
      frond.push([xx+dx*.07*Math.sin(q*Math.PI),yy+spread]);
    }
    poly(c,pal[0],frond);
    const points=[];
    for(let j=0;j<=12;j++) {
      const q=j/12,xx=topX+dx*q,yy=topY+dy*q+h*.25*q*q;
      points.push([xx,yy]);
      if(j<2||j>11) continue;
      const reach=h*.20*Math.sin(q*Math.PI),thick=Math.max(1,h*.019);
      for(const d of [-1,1]) {
        const ex=xx-dx*.10*d,ey=yy+reach*(d===1?1:-.65);
        poly(c,pal[1],[[xx,yy],[xx+thick,yy-1],[ex+thick*.4,ey-thick],[ex,ey],[xx-thick,yy+2]]);
        if(j%2===0) line(c,pal[2],xx,yy,ex,ey);
      }
    }
    for(let j=1;j<points.length;j++) line(c,pal[1],...points[j-1],...points[j],Math.max(1,Math.round(h*.015)));
  }
  ellipse(c,'#796847',topX-3,topY+4,2,3);ellipse(c,'#a28c58',topX+1,topY+3,2,2);
  rect(c,pal[2],topX-2,topY-2,3,2);
}
