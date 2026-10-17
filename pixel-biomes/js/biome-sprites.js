// Hand-pixelled silhouettes, colour clusters and anatomical markings.
// Faces point right. Walking poses leave the body and markings stationary.
const outline='#253a3a', eye='#162329', white='#fff0ce';
function walk(palette,body,feet) {
  const frames=feet.map(p=>[...body,...p]);
  return {palette,rows:frames[0],frames};
}
function still(palette,rows,animate) { return {palette,rows,animate}; }
function recolor(sprite,palette) { return {...sprite,palette:{...sprite.palette,...palette}}; }
const mammal={o:outline,e:eye,h:'#efc68f',m:'#bd8659',d:'#825542',w:white,g:'#fff9de',p:'#d49a83'};
const deer=walk(mammal,[
  '...............................o.......o....',
  '...............................mo...o..mo...',
  '...............................mmo..m..mo...',
  '................................omoommo.....',
  '............................oo...ommo.......',
  '...........................ohmo.ohhmoo.......',
  '............................ohmohhhhmmo.....',
  '.............................ohhhheghhmo....',
  '.............................ohhhheehhwmoo..',
  '............................ohhhhhhhwwhhmoo.',
  '.....oo....................omhhhhhhhwwwmeeo.',
  '.....omoo....oooooooooooooomhhhhhwwwwmmooo..',
  '......ommmooomhhhhhhhhhhhhhhhhhhwwwwmmo.....',
  '.......ommmhhhhhhhghhghhhhhhhhhhwwwmmo......',
  '.......ommmhhhhhhmmhhmmhhhhhhhhwwmmmo.......',
  '.......ommmhhhhhhhhhhhhhhhhhhwwwmmo.........',
  '........ommmmmmhhhhhhhhhhmmmmmmmmo..........',
  '.........ommmmmmmmmmmmmmmmmmmmmo............',
  '..........ommmmoo.......ommmmo..............',
],[
  ['..........ommo..........ommo...............','..........ommo..........ommo...............','..........ommo..........ommo...............','..........ommo..........ommo...............','..........oeeo..........oeeo...............'],
  ['.........ommo............ommo..............','........ommo..............ommo.............','.......ommo................ommo............','.......ommo.................ommo...........','.......oeeo.................oeeo...........'],
  ['...........ommo........ommo.................','............ommo......ommo..................','.............ommo....ommo...................','..............ommo..ommo....................','..............oeeo..oeeo....................'],
]);
const fox=walk({...mammal,h:'#e4ac67',m:'#b57149',d:'#725046'},[
  '..............................oo.....oo.....',
  '.............................ohmo...ohmo....',
  '.............................ohpmo.ohpmo....',
  '.............................ohhpmohhpmo....',
  '..............................ohhhhhhhmo....',
  '.............................ohhhheghhhmo...',
  '..oooo......................ohhhhheehhhwmoo.',
  '.owwhmoo.....ooooooooooooooohhhhhhhhwwwmmeeo',
  '.owwhhhmmoooomhhhhhhhhhhhhhhhhhhhhwwwwmmooo..',
  '..owwhhhhhhmmmhhhhhhhhhhhhhhhhhwwwwwmmo.....',
  '...ommhhhhhhmmmmmmhhhhhhhhhhhhwwwwmmmo.......',
  '.....ommmmmmo..ommmmmmmmmmmmmmmmmmo..........',
  '.......oooo.....ommmmoo...ommmmo............',
],[
 ['................ommo......ommo.............','................ommo......ommo.............','................oeoo......oeoo.............'],
 ['...............ommo........ommo............','..............ommo..........ommo...........','..............oeoo..........oeoo...........'],
 ['.................ommo....ommo..............','..................ommo..ommo...............','..................oeoo..oeoo...............'],
]);
const squirrel=walk({...mammal,h:'#d79764',m:'#a45e44',d:'#663b36'},[
  '....oooo........................',
  '..oomhhmoo......................',
  '.omhhghhmmo.....................',
  'omhhgghhmmmo........oo..........',
  'omhhhmmmddmo.......ohmo.........',
  'omhhmdoooodmo.....ohhhmoo.......',
  '.omhmdo...ommo...ohheghhmoo.....',
  '..ommmmo..ommo..ohhheehhwmeeo...',
  '...ommmmoommmmoohhhhhwwmmooo....',
  '....ommmmmmmhhhhhhhhwwmmo.......',
  '......ooommhhhhhhhhwwwmo........',
  '.........ommmhhhhhhwwmmo........',
  '..........ommmmmmmmmmmo........',
],[
 ['...........ommo...ommo.........','..........ommmo..ommmo.........','..........ooooo..ooooo.........'],
 ['..........ommo.....ommo........','.........ommmo......ommmo......','.........ooooo......ooooo......'],
 ['............ommo.ommo..........','............ommmommmo..........','............ooooooooo..........'],
]);
const birdPal={o:outline,e:eye,g:white,w:'#efe6be',h:'#e98c46',m:'#b75542',d:'#374857',b:'#78bac0',s:'#416c77',p:'#b79864'};
// Wing poses are actually drawn, rather than wobbling the entire animal.
function bird(palette,body,wings) {
  const width=Math.max(38,...[...body,...wings.flat()].map(([x,,rows])=>x+Math.max(...rows.map(r=>r.length)))),height=24;
  const frames=wings.map(wing=>{
    const rows=Array.from({length:height},()=>Array(width).fill('.'));
    for(const [x,y,lines] of [...wing,...body]) lines.forEach((r,v)=>[...r].forEach((p,u)=>{if(p!=='.'&&rows[y+v]?.[x+u]!==undefined) rows[y+v][x+u]=p;}));
    return rows.map(r=>r.join(''));
  });
  return {palette,rows:frames[0],frames};
}
const wings=[
 [[12,4,['.....oo','....obbo','...obbbo','..obbbso','.obbbso','obbbso','obbso','obso','oso']]],
 [[4,8,['..oooooooo','oobbbbbbbso','obbbbbssso','..ossssso','....oooo']]],
 [[9,13,['obso','obbso','obbbso','.obbbso','..obbbso','...obbbso','....obbbso','.....oooo']]],
];
const birdBody=[[0,10,['..oooo.........oooo','ooddddoo....ooohhhmoo','..odddddoooomhhhegghmo','....odddmmmhhhheehhwmooo','......odmmmmhhhhwwwwhpppo','........odmmmmwwwwmmoooo','..........odmmmmmmmo','............ooooooo']]];
const macaw=bird({...birdPal,h:'#e96342',m:'#b63f42',b:'#368d9d',s:'#24617b',w:'#f8ddb0',p:'#343b3d'},birdBody,wings);
const gull=bird({...birdPal,h:'#faf0d1',m:'#c6d1c5',b:'#d2dcd3',s:'#8babae',w:'#fff9e2',p:'#dcaa53'},birdBody,wings);
const duck=bird({...birdPal,h:'#597c59',m:'#ab8c69',b:'#977f67',s:'#665d58',w:'#d3be9b',p:'#efba66'},birdBody,wings);
const trout=still({o:'#28494f',e:eye,g:white,h:'#b8c9ac',m:'#7b9e91',d:'#45756f',w:'#dce0b7',p:'#bf867b',s:'#374e55'},[
 '..............ooo.....................',
 '.............ommo.....................',
 '............ommmmo....................',
 'oo.......ooommmmmmooooooooo............',
 'ohmoo..oomhhhhhhhhhhhhhhhhmoo..........',
 'ohhhmoomhghhhshhhshhhshhhhegmo.........',
 '.ohhhhmmhhshhhshhhshhhshhheemmoo.......',
 '..ohhhhmmmmpppppppppppppphhhhhmo.......',
 '.ohhhhmmwwwwwwwwwwwwwwwwwwwmmooo.......',
 'ohhhmooommmmmmmmmmmmmmmmmmoo...........',
 'ohmoo.....ooooommmmooooooo.............',
 'oo............ommo....................',
 '...............oo.....................',
], 'tail');
trout.tail=7;
const otter=walk({...mammal,h:'#b79b78',m:'#866e57',d:'#584e43',w:'#dfceb0'},[
 '...........................ooooooo....',
 '.........................oomhhhmmmoo..',
 '........................omhhhheghhwmo.',
 '.....oooooooooooo......omhhhhheewwhmo.',
 '...oomhhhhhhhhhhmmooooomhhhhhhhwwmmeeo',
 'ooomhhhhhhhhhhhhhhhhhhhhhhhhhhwwmmooo.',
 'ommmmmmhhhhhhhhhhhhhhhhhhhhwwwmmoo....',
 '.ooommmmmmmmmmmmmmmmmmmmmmmmmmmo......',
 '....oooooooooommmmmmmmmmmmmmoo........',
],[
 ['...............ommmmo...ommmmo.......','...............oooooo...oooooo.......'],
 ['..............ommmmo.....ommmmo......','..............oooooo.....oooooo......'],
 ['................ommmmo.ommmmo........','................ooooooooooooo........'],
]);
const frog=walk({o:'#294b43',e:eye,g:white,h:'#aed281',m:'#6b9c68',d:'#41775c',w:'#e6d69e'},[
 '...............ooo...ooo.......',
 '..............ohgmo.ohgmo......',
 '..............ohehmohehmo......',
 '............oomhhhhhhhhmmoo....',
 '..........oomhhhhhhhhhhhhmmo...',
 '........oomhhhmmhhmmhhhhhwwmo..',
 '.......omhhmmddddddddmmmwwmmo..',
 '.......ommdddddddddddddmmmoo...',
],[
 ['.....oommmmoo.......oommmmoo...','....ooooooooo......ooooooooo..'],
 ['......oommmmoo.....oommmmoo....','.....ooooooooo....ooooooooo...'],
 ['....oommmmoo.........oommmmoo..','...ooooooooo........ooooooooo.'],
]);
const moth=still({o:'#333850',h:'#78c8e1',m:'#3485b7',d:'#325374',w:'#e3eacb',e:eye},[
 '.ooo..........ooo.','ohhhmoo....oomhhho','ohhwhmmo..ommhwhho','ohhwhhmmeemmhhwhho','.ommhhmmeemmhhmmo.','..oddmmmeemmmddo..','..ohhddmeemddhho..','...ohhho..ohhho...','....ooo....ooo....',
],'wings');
moth.frames=[moth.rows,[
 '.....oo....oo.....','....ohmo..omho....','....ohhmoomhho....','.....ohhmeehho....','......ommeem......','......odmeem......','......ohmeem......','.......o..o.......','..................',
],moth.rows];
moth.animate=undefined;
const rover=walk({o:'#252c3e',e:'#131c2c',g:'#eef4da',h:'#d0d7d4',m:'#919fa7',d:'#5f6c80',w:'#f4d99a',p:'#df9370'},[
 '.....................oooo......','.....................ohho......','.....................oooo......','......................oo.......','.....................oddo......','.........ooooooooooooooo.......','........ohhhggggggggghhho......','.......ohhhggggggggghhhho......','......ohhhhhhhhhhhhhhhho.......','.....ooooooooooooooooooooo.....','....oddddddddddddddddddddo.....','....oddmmmdddmmmdddmmmdddo.....',
],[
 ['....oeehheo.oeehheo.oeehheo....','....oeeheeo.oeeheeo.oeeheeo....','.....ooooo...ooooo...ooooo.....'],
 ['....oeeheeo.oeeheeo.oeeheeo....','....oehhheo.oehhheo.oehhheo....','.....ooooo...ooooo...ooooo.....'],
 ['....oehhheo.oehhheo.oehhheo....','....oeehheo.oeehheo.oeehheo....','.....ooooo...ooooo...ooooo.....'],
]);
const astronaut=walk({o:'#283244',e:'#222e44',g:'#f7f4dc',h:'#d7ded7',m:'#93a8b6',d:'#5c7087',w:'#e7bc77',p:'#d67a63'},[
 '..........ooooooo........','.........ohgggghho.......','........ohgwwwwwhho......','........ohwwwwwwwhho.....','........ohwwweeeewho.....','........ohwweeeeewho.....','.........omwwwwwwmo......','..........ommmmmmo.......','.......ooohhhhhhhho......','......omhhgggghhhhmo.....','......omhhggpphhhhmmo....','......omhhggpphhhhhmmo...','......omhhgggghhhhmmmo...','......omhhgggghhhmoohho..','.......omhhhhhhhmmo.oo...','........ommmmmmmmo.......',
],[
 ['........ommo.ommo........','........ohho.ohho........','........ohho.ohho........','.......ohhho.ohhho.......','.......ooooo.ooooo.......'],
 ['.......ommo...ommo.......','......ohho.....ohho......','.....ohho.......ohho.....','....ohhho.......ohhho....','....ooooo.......ooooo....'],
 ['.........ommoommo........','.........ohhoohho........','.........ohhoohho........','........ohhhoohhho.......','........oooooooooo.......'],
]);
const dolphin=still({o:'#2b5466',e:eye,g:white,h:'#a4cbd0',m:'#699cac',d:'#407587',w:'#d4e3d7'},[
 '........................ooo....................',
 '.......................ommo....................',
 '......................ommmo....................',
 '..................oooommmmoooooooo.............',
 '...............ooomhhhhhhhhhhhhhhmmo...........',
 '.....oo......oomhhhhhhhhhhhhhhheghhmmoo.........',
 '....ommoo..oomhhhhhhhhhhhhhhhhheehhhhhmmooooo...',
 'oo..ommmmmmmhhhhhhhhhhhhhhhhhhhwwwwwwhhhmmmmooo.',
 'ommoommmmmmmhhhhhhhhhhhhhhhhwwwwwwwwwwmmmooooo..',
 '.ommmmmmmmmmmmmmmmmmmwwwwwwwwwwwwwwmmmoo........',
 '..oommmmmoooommmmmmmmmmmmmmmmmmmmmmoo...........',
 '....oooo......ooooooooommmmooooooo.............',
 '.......................ommmmo..................',
 '........................ommo...................',
], 'tail'); dolphin.tail=10;

