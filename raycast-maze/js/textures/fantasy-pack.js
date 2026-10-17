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

  const noise = (x, y, seed = 0) => {
    let value = Math.imul(x + seed * 37, 374761393) ^
      Math.imul(y - seed * 23, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967295;
  };

  const tiles = (palette, seed, detail) =>
    surface(64, 64, (context, width, height) => {
      context.fillStyle = palette.gap;
      context.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 16) {
        for (let x = 0; x < width; x += 16) {
          const value = noise(x, y, seed);
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

  const planks = (base, light, dark, seed, vertical = false) =>
    surface(64, 64, context => {
      context.fillStyle = dark;
      context.fillRect(0, 0, 64, 64);
      for (let n = 0; n < 8; n += 1) {
        const x = vertical ? n * 8 : 0;
        const y = vertical ? 0 : n * 8;
        context.fillStyle = n % 2 ? base : light;
        context.fillRect(x + 1, y + 1, vertical ? 7 : 63, vertical ? 63 : 7);
        context.fillStyle = 'rgba(20, 8, 4, .25)';
        for (let i = 0; i < 3; i += 1) {
          const along = Math.floor(noise(n, i, seed) * 58) + 3;
          context.fillRect(vertical ? x + 3 : along, vertical ? along : y + 3,
            vertical ? 2 : 5, vertical ? 5 : 2);
        }
      }
    });

  function makeWalls() {
    const grave = tiles({
      gap: '#171b21', a: '#525b5e', b: '#454d51', hi: '#737e7e', lo: '#23292d',
    }, 111, (context, x, y, value) => {
      if (value > 0.45) {
        context.fillStyle = '#20262a';
        context.fillRect(x + 7, y + 4, 2, 8);
        context.fillRect(x + 4, y + 7, 8, 2);
      }
      context.fillStyle = 'rgba(92, 126, 78, .45)';
      context.fillRect(x + 2, y + 12, 5, 2);
    });

    const pipe = surface(64, 64, context => {
      context.fillStyle = '#9a4c34';
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = '#5e291f';
      for (let y = 0; y < 64; y += 12) context.fillRect(0, y, 64, 2);
      for (let y = 0; y < 64; y += 24) {
        for (let x = y % 24 ? 8 : -4; x < 64; x += 24) context.fillRect(x, y, 2, 12);
      }
      context.fillStyle = '#246d3a';
      context.fillRect(20, 0, 15, 64);
      context.fillStyle = '#5bd36b';
      context.fillRect(22, 0, 4, 64);
      context.fillStyle = '#164729';
      context.fillRect(31, 0, 4, 64);
      context.fillStyle = '#77df7a';
      context.fillRect(17, 10, 21, 8);
      context.fillStyle = '#164729';
      context.fillRect(34, 10, 4, 8);
    });

    const royal = surface(64, 64, context => {
      context.fillStyle = '#5f1720';
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = '#8e2630';
      for (let x = 0; x < 64; x += 16) context.fillRect(x + 2, 0, 11, 64);
      context.strokeStyle = '#d9ad4a';
      context.lineWidth = 2;
      for (let y = 8; y < 64; y += 16) {
        for (let x = 8; x < 64; x += 16) {
          context.beginPath();
          context.moveTo(x, y - 5);
          context.lineTo(x + 5, y);
          context.lineTo(x, y + 5);
          context.lineTo(x - 5, y);
          context.closePath();
          context.stroke();
        }
      }
    });

    const hospital = tiles({
      gap: '#494f49', a: '#a8aa96', b: '#969b8d', hi: '#c9c9b4', lo: '#646a62',
    }, 141, (context, x, y, value) => {
      context.fillStyle = value > 0.68 ? 'rgba(103, 28, 25, .75)' : 'rgba(49, 73, 47, .3)';
      context.fillRect(x + 4, y + 7, value > 0.68 ? 7 : 3, 2);
    });

    const ruin = surface(64, 64, context => {
      context.fillStyle = '#5b5248';
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = '#786b5d';
      for (let y = 0; y < 64; y += 16) context.fillRect(0, y, 64, 2);
      context.strokeStyle = '#292824';
      for (let i = 0; i < 12; i += 1) {
        const x = Math.floor(noise(i, 2, 151) * 64);
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo((x + 7) % 64, 24);
        context.lineTo((x + 2) % 64, 45);
        context.stroke();
      }
      context.fillStyle = 'rgba(142, 60, 30, .65)';
      context.fillRect(0, 43, 64, 5);
    });

    const cyber = tiles({
      gap: '#02070d', a: '#071c28', b: '#0d2730', hi: '#174658', lo: '#02070b',
    }, 161, (context, x, y, value) => {
      context.fillStyle = value > 0.5 ? '#00e4d0' : '#e84c75';
      context.fillRect(x + 4, y + 5, 8, 2);
      context.fillRect(x + 7, y + 8, 2, 4);
    });

    const candy = surface(64, 64, context => {
      context.fillStyle = '#f4dfc2';
      context.fillRect(0, 0, 64, 64);
      context.save();
      context.rotate(-Math.PI / 4);
      for (let x = -80; x < 100; x += 18) {
        context.fillStyle = x / 18 % 2 ? '#e85b67' : '#65c8b0';
        context.fillRect(x, -50, 9, 160);
      }
      context.restore();
      context.fillStyle = 'rgba(255,255,255,.35)';
      context.fillRect(0, 4, 64, 3);
    });

    const marble = surface(64, 64, context => {
      context.fillStyle = '#d8d7cc';
      context.fillRect(0, 0, 64, 64);
      context.strokeStyle = 'rgba(77, 99, 111, .45)';
      for (let i = 0; i < 9; i += 1) {
        const y = Math.floor(noise(i, 1, 181) * 64);
        context.beginPath();
        context.moveTo(0, y);
        context.bezierCurveTo(18, y - 12, 35, y + 15, 64, y - 4);
        context.stroke();
      }
      context.fillStyle = '#a7a99f';
      context.fillRect(0, 0, 64, 3);
      context.fillRect(0, 30, 64, 3);
      context.fillRect(0, 61, 64, 3);
    });

    const ship = planks('#6d3f25', '#815035', '#24140e', 191, true);
    const adobe = tiles({
      gap: '#76502c', a: '#bd8146', b: '#aa713d', hi: '#d9a063', lo: '#744826',
    }, 201, (context, x, y, value) => {
      context.fillStyle = value > 0.6 ? '#7c4b29' : '#d7a365';
      context.fillRect(x + 5, y + 8, 5, 1);
    });

    const jungle = surface(64, 64, context => {
      context.fillStyle = '#244328';
      context.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 34; i += 1) {
        const x = Math.floor(noise(i, 2, 211) * 64);
        const y = Math.floor(noise(3, i, 213) * 64);
        context.fillStyle = i % 3 ? '#397348' : '#739142';
        context.beginPath();
        context.ellipse(x, y, 6, 3, noise(i, y, 8) * Math.PI, 0, Math.PI * 2);
        context.fill();
      }
      context.strokeStyle = '#8a6335';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(7, 0);
      context.bezierCurveTo(29, 18, 3, 39, 35, 64);
      context.stroke();
    });

    const toy = tiles({
      gap: '#eee2c5', a: '#df493d', b: '#2d79ba', hi: '#fff2d2', lo: '#804135',
    }, 221, (context, x, y, value) => {
      context.fillStyle = value > 0.5 ? '#f1c746' : '#55a35d';
      context.fillRect(x + 5, y + 5, 6, 6);
      context.fillStyle = 'rgba(255,255,255,.4)';
      context.fillRect(x + 6, y + 6, 2, 2);
    });

    const noir = surface(64, 64, context => {
      context.fillStyle = '#1b1e20';
      context.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 16) {
        const offset = y / 16 % 2 ? -8 : 0;
        for (let x = offset; x < 64; x += 16) {
          context.fillStyle = '#45494b';
          context.fillRect(x + 1, y + 1, 14, 14);
          context.fillStyle = '#676a69';
          context.fillRect(x + 2, y + 2, 12, 2);
        }
      }
      context.fillStyle = 'rgba(209, 225, 207, .25)';
      context.fillRect(46, 0, 3, 64);
    });

    const shrine = surface(64, 64, context => {
      context.fillStyle = '#d8cdb9';
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = '#a82f2a';
      context.fillRect(0, 0, 64, 8);
      context.fillRect(0, 28, 64, 7);
      context.fillRect(6, 0, 8, 64);
      context.fillRect(50, 0, 8, 64);
      context.fillStyle = '#2a2521';
      context.fillRect(14, 8, 36, 3);
      context.fillRect(14, 58, 36, 3);
    });

    const dream = surface(64, 64, context => {
      context.fillStyle = '#7fc7cb';
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = '#e9ad8b';
      for (let y = 0; y < 64; y += 16) {
        for (let x = 0; x < 64; x += 16) {
          if ((x + y) / 16 % 2) {
            context.beginPath();
            context.arc(x + 8, y + 8, 7, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
      context.strokeStyle = '#f3edcf';
      for (let x = 4; x < 64; x += 12) {
        context.beginPath();
        context.moveTo(x, 0);
        context.bezierCurveTo(x + 12, 18, x - 10, 43, x + 5, 64);
        context.stroke();
      }
    });

    return {
      grave, pipe, royal, hospital, ruin, cyber, candy, marble,
      ship, adobe, jungle, toy, noir, shrine, dream,
    };
  }

  function makeFloors() {
    return {
      cobble: tiles({
        gap: '#23282b', a: '#555d60', b: '#484f52', hi: '#737d7d', lo: '#303639',
      }, 301),
      pipe: tiles({
        gap: '#55271c', a: '#a64d34', b: '#91402e', hi: '#d07753', lo: '#5d291e',
      }, 302, (context, x, y) => {
        context.fillStyle = '#286b39';
        context.fillRect(x + 6, y + 6, 4, 4);
      }),
      marble: tiles({
        gap: '#85877f', a: '#dad9cf', b: '#c7c9c2', hi: '#ffffff', lo: '#9b9e99',
      }, 303),
      tile: tiles({
        gap: '#555b53', a: '#b6b8a8', b: '#a3a898', hi: '#d9dac9', lo: '#747a70',
      }, 304, (context, x, y, value) => {
        if (value > 0.74) {
          context.fillStyle = 'rgba(101, 31, 27, .65)';
          context.fillRect(x + 5, y + 7, 8, 2);
        }
      }),
      cracked: tiles({
        gap: '#292824', a: '#625b51', b: '#554e47', hi: '#80766a', lo: '#35312d',
      }, 305, (context, x, y, value) => {
        context.strokeStyle = '#292724';
        context.beginPath();
        context.moveTo(x + 3, y + 4);
        context.lineTo(x + 8, y + 8);
        context.lineTo(x + 5 + value * 5, y + 13);
        context.stroke();
      }),
      grid: tiles({
        gap: '#00a9a3', a: '#081522', b: '#0b1c2a', hi: '#19415a', lo: '#02070d',
      }, 306, (context, x, y) => {
        context.fillStyle = '#e84c75';
        context.fillRect(x + 7, y + 7, 2, 2);
      }),
      candy: tiles({
        gap: '#f1d7b6', a: '#e86471', b: '#5bc4aa', hi: '#fff1db', lo: '#b95e62',
      }, 307),
      deck: planks('#74442a', '#895538', '#281710', 308),
      jungle: surface(64, 64, context => {
        context.fillStyle = '#203724';
        context.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 55; i += 1) {
          const x = Math.floor(noise(i, 4, 309) * 64);
          const y = Math.floor(noise(5, i, 310) * 64);
          context.fillStyle = i % 3 ? '#356342' : '#6e783f';
          context.fillRect(x, y, 3, 2);
        }
      }),
      playmat: tiles({
        gap: '#ece0ba', a: '#d7463e', b: '#327fc0', hi: '#fff2d5', lo: '#84443c',
      }, 311, (context, x, y, value) => {
        context.fillStyle = value > 0.5 ? '#edc740' : '#4b9d58';
        context.fillRect(x + 5, y + 5, 6, 6);
      }),
      wet: surface(64, 64, context => {
        context.fillStyle = '#11181d';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#29333a';
        for (let y = 0; y < 64; y += 16) context.fillRect(0, y, 64, 2);
        context.fillStyle = 'rgba(174, 207, 213, .28)';
        context.fillRect(9, 0, 3, 64);
        context.fillRect(43, 0, 2, 64);
      }),
      tatami: tiles({
        gap: '#4b442b', a: '#9e9460', b: '#a69d68', hi: '#c2b77e', lo: '#706943',
      }, 313, (context, x, y) => {
        context.fillStyle = 'rgba(68, 61, 36, .3)';
        for (let n = 3; n < 14; n += 3) context.fillRect(x + 2, y + n, 12, 1);
      }),
      cloud: surface(64, 64, context => {
        context.fillStyle = '#74b9cf';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#e6eee7';
        for (let i = 0; i < 13; i += 1) {
          const x = Math.floor(noise(i, 2, 314) * 64);
          const y = Math.floor(noise(3, i, 315) * 64);
          context.beginPath();
          context.arc(x, y, 8, 0, Math.PI * 2);
          context.fill();
        }
      }),
    };
  }

  const panelCeiling = (base, beam, light = null) =>
    tiles({
      gap: beam, a: base, b: base, hi: 'rgba(255,255,255,.16)', lo: 'rgba(0,0,0,.28)',
    }, 340, (context, x, y, value) => {
      if (light && value > 0.55) {
        context.fillStyle = light;
        context.fillRect(x + 4, y + 6, 8, 3);
      }
    });

  function makeCeilings() {
    return {
      night: surface(64, 64, context => {
        context.fillStyle = '#050813';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#d6ddbd';
        for (let i = 0; i < 42; i += 1) {
          const x = Math.floor(noise(i, 3, 351) * 64);
          const y = Math.floor(noise(5, i, 352) * 64);
          context.fillRect(x, y, i % 13 === 0 ? 2 : 1, 1);
        }
        context.fillStyle = '#d7d3ae';
        context.beginPath();
        context.arc(50, 14, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#050813';
        context.beginPath();
        context.arc(53, 11, 7, 0, Math.PI * 2);
        context.fill();
      }),
      royal: panelCeiling('#58202a', '#2a1519', '#d8ad4d'),
      flicker: panelCeiling('#777b70', '#333934', '#d6e2bd'),
      smoke: surface(64, 64, context => {
        context.fillStyle = '#322c29';
        context.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 18; i += 1) {
          context.fillStyle = `rgba(15, 14, 13, ${0.1 + i % 4 * 0.06})`;
          context.beginPath();
          context.arc(noise(i, 1, 353) * 64, noise(2, i, 354) * 64,
            8 + noise(i, 4, 355) * 12, 0, Math.PI * 2);
          context.fill();
        }
      }),
      cyber: panelCeiling('#091824', '#01050a', '#00dfd1'),
      pastel: panelCeiling('#f1c8af', '#c67578', '#fff1bd'),
      storm: surface(64, 64, context => {
        context.fillStyle = '#18232d';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#2d3b46';
        for (let i = 0; i < 12; i += 1) {
          context.beginPath();
          context.arc(noise(i, 5, 357) * 64, noise(7, i, 359) * 64, 13, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = 'rgba(205, 228, 229, .5)';
        context.beginPath();
        context.moveTo(39, 10);
        context.lineTo(31, 31);
        context.lineTo(40, 29);
        context.lineTo(34, 53);
        context.stroke();
      }),
      timber: planks('#604027', '#755033', '#24170f', 360),
      canopy: surface(64, 64, context => {
        context.fillStyle = '#142c1d';
        context.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 40; i += 1) {
          context.fillStyle = i % 3 ? '#315d36' : '#687f3a';
          context.beginPath();
          context.ellipse(noise(i, 1, 361) * 64, noise(2, i, 362) * 64,
            8, 4, noise(i, 4, 363) * Math.PI, 0, Math.PI * 2);
          context.fill();
        }
      }),
      nursery: panelCeiling('#d9ceb2', '#8c7652', '#f5c943'),
      nightcity: surface(64, 64, context => {
        context.fillStyle = '#05080d';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#182027';
        context.fillRect(0, 25, 13, 39);
        context.fillRect(16, 11, 16, 53);
        context.fillRect(35, 31, 12, 33);
        context.fillRect(50, 18, 14, 46);
        context.fillStyle = '#d5c68d';
        for (let y = 18; y < 62; y += 9) {
          context.fillRect(20, y, 3, 4);
          context.fillRect(26, y, 3, 4);
        }
      }),
      shrine: panelCeiling('#b8aa92', '#8d2c27', '#e8d9a8'),
      dreamsky: surface(64, 64, context => {
        const gradient = context.createLinearGradient(0, 0, 64, 64);
        gradient.addColorStop(0, '#4f9ebc');
        gradient.addColorStop(0.5, '#e29b84');
        gradient.addColorStop(1, '#d9d7ad');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
        context.strokeStyle = 'rgba(255,255,230,.6)';
        for (let i = 0; i < 8; i += 1) {
          context.beginPath();
          context.arc(32, 32, 5 + i * 5, 0, Math.PI * 2);
          context.stroke();
        }
      }),
    };
  }

  const humanoids = {
    skeleton: ['#d8d2b2', '#25251f', '#c8c09f'],
    knight: ['#9aa8ad', '#39516b', '#d8b451'],
    jester: ['#d74b43', '#e0b43f', '#f0dfbb'],
    zombie: ['#71835c', '#4c4339', '#9b3531'],
    mutant: ['#9a5940', '#514635', '#d57a2d'],
    scavenger: ['#886e4e', '#493e33', '#d29347'],
    neonbot: ['#263d4d', '#00e0cf', '#e84c75'],
    minotaur: ['#825333', '#49311f', '#d9c28d'],
    outlaw: ['#71513b', '#33271f', '#b58a57'],
    toySoldier: ['#397746', '#234e31', '#e0bd4e'],
    shadow: ['#1b1d21', '#343943', '#a9b5b8'],
    spirit: ['rgba(189,224,218,.82)', '#5da99a', '#effff5'],
  };

  function makeHumanoid(type, frame, context) {
    const [body, dark, accent] = humanoids[type];
    const bob = frame % 2;
    const swing = frame < 2 ? -2 : 2;
    context.fillStyle = body;
    context.fillRect(17, 7 - bob, 14, 13);
    context.fillRect(14, 20 - bob, 20, 17);
    context.fillRect(10 + swing, 21 - bob, 5, 16);
    context.fillRect(33 - swing, 21 - bob, 5, 16);
    context.fillRect(17 - swing, 36 - bob, 6, 11);
    context.fillRect(26 + swing, 36 - bob, 6, 11);
    context.fillStyle = dark;
    context.fillRect(19, 12 - bob, 4, 3);
    context.fillRect(26, 12 - bob, 4, 3);
    context.fillStyle = accent;

    if (type === 'skeleton') {
      context.fillRect(20, 24 - bob, 9, 2);
      context.fillRect(23, 20 - bob, 3, 16);
      context.fillRect(17, 28 - bob, 15, 2);
    } else if (type === 'knight') {
      context.fillRect(15, 18 - bob, 19, 3);
      context.fillRect(19, 5 - bob, 11, 3);
      context.fillStyle = '#20262c';
      context.fillRect(19, 13 - bob, 11, 2);
    } else if (type === 'jester') {
      context.beginPath();
      context.moveTo(17, 8 - bob);
      context.lineTo(14, 2 - bob);
      context.lineTo(23, 7 - bob);
      context.lineTo(29, 1 - bob);
      context.lineTo(32, 9 - bob);
      context.fill();
    } else if (type === 'zombie') {
      context.fillRect(8 + swing, 22 - bob, 10, 3);
      context.fillRect(31 - swing, 28 - bob, 10, 3);
    } else if (type === 'mutant') {
      context.beginPath();
      context.arc(11 + swing, 23 - bob, 6, 0, Math.PI * 2);
      context.fill();
      context.arc(37 - swing, 24 - bob, 6, 0, Math.PI * 2);
      context.fill();
    } else if (type === 'scavenger' || type === 'outlaw') {
      context.fillRect(14, 6 - bob, 20, 3);
      context.fillRect(18, 2 - bob, 12, 5);
      context.fillRect(type === 'outlaw' ? 34 : 11, 24 - bob, 8, 3);
    } else if (type === 'neonbot') {
      context.fillRect(20, 12 - bob, 9, 3);
      context.fillRect(18, 27 - bob, 13, 3);
    } else if (type === 'minotaur') {
      context.beginPath();
      context.moveTo(18, 9 - bob);
      context.lineTo(7, 2 - bob);
      context.lineTo(14, 14 - bob);
      context.moveTo(31, 9 - bob);
      context.lineTo(42, 2 - bob);
      context.lineTo(35, 14 - bob);
      context.fill();
    } else if (type === 'toySoldier') {
      context.fillRect(17, 3 - bob, 15, 5);
      context.fillRect(13, 1 - bob, 23, 3);
      context.fillRect(36 - swing, 18 - bob, 3, 24);
    } else if (type === 'shadow') {
      context.fillRect(13, 35 - bob, 23, 5);
      context.fillStyle = '#d4dfdc';
      context.fillRect(20, 12 - bob, 3, 2);
      context.fillRect(27, 12 - bob, 3, 2);
    } else if (type === 'spirit') {
      context.fillRect(17, 36 - bob, 5, 8);
      context.fillRect(27, 36 - bob, 5, 8);
    }
  }

  function makeCreatureFrame(type, frame) {
    return surface(48, 48, context => {
      context.clearRect(0, 0, 48, 48);
      if (humanoids[type]) {
        makeHumanoid(type, frame, context);
        return;
      }

      const bob = frame % 2;
      const flap = frame < 2 ? 0 : 5;
      if (type === 'raven' || type === 'owl' || type === 'parrot') {
        const colors = type === 'raven'
          ? ['#20232b', '#424956', '#aeb6b1']
          : type === 'owl'
            ? ['#a47a46', '#d6bd82', '#f4df8a']
            : ['#2c9a58', '#e34f3f', '#f0c949'];
        context.fillStyle = colors[0];
        context.beginPath();
        context.moveTo(24, 22 - bob);
        context.lineTo(5, 11 + flap);
        context.lineTo(10, 30 - flap);
        context.lineTo(24, 29 - bob);
        context.lineTo(38, 30 - flap);
        context.lineTo(43, 11 + flap);
        context.closePath();
        context.fill();
        context.fillStyle = colors[1];
        context.beginPath();
        context.ellipse(24, 23 - bob, 7, 11, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = colors[2];
        context.fillRect(20, 18 - bob, 3, 3);
        context.fillRect(27, 18 - bob, 3, 3);
      } else if (type === 'shroom') {
        context.fillStyle = '#eee1c3';
        context.fillRect(19, 24 - bob, 11, 17);
        context.fillStyle = '#d84f43';
        context.beginPath();
        context.ellipse(24, 22 - bob, 16, 10, 0, Math.PI, Math.PI * 2);
        context.fill();
        context.fillStyle = '#f6dfbe';
        context.fillRect(14, 14 - bob, 5, 5);
        context.fillRect(28, 11 - bob, 6, 6);
        context.fillStyle = '#2b2521';
        context.fillRect(21, 29 - bob, 2, 4);
        context.fillRect(27, 29 - bob, 2, 4);
      } else if (type === 'shellback') {
        context.fillStyle = '#47924d';
        context.beginPath();
        context.ellipse(24, 27 - bob, 14, 11, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#e6c95d';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(24, 27 - bob, 7, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#d5b45f';
        context.fillRect(35, 23 - bob, 8, 7);
      } else if (type === 'crawler') {
        context.fillStyle = '#69785b';
        context.fillRect(9, 24 - bob, 30, 10);
        context.fillRect(30, 19 - bob, 11, 9);
        context.strokeStyle = '#353c32';
        for (let i = 0; i < 4; i += 1) {
          context.beginPath();
          context.moveTo(14 + i * 7, 33 - bob);
          context.lineTo(10 + i * 9, 43 - (i + frame) % 3);
          context.stroke();
        }
      } else if (type === 'gummy' || type === 'cupcake') {
        if (type === 'gummy') {
          context.fillStyle = 'rgba(232, 83, 105, .85)';
          context.beginPath();
          context.arc(17, 13 - bob, 5, 0, Math.PI * 2);
          context.arc(31, 13 - bob, 5, 0, Math.PI * 2);
          context.fillRect(11, 14 - bob, 26, 27);
          context.fill();
        } else {
          context.fillStyle = '#b16c45';
          context.beginPath();
          context.moveTo(12, 25 - bob);
          context.lineTo(36, 25 - bob);
          context.lineTo(32, 43);
          context.lineTo(16, 43);
          context.closePath();
          context.fill();
          context.fillStyle = '#f0a3a3';
          context.beginPath();
          context.arc(24, 22 - bob, 13, Math.PI, 0);
          context.fill();
          context.fillStyle = '#e54b4b';
          context.beginPath();
          context.arc(24, 10 - bob, 4, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = '#30252a';
        context.fillRect(18, 26 - bob, 3, 3);
        context.fillRect(28, 26 - bob, 3, 3);
      } else if (type === 'tumbleweed') {
        context.strokeStyle = '#a07743';
        context.lineWidth = 2;
        for (let i = 0; i < 8; i += 1) {
          context.beginPath();
          context.ellipse(24, 26 - bob, 14, 8,
            i * Math.PI / 8 + frame * 0.15, 0, Math.PI * 2);
          context.stroke();
        }
      } else if (type === 'snake') {
        context.strokeStyle = '#5b984d';
        context.lineWidth = 7;
        context.beginPath();
        context.moveTo(5, 37);
        context.bezierCurveTo(13, 20 + flap, 23, 43 - flap, 34, 26);
        context.lineTo(42, 19 - bob);
        context.stroke();
        context.fillStyle = '#e8d062';
        context.fillRect(39, 16 - bob, 3, 3);
      } else if (type === 'jaguar' || type === 'kitsune') {
        context.fillStyle = type === 'jaguar' ? '#d49a3c' : '#d86b38';
        context.fillRect(9, 22 - bob, 28, 14);
        context.fillRect(31, 17 - bob, 11, 13);
        context.beginPath();
        context.moveTo(33, 18 - bob);
        context.lineTo(34, 10 - bob);
        context.lineTo(39, 18 - bob);
        context.fill();
        context.strokeStyle = type === 'jaguar' ? '#2f2419' : '#e8be8a';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(10, 25 - bob);
        context.quadraticCurveTo(-2, 13 + flap, 4, 38);
        context.stroke();
        context.fillStyle = '#282018';
        context.fillRect(37, 21 - bob, 2, 2);
      } else if (type === 'monkey') {
        context.fillStyle = '#79503a';
        context.beginPath();
        context.arc(24, 22 - bob, 10, 0, Math.PI * 2);
        context.fill();
        context.fillRect(16, 29 - bob, 17, 12);
        context.fillStyle = '#c89567';
        context.beginPath();
        context.ellipse(24, 23 - bob, 7, 6, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#6b402d';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(17, 36 - bob);
        context.quadraticCurveTo(2, 29 + flap, 9, 12);
        context.stroke();
      } else if (type === 'windup') {
        context.fillStyle = '#b54b3e';
        context.fillRect(12, 18 - bob, 25, 22);
        context.fillStyle = '#e5bd53';
        context.fillRect(18, 23 - bob, 13, 10);
        context.strokeStyle = '#d8d5c4';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(24, 18 - bob);
        context.lineTo(24, 8 - bob);
        context.lineTo(35, 8 - bob);
        context.stroke();
      } else if (type === 'eyeball') {
        context.fillStyle = '#ece9d7';
        context.beginPath();
        context.ellipse(24, 24 - bob, 17, 12, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#58a9aa';
        context.beginPath();
        context.arc(24 + flap / 3, 24 - bob, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#16191b';
        context.beginPath();
        context.arc(24 + flap / 3, 24 - bob, 3, 0, Math.PI * 2);
        context.fill();
      } else if (type === 'cloudling') {
        context.fillStyle = 'rgba(238, 245, 233, .9)';
        context.beginPath();
        context.arc(15, 28 - bob, 9, 0, Math.PI * 2);
        context.arc(24, 21 - bob, 12, 0, Math.PI * 2);
        context.arc(35, 28 - bob, 9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#536c77';
        context.fillRect(20, 23 - bob, 3, 4);
        context.fillRect(29, 23 - bob, 3, 4);
      }
    });
  }

  const RELIC_COLORS = {
    bone: ['#ddd5b8', '#736e60'],
    coin: ['#ffd64f', '#a96a1e'],
    crown: ['#f0c54f', '#a73b37'],
    medkit: ['#e9e4d5', '#bf3632'],
    battery: ['#83b95d', '#29332b'],
    chip: ['#2ce2cb', '#14394a'],
    candy: ['#ed6c7b', '#f3dfb6'],
    laurel: ['#75a34b', '#d9bd53'],
    compass: ['#c59c54', '#294b62'],
    badge: ['#d4a346', '#714e22'],
    idol: ['#68a85e', '#d8be55'],
    toykey: ['#e7bf43', '#b4463d'],
    film: ['#d8d8cb', '#25282b'],
    charm: ['#d4473f', '#f0dfbf'],
    eye: ['#7fc7c8', '#e9e5d2'],
  };

  function makeRelic(type) {
    return surface(32, 32, context => {
      const [primary, secondary] = RELIC_COLORS[type] || ['#f0c54f', '#614a24'];
      context.clearRect(0, 0, 32, 32);
      context.fillStyle = 'rgba(255, 221, 101, .15)';
      context.beginPath();
      context.arc(16, 16, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = primary;
      context.strokeStyle = secondary;
      context.lineWidth = 3;

      if (type === 'bone') {
        context.beginPath();
        context.moveTo(8, 24);
        context.lineTo(24, 8);
        context.stroke();
        for (const [x, y] of [[7,25],[10,23],[22,9],[25,7]]) {
          context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
        }
      } else if (type === 'coin') {
        context.beginPath(); context.arc(16, 16, 10, 0, Math.PI * 2); context.fill();
        context.stroke();
        context.fillStyle = secondary;
        context.fillRect(14, 9, 4, 14);
      } else if (type === 'crown') {
        context.beginPath();
        context.moveTo(5, 10); context.lineTo(10, 17); context.lineTo(16, 7);
        context.lineTo(22, 17); context.lineTo(27, 10); context.lineTo(24, 25);
        context.lineTo(8, 25); context.closePath(); context.fill(); context.stroke();
      } else if (type === 'medkit') {
        context.fillRect(5, 7, 22, 19);
        context.fillStyle = secondary;
        context.fillRect(13, 10, 6, 13);
        context.fillRect(9, 14, 14, 6);
      } else if (type === 'battery') {
        context.fillRect(8, 7, 16, 20);
        context.fillStyle = secondary;
        context.fillRect(12, 3, 8, 4);
        context.fillRect(13, 11, 6, 12);
        context.fillStyle = primary;
        context.fillRect(10, 15, 12, 4);
      } else if (type === 'chip') {
        context.fillRect(8, 8, 16, 16);
        context.stroke();
        context.fillStyle = secondary;
        context.fillRect(12, 12, 8, 8);
        for (let n = 7; n < 27; n += 5) {
          context.fillRect(n, 4, 2, 5); context.fillRect(n, 23, 2, 5);
        }
      } else if (type === 'candy') {
        context.beginPath(); context.arc(16, 16, 7, 0, Math.PI * 2); context.fill();
        context.beginPath();
        context.moveTo(9, 12); context.lineTo(2, 7); context.lineTo(4, 17); context.closePath();
        context.moveTo(23, 12); context.lineTo(30, 7); context.lineTo(28, 17); context.closePath();
        context.fill();
      } else if (type === 'laurel') {
        context.lineWidth = 2;
        context.beginPath(); context.arc(16, 17, 9, .5, Math.PI * 1.5); context.stroke();
        context.beginPath(); context.arc(16, 17, 9, Math.PI * 1.5, Math.PI * 2.5); context.stroke();
        for (let i = 0; i < 6; i += 1) {
          context.fillRect(5 + i * 3, 7 + i * 3, 5, 3);
          context.fillRect(22 - i * 3, 7 + i * 3, 5, 3);
        }
      } else if (type === 'compass') {
        context.beginPath(); context.arc(16, 16, 11, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = secondary;
        context.beginPath();
        context.moveTo(16, 6); context.lineTo(20, 17); context.lineTo(16, 26);
        context.lineTo(12, 17); context.closePath(); context.fill();
      } else if (type === 'badge') {
        context.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const radius = i % 2 ? 7 : 12;
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          const x = 16 + Math.cos(angle) * radius, y = 16 + Math.sin(angle) * radius;
          if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.closePath(); context.fill(); context.stroke();
      } else if (type === 'idol') {
        context.fillRect(9, 5, 14, 22);
        context.fillStyle = secondary;
        context.fillRect(12, 10, 3, 4); context.fillRect(18, 10, 3, 4);
        context.fillRect(13, 19, 7, 3);
      } else if (type === 'toykey') {
        context.beginPath(); context.arc(11, 11, 6, 0, Math.PI * 2); context.stroke();
        context.fillRect(14, 14, 13, 4);
        context.fillRect(23, 17, 4, 6);
      } else if (type === 'film') {
        context.fillStyle = secondary;
        context.fillRect(4, 9, 24, 15);
        context.fillStyle = primary;
        for (let x = 6; x < 27; x += 6) {
          context.fillRect(x, 10, 3, 3); context.fillRect(x, 20, 3, 3);
        }
      } else if (type === 'charm') {
        context.fillRect(8, 5, 16, 23);
        context.fillStyle = secondary;
        context.fillRect(11, 9, 10, 3);
        context.fillRect(14, 14, 4, 10);
      } else if (type === 'eye') {
        context.beginPath();
        context.ellipse(16, 16, 13, 8, 0, 0, Math.PI * 2);
        context.fill(); context.stroke();
        context.fillStyle = secondary;
        context.beginPath(); context.arc(16, 16, 5, 0, Math.PI * 2); context.fill();
      }
    });
  }

  Maze3D.expandTextures = textures => {
    const creatureTypes = [
      'skeleton', 'raven', 'shroom', 'shellback', 'knight', 'jester',
      'zombie', 'crawler', 'mutant', 'scavenger', 'neonbot', 'gummy',
      'cupcake', 'minotaur', 'owl', 'parrot', 'outlaw', 'tumbleweed',
      'snake', 'jaguar', 'monkey', 'toySoldier', 'windup', 'shadow',
      'kitsune', 'spirit', 'eyeball', 'cloudling',
    ];
    Object.assign(textures.walls, makeWalls());
    Object.assign(textures.floors, makeFloors());
    Object.assign(textures.ceilings, makeCeilings());
    Object.assign(textures.creatures, Object.fromEntries(creatureTypes.map(type => [
      type,
      [0, 1, 2, 3].map(frame => makeCreatureFrame(type, frame)),
    ])));
    Object.assign(textures.relics, Object.fromEntries(
      Object.keys(RELIC_COLORS).map(type => [type, makeRelic(type)])
    ));
    return textures;
  };
})();
