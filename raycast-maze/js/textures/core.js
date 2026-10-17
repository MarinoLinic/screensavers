(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const createSurface = (width, height, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    draw(context, width, height);
    return canvas;
  };

  const hash = (x, y, seed = 0) => {
    let value = Math.imul(x + seed * 17, 374761393) +
      Math.imul(y - seed * 31, 668265263);
    value = (value ^ (value >>> 13)) * 1274126177;
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };

  const tint = (hex, amount) => {
    const value = Number.parseInt(hex.slice(1), 16);
    const channel = shift => Math.max(0, Math.min(255, (value >> shift & 255) + amount));
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  };

  function makeBrickTexture(palette, seed, moss = false) {
    return createSurface(64, 64, (context, width, height) => {
      context.fillStyle = palette.mortar;
      context.fillRect(0, 0, width, height);

      const brickHeight = 12;
      const brickWidth = 22;
      for (let row = 0; row < 6; row += 1) {
        const y = row * brickHeight - 3;
        const offset = row % 2 ? -11 : 0;
        for (let x = offset; x < width; x += brickWidth) {
          const variation = Math.round((hash(x, row, seed) - 0.5) * 24);
          context.fillStyle = tint(palette.brick, variation);
          context.fillRect(x + 1, y + 1, brickWidth - 2, brickHeight - 2);
          context.fillStyle = tint(palette.brick, variation + 16);
          context.fillRect(x + 2, y + 2, brickWidth - 4, 2);
          context.fillStyle = tint(palette.brick, variation - 18);
          context.fillRect(x + 2, y + brickHeight - 4, brickWidth - 4, 2);

          for (let speck = 0; speck < 5; speck += 1) {
            const sx = x + 2 + Math.floor(hash(x + speck, row, seed + 4) * (brickWidth - 5));
            const sy = y + 3 + Math.floor(hash(x, row + speck, seed + 9) * (brickHeight - 6));
            context.fillStyle = hash(sx, sy, seed) > 0.5
              ? 'rgba(255, 224, 184, .13)'
              : 'rgba(35, 8, 4, .16)';
            context.fillRect(sx, sy, 2, 1);
          }
        }
      }

      if (moss) {
        for (let y = 0; y < height; y += 2) {
          for (let x = 0; x < width; x += 2) {
            const growth = hash(x, y, seed + 37) * (1 - y / height);
            if (growth > 0.79) {
              context.fillStyle = growth > 0.9 ? '#76933e' : '#3f642c';
              context.fillRect(x, y, 2, 3 + Math.floor(hash(y, x, seed) * 5));
            }
          }
        }
      }
    });
  }

  function makeTechTexture() {
    return createSurface(64, 64, (context, width, height) => {
      context.fillStyle = '#23343a';
      context.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 16) {
        for (let x = 0; x < width; x += 16) {
          const bright = (x + y) / 16 % 2 === 0;
          context.fillStyle = bright ? '#536b69' : '#405856';
          context.fillRect(x + 1, y + 1, 14, 14);
          context.fillStyle = '#819486';
          context.fillRect(x + 2, y + 2, 12, 2);
          context.fillStyle = '#16272d';
          context.fillRect(x + 2, y + 13, 12, 2);
          context.fillStyle = '#b9c38d';
          context.fillRect(x + 4, y + 5, 2, 2);
          context.fillRect(x + 10, y + 9, 2, 2);
        }
      }
      context.fillStyle = 'rgba(91, 255, 216, .24)';
      context.fillRect(31, 0, 2, height);
    });
  }

  function makeStoneTexture() {
    return createSurface(64, 64, (context, width, height) => {
      context.fillStyle = '#30343a';
      context.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 16) {
        for (let x = 0; x < width; x += 16) {
          const variation = Math.round((hash(x, y, 11) - 0.5) * 22);
          context.fillStyle = tint('#74777a', variation);
          context.fillRect(x + 1, y + 1, 14, 14);
          context.fillStyle = tint('#74777a', variation + 14);
          context.fillRect(x + 2, y + 2, 12, 2);
          context.fillStyle = tint('#74777a', variation - 18);
          context.fillRect(x + 2, y + 13, 12, 2);
          if (hash(x, y, 22) > 0.54) {
            context.fillStyle = 'rgba(25, 28, 29, .38)';
            context.fillRect(x + 5, y + 7, 6, 1);
            context.fillRect(x + 8, y + 5, 1, 4);
          }
        }
      }
    });
  }

  function makeCeilingTexture() {
    return createSurface(64, 64, (context, width, height) => {
      context.fillStyle = '#60605d';
      context.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 16) {
        for (let x = 0; x < width; x += 16) {
          const variation = Math.round((hash(x, y, 51) - 0.5) * 18);
          context.fillStyle = tint('#9c998d', variation);
          context.fillRect(x + 1, y + 1, 14, 14);
          if (hash(x, y, 72) > 0.75) {
            context.fillStyle = 'rgba(89, 82, 66, .26)';
            context.fillRect(x + 4, y + 8, 8, 2);
          }
        }
      }
    });
  }

  function makeExitSprite() {
    return createSurface(48, 72, (context, width, height) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(56, 255, 126, .12)';
      context.fillRect(2, 2, width - 4, height - 4);
      context.fillStyle = '#143d25';
      context.fillRect(7, 7, width - 14, height - 9);
      context.fillStyle = '#4cff7c';
      context.fillRect(4, 3, width - 8, 5);
      context.fillRect(4, 3, 5, height - 3);
      context.fillRect(width - 9, 3, 5, height - 3);
      context.fillStyle = '#cbffd6';
      context.fillRect(13, 16, 22, 17);
      context.fillStyle = '#186e34';
      context.fillRect(15, 18, 18, 13);
      context.fillStyle = '#d9ffe2';
      context.fillRect(19, 21, 10, 3);
      context.fillRect(24, 18, 3, 9);
      context.fillStyle = '#79ff9a';
      context.font = 'bold 9px monospace';
      context.textAlign = 'center';
      context.fillText('EXIT', width / 2, 47);
      context.fillStyle = '#b7ffc7';
      context.fillRect(34, 55, 3, 3);
    });
  }

  function makeInversionSprite() {
    return createSurface(40, 40, (context, width, height) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(83, 246, 255, .16)';
      context.beginPath();
      context.arc(20, 20, 18, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#c8ffff';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#2fd8e8';
      context.beginPath();
      context.moveTo(20, 4);
      context.lineTo(34, 20);
      context.lineTo(20, 36);
      context.lineTo(6, 20);
      context.closePath();
      context.fill();
      context.fillStyle = '#0d606f';
      context.fillRect(17, 9, 6, 22);
      context.fillStyle = '#eaffff';
      context.fillRect(18, 10, 2, 19);
    });
  }

  function makeRatFrame(frame) {
    return createSurface(48, 32, context => {
      context.clearRect(0, 0, 48, 32);
      const bob = frame % 2;
      const footShift = frame < 2 ? 0 : 2;

      context.fillStyle = '#4a2721';
      context.fillRect(3, 19 - bob, 12, 2);
      context.fillRect(1, 17 - bob, 5, 2);
      context.fillStyle = '#8b5144';
      context.fillRect(13, 12 - bob, 24, 13);
      context.fillStyle = '#b87962';
      context.fillRect(17, 10 - bob, 16, 3);
      context.fillStyle = '#754036';
      context.fillRect(31, 14 - bob, 10, 10);
      context.fillStyle = '#d59a86';
      context.fillRect(35, 10 - bob, 5, 5);
      context.fillRect(40, 18 - bob, 5, 4);
      context.fillStyle = '#f0c2ae';
      context.fillRect(43, 19 - bob, 3, 2);
      context.fillStyle = '#f7e7bf';
      context.fillRect(38, 15 - bob, 2, 2);
      context.fillStyle = '#17100e';
      context.fillRect(39, 15 - bob, 1, 1);
      context.fillStyle = '#38201b';
      context.fillRect(16 + footShift, 24 - bob, 5, 3);
      context.fillRect(30 - footShift, 24 - bob, 5, 3);
      context.fillStyle = '#d1a79a';
      context.fillRect(15 + footShift, 27 - bob, 7, 1);
      context.fillRect(29 - footShift, 27 - bob, 7, 1);
      context.strokeStyle = '#d8b8a8';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(42, 20 - bob);
      context.lineTo(47, 18 - bob);
      context.moveTo(42, 21 - bob);
      context.lineTo(47, 22 - bob);
      context.stroke();
    });
  }

  Maze3D.createTextures = () => ({
    walls: [
      null,
      makeBrickTexture({ mortar: '#34211b', brick: '#91452f' }, 3),
      null,
      makeBrickTexture({ mortar: '#27331e', brick: '#66713d' }, 17, true),
      makeTechTexture(),
    ],
    floor: makeStoneTexture(),
    ceiling: makeCeilingTexture(),
    exit: makeExitSprite(),
    inversion: makeInversionSprite(),
    rats: [0, 1, 2, 3].map(makeRatFrame),
  });
})();