const smallFeet=[
 ['.............ommo....ommo........','............ommmmo..ommmmo.......','............oooooo..oooooo.......'],
 ['............ommo......ommo.......','...........ommmmo......ommmmo.....','...........oooooo......oooooo.....'],
 ['..............ommo..ommo.........','..............ommmoommmmo........','..............oooooooooo........'],
];
const hare=walk({...mammal,h:'#e6e7d5',m:'#b5c7c5',d:'#879ca8',w:'#fff5dd',o:'#536d7e'},[
 '..................oo....oo.......',
 '.................ohmo..ohmo......',
 '.................ohpmo.ohpmo.....',
 '.................ohpmo.ohpmo.....',
 '.................ohpmo.ohpmo.....',
 '..................ohhmohhmo......',
 '..................ohhhhhhmoo.....',
 '.................ohhhheghhmo.....',
 '..........ooooooohhhhheehhwmoo...',
 '........oomhhhhhhhhhhhhhhwwmeeo..',
 '..oo...omhhhhhhhhhhhhhhhwwwmoo...',
 '.ohhooomhhhhhhhhhmmhhhhwwwmoo....',
 '..ommmmhhhhhhhhmmmmhhhwwwmo......',
 '...ommhhhhhhmmmmmmmhhwwwmo.......',
 '....ommmhhhhmmmmmmmmmmmmo........',
 '......ommmmmmmmmmmmmmoo..........',
],smallFeet);
const suslik=walk({...mammal,h:'#c8b285',m:'#9f885f',d:'#72664b',w:'#e8dbb0'},[
 '.......................oo.......',
 '......................ohmo......',
 '.....................ohhhmoo....',
 '.........oooooooooooomhheghhmo...',
 '.......oomhhhhhhhhhhhhhheehwmoo..',
 '..oo..omhhhhhhhhhhhhhhhhhhwwmeeo.',
 '.ommoommmhhhhhhmmhhhhhhhhhwwmoo..',
 '..ommmmmmmhhhhmmmmmmhhhhwwwmo....',
 '....ooooommmmmmmmmmmmmmmmmmo....',
],smallFeet);
const groundBird=walk({...birdPal,h:'#c5ae7d',m:'#96805c',d:'#6c6650',s:'#525c4e'},[
 '.....................oooo.......',
 '...................oomhhmoo.....',
 '..................omhheghhmooo..',
 '..................omhheehhhpppo.',
 '..................omhhhhmooooo..',
 '..........oooooooomhhhhmo.......',
 '.......ooomhhhhhhhhhhhhmo.......',
 '....ooomhhshhhshhhhhhhhwmo......',
 '..oomhhshhshhshhhhhhhwwwmo......',
 '.ommhhshhshhshhhhhwwwmmmo.......',
 '..ommmmmmmmmmmmmmmmmmoo.........',
 '....oooooooooommmmooo...........',
],[
 ['..............oppo..oppo........','..............oppo..oppo........','.............opppo.opppo........'],
 ['.............oppo....oppo.......','............oppo......oppo......','...........opppo......opppo.....'],
 ['...............oppooppo.........','................oppppo..........','...............opppppo..........'],
]);
const saiga=walk({...mammal,h:'#d9c18c',m:'#a58c60',d:'#78684e',w:'#f0dfb7'},[
 '.................................o...o.........',
 '................................omo.omo........',
 '................................omo.omo........',
 '................................omo.omo........',
 '.................................omommo........',
 '............................oo..omhhhmmoo......',
 '...........................ohmoomhheghhhmo.....',
 '............................ohhhhhheehhhmmoo...',
 '.....oo.....................ohhhhhhhhhhmmhmoo..',
 '.....omoo....ooooooooooooooomhhhhhhhhhhmmhhmoo.',
 '......ommmooomhhhhhhhhhhhhhhhhhhwwhhhhhmmhheeoo',
 '.......ommmhhhhhhhhhhhhhhhhhhhhwwwwhhhhhmmmmeeo',
 '.......ommmhhhhhhhmmmmhhhhhhhhwwwmmmhhhhhmmmmmo',
 '.......ommmhhhhhhhhhhhhhhhhhwwwwmmmmmmmmmmmooo.',
 '........ommmmmhhhhhhhhhhmmmmmmmmo...ooooooo....',
 '.........ommmmmmmmmmmmmmmmmmmmmo...............',
 '..........ommmmoo.......ommmmo.................',
],deer.frames.map(f=>f.slice(-5)));
const gecko=walk({o:'#405746',e:eye,g:white,h:'#c5c38a',m:'#939e70',d:'#637c65',w:'#e8d9a6',s:'#bbaa77'},[
 '.......................oooo.....','.....................oomhhmoo...','....................omhheghhmo..','..ooo....ooooooooooomhhheehhwo..','.ommmmooomhhhhhhhhhhhhhhhhwwmmoo','..ooommmmmmmmsssssmmhhhhwwwmmoo.','......oooooommmmmmmmmmmmmmoo....',
],[
 ['.............ommo.....ommo.......','............ommo.......ommo......','...........ooooo.......ooooo.....'],
 ['..............ommo...ommo........','...............ommo.ommo.........','...............ooooooooo.........'],
 ['............ommo.......ommo......','...........ommo.........ommo.....','..........ooooo.........ooooo....'],
]);
const crane=bird({...birdPal,h:'#d3d2bb',m:'#a0aaa1',b:'#bbc4ba',s:'#697c7c',w:'#efedd4',p:'#687b73'},[
 [6,12,['..oooooooooooo','oomhhhhhhhhhmmmo','ommmmhhhhwwwwmmo','..ommmmmmmmmmmo','....oooooooooo']],
 [19,12,['oowwmo','omwwmmo','ommmmmo']],
 [23,5,['....oooo','...omhhmo','..omhhmo','..omhhmo','...omhhmo','....omhhmo','.....omhhmo','....omhhmo','..oomhhmo']],
 [27,3,['..oooo','oomhegmooo','omheehhpppppo','..oooooo']],
 [8,17,['....ooooooo','ooooo..oooo']],
 [0,18,['ooooooo..oooo','.......oo....ooooooo']],
],wings);
const octopus=walk({o:'#69475b',h:'#dd956e',m:'#b16c68',d:'#895167',w:'#eed3a1',e:eye,g:white},[
 '......oooooo......','....oomhhhhmoo....','...omhhhhhghhmo...','..omhhhhhhhhhhmo..','..omhheghhgehhmo..','..ommheeheehmmmo..','...ommmmmmmmmo....',
],[
 ['..ommommmmmommo...','.ommo.ommo..ommo..','ommo..ommo...ommo.','ommmoo.ommo.oommmo','.oooo...oo...oooo.'],
 ['..ommmmmmmmmmmmo..','..ommo.ommo.ommo..','.ommo..ommo..ommo.','oommo..ommo..ommoo','ooooo...ooo...oooo'],
 ['..ommommmmmommo...','.ommo..ommo..ommo.','ommo...ommo...ommo','ommoo.oommoo.oommo','.oooo..oooo..oooo.'],
]);

