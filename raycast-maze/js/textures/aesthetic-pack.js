(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const surface = (width, height, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    draw(context, width, height);
    return canvas;
  };

  const hash = (x, y, seed = 0) => {
    let value = Math.imul(x + seed * 43, 374761393) ^
      Math.imul(y - seed * 31, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967295;
  };

  const tile = (palette, seed, detail) =>
    surface(64, 64, context => {
      context.fillStyle = palette.gap;
      context.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 16) {
        for (let x = 0; x < 64; x += 16) {
          const value = hash(x, y, seed);
          context.fillStyle = (x + y) / 16 % 2 ? palette.a : palette.b;
          context.fillRect(x + 1, y + 1, 14, 14);
          context.fillStyle = palette.hi;
          context.fillRect(x + 2, y + 2, 12, 2);
          context.fillStyle = palette.lo;
          context.fillRect(x + 2, y + 13, 12, 2);
          if (detail) detail(context, x, y, value);
        }
      }
    });

  const makeStainedGlass = () => surface(64, 64, context => {
    context.fillStyle = '#17151c';
    context.fillRect(0, 0, 64, 64);
    const colors = ['#c94d4a', '#3f8fc1', '#e2b84f', '#4ea36f'];
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        context.fillStyle = colors[(x / 16 + y / 16) % colors.length];
        context.beginPath();
        context.moveTo(x + 2, y + 2);
        context.lineTo(x + 14, y + 5);
        context.lineTo(x + 11, y + 14);
        context.lineTo(x + 3, y + 12);
        context.closePath();
        context.fill();
      }
    }
  });

  function makeWalls() {
    return {
      frutiger: surface(64, 64, context => {
        const gradient = context.createLinearGradient(0, 0, 0, 64);
        gradient.addColorStop(0, '#72d5e5');
        gradient.addColorStop(0.58, '#2f9ec0');
        gradient.addColorStop(0.6, '#75bd55');
        gradient.addColorStop(1, '#2f773e');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
        context.strokeStyle = 'rgba(230, 255, 255, .8)';
        for (let i = 0; i < 13; i += 1) {
          context.beginPath();
          context.arc(hash(i, 2, 1) * 64, hash(3, i, 2) * 38,
            2 + hash(i, 4, 3) * 6, 0, Math.PI * 2);
          context.stroke();
        }
        context.fillStyle = 'rgba(255,255,255,.55)';
        context.fillRect(4, 5, 55, 3);
      }),
      psx: tile({
        gap: '#0b0810', a: '#392d3d', b: '#2b2433', hi: '#64516b', lo: '#15101a',
      }, 42, (context, x, y, value) => {
        context.fillStyle = value > 0.5 ? '#6a3e5c' : '#334e55';
        context.fillRect(x + 4, y + 5, 3, 3);
        context.fillRect(x + 10, y + 10, 2, 2);
      }),
      stainedglass: makeStainedGlass(),
      nouveau: surface(64, 64, context => {
        context.fillStyle = '#365541';
        context.fillRect(0, 0, 64, 64);
        context.strokeStyle = '#d4ad68';
        context.lineWidth = 2;
        for (let x = 6; x < 64; x += 15) {
          context.beginPath();
          context.moveTo(x, 64);
          context.bezierCurveTo(x + 17, 43, x - 12, 24, x + 7, 0);
          context.stroke();
        }
        context.fillStyle = '#bb6b63';
        for (let y = 9; y < 64; y += 18) {
          context.beginPath();
          context.arc(15 + y % 27, y, 5, 0, Math.PI * 2);
          context.fill();
        }
      }),
      solarpunk: tile({
        gap: '#e7e4d6', a: '#d9eee4', b: '#b8d9c5', hi: '#ffffff', lo: '#6f9b7c',
      }, 45, (context, x, y, value) => {
        context.fillStyle = value > 0.5 ? '#f0bd45' : '#4c9f65';
        context.beginPath();
        context.ellipse(x + 8, y + 8, 5, 2, value * Math.PI, 0, Math.PI * 2);
        context.fill();
      }),
      diesel: tile({
        gap: '#111316', a: '#3c4143', b: '#2c3032', hi: '#6f7675', lo: '#17191a',
      }, 46, (context, x, y, value) => {
        context.fillStyle = '#b6ad91';
        context.fillRect(x + 3, y + 3, 2, 2);
        context.fillRect(x + 11, y + 11, 2, 2);
        context.fillStyle = value > 0.5 ? '#b4482d' : '#846e34';
        context.fillRect(x + 6, y + 7, 5, 3);
      }),
      prehistoric: surface(64, 64, context => {
        context.fillStyle = '#45372a';
        context.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 50; i += 1) {
          context.fillStyle = i % 3 ? '#594839' : '#32281f';
          context.fillRect(hash(i, 2, 47) * 62, hash(3, i, 48) * 62, 3, 2);
        }
        context.strokeStyle = '#be7a45';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(8, 43);
        context.lineTo(17, 24);
        context.lineTo(28, 39);
        context.lineTo(39, 20);
        context.lineTo(53, 42);
        context.stroke();
        context.beginPath();
        context.arc(18, 16, 6, 0, Math.PI * 2);
        context.stroke();
      }),
      celtic: tile({
        gap: '#1f2b24', a: '#526657', b: '#465749', hi: '#748776', lo: '#27372d',
      }, 48, (context, x, y) => {
        context.strokeStyle = '#b7a965';
        context.beginPath();
        context.arc(x + 8, y + 8, 5, 0, Math.PI * 2);
        context.moveTo(x + 3, y + 8);
        context.lineTo(x + 13, y + 8);
        context.stroke();
      }),
      brutalist: tile({
        gap: '#303438', a: '#73777a', b: '#666b6e', hi: '#909496', lo: '#44484a',
      }, 49, (context, x, y, value) => {
        context.fillStyle = value > 0.65 ? '#4f5f53' : '#3b3f42';
        context.fillRect(x + 5, y + 7, 6, 2);
      }),
      storybook: surface(64, 64, context => {
        context.fillStyle = '#d5c49f';
        context.fillRect(0, 0, 64, 64);
        context.strokeStyle = '#44362a';
        context.lineWidth = 1;
        for (let y = 5; y < 64; y += 7) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(64, y + 5);
          context.stroke();
        }
        context.fillStyle = '#704334';
        for (let shelf = 0; shelf < 3; shelf += 1) {
          const y = 17 + shelf * 20;
          context.fillRect(0, y, 64, 3);
          for (let x = 3; x < 62; x += 8) context.fillRect(x, y - 12, 5, 12);
        }
      }),
    };
  }

  function makeFloors() {
    return {
      aqua: tile({
        gap:'#177da0', a:'#48b9ce', b:'#36a6c1', hi:'#a7edf0', lo:'#146b8a',
      }, 51, (context,x,y,value) => {
        context.fillStyle = value > .5 ? '#87cf66' : '#e4f6e7';
        context.fillRect(x + 6, y + 6, 5, 5);
      }),
      psx: tile({
        gap:'#0d0911', a:'#403246', b:'#30283a', hi:'#66546d', lo:'#17121c',
      }, 52, (context,x,y,value) => {
        context.fillStyle = value > .5 ? '#70405d' : '#36515c';
        context.fillRect(x + 4, y + 4, 2, 2);
        context.fillRect(x + 10, y + 10, 2, 2);
      }),
      prism: tile({
        gap:'#1a1720', a:'#be514f', b:'#3f86b1', hi:'#f0d96f', lo:'#27212d',
      }, 53),
      floralMosaic: tile({
        gap:'#735c48', a:'#c7b985', b:'#78906f', hi:'#eadcb1', lo:'#63523e',
      }, 54, (context,x,y) => {
        context.fillStyle = '#aa625e';
        context.beginPath();
        context.arc(x + 8, y + 8, 4, 0, Math.PI * 2);
        context.fill();
      }),
      solar: tile({
        gap:'#5d7d66', a:'#d7e7da', b:'#bad3bd', hi:'#ffffff', lo:'#789c7e',
      }, 55, (context,x,y,value) => {
        context.fillStyle = value > .5 ? '#e8bd42' : '#479665';
        context.fillRect(x + 3, y + 7, 10, 2);
      }),
      steel: tile({
        gap:'#141719', a:'#3e4446', b:'#303537', hi:'#707778', lo:'#181b1d',
      }, 56, (context,x,y) => {
        context.fillStyle = '#a24a31';
        context.fillRect(x + 4, y + 7, 8, 3);
      }),
      cave: surface(64,64,context => {
        context.fillStyle = '#352a20';
        context.fillRect(0,0,64,64);
        for (let i=0;i<70;i+=1) {
          context.fillStyle = i%4 ? '#4d3d2f' : '#705139';
          context.fillRect(hash(i,1,57)*63, hash(2,i,58)*63, 2, 2);
        }
      }),
      celtic: tile({
        gap:'#26352b', a:'#5a6b5d', b:'#4b5d50', hi:'#77897a', lo:'#2d3d32',
      }, 58, (context,x,y) => {
        context.strokeStyle='#b6a663';
        context.beginPath();
        context.moveTo(x+3,y+8); context.lineTo(x+8,y+3);
        context.lineTo(x+13,y+8); context.lineTo(x+8,y+13);
        context.closePath(); context.stroke();
      }),
      concrete: tile({
        gap:'#33373a', a:'#707477', b:'#62676a', hi:'#8d9192', lo:'#45494b',
      }, 59),
      paper: surface(64,64,context => {
        context.fillStyle='#d8c8a8'; context.fillRect(0,0,64,64);
        context.strokeStyle='rgba(65,49,37,.35)';
        for (let y=3;y<64;y+=6) {
          context.beginPath(); context.moveTo(0,y); context.lineTo(64,y+4); context.stroke();
        }
        context.strokeStyle='#7a4b39';
        context.strokeRect(3,3,58,58);
      }),
    };
  }

  function makeCeilings() {
    return {
      blueSky: surface(64,64,context => {
        context.fillStyle='#55b9da'; context.fillRect(0,0,64,64);
        context.fillStyle='rgba(245,255,255,.82)';
        context.beginPath();
        context.arc(16,20,8,0,Math.PI*2);
        context.arc(26,17,11,0,Math.PI*2);
        context.arc(38,21,8,0,Math.PI*2);
        context.fill();
      }),
      static: surface(64,64,context => {
        context.fillStyle='#15101a'; context.fillRect(0,0,64,64);
        for (let y=0;y<64;y+=2) {
          for (let x=0;x<64;x+=2) {
            const value=hash(x,y,61);
            context.fillStyle=value>.7?'#72536c':value>.35?'#342b40':'#1e1826';
            context.fillRect(x,y,2,2);
          }
        }
      }),
      stainedglass: makeStainedGlass(),
      nouveau: surface(64,64,context => {
        context.fillStyle='#294536'; context.fillRect(0,0,64,64);
        context.strokeStyle='#d4ad68'; context.lineWidth=2;
        for (let i=0;i<7;i+=1) {
          context.beginPath();
          context.arc(32,32,5+i*4, i*.45, i*.45+Math.PI*1.3);
          context.stroke();
        }
      }),
      canopySky: surface(64,64,context => {
        context.fillStyle='#6bc1ce'; context.fillRect(0,0,64,64);
        for (let i=0;i<34;i+=1) {
          context.fillStyle=i%3?'#4e9b5c':'#8bcf68';
          context.beginPath();
          context.ellipse(hash(i,2,62)*64,hash(3,i,63)*64,8,4,hash(i,4,64)*Math.PI,0,Math.PI*2);
          context.fill();
        }
      }),
      diesel: tile({
        gap:'#111416',a:'#34393b',b:'#292d30',hi:'#62696a',lo:'#151718',
      },65,(context,x,y) => {
        context.fillStyle='#b38d43'; context.fillRect(x+5,y+6,6,3);
      }),
      cave: surface(64,64,context => {
        context.fillStyle='#241c16';context.fillRect(0,0,64,64);
        context.fillStyle='#4a3829';
        for(let i=0;i<20;i+=1){
          context.beginPath();
          context.moveTo(hash(i,1,66)*64,0);
          context.lineTo(hash(i,1,66)*64-4,8+hash(i,2,67)*14);
          context.lineTo(hash(i,1,66)*64+4,0);
          context.fill();
        }
      }),
      celtic: tile({
        gap:'#1a271f',a:'#3e5545',b:'#32483a',hi:'#627765',lo:'#202e26',
      },68),
      concrete: tile({
        gap:'#2d3134',a:'#64686b',b:'#585d60',hi:'#85898a',lo:'#3c4042',
      },69,(context,x,y,value) => {
        if(value>.65){context.fillStyle='#aeb7aa';context.fillRect(x+4,y+6,8,3);}
      }),
      storybook: surface(64,64,context => {
        context.fillStyle='#cbb992';context.fillRect(0,0,64,64);
        context.strokeStyle='#49382b';
        for(let x=4;x<64;x+=10){
          context.beginPath();context.moveTo(x,0);context.lineTo(x+17,64);context.stroke();
        }
        context.fillStyle='#72503b';context.fillRect(0,29,64,5);
      }),
    };
  }

  const HUMANOIDS = {
    aquaBot:['#e7f5eb','#2f9db8','#79d7d2'],
    glassKnight:['#8ccbd2','#345d77','#f0d76b'],
    vineNymph:['#59915d','#31593d','#d5a96a'],
    sunDrone:['#e4eadc','#4a9b66','#e6bb43'],
    dieselTrooper:['#625d52','#292b2c','#b3843f'],
    maintenanceBot:['#7c8282','#3f494a','#d0b34b'],
    paperKnight:['#d5c49f','#4e3a2c','#9a4a38'],
  };

  function drawHumanoid(context, type, frame) {
    const [body,dark,accent]=HUMANOIDS[type];
    const bob=frame%2, swing=frame<2?-2:2;
    context.fillStyle=body;
    context.fillRect(17,7-bob,14,13);
    context.fillRect(14,20-bob,20,17);
    context.fillRect(10+swing,21-bob,5,16);
    context.fillRect(33-swing,21-bob,5,16);
    context.fillRect(17-swing,36-bob,6,11);
    context.fillRect(26+swing,36-bob,6,11);
    context.fillStyle=dark;
    context.fillRect(19,12-bob,4,3);
    context.fillRect(27,12-bob,4,3);
    context.fillStyle=accent;
    context.fillRect(18,25-bob,13,3);
    if(type==='glassKnight'||type==='paperKnight'){
      context.fillRect(16,4-bob,17,4);
      context.fillRect(35-swing,18-bob,3,24);
    }else if(type==='vineNymph'){
      context.strokeStyle=accent;context.lineWidth=2;
      context.beginPath();context.moveTo(15,36);context.bezierCurveTo(6,25,22,15,10,4);context.stroke();
    }else if(type==='sunDrone'||type==='aquaBot'||type==='maintenanceBot'){
      context.fillRect(21,11-bob,8,4);
    }else if(type==='dieselTrooper'){
      context.fillRect(14,5-bob,21,4);
      context.fillRect(8+swing,20-bob,3,22);
    }
  }

  const FLYING={
    staticWraith:['#3d3145','#7b526e','#b38ca8'],
    prismMoth:['#4e9fc0','#d95f65','#f2d96b'],
    moth:['#a88669','#73564a','#d5c39a'],
    butterfly:['#e4a843','#4b9c78','#d95d64'],
    propellerDrone:['#62696b','#24292b','#d18b38'],
    pterodactyl:['#8b6649','#503b2e','#c19764'],
    banshee:['rgba(200,221,214,.8)','#657b7a','#e6f2e9'],
    pigeon:['#7f858a','#4a5260','#b6c0bd'],
    quillSpirit:['rgba(211,199,165,.86)','#6b4b39','#e3d6ad'],
  };

  function drawFlying(context,type,frame){
    const [wing,body,accent]=FLYING[type];
    const bob=frame%2, flap=frame<2?0:6;
    context.fillStyle=wing;
    context.beginPath();
    context.moveTo(24,23-bob);
    context.lineTo(4,10+flap);
    context.lineTo(10,31-flap);
    context.lineTo(24,29-bob);
    context.lineTo(38,31-flap);
    context.lineTo(44,10+flap);
    context.closePath();context.fill();
    context.fillStyle=body;
    context.beginPath();context.ellipse(24,24-bob,7,11,0,0,Math.PI*2);context.fill();
    context.fillStyle=accent;context.fillRect(21,19-bob,7,3);
    if(type==='propellerDrone'){
      context.fillRect(4,9+flap,40,2);
    }else if(type==='pterodactyl'){
      context.beginPath();context.moveTo(27,16-bob);context.lineTo(40,10-bob);context.lineTo(31,22-bob);context.fill();
    }else if(type==='quillSpirit'){
      context.strokeStyle=accent;context.lineWidth=2;
      context.beginPath();context.moveTo(24,31-bob);context.quadraticCurveTo(15,39,28,47);context.stroke();
    }
  }

  const ANIMALS={
    polygonHound:['#75546d','#332b3b','#a46b82'],
    fox:['#c56b38','#563323','#e2ad72'],
    capybara:['#95694a','#5e4536','#c39a6c'],
    mammoth:['#685548','#3c302a','#b7a083'],
    stag:['#865f3f','#4c382a','#d2b27a'],
    strayDog:['#86705b','#4d453b','#b6a083'],
    inkFox:['#4a382c','#1e1a17','#a9513e'],
  };

  function drawAnimal(context,type,frame){
    const [body,dark,light]=ANIMALS[type];
    const bob=frame%2,step=frame<2?0:3;
    context.fillStyle=body;
    context.fillRect(8,21-bob,29,14);
    context.fillRect(31,16-bob,11,14);
    context.fillRect(11+step,34-bob,5,12);
    context.fillRect(28-step,34-bob,5,12);
    context.fillStyle=dark;context.fillRect(37,20-bob,2,2);
    context.strokeStyle=dark;context.lineWidth=3;
    context.beginPath();context.moveTo(9,24-bob);context.quadraticCurveTo(-2,15+step,3,38);context.stroke();
    if(type==='mammoth'){
      context.strokeStyle=body;context.lineWidth=5;
      context.beginPath();context.moveTo(40,23-bob);context.quadraticCurveTo(46,33,40,42);context.stroke();
      context.fillStyle=light;context.beginPath();context.moveTo(34,28);context.lineTo(38,39);context.lineTo(31,31);context.fill();
    }else if(type==='stag'){
      context.strokeStyle=light;context.lineWidth=2;
      context.beginPath();context.moveTo(35,17-bob);context.lineTo(31,7-bob);context.moveTo(36,15-bob);context.lineTo(42,5-bob);context.stroke();
    }else if(type==='fox'||type==='inkFox'){
      context.fillStyle=light;context.beginPath();context.moveTo(32,18-bob);context.lineTo(34,10-bob);context.lineTo(39,18-bob);context.fill();
    }
  }

  function makeCreatureFrame(type,frame){
    return surface(48,48,context=>{
      context.clearRect(0,0,48,48);
      if(HUMANOIDS[type]){drawHumanoid(context,type,frame);return;}
      if(FLYING[type]){drawFlying(context,type,frame);return;}
      if(ANIMALS[type]){drawAnimal(context,type,frame);return;}
      const bob=frame%2,flap=frame<2?0:4;
      if(type==='bubbleling'){
        context.fillStyle='rgba(146,231,236,.55)';
        context.beginPath();context.arc(24,24-bob,14,0,Math.PI*2);context.fill();
        context.strokeStyle='#d9ffff';context.lineWidth=2;context.stroke();
        context.fillStyle='#225e76';context.fillRect(18,21-bob,3,3);context.fillRect(28,21-bob,3,3);
      }else if(type==='dolphin'){
        context.fillStyle='#579bb4';context.beginPath();context.ellipse(24,25-bob,16,7,0,0,Math.PI*2);context.fill();
        context.beginPath();context.moveTo(9,25-bob);context.lineTo(2,16+flap);context.lineTo(3,33-flap);context.fill();
        context.fillStyle='#e3f0ec';context.fillRect(34,22-bob,3,2);
      }else if(type==='frog'){
        context.fillStyle='#58a75b';context.fillRect(11,22-bob,27,15);
        context.beginPath();context.arc(17,20-bob,7,0,Math.PI*2);context.arc(32,20-bob,7,0,Math.PI*2);context.fill();
        context.fillStyle='#202923';context.fillRect(16,17-bob,3,3);context.fillRect(31,17-bob,3,3);
      }else if(type==='lowPolyRat'){
        context.fillStyle='#76566f';context.beginPath();context.moveTo(8,31);context.lineTo(18,18-bob);context.lineTo(39,25-bob);context.lineTo(33,37);context.closePath();context.fill();
        context.strokeStyle='#b07a99';context.beginPath();context.moveTo(10,29);context.lineTo(2,20+flap);context.stroke();
      }else if(type==='glassGolem'){
        context.fillStyle='rgba(94,190,205,.75)';context.fillRect(13,13-bob,22,25);context.fillRect(8,19-bob,8,18);context.fillRect(33,19-bob,8,18);
        context.fillStyle='#e9fbdd';context.fillRect(18,19-bob,4,4);context.fillRect(28,19-bob,4,4);
      }else if(type==='sootGremlin'){
        context.fillStyle='#292a2b';context.beginPath();context.arc(24,25-bob,13,0,Math.PI*2);context.fill();
        context.fillStyle='#e18b3b';context.fillRect(16,21-bob,4,4);context.fillRect(29,21-bob,4,4);
      }else if(type==='raptor'){
        context.fillStyle='#76914d';context.fillRect(12,19-bob,25,13);context.fillRect(32,14-bob,10,11);
        context.strokeStyle='#4b6036';context.lineWidth=4;context.beginPath();context.moveTo(13,25-bob);context.lineTo(2,35);context.stroke();
        context.fillStyle='#d7c65f';context.fillRect(38,17-bob,2,2);
      }else if(type==='caveBeetle'){
        context.fillStyle='#5b3529';context.beginPath();context.ellipse(24,26-bob,11,14,0,0,Math.PI*2);context.fill();
        context.strokeStyle='#d08b49';context.beginPath();context.moveTo(24,13-bob);context.lineTo(24,40-bob);context.stroke();
      }else if(type==='bookworm'){
        context.strokeStyle='#739357';context.lineWidth=8;context.beginPath();context.moveTo(5,34);context.bezierCurveTo(14,16+flap,27,44-flap,42,22-bob);context.stroke();
        context.fillStyle='#f0dd8c';context.fillRect(38,18-bob,3,3);
      }
    });
  }

  const RELICS={
    aquaOrb:['#83e6e4','#247e9b'],
    polygonKey:['#a76d91','#392c45'],
    prismShard:['#8ed8e0','#d55c67'],
    nouveauBrooch:['#d4ac68','#5e845e'],
    solarSeed:['#e5bc43','#4b9a63'],
    dieselBadge:['#b68a3e','#34373a'],
    amberFossil:['#d68a3d','#6f4126'],
    celticKnot:['#ad9d5d','#395344'],
    metroToken:['#9fa4a4','#404649'],
    inkQuill:['#d1bf9b','#49372a'],
  };

  function makeRelic(type){
    return surface(32,32,context=>{
      const [primary,secondary]=RELICS[type];
      context.clearRect(0,0,32,32);
      context.fillStyle='rgba(255,228,140,.14)';
      context.beginPath();context.arc(16,16,14,0,Math.PI*2);context.fill();
      context.fillStyle=primary;context.strokeStyle=secondary;context.lineWidth=2;
      if(type==='aquaOrb'){
        context.beginPath();context.arc(16,16,10,0,Math.PI*2);context.fill();context.stroke();
        context.fillStyle='#e8ffff';context.beginPath();context.arc(12,11,3,0,Math.PI*2);context.fill();
      }else if(type==='polygonKey'){
        context.beginPath();context.moveTo(6,8);context.lineTo(14,4);context.lineTo(19,10);context.lineTo(14,17);context.closePath();context.stroke();
        context.fillRect(16,14,12,4);context.fillRect(24,17,4,7);
      }else if(type==='prismShard'){
        context.beginPath();context.moveTo(16,3);context.lineTo(26,12);context.lineTo(20,29);context.lineTo(8,24);context.lineTo(6,11);context.closePath();context.fill();context.stroke();
        context.fillStyle='#f8e67a';context.beginPath();context.moveTo(16,4);context.lineTo(16,26);context.lineTo(8,12);context.closePath();context.fill();
      }else if(type==='nouveauBrooch'||type==='solarSeed'){
        for(let i=0;i<8;i+=1){
          const a=i*Math.PI/4;context.save();context.translate(16,16);context.rotate(a);
          context.beginPath();context.ellipse(0,-7,4,7,0,0,Math.PI*2);context.fill();context.restore();
        }
        context.fillStyle=secondary;context.beginPath();context.arc(16,16,4,0,Math.PI*2);context.fill();
      }else if(type==='dieselBadge'||type==='metroToken'){
        context.beginPath();context.arc(16,16,11,0,Math.PI*2);context.fill();context.stroke();
        context.fillStyle=secondary;context.fillRect(10,14,12,4);context.fillRect(14,10,4,12);
      }else if(type==='amberFossil'){
        context.beginPath();context.arc(16,16,11,0,Math.PI*2);context.fill();context.stroke();
        context.strokeStyle=secondary;context.beginPath();context.moveTo(10,23);context.lineTo(14,10);context.lineTo(22,8);context.lineTo(20,20);context.stroke();
      }else if(type==='celticKnot'){
        context.beginPath();context.arc(12,12,7,0,Math.PI*2);context.arc(20,20,7,0,Math.PI*2);context.stroke();
        context.beginPath();context.arc(20,12,7,0,Math.PI*2);context.arc(12,20,7,0,Math.PI*2);context.stroke();
      }else if(type==='inkQuill'){
        context.beginPath();context.moveTo(6,27);context.quadraticCurveTo(12,5,27,4);context.quadraticCurveTo(25,18,8,28);context.closePath();context.fill();context.stroke();
        context.strokeStyle=secondary;context.beginPath();context.moveTo(8,26);context.lineTo(25,6);context.stroke();
      }
    });
  }

  Maze3D.expandAestheticTextures=textures=>{
    const types=[
      'bubbleling','dolphin','aquaBot','frog','polygonHound','staticWraith',
      'lowPolyRat','glassKnight','prismMoth','glassGolem','vineNymph','moth',
      'fox','butterfly','capybara','sunDrone','dieselTrooper','propellerDrone',
      'sootGremlin','raptor','mammoth','pterodactyl','caveBeetle','stag',
      'banshee','strayDog','pigeon','maintenanceBot','inkFox','paperKnight',
      'bookworm','quillSpirit',
    ];
    Object.assign(textures.walls,makeWalls());
    Object.assign(textures.floors,makeFloors());
    Object.assign(textures.ceilings,makeCeilings());
    Object.assign(textures.creatures,Object.fromEntries(types.map(type=>[
      type,[0,1,2,3].map(frame=>makeCreatureFrame(type,frame)),
    ])));
    Object.assign(textures.relics,Object.fromEntries(
      Object.keys(RELICS).map(type=>[type,makeRelic(type)])
    ));
    return textures;
  };
})();
