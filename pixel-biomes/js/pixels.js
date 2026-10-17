// Shared integer-grid drawing tools. No canvas paths, blur or antialiasing.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const mod = (n, m) => ((n % m) + m) % m;
export function rect(c, ink, x, y, w = 1, h = 1) {
  c.fillStyle = ink;
  c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
export function line(c, ink, x0, y0, x1, y1, thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    rect(c, ink, x0, y0, thick, thick);
    if (x0 === x1 && y0 === y1) break;
    const e = err * 2;
    if (e >= dy) { err += dy; x0 += sx; }
    if (e <= dx) { err += dx; y0 += sy; }
  }
}
export function poly(c, ink, points) {
  const p = points.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const low = Math.max(0, Math.min(...p.map(v => v[1])));
  const high = Math.min(c.canvas?.height ?? 10000, Math.max(...p.map(v => v[1])));
  c.fillStyle = ink;
  for (let y = low; y <= high; y++) {
    const hits = [];
    for (let i = 0; i < p.length; i++) {
      const [x1,y1] = p[i], [x2,y2] = p[(i+1)%p.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) hits.push(x1+(y-y1)*(x2-x1)/(y2-y1));
    }
    hits.sort((a,b) => a-b);
    for (let i=0; i+1<hits.length; i+=2) {
      const left=Math.ceil(hits[i]), right=Math.floor(hits[i+1]);
      if (right>=left) c.fillRect(left,y,right-left+1,1);
    }
  }
}
export function ellipse(c, ink, x, y, rx, ry) {
  for (let v=-Math.round(ry); v<=ry; v++) {
    const span=Math.floor(rx*Math.sqrt(Math.max(0,1-v*v/(ry*ry))));
    rect(c,ink,x-span,y+v,span*2+1,1);
  }
}
export function mix(a,b,t) {
  return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
}
export function ramp(c,w,h,colors,top=0,bottom=h) {
  for (let y=Math.round(top);y<bottom;y++) {
    // A rounded first row can sit just above a fractional waterline.
    // Clamp the ramp coordinate before indexing its palette.
    const progress=Math.max(0,Math.min(1,(y-top)/(bottom-top)));
    const k=Math.floor(progress*36)/36*(colors.length-1);
    const i=Math.floor(k);
    rect(c,mix(colors[i],colors[Math.min(i+1,colors.length-1)],k-i),0,y,w,1);
  }
}
export function stamp(c,piece,x,y,scale=1) {
  piece.rows.forEach((row,v)=>{for(let u=0;u<row.length;u++) if(row[u]!=='.') rect(c,piece.palette[row[u]],x+u*scale,y+v*scale,scale,scale);});
}