// Small coastal fish are drawn at their native size, rather than shrinking
// the larger trout art. Their thin bodies leave room for the shoreline.
const coastalFish=still({o:'#295f70',e:eye,g:'#e0f0d7',h:'#add8cf',m:'#76b4b3',d:'#427f8e',w:'#d8e6c5'},[
 '...........oo...........',
 '..........ommo..........',
 'oo.....ooommmmmoooo.....',
 'ohmoo.omhghhhhhhhhgmmo..',
 '.ohhmmhhhhhhhhhhhheemmo.',
 '..ommmwwwwwwwwwwwwmmmo..',
 '.ohmo.ooommmmmmmoooo....',
 'ohmo.......ommo.........',
 'oo..........oo..........',
], 'tail');
coastalFish.tail=4;
const robin=walk({o:'#354743',e:eye,g:'#ffefce',h:'#d69d6f',m:'#8d7f66',d:'#596356',w:'#e9d5ac',b:'#d57f59'},[
 '...........oooo.......',
 '.........oomhhmoo.....',
 '........omhhegghmo....',
 '........omhheehhhmooo.',
 '.......ommhhbbbhmooo..',
 'oo....ommmhbbbbhhmo...',
 'omoooommmmbbbbwhhmo...',
 '.ommmmmmmmmbbwwhmo....',
 '..oommmmmmmwwwwmo.....',
 '....ooommmmmmmmo......',
 '.......oooooooo.......',
],[
 ['.........omo.omo......','.........omo.omo......','........oooo.oooo.....'],
 ['........omo...omo.....','.......omo.....omo....','......oooo....oooo....'],
 ['..........omomo.......','...........omo........','..........oooo........'],
]);

