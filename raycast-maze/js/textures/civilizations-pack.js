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
    let value = Math.imul(x + seed * 41, 374761393) ^
      Math.imul(y - seed * 19, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967295;
  };

  const ARCHITECTURE = {
    gothic: {
      wall: ['#3e4449', '#697074', '#20262a', '#8c9495'],
      floor: ['#343a3d', '#575e61', '#1c2124', '#71797a'],
      ceiling: ['#272b30', '#454a50', '#111419', '#6a7073'],
    },
    deco: {
      wall: ['#11181b', '#24434a', '#05090b', '#d0a64c'],
      floor: ['#172327', '#31515a', '#080c0f', '#c69d47'],
      ceiling: ['#0b1013', '#1d3037', '#020406', '#e0bd63'],
    },
    chinese: {
      wall: ['#842d28', '#b54234', '#401917', '#d6aa4d'],
      floor: ['#492321', '#762e27', '#211111', '#c39642'],
      ceiling: ['#294433', '#416349', '#15241b', '#d0a348'],
    },
    caravan: {
      wall: ['#a96d35', '#c58a4c', '#6b4123', '#2f8a91'],
      floor: ['#6f593d', '#a5865d', '#443320', '#3c9ca0'],
      ceiling: ['#80522d', '#aa7640', '#4b2e1b', '#48a3a0'],
    },
    maya: {
      wall: ['#425c3d', '#65785a', '#263825', '#b09b55'],
      floor: ['#354b34', '#596b50', '#1d2b1d', '#8f8148'],
      ceiling: ['#263b2a', '#425c3f', '#132117', '#9d8d50'],
    },
    inca: {
      wall: ['#777060', '#99917d', '#464238', '#cfb66e'],
      floor: ['#625e53', '#817b6d', '#39372f', '#b39c60'],
      ceiling: ['#504b40', '#746c5a', '#2b2822', '#c0a460'],
    },
    roman: {
      wall: ['#9a573f', '#c68462', '#613424', '#ded1b0'],
      floor: ['#b9b4a5', '#ddd6c4', '#747168', '#9f4232'],
      ceiling: ['#b8a88f', '#ded0b4', '#756953', '#9d4535'],
    },
    mandir: {
      wall: ['#a86742', '#cc8e61', '#6c3d29', '#e0b86e'],
      floor: ['#7f513a', '#b97852', '#4c2d22', '#d7a95e'],
      ceiling: ['#6b3f31', '#985f45', '#3d241d', '#d4a760'],
    },
    khmer: {
      wall: ['#614d3d', '#7c6650', '#382d25', '#789052'],
      floor: ['#51443a', '#6b5a4b', '#302820', '#6f824b'],
      ceiling: ['#40372f', '#5c4c3d', '#211c18', '#788b50'],
    },
    sahel: {
      wall: ['#a56c3a', '#c58b4f', '#664023', '#35261c'],
      floor: ['#8c5d35', '#aa7545', '#54351f', '#d2a366'],
      ceiling: ['#744825', '#9e6837', '#422817', '#d0a05e'],
    },
    persian: {
      wall: ['#245f73', '#3b8490', '#133847', '#e0bb5b'],
      floor: ['#2d5966', '#4b7d82', '#18343b', '#cda94f'],
      ceiling: ['#1c4859', '#327083', '#0e2934', '#e0bb5b'],
    },
    norse: {
      wall: ['#4e392a', '#75523a', '#271b14', '#9c815c'],
      floor: ['#3c3027', '#5c4938', '#211a15', '#7f765d'],
      ceiling: ['#2f251d', '#4d392a', '#17110d', '#8c7350'],
    },
    polynesian: {
      wall: ['#4f3b2a', '#7b5c3b', '#211a13', '#d1a55c'],
      floor: ['#765f40', '#a38658', '#423522', '#2a8990'],
      ceiling: ['#3b2d21', '#664832', '#1a1410', '#c99750'],
    },
    byzantine: {
      wall: ['#514638', '#786650', '#29231d', '#d5aa43'],
      floor: ['#725f49', '#a28a68', '#3d3328', '#d0a33e'],
      ceiling: ['#493b30', '#6e5945', '#251e18', '#e0b84f'],
    },
    korean: {
      wall: ['#3f574a', '#66806b', '#223029', '#bd493b'],
      floor: ['#8b795b', '#b2a078', '#504630', '#4c765b'],
      ceiling: ['#294739', '#476953', '#15271f', '#cc5540'],
    },
  };

  function drawMotif(context, name, accent, role) {
    context.strokeStyle = accent;
    context.fillStyle = accent;
    context.lineWidth = role === 'floor' ? 1 : 2;

    if (name === 'gothic') {
      for (let x = 8; x < 64; x += 16) {
        context.beginPath();
        context.moveTo(x - 6, 30);
        context.lineTo(x - 6, 16);
        context.quadraticCurveTo(x, 4, x + 6, 16);
        context.lineTo(x + 6, 30);
        context.stroke();
      }
    } else if (name === 'deco') {
      for (let x = 8; x < 64; x += 16) {
        context.beginPath();
        context.moveTo(x, 4);
        context.lineTo(x - 7, 28);
        context.lineTo(x, 22);
        context.lineTo(x + 7, 28);
        context.closePath();
        context.stroke();
      }
      context.fillRect(0, 31, 64, 2);
    } else if (name === 'chinese') {
      for (let y = 8; y < 64; y += 16) {
        context.beginPath();
        context.arc(8, y, 5, Math.PI, 0);
        context.arc(20, y, 5, Math.PI, 0);
        context.arc(32, y, 5, Math.PI, 0);
        context.stroke();
      }
      context.fillRect(0, 30, 64, 3);
    } else if (name === 'caravan' || name === 'persian') {
      for (let y = 8; y < 64; y += 16) {
        for (let x = 8; x < 64; x += 16) {
          context.beginPath();
          context.moveTo(x, y - 6);
          context.lineTo(x + 6, y);
          context.lineTo(x, y + 6);
          context.lineTo(x - 6, y);
          context.closePath();
          context.stroke();
        }
      }
    } else if (name === 'maya') {
      for (let x = 2; x < 64; x += 16) {
        context.fillRect(x, 8, 5, 5);
        context.fillRect(x + 5, 13, 5, 5);
        context.fillRect(x + 10, 18, 5, 5);
        context.fillRect(x + 5, 23, 5, 5);
      }
    } else if (name === 'inca') {
      context.beginPath();
      context.moveTo(0, 12); context.lineTo(11, 7); context.lineTo(22, 13);
      context.lineTo(35, 8); context.lineTo(49, 14); context.lineTo(64, 9);
      context.moveTo(0, 34); context.lineTo(16, 27); context.lineTo(31, 35);
      context.lineTo(47, 29); context.lineTo(64, 36);
      context.stroke();
    } else if (name === 'roman') {
      for (let x = 6; x < 64; x += 16) {
        context.fillRect(x, 3, 8, 4);
        context.fillRect(x + 2, 7, 4, 23);
        context.fillRect(x, 30, 8, 3);
      }
      context.fillRect(0, 34, 64, 2);
    } else if (name === 'mandir') {
      for (let y = 8; y < 64; y += 16) {
        for (let x = 8; x < 64; x += 16) {
          context.beginPath();
          context.arc(x, y, 6, 0, Math.PI * 2);
          context.arc(x, y, 2, 0, Math.PI * 2);
          context.stroke();
        }
      }
    } else if (name === 'khmer') {
      for (let x = 4; x < 64; x += 12) {
        context.beginPath();
        context.moveTo(x, 31);
        context.quadraticCurveTo(x + 6, 9, x + 12, 31);
        context.stroke();
      }
      context.fillRect(0, 33, 64, 2);
    } else if (name === 'sahel') {
      for (let x = 8; x < 64; x += 16) {
        context.fillRect(x, 4, 3, 22);
        context.fillRect(x - 4, 9, 11, 3);
      }
      context.beginPath();
      context.moveTo(0, 36); context.lineTo(8, 28); context.lineTo(16, 36);
      context.lineTo(24, 28); context.lineTo(32, 36); context.lineTo(40, 28);
      context.lineTo(48, 36); context.lineTo(56, 28); context.lineTo(64, 36);
      context.stroke();
    } else if (name === 'norse') {
      for (let x = 0; x < 64; x += 16) {
        context.beginPath();
        context.moveTo(x + 2, 6); context.lineTo(x + 14, 22);
        context.lineTo(x + 2, 30); context.lineTo(x + 14, 38);
        context.stroke();
      }
    } else if (name === 'polynesian') {
      for (let y = 6; y < 64; y += 14) {
        context.beginPath();
        for (let x = 0; x <= 64; x += 8) {
          context.lineTo(x, y + (x / 8 % 2 ? 6 : 0));
        }
        context.stroke();
      }
    } else if (name === 'byzantine') {
      for (let y = 4; y < 64; y += 8) {
        for (let x = 4; x < 64; x += 8) {
          context.globalAlpha = (x + y) / 8 % 2 ? 0.9 : 0.45;
          context.fillRect(x, y, 5, 5);
        }
      }
      context.globalAlpha = 1;
    } else if (name === 'korean') {
      context.fillRect(0, 6, 64, 4);
      context.fillRect(0, 28, 64, 4);
      for (let x = 8; x < 64; x += 16) {
        context.beginPath();
        context.arc(x, 19, 7, 0, Math.PI * 2);
        context.stroke();
        context.fillRect(x - 2, 10, 4, 18);
      }
    }
  }

  function architectureTexture(name, role, seed) {
    const palette = ARCHITECTURE[name][role];
    return surface(64, 64, context => {
      context.fillStyle = palette[2];
      context.fillRect(0, 0, 64, 64);
      const tile = role === 'floor' ? 16 : 20;
      for (let y = 0; y < 64; y += tile) {
        for (let x = 0; x < 64; x += tile) {
          const variation = hash(x, y, seed) > 0.5;
          context.fillStyle = variation ? palette[0] : palette[1];
          context.fillRect(x + 1, y + 1, tile - 2, tile - 2);
          context.fillStyle = 'rgba(255,255,255,.09)';
          context.fillRect(x + 2, y + 2, tile - 4, 2);
          context.fillStyle = 'rgba(0,0,0,.16)';
          context.fillRect(x + 2, y + tile - 4, tile - 4, 2);
        }
      }
      drawMotif(context, name, palette[3], role);
    });
  }

  function makeArchitectureTextures(role) {
    return Object.fromEntries(Object.keys(ARCHITECTURE).map((name, index) => [
      role === 'floor' && name === 'gothic' ? 'flagstone'
        : role === 'floor' && name === 'caravan' ? 'mosaicSand'
          : role === 'floor' && name === 'chinese' ? 'lacquer'
          : role === 'floor' && name === 'mandir' ? 'mandala'
            : role === 'floor' && name === 'khmer' ? 'laterite'
              : role === 'floor' && name === 'polynesian' ? 'coralStone'
                : role === 'floor' && name === 'korean' ? 'ondol'
                  : role === 'ceiling' && name === 'caravan' ? 'arabesque'
                    : role === 'ceiling' && name === 'inca' ? 'andes'
                      : role === 'ceiling' && name === 'polynesian' ? 'ocean'
                        : name,
      architectureTexture(name, role, 500 + index * 17 + role.length),
    ]));
  }

  const BIRDS = {
    eagle: ['#6b492c', '#d2c2a0', '#e2b847'],
    falcon: ['#77634d', '#d7c7a5', '#2d302d'],
    quetzal: ['#21846e', '#d44d42', '#e5cb55'],
    condor: ['#292a2b', '#d8d4c2', '#9b5540'],
    peacock: ['#19727d', '#3b9b64', '#d5b646'],
    dove: ['#dad9ce', '#f4f0df', '#777d82'],
    crane: ['#e4e1d3', '#202326', '#c44b3f'],
  };

  function drawBird(context, type, frame) {
    const [wing, body, accent] = BIRDS[type];
    const bob = frame % 2;
    const flap = frame < 2 ? 0 : 6;
    context.fillStyle = wing;
    context.beginPath();
    context.moveTo(24, 23 - bob);
    context.lineTo(4, 10 + flap);
    context.lineTo(10, 31 - flap);
    context.lineTo(24, 29 - bob);
    context.lineTo(38, 31 - flap);
    context.lineTo(44, 10 + flap);
    context.closePath();
    context.fill();
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(25, 24 - bob, type === 'crane' ? 5 : 8,
      type === 'crane' ? 13 : 10, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = accent;
    context.fillRect(22, 18 - bob, 6, 3);
    if (type === 'peacock') {
      context.strokeStyle = '#3b9b64';
      for (let i = 0; i < 5; i += 1) {
        context.beginPath();
        context.moveTo(24, 31 - bob);
        context.lineTo(8 + i * 8, 46);
        context.stroke();
      }
    } else if (type === 'quetzal') {
      context.strokeStyle = '#37a679';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(23, 31 - bob);
      context.bezierCurveTo(17, 39, 28, 42, 19, 48);
      context.moveTo(27, 31 - bob);
      context.bezierCurveTo(34, 39, 23, 42, 31, 48);
      context.stroke();
    } else if (type === 'crane') {
      context.strokeStyle = '#e4e1d3';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(25, 14 - bob);
      context.lineTo(29, 5 - bob);
      context.moveTo(23, 35 - bob);
      context.lineTo(19, 47);
      context.moveTo(27, 35 - bob);
      context.lineTo(30, 47);
      context.stroke();
    }
  }

  const QUADRUPEDS = {
    guardianLion: ['#b78b45', '#744f2a', '#d7b764'],
    camel: ['#ad7948', '#75472a', '#d5a56c'],
    llama: ['#d2c1a2', '#87694e', '#f1e3ca'],
    wolf: ['#71777a', '#353a3d', '#aeb4b4'],
    elephant: ['#747d7b', '#464d4c', '#a8afaa'],
    lion: ['#c08a3f', '#684426', '#d8ad63'],
    turtle: ['#48764c', '#27472f', '#b09b50'],
    gecko: ['#61a55e', '#2d623b', '#d4c64c'],
    tiger: ['#d57b32', '#2d2621', '#e6ad69'],
  };

  function drawQuadruped(context, type, frame) {
    const [body, dark, light] = QUADRUPEDS[type];
    const bob = frame % 2;
    const step = frame < 2 ? 0 : 3;
    context.fillStyle = body;
    if (type === 'turtle') {
      context.beginPath();
      context.ellipse(23, 27 - bob, 15, 10, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = dark;
      context.beginPath();
      context.arc(38, 27 - bob, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = light;
      context.beginPath();
      context.arc(23, 27 - bob, 9, 0, Math.PI * 2);
      context.stroke();
      return;
    }
    if (type === 'gecko') {
      context.strokeStyle = body;
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(5, 34);
      context.quadraticCurveTo(18, 18 + step, 39, 24 - bob);
      context.stroke();
      context.fillStyle = light;
      context.fillRect(36, 21 - bob, 3, 3);
      return;
    }
    context.fillRect(8, 21 - bob, 29, 14);
    context.fillRect(31, type === 'camel' ? 9 - bob : 16 - bob, 11,
      type === 'camel' ? 21 : 14);
    context.fillRect(11 + step, 34 - bob, 5, 12);
    context.fillRect(28 - step, 34 - bob, 5, 12);
    context.fillStyle = dark;
    context.fillRect(37, type === 'camel' ? 13 - bob : 20 - bob, 2, 2);
    context.strokeStyle = dark;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(9, 24 - bob);
    context.quadraticCurveTo(-2, 15 + step, 3, 38);
    context.stroke();

    if (type === 'guardianLion' || type === 'lion') {
      context.fillStyle = dark;
      context.beginPath();
      context.arc(34, 21 - bob, type === 'guardianLion' ? 10 : 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = body;
      context.fillRect(31, 17 - bob, 11, 12);
    } else if (type === 'camel') {
      context.fillStyle = light;
      context.beginPath();
      context.arc(19, 19 - bob, 7, Math.PI, 0);
      context.fill();
    } else if (type === 'elephant') {
      context.strokeStyle = body;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(40, 23 - bob);
      context.quadraticCurveTo(46, 32, 41, 40);
      context.stroke();
      context.fillStyle = light;
      context.beginPath();
      context.moveTo(35, 29 - bob);
      context.lineTo(38, 38 - bob);
      context.lineTo(32, 31 - bob);
      context.fill();
    } else if (type === 'tiger') {
      context.fillStyle = dark;
      for (let x = 13; x < 33; x += 6) context.fillRect(x, 21 - bob, 2, 9);
    } else if (type === 'llama') {
      context.fillStyle = light;
      context.fillRect(34, 12 - bob, 3, 12);
    }
  }

  function drawHumanoid(context, type, frame) {
    const bob = frame % 2;
    const swing = frame < 2 ? -2 : 2;
    const legion = type === 'legionary';
    context.fillStyle = legion ? '#9b3f32' : '#76543a';
    context.fillRect(16, 7 - bob, 16, 13);
    context.fillRect(13, 20 - bob, 22, 17);
    context.fillRect(9 + swing, 21 - bob, 5, 17);
    context.fillRect(34 - swing, 21 - bob, 5, 17);
    context.fillRect(17 - swing, 36 - bob, 6, 11);
    context.fillRect(26 + swing, 36 - bob, 6, 11);
    context.fillStyle = legion ? '#d3c0a0' : '#d1b17c';
    context.fillRect(18, 9 - bob, 12, 9);
    context.fillStyle = '#252422';
    context.fillRect(20, 12 - bob, 3, 2);
    context.fillRect(27, 12 - bob, 3, 2);
    context.fillStyle = legion ? '#b5b9b2' : '#4b3528';
    if (legion) {
      context.fillRect(16, 4 - bob, 16, 5);
      context.fillRect(22, 0, 5, 5);
      context.fillRect(34 - swing, 19 - bob, 3, 24);
    } else {
      context.beginPath();
      context.moveTo(15, 10 - bob);
      context.lineTo(24, 1 - bob);
      context.lineTo(33, 10 - bob);
      context.fill();
      context.fillRect(8 + swing, 18 - bob, 3, 25);
    }
  }

  function makeCreatureFrame(type, frame) {
    return surface(48, 48, context => {
      context.clearRect(0, 0, 48, 48);
      if (BIRDS[type]) {
        drawBird(context, type, frame);
      } else if (QUADRUPEDS[type]) {
        drawQuadruped(context, type, frame);
      } else if (type === 'legionary' || type === 'viking') {
        drawHumanoid(context, type, frame);
      } else if (type === 'dragon') {
        const bob = frame % 2;
        const flap = frame < 2 ? 0 : 6;
        context.fillStyle = '#b94a35';
        context.beginPath();
        context.moveTo(24, 22 - bob);
        context.lineTo(4, 8 + flap);
        context.lineTo(10, 31 - flap);
        context.lineTo(24, 29 - bob);
        context.lineTo(38, 31 - flap);
        context.lineTo(44, 8 + flap);
        context.closePath();
        context.fill();
        context.fillStyle = '#d76b3e';
        context.fillRect(18, 17 - bob, 22, 11);
        context.fillStyle = '#e0b94f';
        context.beginPath();
        context.moveTo(39, 20 - bob);
        context.lineTo(47, 24 - bob);
        context.lineTo(39, 27 - bob);
        context.fill();
        context.strokeStyle = '#b94a35';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(19, 25 - bob);
        context.quadraticCurveTo(5, 41, 2, 29);
        context.stroke();
      }
    });
  }

  const RELIC_COLORS = {
    chalice: ['#d5b04f', '#744f22'],
    decoKey: ['#d8b75e', '#223940'],
    jadeSeal: ['#4ea47b', '#194a3a'],
    astrolabe: ['#d2a74e', '#365b68'],
    calendar: ['#779162', '#2d4932'],
    sunstone: ['#d1a94d', '#79562d'],
    romanCoin: ['#d0ad59', '#705025'],
    lotus: ['#db8f85', '#d3b65f'],
    khmerLotus: ['#9b9e62', '#5b5630'],
    goldweight: ['#d2a746', '#735022'],
    rose: ['#c94946', '#41704b'],
    rune: ['#9a9d98', '#44515a'],
    wayfinder: ['#4aa1a6', '#d0aa5a'],
    mosaic: ['#d5ad4a', '#5b4936'],
    jade: ['#58a57f', '#204f3c'],
  };

  function makeRelic(type) {
    return surface(32, 32, context => {
      const [primary, secondary] = RELIC_COLORS[type] || ['#d5b04f', '#5b4224'];
      context.clearRect(0, 0, 32, 32);
      context.fillStyle = 'rgba(255, 224, 128, .14)';
      context.beginPath();
      context.arc(16, 16, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = primary;
      context.strokeStyle = secondary;
      context.lineWidth = 2;

      if (type === 'chalice') {
        context.beginPath();
        context.moveTo(7, 5); context.lineTo(25, 5); context.lineTo(21, 17);
        context.quadraticCurveTo(16, 22, 11, 17); context.closePath(); context.fill(); context.stroke();
        context.fillRect(14, 19, 4, 7); context.fillRect(9, 25, 14, 3);
      } else if (type === 'decoKey') {
        context.beginPath(); context.arc(10, 10, 6, 0, Math.PI * 2); context.stroke();
        context.fillRect(13, 13, 14, 4);
        context.fillRect(23, 16, 4, 8);
        context.fillStyle = secondary; context.fillRect(8, 8, 4, 4);
      } else if (type === 'jadeSeal') {
        context.fillRect(7, 10, 18, 17);
        context.beginPath(); context.arc(16, 9, 6, Math.PI, 0); context.fill();
        context.fillStyle = secondary;
        context.fillRect(11, 15, 10, 2); context.fillRect(15, 14, 2, 9);
      } else if (type === 'astrolabe' || type === 'wayfinder') {
        context.beginPath(); context.arc(16, 16, 11, 0, Math.PI * 2); context.stroke();
        context.beginPath(); context.arc(16, 16, 6, 0, Math.PI * 2); context.stroke();
        context.beginPath();
        context.moveTo(16, 4); context.lineTo(20, 17); context.lineTo(16, 28);
        context.lineTo(12, 17); context.closePath(); context.fill();
      } else if (type === 'calendar' || type === 'sunstone') {
        context.beginPath(); context.arc(16, 16, 11, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = secondary;
        context.beginPath(); context.arc(16, 16, 4, 0, Math.PI * 2); context.fill();
        for (let i = 0; i < 8; i += 1) {
          const a = i * Math.PI / 4;
          context.fillRect(15 + Math.cos(a) * 8, 15 + Math.sin(a) * 8, 3, 3);
        }
      } else if (type === 'romanCoin') {
        context.beginPath(); context.arc(16, 16, 11, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = secondary;
        context.fillRect(13, 8, 6, 15); context.fillRect(9, 22, 14, 3);
      } else if (type === 'lotus' || type === 'khmerLotus' || type === 'rose') {
        for (let i = 0; i < 8; i += 1) {
          const a = i * Math.PI / 4;
          context.save();
          context.translate(16, 16);
          context.rotate(a);
          context.beginPath();
          context.ellipse(0, -7, 4, 8, 0, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
        context.fillStyle = secondary;
        context.beginPath(); context.arc(16, 16, 4, 0, Math.PI * 2); context.fill();
      } else if (type === 'goldweight') {
        context.beginPath();
        context.moveTo(16, 4); context.lineTo(27, 14); context.lineTo(22, 27);
        context.lineTo(10, 27); context.lineTo(5, 14); context.closePath();
        context.fill(); context.stroke();
        context.fillStyle = secondary;
        context.fillRect(12, 11, 8, 10);
      } else if (type === 'rune') {
        context.beginPath();
        context.moveTo(9, 27); context.lineTo(14, 5); context.lineTo(21, 8);
        context.lineTo(17, 27); context.closePath(); context.fill(); context.stroke();
        context.fillStyle = secondary;
        context.beginPath();
        context.moveTo(14, 10); context.lineTo(22, 15); context.lineTo(13, 20);
        context.stroke();
      } else if (type === 'mosaic') {
        for (let y = 6; y < 27; y += 5) {
          for (let x = 6; x < 27; x += 5) {
            context.fillStyle = (x + y) / 5 % 2 ? primary : secondary;
            context.fillRect(x, y, 4, 4);
          }
        }
      } else if (type === 'jade') {
        context.beginPath();
        context.arc(16, 16, 11, 0, Math.PI * 2);
        context.arc(16, 16, 5, 0, Math.PI * 2, true);
        context.fill();
        context.stroke();
      }
    });
  }

  Maze3D.expandCivilizationTextures = textures => {
    const creatureTypes = [
      'eagle', 'dragon', 'guardianLion', 'crane', 'camel', 'falcon',
      'quetzal', 'llama', 'condor', 'legionary', 'wolf', 'elephant',
      'peacock', 'lion', 'viking', 'turtle', 'gecko', 'dove', 'tiger',
    ];
    Object.assign(textures.walls, makeArchitectureTextures('wall'));
    Object.assign(textures.floors, makeArchitectureTextures('floor'));
    Object.assign(textures.ceilings, makeArchitectureTextures('ceiling'));
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
