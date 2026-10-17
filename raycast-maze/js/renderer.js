(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const MIN_W = 200;
  const MIN_H = 180;
  const MAX_RAY_STEPS = 128;

  const DEFAULT_THEME = {
    wall: 'brick', floor: 'stone', ceiling: 'plaster',
    fogColor: [4, 8, 6], fogDistance: 17, particles: 'dust', moveScale: 1,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const grabPixels = source => {
    const probe = document.createElement('canvas');
    probe.width = source.width;
    probe.height = source.height;
    const ctx = probe.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, source.width, source.height).data;
    return { data, width: source.width, height: source.height };
  };

  const hash01 = (i, salt) => {
    let v = Math.imul(i + salt * 131, 374761393) ^ Math.imul(i - salt * 57, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };

  class Renderer {
    constructor(canvas, textures, config, { lowRes = true } = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.textures = textures;
      this.config = config;
      this.lowRes = !!lowRes;

      this.scene = document.createElement('canvas');
      this.sceneCtx = this.scene.getContext('2d');

      this.pixelCache = new WeakMap();
      this.footCache = new WeakMap();
      this.mapCache = null;
      this.fovPoints = new Float32Array(21 * 2);
      this.vignette = document.createElement('canvas');
      this.fogCanvas = document.createElement('canvas');
      this.fogCtx = this.fogCanvas.getContext('2d');

      this.applyQuality();
      this.resize();
    }

    /**
     * Quality toggle. lowRes = the classic chunky look (0.55 scale, 800x450
     * cap, 2px sample steps, nearest-neighbor); off = full-res sampling at up
     * to 1280x720 with smooth canvas resampling. Same horizontal-FOV
     * projection either way — only the pixel density changes.
     */
    applyQuality() {
      const l = this.lowRes;
      this.renderScale = l ? 0.55 : 1;
      this.maxW = l ? 800 : 1280;
      this.maxH = l ? 450 : 720;
      this.floorStepX = l ? 2 : 1;
      this.floorStepY = l ? 2 : 1;
      this.rayStep = l ? 2 : 1;
      this.spriteStep = l ? 2 : 1;
      this.ctx.imageSmoothingEnabled = !l;
      this.sceneCtx.imageSmoothingEnabled = !l;
    }

    /** Toggle render quality; never advances the world or input state. */
    setLowRes(enabled) {
      this.lowRes = !!enabled;
      // Fields + smoothing update even when the backing-store size turns out
      // unchanged (severely constrained aspect can no-op the resize).
      this.applyQuality();
      this.resize();
    }

    texturePixels(texture) {
      let pixels = this.pixelCache.get(texture);
      if (!pixels) {
        pixels = grabPixels(texture);
        this.pixelCache.set(texture, pixels);
      }
      return pixels;
    }

    // Fraction of the sprite image that is visible above its lowest opaque
    // pixel: (lastOpaqueRow + 1) / height. A fully transparent image falls
    // back to 1 so it anchors on its nominal bottom edge.
    spriteFootFraction(image) {
      let fraction = this.footCache.get(image);
      if (fraction === undefined) {
        const { data, width, height } = this.texturePixels(image);
        let last = -1;
        for (let y = height - 1; y >= 0 && last < 0; y -= 1) {
          for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] > 0) {
              last = y;
              break;
            }
          }
        }
        fraction = last < 0 ? 1 : (last + 1) / height;
        this.footCache.set(image, fraction);
      }
      return fraction;
    }

    resize() {
      const vw = window.innerWidth || 960;
      const vh = window.innerHeight || 540;
      // One shared scale for both axes keeps the buffer's aspect ratio equal
      // to the viewport's: independent min clamps used to stretch portrait.
      const scale = Math.min(
        Math.max(this.renderScale, MIN_W / vw, MIN_H / vh),
        this.maxW / vw, this.maxH / vh);
      const nextWidth = Math.max(1, Math.round(vw * scale));
      const nextHeight = Math.max(1, Math.round(vh * scale));
      if (nextWidth === this.width && nextHeight === this.height && this.frame) {
        return;
      }
      this.width = nextWidth;
      this.height = nextHeight;
      // The configured fov is horizontal: every projection (walls, floor,
      // sprites) derives from this focal length, never from height.
      this.focalLength = this.width / (2 * Math.tan(this.config.fov / 2));

      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.scene.width = this.width;
      this.scene.height = this.height;
      this.ctx.imageSmoothingEnabled = !this.lowRes;
      this.sceneCtx.imageSmoothingEnabled = !this.lowRes;

      this.frame = this.sceneCtx.createImageData(this.width, this.height);
      this.zbuffer = new Float32Array(this.width);
      this.buildVignette();
    }

    buildVignette() {
      this.vignette.width = this.width;
      this.vignette.height = this.height;
      const ctx = this.vignette.getContext('2d');
      const radius = Math.hypot(this.width, this.height) / 2;
      const gradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, radius * 0.45,
        this.width / 2, this.height / 2, radius
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    wallTextureFor(tile, level, mapX, mapY) {
      const walls = this.textures.walls || {};
      if (tile === 3 && walls.moss) return walls.moss;
      if (tile === 4 && walls.tech) return walls.tech;
      const theme = level.theme || DEFAULT_THEME;
      if (this.textures.getWallVariant &&
          Math.abs(mapX * 17 + mapY * 31) % 7 === 0) {
        return this.textures.getWallVariant(theme.wall);
      }
      return walls[theme.wall] || walls.brick;
    }

    renderFloorCeiling(player, horizon, theme, dirX, dirY, planeX, planeY) {
      const { width, height } = this;
      const out = this.frame.data;
      const floors = this.textures.floors || {};
      const ceilings = this.textures.ceilings || {};
      const floorTex = floors[theme.floor] || floors.stone;
      const ceilTex = ceilings[theme.ceiling] || ceilings.plaster;
      const floor = floorTex ? this.texturePixels(floorTex) : null;
      const ceil = ceilTex ? this.texturePixels(ceilTex) : null;
      const [fogR, fogG, fogB] = theme.fogColor || DEFAULT_THEME.fogColor;
      const fogDistance = theme.fogDistance || 17;
      const rayDirX0 = dirX - planeX;
      const rayDirY0 = dirY - planeY;
      const rayDirX1 = dirX + planeX;
      const rayDirY1 = dirY + planeY;
      const posZ = 0.5 * this.focalLength;

      const fillFogRow = (y, rowOffset) => {
        for (let x = 0; x < width; x += 1) {
          const dst = (rowOffset + x) * 4;
          out[dst] = fogR;
          out[dst + 1] = fogG;
          out[dst + 2] = fogB;
          out[dst + 3] = 255;
        }
      };

      const stepFX = this.floorStepX;
      for (let y = 0; y < height; y += this.floorStepY) {
        const isFloor = y > horizon;
        const p = isFloor ? y - horizon : horizon - y;
        const rowOffset = y * width;
        // Full-res rows are unique; the low-res pass shares a row pair.
        const hasSecondRow = this.floorStepY > 1 && y + 1 < height;
        const rowOffset2 = rowOffset + width;
        const rowDistance = p > 0 ? posZ / p : 0;
        const tex = p > 0 ? (isFloor ? floor : ceil) : null;
        if (p <= 0 || !tex) {
          fillFogRow(y, rowOffset);
          if (hasSecondRow) fillFogRow(y + 1, rowOffset2);
          continue;
        }
        const fog = clamp(rowDistance / fogDistance, 0, 1);
        const keep = 1 - fog;
        const maskX = tex.width - 1;
        const maskY = tex.height - 1;
        const pow2 = (tex.width & maskX) === 0 && (tex.height & maskY) === 0;
        const stepX = rowDistance * (rayDirX1 - rayDirX0) / width;
        const stepY = rowDistance * (rayDirY1 - rayDirY0) / width;
        let worldX = player.x + rowDistance * rayDirX0;
        let worldY = player.y + rowDistance * rayDirY0;

        for (let x = 0; x < width; x += stepFX) {
          const fx = Math.floor(worldX * tex.width);
          const fy = Math.floor(worldY * tex.height);
          const tx = pow2
            ? (fx & maskX)
            : ((fx % tex.width) + tex.width) % tex.width;
          const ty = pow2
            ? (fy & maskY)
            : ((fy % tex.height) + tex.height) % tex.height;
          const src = (ty * tex.width + tx) * 4;
          const r = tex.data[src] * keep + fogR * fog;
          const g = tex.data[src + 1] * keep + fogG * fog;
          const b = tex.data[src + 2] * keep + fogB * fog;
          for (let kx = 0; kx < stepFX && x + kx < width; kx += 1) {
            const dst = (rowOffset + x + kx) * 4;
            out[dst] = r;
            out[dst + 1] = g;
            out[dst + 2] = b;
            out[dst + 3] = 255;
            if (hasSecondRow) {
              const dst2 = (rowOffset2 + x + kx) * 4;
              out[dst2] = r;
              out[dst2 + 1] = g;
              out[dst2 + 2] = b;
              out[dst2 + 3] = 255;
            }
          }
          worldX += stepX * stepFX;
          worldY += stepY * stepFX;
        }
      }
    }

    renderWalls(map, level, player, horizon, theme, dirX, dirY, planeX, planeY) {
      const { width, height, sceneCtx, zbuffer } = this;
      const mapH = map.length;
      const mapW = map[0].length;
      const fogDistance = theme.fogDistance || 17;
      const [fogR, fogG, fogB] = theme.fogColor || DEFAULT_THEME.fogColor;

      for (let col = 0; col < width; col += this.rayStep) {
        const span = Math.min(this.rayStep, width - col);
        const cameraX = 2 * col / width - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        let mapX = Math.floor(player.x);
        let mapY = Math.floor(player.y);
        const deltaX = Math.abs(1 / (rayDirX || 1e-9));
        const deltaY = Math.abs(1 / (rayDirY || 1e-9));
        let stepX;
        let stepY;
        let sideX;
        let sideY;
        if (rayDirX < 0) { stepX = -1; sideX = (player.x - mapX) * deltaX; }
        else { stepX = 1; sideX = (mapX + 1 - player.x) * deltaX; }
        if (rayDirY < 0) { stepY = -1; sideY = (player.y - mapY) * deltaY; }
        else { stepY = 1; sideY = (mapY + 1 - player.y) * deltaY; }

        let side = 0;
        let tile = 1;
        for (let i = 0; i < MAX_RAY_STEPS; i += 1) {
          if (sideX < sideY) {
            sideX += deltaX; mapX += stepX; side = 0;
          } else {
            sideY += deltaY; mapY += stepY; side = 1;
          }
          if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) {
            tile = 1;
            break;
          }
          tile = map[mapY][mapX];
          if (Maze3D.isWallTile(tile)) break;
        }

        const perpDist = Math.max(0.02,
          side === 0 ? sideX - deltaX : sideY - deltaY);
        for (let k = 0; k < span; k += 1) zbuffer[col + k] = perpDist;

        const lineH = this.focalLength / perpDist;
        const drawStart = horizon - lineH / 2;
        let wallX = side === 0
          ? player.y + perpDist * rayDirY
          : player.x + perpDist * rayDirX;
        wallX -= Math.floor(wallX);

        const texture = this.wallTextureFor(tile, level, mapX, mapY);
        const texW = texture.width;
        let texX = Math.floor(wallX * texW);
        if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) {
          texX = texW - 1 - texX;
        }
        texX = clamp(texX, 0, texW - 1);

        sceneCtx.drawImage(
          texture, texX, 0, 1, texture.height,
          col, drawStart, span, lineH
        );

        const fogAlpha = clamp(perpDist / fogDistance, 0, 0.92);
        if (fogAlpha > 0.01) {
          sceneCtx.fillStyle = `rgba(${fogR}, ${fogG}, ${fogB}, ${fogAlpha})`;
          sceneCtx.fillRect(col, Math.max(0, drawStart), span,
            Math.min(height, drawStart + lineH) - Math.max(0, drawStart));
        }
        if (side === 1) {
          sceneCtx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          sceneCtx.fillRect(col, Math.max(0, drawStart), span,
            Math.min(height, drawStart + lineH) - Math.max(0, drawStart));
        }
      }
    }

    renderSprites(sprites, player, horizon, theme, dirX, dirY, planeX, planeY) {
      const { width, height, sceneCtx, zbuffer } = this;
      const fogDistance = theme.fogDistance || 17;
      const [fogR, fogG, fogB] = theme.fogColor || DEFAULT_THEME.fogColor;
      const list = sprites.map(sprite => ({
        sprite,
        distance: (sprite.x - player.x) ** 2 + (sprite.y - player.y) ** 2,
      })).sort((a, b) => b.distance - a.distance);

      const invDet = 1 / (planeX * dirY - dirX * planeY);

      for (const { sprite } of list) {
        const relX = sprite.x - player.x;
        const relY = sprite.y - player.y;
        const transformX = invDet * (dirY * relX - dirX * relY);
        const transformY = invDet * (-planeY * relX + planeX * relY);
        if (transformY <= 0.08) continue;

        const image = sprite.image;
        const screenX = (width / 2) * (1 + transformX / transformY);
        const scale = this.focalLength / transformY;
        const spriteH = Math.abs(scale) * sprite.height;
        const spriteW = Math.abs(scale) * sprite.width;
        const centerY = horizon - sprite.vertical * scale;
        // Floor-anchored sprites stand on the floor plane at the sprite's
        // distance; the visible foot edge (not the canvas bottom) touches it.
        const drawY = sprite.floorAnchored
          ? horizon + 0.5 * scale - this.spriteFootFraction(image) * spriteH
          : centerY - spriteH / 2;
        const startX = Math.max(0, Math.floor(screenX - spriteW / 2));
        const endX = Math.min(width - 1, Math.ceil(screenX + spriteW / 2));
        if (startX > endX) continue;

        const fog = clamp(transformY / fogDistance, 0, 0.8);
        // Fog is tinted on a scratch canvas with source-atop so transparent
        // silhouette pixels stay transparent (a fillRect would box them in).
        let source = image;
        if (fog > 0.02) {
          const { fogCanvas, fogCtx } = this;
          if (fogCanvas.width !== image.width ||
              fogCanvas.height !== image.height) {
            fogCanvas.width = image.width;
            fogCanvas.height = image.height;
          }
          fogCtx.clearRect(0, 0, image.width, image.height);
          fogCtx.drawImage(image, 0, 0);
          fogCtx.globalCompositeOperation = 'source-atop';
          fogCtx.fillStyle =
            `rgba(${fogR}, ${fogG}, ${fogB}, ${fog * 0.7})`;
          fogCtx.fillRect(0, 0, image.width, image.height);
          fogCtx.globalCompositeOperation = 'source-over';
          source = fogCanvas;
        }

        for (let stripe = startX; stripe <= endX; stripe += this.spriteStep) {
          const stripeSpan = Math.min(
            this.spriteStep, endX - stripe + 1, width - stripe);
          // Every destination pixel gets its own z-test; consecutive visible
          // columns are drawn as one run so a half-occluded stripe cannot
          // leak its far pixel through a wall.
          let runStart = -1;
          const flush = runEnd => {
            if (runStart < 0) return;
            const texX = Math.floor(
              (runStart - (screenX - spriteW / 2)) * image.width / spriteW
            );
            if (texX >= 0 && texX < image.width) {
              sceneCtx.drawImage(
                source, texX, 0, 1, image.height,
                runStart, drawY, runEnd - runStart + 1, spriteH
              );
            }
            runStart = -1;
          };
          for (let px = stripe; px < stripe + stripeSpan; px += 1) {
            if (transformY < zbuffer[px]) {
              if (runStart < 0) runStart = px;
            } else {
              flush(px - 1);
            }
          }
          flush(stripe + stripeSpan - 1);
        }
      }
      sceneCtx.globalAlpha = 1;
    }

    renderAtmosphere(theme, elapsed) {
      const { width, height, sceneCtx } = this;
      const kind = theme.particles || 'dust';
      const count = 28;
      const t = elapsed;

      for (let i = 0; i < count; i += 1) {
        const hx = hash01(i, 11);
        const hy = hash01(i, 23);
        const speed = 0.35 + hash01(i, 37) * 0.65;
        const phase = hash01(i, 51) * Math.PI * 2;
        let x;
        let y;
        let size = 1;
        let particleWidth = size;
        let particleHeight = size;
        let color;
        let alpha = 0.5;

        switch (kind) {
          case 'bubbles':
            x = (hx * width + Math.sin(t * 1.3 + phase) * 7 + width) % width;
            y = height - ((hy * height + t * (9 + speed * 14)) % height);
            size = 2 + Math.floor(hash01(i, 61) * 2);
            particleWidth = particleHeight = size;
            color = '160, 230, 235';
            alpha = 0.16 + hash01(i, 67) * 0.2;
            break;
          case 'stars': {
            x = hx * width;
            y = hy * height * 0.6;
            particleWidth = particleHeight = 2;
            const twinkle = Math.abs(Math.sin(t * (0.6 + speed) + phase));
            color = hash01(i, 71) > 0.8 ? '125, 234, 242' : '235, 230, 205';
            alpha = 0.15 + twinkle * 0.55;
            break;
          }
          case 'snow':
            x = (hx * width + Math.sin(t * 0.9 + phase) * 10 + width) % width;
            y = (hy * height + t * (7 + speed * 9)) % height;
            size = 2 + Math.floor(hash01(i, 61) * 2);
            particleWidth = particleHeight = size;
            color = '225, 245, 250';
            alpha = 0.25 + hash01(i, 67) * 0.25;
            break;
          case 'embers':
            x = (hx * width + Math.sin(t * 2.1 + phase) * 6 + width) % width;
            y = height - ((hy * height + t * (16 + speed * 22)) % height);
            particleWidth = particleHeight = 2;
            color = hash01(i, 71) > 0.5 ? '255, 122, 26' : '255, 196, 90';
            alpha = 0.2 + Math.abs(Math.sin(t * 3 + phase)) * 0.45;
            break;
          case 'sparks':
            x = (hx * width + t * (20 + speed * 26)) % width;
            y = (hy * height + t * (11 + speed * 15)) % height;
            particleWidth = particleHeight = 2;
            color = '255, 214, 110';
            alpha = 0.2 + Math.abs(Math.sin(t * 5 + phase)) * 0.5;
            break;
          case 'motes':
            x = (hx * width + Math.sin(t * speed * 0.8 + phase) * 22 + width) % width;
            y = (hy * height + Math.cos(t * speed * 0.6 + phase) * 16 + height) % height;
            particleWidth = particleHeight = 2;
            color = '196, 168, 140';
            alpha = 0.12 + hash01(i, 67) * 0.18;
            break;
          case 'sun':
            if (i >= 10) continue;
            x = (hx * width + Math.sin(t * 0.4 + phase) * 14 + width) % width;
            y = hy * height * 0.5;
            size = 2;
            particleWidth = particleHeight = size;
            color = '255, 220, 130';
            alpha = 0.1 + Math.abs(Math.sin(t * 1.1 + phase)) * 0.35;
            break;
          case 'mist':
            if (i >= 18) continue;
            x = (hx * width + t * (3 + speed * 5) + width) % width;
            y = height * 0.3 + (hy % 0.7) * height;
            particleWidth = 12 + Math.floor(hash01(i, 61) * 19);
            particleHeight = 1 + Math.floor(hash01(i, 67));
            color = '140, 160, 190';
            alpha = 0.05 + hash01(i, 71) * 0.08;
            break;
          case 'confetti': {
            x = (hx * width + Math.sin(t * 1.6 + phase) * 9 + width) % width;
            y = (hy * height + t * (10 + speed * 12)) % height;
            particleWidth = 3;
            particleHeight = 4;
            color = ['224, 60, 55', '240, 190, 80', '80, 200, 110', '90, 220, 235'][i % 4];
            alpha = 0.35 + hash01(i, 67) * 0.3;
            break;
          }
          case 'smoke':
            x = (hx * width + Math.sin(t * 0.8 + phase) * 14 + width) % width;
            y = height - ((hy * height * 0.8 + t * (6 + speed * 9)) % height);
            size = 3 + Math.floor(hash01(i, 61) * 4);
            particleWidth = particleHeight = size;
            color = '130, 135, 128';
            alpha = 0.06 + hash01(i, 67) * 0.1;
            break;
          case 'ash':
            x = (hx * width + Math.sin(t * 1.2 + phase) * 16 + width) % width;
            y = (hy * height + t * (5 + speed * 8)) % height;
            particleWidth = particleHeight = 2;
            color = hash01(i, 71) > 0.6 ? '230, 140, 80' : '150, 148, 140';
            alpha = 0.2 + hash01(i, 67) * 0.25;
            break;
          case 'rain':
            x = (hx * width + Math.sin(t * 0.5 + phase) * 4 + width) % width;
            y = (hy * height + t * (60 + speed * 50)) % height;
            particleWidth = 2;
            particleHeight = 10;
            color = '130, 160, 200';
            alpha = 0.18 + hash01(i, 67) * 0.2;
            break;
          case 'fireflies':
            x = (hx * width + Math.sin(t * speed + phase) * 30 + width) % width;
            y = (hy * height + Math.cos(t * speed * 0.7 + phase) * 24 + height) % height;
            particleWidth = particleHeight = 2;
            color = '210, 240, 110';
            alpha = 0.1 + Math.abs(Math.sin(t * 2.6 + phase)) * 0.5;
            break;
          case 'petals':
            x = (hx * width + Math.sin(t * 1.1 + phase) * 18 + width) % width;
            y = (hy * height + t * (6 + speed * 8)) % height;
            particleWidth = 3;
            particleHeight = 2;
            color = hash01(i, 71) > 0.5 ? '236, 170, 160' : '245, 228, 210';
            alpha = 0.3 + hash01(i, 67) * 0.25;
            break;
          case 'clouds':
            if (i >= 12) continue;
            x = (hx * width + t * (2 + speed * 3) + width) % width;
            y = hy * height * 0.6;
            particleWidth = 12 + Math.floor(hash01(i, 61) * 17);
            particleHeight = 3;
            color = '240, 236, 225';
            alpha = 0.1 + hash01(i, 67) * 0.1;
            break;
          case 'dust':
          default:
            x = (hx * width + Math.sin(t * 0.7 + phase) * 12 + width) % width;
            y = (hy * height + t * (4 + speed * 6)) % height;
            particleWidth = particleHeight = 2;
            color = '190, 200, 185';
            alpha = 0.1 + hash01(i, 67) * 0.16;
            break;
        }

        sceneCtx.fillStyle = `rgba(${color}, ${alpha})`;
        sceneCtx.fillRect(
          Math.round(x), Math.round(y), particleWidth, particleHeight
        );
      }
    }

    setLevel(map, level) {
      if (!map || !map.length) return;
      const mapH = map.length;
      const mapW = map[0].length;
      const cell = clamp(Math.floor(190 / Math.max(mapW, mapH)), 3, 9);
      const pad = 6;
      const boxW = mapW * cell + pad * 2;
      const boxH = mapH * cell + pad * 2;
      const canvas = document.createElement('canvas');
      canvas.width = boxW;
      canvas.height = boxH;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = 'rgba(5, 10, 8, 0.72)';
      ctx.fillRect(0, 0, boxW, boxH);
      ctx.strokeStyle = 'rgba(120, 220, 160, 0.5)';
      ctx.strokeRect(0.5, 0.5, boxW - 1, boxH - 1);
      for (let y = 0; y < mapH; y += 1) {
        for (let x = 0; x < mapW; x += 1) {
          const tile = map[y][x];
          if (Maze3D.isWallTile(tile)) {
            ctx.fillStyle = tile === 4
              ? 'rgba(96, 190, 180, 0.55)'
              : 'rgba(130, 160, 120, 0.5)';
            ctx.fillRect(pad + x * cell, pad + y * cell, cell, cell);
          } else if (tile === 2) {
            ctx.fillStyle = 'rgba(76, 255, 124, 0.8)';
            ctx.fillRect(pad + x * cell, pad + y * cell, cell, cell);
          }
        }
      }
      this.mapCache = { canvas, cell, pad, boxW, boxH };
    }

    renderMinimap(state, theme) {
      const { player, sprites } = state;
      const ctx = this.ctx;
      const cache = this.mapCache;
      if (!cache) return;
      const { cell, pad, boxW, boxH } = cache;
      const ox = this.width - boxW - 10;
      const oy = 10;

      ctx.drawImage(cache.canvas, ox, oy);

      const px = ox + pad + player.x * cell;
      const py = oy + pad + player.y * cell;

      // Live view cone: zbuffer distances are already wall-clipped.
      const dirX = Math.cos(player.angle);
      const dirY = Math.sin(player.angle);
      const planeLen = Math.tan(this.config.fov / 2);
      const planeX = -dirY * planeLen;
      const planeY = dirX * planeLen;
      const SAMPLES = 21;
      const points = this.fovPoints;
      for (let i = 0; i < SAMPLES; i += 1) {
        const col = Math.round(i * (this.width - 1) / (SAMPLES - 1));
        const cameraX = 2 * col / this.width - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;
        const distance = this.zbuffer[col] || 0;
        points[i * 2] = px + rayDirX * distance * cell;
        points[i * 2 + 1] = py + rayDirY * distance * cell;
      }
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let i = 0; i < SAMPLES; i += 1) {
        ctx.lineTo(points[i * 2], points[i * 2 + 1]);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(83, 246, 200, 0.13)';
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < SAMPLES; i += 1) {
        ctx.moveTo(px, py);
        ctx.lineTo(points[i * 2], points[i * 2 + 1]);
      }
      ctx.strokeStyle = 'rgba(83, 246, 200, 0.2)';
      ctx.stroke();

      // Distinct shapes per kind: creatures coral circles, relics gold
      // squares, anomalies cyan diamonds; the exit tile stays green.
      for (const sprite of sprites) {
        const sx = ox + pad + sprite.x * cell;
        const sy = oy + pad + sprite.y * cell;
        if (sprite.kind === 'creature') {
          ctx.fillStyle = '#ff786e';
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (sprite.kind === 'relic') {
          ctx.fillStyle = '#ffd55b';
          ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        } else if (sprite.kind === 'inversion') {
          ctx.fillStyle = '#53f6ff';
          ctx.beginPath();
          ctx.moveTo(sx, sy - 2.4);
          ctx.lineTo(sx + 2.4, sy);
          ctx.lineTo(sx, sy + 2.4);
          ctx.lineTo(sx - 2.4, sy);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.fillStyle = '#f5f1d8';
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }

    render(state) {
      const { map, level, player, sprites, elapsed, inversion, showMap } = state;
      const { width, height, ctx, sceneCtx } = this;
      const theme = (level && level.theme) || DEFAULT_THEME;

      const dirX = Math.cos(player.angle);
      const dirY = Math.sin(player.angle);
      const planeLen = Math.tan(this.config.fov / 2);
      const planeX = -dirY * planeLen;
      const planeY = dirX * planeLen;
      let horizon = Math.round(height / 2 + (player.bob || 0));
      if (theme.particles === 'bubbles') {
        horizon += Math.round(Math.sin((elapsed || 0) * 1.7) * 1.5);
      }

      this.renderFloorCeiling(player, horizon, theme, dirX, dirY, planeX, planeY);
      sceneCtx.putImageData(this.frame, 0, 0);
      this.renderWalls(map, level, player, horizon, theme, dirX, dirY, planeX, planeY);
      this.renderSprites(sprites || [], player, horizon, theme, dirX, dirY, planeX, planeY);
      this.renderAtmosphere(theme, elapsed || 0);

      const roll = clamp(inversion || 0, 0, 1);
      const maxAspect = Math.max(width / height, height / width);
      const zoom = 1 + (maxAspect - 1) * Math.sin(Math.PI * roll);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(Math.PI * roll);
      ctx.scale(zoom, zoom);
      ctx.drawImage(this.scene, -width / 2, -height / 2);
      ctx.restore();

      ctx.drawImage(this.vignette, 0, 0);
      if (showMap) this.renderMinimap(state, theme);
    }
  }

  Maze3D.Renderer = Renderer;
})();
