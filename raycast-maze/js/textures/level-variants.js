(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const STYLES = {
    sandstone:  ['#9b6a38', '#e0bd78', 'glyph'],
    coral:      ['#1e6876', '#df7b6f', 'bubbles'],
    space:      ['#081329', '#58e4df', 'stars'],
    obsidian:   ['#1a1720', '#c55435', 'cracks'],
    croatia:    ['#d4cfbd', '#d83d3d', 'checker'],
    ice:        ['#5aa8bf', '#ecffff', 'shards'],
    foundry:    ['#22272a', '#f08024', 'hazard'],
    archive:    ['#54301f', '#d0ae64', 'shelves'],
    brass:      ['#70511b', '#e4bd58', 'gears'],
    grave:      ['#424a4d', '#94a07f', 'crosses'],
    pipe:       ['#8f4532', '#55ce69', 'pipes'],
    royal:      ['#681a25', '#e0b64d', 'diamonds'],
    hospital:   ['#979b8e', '#9b302b', 'stripe'],
    ruin:       ['#554d45', '#b55b32', 'cracks'],
    cyber:      ['#071a26', '#00dfd2', 'circuit'],
    candy:      ['#efd8bd', '#e75e70', 'candy'],
    marble:     ['#d0d0c7', '#657b88', 'veins'],
    ship:       ['#653a24', '#d0a35e', 'portholes'],
    adobe:      ['#aa713e', '#ead092', 'diamonds'],
    jungle:     ['#27452b', '#88a54a', 'vines'],
    toy:        ['#d4473d', '#f3ca48', 'blocks'],
    noir:       ['#25292c', '#b8c5c4', 'windows'],
    shrine:     ['#d0c5b3', '#ad312b', 'beams'],
    dream:      ['#73bbc2', '#f0c09d', 'waves'],
    gothic:     ['#444a4e', '#9aa1a0', 'arches'],
    deco:       ['#132126', '#dfb85c', 'fan'],
    chinese:    ['#8f3029', '#dcb653', 'clouds'],
    caravan:    ['#ad743d', '#3c9ca0', 'mosaic'],
    maya:       ['#465f40', '#b6a158', 'steps'],
    inca:       ['#7b7464', '#d1b96f', 'polygon'],
    roman:      ['#a85f45', '#e1d2b3', 'columns'],
    mandir:     ['#ad7048', '#e2b76d', 'floral'],
    khmer:      ['#604c3d', '#829657', 'relief'],
    sahel:      ['#aa703d', '#3a291e', 'timber'],
    persian:    ['#28687b', '#e1bd5d', 'mosaic'],
    norse:      ['#513a2a', '#a88a63', 'runes'],
    polynesian: ['#503b2b', '#dda95c', 'zigzag'],
    byzantine:  ['#55483a', '#dfb249', 'tesserae'],
    korean:     ['#435d4e', '#d05142', 'dancheong'],
    frutiger:   ['#2f7d9e', '#bdf3ec', 'bubbles'],
    psx:        ['#241d2c', '#7a5f8a', 'polygon'],
    stainedglass:['#241f2e', '#e0b64d', 'diamonds'],
    nouveau:    ['#2c4a38', '#d4ad68', 'floral'],
    solarpunk:  ['#6f9b7c', '#f0c84a', 'stars'],
    diesel:     ['#2c3032', '#b6ad91', 'hazard'],
    prehistoric:['#45372a', '#be7a45', 'glyph'],
    celtic:     ['#3e5545', '#b7a965', 'relief'],
    brutalist:  ['#585d60', '#8d9192', 'windows'],
    storybook:  ['#8a6f4e', '#49372a', 'shelves'],
  };

  const surface = source => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0);
    return { canvas, context };
  };

  function drawMotif(context, motif, accent) {
    context.fillStyle = accent;
    context.strokeStyle = accent;
    context.lineWidth = 2;
    context.globalAlpha = 0.72;

    if (motif === 'band' || motif === 'stripe') {
      context.fillRect(0, 27, 64, motif === 'stripe' ? 8 : 4);
      if (motif === 'stripe') {
        context.fillStyle = '#ece5cf';
        for (let x = 0; x < 64; x += 16) context.fillRect(x, 27, 8, 8);
      }
    } else if (motif === 'glyph' || motif === 'runes') {
      for (let x = 5; x < 64; x += 13) {
        context.beginPath();
        context.moveTo(x, 12);
        context.lineTo(x + 5, 21);
        context.lineTo(x, 31);
        context.moveTo(x + 5, 21);
        context.lineTo(x + 10, 15);
        context.stroke();
      }
    } else if (motif === 'bubbles' || motif === 'portholes') {
      for (let y = 12; y < 64; y += 25) {
        for (let x = 10; x < 64; x += 22) {
          context.beginPath();
          context.arc(x, y, motif === 'portholes' ? 6 : 3, 0, Math.PI * 2);
          context.stroke();
        }
      }
    } else if (motif === 'stars') {
      for (let i = 0; i < 22; i += 1) {
        const x = i * 29 % 61 + 1;
        const y = i * 17 % 59 + 2;
        context.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
      }
    } else if (motif === 'cracks' || motif === 'veins') {
      for (let x = -3; x < 70; x += 14) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + 6, 18);
        context.lineTo(x + 1, 38);
        context.lineTo(x + 8, 64);
        context.stroke();
      }
    } else if (motif === 'checker' || motif === 'blocks' || motif === 'tesserae') {
      const size = motif === 'tesserae' ? 6 : 8;
      for (let y = 0; y < 64; y += size) {
        for (let x = 0; x < 64; x += size) {
          if ((x + y) / size % 2) context.fillRect(x, y, size, size);
        }
      }
    } else if (motif === 'shards') {
      for (let x = 4; x < 64; x += 12) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + 8, 18);
        context.lineTo(x + 2, 35);
        context.lineTo(x + 10, 64);
        context.stroke();
      }
    } else if (motif === 'hazard') {
      context.save();
      context.rotate(-Math.PI / 4);
      for (let x = -70; x < 100; x += 18) context.fillRect(x, -35, 8, 140);
      context.restore();
    } else if (motif === 'shelves') {
      for (let y = 14; y < 64; y += 16) {
        context.fillRect(0, y, 64, 3);
        for (let x = 3; x < 64; x += 9) context.fillRect(x, y - 10, 5, 10);
      }
    } else if (motif === 'gears' || motif === 'candy') {
      for (let y = 10; y < 64; y += 22) {
        for (let x = 10; x < 64; x += 22) {
          context.beginPath();
          context.arc(x, y, motif === 'gears' ? 6 : 4, 0, Math.PI * 2);
          context.stroke();
          if (motif === 'gears') context.fillRect(x - 2, y - 2, 4, 4);
        }
      }
    } else if (motif === 'crosses') {
      for (let x = 8; x < 64; x += 16) {
        context.fillRect(x, 7, 3, 18);
        context.fillRect(x - 5, 12, 13, 3);
      }
    } else if (motif === 'pipes' || motif === 'circuit') {
      for (let x = 6; x < 64; x += 15) {
        context.fillRect(x, 0, 3, 21);
        context.fillRect(x, 18, 10, 3);
        context.fillRect(x + 7, 18, 3, 18);
      }
    } else if (motif === 'diamonds' || motif === 'mosaic') {
      for (let y = 9; y < 64; y += 18) {
        for (let x = 9; x < 64; x += 18) {
          context.beginPath();
          context.moveTo(x, y - 6);
          context.lineTo(x + 6, y);
          context.lineTo(x, y + 6);
          context.lineTo(x - 6, y);
          context.closePath();
          context.stroke();
        }
      }
    } else if (motif === 'vines' || motif === 'relief' || motif === 'floral') {
      context.beginPath();
      context.moveTo(5, 0);
      context.bezierCurveTo(34, 15, 1, 36, 39, 64);
      context.stroke();
      for (let y = 8; y < 60; y += 13) {
        context.beginPath();
        context.ellipse(18 + y % 17, y, 6, 3, y * 0.1, 0, Math.PI * 2);
        context.stroke();
      }
    } else if (motif === 'windows' || motif === 'beams' || motif === 'columns') {
      for (let x = 7; x < 64; x += 16) {
        context.fillRect(x, 3, motif === 'columns' ? 5 : 8, 58);
        if (motif === 'windows') {
          context.fillStyle = 'rgba(235, 225, 175, .7)';
          context.fillRect(x + 2, 9, 4, 8);
          context.fillRect(x + 2, 25, 4, 8);
        }
      }
      if (motif === 'beams') context.fillRect(0, 25, 64, 5);
    } else if (motif === 'waves' || motif === 'clouds') {
      for (let y = 8; y < 64; y += 14) {
        context.beginPath();
        for (let x = 0; x <= 64; x += 4) {
          const py = y + Math.sin((x + y) * 0.25) * 3;
          if (x === 0) context.moveTo(x, py);
          else context.lineTo(x, py);
        }
        context.stroke();
      }
    } else if (motif === 'arches' || motif === 'fan') {
      for (let x = 8; x < 64; x += 16) {
        context.beginPath();
        context.moveTo(x - 6, 30);
        context.lineTo(x - 6, 18);
        context.quadraticCurveTo(x, motif === 'fan' ? 3 : 8, x + 6, 18);
        context.lineTo(x + 6, 30);
        context.stroke();
      }
    } else if (motif === 'steps') {
      for (let x = 2; x < 64; x += 16) {
        context.fillRect(x, 8, 5, 5);
        context.fillRect(x + 5, 13, 5, 5);
        context.fillRect(x + 10, 18, 5, 5);
        context.fillRect(x + 5, 23, 5, 5);
      }
    } else if (motif === 'polygon') {
      context.beginPath();
      context.moveTo(0, 12); context.lineTo(13, 7); context.lineTo(24, 14);
      context.lineTo(39, 9); context.lineTo(52, 15); context.lineTo(64, 10);
      context.moveTo(0, 38); context.lineTo(17, 29); context.lineTo(33, 37);
      context.lineTo(49, 31); context.lineTo(64, 39);
      context.stroke();
    } else if (motif === 'timber') {
      for (let x = 8; x < 64; x += 16) {
        context.fillRect(x, 4, 3, 24);
        context.fillRect(x - 5, 10, 13, 3);
      }
    } else if (motif === 'zigzag' || motif === 'dancheong') {
      for (let y = 8; y < 64; y += 16) {
        context.beginPath();
        for (let x = 0; x <= 64; x += 8) {
          context.lineTo(x, y + (x / 8 % 2 ? 6 : 0));
        }
        context.stroke();
      }
      if (motif === 'dancheong') {
        for (let x = 8; x < 64; x += 16) {
          context.beginPath();
          context.arc(x, 39, 5, 0, Math.PI * 2);
          context.stroke();
        }
      }
    }
    context.globalAlpha = 1;
  }

  // Level 1 keeps its original red-brick palette and mortar layout: the
  // variant only adds sparse deterministic chips and hairline cracks inside
  // each brick face, clamped clear of the mortar joints and bevel strips.
  // Core brick geometry: 12px rows at y = row * 12 - 3, alternating x
  // offsets -11/0, 22px bricks with 2px bevels under the face edges.
  function drawBrickWear(context) {
    const rand = i => {
      let v = Math.imul(i + 101, 374761393) ^ Math.imul(i - 57, 668265263);
      v = Math.imul(v ^ (v >>> 13), 1274126177);
      return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
    };
    const CHIP = 'rgba(52, 26, 18, .22)';
    const PALE = 'rgba(224, 160, 120, .18)';
    for (let row = 0; row < 6; row += 1) {
      const y = row * 12 - 3;
      const offset = row % 2 ? -11 : 0;
      for (let x = offset; x < 64; x += 22) {
        const loX = Math.max(x + 3, 0);
        const hiX = Math.min(x + 18, 63);
        const loY = Math.max(y + 4, 0);
        const hiY = Math.min(y + 7, 63);
        if (hiX - loX < 2 || hiY < loY) continue;
        const cell = row * 8 + Math.round((x - offset) / 22);
        if (rand(cell + 1) >= 0.4) continue;
        const px = loX + Math.floor(rand(cell + 7) * (hiX - loX));
        const py = loY + Math.floor(rand(cell + 13) * (hiY - loY + 1));
        context.fillStyle = CHIP;
        context.fillRect(px, py, rand(cell + 19) < 0.5 ? 2 : 1, 1);
        if (rand(cell + 23) < 0.4) {
          context.fillRect(px + 1, Math.min(py + 1, hiY), 1, 1);
        }
        if (rand(cell + 29) < 0.5) {
          context.fillStyle = PALE;
          context.fillRect(Math.min(px + 2, hiX), py, 1, 1);
        }
      }
    }
  }

  function createVariant(source, key) {
    const { canvas, context } = surface(source);
    if (key === 'brick') {
      drawBrickWear(context);
      return canvas;
    }
    const style = STYLES[key] || ['#333333', '#aaaaaa', 'band'];
    context.globalCompositeOperation = 'source-atop';
    context.fillStyle = `${style[0]}66`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';
    drawMotif(context, style[2], style[1]);
    return canvas;
  }

  Maze3D.installLevelTextureVariants = textures => {
    const cache = new Map();
    textures.getWallVariant = key => {
      if (cache.has(key)) return cache.get(key);
      const source = textures.walls[key] || textures.walls.brick;
      const variant = createVariant(source, key);
      cache.set(key, variant);
      return variant;
    };
    textures.getVariantCount = () => cache.size;
    return textures;
  };
})();