export const BIOME_SPRITES={
 deer,fox,squirrel,robin,woodlandHare:recolor(hare,{o:'#3b5148',h:'#c8b28c',m:'#9d896d',d:'#746e59',w:'#e8d8b1',g:'#f5e4bd'}),macaw,frog,morpho:moth,
 woodpecker:recolor(macaw,{h:'#e15e51',m:'#35474c',b:'#485953',s:'#263c40',w:'#e7dfbb'}),
 arcticFox:recolor(fox,{h:'#f1ead9',m:'#c4d3d0',d:'#94acb4',w:'#fffae4',o:'#627887'}),
 caribou:recolor(deer,{h:'#c0b29d',m:'#897d73',d:'#656568',w:'#e6e1ce',o:'#475461'}),
  ptarmigan:recolor(groundBird,{h:'#f3ead6',m:'#cfd3c7',d:'#a3b5b9',s:'#bbc7bd',w:'#fff8de',p:'#647983'}),
  hare,saiga,suslik,bustard:groundBird,
  crane,
 trout,perch:recolor(trout,{h:'#b6bc70',m:'#7e9d60',d:'#507448',p:'#dca266',s:'#455e41'}),
 otter,kingfisher:recolor(macaw,{h:'#df9851',m:'#b87c48',b:'#54bac2',s:'#277e9b',w:'#f4e6c1'}),duck,
 dragonfly:still({o:'#315860',h:'#ccdec8',m:'#84b7af',e:'#416c74'},['........h.....h.........','.......hhh...hhh........','...hhhhhhhmeemhhhhhhh...','....hhhhhmeeemhhhhh.....','..........meem..........','.........m..m...........','........m....m..........'],'wings'),
 gull,dolphin,mullet:coastalFish,
  octopus,
 seaStar:still({o:'#a06457',h:'#e9ba83',m:'#d18c68',w:'#f4d7a0'},['.......o.......','......ohho.....','......ohho.....','.....ohmhho....','ooo..ohmhho..oo','ohhhohmmmhhohho','.ohhmmwmmmhho..','..ohhmmmhhho...','...ohmmmhho....','..ohhhohhho....','.ohho..ohhho...','.ooo....oooo...']),
  gecko,
 rover,astronaut,
 hopper:recolor(rover,{h:'#dcb577',m:'#ab8863',d:'#765b55',w:'#edd4a0',p:'#6bcebd'}),
};

