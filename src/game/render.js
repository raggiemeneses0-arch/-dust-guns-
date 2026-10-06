/**
 * Canvas renderer. Everything is drawn procedurally -- no image assets --
 * so the whole game is a handful of text files that load instantly.
 * The ground layer is baked to an offscreen canvas once per map.
 */

import { WORLD } from '../config.js';

import { getPlayerSkin, getGunSkin } from '../data/skins.js';

const VIEW_HEIGHT = 880; // how many world pixels tall the viewport is

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ground = null;
    this.groundKey = null;
    this.scale = 1;
    this.viewW = WORLD.width;
    this.viewH = WORLD.height;
    this.time = 0;
  }

  resize(width, height) {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.dpr = dpr;
    this.cssWidth = width;
    this.cssHeight = height;
    this.scale = height / VIEW_HEIGHT;
    this.viewW = width / this.scale;
    this.viewH = height / this.scale;
  }

  /** Convert a world point to screen (css) pixels. */
  worldToScreen(game, wx, wy) {
    const cam = this.cameraOf(game);
    return {
      x: (wx - cam.x) * this.scale + this.cssWidth / 2,
      y: (wy - cam.y) * this.scale + this.cssHeight / 2,
    };
  }

  screenToWorld(game, sx, sy) {
    const cam = this.cameraOf(game);
    return {
      x: (sx - this.cssWidth / 2) / this.scale + cam.x,
      y: (sy - this.cssHeight / 2) / this.scale + cam.y,
    };
  }

  cameraOf(game) {
    const shake = game.camera.shake;
    const jx = shake ? (Math.random() - 0.5) * shake : 0;
    const jy = shake ? (Math.random() - 0.5) * shake : 0;
    let cx = game.camera.x;
    let cy = game.camera.y;
    const halfW = this.viewW / 2;
    const halfH = this.viewH / 2;
    cx = WORLD.width > this.viewW ? Math.max(halfW, Math.min(WORLD.width - halfW, cx)) : WORLD.width / 2;
    cy = WORLD.height > this.viewH ? Math.max(halfH, Math.min(WORLD.height - halfH, cy)) : WORLD.height / 2;
    return { x: cx + jx, y: cy + jy };
  }

  buildGround(game) {
    const key = `${game.map.id}|${game.seed}`;
    if (this.groundKey === key && this.ground) return this.ground;

    const c = document.createElement('canvas');
    c.width = WORLD.width;
    c.height = WORLD.height;
    const g = c.getContext('2d');
    const pal = game.map.palette;

    g.fillStyle = pal.ground;
    g.fillRect(0, 0, WORLD.width, WORLD.height);

    // seeded noise patches
    let seed = 12345;
    for (const ch of `${game.map.id}${game.seed}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 260; i += 1) {
      const x = rnd() * WORLD.width;
      const y = rnd() * WORLD.height;
      const r = 30 + rnd() * 130;
      g.globalAlpha = 0.05 + rnd() * 0.09;
      g.fillStyle = rnd() > 0.5 ? pal.groundAlt : pal.dirt;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }

    // wheel ruts / rail tracks / cracked earth, per map flavour
    g.globalAlpha = 0.14;
    g.strokeStyle = pal.dirt;
    if (game.map.id === 'rail-yard') {
      g.lineWidth = 5;
      for (const ry of [0.1, 0.26, 0.46, 0.62, 0.86]) {
        g.beginPath();
        g.moveTo(0, WORLD.height * ry);
        g.lineTo(WORLD.width, WORLD.height * ry);
        g.stroke();
      }
      g.globalAlpha = 0.1;
      g.lineWidth = 22;
      g.strokeStyle = pal.accent;
      for (const ry of [0.1, 0.26, 0.46, 0.62, 0.86]) {
        g.beginPath();
        g.moveTo(0, WORLD.height * ry);
        g.lineTo(WORLD.width, WORLD.height * ry);
        g.stroke();
      }
    } else {
      g.lineWidth = 26;
      g.beginPath();
      g.moveTo(0, WORLD.height * 0.55);
      g.bezierCurveTo(WORLD.width * 0.3, WORLD.height * 0.48, WORLD.width * 0.6, WORLD.height * 0.62, WORLD.width, WORLD.height * 0.5);
      g.stroke();
      g.lineWidth = 3;
      for (let i = 0; i < 180; i += 1) {
        const x = rnd() * WORLD.width;
        const y = rnd() * WORLD.height;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40);
        g.stroke();
      }
    }

    g.globalAlpha = 1;
    this.ground = c;
    this.groundKey = key;
    return c;
  }

  draw(game, dt, settings = {}) {
    this.time += dt;
    const ctx = this.ctx;
    const cam = this.cameraOf(game);
    const s = this.scale;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = game.map.palette.ground;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.save();
    ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
    ctx.scale(s, s);
    ctx.translate(-cam.x, -cam.y);

    const ground = this.buildGround(game);
    ctx.drawImage(ground, 0, 0);

    this.drawDecor(game);
    this.drawPickups(game);
    this.drawObstacles(game);
    this.drawEnemyBullets(game);
    this.drawBullets(game);
    this.drawEnemies(game);
    this.drawPlayer(game);
    this.drawParticles(game);
    this.drawFloaters(game);

    ctx.restore();

    this.drawFog(game);
    this.drawOffscreenMarkers(game, cam);
    if (settings.minimap !== false) this.drawMinimap(game);
  }

  /* ------------------------------------------------------------- world */

  drawDecor(game) {
    const ctx = this.ctx;
    const pal = game.map.palette;
    for (const d of game.decor) {
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      if (d.kind === 'tumbleweed') {
        const drift = (this.time * 26 + d.seed) % (WORLD.width + 200) - 100;
        ctx.translate(drift - cx, 0);
        ctx.rotate(this.time * 1.4 + d.seed);
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < 9; i += 1) {
          const a = (i / 9) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * d.w * 0.6, Math.sin(a) * d.w * 0.6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 7; i += 1) {
          const a = (i / 7) * Math.PI * 2 + d.seed;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * d.w * 0.28, Math.sin(a) * d.h * 0.28, d.w * 0.3, d.h * 0.3, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  drawObstacles(game) {
    const ctx = this.ctx;
    const pal = game.map.palette;
    ctx._pal = pal;
    for (const o of game.obstacles) {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;

      // cast shadow
      ctx.fillStyle = pal.shadow;
      ctx.beginPath();
      ctx.ellipse(cx + 7, cy + 8, o.w * 0.55, o.h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      switch (o.kind) {
        case 'crate':
          this.drawCrate(o);
          break;
        case 'barrel':
          this.drawBarrel(o);
          break;
        case 'cactus':
          this.drawCactus(o);
          break;
        case 'rock':
        case 'mesa':
          this.drawRock(o, o.kind === 'mesa');
          break;
        case 'wagon':
          this.drawWagon(o);
          break;
        case 'trough':
          this.drawTrough(o);
          break;
        case 'tombstone':
          this.drawTombstone(o);
          break;
        case 'train':
          this.drawTrain(o);
          break;
        case 'waterTower':
          this.drawWaterTower(o);
          break;
        default:
          this.drawBuilding(o);
      }
      ctx.restore();
    }
  }

  body(o, topInset = 6) {
    const ctx = this.ctx;
    const pal = ctx._pal;
    ctx.fillStyle = pal.obstacleEdge;
    this.roundRect(o.x, o.y, o.w, o.h, 3);
    ctx.fill();
    ctx.fillStyle = pal.obstacleTop;
    this.roundRect(o.x + topInset, o.y + topInset, o.w - topInset * 2, o.h - topInset * 2, 2);
    ctx.fill();
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  drawBuilding(o) {
    const ctx = this.ctx;
    const pal = ctx._pal;
    ctx.fillStyle = pal.obstacleEdge;
    this.roundRect(o.x, o.y, o.w, o.h, 4);
    ctx.fill();
    ctx.fillStyle = pal.obstacle;
    this.roundRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8, 3);
    ctx.fill();
    // roof planks
    ctx.strokeStyle = pal.obstacleEdge;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.4;
    const step = 14;
    for (let x = o.x + step; x < o.x + o.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, o.y + 4);
      ctx.lineTo(x, o.y + o.h - 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // porch roof highlight
    ctx.fillStyle = pal.obstacleTop;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(o.x + 4, o.y + o.h - 16, o.w - 8, 10);
    ctx.globalAlpha = 1;
  }

  drawCrate(o) {
    const ctx = this.ctx;
    const pal = ctx._pal;
    ctx.fillStyle = '#4a3520';
    this.roundRect(o.x, o.y, o.w, o.h, 3);
    ctx.fill();
    ctx.fillStyle = '#9c7443';
    this.roundRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4, 2);
    ctx.fill();
    ctx.strokeStyle = '#6b4d2c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o.x + 3, o.y + 3);
    ctx.lineTo(o.x + o.w - 3, o.y + o.h - 3);
    ctx.moveTo(o.x + o.w - 3, o.y + 3);
    ctx.lineTo(o.x + 3, o.y + o.h - 3);
    ctx.stroke();
    this.hpBar(o, '#c9a86a');
  }

  drawBarrel(o) {
    const ctx = this.ctx;
    ctx.fillStyle = '#3b2b1c';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a5f34';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2 - 2.5, o.h / 2 - 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3d20';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 4, o.h / 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', o.x + o.w / 2, o.y + o.h / 2 + 3);
    this.hpBar(o, '#c0392b');
  }

  drawCactus(o) {
    const ctx = this.ctx;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    ctx.strokeStyle = '#2f5f34';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, o.w * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx, cy + o.h * 0.5);
    ctx.lineTo(cx, cy - o.h * 0.5);
    ctx.stroke();
    ctx.lineWidth = Math.max(3, o.w * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - o.w * 0.42, cy);
    ctx.lineTo(cx - o.w * 0.42, cy - o.h * 0.24);
    ctx.moveTo(cx, cy + o.h * 0.1);
    ctx.lineTo(cx + o.w * 0.4, cy + o.h * 0.1);
    ctx.lineTo(cx + o.w * 0.4, cy - o.h * 0.18);
    ctx.stroke();
    ctx.strokeStyle = '#4a8a4f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + o.h * 0.45);
    ctx.lineTo(cx, cy - o.h * 0.45);
    ctx.stroke();
  }

  drawRock(o, big) {
    const ctx = this.ctx;
    const pal = ctx._pal;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const pts = 7;
    ctx.beginPath();
    for (let i = 0; i < pts; i += 1) {
      const a = (i / pts) * Math.PI * 2 + o.seed;
      const rx = o.w / 2 * (0.78 + ((Math.sin(i * 12.9 + o.seed) + 1) / 2) * 0.3);
      const ry = o.h / 2 * (0.78 + ((Math.cos(i * 7.3 + o.seed) + 1) / 2) * 0.3);
      const px = cx + Math.cos(a) * rx;
      const py = cy + Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = pal.obstacleEdge;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = pal.obstacleTop;
    ctx.fillRect(o.x, o.y, o.w, o.h * (big ? 0.62 : 0.55));
    ctx.fillStyle = pal.obstacle;
    ctx.fillRect(o.x, o.y + o.h * (big ? 0.62 : 0.55), o.w, o.h);
    ctx.restore();
    if (big) {
      ctx.strokeStyle = pal.obstacleEdge;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.2, o.y + o.h * 0.35);
      ctx.lineTo(o.x + o.w * 0.8, o.y + o.h * 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawWagon(o) {
    const ctx = this.ctx;
    ctx.fillStyle = '#3d2c1c';
    this.roundRect(o.x, o.y, o.w, o.h, 4);
    ctx.fill();
    ctx.fillStyle = '#8a6a42';
    this.roundRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6, 3);
    ctx.fill();
    ctx.strokeStyle = '#5a4227';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(o.x + 3, o.y + (o.h / 4) * i);
      ctx.lineTo(o.x + o.w - 3, o.y + (o.h / 4) * i);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1d12';
    const wy = o.y + o.h - 2;
    for (const wx of [o.x + o.w * 0.22, o.x + o.w * 0.78]) {
      ctx.beginPath();
      ctx.arc(wx, wy, o.h * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTrough(o) {
    const ctx = this.ctx;
    ctx.fillStyle = '#4a3520';
    this.roundRect(o.x, o.y, o.w, o.h, 3);
    ctx.fill();
    ctx.fillStyle = '#6f8fa0';
    this.roundRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    this.roundRect(o.x + 6, o.y + 4, o.w - 12, (o.h - 8) * 0.35, 2);
    ctx.fill();
  }

  drawTombstone(o) {
    const ctx = this.ctx;
    const cx = o.x + o.w / 2;
    ctx.fillStyle = '#3b382f';
    this.roundRect(o.x, o.y + o.h * 0.25, o.w, o.h * 0.75, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, o.y + o.h * 0.25, o.w / 2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6f6a5c';
    this.roundRect(o.x + 2.5, o.y + o.h * 0.28, o.w - 5, o.h * 0.7, 2);
    ctx.fill();
    ctx.strokeStyle = '#4a463c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, o.y + o.h * 0.42);
    ctx.lineTo(cx, o.y + o.h * 0.7);
    ctx.moveTo(cx - o.w * 0.2, o.y + o.h * 0.5);
    ctx.lineTo(cx + o.w * 0.2, o.y + o.h * 0.5);
    ctx.stroke();
  }

  drawTrain(o) {
    const ctx = this.ctx;
    ctx.fillStyle = '#26241f';
    this.roundRect(o.x, o.y, o.w, o.h, 4);
    ctx.fill();
    const panels = Math.max(2, Math.round(o.w / 110));
    const pw = (o.w - 8) / panels;
    for (let i = 0; i < panels; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#6b5340' : '#5c4635';
      this.roundRect(o.x + 4 + i * pw, o.y + 4, pw - 4, o.h - 8, 2);
      ctx.fill();
      ctx.strokeStyle = '#33291f';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 6);
  }

  drawWaterTower(o) {
    const ctx = this.ctx;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    ctx.fillStyle = '#3a352c';
    ctx.beginPath();
    ctx.arc(cx, cy, o.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d7361';
    ctx.beginPath();
    ctx.arc(cx, cy, o.w / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4b4438';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * (o.w / 2 - 3), cy - Math.sin(a) * (o.w / 2 - 3));
      ctx.lineTo(cx + Math.cos(a) * (o.w / 2 - 3), cy + Math.sin(a) * (o.w / 2 - 3));
      ctx.stroke();
    }
  }

  hpBar(o, colour) {
    if (!o.destructible || o.hp >= o.maxHp) return;
    const ctx = this.ctx;
    const w = o.w;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(o.x, o.y - 7, w, 4);
    ctx.fillStyle = colour;
    ctx.fillRect(o.x, o.y - 7, w * Math.max(0, o.hp / o.maxHp), 4);
  }

  /* ------------------------------------------------------------ actors */

  drawCowboy({ x, y, angle, radius, skin, gunSkin, gun, flash = 0, hurt = 0, bob = 0, dead = false }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 5, radius * 1.05, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    const squash = 1 + Math.sin(bob) * 0.05;

    if (dead) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#6d2118';
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.7, radius * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // legs
    ctx.fillStyle = skin.colours.boots;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.15, -radius * 0.5, radius * 0.3, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(-radius * 0.15, radius * 0.5, radius * 0.3, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // coat
    ctx.fillStyle = skin.colours.coat;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.02 * squash, radius * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    // shirt wedge
    ctx.fillStyle = skin.colours.shirt;
    ctx.beginPath();
    ctx.moveTo(radius * 0.1, -radius * 0.4);
    ctx.lineTo(radius * 0.85, 0);
    ctx.lineTo(radius * 0.1, radius * 0.4);
    ctx.closePath();
    ctx.fill();
    // coat lapels
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, -radius * 0.6);
    ctx.lineTo(radius * 0.4, -radius * 0.2);
    ctx.moveTo(-radius * 0.6, radius * 0.6);
    ctx.lineTo(radius * 0.4, radius * 0.2);
    ctx.stroke();

    // arms + weapon
    this.drawWeaponInHands(radius, gunSkin, gun, flash);

    // bandana
    ctx.fillStyle = skin.colours.bandana;
    ctx.beginPath();
    ctx.ellipse(radius * 0.32, 0, radius * 0.2, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // hat
    ctx.fillStyle = skin.colours.hat;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.78, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.colours.hatBand;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.06, 0, radius * 0.5, radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.colours.hat;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.1, 0, radius * 0.34, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // hat shadow edge
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.78, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (hurt > 0) {
      ctx.globalAlpha = hurt * 0.6;
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.1, radius * 1.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  drawWeaponInHands(radius, gunSkin, gun, flash) {
    const ctx = this.ctx;
    const len = gun ? this.gunLength(gun) : 18;
    const gx = radius * 0.35;

    // hands
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(gx + 3, -radius * 0.22, radius * 0.2, radius * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(gx + 3, radius * 0.22, radius * 0.2, radius * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // gun body
    ctx.fillStyle = gunSkin.colours.trim;
    ctx.fillRect(gx, -radius * 0.16, len + 4, radius * 0.32);
    ctx.fillStyle = gunSkin.colours.body;
    ctx.fillRect(gx + 1, -radius * 0.12, len, radius * 0.24);
    // grip
    ctx.fillStyle = gunSkin.colours.grip;
    ctx.fillRect(gx - 2, -radius * 0.1, 7, radius * 0.2);
    // barrel tip
    ctx.fillStyle = gunSkin.colours.trim;
    ctx.fillRect(gx + len, -radius * 0.07, 4, radius * 0.14);

    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(gx + len + 4, 0);
      ctx.lineTo(gx + len + 4 + 20 * flash, -7 * flash);
      ctx.lineTo(gx + len + 4 + 28 * flash, 0);
      ctx.lineTo(gx + len + 4 + 20 * flash, 7 * flash);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  gunLength(gun) {
    switch (gun.klass) {
      case 'rifle':
        return 30;
      case 'heavy':
        return 34;
      case 'shotgun':
        return 24;
      case 'repeater':
        return 28;
      case 'exotic':
        return 22;
      default:
        return 16;
    }
  }

  drawPlayer(game) {
    const p = game.player;
    const skin = getPlayerSkin(game.save.equipped.playerSkin);
    const gunSkin = getGunSkin(game.save.equipped.gunSkin);
    const dead = game.phase === 'dead';

    // dash trail
    if (game.time < p.dashUntil) {
      const ctx = this.ctx;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = game.map.palette.dust;
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.radius * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    this.drawCowboy({
      x: p.x,
      y: p.y,
      angle: p.angle,
      radius: p.radius,
      skin,
      gunSkin,
      gun: game.gun,
      flash: p.muzzleFlash,
      hurt: p.hurtFlash,
      bob: p.bob,
      dead,
    });

    // i-frame ring
    if (game.time < p.invulnUntil && !dead) {
      const ctx = this.ctx;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawEnemies(game) {
    for (const e of game.enemies) {
      const ctx = this.ctx;
      const pal = e.def.palette;
      const scale = e.spawnAnim > 0 ? 1 - e.spawnAnim * 0.9 : 1;
      const r = e.radius * scale;

      ctx.save();
      ctx.translate(e.x, e.y);

      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(2, 5, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // sniper telegraph
      if (e.telegraph > 0) {
        const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
        ctx.save();
        ctx.rotate(a);
        ctx.strokeStyle = `rgba(255,60,40,${0.25 + (1 - e.telegraph / (e.def.telegraph || 1)) * 0.55})`;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(900, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.rotate(e.angle);

      // body
      ctx.fillStyle = pal.coat;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(r * 0.1, -r * 0.35);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(r * 0.1, r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // arms + gun
      const gunLen = e.typeId === 'sniper' ? 30 : e.typeId === 'thug' ? 22 : e.def.isBoss ? 28 : 16;
      ctx.fillStyle = 'rgba(20,15,12,0.85)';
      ctx.fillRect(r * 0.3, -r * 0.14, gunLen, r * 0.26);
      ctx.fillStyle = 'rgba(60,45,30,0.9)';
      ctx.fillRect(r * 0.1, -r * 0.1, 6, r * 0.2);

      // face mask / bandana
      ctx.fillStyle = e.def.isBoss ? '#8a1f1f' : '#3a2b22';
      ctx.beginPath();
      ctx.ellipse(r * 0.3, 0, r * 0.22, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // hat
      ctx.fillStyle = pal.hat;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (e.def.isBoss ? 0.86 : 0.78), r * (e.def.isBoss ? 0.8 : 0.72), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.def.isBoss ? '#e0b34a' : '#241a13';
      ctx.beginPath();
      ctx.ellipse(-r * 0.06, 0, r * 0.48, r * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.hat;
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, 0, r * 0.33, r * 0.31, 0, 0, Math.PI * 2);
      ctx.fill();

      if (e.hitFlash > 0) {
        ctx.globalAlpha = e.hitFlash * 0.75;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.1, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // health bar
      if (e.hp < e.maxHp) {
        const w = e.def.isBoss ? 64 : 30;
        const h = e.def.isBoss ? 6 : 4;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w, h);
        ctx.fillStyle = e.def.isBoss ? '#e0b34a' : '#c0392b';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w * Math.max(0, e.hp / e.maxHp), h);
        if (e.def.isBoss) {
          ctx.fillStyle = '#ffe6b0';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(e.def.name.toUpperCase(), e.x, e.y - e.radius - 20);
        }
      }
    }
  }

  /* ----------------------------------------------------------- effects */

  drawBullets(game) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const b of game.bullets) {
      const len = 16;
      const nx = b.vx / Math.hypot(b.vx, b.vy);
      const ny = b.vy / Math.hypot(b.vx, b.vy);
      ctx.strokeStyle = 'rgba(255, 214, 130, 0.85)';
      ctx.lineWidth = b.splash > 0 ? 5 : 2.6;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * len, b.y - ny * len);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.splash > 0 ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemyBullets(game) {
    const ctx = this.ctx;
    for (const b of game.enemyBullets) {
      ctx.strokeStyle = 'rgba(255,120,90,0.7)';
      ctx.lineWidth = 2.4;
      const nx = b.vx / Math.hypot(b.vx, b.vy);
      const ny = b.vy / Math.hypot(b.vx, b.vy);
      ctx.beginPath();
      ctx.moveTo(b.x - nx * 12, b.y - ny * 12);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffd0b0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPickups(game) {
    const ctx = this.ctx;
    for (const k of game.pickups) {
      const fade = k.t < 3 ? (Math.sin(this.time * 12) > 0 ? 0.35 : 1) : 1;
      ctx.globalAlpha = fade;
      if (k.kind === 'coin') {
        const s = Math.abs(Math.cos(k.spin)) * 6 + 2;
        ctx.fillStyle = '#a5761c';
        ctx.beginPath();
        ctx.ellipse(k.x, k.y + 1, s + 1, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0c24a';
        ctx.beginPath();
        ctx.ellipse(k.x, k.y, s, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff0b8';
        ctx.beginPath();
        ctx.ellipse(k.x - s * 0.2, k.y - 1.5, s * 0.35, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (k.kind === 'bounty') {
        const pulse = 1 + Math.sin(this.time * 4) * 0.12;
        ctx.strokeStyle = '#ffe9a8';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#f5d76e';
        ctx.beginPath();
        const r = 9 * pulse;
        for (let i = 0; i < 5; i += 1) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const a2 = a + Math.PI / 5;
          ctx.lineTo(k.x + Math.cos(a) * r, k.y + Math.sin(a) * r);
          ctx.lineTo(k.x + Math.cos(a2) * r * 0.45, k.y + Math.sin(a2) * r * 0.45);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (k.kind === 'health') {
        ctx.fillStyle = '#5a3a2a';
        this.roundRect(k.x - 8, k.y - 10, 16, 20, 3);
        ctx.fill();
        ctx.fillStyle = '#7fd07a';
        ctx.fillRect(k.x - 6, k.y - 2, 12, 4);
        ctx.fillRect(k.x - 2, k.y - 6, 4, 12);
      } else if (k.kind === 'ammo') {
        ctx.fillStyle = '#4a4034';
        this.roundRect(k.x - 10, k.y - 7, 20, 14, 2);
        ctx.fill();
        ctx.fillStyle = '#c8a165';
        for (let i = 0; i < 3; i += 1) ctx.fillRect(k.x - 8 + i * 6, k.y - 5, 4, 10);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawParticles(game) {
    const ctx = this.ctx;
    for (const p of game.particles) {
      const a = Math.max(0, p.t / (p.max || 0.6));
      ctx.globalAlpha = a;
      if (p.ring) {
        ctx.strokeStyle = p.colour;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - a), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(game) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const f of game.floaters) {
      const a = Math.min(1, f.t / 0.5);
      ctx.globalAlpha = a;
      ctx.font = `bold ${f.crit ? 20 : 14}px monospace`;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.colour;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawFog(game) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = game.map.palette;
    ctx.fillStyle = pal.fog;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    const g = ctx.createRadialGradient(
      this.cssWidth / 2,
      this.cssHeight / 2,
      Math.min(this.cssWidth, this.cssHeight) * 0.3,
      this.cssWidth / 2,
      this.cssHeight / 2,
      Math.max(this.cssWidth, this.cssHeight) * 0.75,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, pal.vignette);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    if (game.player.hurtFlash > 0.05) {
      ctx.fillStyle = `rgba(180, 30, 20, ${game.player.hurtFlash * 0.28})`;
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    }
  }

  drawOffscreenMarkers(game, cam) {
    const ctx = this.ctx;
    const halfW = this.viewW / 2 - 34;
    const halfH = this.viewH / 2 - 34;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const e of game.enemies) {
      const dx = e.x - cam.x;
      const dy = e.y - cam.y;
      if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) continue;
      const a = Math.atan2(dy, dx);
      const sx = this.cssWidth / 2 + (Math.abs(dx) > halfW ? halfW * Math.sign(dx) : dx) * this.scale;
      const sy = this.cssHeight / 2 + (Math.abs(dy) > halfH ? halfH * Math.sign(dy) : dy) * this.scale;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.fillStyle = e.def.isBoss ? '#ffd76a' : 'rgba(220, 70, 50, 0.85)';
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawMinimap(game) {
    const ctx = this.ctx;
    const mmW = 168;
    const mmH = Math.round((mmW * WORLD.height) / WORLD.width);
    const pad = 14;
    const x = this.cssWidth - mmW - pad;
    const y = pad + 22;
    const sx = mmW / WORLD.width;
    const sy = mmH / WORLD.height;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = 'rgba(18, 12, 8, 0.78)';
    this.roundRect(x - 5, y - 5, mmW + 10, mmH + 10, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(226, 199, 137, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(226, 199, 137, 0.28)';
    for (const o of game.obstacles) {
      ctx.fillRect(x + o.x * sx, y + o.y * sy, Math.max(1, o.w * sx), Math.max(1, o.h * sy));
    }
    for (const e of game.enemies) {
      ctx.fillStyle = e.def.isBoss ? '#ffd76a' : '#e0553c';
      ctx.beginPath();
      ctx.arc(x + e.x * sx, y + e.y * sy, e.def.isBoss ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const k of game.pickups) {
      if (k.kind !== 'bounty') continue;
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(x + k.x * sx - 1.5, y + k.y * sy - 1.5, 3, 3);
    }
    // player
    const p = game.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#7fd07a';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-3.5, -3.5);
    ctx.lineTo(-3.5, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(226, 199, 137, 0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(game.map.name.toUpperCase(), x - 4, y - 9);
    ctx.restore();
  }
}
