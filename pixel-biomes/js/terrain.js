import { desertGroundY } from './desert-art.js';

export const isMarine = h => ['reef','kelp','lagoon','abyss'].includes(h);
export const isCoast = h => h.startsWith('med-')||h.startsWith('trop-');
export const isWetland = h => h === 'river' || isCoast(h);
export const waterline = (h,H) => H*({river:.57,'med-cove':.58,'med-islands':.60,'med-harbour':.72,'med-terraces':.72,'trop-beach':.56,'trop-atoll':.33}[h]||.52);
export function waterBounds(h,W) {
  return h==='river'?[W*.03,W*.98]:[W*({'med-cove':.30,'med-islands':.52,'med-harbour':.03,'med-terraces':.71,'trop-beach':.41,'trop-atoll':.03}[h]||0),W*(h==='med-cove'?.86:.99)];
}
// The painters and the animals use this SAME contour; feet never float.
export function groundY(h,W,H,x,depth=0.5) {
  if(h==='desert') return desertGroundY(W,H,x,depth);
  if(isWetland(h)) return H*(.92+depth*.06)+Math.sin(x/W*11)*H*.006;
  const top=h==='moon'?.70:h==='jungle'?.78:.73;
  return H*(top+depth*(.985-top))+Math.sin(x/W*9+.8)*H*.014+Math.sin(x/W*21)*H*.005;
}