const rec=(label,habitats,motion='crawl',speed=6,role=motion==='fly'?'flyer':'ground')=>({label,habitats,motion,speed,role});
const MED=['med-cove','med-islands','med-harbour','med-terraces'];
const COAST=[...MED,'trop-beach','trop-atoll'];
export const BIOME_SPECIES={
 macaw:rec('Scarlet macaw',['jungle'],'fly',14), frog:rec('Tree frog',['jungle'],'hop',4), morpho:rec('Blue morpho',['jungle'],'fly',5),
 deer:rec('Red deer',['forest'],'walk',6,'visitor'), fox:rec('Red fox',['forest'],'walk',7,'visitor'), squirrel:rec('Red squirrel',['forest'],'hop',6), woodlandHare:rec('Brown hare',['forest'],'hop',7), robin:rec('European robin',['forest'],'hop',5), woodpecker:rec('Woodpecker',['forest'],'fly',13),
  arcticFox:rec('Arctic fox',['tundra'],'walk',6,'visitor'), caribou:rec('Caribou',['tundra'],'walk',5,'visitor'), hare:rec('Mountain hare',['tundra'],'hop',7), ptarmigan:rec('Ptarmigan',['tundra'],'walk',4),
 saiga:rec('Saiga',['steppe'],'walk',6,'visitor'), suslik:rec('Ground squirrel',['steppe'],'crawl',4), bustard:rec('Great bustard',['steppe'],'walk',4), crane:rec('Demoiselle crane',['steppe'],'fly',12),
 trout:rec('Brown trout',['river'],'swim',9,'swimmer'), perch:rec('River perch',['river'],'swim',7,'swimmer'), otter:rec('Otter',['river'],'swim',8,'visitor'), kingfisher:rec('Kingfisher',['river'],'fly',16), duck:rec('Mallard',['river'],'surface',6,'swimmer'), dragonfly:rec('Dragonfly',['river',...COAST],'fly',6),
 gull:rec('Yellow-legged gull',COAST,'fly',13), mullet:rec('Grey mullet',COAST,'swim',10,'swimmer'), dolphin:rec('Bottlenose dolphin',COAST,'swim',13,'visitor'), octopus:rec('Common octopus',COAST,'bottom',2,'swimmer'), seaStar:rec('Sea star',COAST,'bottom',0.2,'swimmer'), gecko:rec('Wall gecko',['med-terraces'],'crawl',3),
 rover:rec('Survey rover',['moon'],'crawl',3), hopper:rec('Cargo rover',['moon'],'crawl',2), astronaut:rec('Astronaut',['moon'],'walk',3,'visitor'),
};
