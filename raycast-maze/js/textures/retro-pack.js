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
    let value = Math.imul(x + seed * 29, 374761393) ^
      Math.imul(y - seed * 17, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967295;
  };

  const blockWall = ({ base, mortar, light, dark, seed, decoration }) =>
    surface(64, 64, (context, width, height) => {
      context.fillStyle = mortar;
      context.fillRect(0, 0, width, height);
      for (let row = 0; row < 4; row += 1) {
        const y = row * 16;
        const offset = row % 2 ? -8 : 0;
        for (let x = offset; x < width; x += 16) {
          const variation = Math.floor((noise(x, y, seed) - 0.5) * 18);
          context.fillStyle = base;
          context.fillRect(x + 1, y + 1, 14, 14);
          context.fillStyle = `rgba(255,255,255,${0.08 + Math.max(0, variation) / 180})`;
          context.fillRect(x + 2, y + 2, 12, 2);
          context.fillStyle = `rgba(0,0,0,${0.16 + Math.max(0, -variation) / 120})`;
          context.fillRect(x + 2, y + 13, 12, 2);
          context.fillStyle = noise(x, y, seed + 5) > 0.5 ? light : dark;
          context.fillRect(x + 4, y + 7, 1, 1);
          context.fillRect(x + 10, y + 5, 1, 1);
        }
      }
      if (decoration) decoration(context);
    });

  const tiledSurface = (palette, seed, detail) =>
    surface(64, 64, (context, width, height) => {
      context.fillStyle = palette.gap;
      context.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 16) {
        for (let x = 0; x < width; x += 16) {
          const alternate = (x + y) / 16 % 2;
          context.fillStyle = alternate ? palette.a : palette.b;
          context.fillRect(x + 1, y + 1, 14, 14);
          context.fillStyle = palette.highlight;
          context.fillRect(x + 2, y + 2, 12, 1);
          context.fillStyle = palette.shadow;
          context.fillRect(x + 2, y + 14, 12, 1);
          if (detail) detail(context, x, y, noise(x, y, seed));
        }
      }
    });

  function makeWalls() {
    const sandstone = blockWall({
      base: '#b98b4f', mortar: '#6b4828', light: '#dfbd78', dark: '#76502d', seed: 31,
      decoration(context) {
        context.strokeStyle = 'rgba(72, 43, 22, .55)';
        context.lineWidth = 1;
        for (let y = 7; y < 64; y += 16) {
          context.beginPath();
          context.moveTo(5, y);
          context.lineTo(9, y - 3);
          context.lineTo(12, y + 2);
          context.moveTo(22, y - 2);
          context.lineTo(26, y + 2);
          context.lineTo(30, y - 2);
          context.stroke();
        }
      },
    });

    const coral = blockWall({
      base: '#2d7783', mortar: '#123b4d', light: '#74bdba', dark: '#185064', seed: 47,
      decoration(context) {
        for (let i = 0; i < 18; i += 1) {
          const x = Math.floor(noise(i, 4, 91) * 62);
          const y = Math.floor(noise(8, i, 73) * 62);
          context.fillStyle = i % 3 ? '#277c65' : '#cc6b68';
          context.fillRect(x, y, 2, 5);
          context.fillRect(x - 1, y + 1, 4, 2);
        }
      },
    });

    const space = tiledSurface({
      gap: '#070b18', a: '#17233b', b: '#101a31',
      highlight: '#394f70', shadow: '#050914',
    }, 61, (context, x, y, value) => {
      context.fillStyle = value > 0.52 ? '#57dddf' : '#d06a44';
      context.fillRect(x + 4, y + 5, 2, 2);
      context.fillStyle = '#64748c';
      context.fillRect(x + 10, y + 10, 2, 2);
    });

    const obsidian = surface(64, 64, context => {
      context.fillStyle = '#141419';
      context.fillRect(0, 0, 64, 64);
      context.strokeStyle = '#51313b';
      context.lineWidth = 2;
      for (let x = -8; x < 72; x += 13) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + 6, 13);
        context.lineTo(x + 1, 29);
        context.lineTo(x + 9, 44);
        context.lineTo(x + 4, 64);
        context.stroke();
      }
      context.strokeStyle = '#b04b2f';
      context.lineWidth = 1;
      context.stroke();
    });

    const croatia = blockWall({
      base: '#d5cfb8', mortar: '#777264', light: '#f2eedc', dark: '#a39e8d', seed: 19,
      decoration(context) {
        for (let x = 0; x < 64; x += 8) {
          context.fillStyle = x / 8 % 2 ? '#f5eee0' : '#d83d3d';
          context.fillRect(x, 25, 8, 7);
          context.fillStyle = x / 8 % 2 ? '#d83d3d' : '#f5eee0';
          context.fillRect(x, 32, 8, 7);
        }
        context.fillStyle = '#225aa8';
        context.fillRect(0, 39, 64, 2);
      },
    });

    const ice = surface(64, 64, context => {
      const gradient = context.createLinearGradient(0, 0, 64, 64);
      gradient.addColorStop(0, '#b9ecf2');
      gradient.addColorStop(0.5, '#4c9bb7');
      gradient.addColorStop(1, '#d7fbf6');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
      context.strokeStyle = 'rgba(232, 255, 255, .68)';
      for (let i = 0; i < 14; i += 1) {
        const x = Math.floor(noise(i, 5, 17) * 64);
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo((x + 17) % 64, 23);
        context.lineTo((x + 4) % 64, 64);
        context.stroke();
      }
    });

    const foundry = tiledSurface({
      gap: '#08090a', a: '#292d30', b: '#1d2023',
      highlight: '#555d60', shadow: '#090a0b',
    }, 81, (context, x, y, value) => {
      context.fillStyle = '#a9b0a7';
      context.fillRect(x + 3, y + 3, 2, 2);
      context.fillRect(x + 11, y + 11, 2, 2);
      context.fillStyle = value > 0.5 ? '#ff7a1a' : '#55e9d8';
      context.fillRect(x + 7, y + 6, 3, 4);
    });

    const archive = surface(64, 64, context => {
      context.fillStyle = '#21130f';
      context.fillRect(0, 0, 64, 64);
      for (let shelf = 0; shelf < 4; shelf += 1) {
        const y = shelf * 16;
        context.fillStyle = '#684029';
        context.fillRect(0, y + 13, 64, 3);
        let x = 2;
        while (x < 62) {
          const bookWidth = 3 + Math.floor(noise(x, y, 28) * 4);
          const colors = ['#873d32', '#305666', '#746233', '#4e3c6a', '#94734a'];
          context.fillStyle = colors[Math.floor(noise(y, x, 44) * colors.length)];
          context.fillRect(x, y + 3 + x % 3, bookWidth, 10 - x % 3);
          x += bookWidth + 1;
        }
      }
    });

    const brass = tiledSurface({
      gap: '#251b0c', a: '#7a5a22', b: '#5e4217',
      highlight: '#c49b45', shadow: '#2b1d0c',
    }, 93, (context, x, y) => {
      context.strokeStyle = '#d4b15d';
      context.beginPath();
      context.arc(x + 8, y + 8, 4, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#2a2114';
      context.fillRect(x + 7, y + 7, 3, 3);
    });

    return { sandstone, coral, space, obsidian, croatia, ice, foundry, archive, brass };
  }

  function makeFloors() {
    return {
      sand: tiledSurface({
        gap: '#745126', a: '#bc8c4d', b: '#a97a3f',
        highlight: '#d6ad6b', shadow: '#795329',
      }, 12, (context, x, y, value) => {
        context.fillStyle = value > 0.5 ? '#e0bd78' : '#80572f';
        context.fillRect(x + 5, y + 9, 1, 1);
      }),
      water: surface(64, 64, context => {
        context.fillStyle = '#0a4d68';
        context.fillRect(0, 0, 64, 64);
        context.strokeStyle = 'rgba(96, 224, 218, .46)';
        for (let y = 5; y < 64; y += 9) {
          context.beginPath();
          for (let x = 0; x <= 64; x += 4) {
            const wave = Math.sin((x + y) * 0.24) * 2;
            if (x === 0) context.moveTo(x, y + wave);
            else context.lineTo(x, y + wave);
          }
          context.stroke();
        }
      }),
      space: tiledSurface({
        gap: '#03050c', a: '#11182a', b: '#0b1222',
        highlight: '#273a59', shadow: '#02040a',
      }, 18, (context, x, y) => {
        context.fillStyle = '#54dce1';
        context.fillRect(x + 7, y + 7, 2, 2);
      }),
      terracotta: tiledSurface({
        gap: '#765340', a: '#e7ddd0', b: '#bd3434',
        highlight: '#f4e9dc', shadow: '#77302e',
      }, 23),
      ice: tiledSurface({
        gap: '#4b869f', a: '#9cdde8', b: '#70b9cc',
        highlight: '#e7ffff', shadow: '#397a98',
      }, 27),
      metal: tiledSurface({
        gap: '#0b0d0f', a: '#353b3e', b: '#292e31',
        highlight: '#687073', shadow: '#111416',
      }, 32, (context, x, y) => {
        context.fillStyle = '#ef7b24';
        context.fillRect(x + 3, y + 7, 10, 2);
      }),
      wood: tiledSurface({
        gap: '#21130e', a: '#6c3e27', b: '#75492f',
        highlight: '#9b6740', shadow: '#3b2117',
      }, 36),
      brass: tiledSurface({
        gap: '#2b210f', a: '#806022', b: '#6b4d1a',
        highlight: '#c09a4a', shadow: '#33240e',
      }, 42),
    };
  }

  const ceiling = (base, line, lights = null) =>
    tiledSurface({
      gap: line, a: base, b: base,
      highlight: 'rgba(255,255,255,.16)', shadow: 'rgba(0,0,0,.24)',
    }, 54, (context, x, y, value) => {
      if (lights && value > 0.58) {
        context.fillStyle = lights;
        context.fillRect(x + 4, y + 6, 8, 3);
      }
    });

  function makeCeilings() {
    return {
      water: surface(64, 64, context => {
        context.fillStyle = '#072f52';
        context.fillRect(0, 0, 64, 64);
        context.strokeStyle = 'rgba(92, 232, 229, .6)';
        for (let i = 0; i < 12; i += 1) {
          const y = i * 6;
          context.beginPath();
          context.moveTo(0, y);
          context.bezierCurveTo(16, y + 8, 31, y - 7, 48, y + 2);
          context.lineTo(64, y - 2);
          context.stroke();
        }
      }),
      stars: surface(64, 64, context => {
        context.fillStyle = '#02040c';
        context.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 50; i += 1) {
          const x = Math.floor(noise(i, 2, 80) * 64);
          const y = Math.floor(noise(7, i, 82) * 64);
          context.fillStyle = i % 9 === 0 ? '#7deaf2' : '#ddd9c9';
          context.fillRect(x, y, i % 11 === 0 ? 2 : 1, 1);
        }
      }),
      sandstone: ceiling('#8e6638', '#583a20'),
      vault: ceiling('#302c35', '#17151b', '#655b73'),
      sky: surface(64, 64, context => {
        context.fillStyle = '#1774ac';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = 'rgba(232, 248, 248, .75)';
        context.fillRect(4, 13, 24, 4);
        context.fillRect(12, 9, 12, 8);
        context.fillRect(38, 42, 20, 4);
        context.fillRect(44, 38, 9, 7);
      }),
      ice: ceiling('#7fb5c6', '#346a81', '#d9ffff'),
      industrial: ceiling('#20272a', '#080b0c', '#ec7c2a'),
      dark: ceiling('#201a19', '#0b0909', '#62534e'),
      brass: ceiling('#5f481d', '#281c0b', '#e5ba5d'),
    };
  }

  function makeCreatureFrame(type, frame) {
    return surface(48, 48, context => {
      const bob = frame % 2;
      const flap = frame < 2 ? 0 : 3;
      context.clearRect(0, 0, 48, 48);

      if (type === 'fish') {
        context.fillStyle = '#f1a545';
        context.beginPath();
        context.ellipse(25, 25 - bob, 13, 7, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#e16d3c';
        context.beginPath();
        context.moveTo(13, 25 - bob);
        context.lineTo(4, 17 + flap);
        context.lineTo(4, 33 - flap);
        context.fill();
        context.fillStyle = '#e8f7db';
        context.fillRect(32, 22 - bob, 3, 3);
        context.fillStyle = '#141418';
        context.fillRect(34, 23 - bob, 1, 1);
      } else if (type === 'crab') {
        context.fillStyle = '#df6247';
        context.fillRect(13, 20 - bob, 23, 12);
        context.fillRect(9, 23 - bob, 5, 5);
        context.fillRect(36, 23 - bob, 5, 5);
        context.strokeStyle = '#ff9471';
        for (let i = 0; i < 4; i += 1) {
          context.beginPath();
          context.moveTo(16 + i * 5, 30 - bob);
          context.lineTo(12 + i * 7, 38 - (i + frame) % 3);
          context.stroke();
        }
        context.fillStyle = '#171313';
        context.fillRect(19, 22 - bob, 2, 2);
        context.fillRect(29, 22 - bob, 2, 2);
      } else if (type === 'drone') {
        context.fillStyle = '#818da0';
        context.fillRect(9, 21 - bob, 30, 10);
        context.fillStyle = '#334158';
        context.fillRect(14, 17 - bob, 20, 5);
        context.fillStyle = frame % 2 ? '#ff624d' : '#57f4e8';
        context.fillRect(21, 24 - bob, 7, 4);
        context.fillStyle = '#c7d1d1';
        context.fillRect(3, 18 + flap - bob, 11, 2);
        context.fillRect(34, 18 + flap - bob, 11, 2);
      } else if (type === 'alien') {
        context.fillStyle = '#65c76c';
        context.beginPath();
        context.ellipse(24, 22 - bob, 11, 13, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#18222a';
        context.fillRect(16, 19 - bob, 6, 7);
        context.fillRect(27, 19 - bob, 6, 7);
        context.fillStyle = '#a6f09a';
        context.fillRect(19, 35 - bob, 4, 8);
        context.fillRect(27, 35 - bob, 4, 8);
      } else if (type === 'scarab' || type === 'gearbug') {
        context.fillStyle = type === 'scarab' ? '#2d9c80' : '#a98332';
        context.beginPath();
        context.ellipse(24, 26 - bob, 10, 13, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = type === 'scarab' ? '#c8b54c' : '#ebc766';
        context.beginPath();
        context.moveTo(24, 14 - bob);
        context.lineTo(24, 38 - bob);
        context.stroke();
        for (let i = 0; i < 3; i += 1) {
          context.beginPath();
          context.moveTo(16, 21 + i * 6 - bob);
          context.lineTo(7 - flap, 17 + i * 8);
          context.moveTo(32, 21 + i * 6 - bob);
          context.lineTo(41 + flap, 17 + i * 8);
          context.stroke();
        }
      } else if (type === 'mummy' || type === 'robot') {
        context.fillStyle = type === 'mummy' ? '#c9b98b' : '#7b8e94';
        context.fillRect(17, 7 - bob, 14, 13);
        context.fillRect(15, 20 - bob, 18, 18);
        context.fillRect(11 - flap, 21 - bob, 5, 17);
        context.fillRect(33 + flap, 21 - bob, 5, 17);
        context.fillRect(17 + flap, 37 - bob, 6, 10);
        context.fillRect(26 - flap, 37 - bob, 6, 10);
        context.fillStyle = type === 'mummy' ? '#25251e' : '#ff643f';
        context.fillRect(19, 12 - bob, 4, 3);
        context.fillRect(26, 12 - bob, 4, 3);
        if (type === 'mummy') {
          context.strokeStyle = '#807354';
          for (let y = 9; y < 37; y += 5) {
            context.beginPath();
            context.moveTo(16, y - bob);
            context.lineTo(33, y + 2 - bob);
            context.stroke();
          }
        }
      } else if (type === 'bat' || type === 'gull') {
        context.fillStyle = type === 'bat' ? '#43344d' : '#e6e6dc';
        context.beginPath();
        context.moveTo(24, 23 - bob);
        context.lineTo(5, 12 + flap);
        context.lineTo(11, 29 - flap);
        context.lineTo(24, 28 - bob);
        context.lineTo(37, 29 - flap);
        context.lineTo(43, 12 + flap);
        context.closePath();
        context.fill();
        context.fillStyle = type === 'bat' ? '#b35865' : '#e8a63c';
        context.fillRect(21, 20 - bob, 7, 10);
      } else if (type === 'ghost') {
        context.fillStyle = 'rgba(203, 229, 221, .82)';
        context.beginPath();
        context.arc(24, 19 - bob, 12, Math.PI, 0);
        context.lineTo(36, 40);
        context.lineTo(30, 35 + flap);
        context.lineTo(24, 41);
        context.lineTo(18, 35 + flap);
        context.lineTo(12, 40);
        context.closePath();
        context.fill();
        context.fillStyle = '#263347';
        context.fillRect(17, 18 - bob, 4, 6);
        context.fillRect(28, 18 - bob, 4, 6);
      } else if (type === 'marten') {
        context.fillStyle = '#8b5a36';
        context.fillRect(10, 21 - bob, 27, 12);
        context.fillRect(32, 17 - bob, 10, 12);
        context.fillStyle = '#d7b17c';
        context.fillRect(35, 22 - bob, 8, 5);
        context.strokeStyle = '#704024';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(11, 24 - bob);
        context.quadraticCurveTo(0, 15 + flap, 3, 35);
        context.stroke();
        context.fillStyle = '#17130f';
        context.fillRect(38, 19 - bob, 2, 2);
      } else if (type === 'frostling') {
        context.fillStyle = '#d9f1ed';
        context.beginPath();
        context.ellipse(24, 26 - bob, 11, 17, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#34556b';
        context.fillRect(18, 17 - bob, 12, 15);
        context.fillStyle = '#f1a33d';
        context.fillRect(22, 24 - bob, 8, 3);
      } else if (type === 'spider') {
        context.fillStyle = '#4a2831';
        context.beginPath();
        context.arc(24, 26 - bob, 8, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#b05c50';
        for (let i = 0; i < 4; i += 1) {
          context.beginPath();
          context.moveTo(18, 22 + i * 3 - bob);
          context.lineTo(5, 13 + i * 8 + (frame % 2));
          context.moveTo(30, 22 + i * 3 - bob);
          context.lineTo(43, 13 + i * 8 - (frame % 2));
          context.stroke();
        }
      }
    });
  }

  function makeRelic(type) {
    return surface(32, 32, context => {
      context.clearRect(0, 0, 32, 32);
      context.fillStyle = 'rgba(255, 221, 101, .16)';
      context.beginPath();
      context.arc(16, 16, 14, 0, Math.PI * 2);
      context.fill();

      if (type === 'pearl') {
        const gradient = context.createRadialGradient(12, 11, 2, 16, 16, 10);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.45, '#a5edf0');
        gradient.addColorStop(1, '#397e99');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(16, 16, 9, 0, Math.PI * 2);
        context.fill();
      } else if (type === 'star') {
        context.fillStyle = '#f4e477';
        context.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const radius = i % 2 ? 4 : 11;
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          const x = 16 + Math.cos(angle) * radius;
          const y = 16 + Math.sin(angle) * radius;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.fill();
      } else if (type === 'ankh') {
        context.strokeStyle = '#f2c35e';
        context.lineWidth = 4;
        context.beginPath();
        context.ellipse(16, 9, 5, 6, 0, 0, Math.PI * 2);
        context.moveTo(16, 15);
        context.lineTo(16, 28);
        context.moveTo(8, 20);
        context.lineTo(24, 20);
        context.stroke();
      } else if (type === 'heart') {
        context.fillStyle = '#e23f45';
        context.beginPath();
        context.moveTo(16, 27);
        context.bezierCurveTo(4, 18, 5, 7, 11, 7);
        context.bezierCurveTo(15, 7, 16, 11, 16, 11);
        context.bezierCurveTo(18, 7, 26, 6, 27, 13);
        context.bezierCurveTo(28, 19, 21, 24, 16, 27);
        context.fill();
        context.fillStyle = '#f4efe5';
        context.fillRect(13, 12, 3, 3);
      } else if (type === 'crystal') {
        context.fillStyle = '#7ff5ff';
        context.beginPath();
        context.moveTo(16, 3);
        context.lineTo(25, 12);
        context.lineTo(20, 28);
        context.lineTo(10, 28);
        context.lineTo(6, 13);
        context.closePath();
        context.fill();
        context.fillStyle = '#e7ffff';
        context.beginPath();
        context.moveTo(16, 4);
        context.lineTo(16, 26);
        context.lineTo(9, 13);
        context.closePath();
        context.fill();
      } else if (type === 'fuse') {
        context.fillStyle = '#42484b';
        context.fillRect(9, 5, 14, 23);
        context.fillStyle = '#ff7c21';
        context.fillRect(12, 9, 8, 13);
        context.fillStyle = '#fee36a';
        context.fillRect(14, 11, 4, 9);
        context.fillStyle = '#b6c4c1';
        context.fillRect(7, 4, 18, 4);
        context.fillRect(7, 25, 18, 4);
      } else if (type === 'book') {
        context.fillStyle = '#74384b';
        context.fillRect(6, 5, 21, 23);
        context.fillStyle = '#d5b36a';
        context.fillRect(8, 7, 3, 19);
        context.fillRect(14, 10, 9, 2);
        context.fillRect(14, 15, 7, 2);
      } else if (type === 'gear') {
        context.fillStyle = '#d2a449';
        context.beginPath();
        context.arc(16, 16, 10, 0, Math.PI * 2);
        context.fill();
        for (let i = 0; i < 8; i += 1) {
          const angle = i * Math.PI / 4;
          context.save();
          context.translate(16 + Math.cos(angle) * 11, 16 + Math.sin(angle) * 11);
          context.rotate(angle);
          context.fillRect(-3, -2, 6, 4);
          context.restore();
        }
        context.fillStyle = '#4d3917';
        context.beginPath();
        context.arc(16, 16, 4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = '#a8e56d';
        context.fillRect(7, 8, 18, 18);
        context.fillStyle = '#183e23';
        context.fillRect(10, 11, 12, 4);
        context.fillRect(10, 18, 8, 5);
        context.fillStyle = '#d9ffd9';
        context.fillRect(12, 19, 4, 2);
      }
    });
  }

  Maze3D.enrichTextures = base => {
    const creatureTypes = [
      'fish', 'crab', 'drone', 'alien', 'scarab', 'mummy', 'bat',
      'ghost', 'marten', 'gull', 'frostling', 'robot', 'spider', 'gearbug',
    ];
    const relicTypes = [
      'disk', 'pearl', 'star', 'ankh', 'heart',
      'crystal', 'fuse', 'book', 'gear',
    ];
    return {
      walls: {
        brick: base.walls[1],
        moss: base.walls[3],
        tech: base.walls[4],
        ...makeWalls(),
      },
      floors: {
        stone: base.floor,
        ...makeFloors(),
      },
      ceilings: {
        plaster: base.ceiling,
        ...makeCeilings(),
      },
      exit: base.exit,
      inversion: base.inversion,
      creatures: {
        rat: base.rats,
        ...Object.fromEntries(creatureTypes.map(type => [
          type,
          [0, 1, 2, 3].map(frame => makeCreatureFrame(type, frame)),
        ])),
      },
      relics: Object.fromEntries(relicTypes.map(type => [type, makeRelic(type)])),
    };
  };
})();
